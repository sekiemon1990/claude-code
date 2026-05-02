import * as cheerio from "cheerio";
import type { Listing, SourceResult } from "@/lib/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("jimoty-scrape");

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
  /** "sold" / "active" / "all" - ジモティーは現状フィルタなし (全件返却) */
  status?: "sold" | "active" | "all";
};

export async function scrapeJimoty(
  options: JimotyScrapeOptions,
): Promise<SourceResult> {
  const { keyword, excludes, limit = 30 } = options;

  // Jimoty 検索: /all/sale?keyword=... が「売ります」全カテゴリの検索 URL
  const url = new URL("https://jmty.jp/all/sale");
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
    redirect: "follow",
  });

  log.info(
    "status:",
    res.status,
    "url:",
    url.toString(),
    "final:",
    res.url,
  );

  if (!res.ok) {
    throw new Error(`ジモティー応答エラー: ${res.status}`);
  }

  const html = await res.text();
  log.info("html size:", html.length);

  // HTML サンプル: <main> や <h1> 周辺を見て検索結果ページか判定
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (h1Match) {
    log.info("h1:", h1Match[1].replace(/<[^>]+>/g, "").trim().slice(0, 200));
  }
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/);
  if (titleMatch) {
    log.info("page title:", titleMatch[1].trim());
  }

  // 構造プローブ
  const allArticleLinks = (html.match(/article-[a-z0-9_]+/gi) ?? []).length;
  const prefArticleLinks = (
    html.match(/\/[a-z_]+\/sale-[a-z_]+\/article-[a-z0-9_]+/gi) ?? []
  ).length;
  const sampleUrls = Array.from(
    new Set(
      (html.match(/\/[a-z_]+\/sale-[a-z_]+\/article-[a-z0-9_]+/gi) ?? []).slice(
        0,
        5,
      ),
    ),
  );
  log.info("structure probe:", {
    allArticleLinks,
    prefArticleLinks,
    sampleUrls,
    hasNextData: html.includes('id="__NEXT_DATA__"'),
    hasJsonLd: html.includes('type="application/ld+json"'),
  });

  // パース: 検索結果以外 (?from=pr 等のおすすめリンク) を除外する
  const listings = parseJimotyHtml(html, limit).filter((l) => {
    // ?from=pr のような promoted リンクを除外
    return !l.url.includes("?from=pr") && !l.url.includes("&from=pr");
  });
  const totalAvailable = parseTotalCount(html);

  log.info("parsed (excl. promoted):", listings.length);
  log.info("total available:", totalAvailable);
  if (listings[0]) {
    log.info("sample listing:", JSON.stringify(listings[0]).slice(0, 300));
  }
  if (listings[1]) {
    log.info("sample listing 2:", JSON.stringify(listings[1]).slice(0, 300));
  }

  // excludes クライアント側フィルタ
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

    // カードとして親要素を探索 (li 優先 → article → div)
    let $card = $link.closest("li");
    if (!$card.length) $card = $link.closest("article");
    if (!$card.length) $card = $link.closest("div");
    if (!$card.length) return;

    // card 内に価格パターンが無ければ、親を最大 3 段まで遡る
    // (Jimoty レイアウトによっては <a> の親 div が画像だけ含み、
    //  価格は同階層の別 div にある場合がある)
    const PRICE_RE = /[¥￥]\s?[\d,]+|[\d,]+\s?円/;
    for (let i = 0; i < 3; i++) {
      if (PRICE_RE.test($card.text())) break;
      const $parent = $card.parent();
      if (!$parent.length) break;
      // 親が body や main のような巨大要素になったら止める
      if (
        $parent.is("body, main, ul, [role='list']") ||
        ($parent.find('a[href*="article-"]').length > 1 && i > 0)
      )
        break;
      $card = $parent;
    }

    // 価格抽出: card 内のテキストから ¥X,XXX または X,XXX円 を探す
    // 「最初に見つかったもっともらしい価格」を採用 (最小値方式は ¥0 誤検出を生む)
    const cardText = $card.text();
    let price = 0;
    const priceMatches = Array.from(
      cardText.matchAll(/[¥￥]\s?([\d,]+)|([\d,]+)\s?円/g),
    );
    const candidates = priceMatches
      .map((m) => Number((m[1] ?? m[2]).replace(/,/g, "")))
      .filter((n) => Number.isFinite(n) && n >= 0 && n < 100_000_000);
    if (candidates.length > 0) {
      // 0 を除外した中の最初のものを採用 (0 は「全 30 件中 0 件」など別文脈の可能性)
      const nonZero = candidates.filter((n) => n > 0);
      price = nonZero[0] ?? candidates[0];
    } else if (/あげます|差し上げ|無料|タダ/.test(cardText)) {
      price = 0;
    }

    // 最初の 2 件だけ診断ログ
    if (listings.length < 2) {
      log.info(
        `card[${listings.length}] tag=${$card.prop("tagName")}`,
        "priceCandidates:",
        candidates,
        "cardTextSample:",
        cardText.replace(/\s+/g, " ").slice(0, 200),
      );
    }

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

    // お気に入り登録数 (一覧カードでは「♡ 4」「お気に入り 4」等で表示される)
    let likes: number | undefined;
    const likesMatch =
      cardText.match(/(\d+)\s*お気に入り/) ||
      cardText.match(/お気に入り[^\d]{0,5}(\d+)/) ||
      cardText.match(/[♡❤️]\s*(\d+)/);
    if (likesMatch) {
      const n = Number(likesMatch[1]);
      if (Number.isFinite(n) && n >= 0 && n < 1_000_000) likes = n;
    }

    // ストア / 個人 判別:
    // - card text に「法人」「事業者」「店舗」が含まれればストア
    // - seller リンクが /biz/ や /shop/ を含めばストア
    const sellerType: "store" | "individual" =
      /法人|事業者|店舗|ショップ/.test(cardText) ||
      /\/(biz|shop|store)\//i.test($card.find("a[href*='/profiles/']").attr("href") ?? "")
        ? "store"
        : "individual";

    seenIds.add(id);
    listings.push({
      id,
      title,
      price,
      endedAt,
      thumbnail,
      url: href.startsWith("http") ? href : `https://jmty.jp${href}`,
      location,
      likes,
      sellerType,
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
        log.info(`totalCount via HTML regex (${re}):`, n);
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
