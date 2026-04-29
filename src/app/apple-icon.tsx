import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1f6feb 0%, #0ea5e9 100%)",
          color: "white",
          fontSize: 100,
          fontWeight: 900,
          letterSpacing: "-0.08em",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          position: "relative",
        }}
      >
        <span
          style={{
            display: "flex",
            transform: "translateY(-4px)",
          }}
        >
          M
        </span>
        <span
          style={{
            position: "absolute",
            bottom: 25,
            right: 25,
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 900,
          }}
        >
          ¥
        </span>
      </div>
    ),
    { ...size }
  );
}
