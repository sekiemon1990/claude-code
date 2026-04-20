import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import {
  listQueue,
  pruneMissingFiles,
  removeQueueItem,
  updateQueueItem,
  type QueuedRecording,
} from '@/services/uploadQueue';
import { createRecordingAndUpload } from '@/services/recordings';

const AUTO_RETRY_LIMIT = 5;

export type UploadProgressMap = Record<string, number>;

export function useUploadQueue(ownerUid: string | undefined) {
  const [queue, setQueue] = useState<QueuedRecording[]>([]);
  const [progress, setProgress] = useState<UploadProgressMap>({});
  const [draining, setDraining] = useState(false);
  const [online, setOnline] = useState<boolean>(true);
  const drainingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!ownerUid) return;
    const items = await listQueue(ownerUid);
    setQueue(items);
  }, [ownerUid]);

  const updateProgress = useCallback((queueId: string, percent: number | null) => {
    setProgress((prev) => {
      if (percent == null) {
        // 完了 or 失敗時はクリア
        const { [queueId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [queueId]: percent };
    });
  }, []);

  const drain = useCallback(async () => {
    if (!ownerUid) return;
    if (drainingRef.current) return;
    drainingRef.current = true;
    setDraining(true);
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected || net.isInternetReachable === false) {
        return;
      }

      // 毎回キューを読み直すことで、外部からの attempts リセット等の変更を拾う
      let keepGoing = true;
      while (keepGoing) {
        keepGoing = false;
        const items = await listQueue(ownerUid);
        for (const item of items) {
          if (item.status === 'uploading') continue;
          if (item.attempts >= AUTO_RETRY_LIMIT) continue;

          keepGoing = true;
          await updateQueueItem(ownerUid, item.queueId, { status: 'uploading' });
          setQueue(await listQueue(ownerUid));
          updateProgress(item.queueId, 0);

          try {
            await createRecordingAndUpload({
              ownerUid: item.ownerUid,
              title: item.title,
              localUri: item.localUri,
              durationMs: item.durationMs,
              onProgress: (percent) => updateProgress(item.queueId, percent),
            });
            await removeQueueItem(ownerUid, item.queueId);
          } catch (err) {
            await updateQueueItem(ownerUid, item.queueId, {
              status: 'failed',
              attempts: item.attempts + 1,
              lastError: err instanceof Error ? err.message : String(err),
            });
          } finally {
            updateProgress(item.queueId, null);
          }
          setQueue(await listQueue(ownerUid));
          // 1件ずつ順次処理（並列にしない：帯域を食わないため & 進捗表示を分かりやすく）
          break;
        }
      }
    } finally {
      drainingRef.current = false;
      setDraining(false);
    }
  }, [ownerUid, updateProgress]);

  // 失敗／自動リトライ上限到達アイテムを手動でリセットして再送
  const retryItem = useCallback(
    async (queueId: string) => {
      if (!ownerUid) return;
      await updateQueueItem(ownerUid, queueId, {
        status: 'pending',
        attempts: 0,
        lastError: undefined,
      });
      await refresh();
      void drain();
    },
    [ownerUid, refresh, drain],
  );

  const retryAll = useCallback(async () => {
    if (!ownerUid) return;
    const items = await listQueue(ownerUid);
    for (const item of items) {
      if (item.status !== 'uploading') {
        await updateQueueItem(ownerUid, item.queueId, {
          status: 'pending',
          attempts: 0,
          lastError: undefined,
        });
      }
    }
    await refresh();
    void drain();
  }, [ownerUid, refresh, drain]);

  // 初期ロード & ロスト音声ファイルの掃除
  useEffect(() => {
    if (!ownerUid) return;
    (async () => {
      await pruneMissingFiles(ownerUid);
      await refresh();
      const net = await NetInfo.fetch();
      setOnline(!!net.isConnected);
      if (net.isConnected && net.isInternetReachable !== false) {
        void drain();
      }
    })();
  }, [ownerUid, refresh, drain]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      const nowOnline = !!state.isConnected && state.isInternetReachable !== false;
      setOnline(nowOnline);
      if (nowOnline) {
        void drain();
      }
    });
    return () => unsub();
  }, [drain]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void drain();
      }
    });
    return () => sub.remove();
  }, [drain]);

  return {
    queue,
    progress,
    draining,
    online,
    refresh,
    drain,
    retryItem,
    retryAll,
  };
}
