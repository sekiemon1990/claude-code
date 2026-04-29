"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronRight,
  Search as SearchIcon,
  Star,
  StickyNote,
  Eye,
  History as HistoryIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SourceBadge } from "@/components/SourceBadge";
import { ConditionBadge } from "@/components/ConditionBadge";
import { MOCK_HISTORY } from "@/lib/mock-data";
import { formatYen, formatCount, formatRelativeDate } from "@/lib/utils";
import {
  searchKeyFromKeyword,
  useMemoValue,
  usePinnedValue,
  useListingMemoValue,
  useListingPinnedValue,
  useListingViews,
  type ListingViewSnapshot,
} from "@/lib/storage";
import { classifyCondition } from "@/lib/conditions";

type Tab = "searches" | "views";

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>("searches");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [memoOnly, setMemoOnly] = useState(false);

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <section>
          <h2 className="text-xl font-bold text-foreground">履歴</h2>
          <p className="text-sm text-muted mt-1">
            検索や閲覧した商品を後から確認できます
          </p>
        </section>

        <div className="grid grid-cols-2 bg-surface-2 rounded-lg p-1 gap-1">
          <button
            type="button"
            onClick={() => setTab("searches")}
            className={
              tab === "searches"
                ? "h-9 rounded-md text-sm font-semibold bg-surface text-foreground shadow-sm flex items-center justify-center gap-1.5"
                : "h-9 rounded-md text-sm font-medium text-muted hover:text-foreground flex items-center justify-center gap-1.5"
            }
          >
            <HistoryIcon size={14} />
            検索履歴
          </button>
          <button
            type="button"
            onClick={() => setTab("views")}
            className={
              tab === "views"
                ? "h-9 rounded-md text-sm font-semibold bg-surface text-foreground shadow-sm flex items-center justify-center gap-1.5"
                : "h-9 rounded-md text-sm font-medium text-muted hover:text-foreground flex items-center justify-center gap-1.5"
            }
          >
            <Eye size={14} />
            閲覧履歴
          </button>
        </div>

        <Link
          href="/search"
          className="flex items-center gap-2 h-12 rounded-lg bg-surface border border-border hover:border-primary/40 px-4 text-foreground"
        >
          <SearchIcon size={18} className="text-muted" />
          <span className="text-sm">新しい検索を開始</span>
        </Link>

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setPinnedOnly(false);
              setMemoOnly(false);
            }}
            className={
              !pinnedOnly && !memoOnly
                ? "shrink-0 h-8 px-3 rounded-full text-xs font-semibold border-2 border-primary bg-primary/5 text-primary"
                : "shrink-0 h-8 px-3 rounded-full text-xs font-medium border border-border text-foreground bg-surface"
            }
          >
            全て
          </button>
          <button
            type="button"
            onClick={() => setPinnedOnly(!pinnedOnly)}
            className={
              pinnedOnly
                ? "shrink-0 h-8 px-3 rounded-full text-xs font-semibold border-2 border-warning bg-warning/10 text-warning flex items-center gap-1"
                : "shrink-0 h-8 px-3 rounded-full text-xs font-medium border border-border text-foreground bg-surface flex items-center gap-1"
            }
          >
            <Star size={12} fill={pinnedOnly ? "currentColor" : "none"} />
            ピン留めのみ
          </button>
          <button
            type="button"
            onClick={() => setMemoOnly(!memoOnly)}
            className={
              memoOnly
                ? "shrink-0 h-8 px-3 rounded-full text-xs font-semibold border-2 border-primary bg-primary/5 text-primary flex items-center gap-1"
                : "shrink-0 h-8 px-3 rounded-full text-xs font-medium border border-border text-foreground bg-surface flex items-center gap-1"
            }
          >
            <StickyNote size={12} />
            メモあり
          </button>
        </div>

        {tab === "searches" ? (
          <SearchHistoryList pinnedOnly={pinnedOnly} memoOnly={memoOnly} />
        ) : (
          <ViewHistoryList pinnedOnly={pinnedOnly} memoOnly={memoOnly} />
        )}
      </div>
    </AppShell>
  );
}

