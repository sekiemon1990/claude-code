import { notFound } from "next/navigation";
import { ExternalLink, Gavel } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SourceBadge } from "@/components/SourceBadge";
import { MOCK_RESULT } from "@/lib/mock-data";
import { formatYen, formatCount, formatRelativeDate } from "@/lib/utils";
import { SOURCES, type SourceKey } from "@/lib/types";

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string; source: string }>;
}) {
  const { id, source } = await params;
  const sourceKey = source as SourceKey;
  const meta = SOURCES.find((s) => s.key === sourceKey);
  if (!meta) notFound();

  const result = MOCK_RESULT;
  const data = result.sources.find((s) => s.source === sourceKey);
  if (!data) notFound();

  return (
    <AppShell
      back={{ href: `/search/result/${id}`, label: "結果" }}
      title={meta.name}
    >
      <div className="flex flex-col gap-4">
        <section className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <SourceBadge source={sourceKey} />
            <span className="text-xs text-muted">
              {meta.status} {formatCount(data.count)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="最低" value={formatYen(data.min)} />
            <Stat label="中央値" value={formatYen(data.median)} highlight />
            <Stat label="最高" value={formatYen(data.max)} />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2 px-1">
            {meta.status}データ ({formatCount(data.listings.length)})
          </h3>
          <div className="flex flex-col gap-2">
            {data.listings.map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-surface border border-border rounded-xl p-3 hover:border-primary/40 active:bg-surface-2 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                      {l.title}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-lg font-bold text-foreground">
                        {formatYen(l.price)}
                      </span>
                      {l.bidCount !== undefined && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted">
                          <Gavel size={12} />
                          {l.bidCount}件
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted">
                      {l.condition && <span>{l.condition}</span>}
                      {l.condition && <span>・</span>}
                      <span>{formatRelativeDate(l.endedAt)}</span>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-muted shrink-0 mt-1" />
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex flex-col items-center"
          : "bg-surface-2 rounded-lg p-2.5 flex flex-col items-center"
      }
    >
      <span
        className={
          highlight ? "text-xs text-primary font-medium" : "text-xs text-muted"
        }
      >
        {label}
      </span>
      <span
        className={
          highlight
            ? "text-sm font-bold text-primary mt-0.5"
            : "text-sm font-bold text-foreground mt-0.5"
        }
      >
        {value}
      </span>
    </div>
  );
}
