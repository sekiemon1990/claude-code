"use client";

import { useEffect, useState } from "react";
import type { SourceKey } from "./types";

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

// ---------- 検索メモ・ピン (キーワード単位) ----------

export function getMemo(searchKey: string): string {
  return read(`memo:${searchKey}`) ?? "";
}

export function setMemo(searchKey: string, memo: string): void {
  write(`memo:${searchKey}`, memo.trim() ? memo : null);
}

export function isPinned(searchKey: string): boolean {
  return read(`pinned:${searchKey}`) === "1";
}

export function setPinned(searchKey: string, pinned: boolean): void {
  write(`pinned:${searchKey}`, pinned ? "1" : null);
}

// ---------- 商品単位のメモ・ピン ----------

export function getListingMemo(ref: string): string {
  return read(`listing_memo:${ref}`) ?? "";
}

export function setListingMemo(ref: string, memo: string): void {
  write(`listing_memo:${ref}`, memo.trim() ? memo : null);
}

export function isListingPinned(ref: string): boolean {
  return read(`listing_pinned:${ref}`) === "1";
}

export function setListingPinned(ref: string, pinned: boolean): void {
  write(`listing_pinned:${ref}`, pinned ? "1" : null);
}

// ---------- 閲覧履歴 ----------

export type ListingViewSnapshot = {
  ref: string;
  source: SourceKey;
  title: string;
  price: number;
  thumbnail?: string;
  endedAt: string;
  condition?: string;
  fromKeyword?: string;
  viewedAt: string;
};

const VIEW_HISTORY_KEY = "listing_views";
const VIEW_HISTORY_LIMIT = 100;

export function getListingViews(): ListingViewSnapshot[] {
  const raw = read(VIEW_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ListingViewSnapshot[];
  } catch {
    return [];
  }
}

export function recordListingView(snapshot: Omit<ListingViewSnapshot, "viewedAt">): void {
  if (typeof window === "undefined") return;
  const views = getListingViews().filter((v) => v.ref !== snapshot.ref);
  views.unshift({ ...snapshot, viewedAt: new Date().toISOString() });
  const trimmed = views.slice(0, VIEW_HISTORY_LIMIT);
  write(VIEW_HISTORY_KEY, JSON.stringify(trimmed));
}

export function clearListingViews(): void {
  write(VIEW_HISTORY_KEY, null);
}

// ---------- React フック ----------

function useStorageValue<T>(reader: () => T): T {
  const [value, setValue] = useState<T>(reader);

  useEffect(() => {
    setValue(reader());
    const onChange = () => setValue(reader());
    window.addEventListener("maxus_search:storage", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("maxus_search:storage", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [reader]);

  return value;
}

export function useMemoValue(searchKey: string): string {
  const reader = () => getMemo(searchKey);
  return useStorageValue(reader);
}

export function usePinnedValue(searchKey: string): boolean {
  const reader = () => isPinned(searchKey);
  return useStorageValue(reader);
}

export function useListingMemoValue(ref: string): string {
  const reader = () => getListingMemo(ref);
  return useStorageValue(reader);
}

export function useListingPinnedValue(ref: string): boolean {
  const reader = () => isListingPinned(ref);
  return useStorageValue(reader);
}

export function useListingViews(): ListingViewSnapshot[] {
  const reader = () => getListingViews();
  return useStorageValue(reader);
}

// ---------- オンボーディング ----------

const ONBOARDING_KEY = "onboarding_seen";

export function hasSeenOnboarding(): boolean {
  return read(ONBOARDING_KEY) === "1";
}

export function markOnboardingSeen(): void {
  write(ONBOARDING_KEY, "1");
}

// ---------- AI査定アドバイスの保存 ----------

export type SavedAdvice = {
  searchKey: string;
  keyword: string;
  productGuess?: string;
  summary: string;
  recommendations: { rank: string; price: number; rate: number }[];
  warnings: string[];
  savedAt: string;
};

const ADVICE_LIST_KEY = "ai_advice_list";

export function getSavedAdvices(): SavedAdvice[] {
  const raw = read(ADVICE_LIST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedAdvice[];
  } catch {
    return [];
  }
}

export function saveAdvice(advice: Omit<SavedAdvice, "savedAt">): void {
  if (typeof window === "undefined") return;
  const list = getSavedAdvices().filter((a) => a.searchKey !== advice.searchKey);
  list.unshift({ ...advice, savedAt: new Date().toISOString() });
  write(ADVICE_LIST_KEY, JSON.stringify(list.slice(0, 100)));
}

export function removeSavedAdvice(searchKey: string): void {
  const list = getSavedAdvices().filter((a) => a.searchKey !== searchKey);
  write(ADVICE_LIST_KEY, JSON.stringify(list));
}

export function isAdviceSaved(searchKey: string): boolean {
  return getSavedAdvices().some((a) => a.searchKey === searchKey);
}

export function useAdviceSaved(searchKey: string): boolean {
  const reader = () => isAdviceSaved(searchKey);
  return useStorageValue(reader);
}

export function useSavedAdvices(): SavedAdvice[] {
  const reader = () => getSavedAdvices();
  return useStorageValue(reader);
}

// ---------- 設定 ----------

export type AppSettings = {
  fontScale: number; // 1.0 = 標準, 1.1, 1.2, 1.3
  hapticEnabled: boolean;
  reducedMotion: boolean;
  defaultBuyRate: number; // %
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

// ---------- スクロール位置の保存 ----------

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

// ---------- テーマ ----------

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
