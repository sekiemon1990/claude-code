"use client";

import { SOURCES, type SourceKey, type Listing } from "@/lib/types";
import { PlatformLogo } from "./PlatformLogo";
import { formatYen, formatYenShort } from "@/lib/utils";

type FlatListing = Listing & { source: SourceKey };

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

type Props = {
  listings: FlatListing[];
};

export function PlatformPriceBars({ listings }: Props) {
  const bySource = new Map<SourceKey, number[]>();
  for (const l of listings) {
    if (!bySource.has(l.source)) bySource.set(l.source, []);
    bySource.get(l.source)!.push(l.price);
  }

  const stats = Array.from(bySource.entries()).map(([source, prices]) => ({
    source,
    count: prices.length,
    median: median(prices),
    min: Math.min(...prices),
    max: Math.max(...prices),
  }));

  if (stats.length === 0) return null;

  const globalMax = Math.max(...stats.map((s) => s.max));
  if (globalMax === 0) return null;

  return (
    <section className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">媒体別の価格分布</h3>
        <span className="text-[10px] text-muted">中央値ベース</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {stats.map((s) => {
          const meta = SOURCES.find((x) => x.key === s.source)!;
          const widthPct = Math.round((s.median / globalMax) * 100);
          return (
            <div key={s.source} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <PlatformLogo source={s.source} size={14} />
                  <span className="text-foreground font-medium truncate">
                    {meta.shortName}
                  </span>
                  <span className="text-muted">({s.count})</span>
                </div>
                <span className="font-bold text-foreground tabular-nums shrink-0">
                  {formatYenShort(s.median)}
                </span>
              </div>
              <div className="relative h-5 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: meta.color,
                    opacity: 0.85,
                  }}
                />
                <div className="absolute inset-0 flex items-center px-2 gap-1.5 text-[10px] text-foreground/80 tabular-nums">
                  <span>最低 {formatYenShort(s.min)}</span>
                  <span className="ml-auto">最高 {formatYenShort(s.max)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {stats.length > 1 && (
        <div className="mt-3 pt-3 border-t border-border text-[11px] text-muted leading-relaxed">
          {(() => {
            const sorted = [...stats].sort((a, b) => b.median - a.median);
            const top = sorted[0];
            const bottom = sorted[sorted.length - 1];
            const meta1 = SOURCES.find((x) => x.key === top.source)!;
            const meta2 = SOURCES.find((x) => x.key === bottom.source)!;
            const diff = top.median - bottom.median;
            return `${meta1.shortName}が${meta2.shortName}より約${formatYen(diff)}高い相場です`;
          })()}
        </div>
      )}
    </section>
  );
}
