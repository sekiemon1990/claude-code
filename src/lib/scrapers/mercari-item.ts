import { generateMercariDpop } from "./mercari-dpop";
import { createLogger } from "@/lib/logger";

const log = createLogger("mercari-item");

/**
 * メルカリ個別商品 API (DPoP 認証)
 *
 * 検索 API では description や複数画像が返ってこないので、
 * 詳細ページ表示時に追加で個別 fetch する。
 */

export type MercariItemDetail = {
  id: string;
  description?: string;
  images?: string[];
  price?: number;
  condition?: string;
  shipping?: "free" | "paid";
  shippingInfo?: string;
  shippingFromArea?: string;
  sellerName?: string;
  sellerUrl?: string;
  sellerRating?: string;
  likes?: number;
};

const ITEM_CONDITION_LABEL: Record<number, string> = {
  1: "新品、未使用",
  2: "未使用に近い",
  3: "目立った傷や汚れなし",
  4: "やや傷や汚れあり",
  5: "傷や汚れあり",
  6: "全体的に状態が悪い",
};

// メルカリ ID 形式の判定:
// - C2C (個人出品): "m" + 11 桁数字 (例: m12345678901)
// - Shops (BEYOND): 20+ 文字英数字 (例: 2JQYNqmAsfzVn35DzpxxDu)
function isMercariShopsId(id: string): boolean {
  return !/^m\d{10,}$/i.test(id);
}

export async function scrapeMercariItem(
  id: string,
): Promise<MercariItemDetail> {
  // Shops 商品は /items/get では取れないため、SSR HTML パースに切り替え
  if (isMercariShopsId(id)) {
    return scrapeMercariShopProduct(id);
  }

  const url = `https://api.mercari.jp/items/get?id=${encodeURIComponent(id)}`;
  const dpop = generateMercariDpop("GET", url);

  log.info("fetching:", url);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "*/*",
      "X-Platform": "web",
      DPoP: dpop,
    },
    cache: "no-store",
  });

  log.info("status:", res.status);

  if (!res.ok) {
    const text = await res.text();
    log.error("error:", text.slice(0, 500));
    throw new Error(`メルカリ商品 API エラー: ${res.status}`);
  }

  const json = (await res.json()) as MercariItemResponse;
  const data = json.data;
  if (!data) {
    log.warn("no data field in response");
    return { id };
  }

  log.info("keys:", Object.keys(data).slice(0, 30).join(","));

  const photos = pickPhotos(data);
  const condition =
    data.item_condition?.name ??
    (typeof data.item_condition_id === "number"
      ? ITEM_CONDITION_LABEL[data.item_condition_id]
      : undefined);

  // 送料
  const shipping: "free" | "paid" | undefined =
    data.shipping_payer?.id === 1
      ? "free"
      : data.shipping_payer?.id === 2
        ? "paid"
        : undefined;
  const shippingInfo = [
    data.shipping_method?.name,
    data.shipping_duration?.name,
  ]
    .filter(Boolean)
    .join(" / ") || undefined;

  // 出品者
  const seller = data.seller;
  const sellerName = seller?.name?.trim() || undefined;
  const sellerUrl = seller?.id
    ? `https://jp.mercari.com/user/profile/${seller.id}`
    : undefined;
  const sellerRating =
    typeof seller?.score === "number" || typeof seller?.num_ratings === "number"
      ? formatSellerRating(seller.score, seller.num_ratings)
      : undefined;

  const result: MercariItemDetail = {
    id,
    description:
      typeof data.description === "string" && data.description.trim()
        ? data.description.trim()
        : undefined,
    images: photos.length > 0 ? photos : undefined,
    price: typeof data.price === "number" ? data.price : undefined,
    condition,
    shipping,
    shippingInfo,
    shippingFromArea: data.shipping_from_area?.name ?? undefined,
    sellerName,
    sellerUrl,
    sellerRating,
    likes: typeof data.num_likes === "number" ? data.num_likes : undefined,
  };

  log.info("mapped:", {
    hasDescription: !!result.description,
    descLen: result.description?.length ?? 0,
    imageCount: result.images?.length ?? 0,
    condition: result.condition,
    shipping: result.shipping,
    sellerName: result.sellerName,
    likes: result.likes,
  });

  return result;
}

