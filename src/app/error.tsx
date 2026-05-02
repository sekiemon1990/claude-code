"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

/**
 * 予期しないエラーが発生した時の画面 (Next.js App Router の error.tsx 規約)
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 本番ではエラー監視 (Sentry 等) に通知する箇所
    console.error("[error.tsx]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-surface border border-border rounded-xl p-6 flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center">
          <AlertTriangle size={24} />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground mb-1">
            エラーが発生しました
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            一時的な問題の可能性があります。再試行するか、ホームに戻ってください。
          </p>
        </div>
        {error.digest && (
          <p className="text-[10px] text-muted font-mono">
            error: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <button
            type="button"
            onClick={reset}
            className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 inline-flex items-center justify-center gap-1.5"
          >
            <RefreshCw size={14} />
            再試行
          </button>
          <Link
            href="/search"
            className="flex-1 h-11 rounded-lg border border-border text-foreground text-sm hover:bg-surface-2 inline-flex items-center justify-center gap-1.5"
          >
            <Home size={14} />
            ホームへ
          </Link>
        </div>
      </div>
    </div>
  );
}
