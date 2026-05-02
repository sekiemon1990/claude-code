import { randomUUID } from "node:crypto";
import type { Listing, SourceResult } from "@/lib/types";
import { generateMercariDpop } from "./mercari-dpop";
import { createLogger } from "@/lib/logger";

const log = createLogger("mercari-scrape");

/**
 * メルカリスクレイパ (内部 API + DPoP 認証)
 *
 * メルカリ Web は SPA で SSR HTML には商品データが含まれない。
 * SPA 自身が叩く api.mercari.jp の内部 API を直接叩く。
 *
 * 認証は DPoP (RFC 9449): リクエスト毎に ECDSA P-256 鍵ペアを
 * 生成し ES256 で署名した JWT を DPoP ヘッダに付与する。
 */

const API_URL = "https://api.mercari.jp/v2/entities:search";

export type MercariScrapeOptions = {
  keyword: string;
  excludes?: string;
  limit?: number;
  /** "sold": 売切のみ (デフォルト) / "active": 出品中 / "all" */
  status?: "sold" | "active" | "all";
  /** ページネーション用のトークン (前回レスポンスの meta.nextPageToken) */
  pageToken?: string;
};

export async function scrapeMercari(
  options: MercariScrapeOptions,
): Promise<SourceResult> {
  const { keyword, excludes, limit = 30, status = "sold", pageToken = "" } = options;

  // status: sold = STATUS_SOLD_OUT のみ、active = STATUS_ON_SALE のみ、all = 両方
  const statusFilter =
    status === "active"
      ? ["STATUS_ON_SALE"]
      : status === "all"
        ? ["STATUS_ON_SALE", "STATUS_SOLD_OUT"]
        : ["STATUS_SOLD_OUT"];

  const body = {
    userId: "",
    pageSize: limit,
    pageToken,
    searchSessionId: randomUUID(),
    indexRouting: "INDEX_ROUTING_UNSPECIFIED",
    thumbnailTypes: [],
    searchCondition: {
      keyword,
      excludeKeyword: excludes ?? "",
      sort: "SORT_CREATED_TIME",
      order: "ORDER_DESC",
      status: statusFilter,
      sizeId: [],
      categoryId: [],
      brandId: [],
      sellerId: [],
      priceMin: 0,
      priceMax: 0,
      itemConditionId: [],
      shippingPayerId: [],
      shippingFromArea: [],
      shippingMethod: [],
      colorId: [],
      hasCoupon: false,
      attributes: [],
      itemTypes: [],
      skuIds: [],
    },
    defaultDatasets: [],
    serviceFrom: "suruga",
  };

  const dpop = generateMercariDpop("POST", API_URL);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json; charset=utf-8",
      "X-Platform": "web",
      DPoP: dpop,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  log.info("status:", res.status);

  if (!res.ok) {
    const text = await res.text();
    log.error("error response:", text.slice(0, 500));
    throw new Error(`メルカリ API エラー: ${res.status}`);
  }

  const json = (await res.json()) as MercariSearchResponse;
  const items = Array.isArray(json.items) ? json.items : [];
  const totalAvailable =
    typeof json.meta?.numFound === "number" ? json.meta.numFound : undefined;

  log.info("items:", items.length, "totalAvailable:", totalAvailable);
  if (items[0]) {
    log.info("sample item keys:", Object.keys(items[0]).join(","));
    log.info("sample item:", JSON.stringify(items[0]).slice(0, 600));
  }

  const listings: Listing[] = [];
  for (const it of items) {
    const listing = mapItem(it);
    if (listing) listings.push(listing);
  }

  return summarize(listings, totalAvailable, json.meta?.nextPageToken);
}

// ---- レスポンスマッピング ----

type MercariItem = {
  id?: string;
  name?: string;
  title?: string;
  price?: number | string;
  thumbnails?: (string | { uri?: string; url?: string })[];
  thumbnail?: string;
  photos?: { uri?: string; url?: string }[];
  status?: string;
  itemType?: string;
  shopName?: string;
  shop_name?: string;
  // 数値文字列で来ることがある
  itemConditionId?: number | string;
  item_condition_id?: number | string;
  itemCondition?: { id?: number | string; name?: string };
  item_condition?: { id?: number | string; name?: string };
  shippingPayer?: { id?: number | string; name?: string };
  shipping_payer?: { id?: number | string; name?: string };
  shippingPayerId?: number | string;
  shipping_payer_id?: number | string;
  numLikes?: number;
  num_likes?: number;
  numComments?: number;
  num_comments?: number;
  updated?: string | number;
  created?: string | number;
};

