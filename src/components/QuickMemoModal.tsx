"use client";

import { useEffect, useState } from "react";
import { X, StickyNote } from "lucide-react";
import {
  getListingMemo,
  setListingMemo,
} from "@/lib/storage";

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
  const [memo, setMemo] = useState(() => getListingMemo(listingRef));

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
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl border border-border flex flex-col max-h-[90vh] overflow-hidden"
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

          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={4}
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
