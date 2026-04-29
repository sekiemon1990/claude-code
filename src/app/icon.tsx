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
          fontSize: 320,
          fontWeight: 900,
          letterSpacing: "-0.05em",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        M
      </div>
    ),
    { ...size }
  );
}
