"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronRight,
  Search as SearchIcon,
  Star,
  StickyNote,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MOCK_HISTORY } from "@/lib/mock-data";
import { formatYen, formatCount, formatRelativeDate } from "@/lib/utils";
import {
  searchKeyFromKeyword,
  useMemoValue,
  usePinnedValue,
} from "@/lib/storage";

export default function HistoryPage() {
  const [pinnedOnly, setPinnedOnly] = useState(false);

  const items = useMemo(
    () =>
      MOCK_HISTORY.map((h) => ({
        ...h,
        searchKey: searchKeyFromKeyword(h.keyword),
      })),
    []
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <section>
          <h2 className="text-xl font-bold text-foreground">検索履歴</h2>
          <p className="text-sm text-muted mt-1">
            過去の検索結果（直近順）
          </p>
        </section>

        <Link
          href="/search"
          className="flex items-center gap-2 h-12 rounded-lg bg-surface border border-border hover:border-primary/40 px-4 text-foreground"
        >
          <SearchIcon size={18} className="text-muted" />
          <span className="text-sm">新しい検索を開始</span>
        </Link>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPinnedOnly(false)}
            className={
              !pinnedOnly
                ? "shrink-0 h-8 px-3 rounded-full text-xs font-semibold border-2 border-primary bg-primary/5 text-primary"
                : "shrink-0 h-8 px-3 rounded-full text-xs font-medium border border-border text-foreground bg-surface"
            }
          >
            全て
          </button>
          <button
            type="button"
            onClick={() => setPinnedOnly(true)}
            className={
              pinnedOnly
                ? "shrink-0 h-8 px-3 rounded-full text-xs font-semibold border-2 border-warning bg-warning/10 text-warning flex items-center gap-1"
                : "shrink-0 h-8 px-3 rounded-full text-xs font-medium border border-border text-foreground bg-surface flex items-center gap-1"
            }
          >
            <Star
              size={12}
              fill={pinnedOnly ? "currentColor" : "none"}
            />
            ピン留めのみ
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {items.map((h) => (
            <HistoryItemCard
              key={h.id}
              id={h.id}
              keyword={h.keyword}
              searchKey={h.searchKey}
              median={h.median}
              totalCount={h.totalCount}
              searchedAt={h.searchedAt}
              pinnedOnly={pinnedOnly}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function HistoryItemCard({
  id,
  keyword,
  searchKey,
  median,
  totalCount,
  searchedAt,
  pinnedOnly,
}: {
  id: string;
  keyword: string;
  searchKey: string;
  median: number;
  totalCount: number;
  searchedAt: string;
  pinnedOnly: boolean;
}) {
  const memo = useMemoValue(searchKey);
  const pinned = usePinnedValue(searchKey);

  if (pinnedOnly && !pinned) return null;

  const href = `/search/result/${id}?keyword=${encodeURIComponent(keyword)}&period=30&sources=yahoo_auction,mercari,jimoty`;

  return (
    <Link
      href={href}
      className="bg-surface border border-border rounded-xl p-4 flex items-start gap-3 hover:border-primary/40 active:bg-surface-2 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          {pinned && (
            <Star
              size={14}
              className="text-warning shrink-0"
              fill="currentColor"
            />
          )}
          <p className="text-sm font-semibold text-foreground line-clamp-1">
            {keyword}
          </p>
        </div>
        {memo && (
          <div className="flex items-start gap-1.5 mt-1.5 mb-1.5 p-2 rounded-md bg-warning/10 border border-warning/20">
            <StickyNote
              size={12}
              className="text-warning mt-0.5 shrink-0"
            />
            <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
              {memo}
            </p>
          </div>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-base font-bold text-foreground">
            {formatYen(median)}
          </span>
          <span className="text-xs text-muted">中央値</span>
          <span className="text-xs text-muted">・</span>
          <span className="text-xs text-muted">{formatCount(totalCount)}</span>
        </div>
        <div className="text-xs text-muted mt-1">
          {formatRelativeDate(searchedAt)}
        </div>
      </div>
      <ChevronRight size={18} className="text-muted shrink-0 mt-1" />
    </Link>
  );
}
