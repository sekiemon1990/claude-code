import { NextResponse } from "next/server";

/**
 * シンプルな in-memory レートリミッタ。
 *
 * - Vercel Function (Lambda) インスタンス毎の状態保持。
 *   分散環境では完全な保護にならないが、burst 対策には十分。
 * - 1 ウィンドウ (60s) で limit 回まで許可。
 *
 * 本格運用で精緻化したい場合は Upstash Redis や Vercel KV へ移行する。
 */

type Bucket = {
  count: number;
  resetAt: number; // epoch ms
};

const BUCKETS = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

// メモリリーク防止: バケットが膨れすぎたら古いものから掃除
const MAX_BUCKETS = 5_000;

function gc(now: number) {
  if (BUCKETS.size < MAX_BUCKETS) return;
  for (const [k, v] of BUCKETS) {
    if (v.resetAt < now) BUCKETS.delete(k);
  }
}

export type RateCheckResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function checkRateLimit(key: string, limit: number): RateCheckResult {
  const now = Date.now();
  gc(now);
  const existing = BUCKETS.get(key);

  if (!existing || existing.resetAt < now) {
    BUCKETS.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count++;
  return {
    ok: true,
    remaining: limit - existing.count,
    retryAfterSec: 0,
  };
}

export function clientIpFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/**
 * /api/* ルートで使うヘルパ。limit 超過時は 429 NextResponse を返す。
 *
 * 使い方:
 *   const limited = enforceRateLimit(req, "scrape", 30);
 *   if (limited) return limited;
 */
export function enforceRateLimit(
  req: Request,
  bucket: string,
  limit: number,
): NextResponse | null {
  const ip = clientIpFromRequest(req);
  const key = `${bucket}:${ip}`;
  const result = checkRateLimit(key, limit);
  if (result.ok) return null;
  return NextResponse.json(
    {
      error:
        "リクエストが多すぎます。しばらく時間を置いてから再度お試しください",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Bucket": bucket,
      },
    },
  );
}
