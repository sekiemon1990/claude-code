"use client";

import { useEffect, useState } from "react";
import type { SourceKey } from "./types";
import type { ConditionRank } from "./conditions";
import type { Period, ShippingFilter } from "@/components/SearchFormFields";
import { toast } from "./toast";

const PREFIX = "maxus_search:";
const ACTIVE_LIST_KEY = "list_active";
const ARCHIVED_LIST_KEY = "list_archived";
const MAX_PARALLEL = 3;

export type ListItemStatus =
  | "queued"
  | "running"
  | "completed"
  | "error"
  | "cancelled";

export type ListItemQuery = {
  keyword: string;
  excludes?: string;
  period: Period;
  sources: SourceKey[];
  conditions: ConditionRank[];
  shipping: ShippingFilter;
};

export type ListItemResult = {
  median: number;
  min: number;
  max: number;
  count: number;
  suggestedBuyPrice: number;
};

export type ListItem = {
  id: string;
  query: ListItemQuery;
  status: ListItemStatus;
  progress: number;
  result?: ListItemResult;
  error?: string;
  addedAt: string;
  startedAt?: string;
  targetCompleteAt?: number;
  totalMs?: number;
  completedAt?: string;
};

export type AppraisalList = {
  id: string;
  name?: string;
  items: ListItem[];
  createdAt: string;
};

export type ArchivedList = AppraisalList & {
  savedAt: string;
};

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, value);
    window.dispatchEvent(
      new CustomEvent("maxus_search:list", { detail: { key } })
    );
  } catch {}
}

