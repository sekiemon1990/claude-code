import { NextResponse } from "next/server";
import { validateEnvOnStartup } from "@/lib/env";

export const runtime = "nodejs";

/**
 * 軽量ヘルスチェック + env チェック。
 * 監視サービス (UptimeRobot 等) から定期 GET して死活確認に使う。
 *
 * 詳細チェック (Supabase / Anthropic 接続性) はコストがかかるため
 * 別エンドポイントに分けるのが望ましい。
 */
export async function GET() {
  const env = validateEnvOnStartup();
  return NextResponse.json(
    {
      status: env.ok ? "ok" : "degraded",
      service: "makxas-search",
      time: new Date().toISOString(),
      envOk: env.ok,
      ...(env.missing.length > 0 && { missingEnv: env.missing }),
    },
    { status: env.ok ? 200 : 503 },
  );
}
