"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryClient } from "@/components/QueryProvider";
import {
  fetchSearchMemo,
  fetchListingMemo,
  upsertSearchMemo,
  upsertListingMemo,
} from "./api/memos";
import {
  fetchSearchPin,
  fetchListingPin,
  setSearchPin as apiSetSearchPin,
  setListingPin as apiSetListingPin,
} from "./api/pins";
import {
  fetchListingViews,
  recordListingView as apiRecordListingView,
  type ListingViewSnapshot,
} from "./api/views";
import {
  fetchSavedAdvices,
  saveAdvice as apiSaveAdvice,
  removeSavedAdvice as apiRemoveSavedAdvice,
  type SavedAdvice,
} from "./api/advices";

export type { ListingViewSnapshot, SavedAdvice };

export function searchKeyFromKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, " ");
}

const PREFIX = "maxus_search:";

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
    if (value === null) {
      window.localStorage.removeItem(PREFIX + key);
    } else {
      window.localStorage.setItem(PREFIX + key, value);
    }
    window.dispatchEvent(
      new CustomEvent("maxus_search:storage", { detail: { key } })
    );
  } catch {
    // noop
  }
}

// ============================================================================
// React Query キャッシュ無効化のヘルパー
// ============================================================================

function notifyCache(kind: string, key: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("maxus_search:cache", { detail: { kind, key } })
  );
}

function useCacheInvalidation(
  kind: string,
  key: string | null,
  queryKey: readonly unknown[]
) {
  const qc = useQueryClient();
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.kind !== kind) return;
      if (key && detail?.key && detail.key !== key && detail.key !== "all")
        return;
      qc.invalidateQueries({ queryKey });
    };
    window.addEventListener("maxus_search:cache", onChange);
    return () => window.removeEventListener("maxus_search:cache", onChange);
  }, [kind, key, queryKey, qc]);
}

// ============================================================================
// 検索メモ・ピン (Supabase)
// ============================================================================

export function setMemo(searchKey: string, memo: string): void {
  const trimmed = memo.trim();
  // 楽観的更新: キャッシュを即座に新しい値に
  const qc = getQueryClient();
  if (qc) {
    qc.setQueryData(["search_memo", searchKey], trimmed);
  }
  // バックグラウンドで Supabase に書き込み
  upsertSearchMemo(searchKey, memo)
    .catch(() => {
      // エラー時はキャッシュを無効化して再取得
      if (qc) qc.invalidateQueries({ queryKey: ["search_memo", searchKey] });
    });
}

export function setPinned(searchKey: string, pinned: boolean): void {
  const qc = getQueryClient();
  if (qc) {
    qc.setQueryData(["search_pin", searchKey], pinned);
  }
  apiSetSearchPin(searchKey, pinned)
    .catch(() => {
      if (qc) qc.invalidateQueries({ queryKey: ["search_pin", searchKey] });
    });
}

export function useMemoValue(searchKey: string): string {
  const queryKey = ["search_memo", searchKey];
  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchSearchMemo(searchKey),
    enabled: !!searchKey,
    initialData: "",
  });
  useCacheInvalidation("search_memo", searchKey, queryKey);
  return data ?? "";
}

export function usePinnedValue(searchKey: string): boolean {
  const queryKey = ["search_pin", searchKey];
  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchSearchPin(searchKey),
    enabled: !!searchKey,
    initialData: false,
  });
  useCacheInvalidation("search_pin", searchKey, queryKey);
  return data ?? false;
}

// ============================================================================
// 商品メモ・ピン (Supabase)
// ============================================================================

export function setListingMemo(ref: string, memo: string): void {
  const trimmed = memo.trim();
  const qc = getQueryClient();
  if (qc) {
    qc.setQueryData(["listing_memo", ref], trimmed);
  }
  upsertListingMemo(ref, memo)
    .catch(() => {
      if (qc) qc.invalidateQueries({ queryKey: ["listing_memo", ref] });
    });
}

export function setListingPinned(ref: string, pinned: boolean): void {
  const qc = getQueryClient();
  if (qc) {
    qc.setQueryData(["listing_pin", ref], pinned);
  }
  apiSetListingPin(ref, pinned)
    .catch(() => {
      if (qc) qc.invalidateQueries({ queryKey: ["listing_pin", ref] });
    });
}

export function useListingMemoValue(ref: string): string {
  const queryKey = ["listing_memo", ref];
  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchListingMemo(ref),
    enabled: !!ref,
    initialData: "",
  });
  useCacheInvalidation("listing_memo", ref, queryKey);
  return data ?? "";
}

export function useListingPinnedValue(ref: string): boolean {
  const queryKey = ["listing_pin", ref];
  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchListingPin(ref),
    enabled: !!ref,
    initialData: false,
  });
  useCacheInvalidation("listing_pin", ref, queryKey);
  return data ?? false;
}

// ============================================================================
// 閲覧履歴 (Supabase)
// ============================================================================

export function recordListingView(
  snapshot: Omit<ListingViewSnapshot, "viewedAt">
): void {
  const qc = getQueryClient();
  // 楽観的更新: 即座にキャッシュへ追加
  if (qc) {
    const optimistic: ListingViewSnapshot = {
      ...snapshot,
      viewedAt: new Date().toISOString(),
    };
    qc.setQueryData<ListingViewSnapshot[]>(["listing_views"], (prev) => {
      const filtered = (prev ?? []).filter((v) => v.ref !== snapshot.ref);
      return [optimistic, ...filtered];
    });
  }
  apiRecordListingView(snapshot)
    .then(() => {
      if (qc) qc.invalidateQueries({ queryKey: ["listing_views"] });
    })
    .catch(() => {
      if (qc) qc.invalidateQueries({ queryKey: ["listing_views"] });
    });
}

