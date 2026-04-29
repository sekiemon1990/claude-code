"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Plus,
  Star,
  StickyNote,
  Trash2,
  ExternalLink,
  RefreshCw,
  X,
  ChevronRight,
  ListChecks,
  Save,
  Sparkles,
  Loader2,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PlatformLogo } from "@/components/PlatformLogo";
import { BulkAddModal } from "@/components/BulkAddModal";
import { SOURCES, type SourceKey } from "@/lib/types";
import { formatYen } from "@/lib/utils";
import {
  useActiveList,
  removeItem,
  cancelItem,
  clearList,
  archiveCurrentList,
  type ListItem,
} from "@/lib/list";
import { toast } from "@/lib/toast";

export default function ListPage() {
  const list = useActiveList();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const running = list.items.filter((i) => i.status === "running");
  const queued = list.items.filter((i) => i.status === "queued");
  const completed = list.items.filter((i) => i.status === "completed");
  const failed = list.items.filter(
    (i) => i.status === "error" || i.status === "cancelled"
  );

  const total = completed.reduce(
    (s, i) => s + (i.result?.suggestedBuyPrice ?? 0),
    0
  );

  function save() {
    archiveCurrentList();
    toast({
      message: "査定リストを保存しました",
      actionLabel: "履歴で見る",
      actionHref: "/history",
    });
  }

  function reset() {
    clearList();
    setConfirmClear(false);
    toast({ message: "査定リストをクリアしました" });
  }

  return (
    <AppShell title="査定リスト">
      <div className="flex flex-col gap-4">
        <section>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks size={20} className="text-primary" />
              <h2 className="text-xl font-bold text-foreground">
                査定リスト
              </h2>
            </div>
            {list.items.length > 0 && (
              <span className="text-xs text-muted">
                {list.items.length}件
              </span>
            )}
          </div>
          <p className="text-sm text-muted mt-1">
            複数の商品を並列で検索しながら査定できます（同時実行 最大3件）
          </p>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/search"
            className="tap-scale h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-primary/90"
          >
            <Plus size={16} />
            商品を追加
          </Link>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="tap-scale h-12 rounded-lg border border-border bg-surface text-foreground font-medium text-sm flex items-center justify-center gap-1.5 hover:border-foreground/30"
          >
            <Sparkles size={14} />
            一括入力
          </button>
        </div>

        {list.items.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center">
            <Inbox className="text-muted mx-auto mb-3" size={36} />
            <p className="text-sm font-semibold text-foreground mb-1">
              査定リストは空です
            </p>
            <p className="text-xs text-muted leading-relaxed">
              「商品を追加」または「一括入力」から検索を始めましょう。
              <br />
              通常検索の結果画面からも追加できます。
            </p>
          </div>
        ) : (
          <>
            {(running.length > 0 || queued.length > 0) && (
              <section>
                <SectionHeader
                  icon={<Loader2 size={14} className="animate-spin" />}
                  label={`進行中 (${running.length + queued.length})`}
                  color="var(--primary)"
                />
                <div className="flex flex-col gap-2">
                  {running.map((item) => (
                    <RunningCard key={item.id} item={item} />
                  ))}
                  {queued.map((item) => (
                    <QueuedCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {completed.length > 0 && (
              <section>
                <SectionHeader
                  icon={
                    <span className="text-success text-base leading-none">
                      ✓
                    </span>
                  }
                  label={`完了 (${completed.length})`}
                  color="var(--success)"
                />
                <div className="flex flex-col gap-2">
                  {completed.map((item) => (
                    <CompletedCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {failed.length > 0 && (
              <section>
                <SectionHeader
                  icon={<AlertCircle size={14} />}
                  label={`エラー・中止 (${failed.length})`}
                  color="var(--danger)"
                />
                <div className="flex flex-col gap-2">
                  {failed.map((item) => (
                    <FailedCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {completed.length > 0 && (
              <section className="bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-xl p-5 mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs opacity-90">
                    合計推奨買取額（{completed.length}件）
                  </span>
                  <span className="text-[10px] opacity-75">
                    中央値 × 70% で算出
                  </span>
                </div>
                <div className="text-3xl font-bold tracking-tight">
                  {formatYen(total)}
                </div>
              </section>
            )}

            <section className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={save}
                disabled={completed.length === 0}
                className="tap-scale h-12 rounded-lg bg-surface border border-border text-foreground font-medium text-sm flex items-center justify-center gap-1.5 hover:border-foreground/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save size={14} />
                保存して新規
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="tap-scale h-12 rounded-lg bg-surface border border-border text-foreground font-medium text-sm flex items-center justify-center gap-1.5 hover:border-foreground/30"
              >
                <Trash2 size={14} />
                クリア
              </button>
            </section>
          </>
        )}
      </div>

      {bulkOpen && <BulkAddModal onClose={() => setBulkOpen(false)} />}

      {confirmClear && (
        <ConfirmDialog
          title="リストをクリアしますか？"
          body="現在の査定リストを破棄します。保存していない検索は失われます。"
          onConfirm={reset}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </AppShell>
  );
}

function SectionHeader({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2 px-1">
      <span style={{ color }}>{icon}</span>
      <span className="text-xs font-semibold text-foreground">{label}</span>
    </div>
  );
}

function RunningCard({ item }: { item: ListItem }) {
  return (
    <article className="bg-surface border-2 border-primary/30 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Loader2 size={14} className="animate-spin text-primary shrink-0" />
          <p className="text-sm font-medium text-foreground truncate">
            {item.query.keyword}
          </p>
        </div>
        <button
          type="button"
          onClick={() => cancelItem(item.id)}
          aria-label="中止"
          className="shrink-0 w-8 h-8 rounded-md text-muted hover:bg-surface-2 flex items-center justify-center"
        >
          <X size={14} />
        </button>
      </div>
      <div className="relative h-2 bg-surface-2 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-primary transition-all duration-200"
          style={{ width: `${item.progress}%` }}
        />
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted">
        {item.query.sources.map((s) => (
          <span key={s} className="inline-flex items-center gap-0.5">
            <PlatformLogo source={s} size={10} />
            {SOURCES.find((x) => x.key === s)?.shortName}
          </span>
        ))}
        <span className="ml-auto">
          直近
          {item.query.period === "all" ? "全期間" : `${item.query.period}日`}
        </span>
      </div>
    </article>
  );
}

function QueuedCard({ item }: { item: ListItem }) {
  return (
    <article className="bg-surface border border-border rounded-xl p-3 opacity-70">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs text-muted">⌛</span>
          <p className="text-sm font-medium text-foreground truncate">
            {item.query.keyword}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-muted">待機中</span>
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            aria-label="削除"
            className="w-8 h-8 rounded-md text-muted hover:bg-surface-2 flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

function CompletedCard({ item }: { item: ListItem }) {
  if (!item.result) return null;
  const r = item.result;
  const params = new URLSearchParams({
    keyword: item.query.keyword,
    period: item.query.period,
    sources: item.query.sources.join(","),
    ...(item.query.excludes && { excludes: item.query.excludes }),
    ...(item.query.conditions.length > 0 && {
      conditions: item.query.conditions.join(","),
    }),
    ...(item.query.shipping !== "any" && { shipping: item.query.shipping }),
  });
  const detailHref = `/search/result/list_${item.id}?${params.toString()}`;

  return (
    <article className="bg-surface border border-border rounded-xl overflow-hidden tap-scale hover:border-primary/40 transition-colors">
      <Link href={detailHref} className="block p-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-sm font-semibold text-foreground line-clamp-1">
            {item.query.keyword}
          </p>
          <div className="flex items-center gap-1 shrink-0 -mt-1 -mr-1">
            {item.query.sources.map((s) => (
              <PlatformLogo key={s} source={s} size={14} />
            ))}
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xl font-bold text-foreground">
            {formatYen(r.median)}
          </span>
          <span className="text-[10px] text-muted">中央値</span>
          <span className="text-[10px] text-muted">・ {r.count}件</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted">
            推奨買取
            <span className="ml-1 font-bold text-success">
              {formatYen(r.suggestedBuyPrice)}
            </span>
          </span>
          <span className="text-[10px] text-muted">
            {formatYen(r.min)} 〜 {formatYen(r.max)}
          </span>
        </div>
      </Link>
      <div className="grid grid-cols-2 border-t border-border">
        <Link
          href={detailHref}
          className="flex items-center justify-center gap-1 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-2 border-r border-border"
        >
          詳細
          <ChevronRight size={12} />
        </Link>
        <button
          type="button"
          onClick={() => {
            removeItem(item.id);
            toast({ message: "リストから削除しました" });
          }}
          className="flex items-center justify-center gap-1 py-2.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-danger"
        >
          <Trash2 size={12} />
          削除
        </button>
      </div>
    </article>
  );
}

function FailedCard({ item }: { item: ListItem }) {
  return (
    <article className="bg-danger/5 border border-danger/30 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <AlertCircle size={14} className="text-danger shrink-0" />
          <p className="text-sm font-medium text-foreground truncate">
            {item.query.keyword}
          </p>
        </div>
        <button
          type="button"
          onClick={() => removeItem(item.id)}
          aria-label="削除"
          className="shrink-0 w-8 h-8 rounded-md text-muted hover:bg-surface-2 flex items-center justify-center"
        >
          <X size={14} />
        </button>
      </div>
      <p className="text-xs text-muted">
        {item.status === "cancelled" ? "中止されました" : "検索エラー"}
      </p>
    </article>
  );
}

function ConfirmDialog({
  title,
  body,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 anim-fade-in flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="anim-slide-up max-w-sm w-full bg-surface rounded-2xl shadow-xl border border-border p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="text-sm text-muted mt-2 leading-relaxed">{body}</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="tap-scale h-11 rounded-lg border border-border text-foreground text-sm hover:bg-surface-2"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="tap-scale h-11 rounded-lg bg-danger text-white text-sm font-semibold hover:bg-danger/90"
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}
