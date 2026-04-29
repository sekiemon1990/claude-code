"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { SOURCES, type SourceKey } from "@/lib/types";
import { AppShell } from "@/components/AppShell";

function LoadingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState(0);

  const keyword = params.get("keyword") ?? "";
  const sourcesParam = params.get("sources");

  const activeSources = useMemo(() => {
    const requested = sourcesParam
      ? (sourcesParam.split(",") as SourceKey[])
      : (["yahoo_auction"] as SourceKey[]);
    return SOURCES.filter((s) => requested.includes(s.key));
  }, [sourcesParam]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    activeSources.forEach((_, i) => {
      timers.push(setTimeout(() => setStep(i + 1), 800 * (i + 1)));
    });
    timers.push(
      setTimeout(() => {
        const next = new URLSearchParams(params.toString());
        router.push(`/search/result/search_001?${next.toString()}`);
      }, 800 * (activeSources.length + 1))
    );
    return () => timers.forEach(clearTimeout);
  }, [router, params, activeSources]);

  return (
    <div className="flex flex-col items-center justify-center pt-16 gap-8">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-border" />
        <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-transparent border-t-primary animate-spin" />
      </div>

      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">相場を検索中...</h2>
        <p className="text-sm text-muted mt-1 truncate max-w-[280px]">
          「{keyword}」
        </p>
      </div>

      <div className="w-full bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
        {activeSources.map((s, i) => {
          const done = step > i;
          const active = step === i;
          return (
            <div
              key={s.key}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="font-medium text-foreground">{s.name}</span>
              </div>
              <span className="text-xs">
                {done ? (
                  <span className="text-success font-medium">取得完了</span>
                ) : active ? (
                  <span className="text-primary font-medium">取得中...</span>
                ) : (
                  <span className="text-muted">待機中</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SearchLoadingPage() {
  return (
    <AppShell showNav={false}>
      <Suspense
        fallback={
          <div className="pt-16 text-center text-muted text-sm">
            読み込み中...
          </div>
        }
      >
        <LoadingInner />
      </Suspense>
    </AppShell>
  );
}