export function useListingViews(): ListingViewSnapshot[] {
  const queryKey = ["listing_views"];
  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchListingViews(),
    initialData: [],
  });
  useCacheInvalidation("listing_views", "all", queryKey);
  return data ?? [];
}

// ============================================================================
// AI 査定アドバイス (Supabase)
// ============================================================================

export function saveAdvice(advice: Omit<SavedAdvice, "savedAt">): void {
  const qc = getQueryClient();
  if (qc) {
    const optimistic: SavedAdvice = {
      ...advice,
      savedAt: new Date().toISOString(),
    };
    qc.setQueryData<SavedAdvice[]>(["saved_advices"], (prev) => {
      const filtered = (prev ?? []).filter(
        (a) => a.searchKey !== advice.searchKey
      );
      return [optimistic, ...filtered];
    });
  }
  apiSaveAdvice(advice)
    .then(() => {
      if (qc) qc.invalidateQueries({ queryKey: ["saved_advices"] });
    })
    .catch(() => {
      if (qc) qc.invalidateQueries({ queryKey: ["saved_advices"] });
    });
}

export function removeSavedAdvice(searchKey: string): void {
  const qc = getQueryClient();
  if (qc) {
    qc.setQueryData<SavedAdvice[]>(["saved_advices"], (prev) =>
      (prev ?? []).filter((a) => a.searchKey !== searchKey)
    );
  }
  apiRemoveSavedAdvice(searchKey)
    .then(() => {
      if (qc) qc.invalidateQueries({ queryKey: ["saved_advices"] });
    })
    .catch(() => {
      if (qc) qc.invalidateQueries({ queryKey: ["saved_advices"] });
    });
}

export function useAdviceSaved(searchKey: string): boolean {
  const advices = useSavedAdvices();
  return advices.some((a) => a.searchKey === searchKey);
}

export function useSavedAdvices(): SavedAdvice[] {
  const queryKey = ["saved_advices"];
  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchSavedAdvices(),
    initialData: [],
  });
  useCacheInvalidation("saved_advices", "all", queryKey);
  return data ?? [];
}

// ============================================================================
// 直近の検索結果 URL（端末ローカル）
// ============================================================================

const LAST_RESULT_KEY = "last_result_url";

export function setLastResultUrl(url: string): void {
  write(LAST_RESULT_KEY, url);
}

export function getLastResultUrl(): string | null {
  return read(LAST_RESULT_KEY);
}

export function useLastResultUrl(): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(getLastResultUrl());
    const onChange = () => setUrl(getLastResultUrl());
    window.addEventListener("maxus_search:storage", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("maxus_search:storage", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return url;
}

// ============================================================================
// オンボーディング (端末ローカル)
// ============================================================================

const ONBOARDING_KEY = "onboarding_seen";

export function hasSeenOnboarding(): boolean {
  return read(ONBOARDING_KEY) === "1";
}

export function markOnboardingSeen(): void {
  write(ONBOARDING_KEY, "1");
}

// ============================================================================
// 設定 (端末ローカル)
// ============================================================================

export type AppSettings = {
  fontScale: number;
  hapticEnabled: boolean;
  reducedMotion: boolean;
  defaultBuyRate: number;
};

const DEFAULT_SETTINGS: AppSettings = {
  fontScale: 1.0,
  hapticEnabled: true,
  reducedMotion: false,
  defaultBuyRate: 70,
};

export function getSettings(): AppSettings {
  const raw = read("settings");
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setSettings(settings: AppSettings): void {
  write("settings", JSON.stringify(settings));
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty(
      "--font-scale",
      String(settings.fontScale)
    );
    document.documentElement.dataset.reducedMotion = settings.reducedMotion
      ? "1"
      : "0";
  }
}

export function useSettings(): [AppSettings, (s: Partial<AppSettings>) => void] {
  const [settings, setLocal] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setLocal(getSettings());
    const onChange = () => setLocal(getSettings());
    window.addEventListener("maxus_search:storage", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("maxus_search:storage", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = (partial: Partial<AppSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    setLocal(next);
  };

  return [settings, update];
}

export function haptic(ms = 8): void {
  if (typeof window === "undefined") return;
  if (!getSettings().hapticEnabled) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // noop
  }
}

// ============================================================================
// スクロール位置 (sessionStorage)
// ============================================================================

export function saveScrollPosition(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`scroll:${key}`, String(window.scrollY));
  } catch {
    // noop
  }
}

export function restoreScrollPosition(key: string): void {
  if (typeof window === "undefined") return;
  try {
    const saved = sessionStorage.getItem(`scroll:${key}`);
    if (saved) {
      const y = Number(saved);
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    }
  } catch {
    // noop
  }
}

// ============================================================================
// テーマ (端末ローカル)
// ============================================================================

const THEME_KEY = "theme";

export function getTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = read(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function setTheme(theme: "light" | "dark"): void {
  write(THEME_KEY, theme);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
}

export function useTheme(): ["light" | "dark", () => void] {
  const [theme, setThemeState] = useState<"light" | "dark">("light");

  useEffect(() => {
    setThemeState(getTheme());
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  };

  return [theme, toggle];
}
