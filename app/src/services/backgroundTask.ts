import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { drainUploadQueue } from './backgroundUpload';

export const BACKGROUND_UPLOAD_TASK = 'com.makxas.salesrecording.upload';

// タスク定義はモジュールロード時に必ず行う必要がある（iOS の仕様）
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

/**
 * アプリが閉じられている間も定期的に（iOS: ~15分毎、Android: WorkManager 管理）
 * キューに残った録音をアップロードする。
 */
export async function registerBackgroundUploadTask(): Promise<{
  registered: boolean;
  reason?: string;
}> {
  try {
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
      minimumInterval: 15 * 60, // iOS の最短は15分
      stopOnTerminate: false, // Android: アプリ終了後も継続
      startOnBoot: true, // Android: 再起動後も自動登録
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
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_UPLOAD_TASK);
  if (isRegistered) {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_UPLOAD_TASK);
  }
}