// ---- Mercari Shops (BEYOND) 商品: SSR HTML パース ----

const SHOP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

async function scrapeMercariShopProduct(
  id: string,
): Promise<MercariItemDetail> {
  const url = `https://jp.mercari.com/shops/product/${id}`;
  log.info("fetching shop product:", url);

  const res = await fetch(url, {
    headers: {
      "User-Agent": SHOP_USER_AGENT,
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
    cache: "no-store",
  });

  log.info("shop status:", res.status);
  if (!res.ok) {
    throw new Error(`メルカリショップ商品ページ取得エラー: ${res.status}`);
  }

  const html = await res.text();
  log.info("shop html size:", html.length);

  // __NEXT_DATA__ を抽出
  const m = html.match(
    /<script\s+id="__NEXT_DATA__"\s+type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!m) {
    log.warn("__NEXT_DATA__ not found in shop page");
    return { id };
  }

  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch (e) {
    log.error("__NEXT_DATA__ parse failed:", e);
    return { id };
  }

  // Shops 商品ノードを再帰探索 (id, name, price を持つ)
  const product = findShopProduct(data, id);
  if (!product) {
    log.warn("shop product node not found");
    return { id };
  }

  log.info("shop product keys:", Object.keys(product).slice(0, 30).join(","));

  // 画像: thumbnails / images / productImage[].url 等
  const images = extractShopImages(product);

  // 商品説明
  const description =
    pickStr(product, "description") ||
    pickStr(product, "productDescription") ||
    pickStr(product, "detailDescription") ||
    undefined;

  // 状態
  const conditionId =
    pickNum(product, "itemConditionId") ??
    pickNum(product, "condition_id") ??
    pickNum(product, "conditionId");
  const conditionName =
    pickStr(product, "itemConditionName") ||
    pickStr(pickObj(product, "itemCondition"), "name") ||
    pickStr(pickObj(product, "condition"), "name");
  const condition =
    conditionName ||
    (typeof conditionId === "number"
      ? ITEM_CONDITION_LABEL[conditionId]
      : undefined);

  // 価格
  const price = pickNum(product, "price") ?? undefined;

  // ショップ情報 (出品者の代わり)
  const shop = pickObj(product, "shop") ?? pickObj(product, "store");
  const sellerName =
    pickStr(product, "shopName") ||
    pickStr(shop, "name") ||
    pickStr(shop, "shopName") ||
    undefined;
  const shopId = pickStr(product, "shopId") || pickStr(shop, "id") || "";
  const sellerUrl = shopId
    ? `https://jp.mercari.com/shops/${shopId}`
    : undefined;

  // 送料: shipping_payer.id 1=出品者(無料) / 2=購入者
  const shippingPayerId =
    pickNum(pickObj(product, "shippingPayer"), "id") ??
    pickNum(product, "shippingPayerId");
  const shipping: "free" | "paid" | undefined =
    shippingPayerId === 1
      ? "free"
      : shippingPayerId === 2
        ? "paid"
        : undefined;
  const shippingMethod =
    pickStr(pickObj(product, "shippingMethod"), "name") ||
    pickStr(pickObj(product, "shipping_method"), "name");
  const shippingDuration =
    pickStr(pickObj(product, "shippingDuration"), "name") ||
    pickStr(pickObj(product, "shipping_duration"), "name");
  const shippingInfo =
    [shippingMethod, shippingDuration].filter(Boolean).join(" / ") ||
    undefined;
  const shippingFromArea =
    pickStr(pickObj(product, "shippingFromArea"), "name") ||
    pickStr(pickObj(product, "shipping_from_area"), "name");

  const result: MercariItemDetail = {
    id,
    description,
    images: images.length > 0 ? images : undefined,
    price,
    condition,
    shipping,
    shippingInfo,
    shippingFromArea,
    sellerName,
    sellerUrl,
  };

  log.info("shop mapped:", {
    hasDescription: !!result.description,
    descLen: result.description?.length ?? 0,
    imageCount: result.images?.length ?? 0,
    condition: result.condition,
    sellerName: result.sellerName,
    shipping: result.shipping,
  });

  return result;
}

// __NEXT_DATA__ から id 一致 or 商品ノードらしき object を再帰探索
function findShopProduct(
  node: unknown,
  targetId: string,
  depth = 0,
): Record<string, unknown> | null {
  if (depth > 14) return null;
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const c of node) {
      const found = findShopProduct(c, targetId, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const o = node as Record<string, unknown>;
  // id 一致 + name/price あれば確定
  const idMatch =
    o.id === targetId || o.productId === targetId || o.product_id === targetId;
  const hasFields =
    typeof o.name === "string" || typeof o.productName === "string";
  if (idMatch && hasFields) return o;
  for (const v of Object.values(o)) {
    const found = findShopProduct(v, targetId, depth + 1);
    if (found) return found;
  }
  return null;
}

function extractShopImages(o: Record<string, unknown>): string[] {
  const out: string[] = [];
  // 検索結果と同じ photos / thumbnails 形式
  const photos = o.photos;
  if (Array.isArray(photos)) {
    for (const p of photos) {
      if (typeof p === "string") out.push(p);
      else if (p && typeof p === "object") {
        const url =
          (p as Record<string, unknown>).url ??
          (p as Record<string, unknown>).uri;
        if (typeof url === "string") out.push(url);
      }
    }
  }
  if (out.length === 0 && Array.isArray(o.thumbnails)) {
    for (const t of o.thumbnails as unknown[]) {
      if (typeof t === "string") out.push(t);
    }
  }
  if (out.length === 0) {
    // productImage[] / images[] 等のフォールバック
    const arr =
      (Array.isArray(o.productImage) && o.productImage) ||
      (Array.isArray(o.images) && o.images) ||
      null;
    if (arr) {
      for (const it of arr) {
        if (typeof it === "string") out.push(it);
        else if (it && typeof it === "object") {
          const u =
            (it as Record<string, unknown>).url ??
            (it as Record<string, unknown>).uri;
          if (typeof u === "string") out.push(u);
        }
      }
    }
  }
  return out;
}

function pickStr(
  o: Record<string, unknown> | undefined | null,
  key: string,
): string | undefined {
  if (!o) return undefined;
  const v = o[key];
  return typeof v === "string" && v.trim() ? v : undefined;
}

function pickNum(
  o: Record<string, unknown> | undefined | null,
  key: string,
): number | undefined {
  if (!o) return undefined;
  const v = o[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function pickObj(
  o: Record<string, unknown> | undefined | null,
  key: string,
): Record<string, unknown> | undefined {
  if (!o) return undefined;
  const v = o[key];
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

function pickPhotos(d: MercariItemData): string[] {
  if (Array.isArray(d.photos) && d.photos.length > 0) {
    return d.photos
      .map((p) => (typeof p === "string" ? p : p?.url))
      .filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  if (Array.isArray(d.thumbnails) && d.thumbnails.length > 0) {
    return d.thumbnails.filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );
  }
  return [];
}

function formatSellerRating(
  score: number | undefined,
  ratings: number | undefined,
): string {
  if (typeof score === "number" && typeof ratings === "number") {
    // メルカリの評価は 0.0 〜 5.0 表示が多い
    return `★ ${score.toFixed(1)} (${ratings}件)`;
  }
  if (typeof ratings === "number") return `${ratings}件の評価`;
  if (typeof score === "number") return `★ ${score.toFixed(1)}`;
  return "";
}

// ---- レスポンス型 ----

type MercariPhoto = string | { url?: string };

type MercariItemData = {
  id?: string;
  name?: string;
  description?: string;
  photos?: MercariPhoto[];
  thumbnails?: string[];
  price?: number;
  status?: string;
  item_condition_id?: number;
  item_condition?: { id?: number; name?: string };
  shipping_payer?: { id?: number; name?: string };
  shipping_method?: { id?: number; name?: string };
  shipping_duration?: { id?: number; name?: string };
  shipping_from_area?: { id?: number; name?: string };
  num_likes?: number;
  num_comments?: number;
  seller?: {
    id?: number;
    name?: string;
    photo_url?: string;
    num_ratings?: number;
    score?: number;
  };
};

type MercariItemResponse = {
  result?: string;
  data?: MercariItemData;
};
