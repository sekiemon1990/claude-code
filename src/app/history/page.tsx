import Link from "next/link";
import { ChevronRight, Search as SearchIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MOCK_HISTORY } from "@/lib/mock-data";
import { formatYen, formatCount, formatRelativeDate } from "@/lib/utils";

export default function HistoryPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <section>
          <h2 className="text-xl font-bold text-foreground">検索履歴</h2>
          <p className="text-sm text-muted mt-1">
            過去の検索結果（直近順）
          </p>
        </section>

        <Link
          href="/search"
          className="flex items-center gap-2 h-12 rounded-lg bg-surface border border-border hover:border-primary/40 px-4 text-foreground"
        >
          <SearchIcon size={18} className="text-muted" />
          <span className="text-sm">新しい検索を開始</span>
        </Link>

        <div className="flex flex-col gap-2">
          {MOCK_HISTORY.map((h) => (
            <Link
              key={h.id}
              href={`/search/result/${h.id}`}
              className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 active:bg-surface-2 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground line-clamp-1">
                  {h.keyword}
                </p>
                {h.model && (
                  <p className="text-xs text-muted line-clamp-1 mt-0.5">
                    {h.model}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-base font-bold text-foreground">
                    {formatYen(h.median)}
                  </span>
                  <span className="text-xs text-muted">中央値</span>
                  <span className="text-xs text-muted">・</span>
                  <span className="text-xs text-muted">
                    {formatCount(h.totalCount)}
                  </span>
                </div>
                <div className="text-xs text-muted mt-1">
                  {formatRelativeDate(h.searchedAt)}
                </div>
              </div>
              <ChevronRight size={18} className="text-muted shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
