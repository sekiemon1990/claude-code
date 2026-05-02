"use client";

import { useEffect } from "react";

/**
 * Root layout 自体がエラーした時の最終フォールバック
 * (この場合 layout.tsx が使えないので独自に html/body を用意する)
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="ja">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "2rem",
          maxWidth: "480px",
          margin: "4rem auto",
          color: "#1f2937",
        }}
      >
        <h1 style={{ fontSize: "18px", fontWeight: 700, marginBottom: 8 }}>
          重大なエラーが発生しました
        </h1>
        <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: 16 }}>
          ページを再読み込みしてください。問題が続く場合は時間を置いて再度お試しください。
        </p>
        {error.digest && (
          <p style={{ fontSize: "10px", color: "#9ca3af", fontFamily: "monospace" }}>
            error: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: 16,
            height: 44,
            padding: "0 16px",
            background: "#1f6feb",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          再試行
        </button>
      </body>
    </html>
  );
}
