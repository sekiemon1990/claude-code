import * as cheerio from "cheerio";

/**
 * ジモティー個別商品ページの追加データ取得 (description, images 等)
 * URL 例: https://jmty.jp/[prefecture]/sale-[cat]/article-[id]
 */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

export type JimotyItemDetail = {
  id: string;
  description?: string;
  images?: string[];
  price?: number;
  sellerName?: string;
  location?: string;
};

export async function scrapeJimotyItem(
  fullUrl: string,
): Promise<JimotyItemDetail> {
  // URL から ID 抽出
  const idMatch = fullUrl.match(/article-([a-z0-9_]+)/i);
  const id = idMatch?.[1] ?? "";

  console.log("[jimoty-item] fetching:", fullUrl);

  const res = await fetch(fullUrl, {
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

  console.log("[jimoty-item] status:", res.status, "final:", res.url);
  if (!res.ok) {
    throw new Error(`商品ページ取得エラー: ${res.status}`);
  }

  const html = await res.text();
  console.log("[jimoty-item] html size:", html.length);

  const $ = cheerio.load(html);

  // 商品説明: メインの説明欄を探す
  let description: string | undefined;
  // よくある class 名 / 構造を試す
  const candidates = [
    ".article-text",
    ".article__description",
    "[class*='description']",
    "[class*='Description']",
    ".jmty-article__text",
    "[itemprop='description']",
    ".article-body",
    ".article-detail__text",
    ".article__body",
  ];
  for (const sel of candidates) {
    const text = $(sel).first().text().trim();
    if (text && text.length > 10) {
      description = text.replace(/\s+/g, " ").slice(0, 5000);
      console.log("[jimoty-item] description found via:", sel);
      break;
    }
  }
  // フォールバック: meta description
  if (!description) {
    const metaDesc =
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim();
    if (metaDesc) {
      description = metaDesc;
      console.log("[jimoty-item] description via meta");
    }
  }

  // 画像: 複数枚
  const imageSet = new Set<string>();
  // og:image を最優先
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) imageSet.add(ogImage);
  // 商品画像っぽい img 要素
  $('img[src*="jmty.jp/articles/images"]').each((_, el) => {
    const src = $(el).attr("src");
    if (src) imageSet.add(src);
  });
  // gallery 系の class があれば
  $('[class*="gallery"] img, [class*="Gallery"] img').each((_, el) => {
    const src = $(el).attr("src");
    if (src && src.includes("jmty.jp")) imageSet.add(src);
  });
  const images = Array.from(imageSet);

  // 価格: 商品ページから抽出 (¥X,XXX 形式)
  let price: number | undefined;
  const priceCandidates = [
    ".article-price",
    ".article__price",
    "[class*='price']",
    "[itemprop='price']",
  ];
  for (const sel of priceCandidates) {
    const $el = $(sel).first();
    const text = $el.text().replace(/\s+/g, "");
    const m = text.match(/[¥￥]\s?([\d,]+)|([\d,]+)\s?円/);
    if (m) {
      const n = Number((m[1] ?? m[2]).replace(/,/g, ""));
      if (Number.isFinite(n)) {
        price = n;
        break;
      }
    }
    const content = $el.attr("content");
    if (content) {
      const n = Number(content.replace(/[^\d]/g, ""));
      if (Number.isFinite(n) && n > 0) {
        price = n;
        break;
      }
    }
  }

  // 出品者
  let sellerName: string | undefined;
  const sellerCandidates = [
    ".user-name",
    "[class*='userName']",
    "[class*='Username']",
    "[class*='author']",
  ];
  for (const sel of sellerCandidates) {
    const text = $(sel).first().text().trim();
    if (text && text.length > 0 && text.length < 50) {
      sellerName = text;
      break;
    }
  }

  // 所在地
  let location: string | undefined;
  const PREF_RE = /(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/;
  const locationCandidates = [
    "[class*='location']",
    "[class*='Location']",
    "[class*='address']",
    "[class*='area']",
  ];
  for (const sel of locationCandidates) {
    const text = $(sel).first().text();
    const m = text.match(PREF_RE);
    if (m) {
      location = m[1];
      break;
    }
  }
  if (!location) {
    const bodyText = $("body").text();
    const m = bodyText.match(PREF_RE);
    if (m) location = m[1];
  }

  console.log("[jimoty-item] mapped:", {
    hasDescription: !!description,
    descLen: description?.length ?? 0,
    imageCount: images.length,
    price,
    sellerName,
    location,
  });

  return {
    id,
    description,
    images: images.length > 0 ? images : undefined,
    price,
    sellerName,
    location,
  };
}
