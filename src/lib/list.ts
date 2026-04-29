"use client";

import { useEffect, useState } from "react";
import type { SourceKey } from "./types";
import type { ConditionRank } from "./conditions";
import type { Period, ShippingFilter } from "@/components/SearchFormFields";
import { toast } from "./toast";

const PREFIX = "maxus_search:";
const LISTS_KEY = "lists_v2";
const CURRENT_LIST_ID_KEY = "current_list_id";
// Legacy keys (for migration only)
const OLD_ACTIVE_KEY = "list_active";
const OLD_ARCHIVED_KEY = "list_archived";

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
  updatedAt: string;
  archivedAt?: string;
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
  return `list_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function defaultListName(): string {
  const d = new Date();
  return `査定リスト ${d.getMonth() + 1}/${d.getDate()}`;
}

// ---------- ストレージ操作 ----------

function migrateFromOldFormat(): AppraisalList[] | null {
  const oldActive = read(OLD_ACTIVE_KEY);
  const oldArchived = read(OLD_ARCHIVED_KEY);
  const migrated: AppraisalList[] = [];

  if (oldArchived) {
    try {
      const archived = JSON.parse(oldArchived);
      if (Array.isArray(archived)) {
        for (const a of archived) {
          if (a && a.id && Array.isArray(a.items)) {
            migrated.push({
              id: a.id,
              name: a.name,
              items: a.items,
              createdAt: a.createdAt ?? new Date().toISOString(),
              updatedAt: a.savedAt ?? a.createdAt ?? new Date().toISOString(),
              archivedAt: a.savedAt,
            });
          }
        }
      }
    } catch {}
  }

  if (oldActive) {
    try {
      const active = JSON.parse(oldActive);
      if (active && active.id && Array.isArray(active.items)) {
        migrated.unshift({
          id: active.id,
          name: active.name,
          items: active.items,
          createdAt: active.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {}
  }

  return migrated.length > 0 ? migrated : null;
}

function getAllListsRaw(): AppraisalList[] {
  const raw = read(LISTS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  // 旧フォーマットからの自動マイグレーション
  const migrated = migrateFromOldFormat();
  if (migrated) {
    saveAllLists(migrated);
    if (!getCurrentListIdRaw()) {
      setCurrentListIdRaw(migrated[0].id);
    }
    return migrated;
  }
  return [];
}

function saveAllLists(lists: AppraisalList[]): void {
  write(LISTS_KEY, JSON.stringify(lists));
}

function getCurrentListIdRaw(): string | null {
  return read(CURRENT_LIST_ID_KEY);
}

function setCurrentListIdRaw(id: string | null): void {
  write(CURRENT_LIST_ID_KEY, id);
}

// ---------- 公開 API: リスト管理 ----------

export function getAllLists(): AppraisalList[] {
  return getAllListsRaw();
}

export function getCurrentList(): AppraisalList {
  const lists = getAllListsRaw();
  const currentId = getCurrentListIdRaw();
  if (currentId) {
    const found = lists.find((l) => l.id === currentId);
    if (found) return found;
  }
  if (lists.length > 0) {
    setCurrentListIdRaw(lists[0].id);
    return lists[0];
  }
  // 一つも無い場合は新規作成
  const now = new Date().toISOString();
  const fresh: AppraisalList = {
    id: newListId(),
    name: defaultListName(),
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  saveAllLists([fresh]);
  setCurrentListIdRaw(fresh.id);
  return fresh;
}

export function createList(name?: string): AppraisalList {
  const lists = getAllListsRaw();
  const now = new Date().toISOString();
  const list: AppraisalList = {
    id: newListId(),
    name: name?.trim() || defaultListName(),
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  lists.unshift(list);
  saveAllLists(lists);
  setCurrentListIdRaw(list.id);
  return list;
}

export function switchToList(id: string): void {
  const lists = getAllListsRaw();
  if (lists.find((l) => l.id === id)) {
    setCurrentListIdRaw(id);
  }
}

export function deleteList(id: string): void {
  const lists = getAllListsRaw().filter((l) => l.id !== id);
  saveAllLists(lists);
  const currentId = getCurrentListIdRaw();
  if (currentId === id) {
    if (lists.length > 0) setCurrentListIdRaw(lists[0].id);
    else setCurrentListIdRaw(null);
  }
}

export function renameList(id: string, name: string): void {
  const lists = getAllListsRaw();
  const list = lists.find((l) => l.id === id);
  if (list) {
    list.name = name.trim() || defaultListName();
    list.updatedAt = new Date().toISOString();
    saveAllLists(lists);
  }
}

// ---------- 公開 API: アイテム操作（現在のリストに対して） ----------

function updateCurrentList(updater: (list: AppraisalList) => void): void {
  const lists = getAllListsRaw();
  const current = getCurrentList();
  const idx = lists.findIndex((l) => l.id === current.id);
  if (idx < 0) return;
  updater(lists[idx]);
  lists[idx].updatedAt = new Date().toISOString();
  saveAllLists(lists);
}

function updateItemInLists(itemId: string, updates: Partial<ListItem>): void {
  const lists = getAllListsRaw();
  for (const list of lists) {
    const idx = list.items.findIndex((i) => i.id === itemId);
    if (idx >= 0) {
      list.items[idx] = { ...list.items[idx], ...updates };
      list.updatedAt = new Date().toISOString();
      saveAllLists(lists);
      return;
    }
  }
}

export function addItemToList(query: ListItemQuery): ListItem {
  const item: ListItem = {
    id: newId(),
    query,
    status: "queued",
    progress: 0,
    addedAt: new Date().toISOString(),
  };
  updateCurrentList((l) => l.items.unshift(item));
  processQueue();
  return item;
}

export function addItemsToList(queries: ListItemQuery[]): ListItem[] {
  const items: ListItem[] = queries.map((q) => ({
    id: newId(),
    query: q,
    status: "queued",
    progress: 0,
    addedAt: new Date().toISOString(),
  }));
  updateCurrentList((l) => l.items.unshift(...items));
  processQueue();
  return items;
}

export function addCompletedItem(
  query: ListItemQuery,
  result: ListItemResult
): ListItem {
  const current = getCurrentList();
  const existing = current.items.find(
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
  updateCurrentList((l) => l.items.unshift(item));
  return item;
}

export function isInList(keyword: string): boolean {
  const current = getCurrentList();
  return current.items.some((i) => i.query.keyword.trim() === keyword.trim());
}

export function removeItem(itemId: string): void {
  const lists = getAllListsRaw();
  for (const list of lists) {
    const before = list.items.length;
    list.items = list.items.filter((i) => i.id !== itemId);
    if (list.items.length !== before) {
      list.updatedAt = new Date().toISOString();
      saveAllLists(lists);
      return;
    }
  }
}

export function cancelItem(itemId: string): void {
  updateItemInLists(itemId, { status: "cancelled" });
  processQueue();
}

export function clearCurrentList(): void {
  updateCurrentList((l) => {
    l.items = [];
  });
}

export function saveCurrentAndCreateNew(name?: string): AppraisalList {
  // 現在のリストに名前があれば確定（無ければデフォルト名のまま）
  const current = getCurrentList();
  if (name && name.trim()) {
    renameList(current.id, name);
  }
  // 新しいリストを作成して current に
  return createList();
}

// ---------- バックグラウンドジョブ ----------

const activeTickers = new Set<string>();

function tick(itemId: string): void {
  if (activeTickers.has(itemId)) return;
  activeTickers.add(itemId);

  function loop() {
    let foundItem: ListItem | null = null;
    const lists = getAllListsRaw();
    for (const list of lists) {
      const f = list.items.find((i) => i.id === itemId);
      if (f) {
        foundItem = f;
        break;
      }
    }
    if (!foundItem || foundItem.status !== "running") {
      activeTickers.delete(itemId);
      return;
    }

    if (!foundItem.targetCompleteAt) {
      const total = 1800 + Math.random() * 2600;
      updateItemInLists(itemId, {
        targetCompleteAt: Date.now() + total,
        totalMs: total,
      });
      setTimeout(loop, 100);
      return;
    }

    const total = foundItem.totalMs ?? 3000;
    const remaining = foundItem.targetCompleteAt - Date.now();
    if (remaining <= 0) {
      completeItem(itemId);
      activeTickers.delete(itemId);
      processQueue();
      return;
    }
    const progress = Math.min(99, Math.round(((total - remaining) / total) * 100));
    updateItemInLists(itemId, { progress });
    setTimeout(loop, 200);
  }

  loop();
}

function completeItem(itemId: string): void {
  const lists = getAllListsRaw();
  let item: ListItem | null = null;
  for (const list of lists) {
    const f = list.items.find((i) => i.id === itemId);
    if (f) {
      item = f;
      break;
    }
  }
  if (!item) return;

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

  updateItemInLists(itemId, {
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
  const lists = getAllListsRaw();
  const allItems = lists.flatMap((l) => l.items);
  const running = allItems.filter((i) => i.status === "running");
  const slots = MAX_PARALLEL - running.length;

  // 走行中のものに ticker が付いていなければ起動（ページ再訪時のレジューム）
  for (const r of running) {
    if (!activeTickers.has(r.id)) tick(r.id);
  }

  if (slots <= 0) return;

  const queued = allItems.filter((i) => i.status === "queued");
  const toStart = queued.slice(0, slots);
  for (const item of toStart) {
    updateItemInLists(item.id, {
      status: "running",
      startedAt: new Date().toISOString(),
      progress: 0,
    });
    tick(item.id);
  }
}

// ---------- React フック ----------

export function useCurrentList(): AppraisalList {
  const [list, setList] = useState<AppraisalList>(() => getCurrentList());

  useEffect(() => {
    setList(getCurrentList());
    const onChange = () => setList(getCurrentList());
    window.addEventListener("maxus_search:list", onChange);
    window.addEventListener("storage", onChange);
    processQueue();
    return () => {
      window.removeEventListener("maxus_search:list", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return list;
}

// 後方互換
export const useActiveList = useCurrentList;

export function useAllLists(): AppraisalList[] {
  const [lists, setLists] = useState<AppraisalList[]>([]);
  useEffect(() => {
    setLists(getAllLists());
    const onChange = () => setLists(getAllLists());
    window.addEventListener("maxus_search:list", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("maxus_search:list", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return lists;
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

// 後方互換: 旧 useArchivedLists は廃止予定だが、history ページの参照のため残す
export function useArchivedLists() {
  return useAllLists();
}

// 後方互換: 旧 archiveCurrentList → saveCurrentAndCreateNew にリネーム
export function archiveCurrentList(name?: string): void {
  saveCurrentAndCreateNew(name);
}

// 後方互換
export function clearList(): void {
  clearCurrentList();
}
