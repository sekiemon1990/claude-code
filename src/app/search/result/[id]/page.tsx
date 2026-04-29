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
  Link2,
  Check,
  ArrowUpDown,
  Filter,
  Star,
  StickyNote,
  AlertTriangle,
  Inbox,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SourceBadge } from "@/components/SourceBadge";
import { ImageLightbox } from "@/components/ImageLightbox";
import { MOCK_RESULT } from "@/lib/mock-data";
import {
  formatYen,
  formatCount,
  formatRelativeDate,
  buildPlatformSearchUrl,
} from "@/lib/utils";
import {
  searchKeyFromKeyword,
  setMemo,
  setPinned,
  useMemoValue,
  usePinnedValue,
} from "@/lib/storage";
import { SOURCES, type SourceKey, type Listing } from "@/lib/types";

type FlatListing = Listing & { source: SourceKey };
type SortMode = "date_desc" | "date_asc" | "price_desc" | "price_asc";

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

const PAGE_SIZE = 10;

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

  const keyword = params.get("keyword") ?? result.query.keyword;
  const period = params.get("period") ?? result.query.period;
  const mockMode = params.get("mock");
  const searchKey = searchKeyFromKeyword(keyword);

  const memo = useMemoValue(searchKey);
  const pinned = usePinnedValue(searchKey);
  const [memoDraft, setMemoDraft] = useState<string | null>(null);
  const [memoEditing, setMemoEditing] = useState(false);

  const [filter, setFilter] = useState<"all" | SourceKey>("all");
  const [sort, setSort] = useState<SortMode>("date_desc");
  const [refine, setRefine] = useState("");
  const [refineOpen, setRefineOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [lightbox, setLightbox] = useState<{ src: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Mock failure simulation
  const failedSources: SourceKey[] = mockMode === "error" ? ["mercari"] : [];

  const flatListings: FlatListing[] = useMemo(() => {
    if (mockMode === "empty") return [];
    return result.sources
      .filter(
        (s) =>
          requestedSources.includes(s.source) &&
          !failedSources.includes(s.source)
      )
      .flatMap((s) => s.listings.map((l) => ({ ...l, source: s.source })));
  }, [result, requestedSources, mockMode, failedSources]);

  const filteredListings = useMemo(() => {
    let list = flatListings;
    if (filter !== "all") {
      list = list.filter((l) => l.source === filter);
    }
    if (refine.trim()) {
      const terms = refine
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      list = list.filter((l) => {
        const title = l.title.toLowerCase();
        return terms.every((t) => !title.includes(t));
      });
    }
    return [...list].sort((a, b) => {
      if (sort === "date_desc")
        return new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime();
      if (sort === "date_asc")
        return new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime();
      if (sort === "price_desc") return b.price - a.price;
      return a.price - b.price;
    });
  }, [flatListings, filter, refine, sort]);

  const visibleListings = filteredListings.slice(0, visibleCount);

  const summary = useMemo(() => {
    const prices = filteredListings.map((l) => l.price);
    return {
      median: median(prices),
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0,
      totalCount: filteredListings.length,
    };
  }, [filteredListings]);

  const queryStr = new URLSearchParams(params.toString()).toString();
  const isEmpty = flatListings.length === 0;
  const hasNoMatch = !isEmpty && filteredListings.length === 0;

  async function handleCopyUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // noop
    }
  }

  function startMemoEdit() {
    setMemoDraft(memo);
    setMemoEditing(true);
  }

  function saveMemo() {
    if (memoDraft !== null) setMemo(searchKey, memoDraft);
    setMemoEditing(false);
    setMemoDraft(null);
  }

  function cancelMemoEdit() {
    setMemoEditing(false);
    setMemoDraft(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 商品の特定結果 */}
      <section className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-start gap-2 min-w-0">
            <Sparkles size={16} className="text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted">商品の特定結果</div>
          </div>
          <button
            type="button"
            onClick={() => setPinned(searchKey, !pinned)}
            aria-label={pinned ? "ピンを外す" : "ピン留め"}
            className={
              pinned
                ? "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-warning/10 text-warning"
                : "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-surface-2"
            }
          >
            <Star size={16} fill={pinned ? "currentColor" : "none"} />
          </button>
        </div>
        <h2 className="text-base font-bold text-foreground">
          {isEmpty ? keyword : result.productGuess}
        </h2>
        <div className="text-xs text-muted mt-1">
          検索: {keyword} ・ 直近{period === "all" ? "全期間" : `${period}日`}
        </div>
      </section>

      {/* メモ */}
      <section className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <StickyNote size={16} className="text-warning" />
            <span className="text-sm font-semibold text-foreground">
              検索メモ
            </span>
          </div>
          {!memoEditing && (
            <button
              type="button"
              onClick={startMemoEdit}
              className="text-xs text-primary hover:underline"
            >
              {memo ? "編集" : "+ 追加"}
            </button>
          )}
        </div>
        {memoEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={memoDraft ?? ""}
              onChange={(e) => setMemoDraft(e.target.value)}
              rows={3}
              placeholder="例: 〇〇宅で査定。状態Bで¥80,000で成約"
              className="w-full p-3 rounded-lg bg-surface-2 border border-border text-foreground placeholder:text-muted text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelMemoEdit}
                className="flex-1 h-9 rounded-lg border border-border text-foreground text-sm hover:bg-surface-2"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={saveMemo}
                className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                保存
              </button>
            </div>
          </div>
        ) : memo ? (
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {memo}
          </p>
        ) : (
          <p className="text-xs text-muted">
            この検索にメモを残せます。履歴ページから一覧で確認できます。
          </p>
        )}
      </section>

      {/* サマリー */}
      {!isEmpty && (
        <section className="bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3 opacity-90">
            <BarChart3 size={16} />
            <span className="text-xs font-medium">
              {filter === "all"
                ? "統合サマリー"
                : `${SOURCES.find((s) => s.key === filter)?.name}サマリー`}
              {refine.trim() && " (絞り込み後)"}
            </span>
          </div>
          {summary.totalCount > 0 ? (
            <>
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
            </>
          ) : (
            <p className="text-sm opacity-90">
              絞り込み条件に一致する結果がありません
            </p>
          )}
        </section>
      )}

      {/* 媒体別検索リンク */}
      {!isEmpty && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2 px-1">
            媒体ページで全件を見る
          </h3>
          <div className="flex flex-col gap-2">
            {requestedSources.map((key) => {
              const meta = SOURCES.find((s) => s.key === key)!;
              const url = buildPlatformSearchUrl(key, keyword);
              const failed = failedSources.includes(key);
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 px-4 h-12 rounded-lg bg-surface border-2 hover:bg-surface-2 active:bg-surface-2 transition-colors"
                  style={{ borderColor: `${meta.color}33` }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      aria-hidden
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span
                      className="text-sm font-semibold truncate"
                      style={{ color: meta.color }}
                    >
                      {meta.name}で「{keyword}」を見る
                    </span>
                    {failed && (
                      <span className="shrink-0 text-xs text-danger flex items-center gap-0.5">
                        <AlertTriangle size={12} />
                        取得失敗
                      </span>
                    )}
                  </div>
                  <ExternalLink
                    size={16}
                    style={{ color: meta.color }}
                    className="shrink-0"
                  />
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* 取得失敗の警告 */}
      {failedSources.length > 0 && (
        <section className="bg-warning/10 border border-warning/30 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-warning mt-0.5 shrink-0" />
          <p className="text-xs text-foreground leading-relaxed">
            一部の媒体（
            {failedSources
              .map((s) => SOURCES.find((x) => x.key === s)?.name)
              .join("・")}
            ）からデータが取得できませんでした。表示は他の媒体のみの結果です。
          </p>
        </section>
      )}

      {/* 一覧コントロール */}
      {!isEmpty && (
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-sm font-semibold text-foreground">
              落札・売切一覧
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRefineOpen(!refineOpen)}
                aria-label="絞り込み"
                className={
                  refineOpen || refine.trim()
                    ? "h-7 px-2 rounded text-xs font-medium border-2 border-primary text-primary bg-primary/5 flex items-center gap-1"
                    : "h-7 px-2 rounded text-xs text-muted hover:text-foreground flex items-center gap-1"
                }
              >
                <Filter size={12} />
                絞り込み
              </button>
              <SortDropdown sort={sort} onChange={setSort} />
            </div>
          </div>

          {refineOpen && (
            <div className="mb-2 flex gap-2">
              <input
                type="text"
                value={refine}
                onChange={(e) => {
                  setRefine(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="さらに除外（スペース区切り）例: ジャンク 部品"
                className="flex-1 h-10 px-3 rounded-lg bg-surface border border-border text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
              {refine && (
                <button
                  type="button"
                  onClick={() => setRefine("")}
                  className="w-10 h-10 rounded-lg border border-border text-muted hover:bg-surface-2 flex items-center justify-center"
                  aria-label="クリア"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          {requestedSources.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-1 scrollbar-none">
              <FilterChip
                active={filter === "all"}
                onClick={() => {
                  setFilter("all");
                  setVisibleCount(PAGE_SIZE);
                }}
                label={`全て (${flatListings.length})`}
              />
              {requestedSources
                .filter((k) => !failedSources.includes(k))
                .map((key) => {
                  const meta = SOURCES.find((s) => s.key === key)!;
                  const count = flatListings.filter(
                    (l) => l.source === key
                  ).length;
                  return (
                    <FilterChip
                      key={key}
                      active={filter === key}
                      onClick={() => {
                        setFilter(key);
                        setVisibleCount(PAGE_SIZE);
                      }}
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
                      <button
                        type="button"
                        onClick={() => setLightbox({ src: l.thumbnail! })}
                        className="w-20 h-20 rounded-lg overflow-hidden bg-surface-2 shrink-0"
                        aria-label="画像を拡大"
                      >
                        <img
                          src={l.thumbnail}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </button>
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
                        {l.condition && (
                          <span className="truncate">{l.condition}</span>
                        )}
                        {l.condition && <span>・</span>}
                        <span className="shrink-0">
                          {formatRelativeDate(l.endedAt)}
                        </span>
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

            {hasNoMatch && (
              <div className="bg-surface border border-border rounded-xl p-8 text-center">
                <Inbox className="text-muted mx-auto mb-2" size={28} />
                <p className="text-sm text-muted">
                  絞り込み条件に一致する結果がありません
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRefine("");
                    setFilter("all");
                  }}
                  className="text-xs text-primary hover:underline mt-2"
                >
                  絞り込みをクリア
                </button>
              </div>
            )}

            {visibleCount < filteredListings.length && (
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="h-12 rounded-lg border border-border bg-surface text-foreground text-sm font-medium hover:bg-surface-2 transition-colors"
              >
                もっと見る ({filteredListings.length - visibleCount}件)
              </button>
            )}
          </div>
        </section>
      )}

      {/* 完全に空 */}
      {isEmpty && (
        <section className="bg-surface border border-border rounded-xl p-8 text-center">
          <Inbox className="text-muted mx-auto mb-3" size={36} />
          <p className="text-sm font-semibold text-foreground mb-1">
            検索結果が見つかりませんでした
          </p>
          <p className="text-xs text-muted leading-relaxed">
            キーワードを変えるか、媒体・期間を広げて再検索してみてください。
          </p>
          <Link
            href={`/search?${queryStr}`}
            className="inline-block mt-4 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium leading-10"
          >
            検索条件を変更
          </Link>
        </section>
      )}

      {/* アクション */}
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
          onClick={handleCopyUrl}
          className={
            copied
              ? "h-12 rounded-lg bg-success text-white font-medium text-sm flex items-center justify-center gap-2"
              : "h-12 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2"
          }
        >
          {copied ? (
            <>
              <Check size={16} />
              コピーしました
            </>
          ) : (
            <>
              <Link2 size={16} />
              URLをコピー
            </>
          )}
        </button>
      </section>

      <section className="bg-surface-2 rounded-xl p-3 mt-2 flex items-start gap-2">
        <Check size={14} className="text-success mt-0.5 shrink-0" />
        <p className="text-xs text-muted leading-relaxed">
          検索結果は履歴に自動保存されています。このページのURLを共有すれば、
          社内の他のスタッフも同じ結果を確認できます。
        </p>
      </section>

      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function SortDropdown({
  sort,
  onChange,
}: {
  sort: SortMode;
  onChange: (s: SortMode) => void;
}) {
  const labels: Record<SortMode, string> = {
    date_desc: "落札日 新しい順",
    date_asc: "落札日 古い順",
    price_desc: "価格 高い順",
    price_asc: "価格 安い順",
  };
  return (
    <div className="relative">
      <select
        value={sort}
        onChange={(e) => onChange(e.target.value as SortMode)}
        className="appearance-none h-7 pl-6 pr-6 rounded text-xs font-medium bg-transparent text-muted hover:text-foreground border-0 focus:outline-none cursor-pointer"
      >
        {(Object.keys(labels) as SortMode[]).map((k) => (
          <option key={k} value={k}>
            {labels[k]}
          </option>
        ))}
      </select>
      <ArrowUpDown
        size={12}
        className="absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
      />
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
