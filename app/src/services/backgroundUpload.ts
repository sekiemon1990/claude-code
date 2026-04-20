import NetInfo from '@react-native-community/netinfo';
import { onAuthStateChanged } from 'firebase/auth';

import { firebaseAuth } from '@/config/firebase';
import {
  listQueue,
  removeQueueItem,
  updateQueueItem,
} from '@/services/uploadQueue';
import { createRecordingAndUpload } from '@/services/recordings';

export const AUTO_RETRY_LIMIT = 5;

export type DrainProgressCallback = (queueId: string, percent: number | null) => void;

export type DrainResult = {
  uploaded: number;
  failed: number;
  skipped: number;
  reason?: 'offline' | 'no-user' | 'empty';
};

/**
 * Firebase Auth のセッション復元を待つ（バックグラウンド起動直後は currentUser が null のことがある）
 */
async function waitForAuthUid(timeoutMs = 5000): Promise<string | null> {
  if (firebaseAuth.currentUser?.uid) return firebaseAuth.currentUser.uid;
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsub();
      resolve(null);
    }, timeoutMs);
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      if (settled) return;
      if (user?.uid) {
        settled = true;
        clearTimeout(timer);
        unsub();
        resolve(user.uid);
      }
    });
  });
}

/**
 * キューをドレインする共通ロジック。
 * - React フック（フォアグラウンド用）
 * - Background Fetch タスク（アプリ非アクティブ時）
 * の両方から呼べる。
 */
export async function drainUploadQueue(options: {
  ownerUid?: string;
  onProgress?: DrainProgressCallback;
  respectAutoRetryLimit?: boolean;
}): Promise<DrainResult> {
  const respectLimit = options.respectAutoRetryLimit ?? true;
  let ownerUid = options.ownerUid;
  if (!ownerUid) {
    const uid = await waitForAuthUid();
    if (!uid) return { uploaded: 0, failed: 0, skipped: 0, reason: 'no-user' };
    ownerUid = uid;
  }

  const net = await NetInfo.fetch();
  if (!net.isConnected || net.isInternetReachable === false) {
    return { uploaded: 0, failed: 0, skipped: 0, reason: 'offline' };
  }

  let uploaded = 0;
  let failed = 0;
  let skipped = 0;

  // 1件ずつ送信。外部からの変更を反映するため毎回キューを読み直す
  while (true) {
    const items = await listQueue(ownerUid);
    const target = items.find((it) => {
      if (it.status === 'uploading') return false;
      if (respectLimit && it.attempts >= AUTO_RETRY_LIMIT) return false;
      return true;
    });
    if (!target) break;

    await updateQueueItem(ownerUid, target.queueId, { status: 'uploading' });
    options.onProgress?.(target.queueId, 0);

    try {
      await createRecordingAndUpload({
        ownerUid: target.ownerUid,
        dealId: target.dealId,
        dealSnapshot: target.dealSnapshot,
        title: target.title,
        localUri: target.localUri,
        durationMs: target.durationMs,
        onProgress: (percent) => options.onProgress?.(target.queueId, percent),
      });
      await removeQueueItem(ownerUid, target.queueId);
      uploaded += 1;
    } catch (err) {
      await updateQueueItem(ownerUid, target.queueId, {
        status: 'failed',
        attempts: target.attempts + 1,
        lastError: err instanceof Error ? err.message : String(err),
      });
      failed += 1;
    } finally {
      options.onProgress?.(target.queueId, null);
    }
  }

  if (uploaded === 0 && failed === 0) {
    return { uploaded, failed, skipped, reason: 'empty' };
  }
  return { uploaded, failed, skipped };
}
