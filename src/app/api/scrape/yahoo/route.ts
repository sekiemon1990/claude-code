import { NextResponse } from "next/server";
import { scrapeYahooAuction } from "@/lib/scrapers/yahoo";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

type RequestBody = {
  keyword: string;
  excludes?: string;
  limit?: number;
  status?: "sold" | "active";
};

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "scrape:yahoo", 30);
  if (limited) return limited;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.keyword || !body.keyword.trim()) {
    return NextResponse.json(
      { error: "keyword は必須です" },
      { status: 400 },
    );
  }

  try {
    const result = await scrapeYahooAuction({
      keyword: body.keyword.trim(),
      excludes: body.excludes,
      limit: body.limit ?? 30,
      status: body.status,
    });
    return NextResponse.json({ result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ヤフオク取得に失敗しました";
    console.error("[scrape/yahoo] error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
