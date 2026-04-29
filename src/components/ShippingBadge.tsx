import type { ShippingType } from "@/lib/types";

type Props = {
  shipping?: ShippingType;
  size?: "sm" | "md";
};

const META: Record<
  ShippingType,
  { label: string; color: string; background: string }
> = {
  free: {
    label: "送料無料",
    color: "#16a34a",
    background: "rgba(22, 163, 74, 0.1)",
  },
  paid: {
    label: "送料別",
    color: "#f59e0b",
    background: "rgba(245, 158, 11, 0.12)",
  },
  pickup: {
    label: "引き取り",
    color: "#6b7280",
    background: "rgba(107, 114, 128, 0.12)",
  },
};

export function ShippingBadge({ shipping, size = "sm" }: Props) {
  if (!shipping) return null;
  const meta = META[shipping];
  return (
    <span
      className={
        size === "sm"
          ? "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none"
          : "inline-flex items-center px-2 py-1 rounded text-xs font-bold leading-none"
      }
      style={{
        color: meta.color,
        backgroundColor: meta.background,
      }}
    >
      {meta.label}
    </span>
  );
}

export const SHIPPING_LABELS: Record<ShippingType, string> = {
  free: "送料無料",
  paid: "送料別",
  pickup: "引き取り",
};
