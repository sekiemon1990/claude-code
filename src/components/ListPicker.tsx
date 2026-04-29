"use client";

import { useState } from "react";
import {
  X,
  Check,
  ListChecks,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
} from "lucide-react";
import {
  useAllLists,
  getCurrentList,
  switchToList,
  createList,
  deleteList,
  renameList,
  type AppraisalList,
} from "@/lib/list";
import { formatYen } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/utils";
import { toast } from "@/lib/toast";

type Props = {
  onClose: () => void;
};

export function ListPicker({ onClose }: Props) {
  const lists = useAllLists();
  const [renameTarget, setRenameTarget] = useState<AppraisalList | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AppraisalList | null>(null);
  const current = getCurrentList();

  function selectList(id: string) {
    switchToList(id);
    toast({ message: "リストを切替えました" });
    onClose();
  }

  function createNewList() {
    createList();
    toast({ message: "新しい査定リストを作成しました" });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 anim-fade-in flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="anim-slide-up w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl border border-border flex flex-col max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ListChecks size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              査定リストを切替
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

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-2 p-3">
            {lists.map((list) => (
              <ListPickerItem
                key={list.id}
                list={list}
                isCurrent={list.id === current.id}
                onSelect={() => selectList(list.id)}
                onRename={() => setRenameTarget(list)}
                onDelete={() => setConfirmDelete(list)}
              />
            ))}
            {lists.length === 0 && (
              <div className="text-center py-8 text-sm text-muted">
                リストがありません
              </div>
            )}
          </div>
        </div>

        <div className="p-3 border-t border-border">
          <button
            type="button"
            onClick={createNewList}
            className="tap-scale w-full h-12 rounded-lg border-2 border-dashed border-border text-foreground text-sm font-medium hover:border-primary hover:text-primary flex items-center justify-center gap-1.5"
          >
            <Plus size={14} />
            新しい査定リストを作成
          </button>
        </div>
      </div>

      {renameTarget && (
        <RenameModal
          list={renameTarget}
          onClose={() => setRenameTarget(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          list={confirmDelete}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function ListPickerItem({
  list,
  isCurrent,
  onSelect,
  onRename,
  onDelete,
}: {
  list: AppraisalList;
  isCurrent: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const completed = list.items.filter((i) => i.status === "completed");
  const total = completed.reduce(
    (s, i) => s + (i.result?.suggestedBuyPrice ?? 0),
    0
  );
  const running = list.items.filter(
    (i) => i.status === "running" || i.status === "queued"
  ).length;

  return (
    <div
      className={
        isCurrent
          ? "bg-primary/5 border-2 border-primary rounded-xl overflow-hidden"
          : "bg-surface border border-border rounded-xl overflow-hidden hover:border-foreground/30"
      }
    >
      <button
        type="button"
        onClick={onSelect}
        className="tap-scale w-full p-3 text-left flex items-start gap-2"
      >
        {isCurrent ? (
          <div className="shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center mt-0.5">
            <Check size={12} />
          </div>
        ) : (
          <div className="shrink-0 w-5 h-5 rounded-full border-2 border-border mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-foreground truncate">
              {list.name ?? "（無題）"}
            </p>
            {isCurrent && (
              <span className="shrink-0 text-[10px] font-bold text-primary px-1.5 py-0.5 rounded-full bg-primary/10">
                使用中
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
            <span>{list.items.length}件</span>
            {running > 0 && (
              <>
                <span>・</span>
                <span className="text-primary">進行中 {running}</span>
              </>
            )}
            {completed.length > 0 && (
              <>
                <span>・</span>
                <span>合計 {formatYen(total)}</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-muted mt-1">
            最終更新 {formatRelativeDate(list.updatedAt)}
          </div>
        </div>
        {!isCurrent && (
          <ChevronRight size={16} className="text-muted shrink-0 mt-1" />
        )}
      </button>
      <div className="grid grid-cols-2 border-t border-border">
        <button
          type="button"
          onClick={onRename}
          className="flex items-center justify-center gap-1 py-2 text-xs text-muted hover:bg-surface-2 hover:text-foreground border-r border-border"
        >
          <Pencil size={11} />
          名前変更
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center justify-center gap-1 py-2 text-xs text-muted hover:bg-surface-2 hover:text-danger"
        >
          <Trash2 size={11} />
          削除
        </button>
      </div>
    </div>
  );
}

function RenameModal({
  list,
  onClose,
}: {
  list: AppraisalList;
  onClose: () => void;
}) {
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
        <h3 className="text-base font-bold text-foreground mb-3">
          リスト名を変更
        </h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 佐藤様 4/29"
          className="w-full h-11 px-3 rounded-lg bg-surface-2 border border-border text-foreground placeholder:text-muted text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          autoFocus
        />
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

function ConfirmDeleteModal({
  list,
  onClose,
}: {
  list: AppraisalList;
  onClose: () => void;
}) {
  function doDelete() {
    deleteList(list.id);
    toast({ message: "リストを削除しました" });
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
        <h3 className="text-base font-bold text-foreground">
          リストを削除しますか？
        </h3>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          「{list.name ?? "（無題）"}」とその中の{list.items.length}件の検索を完全に削除します。元に戻せません。
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
            onClick={doDelete}
            className="tap-scale h-11 rounded-lg bg-danger text-white text-sm font-semibold hover:bg-danger/90"
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}
