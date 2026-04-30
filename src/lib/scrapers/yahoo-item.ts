import type { Listing } from "@/lib/types";

/**
 * Yahoo オークション・PayPay フリマの個別商品ページ詳細取得
 *
 * 検索結果のレスポンスには description / 複数画像が含まれないため、
 * 詳細ページ表示時に追加で個別ページを fetch する。
 */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

export type YahooItemDetail = {
  id: string;
  description?: string;
  images?: string[];
  condition?: string;
  sellerName?: string;
  shipping?: "free" | "paid" | "pickup";
  shippingInfo?: string;
  location?: string;
};

export async function scrapeYahooItem(
  id: string,
  isFleamarket: boolean,
): Promise<YahooItemDetail> {
  // 商品ページ URL: 検索結果の URL と同じ canonical 形式
  const url = isFleamarket
    ? `https://paypayfleamarket.yahoo.co.jp/item/${id}`
    : `https://auctions.yahoo.co.jp/jp/auction/${id}`;

  console.log("[yahoo-item] fetching:", url);

  const res = await fetch(url, {
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

  console.log("[yahoo-item] status:", res.status, "final url:", res.url);
  if (!res.ok) {
    throw new Error(`商品ページ取得エラー: ${res.status}`);
  }

  const html = await res.text();
  console.log("[yahoo-item] html size:", html.length);

  // __NEXT_DATA__ チェック
  const m = html.match(
    /<script\s+id="__NEXT_DATA__"\s+type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!m) {
    console.log(
      "[yahoo-item] __NEXT_DATA__ not found. HTML head sample:",
      html.slice(0, 800),
    );
    return { id };
  }

  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch (e) {
    console.error("[yahoo-item] __NEXT_DATA__ parse failed:", e);
    return { id };
  }

  console.log(
    "[yahoo-item] __NEXT_DATA__ top keys:",
    typeof data === "object" && data
      ? Object.keys(data as object).join(",")
      : "(none)",
  );

  // ページ内の商品データを再帰探索
  const item = findItemNode(data);
  if (!item) {
    console.log("[yahoo-item] item node not found in __NEXT_DATA__");
    return { id };
  }

  console.log("[yahoo-item] item keys:", Object.keys(item).join(","));
  console.log(
    "[yahoo-item] item sample (first 2000 chars):",
    JSON.stringify(item).slice(0, 2000),
  );

  const detail = {
    id,
    description: extractDescription(item),
    images: extractImages(item),
    condition: extractCondition(item),
    sellerName: extractSellerName(item),
    shipping: extractShipping(item),
    shippingInfo: extractShippingInfo(item),
    location: extractLocation(item),
  };

  console.log("[yahoo-item] mapped result:", {
    hasDescription: !!detail.description,
    descLen: detail.description?.length ?? 0,
    imageCount: detail.images?.length ?? 0,
    condition: detail.condition,
    sellerName: detail.sellerName,
    shipping: detail.shipping,
    location: detail.location,
  });

  return detail;
}

// データ中で「商品ノード」っぽいオブジェクトを再帰探索
function findItemNode(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 12) return null;
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const c of node) {
      const found = findItemNode(c, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const o = node as Record<string, unknown>;
  // 商品ノードの判定: title/name と id を持つ
  const hasTitle = typeof o.title === "string" || typeof o.name === "string";
  const hasId =
    typeof o.auctionId === "string" ||
    typeof o.itemId === "string" ||
    typeof o.id === "string";
  if (hasTitle && hasId) return o;
  // 子要素を再帰
  for (const v of Object.values(o)) {
    const found = findItemNode(v, depth + 1);
    if (found) return found;
  }
  return null;
}

function extractDescription(o: Record<string, unknown>): string | undefined {
  // Yahoo: description.text, description (string), itemDescription
  if (typeof o.description === "string") return cleanText(o.description);
  if (o.description && typeof o.description === "object") {
    const d = o.description as Record<string, unknown>;
    if (typeof d.text === "string") return cleanText(d.text);
    if (typeof d.html === "string") return stripHtml(d.html);
  }
  if (typeof o.itemDescription === "string")
    return cleanText(o.itemDescription);
  if (typeof o.detail === "string") return cleanText(o.detail);
  if (typeof o.descriptionText === "string")
    return cleanText(o.descriptionText);
  return undefined;
}

function extractImages(o: Record<string, unknown>): string[] | undefined {
  // images, photos, imageUrls, mainImages 等
  const arr =
    pickArr(o.images) ||
    pickArr(o.photos) ||
    pickArr(o.imageUrls) ||
    pickArr(o.mainImages) ||
    pickArr(o.imageList) ||
    pickArr((o.image as Record<string, unknown> | undefined)?.urls);
  if (arr) {
    const urls = arr
      .map((it) => {
        if (typeof it === "string") return it;
        if (it && typeof it === "object") {
          const u = (it as Record<string, unknown>).url;
          if (typeof u === "string") return u;
          const lg = (it as Record<string, unknown>).largeUrl;
          if (typeof lg === "string") return lg;
        }
        return null;
      })
      .filter((x): x is string => !!x);
    if (urls.length > 0) return urls;
  }
  // 単一画像のフォールバック
  const single =
    typeof o.imageUrl === "string"
      ? o.imageUrl
      : typeof o.thumbnailUrl === "string"
        ? o.thumbnailUrl
        : "";
  return single ? [single] : undefined;
}

function extractCondition(o: Record<string, unknown>): string | undefined {
  const code =
    (typeof o.itemCondition === "string" ? o.itemCondition : "") ||
    (typeof (o.condition as Record<string, unknown>)?.name === "string"
      ? ((o.condition as Record<string, unknown>).name as string)
      : "") ||
    (typeof o.conditionName === "string" ? o.conditionName : "") ||
    "";
  if (!code) return undefined;
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
  return map[code] ?? code;
}

function extractSellerName(o: Record<string, unknown>): string | undefined {
  const seller = o.seller as Record<string, unknown> | undefined;
  if (!seller) return undefined;
  const name =
    (typeof seller.displayName === "string" ? seller.displayName : "") ||
    (typeof seller.name === "string" ? seller.name : "");
  if (!name || name === "********") return undefined;
  return name;
}

function extractShipping(
  o: Record<string, unknown>,
): "free" | "paid" | "pickup" | undefined {
  if (o.isFreeShipping === true) return "free";
  if (o.hasShippingFee === true) return "paid";
  return undefined;
}

function extractShippingInfo(o: Record<string, unknown>): string | undefined {
  const ship = o.shipping as Record<string, unknown> | undefined;
  if (ship && typeof ship.method === "string") return ship.method;
  return undefined;
}

function extractLocation(o: Record<string, unknown>): string | undefined {
  const code =
    typeof o.prefectureCode === "string" ? o.prefectureCode : "";
  if (code) {
    const PREF: Record<string, string> = {
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
    if (PREF[code]) return PREF[code];
  }
  if (typeof o.locationName === "string") return o.locationName;
  return undefined;
}

function pickArr(v: unknown): unknown[] | null {
  return Array.isArray(v) ? v : null;
}

function stripHtml(s: string): string {
  return cleanText(s.replace(/<[^>]*>/g, " "));
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export type { Listing };
