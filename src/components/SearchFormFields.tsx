"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Search, Check, ClipboardPaste, History as HistoryIcon, ListPlus } from "lucide-react";
import { PlatformLogo } from "@/components/PlatformLogo";
import { SOURCES, type SourceKey } from "@/lib/types";
import { CONDITION_RANKS, CONDITION_META, type ConditionRank } from "@/lib/conditions";
import { MOCK_HISTORY } from "@/lib/mock-data";
import { addItemToList } from "@/lib/list";
import { toast } from "@/lib/toast";

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

  const suggestions = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const all = MOCK_HISTORY.map((h) => h.keyword);
    const filtered = q
      ? all.filter((k) => k.toLowerCase().includes(q) && k.toLowerCase() !== q)
      : all;
    return filtered.slice(0, 6);
  }, [keyword]);

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

  function handleAddToList() {
    if (!keyword.trim()) return;
    if (selectedSources.length === 0) return;
    addItemToList({
      keyword: keyword.trim(),
      excludes: excludes.trim() || undefined,
      period,
      sources: selectedSources,
      conditions: selectedConditions,
      shipping,
    });
    toast({
      message: `「${keyword.trim()}」をリストに追加しました`,
      actionLabel: "リストを見る",
      actionHref: "/list",
    });
    setKeyword("");
    setExcludes("");
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
          {keywordFocused && suggestions.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto">
              <div className="px-3 py-1.5 text-[10px] text-muted bg-surface-2 sticky top-0 border-b border-border">
                {keyword.trim() ? "履歴から候補" : "最近の検索"}
              </div>
              {suggestions.map((s) => (
                <button
                  key={s}
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

      <div className="flex flex-col gap-2 mt-2">
        <button
          type="submit"
          className="tap-scale h-14 rounded-lg bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <Search size={20} />
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={handleAddToList}
          className="tap-scale h-12 rounded-lg bg-surface border border-border text-foreground font-medium text-sm hover:border-primary/40 transition-colors flex items-center justify-center gap-2"
        >
          <ListPlus size={16} />
          査定リストに追加（複数の商品を並列検索）
        </button>
      </div>
    </form>
  );
}
