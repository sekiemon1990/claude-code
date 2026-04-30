import firestore, { type FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';

import { DEMO_MODE, demoStore } from '@/demo';
import type { DealSnapshot, Recording, RecordingStatus } from '@/types';

const RECORDINGS = 'recordings';

type Unsubscribe = () => void;

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

export async function createRecordingAndUpload(params: {
  ownerUid: string;
  dealId: string;
  dealSnapshot: DealSnapshot;
  title: string;
  localUri: string;
  durationMs: number;
  onProgress?: (percent: number) => void;
}): Promise<UploadResult> {
  const { ownerUid, dealId, dealSnapshot, title, localUri, durationMs, onProgress } = params;

  if (DEMO_MODE) {
    for (const p of [15, 40, 70, 100]) {
      await new Promise((r) => setTimeout(r, 250));
      onProgress?.(p);
    }
    const id = demoStore.createAndSimulate({
      ownerUid,
      dealSnapshot,
      title,
      durationMs,
    });
    return {
      recordingId: id,
      downloadUrl: `demo://${id}`,
      storagePath: `demo/${id}/audio.m4a`,
    };
  }

  const docRef = await firestore()
    .collection(RECORDINGS)
    .add({
      ownerUid,
      dealId,
      dealSnapshot,
      title,
      durationMs,
      status: 'uploading' satisfies RecordingStatus,
      storagePath: '',
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

  // doc 作成より後で失敗した場合に Firestore にオーファン doc を残さないよう、
  // 全処理を try/catch で囲み、失敗時は best-effort で doc を削除してから rethrow する。
  // backgroundUpload 側のリトライ判定は元のエラーを見るため、必ず元エラーを投げ直す。
  try {
    const extension = localUri.split('.').pop() ?? 'm4a';
    const storagePath = `recordings/${ownerUid}/${docRef.id}/audio.${extension}`;
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

    await docRef.update({
      storagePath,
      downloadUrl,
      status: 'uploaded' satisfies RecordingStatus,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    return { recordingId: docRef.id, downloadUrl, storagePath };
  } catch (err) {
    // オーファン doc を残さないため best-effort で削除。
    // delete 自体が失敗しても元のエラーは握りつぶさず rethrow する。
    try {
      await docRef.delete();
    } catch {
      // 削除失敗時は無視（元のアップロードエラーが本質なのでそちらを優先）
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
