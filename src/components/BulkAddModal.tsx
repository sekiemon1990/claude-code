"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Sparkles, ListChecks } from "lucide-react";
import { addItemsToList, type ListItemQuery } from "@/lib/list";
import { toast } from "@/lib/toast";

type Props = {
  onClose: () => void;
};

export function BulkAddModal({ onClose }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");

  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  function handleSubmit() {
    if (lines.length === 0) return;
    const queries: ListItemQuery[] = lines.map((kw) => ({
      keyword: kw,
      period: "30",
      sources: ["yahoo_auction", "mercari", "jimoty"],
      conditions: [],
      shipping: "any",
    }));
    addItemsToList(queries);
    toast({
      message: `${queries.length}件をリストに追加`,
      actionLabel: "リストを見る",
      actionHref: "/list",
    });
    onClose();
    router.push("/list");
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 anim-fade-in flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="anim-slide-up w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl border border-border flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              複数商品をまとめて検索
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

        <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto">
          <p className="text-xs text-muted leading-relaxed">
            改行区切りで商品名を入力してください。各商品が独立してバックグラウンドで検索され、査定リストに追加されます。
          </p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={`例:\nROLEX サブマリーナ\nヴィトン ネヴァーフルMM\niPhone 15 Pro 256GB\nダイソン V12`}
            className="w-full p-3 rounded-lg bg-surface-2 border border-border text-foreground placeholder:text-muted text-sm font-mono leading-relaxed focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
            autoFocus
          />

          <div className="bg-surface-2 rounded-lg p-3 flex items-center gap-2">
            <ListChecks size={14} className="text-primary" />
            <span className="text-sm text-foreground">
              <span className="font-bold">{lines.length}</span>
              <span className="text-xs text-muted ml-1">件が入力されています</span>
            </span>
          </div>

          <p className="text-[11px] text-muted leading-relaxed">
            検索条件: ヤフオク・メルカリ・ジモティー / 直近30日 / 状態指定なし
            <br />
            個別の条件を変えたい場合は、追加後にカードから「再検索」できます。
          </p>
        </div>

        <div className="p-4 border-t border-border grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="tap-scale h-11 rounded-lg border border-border text-foreground text-sm hover:bg-surface-2"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={lines.length === 0}
            className="tap-scale h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {lines.length}件を一括検索
          </button>
        </div>
      </div>
    </div>
  );
}
