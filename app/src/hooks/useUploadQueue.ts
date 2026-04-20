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

const MAX_ATTEMPTS = 5;

export function useUploadQueue(ownerUid: string | undefined) {
  const [queue, setQueue] = useState<QueuedRecording[]>([]);
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
      const net = await NetInfo.fetch();
      if (!net.isConnected || net.isInternetReachable === false) {
        return;
      }

      let items = await listQueue(ownerUid);
      for (const item of items) {
        if (item.status === 'uploading') continue;
        if (item.attempts >= MAX_ATTEMPTS) continue;

        await updateQueueItem(ownerUid, item.queueId, { status: 'uploading' });
        setQueue(await listQueue(ownerUid));

        try {
          await createRecordingAndUpload({
            ownerUid: item.ownerUid,
            title: item.title,
            localUri: item.localUri,
            durationMs: item.durationMs,
          });
          await removeQueueItem(ownerUid, item.queueId);
        } catch (err) {
          await updateQueueItem(ownerUid, item.queueId, {
            status: 'failed',
            attempts: item.attempts + 1,
            lastError: err instanceof Error ? err.message : String(err),
          });
        }
        setQueue(await listQueue(ownerUid));
      }
    } finally {
      drainingRef.current = false;
      setDraining(false);
    }
  }, [ownerUid]);

  // 初期ロード & ロスト音声ファイルの掃除
  useEffect(() => {
    if (!ownerUid) return;
    (async () => {
      await pruneMissingFiles(ownerUid);
      await refresh();
      // 起動時にオンラインならドレイン
      const net = await NetInfo.fetch();
      setOnline(!!net.isConnected);
      if (net.isConnected && net.isInternetReachable !== false) {
        void drain();
      }
    })();
  }, [ownerUid, refresh, drain]);

  // ネットワーク状態が「復帰」したタイミングでドレイン
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

  // アプリがフォアグラウンドに戻った時にドレイン
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void drain();
      }
    });
    return () => sub.remove();
  }, [drain]);

  return { queue, draining, online, refresh, drain };
}
