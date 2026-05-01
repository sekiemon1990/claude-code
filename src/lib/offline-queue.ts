"use client";

import { useEffect, useState } from "react";
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

/**
 * 現在のキュー状態を購読する hook。
 * オフラインキューの増減をリアルタイム反映する。
 */
export function useOfflineQueue(): {
  items: QueuedSearch[];
  count: number;
  isOnline: boolean;
} {
  const [items, setItems] = useState<QueuedSearch[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setItems(readQueue());
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    const onChange = () => setItems(readQueue());
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setItems(readQueue());
    };
    window.addEventListener(EVT, onChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { items, count: items.length, isOnline };
}
