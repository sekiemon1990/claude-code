import { CONDITION_META, type ConditionRank } from "@/lib/conditions";

type Props = {
  rank: ConditionRank;
  size?: "sm" | "md";
  showDescription?: boolean;
};

export function ConditionBadge({ rank, size = "sm", showDescription }: Props) {
  const meta = CONDITION_META[rank];
  return (
    <span
      className={
        size === "sm"
          ? "inline-flex items-center gap-1 rounded text-[10px] font-bold leading-none"
          : "inline-flex items-center gap-1 rounded text-xs font-bold leading-none"
      }
      style={{ color: meta.color }}
    >
      <span
        className={
          size === "sm"
            ? "inline-flex items-center justify-center w-4 h-4 rounded text-white text-[9px] font-black"
            : "inline-flex items-center justify-center w-5 h-5 rounded text-white text-[10px] font-black"
        }
        style={{ backgroundColor: meta.color }}
      >
        {meta.label}
      </span>
      {showDescription && (
        <span className="font-medium" style={{ color: "var(--muted)" }}>
          {meta.description}
        </span>
      )}
    </span>
  );
}
