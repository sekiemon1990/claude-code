"use client";

import { useSyncExternalStore } from "react";
import type { ListItemQuery } from "./api/lists";

/**
 * オフライン検索キュー
 *
 * オフライン時に検索フォームから submit した内容を localStorage に保存。
 * online 復帰時に自動的に査定リストへ流し込む。
 */

export type QueuedSearch = {
  id: string;
  query: ListItemQuery;
  queuedAt: string;
};

const KEY = "maxus_search:offline_queue";
const EVT = "maxus_search:offline_queue_changed";

function readQueue(): QueuedSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedSearch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedSearch[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event(EVT));
}

function genId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export function enqueueOfflineSearch(query: ListItemQuery): QueuedSearch {
  const item: QueuedSearch = {
    id: genId(),
    query,
    queuedAt: new Date().toISOString(),
  };
  const next = [...readQueue(), item];
  writeQueue(next);
  return item;
}

export function getOfflineQueue(): QueuedSearch[] {
  return readQueue();
}

export function removeFromOfflineQueue(id: string): void {
  writeQueue(readQueue().filter((q) => q.id !== id));
}

export function clearOfflineQueue(): void {
  writeQueue([]);
}

function subscribeQueue(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) callback();
  };
  window.addEventListener(EVT, callback);
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVT, callback);
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
    window.removeEventListener("storage", onStorage);
  };
}

// snapshot は参照同一性を維持するためキャッシュする
// (useSyncExternalStore の getSnapshot は同一の参照を返さないと無限再レンダーになる)
let cachedSnapshot: {
  items: QueuedSearch[];
  count: number;
  isOnline: boolean;
} = { items: [], count: 0, isOnline: true };
let cachedKey = "";

function getQueueSnapshot(): {
  items: QueuedSearch[];
  count: number;
  isOnline: boolean;
} {
  const items = readQueue();
  const isOnline =
    typeof navigator !== "undefined" ? navigator.onLine : true;
  // 軽量な変更検出キー
  const key = `${items.length}:${items.map((i) => i.id).join(",")}:${isOnline}`;
  if (key === cachedKey) return cachedSnapshot;
  cachedKey = key;
  cachedSnapshot = { items, count: items.length, isOnline };
  return cachedSnapshot;
}

const SERVER_SNAPSHOT: {
  items: QueuedSearch[];
  count: number;
  isOnline: boolean;
} = { items: [], count: 0, isOnline: true };

/**
 * 現在のキュー状態を購読する hook。
 * オフラインキューの増減をリアルタイム反映する。
 */
export function useOfflineQueue(): {
  items: QueuedSearch[];
  count: number;
  isOnline: boolean;
} {
  return useSyncExternalStore(
    subscribeQueue,
    getQueueSnapshot,
    () => SERVER_SNAPSHOT,
  );
}
