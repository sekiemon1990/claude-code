import * as cheerio from "cheerio";
import type { Listing, SourceResult } from "@/lib/types";

/**
 * Yahoo オークション 落札相場 (closedsearch) スクレイパ
 *
 * URL: https://auctions.yahoo.co.jp/closedsearch/closedsearch?p=KEYWORD&va=KEYWORD&b=1&n=50
 *
 * 落札済み商品の HTML を取得して、商品カードをパースする。
 */

const YAHOO_BASE = "https://auctions.yahoo.co.jp/closedsearch/closedsearch";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

export type YahooScrapeOptions = {
  keyword: string;
  excludes?: string;
  limit?: number;
};

export async function scrapeYahooAuction(
  options: YahooScrapeOptions,
): Promise<SourceResult> {
  const { keyword, excludes, limit = 50 } = options;

  const url = new URL(YAHOO_BASE);
  url.searchParams.set("p", keyword);
  url.searchParams.set("va", keyword);
  url.searchParams.set("b", "1");
  url.searchParams.set("n", String(Math.min(limit, 100)));
  if (excludes && excludes.trim()) {
    url.searchParams.set("exflg", "1");
    url.searchParams.set("nq", excludes.trim());
  }

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Yahoo オークション応答エラー: ${res.status}`);
  }

  const html = await res.text();
  const listings = parseYahooHtml(html);

  return summarize("yahoo_auction", listings);
}

function parseYahooHtml(html: string): Listing[] {
  const $ = cheerio.load(html);
  const listings: Listing[] = [];

  // 商品リスト: 各商品は li.Product 要素として並ぶ
  $("li.Product, .Product").each((_, el) => {
    const $el = $(el);

    const titleEl = $el.find(".Product__titleLink, .Product__title a").first();
    const title = titleEl.text().trim();
    const url = titleEl.attr("href") ?? "";
    if (!title || !url) return;

    // 価格: ¥1,234 形式の文字列をパース
    const priceText = $el
      .find(".Product__priceValue, .Product__price")
      .first()
      .text()
      .replace(/[^\d]/g, "");
    const price = priceText ? Number(priceText) : 0;
    if (!price) return;

    // 商品 ID: URL の末尾から抽出
    const idMatch = url.match(/\/([a-z]\d+)(?:\?|$)/i);
    const id = idMatch ? idMatch[1] : url.split("/").pop() ?? "";

    // 終了日時
    const endedText = $el
      .find(".Product__time, .Product__endedAt")
      .first()
      .text()
      .trim();
    const endedAt = parseYahooDate(endedText);

    // サムネイル
    const thumbnail =
      $el.find(".Product__imageData, .Product__image img").first().attr("src") ??
      $el.find("img").first().attr("src") ??
      undefined;

    // 入札数
    const bidText = $el
      .find(".Product__bid, .Product__bidCount")
      .first()
      .text()
      .replace(/[^\d]/g, "");
    const bidCount = bidText ? Number(bidText) : undefined;

    listings.push({
      id,
      title,
      price,
      endedAt,
      thumbnail,
      url,
      bidCount,
    });
  });

  return listings;
}

function parseYahooDate(text: string): string {
  // "11/30 22:30" や "2025年11月30日 22:30" 等の表記を ISO 文字列に変換
  // タイムゾーンは JST 想定
  const yearMatch = text.match(/(\d{4})年?[\/\-](\d{1,2})月?[\/\-](\d{1,2})日?(?:\s+(\d{1,2}):(\d{1,2}))?/);
  const shortMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);

  let year: number;
  let month: number;
  let day: number;
  let hour = 0;
  let minute = 0;

  if (yearMatch) {
    year = Number(yearMatch[1]);
    month = Number(yearMatch[2]);
    day = Number(yearMatch[3]);
    if (yearMatch[4]) hour = Number(yearMatch[4]);
    if (yearMatch[5]) minute = Number(yearMatch[5]);
  } else if (shortMatch) {
    const now = new Date();
    year = now.getUTCFullYear();
    month = Number(shortMatch[1]);
    day = Number(shortMatch[2]);
    if (shortMatch[3]) hour = Number(shortMatch[3]);
    if (shortMatch[4]) minute = Number(shortMatch[4]);
  } else {
    return new Date().toISOString();
  }

  // JST → UTC へ変換
  const jstMs = Date.UTC(year, month - 1, day, hour, minute) - 9 * 60 * 60 * 1000;
  return new Date(jstMs).toISOString();
}

function summarize(
  source: SourceResult["source"],
  listings: Listing[],
): SourceResult {
  const prices = listings.map((l) => l.price).sort((a, b) => a - b);
  const count = listings.length;
  if (count === 0) {
    return { source, count: 0, median: 0, min: 0, max: 0, listings: [] };
  }
  const median =
    count % 2 === 1
      ? prices[Math.floor(count / 2)]
      : Math.round((prices[count / 2 - 1] + prices[count / 2]) / 2);
  const min = prices[0];
  const max = prices[count - 1];
  return { source, count, median, min, max, listings };
}
