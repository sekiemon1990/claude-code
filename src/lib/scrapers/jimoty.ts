import * as cheerio from "cheerio";
import type { Listing, SourceResult } from "@/lib/types";

/**
 * ジモティー (jmty.jp) スクレイパ
 *
 * URL: https://jmty.jp/all?keyword=KEYWORD
 *
 * ジモティーはローカル個人取引プラットフォーム。
 * Server-rendered HTML なので cheerio で直接パース可能。
 */

const JMTY_BASE = "https://jmty.jp/all";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

export type JimotyScrapeOptions = {
  keyword: string;
  excludes?: string;
  limit?: number;
};

export async function scrapeJimoty(
  options: JimotyScrapeOptions,
): Promise<SourceResult> {
  const { keyword, excludes, limit = 30 } = options;

  const url = new URL(JMTY_BASE);
  url.searchParams.set("keyword", keyword);

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

  console.log("[jimoty-scrape] status:", res.status, "url:", url.toString());

  if (!res.ok) {
    throw new Error(`ジモティー応答エラー: ${res.status}`);
  }

  const html = await res.text();
  console.log("[jimoty-scrape] html size:", html.length);

  // 構造プローブ
  const itemLinkCount = (html.match(/\/(?:all|car|jobs|community)\/article-/g) ?? []).length;
  console.log("[jimoty-scrape] structure probe:", {
    itemLinkCount,
    hasNextData: html.includes('id="__NEXT_DATA__"'),
    hasJsonLd: html.includes('type="application/ld+json"'),
  });

  // パース
  const listings = parseJimotyHtml(html, limit);
  const totalAvailable = parseTotalCount(html);

  console.log("[jimoty-scrape] parsed:", listings.length);
  console.log("[jimoty-scrape] total available:", totalAvailable);

  // excludes が指定されていればクライアント側でフィルタ
  let filtered = listings;
  if (excludes && excludes.trim()) {
    const terms = excludes
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    filtered = listings.filter((l) => {
      const t = l.title.toLowerCase();
      return terms.every((term) => !t.includes(term));
    });
  }

  return summarize(filtered, totalAvailable);
}

function parseJimotyHtml(html: string, limit: number): Listing[] {
  const $ = cheerio.load(html);
  const listings: Listing[] = [];
  const seenIds = new Set<string>();

  // ジモティーの商品 URL パターン: /all/article-12345 等
  $('a[href*="article-"]').each((_, link) => {
    if (listings.length >= limit) return false;
    const $link = $(link);
    const href = $link.attr("href") ?? "";
    const idMatch = href.match(/article-([a-z0-9_]+)/i);
    if (!idMatch) return;
    const id = idMatch[1];
    if (seenIds.has(id)) return;

    // タイトル
    let title = $link.attr("title")?.trim() || "";
    if (!title || title.length < 3) {
      title =
        $link.find("img").attr("alt")?.trim() ||
        $link.text().trim().replace(/\s+/g, " ") ||
        "";
    }
    if (!title || title.length < 3) return;

    // カードとして親要素を探索
    const $card = $link.closest("li, article, div");
    if (!$card.length) return;

    // 価格抽出: ¥/円 を含むテキスト
    const cardText = $card.text();
    let price = 0;
    const priceMatches = cardText.matchAll(/[¥￥]\s?([\d,]+)|([\d,]+)\s?円/g);
    for (const m of priceMatches) {
      const n = Number((m[1] ?? m[2]).replace(/,/g, ""));
      if (n >= 0 && n < 100_000_000) {
        if (price === 0 || n < price) price = n;
      }
    }
    // 「あげます」「無料」表記もあるので 0 円でも受け入れる
    if (price < 0) return;

    // サムネイル
    const thumbnail = $card.find("img").first().attr("src") ?? undefined;

    // 所在地: card text から都道府県名を抽出
    let location: string | undefined;
    const PREF_RE = /(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/;
    const prefMatch = cardText.match(PREF_RE);
    if (prefMatch) location = prefMatch[1];

    // 投稿日 (相対表記が多い: "1日前" "1時間前" 等)
    let endedAt = "";
    const dateMatch = cardText.match(/(\d+)\s*(分|時間|日|週間|か月|ヶ月|年)前/);
    if (dateMatch) {
      const n = Number(dateMatch[1]);
      const unit = dateMatch[2];
      const ms = unitToMs(unit) * n;
      if (Number.isFinite(ms)) {
        endedAt = new Date(Date.now() - ms).toISOString();
      }
    }

    seenIds.add(id);
    listings.push({
      id,
      title,
      price,
      endedAt,
      thumbnail,
      url: href.startsWith("http") ? href : `https://jmty.jp${href}`,
      location,
    });
  });

  return listings;
}

function unitToMs(unit: string): number {
  const map: Record<string, number> = {
    分: 60 * 1000,
    時間: 60 * 60 * 1000,
    日: 24 * 60 * 60 * 1000,
    週間: 7 * 24 * 60 * 60 * 1000,
    か月: 30 * 24 * 60 * 60 * 1000,
    ヶ月: 30 * 24 * 60 * 60 * 1000,
    年: 365 * 24 * 60 * 60 * 1000,
  };
  return map[unit] ?? 0;
}

// 総件数の抽出 (HTML テキストから "X件" パターンを探す)
function parseTotalCount(html: string): number | undefined {
  const patterns = [
    /([\d,]+)\s*件中/,
    /約\s*([\d,]+)\s*件/,
    /合計\s*([\d,]+)\s*件/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const n = Number(m[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) {
        console.log(`[jimoty-scrape] totalCount via HTML regex (${re}):`, n);
        return n;
      }
    }
  }
  return undefined;
}

function summarize(
  listings: Listing[],
  totalAvailable?: number,
): SourceResult {
  const prices = listings.map((l) => l.price).sort((a, b) => a - b);
  const count = listings.length;
  if (count === 0) {
    return {
      source: "jimoty",
      count: 0,
      median: 0,
      min: 0,
      max: 0,
      listings: [],
      totalAvailable,
    };
  }
  const median =
    count % 2 === 1
      ? prices[Math.floor(count / 2)]
      : Math.round((prices[count / 2 - 1] + prices[count / 2]) / 2);
  const min = prices[0];
  const max = prices[count - 1];
  return {
    source: "jimoty",
    count,
    median,
    min,
    max,
    listings,
    totalAvailable,
  };
}
