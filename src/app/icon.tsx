import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 280,
          fontWeight: 900,
          letterSpacing: "-0.08em",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          position: "relative",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "translateY(-12px)",
          }}
        >
          M
        </span>
        <span
          style={{
            position: "absolute",
            bottom: 70,
            right: 70,
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 60,
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
