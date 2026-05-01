import firestore, { type FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';

import { DEMO_MODE, demoStore } from '@/demo';
import type { DealSnapshot, Recording, RecordingStatus } from '@/types';

const RECORDINGS = 'recordings';

type Unsubscribe = () => void;

/**
 * アップロード対象の Firestore doc が削除済みであることを示すエラー。
 * 呼び出し側 (backgroundUpload) はこれをキャッチしたら、
 * リトライせずキューから除外しローカルファイルも破棄する。
 */
export class RecordingDocNotFoundError extends Error {
  constructor(public readonly recordingId: string) {
    super(`recording doc not found: ${recordingId}`);
    this.name = 'RecordingDocNotFoundError';
  }
}

function isFirestoreNotFound(err: unknown): boolean {
  if (!err) return false;
  const code = (err as { code?: string }).code;
  if (code === 'firestore/not-found') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /not.?found/i.test(msg);
}

export function subscribeToRecordings(
  ownerUid: string,
  onUpdate: (recordings: Recording[]) => void,
): Unsubscribe {
  if (DEMO_MODE) {
    return demoStore.subscribeList(onUpdate);
  }
  return firestore()
    .collection(RECORDINGS)
    .where('ownerUid', '==', ownerUid)
    .orderBy('createdAt', 'desc')
    .onSnapshot((snap) => {
      if (!snap) return;
      const items = snap.docs.map(
        (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
          id: d.id,
          ...(d.data() as Omit<Recording, 'id'>),
        }),
      );
      onUpdate(items);
    });
}

export function subscribeToRecording(
  recordingId: string,
  onUpdate: (recording: Recording | null) => void,
): Unsubscribe {
  if (DEMO_MODE) {
    return demoStore.subscribeDetail(recordingId, onUpdate);
  }
  return firestore()
    .collection(RECORDINGS)
    .doc(recordingId)
    .onSnapshot((snap) => {
      if (!snap || !snap.exists) {
        onUpdate(null);
        return;
      }
      onUpdate({ id: snap.id, ...(snap.data() as Omit<Recording, 'id'>) });
    });
}

type UploadResult = {
  recordingId: string;
  downloadUrl: string;
  storagePath: string;
};

/**
 * DEMO 専用: demoStore に直接流してアップロードをシミュレート。
 * Firestore には一切書かないため Cloud Functions の Chatwork 通知も飛ばない。
 */
export async function createDemoRecording(params: {
  ownerUid: string;
  dealSnapshot: DealSnapshot;
  title: string;
  durationMs: number;
  onProgress?: (percent: number) => void;
}): Promise<UploadResult> {
  for (const p of [15, 40, 70, 100]) {
    await new Promise((r) => setTimeout(r, 250));
    params.onProgress?.(p);
  }
  const id = demoStore.createAndSimulate({
    ownerUid: params.ownerUid,
    dealSnapshot: params.dealSnapshot,
    title: params.title,
    durationMs: params.durationMs,
  });
  return {
    recordingId: id,
    downloadUrl: `demo://${id}`,
    storagePath: `demo/${id}/audio.m4a`,
  };
}

/**
 * 録音開始時に呼ぶ。Firestore に status='recording' の doc を作成する。
 * recordingStartedAt はクライアント時刻 (操作タイミング) を Timestamp.fromDate で焼き付ける。
 * createdAt/updatedAt は従来通り serverTimestamp。
 * DEMO_MODE では呼ばない (呼び出し側でガードすること)。
 */
