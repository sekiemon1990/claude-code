import type { SourceKey } from "@/lib/types";

type Props = {
  source: SourceKey;
  size?: number;
  className?: string;
};

export function PlatformLogo({ source, size = 18, className }: Props) {
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-hidden
    >
      {source === "yahoo_auction" && <YahooAuctionLogo size={size} />}
      {source === "mercari" && <MercariLogo size={size} />}
      {source === "jimoty" && <JimotyLogo size={size} />}
    </span>
  );
}

function YahooAuctionLogo({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="6" fill="#FF0033" />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"
        fontSize="18"
        fontWeight="900"
        fill="#FFFFFF"
        letterSpacing="-1"
      >
        Y!
      </text>
    </svg>
  );
}

function MercariLogo({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="6" fill="#FF0211" />
      <text
        x="16"
        y="23"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"
        fontSize="22"
        fontWeight="700"
        fill="#FFFFFF"
        fontStyle="italic"
      >
        m
      </text>
    </svg>
  );
}

function JimotyLogo({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="6" fill="#1AA55C" />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fontFamily="-apple-system, 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif"
        fontSize="16"
        fontWeight="900"
        fill="#FFFFFF"
      >
        ジ
      </text>
    </svg>
  );
}

export function PlatformWordmark({
  source,
  className,
}: {
  source: SourceKey;
  className?: string;
}) {
  return (
    <span className={className} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <PlatformLogo source={source} size={16} />
      <span>
        {source === "yahoo_auction" && "ヤフオク"}
        {source === "mercari" && "メルカリ"}
        {source === "jimoty" && "ジモティー"}
      </span>
    </span>
  );
}
