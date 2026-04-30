import * as cheerio from "cheerio";
import type { Listing, SourceResult } from "@/lib/types";

/**
 * Yahoo オークション 落札相場 (closedsearch) スクレイパ
 *
 * URL: https://auctions.yahoo.co.jp/closedsearch/closedsearch?p=KEYWORD&va=KEYWORD&b=1&n=50
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
  // 重要部分のサンプル (デバッグ用)
  const sampleStart = html.indexOf("<body");
  if (sampleStart > -1) {
    console.log(
      "[yahoo-scrape] html sample:",
      html.slice(sampleStart, sampleStart + 800),
    );
  }

  const listings = parseYahooHtml(html);
  console.log("[yahoo-scrape] parsed listings:", listings.length);

  return summarize("yahoo_auction", listings);
}

function parseYahooHtml(html: string): Listing[] {
  const $ = cheerio.load(html);
  const listings: Listing[] = [];
  const seenIds = new Set<string>();

  // 商品リンクを起点に探す: ヤフオクの商品 URL パターン
  // /auction/X123456789 (X は 1 文字以上の英字)
  const productLinks = $('a[href*="/auction/"]');
  console.log("[yahoo-scrape] product link candidates:", productLinks.length);

  productLinks.each((_, link) => {
    const $link = $(link);
    const href = $link.attr("href") ?? "";
    const idMatch = href.match(/\/auction\/([a-z0-9]+)(?:[?#]|$)/i);
    if (!idMatch) return;
    const id = idMatch[1];
    if (seenIds.has(id)) return;

    // タイトルを取得 (リンクのテキスト or 親要素から)
    let title = $link.text().trim();
    if (!title || title.length < 3) {
      title = $link.attr("title")?.trim() ?? "";
    }
    if (!title || title.length < 3) {
      // 画像 alt から拾う
      title = $link.find("img").attr("alt")?.trim() ?? "";
    }
    if (!title || title.length < 3) return;

    // 商品カード本体: リンクから親をたどって最も近い li / article / div
    const $card = $link.closest(
      "li, article, [class*='Product'], [class*='Item']",
    );
    if (!$card.length) return;

    // 価格: ¥ や 円 を含むテキスト
    let price = 0;
    $card.find("*").each((_, el) => {
      const text = $(el).text();
      const m = text.match(/[¥￥]\s?([\d,]+)|([\d,]+)\s?円/);
      if (m) {
        const num = Number((m[1] ?? m[2]).replace(/,/g, ""));
        if (num > 0 && num < 100_000_000) {
          if (price === 0 || num < price) {
            // 最も小さい有効値を取得 (ヘッダの "0円〜" を除外する目的)
            if (num >= 100) {
              price = num;
            }
          }
        }
      }
    });
    if (price === 0) return;

    // サムネイル
    const thumbnail = $card.find("img").first().attr("src") ?? undefined;

    const cardText = $card.text();

    // 終了日時: <time datetime="..."> を優先、なければテキストから抽出
    let endedAt = "";
    const timeEl = $card.find("time[datetime]").first();
    const datetimeAttr = timeEl.attr("datetime");
    if (datetimeAttr) {
      const d = new Date(datetimeAttr);
      if (!Number.isNaN(d.getTime())) {
        endedAt = d.toISOString();
      }
    }
    if (!endedAt) {
      // 全ての日付候補を取り、有効そうな (過去 1 年以内) ものを採用
      const candidates = extractDateCandidates(cardText);
      const valid = candidates
        .filter((c) => {
          const ms = c.getTime();
          const now = Date.now();
          return ms <= now && ms >= now - 365 * 86400000;
        })
        .sort((a, b) => b.getTime() - a.getTime()); // 新しい順
      if (valid[0]) {
        endedAt = valid[0].toISOString();
      } else {
        endedAt = ""; // パース失敗時は空 → UI 側で「不明」表示
      }
    }

    // 入札数 (例: "1件", "5入札")
    const bidMatch = cardText.match(/(\d+)\s*(?:入札|件入札|bid)/);
    const bidCount = bidMatch ? Number(bidMatch[1]) : undefined;

    seenIds.add(id);
    listings.push({
      id,
      title,
      price,
      endedAt,
      thumbnail,
      url: href.startsWith("http") ? href : `https://auctions.yahoo.co.jp${href}`,
      bidCount,
    });
  });

  return listings;
}

// テキスト全体から日付候補を全件抽出 (JST 想定)
function extractDateCandidates(text: string): Date[] {
  const results: Date[] = [];

  // パターン 1: 2025/11/22 22:30 や 2025-11-22 等 (年付き)
  const re1 = /(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})日?\s*(?:(\d{1,2})[:時](\d{1,2}))?/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(text))) {
    const d = makeJstDate(
      Number(m[1]),
      Number(m[2]),
      Number(m[3]),
      Number(m[4] ?? 0),
      Number(m[5] ?? 0),
    );
    if (d) results.push(d);
  }

  // パターン 2: 11/22 や 11月22日 (年なし → 直近の同月日として推測)
  const re2 = /(?<!\d)(\d{1,2})[\/月](\d{1,2})日?\s*(?:(\d{1,2})[:時](\d{1,2}))?/g;
  while ((m = re2.exec(text))) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const now = new Date();
    const candidates = [
      makeJstDate(now.getUTCFullYear(), month, day, Number(m[3] ?? 0), Number(m[4] ?? 0)),
      makeJstDate(now.getUTCFullYear() - 1, month, day, Number(m[3] ?? 0), Number(m[4] ?? 0)),
    ];
    for (const d of candidates) {
      if (d) results.push(d);
    }
  }

  return results;
}

function makeJstDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date | null {
  if (year < 2000 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  // JST (UTC+9) として解釈し UTC に変換
  const jstMs = Date.UTC(year, month - 1, day, hour, minute) - 9 * 60 * 60 * 1000;
  const d = new Date(jstMs);
  if (Number.isNaN(d.getTime())) return null;
  return d;
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
