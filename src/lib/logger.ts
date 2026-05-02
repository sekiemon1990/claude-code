/**
 * 軽量ロガー。
 *
 * - 本番では info ログを抑制し warn / error のみ出力 (ノイズ削減)
 * - DEBUG=1 環境変数で本番でも info を有効化
 * - 開発 (NODE_ENV !== "production") では全レベル出力
 *
 * 使い方:
 *   import { createLogger } from "@/lib/logger";
 *   const log = createLogger("yahoo-scrape");
 *   log.info("status:", res.status);
 *   log.warn("...");
 *   log.error("...");
 */

const IS_DEV = process.env.NODE_ENV !== "production";
const DEBUG_ENABLED = process.env.DEBUG === "1" || process.env.DEBUG === "true";
const VERBOSE = IS_DEV || DEBUG_ENABLED;

export type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export function createLogger(scope: string): Logger {
  const prefix = `[${scope}]`;
  return {
    info: (...args: unknown[]) => {
      if (!VERBOSE) return;
      console.log(prefix, ...args);
    },
    warn: (...args: unknown[]) => {
      console.warn(prefix, ...args);
    },
    error: (...args: unknown[]) => {
      console.error(prefix, ...args);
    },
  };
}