function SearchHistoryList({
  pinnedOnly,
  memoOnly,
}: {
  pinnedOnly: boolean;
  memoOnly: boolean;
}) {
  const items = useMemo(
    () =>
      MOCK_HISTORY.map((h) => ({
        ...h,
        searchKey: searchKeyFromKeyword(h.keyword),
      })),
    []
  );

  return (
    <div className="flex flex-col gap-2">
      {items.map((h) => (
        <SearchHistoryCard
          key={h.id}
          id={h.id}
          keyword={h.keyword}
          searchKey={h.searchKey}
          median={h.median}
          totalCount={h.totalCount}
          searchedAt={h.searchedAt}
          pinnedOnly={pinnedOnly}
          memoOnly={memoOnly}
        />
      ))}
    </div>
  );
}

function SearchHistoryCard({
  id,
  keyword,
  searchKey,
  median,
  totalCount,
  searchedAt,
  pinnedOnly,
  memoOnly,
}: {
  id: string;
  keyword: string;
  searchKey: string;
  median: number;
  totalCount: number;
  searchedAt: string;
  pinnedOnly: boolean;
  memoOnly: boolean;
}) {
  const memo = useMemoValue(searchKey);
  const pinned = usePinnedValue(searchKey);

  if (pinnedOnly && !pinned) return null;
  if (memoOnly && !memo) return null;

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

function ViewHistoryList({
  pinnedOnly,
  memoOnly,
}: {
  pinnedOnly: boolean;
  memoOnly: boolean;
}) {
  const views = useListingViews();

  if (views.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <Eye className="text-muted mx-auto mb-2" size={28} />
        <p className="text-sm text-muted">まだ閲覧した商品がありません</p>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          検索結果から商品の詳細を開くと、ここに記録されます
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {views.map((v) => (
        <ViewHistoryCard
          key={v.ref + v.viewedAt}
          view={v}
          pinnedOnly={pinnedOnly}
          memoOnly={memoOnly}
        />
      ))}
    </div>
  );
}

function ViewHistoryCard({
  view,
  pinnedOnly,
  memoOnly,
}: {
  view: ListingViewSnapshot;
  pinnedOnly: boolean;
  memoOnly: boolean;
}) {
  const pinned = useListingPinnedValue(view.ref);
  const memo = useListingMemoValue(view.ref);

  if (pinnedOnly && !pinned) return null;
  if (memoOnly && !memo) return null;

  const detailHref = `/search/result/recent/listing/${view.ref}${
    view.fromKeyword
      ? `?keyword=${encodeURIComponent(view.fromKeyword)}`
      : ""
  }`;

  const rank = classifyCondition(view.condition);

  return (
    <Link
      href={detailHref}
      className="bg-surface border border-border rounded-xl overflow-hidden hover:border-primary/40 active:bg-surface-2 transition-colors"
    >
      <div className="flex p-3 gap-3">
        {view.thumbnail ? (
          <img
            src={view.thumbnail}
            alt=""
            loading="lazy"
            className="w-20 h-20 rounded-lg object-cover bg-surface-2 shrink-0"
          />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-surface-2 shrink-0 flex items-center justify-center text-muted text-[10px]">
            画像なし
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <SourceBadge source={view.source} />
              <ConditionBadge rank={rank} size="sm" />
            </div>
            {pinned && (
              <Star
                size={14}
                className="text-warning shrink-0"
                fill="currentColor"
              />
            )}
          </div>
          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
            {view.title}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-base font-bold text-foreground">
              {formatYen(view.price)}
            </span>
          </div>
          <div className="text-xs text-muted mt-1">
            閲覧: {formatRelativeDate(view.viewedAt)}
            {view.fromKeyword && (
              <span className="ml-2">・ 検索: {view.fromKeyword}</span>
            )}
          </div>
        </div>
      </div>
      {memo && (
        <div className="flex items-start gap-1.5 px-3 pb-3 pt-0">
          <div className="flex-1 flex items-start gap-1.5 p-2 rounded-md bg-warning/10 border border-warning/20">
            <StickyNote
              size={12}
              className="text-warning mt-0.5 shrink-0"
            />
            <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
              {memo}
            </p>
          </div>
        </div>
      )}
    </Link>
  );
}
