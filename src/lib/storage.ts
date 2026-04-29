"use client";

import { useEffect, useState } from "react";

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
