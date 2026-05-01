"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Check,
  ClipboardPaste,
  History as HistoryIcon,
  Sparkles,
} from "lucide-react";
import { PlatformLogo } from "@/components/PlatformLogo";
import { SOURCES, type SourceKey } from "@/lib/types";
import { CONDITION_RANKS, CONDITION_META, type ConditionRank } from "@/lib/conditions";
import { MOCK_HISTORY } from "@/lib/mock-data";

export type Period = "30" | "90" | "all";
export type ShippingFilter = "any" | "free" | "paid";
export type ConditionRankNonUnknown = Exclude<ConditionRank, "unknown">;

export type SearchFormValues = {
  keyword: string;
  excludes: string;
  period: Period;
  sources: SourceKey[];
  conditions: ConditionRankNonUnknown[];
  shipping: ShippingFilter;
};

type Props = {
  initial?: Partial<SearchFormValues>;
  submitLabel?: string;
  onAfterSubmit?: () => void;
};

export function SearchFormFields({
  initial,
  submitLabel = "検索する",
  onAfterSubmit,
}: Props) {
  const router = useRouter();

  const [keyword, setKeyword] = useState(initial?.keyword ?? "");
  const [excludes, setExcludes] = useState(initial?.excludes ?? "");
  const [period, setPeriod] = useState<Period>(initial?.period ?? "30");
  const [selectedSources, setSelectedSources] = useState<SourceKey[]>(
    initial?.sources && initial.sources.length > 0
      ? initial.sources
      : ["yahoo_auction"]
  );
  const [selectedConditions, setSelectedConditions] = useState<
    ConditionRankNonUnknown[]
  >(initial?.conditions ?? []);
  const [shipping, setShipping] = useState<ShippingFilter>(
    initial?.shipping ?? "any"
  );
  const [keywordFocused, setKeywordFocused] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 履歴ベースの候補 (空欄時 = 最近の検索、入力時 = 履歴部分一致)
  const historySuggestions = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const all = MOCK_HISTORY.map((h) => h.keyword);
    const filtered = q
      ? all.filter((k) => k.toLowerCase().includes(q) && k.toLowerCase() !== q)
      : all;
    return filtered.slice(0, 6);
  }, [keyword]);

  // AI オートコンプリート (入力 2 文字以上で 350ms デバウンス後にリクエスト)
  const [aiCandidates, setAiCandidates] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const aiCacheRef = useRef<Map<string, string[]>>(new Map());
  const aiAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = keyword.trim();
    // 空欄 / 1 文字なら AI 候補は出さない
    if (trimmed.length < 2) {
      setAiCandidates([]);
      setAiLoading(false);
      aiAbortRef.current?.abort();
      return;
    }
    // キャッシュヒット
    const cached = aiCacheRef.current.get(trimmed);
    if (cached) {
      setAiCandidates(cached);
      setAiLoading(false);
      return;
    }

    setAiLoading(true);
    const controller = new AbortController();
    aiAbortRef.current?.abort();
    aiAbortRef.current = controller;

    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/keyword-suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: trimmed }),
          signal: controller.signal,
        });
        if (!res.ok) {
          setAiCandidates([]);
          setAiLoading(false);
          return;
        }
        const data = (await res.json()) as { candidates?: string[] };
        const list = (data.candidates ?? []).slice(0, 8);
        aiCacheRef.current.set(trimmed, list);
        if (!controller.signal.aborted) {
          setAiCandidates(list);
          setAiLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setAiCandidates([]);
          setAiLoading(false);
        }
      }
    }, 200);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [keyword]);

  // 表示用の統合候補 (履歴と AI を重複排除しつつ統合)
  const showAi = aiCandidates.length > 0;
  const showHistory = historySuggestions.length > 0;

  async function handlePasteFromClipboard() {
    try {
      if (!navigator.clipboard?.readText) return;
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (trimmed) setKeyword(trimmed);
    } catch {
      // permission denied, ignore
    }
  }

  function toggleSource(key: SourceKey) {
    setSelectedSources((prev) =>
      prev.includes(key)
        ? prev.length > 1
          ? prev.filter((k) => k !== key)
          : prev
        : [...prev, key]
    );
  }

  function toggleCondition(rank: ConditionRankNonUnknown) {
    setSelectedConditions((prev) =>
      prev.includes(rank) ? prev.filter((r) => r !== rank) : [...prev, rank]
    );
  }

  function buildParams() {
    return new URLSearchParams({
      keyword: keyword.trim(),
      ...(excludes.trim() && { excludes: excludes.trim() }),
      period,
      sources: selectedSources.join(","),
      ...(selectedConditions.length > 0 && {
        conditions: selectedConditions.join(","),
      }),
      ...(shipping !== "any" && { shipping }),
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) return;
    if (selectedSources.length === 0) return;
    router.push(`/search/loading?${buildParams().toString()}`);
    onAfterSubmit?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="keyword"
            className="text-sm font-medium text-foreground"
          >
            商品名・型番 <span className="text-danger">*</span>
          </label>
          <button
            type="button"
            onClick={handlePasteFromClipboard}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ClipboardPaste size={13} />
            クリップボードから貼り付け
          </button>
        </div>
        <div className="relative">
          <input
            id="keyword"
            type="text"
            required
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onFocus={() => {
              if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
              setKeywordFocused(true);
            }}
            onBlur={() => {
              blurTimerRef.current = setTimeout(
                () => setKeywordFocused(false),
                150
              );
            }}
            placeholder="例: SONY α7 IV ILCE-7M4"
            autoComplete="off"
            className="w-full h-12 px-4 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {keywordFocused && (showAi || showHistory || aiLoading) && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-96 overflow-y-auto">
              {/* AI 候補 (入力中のみ) */}
              {showAi && (
                <>
                  <div className="px-3 py-1.5 text-[10px] text-muted bg-surface-2 sticky top-0 border-b border-border flex items-center gap-1">
                    <Sparkles size={11} className="text-primary" />
                    <span>AI 候補</span>
                    {aiLoading && (
                      <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>
                  {aiCandidates.map((c) => (
                    <button
                      key={`ai-${c}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setKeyword(c);
                        setKeywordFocused(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface-2 text-left"
                    >
                      <Sparkles size={14} className="text-primary shrink-0" />
                      <span className="truncate">{c}</span>
                    </button>
                  ))}
                </>
              )}

              {/* AI 取得中で AI 候補がまだ無い時のスケルトン */}
              {!showAi && aiLoading && keyword.trim().length >= 2 && (
                <div className="px-3 py-3 text-xs text-muted flex items-center gap-2">
                  <Sparkles size={12} className="text-primary" />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  AI 候補を生成中...
                </div>
              )}

              {/* 履歴ベースの候補 */}
              {showHistory && (
                <>
                  <div className="px-3 py-1.5 text-[10px] text-muted bg-surface-2 sticky top-0 border-b border-border">
                    {keyword.trim() ? "履歴から候補" : "最近の検索"}
                  </div>
                  {historySuggestions.map((s) => (
                    <button
                      key={`h-${s}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setKeyword(s);
                        setKeywordFocused(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface-2 text-left"
                    >
                      <HistoryIcon
                        size={14}
                        className="text-muted shrink-0"
                      />
                      <span className="truncate">{s}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="excludes"
          className="text-sm font-medium text-foreground"
        >
          除外ワード
          <span className="ml-1 text-xs text-muted font-normal">
            （任意・スペース区切り）
          </span>
        </label>
        <input
          id="excludes"
          type="text"
          value={excludes}
          onChange={(e) => setExcludes(e.target.value)}
          placeholder="例: ジャンク 部品"
          className="h-12 px-4 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">
          検索媒体
          <span className="ml-1 text-xs text-muted font-normal">
            （複数選択可）
          </span>
        </span>
        <div className="grid grid-cols-3 gap-2">
          {SOURCES.map((s) => {
            const selected = selectedSources.includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSource(s.key)}
                className={
                  selected
                    ? "h-11 rounded-lg border-2 bg-surface text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    : "h-11 rounded-lg border border-border bg-surface text-foreground text-sm flex items-center justify-center gap-1.5 hover:border-foreground/30"
                }
                style={
                  selected
                    ? {
                        borderColor: s.color,
                        color: s.color,
                        backgroundColor: `${s.color}0d`,
                      }
                    : undefined
                }
              >
                <PlatformLogo source={s.key} size={16} />
                {s.shortName}
                {selected && <Check size={12} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">
          状態で絞り込み
          <span className="ml-1 text-xs text-muted font-normal">
            （未選択 = 全て）
          </span>
        </span>
        <div className="grid grid-cols-5 gap-2">
          {CONDITION_RANKS.map((r) => {
            const meta = CONDITION_META[r];
            const selected = selectedConditions.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggleCondition(r)}
                title={meta.description}
                className={
                  selected
                    ? "h-11 rounded-lg border-2 text-sm font-bold flex items-center justify-center transition-colors"
                    : "h-11 rounded-lg border border-border bg-surface text-muted text-sm font-bold hover:border-foreground/30 flex items-center justify-center"
                }
                style={
                  selected
                    ? {
                        borderColor: meta.color,
                        color: meta.color,
                        backgroundColor: `${meta.color}10`,
                      }
                    : undefined
                }
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">送料</span>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { v: "any", label: "指定なし" },
              { v: "free", label: "送料無料のみ" },
              { v: "paid", label: "送料別のみ" },
            ] as { v: ShippingFilter; label: string }[]
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setShipping(opt.v)}
              className={
                shipping === opt.v
                  ? "h-11 rounded-lg border-2 border-primary bg-primary/5 text-primary font-semibold text-sm"
                  : "h-11 rounded-lg border border-border bg-surface text-foreground text-sm hover:border-foreground/30"
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">検索期間</span>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { v: "30", label: "直近30日" },
              { v: "90", label: "直近90日" },
              { v: "all", label: "全期間" },
            ] as { v: Period; label: string }[]
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setPeriod(opt.v)}
              className={
                period === opt.v
                  ? "h-11 rounded-lg border-2 border-primary bg-primary/5 text-primary font-semibold text-sm"
                  : "h-11 rounded-lg border border-border bg-surface text-foreground text-sm hover:border-foreground/30"
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="tap-scale h-14 mt-2 rounded-lg bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm"
      >
        <Search size={20} />
        {submitLabel}
      </button>
    </form>
  );
}
