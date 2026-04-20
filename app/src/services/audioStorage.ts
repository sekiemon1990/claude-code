import * as FileSystem from 'expo-file-system';

const RECORDINGS_DIR = `${FileSystem.documentDirectory}recordings/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
  }
}

/**
 * expo-av が吐き出すキャッシュ領域の音声ファイルを、アプリ再起動でも消えない
 * documentDirectory 配下に移動する。戻り値は移動後の URI。
 */
export async function persistRecording(cacheUri: string, queueId: string): Promise<string> {
  await ensureDir();
  const extension = cacheUri.split('.').pop() ?? 'm4a';
  const destination = `${RECORDINGS_DIR}${queueId}.${extension}`;
  await FileSystem.moveAsync({ from: cacheUri, to: destination });
  return destination;
}

export async function deletePersistedRecording(uri: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // 既に無い / アクセス不可は無視
  }
}

export async function persistedRecordingExists(uri: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists;
}
