"use client";

import { useState } from "react";
import {
  Plus,
  ClipboardPaste,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import { PlatformLogo } from "./PlatformLogo";
import { BulkAddModal } from "./BulkAddModal";
import { SOURCES, type SourceKey } from "@/lib/types";
import {
  CONDITION_RANKS,
  CONDITION_META,
  type ConditionRank,
} from "@/lib/conditions";
import { addItemToList, useDefaultQuery } from "@/lib/list";
import type { Period, ShippingFilter } from "./SearchFormFields";
import { haptic } from "@/lib/storage";
import { toast } from "@/lib/toast";

export function QuickAddBar() {
  const [keyword, setKeyword] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [defaults, updateDefaults] = useDefaultQuery();

  function add() {
    if (!keyword.trim()) return;
    if (defaults.sources.length === 0) {
      toast({ message: "媒体を1つ以上選択してください", variant: "error" });
      return;
    }
    addItemToList({
      keyword: keyword.trim(),
      excludes: defaults.excludes?.trim() || undefined,
      period: defaults.period,
      sources: defaults.sources,
      conditions: defaults.conditions,
      shipping: defaults.shipping,
    });
    haptic(8);
    toast({ message: `「${keyword.trim()}」を追加しました` });
    setKeyword("");
  }

  async function pasteFromClipboard() {
    try {
      if (!navigator.clipboard?.readText) return;
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (trimmed) setKeyword(trimmed);
    } catch {}
  }

  function toggleSource(key: SourceKey) {
    const isSelected = defaults.sources.includes(key);
    if (isSelected && defaults.sources.length === 1) return; // 最低1つは残す
    const next = isSelected
      ? defaults.sources.filter((s) => s !== key)
      : [...defaults.sources, key];
    updateDefaults({ sources: next });
  }

  function toggleCondition(rank: Exclude<ConditionRank, "unknown">) {
    const next = defaults.conditions.includes(rank)
      ? defaults.conditions.filter((c) => c !== rank)
      : [...defaults.conditions, rank];
    updateDefaults({ conditions: next });
  }

  // サマリー文字列
  const summary = [
    `${defaults.sources.length === SOURCES.length ? "全媒体" : `${defaults.sources.length}媒体`}`,
    `直近${defaults.period === "all" ? "全期間" : `${defaults.period}日`}`,
    defaults.conditions.length > 0 ? `状態 ${defaults.conditions.join(",")}` : null,
    defaults.shipping === "free"
      ? "送料無料のみ"
      : defaults.shipping === "paid"
        ? "送料別のみ"
        : null,
    defaults.excludes?.trim() ? `除外: ${defaults.excludes.trim().split(/\s+/).slice(0, 2).join(" ")}` : null,
  ]
    .filter(Boolean)
    .join(" ・ ");

  return (
    <section className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="商品名・型番を入力して追加"
            autoComplete="off"
            className="flex-1 h-11 px-3 rounded-lg bg-surface-2 border border-border text-foreground placeholder:text-muted text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={add}
            disabled={!keyword.trim()}
            aria-label="追加"
            className="tap-scale shrink-0 w-11 h-11 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={pasteFromClipboard}
            className="tap-scale flex-1 h-9 rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface-2 text-xs flex items-center justify-center gap-1.5"
          >
            <ClipboardPaste size={13} />
            貼り付け
          </button>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="tap-scale flex-1 h-9 rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface-2 text-xs flex items-center justify-center gap-1.5"
          >
            <Sparkles size={13} />
            一括入力
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setSettingsOpen(!settingsOpen)}
        className="tap-scale w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-surface-2 border-t border-border hover:bg-surface-2/80"
      >
        <div className="flex items-center gap-2 min-w-0">
          <SlidersHorizontal size={13} className="text-muted shrink-0" />
          <span className="text-[11px] text-muted shrink-0">条件:</span>
          <span className="text-xs text-foreground truncate">{summary}</span>
        </div>
        {settingsOpen ? (
          <ChevronUp size={14} className="text-muted shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-muted shrink-0" />
        )}
      </button>

      {settingsOpen && (
        <div className="p-3 border-t border-border flex flex-col gap-3 bg-surface-2/40">
          {/* 媒体 */}
          <div>
            <div className="text-[10px] text-muted mb-1.5">媒体</div>
            <div className="grid grid-cols-3 gap-2">
              {SOURCES.map((s) => {
                const selected = defaults.sources.includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleSource(s.key)}
                    className={
                      selected
                        ? "tap-scale h-10 rounded-lg border-2 bg-surface text-xs font-semibold flex items-center justify-center gap-1"
                        : "tap-scale h-10 rounded-lg border border-border bg-surface text-foreground text-xs hover:border-foreground/30 flex items-center justify-center gap-1"
                    }
                    style={
                      selected
                        ? {
                            borderColor: s.color,
                            color: s.color,
                            backgroundColor: `${s.color}10`,
                          }
                        : undefined
                    }
                  >
                    <PlatformLogo source={s.key} size={14} />
                    {s.shortName}
                    {selected && <Check size={11} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 期間 */}
          <div>
            <div className="text-[10px] text-muted mb-1.5">期間</div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { v: "30", label: "直近30日" },
                  { v: "90", label: "直近90日" },
                  { v: "all", label: "全期間" },
                ] as { v: Period; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => updateDefaults({ period: opt.v })}
                  className={
                    defaults.period === opt.v
                      ? "tap-scale h-10 rounded-lg border-2 border-primary bg-primary/5 text-primary text-xs font-semibold"
                      : "tap-scale h-10 rounded-lg border border-border bg-surface text-foreground text-xs hover:border-foreground/30"
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 状態 */}
          <div>
            <div className="text-[10px] text-muted mb-1.5">
              状態（未選択 = 全て）
            </div>
            <div className="grid grid-cols-5 gap-2">
              {CONDITION_RANKS.map((r) => {
                const meta = CONDITION_META[r];
                const selected = defaults.conditions.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleCondition(r)}
                    title={meta.description}
                    className={
                      selected
                        ? "tap-scale h-10 rounded-lg border-2 bg-surface text-sm font-bold"
                        : "tap-scale h-10 rounded-lg border border-border bg-surface text-muted text-sm font-bold hover:border-foreground/30"
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

          {/* 送料 */}
          <div>
            <div className="text-[10px] text-muted mb-1.5">送料</div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { v: "any", label: "指定なし" },
                  { v: "free", label: "送料無料" },
                  { v: "paid", label: "送料別" },
                ] as { v: ShippingFilter; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => updateDefaults({ shipping: opt.v })}
                  className={
                    defaults.shipping === opt.v
                      ? "tap-scale h-10 rounded-lg border-2 border-primary bg-primary/5 text-primary text-xs font-semibold"
                      : "tap-scale h-10 rounded-lg border border-border bg-surface text-foreground text-xs hover:border-foreground/30"
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 除外ワード */}
          <div>
            <div className="text-[10px] text-muted mb-1.5">
              除外ワード（スペース区切り）
            </div>
            <input
              type="text"
              value={defaults.excludes ?? ""}
              onChange={(e) => updateDefaults({ excludes: e.target.value })}
              placeholder="例: ジャンク 部品"
              className="w-full h-10 px-3 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <p className="text-[10px] text-muted leading-relaxed mt-1">
            ※ 検索条件はリスト共通で保存され、次回追加時にも引き継がれます。
          </p>
        </div>
      )}

      {bulkOpen && <BulkAddModal onClose={() => setBulkOpen(false)} />}
    </section>
  );
}
