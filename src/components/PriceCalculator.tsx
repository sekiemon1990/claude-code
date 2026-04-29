"use client";

import { useState } from "react";
import { Calculator, Plus, Trash2 } from "lucide-react";

type Mode = "single" | "multi";

const RATE_PRESETS = [50, 60, 70, 80];

type Props = {
  defaultBase?: number;
};

export function PriceCalculator({ defaultBase }: Props) {
  const [mode, setMode] = useState<Mode>("single");
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-surface border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calculator size={16} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">
            買取額計算機
          </span>
        </div>
        <span className="text-xs text-muted">
          {open ? "閉じる" : "開く"}
        </span>
      </button>

      {open && (
        <div className="p-4 pt-0">
          <div className="grid grid-cols-2 bg-surface-2 rounded-lg p-1 gap-1 mb-3">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={
                mode === "single"
                  ? "h-8 rounded-md text-xs font-semibold bg-surface text-foreground shadow-sm"
                  : "h-8 rounded-md text-xs font-medium text-muted"
              }
            >
              単品
            </button>
            <button
              type="button"
              onClick={() => setMode("multi")}
              className={
                mode === "multi"
                  ? "h-8 rounded-md text-xs font-semibold bg-surface text-foreground shadow-sm"
                  : "h-8 rounded-md text-xs font-medium text-muted"
              }
            >
              複数商品
            </button>
          </div>
          {mode === "single" ? (
            <SingleCalc defaultBase={defaultBase} />
          ) : (
            <MultiCalc />
          )}
        </div>
      )}
    </section>
  );
}

function SingleCalc({ defaultBase }: { defaultBase?: number }) {
  const [base, setBase] = useState(defaultBase ?? 0);
  const [rate, setRate] = useState(70);

  const result = Math.round((base * rate) / 100);
  const profit = base - result;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted">基準価格（相場）</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground">¥</span>
          <input
            type="number"
            inputMode="numeric"
            value={base || ""}
            onChange={(e) => setBase(Number(e.target.value) || 0)}
            placeholder="0"
            className="flex-1 h-10 px-3 rounded-lg bg-surface-2 border border-border text-foreground text-base font-semibold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted">買取率</label>
          <span className="text-base font-bold text-primary">{rate}%</span>
        </div>
        <input
          type="range"
          min={20}
          max={95}
          step={1}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex gap-1.5">
          {RATE_PRESETS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRate(r)}
              className={
                rate === r
                  ? "flex-1 h-7 rounded text-xs font-bold border-2 border-primary text-primary bg-primary/5"
                  : "flex-1 h-7 rounded text-xs font-medium border border-border text-foreground bg-surface hover:border-foreground/30"
              }
            >
              {r}%
            </button>
          ))}
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">買取目安</span>
          <span className="text-xl font-bold text-primary">
            ¥{result.toLocaleString("ja-JP")}
          </span>
        </div>
        {base > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted">想定利益（販売時）</span>
            <span className="text-xs font-semibold text-success">
              ¥{profit.toLocaleString("ja-JP")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

type MultiItem = { id: number; price: number };

function MultiCalc() {
  const [items, setItems] = useState<MultiItem[]>([
    { id: 1, price: 0 },
    { id: 2, price: 0 },
  ]);
  const [rate, setRate] = useState(70);
  const [nextId, setNextId] = useState(3);

  const total = items.reduce((s, i) => s + i.price, 0);
  const result = Math.round((total * rate) / 100);

  function add() {
    setItems([...items, { id: nextId, price: 0 }]);
    setNextId(nextId + 1);
  }

  function remove(id: number) {
    if (items.length <= 1) return;
    setItems(items.filter((i) => i.id !== id));
  }

  function update(id: number, price: number) {
    setItems(items.map((i) => (i.id === id ? { ...i, price } : i)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {items.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-2">
            <span className="text-xs text-muted w-6">#{idx + 1}</span>
            <span className="text-sm text-foreground">¥</span>
            <input
              type="number"
              inputMode="numeric"
              value={item.price || ""}
              onChange={(e) => update(item.id, Number(e.target.value) || 0)}
              placeholder="0"
              className="flex-1 h-9 px-3 rounded-lg bg-surface-2 border border-border text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => remove(item.id)}
              disabled={items.length <= 1}
              aria-label="削除"
              className="w-8 h-8 rounded-md text-muted hover:bg-surface-2 disabled:opacity-30 flex items-center justify-center"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="h-9 rounded-lg border border-dashed border-border text-xs text-muted hover:border-primary hover:text-primary flex items-center justify-center gap-1"
        >
          <Plus size={14} />
          商品を追加
        </button>
      </div>

      <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
        <span className="text-muted">合計（相場）</span>
        <span className="font-bold text-foreground">
          ¥{total.toLocaleString("ja-JP")}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted">買取率</label>
          <span className="text-base font-bold text-primary">{rate}%</span>
        </div>
        <input
          type="range"
          min={20}
          max={95}
          step={1}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex gap-1.5">
          {RATE_PRESETS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRate(r)}
              className={
                rate === r
                  ? "flex-1 h-7 rounded text-xs font-bold border-2 border-primary text-primary bg-primary/5"
                  : "flex-1 h-7 rounded text-xs font-medium border border-border text-foreground bg-surface hover:border-foreground/30"
              }
            >
              {r}%
            </button>
          ))}
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
        <span className="text-xs text-muted">合計買取目安</span>
        <span className="text-xl font-bold text-primary">
          ¥{result.toLocaleString("ja-JP")}
        </span>
      </div>
    </div>
  );
}
