import * as cheerio from "cheerio";
import type { Listing, SourceResult } from "@/lib/types";

/**
 * Yahoo オークション 落札相場 (closedsearch) スクレイパ
 *
 * 戦略:
 *   1. __NEXT_DATA__ JSON に商品データがあるか探す (最優先)
 *   2. 見つからなければ HTML 上のリンク要素を起点に近傍から情報を抽出
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
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });

  console.log("[yahoo-scrape] status:", res.status, "url:", url.toString());

  if (!res.ok) {
    throw new Error(`Yahoo オークション応答エラー: ${res.status}`);
  }

  const html = await res.text();
  console.log("[yahoo-scrape] html size:", html.length);

  // 1. __NEXT_DATA__ JSON から取得を試みる
  const nextDataListings = parseFromNextData(html);
  if (nextDataListings && nextDataListings.length > 0) {
    console.log(
      "[yahoo-scrape] parsed via __NEXT_DATA__:",
      nextDataListings.length,
    );
    return summarize("yahoo_auction", nextDataListings);
  }

  // 2. HTML 解析へフォールバック
  console.log("[yahoo-scrape] falling back to HTML parse");
  const listings = parseYahooHtml(html);
  console.log("[yahoo-scrape] parsed via HTML:", listings.length);
  return summarize("yahoo_auction", listings);
}

// ---- __NEXT_DATA__ パース ----

function parseFromNextData(html: string): Listing[] | null {
  const match = html.match(
    /<script\s+id="__NEXT_DATA__"\s+type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) {
    console.log("[yahoo-scrape] __NEXT_DATA__ not found");
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch (e) {
    console.error("[yahoo-scrape] __NEXT_DATA__ parse failed:", e);
    return null;
  }

  // 構造を診断ログに出す (初回のみ)
  console.log(
    "[yahoo-scrape] __NEXT_DATA__ top keys:",
    typeof data === "object" && data ? Object.keys(data as object).join(",") : "(none)",
  );

  // 配列に「価格 / タイトル / 終了日 / オークションID」っぽいフィールドを持つ
  // オブジェクトを再帰探索する。
  const items = findAuctionItems(data);
  console.log("[yahoo-scrape] __NEXT_DATA__ items found:", items.length);
  if (items.length > 0) {
    console.log(
      "[yahoo-scrape] sample item keys:",
      Object.keys(items[0]).join(","),
    );
    // 全フィールドの調査ログ (1500 文字まで)
    console.log(
      "[yahoo-scrape] sample item full:",
      JSON.stringify(items[0]).slice(0, 1500),
    );
  }

  const listings: Listing[] = [];
  for (const it of items) {
    const listing = mapAuctionItem(it);
    if (listing) listings.push(listing);
  }
  return listings;
}

type AuctionItemLike = Record<string, unknown>;

function findAuctionItems(node: unknown, depth = 0): AuctionItemLike[] {
  if (depth > 10) return [];
  if (!node || typeof node !== "object") return [];

  if (Array.isArray(node)) {
    // 配列要素がオークション商品っぽければ採用
    if (node.length > 0 && looksLikeAuctionItem(node[0])) {
      return node.filter(looksLikeAuctionItem) as AuctionItemLike[];
    }
    // そうでなければ各要素を再帰
    for (const child of node) {
      const found = findAuctionItems(child, depth + 1);
      if (found.length > 0) return found;
    }
    return [];
  }

  // オブジェクト: 各値を再帰
  for (const value of Object.values(node as object)) {
    const found = findAuctionItems(value, depth + 1);
    if (found.length > 0) return found;
  }
  return [];
}

function looksLikeAuctionItem(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  // タイトルっぽい / 価格っぽい / オークション ID っぽい のうち 2 個以上
  let score = 0;
  const titleKeys = ["title", "name", "auctionTitle"];
  const priceKeys = [
    "price",
    "currentPrice",
    "winningPrice",
    "endPrice",
    "soldPrice",
  ];
  const idKeys = ["auctionId", "auction_id", "id", "itemId"];
  if (titleKeys.some((k) => typeof o[k] === "string")) score++;
  if (priceKeys.some((k) => typeof o[k] === "number" || typeof o[k] === "string"))
    score++;
  if (idKeys.some((k) => typeof o[k] === "string")) score++;
  return score >= 2;
}

function mapAuctionItem(o: AuctionItemLike): Listing | null {
  const id =
    str(o.auctionId) ||
    str(o.auction_id) ||
    str(o.itemId) ||
    str(o.id) ||
    "";
  if (!id) return null;

  const title =
    str(o.title) ||
    str(o.name) ||
    str(o.auctionTitle) ||
    "";
  if (!title) return null;

  const priceVal =
    num(o.winningPrice) ??
    num(o.endPrice) ??
    num(o.soldPrice) ??
    num(o.currentPrice) ??
    num(o.price) ??
    num(o.buyNowPrice) ??
    0;
  if (priceVal <= 0) return null;

  const endedAt =
    isoDate(o.endTime) ||
    isoDate(o.endedAt) ||
    isoDate(o.endDate) ||
    isoDate(o.end_time) ||
    isoDate(o.closeTime) ||
    "";

  const thumbnail =
    str(o.imageUrl) ||
    str(o.thumbnailUrl) ||
    str(o.thumbnail) ||
    str(o.image) ||
    pickFromImagesArray(o) ||
    undefined;

  const bidCount = num(o.bidCount) ?? num(o.bids) ?? undefined;

  // フリマ商品か通常オークションかで URL を出し分け
  const isFleamarket = o.isFleamarketItem === true;
  const url =
    str(o.url) ||
    str(o.auctionUrl) ||
    (isFleamarket
      ? `https://paypayfleamarket.yahoo.co.jp/item/${id}`
      : `https://page.auctions.yahoo.co.jp/jp/auction/${id}`);

  // 状態 (itemCondition: "USED20" 等のコード)
  const condition = mapItemCondition(str(o.itemCondition)) || undefined;

  // 出品者名 (seller.displayName。Yahoo がマスクして "********" を返すことあり)
  const sellerNameRaw = pickNested(o, ["seller", "displayName"]);
  const sellerName =
    sellerNameRaw && sellerNameRaw !== "********" ? sellerNameRaw : undefined;

  // 送料 (isFreeShipping / hasShippingFee)
  let shipping: "free" | "paid" | "pickup" | undefined;
  if (o.isFreeShipping === true) shipping = "free";
  else if (o.hasShippingFee === true) shipping = "paid";

  // 所在地 (prefectureCode: "13" → "東京都")
  const location = mapPrefecture(str(o.prefectureCode)) || undefined;

  // 商品説明: 検索結果データには含まれないため undefined
  // (将来的に個別商品ページの追加 fetch で取得する場合は別実装)

  return {
    id,
    title,
    price: priceVal,
    endedAt,
    thumbnail,
    url,
    bidCount,
    condition,
    sellerName,
    shipping,
    location,
  };
}

// itemCondition コード → 日本語表記 (PayPay フリマは日本語直接の場合あり)
function mapItemCondition(code: string): string {
  const map: Record<string, string> = {
    NEW: "新品",
    USED00: "未使用",
    USED10: "未使用に近い",
    USED20: "目立った傷や汚れなし",
    USED30: "やや傷や汚れあり",
    USED40: "傷や汚れあり",
    USED50: "全体的に状態が悪い",
    JUNK: "ジャンク",
  };
  if (map[code]) return map[code];
  // PayPay フリマ等で日本語そのまま入っているケースをそのまま返す
  if (
    code &&
    /(新品|未使用|目立った|傷や汚れ|全体的|ジャンク|中古)/.test(code)
  ) {
    return code;
  }
  return "";
}

// prefectureCode → 都道府県名
function mapPrefecture(code: string): string {
  const map: Record<string, string> = {
    "01": "北海道",
    "02": "青森県",
    "03": "岩手県",
    "04": "宮城県",
    "05": "秋田県",
    "06": "山形県",
    "07": "福島県",
    "08": "茨城県",
    "09": "栃木県",
    "10": "群馬県",
    "11": "埼玉県",
    "12": "千葉県",
    "13": "東京都",
    "14": "神奈川県",
    "15": "新潟県",
    "16": "富山県",
    "17": "石川県",
    "18": "福井県",
    "19": "山梨県",
    "20": "長野県",
    "21": "岐阜県",
    "22": "静岡県",
    "23": "愛知県",
    "24": "三重県",
    "25": "滋賀県",
    "26": "京都府",
    "27": "大阪府",
    "28": "兵庫県",
    "29": "奈良県",
    "30": "和歌山県",
    "31": "鳥取県",
    "32": "島根県",
    "33": "岡山県",
    "34": "広島県",
    "35": "山口県",
    "36": "徳島県",
    "37": "香川県",
    "38": "愛媛県",
    "39": "高知県",
    "40": "福岡県",
    "41": "佐賀県",
    "42": "長崎県",
    "43": "熊本県",
    "44": "大分県",
    "45": "宮崎県",
    "46": "鹿児島県",
    "47": "沖縄県",
  };
  return map[code] ?? "";
}

function pickNested(o: AuctionItemLike, path: string[]): string | undefined {
  let cur: unknown = o;
  for (const k of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === "string" && cur ? cur : undefined;
}

function pickFromImagesArray(o: AuctionItemLike): string | undefined {
  const images = o.images;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      const u = (first as Record<string, unknown>).url;
      if (typeof u === "string") return u;
    }
  }
  const photos = o.photos;
  if (Array.isArray(photos) && photos.length > 0) {
    const first = photos[0];
    if (typeof first === "string") return first;
  }
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
    // unix sec or ms
    const d = new Date(v < 1e12 ? v * 1000 : v);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  return "";
}

// ---- HTML フォールバックパース ----

function parseYahooHtml(html: string): Listing[] {
  const $ = cheerio.load(html);
  const listings: Listing[] = [];
  const seenIds = new Set<string>();

  const productLinks = $('a[href*="/auction/"]');
  console.log("[yahoo-scrape] product link candidates:", productLinks.length);

  productLinks.each((_, link) => {
    const $link = $(link);
    const href = $link.attr("href") ?? "";
    const idMatch = href.match(/\/auction\/([a-z0-9]+)(?:[?#]|$)/i);
    if (!idMatch) return;
    const id = idMatch[1];
    if (seenIds.has(id)) return;

    let title = $link.text().trim();
    if (!title || title.length < 3) title = $link.attr("title")?.trim() ?? "";
    if (!title || title.length < 3)
      title = $link.find("img").attr("alt")?.trim() ?? "";
    if (!title || title.length < 3) return;

    const $card = $link.closest(
      "li, article, [class*='Product'], [class*='Item']",
    );
    if (!$card.length) return;

    let price = 0;
    $card.find("*").each((_, el) => {
      const text = $(el).text();
      const m = text.match(/[¥￥]\s?([\d,]+)|([\d,]+)\s?円/);
      if (m) {
        const num = Number((m[1] ?? m[2]).replace(/,/g, ""));
        if (num >= 100 && num < 100_000_000) {
          if (price === 0 || num < price) price = num;
        }
      }
    });
    if (price === 0) return;

    const cardText = $card.text();
    let endedAt = "";
    const timeEl = $card.find("time[datetime]").first();
    const datetimeAttr = timeEl.attr("datetime");
    if (datetimeAttr) {
      const d = new Date(datetimeAttr);
      if (!Number.isNaN(d.getTime())) endedAt = d.toISOString();
    }

    const thumbnail = $card.find("img").first().attr("src") ?? undefined;
    const bidMatch = cardText.match(/(\d+)\s*(?:入札|件入札|bid)/);
    const bidCount = bidMatch ? Number(bidMatch[1]) : undefined;

    seenIds.add(id);
    listings.push({
      id,
      title,
      price,
      endedAt,
      thumbnail,
      url: href.startsWith("http")
        ? href
        : `https://auctions.yahoo.co.jp${href}`,
      bidCount,
    });
  });

  return listings;
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
