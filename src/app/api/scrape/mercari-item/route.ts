import { NextResponse } from "next/server";
import { scrapeMercariItem } from "@/lib/scrapers/mercari-item";

export const runtime = "nodejs";
export const maxDuration = 30;

type RequestBody = {
  id: string;
};

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id || !body.id.trim()) {
    return NextResponse.json({ error: "id は必須です" }, { status: 400 });
  }

  try {
    const detail = await scrapeMercariItem(body.id.trim());
    return NextResponse.json({ detail });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "商品詳細取得に失敗しました";
    console.error("[scrape/mercari-item] error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
