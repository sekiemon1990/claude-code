"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  BarChart3,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Gavel,
  ArrowDownNarrowWide,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SourceBadge } from "@/components/SourceBadge";
import { MOCK_RESULT } from "@/lib/mock-data";
import { formatYen, formatCount, formatRelativeDate } from "@/lib/utils";
import { SOURCES, type SourceKey, type Listing } from "@/lib/types";

type FlatListing = Listing & { source: SourceKey };

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function ResultInner() {
  const params = useSearchParams();
  const result = MOCK_RESULT;

  const sourcesParam = params.get("sources");
  const requestedSources = useMemo<SourceKey[]>(
    () =>
      sourcesParam
        ? (sourcesParam.split(",") as SourceKey[])
        : ["yahoo_auction"],
    [sourcesParam]
  );

  const [filter, setFilter] = useState<"all" | SourceKey>("all");

  const flatListings: FlatListing[] = useMemo(() => {
    return result.sources
      .filter((s) => requestedSources.includes(s.source))
      .flatMap((s) => s.listings.map((l) => ({ ...l, source: s.source })))
      .sort(
        (a, b) =>
          new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
      );
  }, [result, requestedSources]);

  const visibleListings =
    filter === "all"
      ? flatListings
      : flatListings.filter((l) => l.source === filter);

  const summary = useMemo(() => {
    const prices = visibleListings.map((l) => l.price);
    return {
      median: median(prices),
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0,
      totalCount: visibleListings.length,
    };
  }, [visibleListings]);

  const queryStr = new URLSearchParams(params.toString()).toString();
  const period = params.get("period") ?? result.query.period;

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-start gap-2 mb-2">
          <Sparkles size={16} className="text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-muted">商品の特定結果</div>
        </div>
        <h2 className="text-base font-bold text-foreground">
          {result.productGuess}
        </h2>
        <div className="text-xs text-muted mt-1">
          検索: {params.get("keyword") ?? result.query.keyword}
          {" ・ "}
          直近{period === "all" ? "全期間" : `${period}日`}
        </div>
      </section>

      <section className="bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3 opacity-90">
          <BarChart3 size={16} />
          <span className="text-xs font-medium">
            {filter === "all" ? "統合サマリー" : `${SOURCES.find((s) => s.key === filter)?.name}サマリー`}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight">
            {formatYen(summary.median)}
          </span>
          <span className="text-sm opacity-90">中央値</span>
        </div>
        <div className="mt-2 text-sm opacity-90">
          {formatYen(summary.min)} 〜 {formatYen(summary.max)}
          <span className="ml-2 text-xs">
            ({formatCount(summary.totalCount)})
          </span>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-sm font-semibold text-foreground">
            落札・売切一覧
          </h3>
          <span className="text-xs text-muted flex items-center gap-1">
            <ArrowDownNarrowWide size={12} />
            落札日 新しい順
          </span>
        </div>

        {requestedSources.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-1 scrollbar-none">
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label={`全て (${flatListings.length})`}
            />
            {requestedSources.map((key) => {
              const meta = SOURCES.find((s) => s.key === key)!;
              const count = flatListings.filter((l) => l.source === key).length;
              return (
                <FilterChip
                  key={key}
                  active={filter === key}
                  onClick={() => setFilter(key)}
                  label={`${meta.shortName} (${count})`}
                  color={meta.color}
                />
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {visibleListings.map((l) => {
            const sourceMeta = SOURCES.find((s) => s.key === l.source)!;
            return (
              <article
                key={`${l.source}-${l.id}`}
                className="bg-surface border border-border rounded-xl overflow-hidden"
              >
                <div className="flex p-3 gap-3">
                  {l.thumbnail ? (
                    <img
                      src={l.thumbnail}
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
                    <div className="mb-1.5">
                      <SourceBadge source={l.source} />
                    </div>
                    <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                      {l.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-lg font-bold text-foreground">
                        {formatYen(l.price)}
                      </span>
                      {l.bidCount !== undefined && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted">
                          <Gavel size={12} />
                          {l.bidCount}件
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                      {l.condition && <span className="truncate">{l.condition}</span>}
                      {l.condition && <span>・</span>}
                      <span className="shrink-0">{formatRelativeDate(l.endedAt)}</span>
                    </div>
                  </div>
                </div>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-4 border-t border-border text-xs font-semibold hover:bg-surface-2 active:bg-surface-2 transition-colors"
                  style={{ color: sourceMeta.color }}
                >
                  {sourceMeta.name}で詳細を見る
                  <ExternalLink size={14} />
                </a>
              </article>
            );
          })}

          {visibleListings.length === 0 && (
            <div className="bg-surface border border-border rounded-xl p-8 text-center text-sm text-muted">
              該当するデータがありません
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 pt-2">
        <Link
          href={`/search?${queryStr}`}
          className="h-12 rounded-lg border border-border bg-surface text-foreground font-medium text-sm flex items-center justify-center gap-2 hover:border-foreground/30"
        >
          <RefreshCw size={16} />
          再検索
        </Link>
        <button
          type="button"
          className="h-12 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90"
        >
          履歴に保存
        </button>
      </section>

      <section className="bg-surface-2 rounded-xl p-3 mt-2">
        <p className="text-xs text-muted leading-relaxed">
          ※ 表示価格は選択した媒体から取得した直近の
          {period === "all" ? "全期間" : `${period}日`}
          のデータです。市場相場の参考としてご利用ください。
        </p>
      </section>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "shrink-0 h-8 px-3 rounded-full text-xs font-semibold border-2 transition-colors"
          : "shrink-0 h-8 px-3 rounded-full text-xs font-medium border border-border text-foreground bg-surface hover:border-foreground/30"
      }
      style={
        active
          ? color
            ? {
                borderColor: color,
                color,
                backgroundColor: `${color}10`,
              }
            : {
                borderColor: "var(--primary)",
                color: "var(--primary)",
                backgroundColor: "rgba(31, 111, 235, 0.06)",
              }
          : undefined
      }
    >
      {label}
    </button>
  );
}

export default function SearchResultPage() {
  return (
    <AppShell back={{ href: "/search", label: "検索" }} title="検索結果">
      <Suspense
        fallback={
          <div className="pt-8 text-center text-muted text-sm">
            読み込み中...
          </div>
        }
      >
        <ResultInner />
      </Suspense>
    </AppShell>
  );
}
