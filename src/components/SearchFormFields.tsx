"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Check,
  ClipboardPaste,
  History as HistoryIcon,
  Sparkles,
  Mic,
} from "lucide-react";
import { PlatformLogo } from "@/components/PlatformLogo";
import { SOURCES, type SourceKey } from "@/lib/types";
import { CONDITION_RANKS, CONDITION_META, type ConditionRank } from "@/lib/conditions";
import { MOCK_HISTORY } from "@/lib/mock-data";
import { findDictionaryMatches } from "@/lib/keyword-dictionary";
import { enqueueOfflineSearch } from "@/lib/offline-queue";
import { toast } from "@/lib/toast";
import {
  recordSearchKeyword,
  fetchUserKeywordSuggestions,
} from "@/lib/api/search-keywords";

export type Period = "7" | "30" | "60" | "90" | "180" | "365" | "all";

// UI 上の選択肢 (順序固定)
export const PERIOD_OPTIONS: { v: Period; label: string }[] = [
  { v: "7", label: "1週間" },
  { v: "30", label: "1ヶ月" },
  { v: "60", label: "2ヶ月" },
  { v: "90", label: "3ヶ月" },
  { v: "180", label: "半年" },
  { v: "365", label: "1年" },
  { v: "all", label: "全期間" },
];

// デフォルト期間
export const DEFAULT_PERIOD: Period = "90";

// 期間表示ラベル取得
export function getPeriodLabel(period: Period): string {
  return PERIOD_OPTIONS.find((p) => p.v === period)?.label ?? `${period}日`;
}
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
  const [period, setPeriod] = useState<Period>(initial?.period ?? DEFAULT_PERIOD);
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

  // ローカル辞書からの即時候補 (0ms)
  const dictionaryCandidates = useMemo(() => {
    const trimmed = keyword.trim();
    if (trimmed.length < 1) return [];
    return findDictionaryMatches(trimmed, 6);
  }, [keyword]);

  // ユーザー個人の検索履歴 (Supabase ベース)
  const [userHistoryCandidates, setUserHistoryCandidates] = useState<string[]>([]);

  useEffect(() => {
    let canceled = false;
    fetchUserKeywordSuggestions(keyword, 5)
      .then((list) => {
        if (!canceled) setUserHistoryCandidates(list);
      })
      .catch(() => {
        if (!canceled) setUserHistoryCandidates([]);
      });
    return () => {
      canceled = true;
    };
  }, [keyword]);

  // AI オートコンプリート (入力 2 文字以上で 150ms デバウンス後にリクエスト)
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
    }, 150);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [keyword]);

  // ページマウント時に Vercel function を pre-warm (コールドスタート対策)
  useEffect(() => {
    fetch("/api/keyword-suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "" }),
    }).catch(() => {
      // pre-warm は失敗しても無視
    });
  }, []);

  // 表示用の統合候補
  const showAi = aiCandidates.length > 0;
  const showHistory = historySuggestions.length > 0;
  const showDictionary = dictionaryCandidates.length > 0 && !showAi;
  const showUserHistory = userHistoryCandidates.length > 0;

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

    // オフライン時はキューに保存して後で実行
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      enqueueOfflineSearch({
        keyword: keyword.trim(),
        excludes: excludes.trim() || undefined,
        period,
        sources: selectedSources,
        conditions: selectedConditions,
        shipping,
      });
      toast({
        message: "オフラインのため検索を保留しました。回線復帰時に自動実行されます",
        actionLabel: "保留中の検索を見る",
        actionHref: "/list",
      });
      onAfterSubmit?.();
      return;
    }

    // バックグラウンドで検索キーワード履歴に記録 (失敗しても続行)
    recordSearchKeyword(keyword).catch(() => {});
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
            className="w-full h-12 pl-4 pr-12 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <VoiceInputButton onResult={(t) => setKeyword(t)} />
          {keywordFocused &&
            (showAi ||
              showHistory ||
              showDictionary ||
              showUserHistory ||
              aiLoading) && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-96 overflow-y-auto">
              {/* あなたの検索履歴 (Supabase 永続) */}
              {showUserHistory && (
                <>
                  <div className="px-3 py-1.5 text-[10px] text-muted bg-surface-2 sticky top-0 border-b border-border flex items-center gap-1">
                    <HistoryIcon size={11} className="text-foreground" />
                    <span>あなたの検索履歴</span>
                  </div>
                  {userHistoryCandidates.map((c) => (
                    <button
                      key={`uh-${c}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setKeyword(c);
                        setKeywordFocused(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface-2 text-left"
                    >
                      <HistoryIcon size={14} className="text-foreground shrink-0" />
                      <span className="truncate">{c}</span>
                    </button>
                  ))}
                </>
              )}

              {/* ローカル辞書候補 (AI 取得前の即時表示) */}
              {showDictionary && (
                <>
                  <div className="px-3 py-1.5 text-[10px] text-muted bg-surface-2 sticky top-0 border-b border-border flex items-center gap-1">
                    <Sparkles size={11} className="text-primary" />
                    <span>候補</span>
                    {aiLoading && (
                      <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>
                  {dictionaryCandidates.map((c) => (
                    <button
                      key={`dict-${c}`}
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

              {/* AI 取得中で AI 候補も辞書候補もない時のみスケルトン */}
              {!showAi &&
                !showDictionary &&
                aiLoading &&
                keyword.trim().length >= 2 && (
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
        <ExcludePresets value={excludes} onChange={setExcludes} />
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
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {PERIOD_OPTIONS.map((opt) => (
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

// Web Speech API 型定義 (TypeScript 標準には無い)
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (e: SpeechRecognitionEvent) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function VoiceInputButton({
  onResult,
}: {
  onResult: (text: string) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  function start() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "ja-JP";
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e) => {
      // 最終結果優先、無ければ interim を表示
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0]?.transcript ?? "";
        if (res.isFinal) finalText += t;
        else interimText += t;
      }
      const combined = (finalText || interimText).trim();
      if (combined) onResult(combined);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recognitionRef.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      onMouseDown={(e) => e.preventDefault()}
      aria-label={listening ? "音声入力停止" : "音声入力開始"}
      aria-pressed={listening}
      className={
        "absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-md flex items-center justify-center transition-colors " +
        (listening
          ? "bg-danger text-danger-foreground animate-pulse"
          : "text-muted hover:text-foreground hover:bg-surface-2")
      }
    >
      <Mic size={18} />
    </button>
  );
}

const EXCLUDE_PRESETS = [
  "ジャンク",
  "本体のみ",
  "部品取り",
  "壊れ",
  "難あり",
  "訳あり",
  "ノークレーム",
  "未使用",
  "新品",
  "コピー",
  "互換",
  "海賊版",
];

function ExcludePresets({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const tokens = value
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const set = new Set(tokens);

  function toggle(word: string) {
    if (set.has(word)) {
      const next = tokens.filter((t) => t !== word).join(" ");
      onChange(next);
    } else {
      const next = [...tokens, word].join(" ");
      onChange(next);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {EXCLUDE_PRESETS.map((w) => {
        const active = set.has(w);
        return (
          <button
            key={w}
            type="button"
            onClick={() => toggle(w)}
            aria-pressed={active}
            className={
              active
                ? "h-7 px-2.5 rounded-full text-xs font-medium border bg-primary text-primary-foreground border-primary"
                : "h-7 px-2.5 rounded-full text-xs font-medium border bg-surface-2 text-foreground border-border hover:border-primary/40"
            }
          >
            {active ? "✓ " : "+ "}
            {w}
          </button>
        );
      })}
    </div>
  );
}