export async function createRecordingDocOnStart(params: {
  ownerUid: string;
  dealId: string;
  dealSnapshot: DealSnapshot;
  title: string;
  assessorName: string;
}): Promise<{ recordingId: string }> {
  const startedAt = firestore.Timestamp.fromDate(new Date());
  const docRef = await firestore()
    .collection(RECORDINGS)
    .add({
      ownerUid: params.ownerUid,
      dealId: params.dealId,
      dealSnapshot: params.dealSnapshot,
      title: params.title,
      durationMs: 0,
      storagePath: '',
      status: 'recording' satisfies RecordingStatus,
      assessorName: params.assessorName,
      recordingStartedAt: startedAt,
      recordingEndedAt: null,
      chatworkNotifiedStartAt: null,
      chatworkNotifiedEndAt: null,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  return { recordingId: docRef.id };
}

/**
 * 録音停止時に呼ぶ。doc を 'recording' → 'uploading' に遷移させ、
 * recordingEndedAt (クライアント時刻) と durationMs を焼き付ける。
 * この遷移が notifyRecordingEnd Function の発火条件。
 * DEMO_MODE では呼ばない。
 */
export async function markRecordingStopped(params: {
  recordingId: string;
  durationMs: number;
}): Promise<void> {
  const endedAt = firestore.Timestamp.fromDate(new Date());
  await firestore().collection(RECORDINGS).doc(params.recordingId).update({
    status: 'uploading' satisfies RecordingStatus,
    recordingEndedAt: endedAt,
    durationMs: params.durationMs,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * 録音中断・取得失敗など、stop は完了したがファイルが取れなかった場合に呼ぶ。
 * doc が既に消えていてもエラーにしない (best-effort)。
 */
export async function markRecordingFailed(params: {
  recordingId: string;
  errorMessage: string;
}): Promise<void> {
  try {
    await firestore().collection(RECORDINGS).doc(params.recordingId).update({
      status: 'failed' satisfies RecordingStatus,
      errorMessage: params.errorMessage,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  } catch {
    // doc が無くても問題ない
  }
}

/**
 * 既存 doc に対して Storage アップロードを実行し、status='uploaded' まで進める。
 *
 * 失敗時の挙動 (P0-2 から仕様変更):
 *  旧版は doc を delete していたが、新フローでは doc は録音開始時に既に作成済みで
 *  Chatwork 開始通知も飛んでいるため、削除するとゴーストになる。
 *  そのため失敗時は status='failed' に倒して履歴を残す。
 *
 * doc 自体が消えていたら RecordingDocNotFoundError を throw する。
 * 呼び出し側 (backgroundUpload) はキューから除外する。
 */
export async function uploadRecordingToCompletion(params: {
  recordingId: string;
  ownerUid: string;
  localUri: string;
  onProgress?: (percent: number) => void;
}): Promise<UploadResult> {
  const { recordingId, ownerUid, localUri, onProgress } = params;
  const docRef = firestore().collection(RECORDINGS).doc(recordingId);

  try {
    const extension = localUri.split('.').pop() ?? 'm4a';
    const storagePath = `recordings/${ownerUid}/${recordingId}/audio.${extension}`;
    const storageRef = storage().ref(storagePath);

    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      throw new Error('録音ファイルが見つかりません');
    }

    // @react-native-firebase/storage はローカルファイルパスを直接受け取れる
    const task = storageRef.putFile(localUri.replace(/^file:\/\//, ''));

    let pausedByNetwork = false;
    const netUnsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      if (!online && !pausedByNetwork) {
        try {
          task.pause();
          pausedByNetwork = true;
        } catch {
          // pause は冪等なはず
        }
      } else if (online && pausedByNetwork) {
        try {
          task.resume();
          pausedByNetwork = false;
        } catch {
          // resume も冪等
        }
      }
    });

    try {
      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => {
            if (onProgress && snap) {
              onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
            }
          },
          reject,
          () => resolve(),
        );
      });
    } finally {
      netUnsub();
    }

    const downloadUrl = await storageRef.getDownloadURL();

    try {
      await docRef.update({
        storagePath,
        downloadUrl,
        status: 'uploaded' satisfies RecordingStatus,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (updateErr) {
      if (isFirestoreNotFound(updateErr)) {
        throw new RecordingDocNotFoundError(recordingId);
      }
      throw updateErr;
    }

    return { recordingId, downloadUrl, storagePath };
  } catch (err) {
    if (err instanceof RecordingDocNotFoundError) {
      throw err;
    }
    // best-effort で status='failed' に倒す。doc が消えていれば NOT_FOUND を伝播。
    try {
      await docRef.update({
        status: 'failed' satisfies RecordingStatus,
        errorMessage: err instanceof Error ? err.message : String(err),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (markErr) {
      if (isFirestoreNotFound(markErr)) {
        throw new RecordingDocNotFoundError(recordingId);
      }
      // failed 更新自体の失敗は握りつぶす (元エラーが本質)
    }
    throw err;
  }
}

export async function deleteRecording(recording: Recording) {
  if (DEMO_MODE) {
    demoStore.remove(recording.id);
    return;
  }
  if (recording.storagePath) {
    try {
      await storage().ref(recording.storagePath).delete();
    } catch {
      // 既に無い場合は無視
    }
  }
  await firestore().collection(RECORDINGS).doc(recording.id).delete();
}
