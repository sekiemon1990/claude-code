import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import {
  listQueue,
  pruneMissingFiles,
  updateQueueItem,
  type QueuedRecording,
} from '@/services/uploadQueue';
import { drainUploadQueue } from '@/services/backgroundUpload';

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

  const drain = useCallback(async () => {
    if (!ownerUid) return;
    if (drainingRef.current) return;
    drainingRef.current = true;
    setDraining(true);
    try {
      await drainUploadQueue({
        ownerUid,
        onProgress: (queueId, percent) => {
          setProgress((prev) => {
            if (percent == null) {
              const { [queueId]: _, ...rest } = prev;
              return rest;
            }
            return { ...prev, [queueId]: percent };
          });
          // 送信開始・終了のタイミングでキューを再読み込み
          void refresh();
        },
      });
      await refresh();
    } finally {
      drainingRef.current = false;
      setDraining(false);
    }
  }, [ownerUid, refresh]);

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
        // バックグラウンドでアップロードが進んでいる可能性があるので、まずキュー再読み込み
        void refresh();
        void drain();
      }
    });
    return () => sub.remove();
  }, [refresh, drain]);

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
