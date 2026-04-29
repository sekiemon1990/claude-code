"use client";

import { useEffect, useState } from "react";
import { Search, Star, StickyNote, Sparkles, ChevronRight } from "lucide-react";
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/storage";

const STEPS = [
  {
    icon: <Search size={36} className="text-primary" />,
    title: "ヤフオク・メルカリ・ジモティーから一括検索",
    body: "商品名やキーワードを入力すると、複数の媒体から落札相場をまとめて取得できます。期間・状態・送料での絞り込みも可能です。",
  },
  {
    icon: (
      <div className="flex items-center gap-2">
        <Star size={32} className="text-pin" fill="currentColor" />
        <StickyNote size={32} className="text-memo" />
      </div>
    ),
    title: "気になる商品にピンとメモ",
    body: "落札カードを「ダブルタップ」で査定メモを追加。星アイコンで個別にピン留めもできます。あとから履歴で一覧表示できます。",
  },
  {
    icon: <Sparkles size={36} className="text-primary" />,
    title: "AI査定と買取額計算機で判断を支援",
    body: "結果画面の「査定ツール」で、AIが買取額の目安を提案してくれます。電卓と組み合わせて、現場での暗算もサポート。",
  },
];

export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!hasSeenOnboarding()) {
      const timer = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(timer);
    }
  }, []);

  function close() {
    markOnboardingSeen();
    setOpen(false);
  }

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 anim-fade-in flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border overflow-hidden anim-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={
                  i === step
                    ? "w-6 h-1.5 rounded-full bg-primary transition-all"
                    : "w-1.5 h-1.5 rounded-full bg-border transition-all"
                }
              />
            ))}
          </div>
          <button
            type="button"
            onClick={close}
            className="text-xs text-muted hover:text-foreground"
          >
            スキップ
          </button>
        </div>

        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-surface-2 flex items-center justify-center">
            {current.icon}
          </div>
          <h2 className="text-lg font-bold text-foreground">{current.title}</h2>
          <p className="text-sm text-muted leading-relaxed">{current.body}</p>
        </div>

        <div className="p-4 border-t border-border">
          {isLast ? (
            <button
              type="button"
              onClick={close}
              className="tap-scale w-full h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90"
            >
              はじめる
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="tap-scale w-full h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 flex items-center justify-center gap-1"
            >
              次へ
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
