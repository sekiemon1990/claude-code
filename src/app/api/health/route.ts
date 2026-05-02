import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * 軽量ヘルスチェック。
 * 監視サービス (UptimeRobot 等) から定期 GET して死活確認に使う。
 *
 * 詳細チェック (Supabase / Anthropic 接続性) はコストがかかるため
 * 別エンドポイントに分けるのが望ましい。
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "makxas-search",
    time: new Date().toISOString(),
  });
}
