import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import type { Listing, SourceResult } from "@/lib/types";

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
};

export async function scrapeMercari(
  options: MercariScrapeOptions,
): Promise<SourceResult> {
  const { keyword, excludes, limit = 30 } = options;

  const body = {
    userId: "",
    pageSize: limit,
    pageToken: "",
    searchSessionId: randomUUID(),
    indexRouting: "INDEX_ROUTING_UNSPECIFIED",
    thumbnailTypes: [],
    searchCondition: {
      keyword,
      excludeKeyword: excludes ?? "",
      sort: "SORT_CREATED_TIME",
      order: "ORDER_DESC",
      status: ["STATUS_SOLD_OUT"],
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

  const dpop = generateDpop("POST", API_URL);

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

  console.log("[mercari-scrape] status:", res.status);

  if (!res.ok) {
    const text = await res.text();
    console.error(
      "[mercari-scrape] error response:",
      text.slice(0, 500),
    );
    throw new Error(`メルカリ API エラー: ${res.status}`);
  }

  const json = (await res.json()) as MercariSearchResponse;
  const items = Array.isArray(json.items) ? json.items : [];
  const totalAvailable =
    typeof json.meta?.numFound === "number" ? json.meta.numFound : undefined;

  console.log(
    "[mercari-scrape] items:",
    items.length,
    "totalAvailable:",
    totalAvailable,
  );
  if (items[0]) {
    console.log(
      "[mercari-scrape] sample item keys:",
      Object.keys(items[0]).join(","),
    );
    console.log(
      "[mercari-scrape] sample item:",
      JSON.stringify(items[0]).slice(0, 600),
    );
  }

  const listings: Listing[] = [];
  for (const it of items) {
    const listing = mapItem(it);
    if (listing) listings.push(listing);
  }

  return summarize(listings, totalAvailable);
}

// ---- DPoP 生成 ----

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function generateDpop(method: string, url: string): string {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const jwk = publicKey.export({ format: "jwk" }) as {
    kty?: string;
    crv?: string;
    x?: string;
    y?: string;
  };
  const header = {
    alg: "ES256",
    typ: "dpop+jwt",
    jwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
  };
  const payload = {
    iat: Math.floor(Date.now() / 1000),
    jti: randomUUID(),
    htu: url,
    htm: method,
    uuid: randomUUID(),
  };

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  // ES256 = ECDSA(P-256, SHA-256), JWS は raw r||s 形式 (= ieee-p1363)
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  const signatureB64 = base64UrlEncode(signature);

  return `${signingInput}.${signatureB64}`;
}

// ---- レスポンスマッピング ----

type MercariItem = {
  id?: string;
  name?: string;
  price?: number | string;
  thumbnails?: string[];
  thumbnail?: string;
  status?: string;
  // camelCase / snake_case 両方ありうる (v2 とレガシーで揺れる)
  itemConditionId?: number;
  item_condition_id?: number;
  itemCondition?: { id?: number; name?: string };
  item_condition?: { id?: number; name?: string };
  shippingPayer?: { id?: number; name?: string };
  shipping_payer?: { id?: number; name?: string };
  shippingPayerId?: number;
  shipping_payer_id?: number;
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

function mapItem(o: MercariItem): Listing | null {
  const id = typeof o.id === "string" ? o.id : "";
  if (!id) return null;
  const title = typeof o.name === "string" ? o.name : "";
  if (!title) return null;
  const price =
    typeof o.price === "number"
      ? o.price
      : typeof o.price === "string"
        ? Number(o.price)
        : 0;
  if (!Number.isFinite(price) || price <= 0) return null;

  const thumbnail =
    (Array.isArray(o.thumbnails) && typeof o.thumbnails[0] === "string"
      ? o.thumbnails[0]
      : undefined) || (typeof o.thumbnail === "string" ? o.thumbnail : undefined);

  const conditionId =
    (typeof o.itemConditionId === "number" ? o.itemConditionId : undefined) ??
    (typeof o.item_condition_id === "number"
      ? o.item_condition_id
      : undefined) ??
    o.itemCondition?.id ??
    o.item_condition?.id;
  const condition =
    o.itemCondition?.name ||
    o.item_condition?.name ||
    (typeof conditionId === "number"
      ? ITEM_CONDITION_LABEL[conditionId]
      : undefined);

  // 送料: id 1=出品者負担(送料無料) / 2=購入者負担
  const payerId =
    o.shippingPayer?.id ??
    o.shipping_payer?.id ??
    o.shippingPayerId ??
    o.shipping_payer_id;
  const shipping: "free" | "paid" | undefined =
    payerId === 1 ? "free" : payerId === 2 ? "paid" : undefined;

  const endedAt = toIso(o.updated) || toIso(o.created) || "";
  const likes =
    typeof o.numLikes === "number"
      ? o.numLikes
      : typeof o.num_likes === "number"
        ? o.num_likes
        : undefined;

  return {
    id,
    title,
    price,
    endedAt,
    thumbnail,
    url: `https://jp.mercari.com/item/${id}`,
    condition,
    shipping,
    likes,
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
): SourceResult {
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
      totalAvailable,
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
  };
}