type MercariSearchResponse = {
  items?: MercariItem[];
  meta?: {
    nextPageToken?: string;
    numFound?: number;
  };
};

const ITEM_CONDITION_LABEL: Record<number, string> = {
  1: "新品、未使用",
  2: "未使用に近い",
  3: "目立った傷や汚れなし",
  4: "やや傷や汚れあり",
  5: "傷や汚れあり",
  6: "全体的に状態が悪い",
};

// 文字列でも数値でも数値化する (空文字や非数は undefined)
function toNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function mapItem(o: MercariItem): Listing | null {
  const id = typeof o.id === "string" ? o.id : "";
  if (!id) return null;
  const title =
    (typeof o.name === "string" && o.name.trim()) ||
    (typeof o.title === "string" && o.title.trim()) ||
    "";
  if (!title) return null;

  const price = toNum(o.price) ?? 0;
  if (price <= 0) return null;

  // サムネイル: thumbnails が文字列配列 or {uri} 配列、photos も {uri} 配列
  let thumbnail: string | undefined;
  if (Array.isArray(o.thumbnails) && o.thumbnails.length > 0) {
    const t = o.thumbnails[0];
    thumbnail =
      typeof t === "string" ? t : t?.uri ?? t?.url ?? undefined;
  }
  if (!thumbnail && Array.isArray(o.photos) && o.photos.length > 0) {
    thumbnail = o.photos[0]?.uri ?? o.photos[0]?.url ?? undefined;
  }
  if (!thumbnail && typeof o.thumbnail === "string") {
    thumbnail = o.thumbnail;
  }

  const conditionId =
    toNum(o.itemConditionId) ??
    toNum(o.item_condition_id) ??
    toNum(o.itemCondition?.id) ??
    toNum(o.item_condition?.id);
  const condition =
    o.itemCondition?.name ||
    o.item_condition?.name ||
    (conditionId !== undefined ? ITEM_CONDITION_LABEL[conditionId] : undefined);

  // 送料: id 1=出品者負担(送料無料) / 2=購入者負担 / 0=不明
  const payerId =
    toNum(o.shippingPayer?.id) ??
    toNum(o.shipping_payer?.id) ??
    toNum(o.shippingPayerId) ??
    toNum(o.shipping_payer_id);
  const shipping: "free" | "paid" | undefined =
    payerId === 1 ? "free" : payerId === 2 ? "paid" : undefined;

  const endedAt = toIso(o.updated) || toIso(o.created) || "";
  const likes = toNum(o.numLikes) ?? toNum(o.num_likes);

  // URL: メルカリショップ商品 (ITEM_TYPE_BEYOND) は /shops/product/{id}
  const isBeyond = o.itemType === "ITEM_TYPE_BEYOND";
  const url = isBeyond
    ? `https://jp.mercari.com/shops/product/${id}`
    : `https://jp.mercari.com/item/${id}`;

  // ストア / 個人 判別: ITEM_TYPE_BEYOND または shopName ありはストア
  const sellerType: "store" | "individual" =
    isBeyond || (typeof o.shopName === "string" && o.shopName.trim() !== "")
      ? "store"
      : "individual";

  return {
    id,
    title,
    price,
    endedAt,
    thumbnail,
    url,
    condition,
    shipping,
    likes,
    sellerType,
  };
}

function toIso(v: unknown): string {
  if (typeof v === "string" && v) {
    // 数字文字列 (unix seconds) も
    if (/^\d+$/.test(v)) {
      const n = Number(v);
      const d = new Date(n < 1e12 ? n * 1000 : n);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (typeof v === "number") {
    const d = new Date(v < 1e12 ? v * 1000 : v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return "";
}

function summarize(
  listings: Listing[],
  totalAvailable?: number,
  nextPageToken?: string,
): SourceResult {
  const prices = listings.map((l) => l.price).sort((a, b) => a - b);
  const count = listings.length;
  const hasNextPage = !!nextPageToken && nextPageToken !== "";
  if (count === 0) {
    return {
      source: "mercari",
      count: 0,
      median: 0,
      min: 0,
      max: 0,
      listings: [],
      totalAvailable,
      hasNextPage,
      nextPageToken,
    };
  }
  const median =
    count % 2 === 1
      ? prices[Math.floor(count / 2)]
      : Math.round((prices[count / 2 - 1] + prices[count / 2]) / 2);
  return {
    source: "mercari",
    count,
    median,
    min: prices[0],
    max: prices[count - 1],
    listings,
    totalAvailable,
    hasNextPage,
    nextPageToken,
  };
}
