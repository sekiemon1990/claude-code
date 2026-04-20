import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { deletePersistedRecording, persistedRecordingExists } from './audioStorage';
import type { DealSnapshot } from '@/types';

export type QueuedRecordingStatus = 'pending' | 'uploading' | 'failed';

export type QueuedRecording = {
  queueId: string;
  ownerUid: string;
  dealId: string;
  dealSnapshot: DealSnapshot;
  title: string;
  localUri: string;
  durationMs: number;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: QueuedRecordingStatus;
};

const STORAGE_PREFIX = '@upload_queue/';

function storageKey(ownerUid: string): string {
  return `${STORAGE_PREFIX}${ownerUid}`;
}

async function readQueue(ownerUid: string): Promise<QueuedRecording[]> {
  const raw = await AsyncStorage.getItem(storageKey(ownerUid));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedRecording[];
  } catch {
    return [];
  }
}

async function writeQueue(ownerUid: string, items: QueuedRecording[]): Promise<void> {
  await AsyncStorage.setItem(storageKey(ownerUid), JSON.stringify(items));
}

export async function listQueue(ownerUid: string): Promise<QueuedRecording[]> {
  return readQueue(ownerUid);
}

export async function enqueueRecording(params: {
  ownerUid: string;
  dealId: string;
  dealSnapshot: DealSnapshot;
  title: string;
  localUri: string;
  durationMs: number;
}): Promise<QueuedRecording> {
  const item: QueuedRecording = {
    queueId: Crypto.randomUUID(),
    ownerUid: params.ownerUid,
    dealId: params.dealId,
    dealSnapshot: params.dealSnapshot,
    title: params.title,
    localUri: params.localUri,
    durationMs: params.durationMs,
    createdAt: Date.now(),
    attempts: 0,
    status: 'pending',
  };
  const queue = await readQueue(params.ownerUid);
  queue.push(item);
  await writeQueue(params.ownerUid, queue);
  return item;
}

export async function updateQueueItem(
  ownerUid: string,
  queueId: string,
  patch: Partial<QueuedRecording>,
): Promise<void> {
  const queue = await readQueue(ownerUid);
  const idx = queue.findIndex((q) => q.queueId === queueId);
  if (idx < 0) return;
  queue[idx] = { ...queue[idx], ...patch };
  await writeQueue(ownerUid, queue);
}

export async function removeQueueItem(ownerUid: string, queueId: string): Promise<void> {
  const queue = await readQueue(ownerUid);
  const target = queue.find((q) => q.queueId === queueId);
  const next = queue.filter((q) => q.queueId !== queueId);
  await writeQueue(ownerUid, next);
  if (target) {
    await deletePersistedRecording(target.localUri);
  }
}

/**
 * 起動時クリーンアップ。音声ファイルが失われているアイテムはキューから除外する。
 */
export async function pruneMissingFiles(ownerUid: string): Promise<void> {
  const queue = await readQueue(ownerUid);
  const checked = await Promise.all(
    queue.map(async (item) => ({ item, exists: await persistedRecordingExists(item.localUri) })),
  );
  const kept = checked.filter((c) => c.exists).map((c) => c.item);
  if (kept.length !== queue.length) {
    await writeQueue(ownerUid, kept);
  }
}
