"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, ListChecks, ChevronRight } from "lucide-react";
import { useActiveList } from "@/lib/list";
import { formatYen } from "@/lib/utils";

export function ListBar() {
  const list = useActiveList();
  const pathname = usePathname();

  // 査定リスト画面では出さない
  if (pathname?.startsWith("/list")) return null;
  if (list.items.length === 0) return null;

  const running = list.items.filter(
    (i) => i.status === "running" || i.status === "queued"
  ).length;
  const completed = list.items.filter((i) => i.status === "completed");
  const total = completed.reduce(
    (s, i) => s + (i.result?.suggestedBuyPrice ?? 0),
    0
  );

  return (
    <Link
      href="/list"
      className="sticky top-14 z-20 -mb-px bg-primary/10 border-y border-primary/20 backdrop-blur"
    >
      <div className="mx-auto max-w-md w-full px-4 py-2 flex items-center gap-2">
        <ListChecks size={14} className="text-primary shrink-0" />
        <span className="text-xs font-semibold text-primary shrink-0">
          査定リスト
        </span>
        <span className="text-xs text-foreground shrink-0">
          {list.items.length}件
        </span>
        {running > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-primary shrink-0">
            <Loader2 size={11} className="animate-spin" />
            {running}
          </span>
        )}
        {completed.length > 0 && (
          <span className="text-xs text-foreground ml-auto shrink-0 tabular-nums">
            合計 {formatYen(total)}
          </span>
        )}
        <ChevronRight size={14} className="text-primary shrink-0" />
      </div>
    </Link>
  );
}
