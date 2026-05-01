"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type Suggestion = { keyword: string; reason: string };

type Props = {
  resultId: string;
  keyword: string;
  totalAvailable: number;
  sampleTitles: string[];
  /** 現在の URL パラメータをそのまま引き継ぐためのクエリ文字列 (keyword 以外) */
  baseQueryParams: URLSearchParams;
};

export function RefineKeywordSuggestions({
  resultId,
  keyword,
  totalAvailable,
  sampleTitles,
  baseQueryParams,
}: Props) {
  const router = useRouter();
  const [requested, setRequested] = useState(false);

  const query = useQuery({
    queryKey: ["refine_keywords", keyword],
    queryFn: async (): Promise<Suggestion[]> => {
      const res = await fetch("/api/refine-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          totalAvailable,
          sampleTitles: sampleTitles.slice(0, 30),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "絞り込み提案の取得に失敗");
      }
      const data = (await res.json()) as { suggestions: Suggestion[] };
      return data.suggestions;
    },
    enabled: requested,
    staleTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  function applySuggestion(s: Suggestion) {
    const next = new URLSearchParams(baseQueryParams);
    next.set("keyword", s.keyword);
    router.push(`/search/result/${resultId}?${next.toString()}`);
  }

  return (
    <section className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">
            絞り込みキーワード提案
          </span>
          <span className="text-[10px] text-muted px-1.5 py-0.5 rounded bg-surface border border-border">
            β
          </span>
        </div>
      </div>

      <p className="text-xs text-muted leading-relaxed mb-3">
        該当が {totalAvailable.toLocaleString("ja-JP")} 件と多すぎます。
        AI が落札商品から絞り込みキーワードを提案します。
      </p>

      {!requested && (
        <button
          type="button"
          onClick={() => setRequested(true)}
          className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 flex items-center justify-center gap-1.5"
        >
          <Sparkles size={14} />
          絞り込み候補を取得
        </button>
      )}

      {requested && query.isLoading && (
        <div className="flex items-center justify-center py-4 gap-2 text-muted">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">分析中...</span>
        </div>
      )}

      {requested && query.isError && (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2 text-danger">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <p className="text-xs leading-relaxed">
              {query.error instanceof Error
                ? query.error.message
                : "失敗しました"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="w-full h-9 rounded-lg border border-border text-foreground text-sm hover:bg-surface-2"
          >
            再試行
          </button>
        </div>
      )}

      {query.data && query.data.length > 0 && (
        <div className="flex flex-col gap-2">
          {query.data.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => applySuggestion(s)}
              className="tap-scale w-full text-left bg-surface border border-border rounded-lg p-3 hover:border-primary/40 hover:bg-surface-2 flex items-start gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">
                  {s.keyword}
                </div>
                <div className="text-[11px] text-muted mt-0.5 line-clamp-2 leading-relaxed">
                  {s.reason}
                </div>
              </div>
              <ChevronRight size={16} className="text-muted shrink-0 mt-1" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