function newId(): string {
  return `li_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function newListId(): string {
  return `list_${Date.now()}`;
}

export function getActiveList(): AppraisalList {
  const raw = read(ACTIVE_LIST_KEY);
  if (!raw) {
    const fresh: AppraisalList = {
      id: newListId(),
      items: [],
      createdAt: new Date().toISOString(),
    };
    return fresh;
  }
  try {
    return JSON.parse(raw) as AppraisalList;
  } catch {
    return {
      id: newListId(),
      items: [],
      createdAt: new Date().toISOString(),
    };
  }
}

function saveActiveList(list: AppraisalList): void {
  write(ACTIVE_LIST_KEY, JSON.stringify(list));
}

export function addCompletedItem(
  query: ListItemQuery,
  result: ListItemResult
): ListItem {
  const list = getActiveList();
  // 同じキーワードが既にリストにあればスキップ
  const existing = list.items.find(
    (i) => i.query.keyword.trim() === query.keyword.trim()
  );
  if (existing) return existing;

  const item: ListItem = {
    id: newId(),
    query,
    status: "completed",
    progress: 100,
    result,
    addedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
  list.items.unshift(item);
  saveActiveList(list);
  return item;
}

export function isInList(keyword: string): boolean {
  const list = getActiveList();
  return list.items.some(
    (i) => i.query.keyword.trim() === keyword.trim()
  );
}

export function useIsInList(keyword: string): boolean {
  const [val, setVal] = useState<boolean>(false);
  useEffect(() => {
    setVal(isInList(keyword));
    const onChange = () => setVal(isInList(keyword));
    window.addEventListener("maxus_search:list", onChange);
    return () => window.removeEventListener("maxus_search:list", onChange);
  }, [keyword]);
  return val;
}

export function addItemToList(query: ListItemQuery): ListItem {
  const list = getActiveList();
  const item: ListItem = {
    id: newId(),
    query,
    status: "queued",
    progress: 0,
    addedAt: new Date().toISOString(),
  };
  list.items.unshift(item);
  saveActiveList(list);
  processQueue();
  return item;
}

export function addItemsToList(queries: ListItemQuery[]): ListItem[] {
  const list = getActiveList();
  const items: ListItem[] = queries.map((q) => ({
    id: newId(),
    query: q,
    status: "queued",
    progress: 0,
    addedAt: new Date().toISOString(),
  }));
  list.items.unshift(...items);
  saveActiveList(list);
  processQueue();
  return items;
}

function updateItem(itemId: string, updates: Partial<ListItem>): void {
  const list = getActiveList();
  const idx = list.items.findIndex((i) => i.id === itemId);
  if (idx < 0) return;
  list.items[idx] = { ...list.items[idx], ...updates };
  saveActiveList(list);
}

export function removeItem(itemId: string): void {
  const list = getActiveList();
  list.items = list.items.filter((i) => i.id !== itemId);
  saveActiveList(list);
}

export function cancelItem(itemId: string): void {
  updateItem(itemId, { status: "cancelled" });
  processQueue();
}

export function clearList(): void {
  const fresh: AppraisalList = {
    id: newListId(),
    items: [],
    createdAt: new Date().toISOString(),
  };
  saveActiveList(fresh);
}

export function archiveCurrentList(name?: string): void {
  const list = getActiveList();
  if (list.items.length === 0) return;
  const raw = read(ARCHIVED_LIST_KEY);
  let archives: ArchivedList[] = [];
  if (raw) {
    try {
      archives = JSON.parse(raw);
    } catch {}
  }
  archives.unshift({
    ...list,
    name,
    savedAt: new Date().toISOString(),
  });
  write(ARCHIVED_LIST_KEY, JSON.stringify(archives.slice(0, 50)));
  clearList();
}

export function getArchivedLists(): ArchivedList[] {
  const raw = read(ARCHIVED_LIST_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// ---------- 擬似バックグラウンド検索ジョブ ----------

const activeTickers = new Set<string>();

function tick(itemId: string): void {
  if (activeTickers.has(itemId)) return;
  activeTickers.add(itemId);

  function loop() {
    const list = getActiveList();
    const item = list.items.find((i) => i.id === itemId);
    if (!item || item.status !== "running") {
      activeTickers.delete(itemId);
      return;
    }

    if (!item.targetCompleteAt) {
      const total = 1800 + Math.random() * 2600;
      updateItem(itemId, {
        targetCompleteAt: Date.now() + total,
        totalMs: total,
      });
      setTimeout(loop, 100);
      return;
    }

    const total = item.totalMs ?? 3000;
    const remaining = item.targetCompleteAt - Date.now();
    if (remaining <= 0) {
      completeItem(itemId);
      activeTickers.delete(itemId);
      processQueue();
      return;
    }
    const progress = Math.min(99, Math.round(((total - remaining) / total) * 100));
    updateItem(itemId, { progress });
    setTimeout(loop, 200);
  }

  loop();
}

function completeItem(itemId: string): void {
  const list = getActiveList();
  const item = list.items.find((i) => i.id === itemId);
  if (!item) return;

  // モック結果生成（キーワードから疑似生成、実装時はスクレイパー結果を入れる）
  const seed = Array.from(item.query.keyword).reduce(
    (a, c) => a + c.charCodeAt(0),
    0
  );
  const base = 50000 + (seed * 137) % 250000;
  const median = Math.round(base / 1000) * 1000;
  const min = Math.round(median * 0.6);
  const max = Math.round(median * 1.8);
  const count = 25 + (seed % 100);
  const suggestedBuyPrice = Math.round((median * 70) / 100);

  updateItem(itemId, {
    status: "completed",
    progress: 100,
    completedAt: new Date().toISOString(),
    result: { median, min, max, count, suggestedBuyPrice },
  });

  toast({
    message: `「${item.query.keyword}」の検索が完了`,
    actionLabel: "リストを見る",
    actionHref: "/list",
  });
}

export function processQueue(): void {
  const list = getActiveList();
  const running = list.items.filter((i) => i.status === "running").length;
  const slots = MAX_PARALLEL - running;
  if (slots <= 0) {
    // 既存runningがtickしてなければ起動（リロード時のレジューム）
    list.items
      .filter((i) => i.status === "running")
      .forEach((i) => tick(i.id));
    return;
  }
  const queued = list.items.filter((i) => i.status === "queued");
  const toStart = queued.slice(0, slots);
  for (const item of toStart) {
    updateItem(item.id, {
      status: "running",
      startedAt: new Date().toISOString(),
      progress: 0,
    });
    tick(item.id);
  }
  // 念のためrunningを再開
  list.items
    .filter((i) => i.status === "running" && !activeTickers.has(i.id))
    .forEach((i) => tick(i.id));
}

// ---------- React フック ----------

export function useActiveList(): AppraisalList {
  const [list, setList] = useState<AppraisalList>(() => getActiveList());

  useEffect(() => {
    setList(getActiveList());
    const onChange = () => setList(getActiveList());
    window.addEventListener("maxus_search:list", onChange);
    window.addEventListener("storage", onChange);
    // ページマウント時に走行中のジョブを再開
    processQueue();
    return () => {
      window.removeEventListener("maxus_search:list", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return list;
}

export function useArchivedLists(): ArchivedList[] {
  const [lists, setLists] = useState<ArchivedList[]>([]);

  useEffect(() => {
    setLists(getArchivedLists());
    const onChange = () => setLists(getArchivedLists());
    window.addEventListener("maxus_search:list", onChange);
    return () => window.removeEventListener("maxus_search:list", onChange);
  }, []);

  return lists;
}
