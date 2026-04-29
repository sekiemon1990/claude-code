"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { renameList, type AppraisalList } from "@/lib/list";
import { toast } from "@/lib/toast";

type Props = {
  list: AppraisalList;
  onClose: () => void;
};

export function RenameListModal({ list, onClose }: Props) {
  const [name, setName] = useState(list.name ?? "");

  function save() {
    renameList(list.id, name);
    toast({ message: "名前を変更しました" });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 anim-fade-in flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="anim-slide-up max-w-sm w-full bg-surface rounded-2xl shadow-xl border border-border p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <Pencil size={16} className="text-primary" />
          <h3 className="text-base font-bold text-foreground">
            リスト名を変更
          </h3>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          placeholder="例: 佐藤様 4/29"
          className="w-full h-11 px-3 rounded-lg bg-surface-2 border border-border text-foreground placeholder:text-muted text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          autoFocus
        />
        <p className="text-[11px] text-muted mt-2 leading-relaxed">
          顧客名・案件名・日付など、後で見返す時に分かりやすい名前を付けると便利です。
        </p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="tap-scale h-11 rounded-lg border border-border text-foreground text-sm hover:bg-surface-2"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={save}
            className="tap-scale h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
