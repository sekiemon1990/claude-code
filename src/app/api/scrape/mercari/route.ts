import { NextResponse } from "next/server";
import { scrapeMercari } from "@/lib/scrapers/mercari";

export const runtime = "nodejs";
export const maxDuration = 60;

type RequestBody = {
  keyword: string;
  excludes?: string;
  limit?: number;
};

export async function POST(req: Request) {
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
    const result = await scrapeMercari({
      keyword: body.keyword.trim(),
      excludes: body.excludes,
      limit: body.limit ?? 30,
    });
    return NextResponse.json({ result });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "メルカリ取得に失敗しました";
    console.error("[scrape/mercari] error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
