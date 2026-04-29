import { SOURCES, type SourceKey } from "@/lib/types";

export function SourceBadge({ source }: { source: SourceKey }) {
  const meta = SOURCES.find((s) => s.key === source)!;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${meta.color}1a`,
        color: meta.color,
      }}
    >
      <span
        aria-hidden
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {meta.name}
    </span>
  );
}
