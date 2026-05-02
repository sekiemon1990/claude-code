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

export async function scrapeMercariItem(
  id: string,
): Promise<MercariItemDetail> {
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
