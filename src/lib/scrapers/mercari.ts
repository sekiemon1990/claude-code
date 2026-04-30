import * as cheerio from "cheerio";
import type { Listing, SourceResult } from "@/lib/types";

/**
 * メルカリ 売切検索スクレイパ
 *
 * URL: https://jp.mercari.com/search?keyword=KEYWORD&status=sold_out&order=desc&sort=created_time
 *
 * 戦略: __NEXT_DATA__ JSON 優先 → HTML フォールバック
 */

const MERCARI_BASE = "https://jp.mercari.com/search";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

export type MercariScrapeOptions = {
  keyword: string;
  excludes?: string;
  limit?: number;
};

export async function scrapeMercari(
  options: MercariScrapeOptions,
): Promise<SourceResult> {
  const { keyword, excludes } = options;

  const url = new URL(MERCARI_BASE);
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("status", "sold_out");
  url.searchParams.set("order", "desc");
  url.searchParams.set("sort", "created_time");
  if (excludes && excludes.trim()) {
    url.searchParams.set("exclude_keyword", excludes.trim());
  }

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });

  console.log(
    "[mercari-scrape] status:",
    res.status,
    "url:",
    url.toString(),
  );

  if (!res.ok) {
    throw new Error(`メルカリ応答エラー: ${res.status}`);
  }

  const html = await res.text();
  console.log("[mercari-scrape] html size:", html.length);

  // 1. __NEXT_DATA__ JSON を試す
  const nextDataListings = parseFromNextData(html);
  if (nextDataListings && nextDataListings.length > 0) {
    console.log(
      "[mercari-scrape] parsed via __NEXT_DATA__:",
      nextDataListings.length,
    );
    return summarize(nextDataListings);
  }

  // 2. HTML へフォールバック
  console.log("[mercari-scrape] falling back to HTML parse");
  const listings = parseMercariHtml(html);
  console.log("[mercari-scrape] parsed via HTML:", listings.length);
  return summarize(listings);
}

// ---- __NEXT_DATA__ パース ----

