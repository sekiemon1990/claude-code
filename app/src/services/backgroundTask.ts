import { Platform } from 'react-native';

import { DEMO_MODE } from '@/demo';

export const BACKGROUND_UPLOAD_TASK = 'com.makxas.salesrecording.upload';

// DEMO / web 環境ではバックグラウンドタスクは動かさない
const SKIP_BACKGROUND = DEMO_MODE || Platform.OS === 'web';

if (!SKIP_BACKGROUND) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const TaskManager = require('expo-task-manager');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const BackgroundFetch = require('expo-background-fetch');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { drainUploadQueue } = require('./backgroundUpload');

  TaskManager.defineTask(BACKGROUND_UPLOAD_TASK, async () => {
    try {
      const result = await drainUploadQueue({});
      if (result.reason === 'offline') {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
      if (result.uploaded > 0) {
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }
      return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

/**
 * アプリが閉じられている間も定期的に（iOS: ~15分毎、Android: WorkManager 管理）
 * キューに残った録音をアップロードする。
 */
export async function registerBackgroundUploadTask(): Promise<{
  registered: boolean;
  reason?: string;
}> {
  if (SKIP_BACKGROUND) {
    return { registered: false, reason: 'skipped in demo/web mode' };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TaskManager = require('expo-task-manager');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const BackgroundFetch = require('expo-background-fetch');

    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return {
        registered: false,
        reason:
          'バックグラウンド更新が端末側で無効になっています（設定アプリで有効化してください）',
      };
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_UPLOAD_TASK);
    if (isRegistered) return { registered: true };

    await BackgroundFetch.registerTaskAsync(BACKGROUND_UPLOAD_TASK, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
    return { registered: true };
  } catch (err) {
    return {
      registered: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function unregisterBackgroundUploadTask(): Promise<void> {
  if (SKIP_BACKGROUND) return;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const TaskManager = require('expo-task-manager');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const BackgroundFetch = require('expo-background-fetch');
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_UPLOAD_TASK);
  if (isRegistered) {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_UPLOAD_TASK);
  }
}
