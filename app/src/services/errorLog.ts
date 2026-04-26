import { Platform } from 'react-native';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import Constants from 'expo-constants';

import { firebaseAuth, firestore } from '@/config/firebase';
import { DEMO_MODE } from '@/demo';

export type ErrorKind =
  | 'recording_failed'
  | 'upload_failed'
  | 'pipeline_failed'
  | 'auth_failed'
  | 'crm_failed'
  | 'background_failed'
  | 'other';

export type ErrorLogEntry = {
  kind: ErrorKind;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  createdAt: number;
  uid: string | null;
  email: string | null;
  platform: string;
  appVersion: string;
};

const COLLECTION = 'errorLogs';
const APP_VERSION = (Constants.expoConfig?.version as string | undefined) ?? 'unknown';

// デモ用：直近のエラーをメモリに保持し、ダッシュボードから参照できるようにする
const inMemoryLog: ErrorLogEntry[] = [];
const MAX_IN_MEMORY = 50;

export function getRecentErrors(): ErrorLogEntry[] {
  return [...inMemoryLog];
}

/**
 * クライアント側のエラーを Firestore（または DEMO ではメモリ）に記録する。
 * 実装側では try/catch の catch 内などから fire-and-forget で呼ぶ想定。
 */
export async function logError(
  kind: ErrorKind,
  err: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const user = firebaseAuth.currentUser;

  const entry: ErrorLogEntry = {
    kind,
    message,
    stack,
    context,
    createdAt: Date.now(),
    uid: user?.uid ?? null,
    email: user?.email ?? null,
    platform: Platform.OS,
    appVersion: APP_VERSION,
  };

  // 常にコンソールに出して開発時に拾えるように
  // eslint-disable-next-line no-console
  console.warn(`[errorLog:${kind}]`, message, context);

  // メモリログに追加（ダッシュボード表示用）
  inMemoryLog.unshift(entry);
  if (inMemoryLog.length > MAX_IN_MEMORY) inMemoryLog.length = MAX_IN_MEMORY;

  if (DEMO_MODE) return;

  // Firestore へ送信。失敗してもアプリの動作は止めない
  try {
    await addDoc(collection(firestore, COLLECTION), {
      ...entry,
      createdAt: serverTimestamp(),
    });
  } catch (innerErr) {
    // eslint-disable-next-line no-console
    console.error('Failed to write errorLog to Firestore', innerErr);
  }
}