function parseFromNextData(html: string): Listing[] | null {
  const match = html.match(
    /<script\s+id="__NEXT_DATA__"\s+type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) {
    console.log("[mercari-scrape] __NEXT_DATA__ not found");
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch (e) {
    console.error("[mercari-scrape] __NEXT_DATA__ parse failed:", e);
    return null;
  }

  console.log(
    "[mercari-scrape] __NEXT_DATA__ top keys:",
    typeof data === "object" && data
      ? Object.keys(data as object).join(",")
      : "(none)",
  );

  const items = findMercariItems(data);
  console.log("[mercari-scrape] __NEXT_DATA__ items found:", items.length);
  if (items.length > 0) {
    console.log(
      "[mercari-scrape] sample item keys:",
      Object.keys(items[0]).join(","),
    );
    console.log(
      "[mercari-scrape] sample item:",
      JSON.stringify(items[0]).slice(0, 500),
    );
  }

  const listings: Listing[] = [];
  for (const it of items) {
    const listing = mapMercariItem(it);
    if (listing) listings.push(listing);
  }
  return listings;
}

type MercariItemLike = Record<string, unknown>;

function findMercariItems(node: unknown, depth = 0): MercariItemLike[] {
  if (depth > 12) return [];
  if (!node || typeof node !== "object") return [];

  if (Array.isArray(node)) {
    if (node.length > 0 && looksLikeMercariItem(node[0])) {
      return node.filter(looksLikeMercariItem) as MercariItemLike[];
    }
    for (const child of node) {
      const found = findMercariItems(child, depth + 1);
      if (found.length > 0) return found;
    }
    return [];
  }

  for (const value of Object.values(node as object)) {
    const found = findMercariItems(value, depth + 1);
    if (found.length > 0) return found;
  }
  return [];
}

function looksLikeMercariItem(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  // タイトル + 価格 + ID のうち 2 個以上
  let score = 0;
  if (typeof o.name === "string" || typeof o.title === "string") score++;
  if (typeof o.price === "number" || typeof o.price === "string") score++;
  if (typeof o.id === "string" || typeof o.itemId === "string") score++;
  return score >= 2;
}

function mapMercariItem(o: MercariItemLike): Listing | null {
  const id = str(o.id) || str(o.itemId) || "";
  if (!id) return null;

  const title = str(o.name) || str(o.title) || "";
  if (!title) return null;

  const priceVal = num(o.price) ?? 0;
  if (priceVal <= 0) return null;

  // メルカリは updated/created/soldDate あたり
  const endedAt =
    isoDate(o.soldDate) ||
    isoDate(o.updated) ||
    isoDate(o.created) ||
    isoDate(o.updatedAt) ||
    isoDate(o.createdAt) ||
    "";

  // サムネイル: thumbnails 配列だったり photos 配列だったりする
  const thumbnail = extractThumbnail(o);

  // 状態 (item_condition)
  const condition =
    str((o.itemCondition as Record<string, unknown> | undefined)?.name) ||
    str(o.condition) ||
    undefined;

  // URL
  const url =
    str(o.url) || `https://jp.mercari.com/item/${id}`;

  return {
    id,
    title,
    price: priceVal,
    endedAt,
    thumbnail,
    url,
    condition,
  };
}

function extractThumbnail(o: MercariItemLike): string | undefined {
  const thumbs = o.thumbnails;
  if (Array.isArray(thumbs) && thumbs.length > 0) {
    const first = thumbs[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      const url = (first as Record<string, unknown>).url;
      if (typeof url === "string") return url;
    }
  }
  const photos = o.photos;
  if (Array.isArray(photos) && photos.length > 0) {
    const first = photos[0];
    if (typeof first === "string") return first;
  }
  if (typeof o.thumbnailUrl === "string") return o.thumbnailUrl;
  if (typeof o.thumbnail === "string") return o.thumbnail;
  return undefined;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function num(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function isoDate(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") {
    const d = new Date(v);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  if (typeof v === "number") {
    const d = new Date(v < 1e12 ? v * 1000 : v);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  return "";
}

// ---- HTML フォールバック ----

function parseMercariHtml(html: string): Listing[] {
  const $ = cheerio.load(html);
  const listings: Listing[] = [];
  const seenIds = new Set<string>();

  // 商品 URL: /item/m1234567890 形式
  $('a[href*="/item/"]').each((_, link) => {
    const $link = $(link);
    const href = $link.attr("href") ?? "";
    const idMatch = href.match(/\/item\/([a-z0-9]+)(?:[?#]|$)/i);
    if (!idMatch) return;
    const id = idMatch[1];
    if (seenIds.has(id)) return;

    const title =
      $link.attr("aria-label")?.trim() ||
      $link.find("img").attr("alt")?.trim() ||
      $link.text().trim();
    if (!title || title.length < 3) return;

    const $card = $link.closest("li, article, div[class*='Item']");
    if (!$card.length) return;

    let price = 0;
    $card.find("*").each((_, el) => {
      const text = $(el).text();
      const m = text.match(/[¥￥]\s?([\d,]+)|([\d,]+)\s?円/);
      if (m) {
        const n = Number((m[1] ?? m[2]).replace(/,/g, ""));
        if (n >= 100 && n < 100_000_000) {
          if (price === 0 || n < price) price = n;
        }
      }
    });
    if (price === 0) return;

    const thumbnail = $card.find("img").first().attr("src") ?? undefined;

    seenIds.add(id);
    listings.push({
      id,
      title,
      price,
      endedAt: "",
      thumbnail,
      url: href.startsWith("http") ? href : `https://jp.mercari.com${href}`,
    });
  });

  return listings;
}

function summarize(listings: Listing[]): SourceResult {
  const prices = listings.map((l) => l.price).sort((a, b) => a - b);
  const count = listings.length;
  if (count === 0) {
    return {
      source: "mercari",
      count: 0,
      median: 0,
      min: 0,
      max: 0,
      listings: [],
    };
  }
  const median =
    count % 2 === 1
      ? prices[Math.floor(count / 2)]
      : Math.round((prices[count / 2 - 1] + prices[count / 2]) / 2);
  const min = prices[0];
  const max = prices[count - 1];
  return { source: "mercari", count, median, min, max, listings };
}
