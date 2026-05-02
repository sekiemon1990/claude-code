"use client";

import { useEffect, useState } from "react";
import { X, StickyNote } from "lucide-react";
import {
  setListingMemo,
  useListingMemoValue,
  haptic,
} from "@/lib/storage";
import { toast } from "@/lib/toast";

type Props = {
  ref: string;
  title: string;
  thumbnail?: string;
  price: number;
  onClose: () => void;
};

export function QuickMemoModal({
  ref: listingRef,
  title,
  thumbnail,
  price,
  onClose,
}: Props) {
  const initialMemo = useListingMemoValue(listingRef);
  const [memo, setMemo] = useState(initialMemo);
  // listingRef が変わった or Supabase からメモが取れたタイミングで textarea を初期化
  // (render 中の setState は React 19 で許可されており、無限ループの懸念がない場合の derived state パターン)
  const [snapshotKey, setSnapshotKey] = useState(`${listingRef}:${initialMemo}`);
  const currentKey = `${listingRef}:${initialMemo}`;
  if (currentKey !== snapshotKey) {
    setSnapshotKey(currentKey);
    setMemo(initialMemo);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function save() {
    setListingMemo(listingRef, memo);
    haptic(8);
    toast({
      message: memo.trim() ? "メモを保存しました" : "メモを削除しました",
      actionLabel: "履歴で見る",
      actionHref: "/history",
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 anim-fade-in flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="anim-slide-up w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl border border-border flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <StickyNote size={16} className="text-warning" />
            <h2 className="text-sm font-semibold text-foreground">
              査定メモを追加
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="w-8 h-8 rounded-full text-muted hover:bg-surface-2 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div className="flex gap-3">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt=""
                className="w-14 h-14 rounded-lg object-cover bg-surface-2 shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-surface-2 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                {title}
              </p>
              <p className="text-base font-bold text-foreground mt-1">
                ¥{price.toLocaleString("ja-JP")}
              </p>
            </div>
          </div>

          <MemoTemplates value={memo} onChange={setMemo} />

          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={5}
            placeholder="例: ¥120,000で買取打診したい候補。状態Bランクを目安"
            className="w-full p-3 rounded-lg bg-surface-2 border border-border text-foreground placeholder:text-muted text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
            autoFocus
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-lg border border-border text-foreground text-sm hover:bg-surface-2"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={save}
              className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 出張買取の現場で使う定型チェック項目
const MEMO_TEMPLATES = [
  "□ 傷チェック",
  "□ 動作確認",
  "□ 付属品確認",
  "□ 元箱あり",
  "□ 取説あり",
  "□ 保証書あり",
  "□ バッテリー状態",
  "□ シリアル確認",
  "□ 写真撮影済",
];

function MemoTemplates({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  function toggle(label: string) {
    const lines = value.split("\n");
    const idx = lines.findIndex((l) => l.trim() === label);
    if (idx >= 0) {
      // 既に追加済み → その行を削除
      lines.splice(idx, 1);
      onChange(lines.join("\n").replace(/\n{3,}/g, "\n\n").trimStart());
    } else {
      // 末尾に追加 (前行が空でなければ改行を挟む)
      const trimmed = value.trimEnd();
      const sep = trimmed.length === 0 ? "" : trimmed.endsWith("\n") ? "" : "\n";
      onChange(trimmed + sep + label + "\n");
    }
  }

  const present = new Set(
    value.split("\n").map((l) => l.trim()).filter(Boolean),
  );

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] text-muted">定型チェック (タップで追加/解除)</span>
      <div className="flex flex-wrap gap-1.5">
        {MEMO_TEMPLATES.map((t) => {
          const active = present.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              aria-pressed={active}
              className={
                active
                  ? "h-7 px-2.5 rounded-full text-xs font-medium border bg-primary text-primary-foreground border-primary"
                  : "h-7 px-2.5 rounded-full text-xs font-medium border bg-surface-2 text-foreground border-border hover:border-primary/40"
              }
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}
