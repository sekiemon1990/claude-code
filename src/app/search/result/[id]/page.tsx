import Link from "next/link";
import { ChevronRight, BarChart3, Sparkles, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SourceBadge } from "@/components/SourceBadge";
import { MOCK_RESULT } from "@/lib/mock-data";
import { formatYen, formatCount } from "@/lib/utils";
import { SOURCES } from "@/lib/types";

export default function SearchResultPage() {
  const result = MOCK_RESULT;

  return (
    <AppShell back={{ href: "/search", label: "検索" }} title="検索結果">
      <div className="flex flex-col gap-4">
        <section className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-start gap-2 mb-2">
            <Sparkles size={16} className="text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted">商品の特定結果</div>
          </div>
          <h2 className="text-base font-bold text-foreground">
            {result.productGuess}
          </h2>
          <div className="text-xs text-muted mt-1">
            検索: {result.query.keyword}
            {result.query.model && ` / ${result.query.model}`}
            {" ・ "}
            直近{result.query.period === "all" ? "全期間" : `${result.query.period}日`}
          </div>
        </section>

        <section className="bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3 opacity-90">
            <BarChart3 size={16} />
            <span className="text-xs font-medium">全ソース統合サマリー</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">
              {formatYen(result.summary.median)}
            </span>
            <span className="text-sm opacity-90">中央値</span>
          </div>
          <div className="mt-2 text-sm opacity-90">
            {formatYen(result.summary.min)} 〜 {formatYen(result.summary.max)}
            <span className="ml-2 text-xs">
              ({formatCount(result.summary.totalCount)})
            </span>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2 px-1">
            ソース別の結果
          </h3>
          <div className="flex flex-col gap-2">
            {result.sources.map((s) => {
              const meta = SOURCES.find((x) => x.key === s.source)!;
              return (
                <Link
                  key={s.source}
                  href={`/search/result/${result.id}/${s.source}`}
                  className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 active:bg-surface-2 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <SourceBadge source={s.source} />
                      <span className="text-xs text-muted">
                        {meta.status} {formatCount(s.count)}
                      </span>
                    </div>
                    <div className="text-xl font-bold text-foreground">
                      {formatYen(s.median)}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {formatYen(s.min)} 〜 {formatYen(s.max)}
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-muted shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            className="h-12 rounded-lg border border-border bg-surface text-foreground font-medium text-sm flex items-center justify-center gap-2 hover:border-foreground/30"
          >
            <RefreshCw size={16} />
            再検索
          </button>
          <button
            type="button"
            className="h-12 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90"
          >
            履歴に保存
          </button>
        </section>

        <section className="bg-surface-2 rounded-xl p-3 mt-2">
          <p className="text-xs text-muted leading-relaxed">
            ※ 表示価格は各ソースから取得した直近の{" "}
            {result.query.period === "all" ? "全期間" : `${result.query.period}日`}
            のデータです。市場相場の参考としてご利用ください。
          </p>
        </section>
      </div>
    </AppShell>
  );
}
