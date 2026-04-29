"use client";

import { useState } from "react";
import { Sparkles, Calculator, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { AiAdvisor } from "./AiAdvisor";
import { PriceCalculator } from "./PriceCalculator";
import type { Listing, SourceKey } from "@/lib/types";

type FlatListing = Listing & { source: SourceKey };

type Tab = "ai" | "calc" | "suggest";

type Props = {
  keyword: string;
  productGuess?: string;
  listings: FlatListing[];
  defaultBase?: number;
  suggestionsContent: React.ReactNode;
};

export function ToolsPanel({
  keyword,
  productGuess,
  listings,
  defaultBase,
  suggestionsContent,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("ai");

  return (
    <section className="bg-surface border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">
            査定ツール
          </span>
          <span className="text-[10px] text-muted">
            AI / 計算機 / 絞り込み提案
          </span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-muted" />
        ) : (
          <ChevronDown size={16} className="text-muted" />
        )}
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="grid grid-cols-3 gap-1 p-1 bg-surface-2">
            <TabButton
              active={tab === "ai"}
              onClick={() => setTab("ai")}
              icon={<Sparkles size={14} />}
              label="AI査定"
            />
            <TabButton
              active={tab === "calc"}
              onClick={() => setTab("calc")}
              icon={<Calculator size={14} />}
              label="計算機"
            />
            <TabButton
              active={tab === "suggest"}
              onClick={() => setTab("suggest")}
              icon={<Lightbulb size={14} />}
              label="提案"
            />
          </div>
          <div className="p-3">
            {tab === "ai" && (
              <AiAdvisor
                keyword={keyword}
                productGuess={productGuess}
                listings={listings}
              />
            )}
            {tab === "calc" && <PriceCalculator defaultBase={defaultBase} />}
            {tab === "suggest" && (suggestionsContent ?? <EmptySuggestions />)}
          </div>
        </div>
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "h-9 rounded-md text-xs font-semibold bg-surface text-foreground shadow-sm flex items-center justify-center gap-1.5"
          : "h-9 rounded-md text-xs font-medium text-muted hover:text-foreground flex items-center justify-center gap-1.5"
      }
    >
      {icon}
      {label}
    </button>
  );
}

function EmptySuggestions() {
  return (
    <div className="text-center py-6 text-sm text-muted">
      検索結果が少ないため、絞り込み候補がありません
    </div>
  );
}
