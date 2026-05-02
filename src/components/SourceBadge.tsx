import { SOURCES, type SourceKey } from "@/lib/types";
import { PlatformLogo } from "./PlatformLogo";

export function SourceBadge({
  source,
  className,
  variant = "default",
}: {
  source: SourceKey;
  className?: string;
  /** "default": 通常 (薄い背景 + フルネーム) / "overlay": サムネ画像被せ用 (濃い背景 + 短縮名) */
  variant?: "default" | "overlay";
}) {
  const meta = SOURCES.find((s) => s.key === source)!;

  if (variant === "overlay") {
    return (
      <span
        className={
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium shadow-sm backdrop-blur-sm" +
          (className ? ` ${className}` : "")
        }
        style={{
          backgroundColor: `${meta.color}EA`,
          color: "#fff",
        }}
      >
        <PlatformLogo source={source} size={11} />
        {meta.shortName}
      </span>
    );
  }

  return (
    <span
      className={
        "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-xs font-medium" +
        (className ? ` ${className}` : "")
      }
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
