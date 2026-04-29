import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { SourceKey } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function buildPlatformSearchUrl(
  source: SourceKey,
  keyword: string
): string {
  const q = encodeURIComponent(keyword);
  switch (source) {
    case "yahoo_auction":
      return `https://auctions.yahoo.co.jp/closedsearch/closedsearch?p=${q}&va=${q}&b=1&n=50`;
    case "mercari":
      return `https://jp.mercari.com/search?keyword=${q}&status=sold_out&order=desc&sort=created_time`;
    case "jimoty":
      return `https://jmty.jp/all?keyword=${q}`;
  }
}

export function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

export function formatYenShort(value: number): string {
  if (value >= 100000000) {
    return `¥${(value / 100000000).toFixed(value >= 1000000000 ? 0 : 1)}億`;
  }
  if (value >= 10000) {
    const v = value / 10000;
    return `¥${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}万`;
  }
  return `¥${value.toLocaleString("ja-JP")}`;
}

export function formatCount(value: number): string {
  return `${value.toLocaleString("ja-JP")}件`;
}

export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}日前`;
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
