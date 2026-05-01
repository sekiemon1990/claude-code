import { NextResponse } from "next/server";
import { scrapeJimotyItem } from "@/lib/scrapers/jimoty-item";

export const runtime = "nodejs";
export const maxDuration = 30;

type RequestBody = {
  url: string;
};

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.url || !body.url.trim()) {
    return NextResponse.json({ error: "url は必須です" }, { status: 400 });
  }
  // Jimoty 以外の URL を弾く (SSRF 対策)
  if (!/^https:\/\/jmty\.jp\//.test(body.url)) {
    return NextResponse.json(
      { error: "ジモティーの URL ではありません" },
      { status: 400 },
    );
  }

  try {
    const detail = await scrapeJimotyItem(body.url.trim());
    return NextResponse.json({ detail });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "商品詳細取得に失敗しました";
    console.error("[scrape/jimoty-item] error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
