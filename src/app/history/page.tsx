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
  X as XIcon,
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

const DATE_GROUP_ORDER = [
  "今日",
  "昨日",
  "今週",
  "先週",
  "それ以前",
] as const;
type DateGroup = (typeof DATE_GROUP_ORDER)[number];

function groupByDate<T>(
  items: T[],
  getDate: (item: T) => string
): Record<DateGroup, T[]> {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfThisWeek = startOfToday - now.getDay() * 86400000;
  const startOfLastWeek = startOfThisWeek - 7 * 86400000;

  const groups: Record<DateGroup, T[]> = {
    今日: [],
    昨日: [],
    今週: [],
    先週: [],
    それ以前: [],
  };

  for (const item of items) {
    const t = new Date(getDate(item)).getTime();
    if (t >= startOfToday) groups["今日"].push(item);
    else if (t >= startOfYesterday) groups["昨日"].push(item);
    else if (t >= startOfThisWeek) groups["今週"].push(item);
    else if (t >= startOfLastWeek) groups["先週"].push(item);
    else groups["それ以前"].push(item);
  }

  return groups;
}

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>("searches");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [memoOnly, setMemoOnly] = useState(false);
  const [query, setQuery] = useState("");

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

        <div className="relative">
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="履歴を検索"
            className="w-full h-11 pl-9 pr-9 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="クリア"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-muted hover:bg-surface-2 flex items-center justify-center"
            >
              <XIcon size={14} />
            </button>
          )}
        </div>

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
          <SearchHistoryList
            pinnedOnly={pinnedOnly}
            memoOnly={memoOnly}
            query={query}
          />
        ) : (
          <ViewHistoryList
            pinnedOnly={pinnedOnly}
            memoOnly={memoOnly}
            query={query}
          />
        )}
      </div>
    </AppShell>
  );
}

function SearchHistoryList({
  pinnedOnly,
  memoOnly,
  query,
}: {
  pinnedOnly: boolean;
  memoOnly: boolean;
  query: string;
}) {
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_HISTORY.map((h) => ({
      ...h,
      searchKey: searchKeyFromKeyword(h.keyword),
    })).filter((h) => !q || h.keyword.toLowerCase().includes(q));
  }, [query]);

  const groups = useMemo(
    () => groupByDate(items, (i) => i.searchedAt),
    [items]
  );

  if (items.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <SearchIcon className="text-muted mx-auto mb-2" size={28} />
        <p className="text-sm text-muted">該当する検索履歴がありません</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {DATE_GROUP_ORDER.map((g) => {
        const list = groups[g];
        if (list.length === 0) return null;
        return (
          <div key={g} className="flex flex-col gap-2">
            <div className="text-[11px] font-semibold text-muted px-1">
              {g}
            </div>
            {list.map((h) => (
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
      })}
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
  query,
}: {
  pinnedOnly: boolean;
  memoOnly: boolean;
  query: string;
}) {
  const allViews = useListingViews();

  const views = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allViews;
    return allViews.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        (v.fromKeyword?.toLowerCase().includes(q) ?? false)
    );
  }, [allViews, query]);

  const groups = useMemo(
    () => groupByDate(views, (v) => v.viewedAt),
    [views]
  );

  if (allViews.length === 0) {
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

  if (views.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <SearchIcon className="text-muted mx-auto mb-2" size={28} />
        <p className="text-sm text-muted">該当する閲覧履歴がありません</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {DATE_GROUP_ORDER.map((g) => {
        const list = groups[g];
        if (list.length === 0) return null;
        return (
          <div key={g} className="flex flex-col gap-2">
            <div className="text-[11px] font-semibold text-muted px-1">
              {g}
            </div>
            {list.map((v) => (
              <ViewHistoryCard
                key={v.ref + v.viewedAt}
                view={v}
                pinnedOnly={pinnedOnly}
                memoOnly={memoOnly}
              />
            ))}
          </div>
        );
      })}
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
