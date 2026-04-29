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

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

// JST (UTC+9) のローカル時刻成分を取得 (タイムゾーン非依存)
function jstParts(iso: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

// 決定的 (SSR/CSR で同じ結果) な JST 日付フォーマット
export function formatJSTDate(iso: string): string {
  const p = jstParts(iso);
  return `${p.year}/${pad2(p.month)}/${pad2(p.day)}`;
}

// 決定的な JST 日時フォーマット
export function formatJSTDateTime(iso: string): string {
  const p = jstParts(iso);
  return `${p.year}/${pad2(p.month)}/${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

// 相対表記: "今" の現在時刻が必要なため、常に new Date() を呼ぶと
// サーバ/クライアントで結果が異なりハイドレーション不一致になる。
// → 必ず client 側の <RelativeDate> 経由で呼ぶこと。
export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}日前`;
  return formatJSTDate(iso);
}
