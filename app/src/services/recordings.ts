import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';

import { firestore, storage } from '@/config/firebase';
import type { DealSnapshot, Recording, RecordingStatus } from '@/types';

const RECORDINGS = 'recordings';

export function subscribeToRecordings(
  ownerUid: string,
  onUpdate: (recordings: Recording[]) => void,
): Unsubscribe {
  const q = query(
    collection(firestore, RECORDINGS),
    where('ownerUid', '==', ownerUid),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Recording, 'id'>) }));
    onUpdate(items);
  });
}

export function subscribeToRecording(
  recordingId: string,
  onUpdate: (recording: Recording | null) => void,
): Unsubscribe {
  const docRef = doc(firestore, RECORDINGS, recordingId);
  return onSnapshot(docRef, (snap) => {
    if (!snap.exists()) {
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

  // 1. Firestore にレコードを先に作成（初期ステータスは uploading）
  const docRef = await addDoc(collection(firestore, RECORDINGS), {
    ownerUid,
    dealId,
    dealSnapshot,
    title,
    durationMs,
    status: 'uploading' satisfies RecordingStatus,
    storagePath: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const extension = localUri.split('.').pop() ?? 'm4a';
  const storagePath = `recordings/${ownerUid}/${docRef.id}/audio.${extension}`;
  const storageRef = ref(storage, storagePath);

  const fileInfo = await FileSystem.getInfoAsync(localUri);
  if (!fileInfo.exists) {
    throw new Error('録音ファイルが見つかりません');
  }
  const response = await fetch(localUri);
  const blob = await response.blob();

  const task = uploadBytesResumable(storageRef, blob, {
    contentType: inferContentType(extension),
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        if (onProgress) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      reject,
      () => resolve(),
    );
  });

  const downloadUrl = await getDownloadURL(storageRef);

  await updateDoc(docRef, {
    storagePath,
    downloadUrl,
    status: 'uploaded' satisfies RecordingStatus,
    updatedAt: serverTimestamp(),
  });

  return { recordingId: docRef.id, downloadUrl, storagePath };
}

export async function deleteRecording(recording: Recording) {
  if (recording.storagePath) {
    try {
      await deleteObject(ref(storage, recording.storagePath));
    } catch {
      // 既に無い場合は無視
    }
  }
  await deleteDoc(doc(firestore, RECORDINGS, recording.id));
}

function inferContentType(extension: string): string {
  switch (extension.toLowerCase()) {
    case 'm4a':
      return 'audio/m4a';
    case 'mp4':
      return 'audio/mp4';
    case 'caf':
      return 'audio/x-caf';
    case 'aac':
      return 'audio/aac';
    case 'wav':
      return 'audio/wav';
    default:
      return 'audio/mpeg';
  }
}
