import { SOURCES, type SourceKey } from "@/lib/types";
import { PlatformLogo } from "./PlatformLogo";

export function SourceBadge({ source }: { source: SourceKey }) {
  const meta = SOURCES.find((s) => s.key === source)!;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-xs font-medium"
      style={{
        backgroundColor: `${meta.color}14`,
        color: meta.color,
      }}
    >
      <PlatformLogo source={source} size={14} />
      {meta.name}
    </span>
  );
}
