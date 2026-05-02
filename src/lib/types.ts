export type SourceKey = "yahoo_auction" | "mercari" | "jimoty";

export type SourceLabel = {
  key: SourceKey;
  name: string;
  shortName: string;
  status: "落札" | "売切" | "出品中";
  color: string;
};

export const SOURCES: SourceLabel[] = [
  {
    key: "yahoo_auction",
    name: "ヤフオク",
    shortName: "ヤフオク",
    status: "落札",
    color: "#ff0033",
  },
  {
    key: "mercari",
    name: "メルカリ",
    shortName: "メルカリ",
    status: "売切",
    color: "#ff0211",
  },
  {
    key: "jimoty",
    name: "ジモティー",
    shortName: "ジモティー",
    status: "出品中",
    color: "#1aa55c",
  },
];

export type ShippingType = "free" | "paid" | "pickup";

export type SellerType = "store" | "individual";

/**
 * 媒体ごとの「ストア」表記:
 * - メルカリ: "Shops" (Mercari Shops のブランド名)
 * - ヤフオク: "ストア" (Yahoo!ストア)
 * - ジモティー: "法人"
 */
export function getStoreLabel(source: SourceKey): string {
  switch (source) {
    case "mercari":
      return "Shops";
    case "jimoty":
      return "法人";
    case "yahoo_auction":
    default:
      return "ストア";
  }
}

export type Listing = {
  id: string;
  title: string;
  price: number;
  endedAt: string;
  thumbnail?: string;
  images?: string[];
  url: string;
  bidCount?: number;
  likes?: number;
  condition?: string;
  description?: string;
  sellerName?: string;
  sellerUrl?: string;
  sellerRating?: string;
  sellerType?: SellerType;
  shipping?: ShippingType;
  shippingInfo?: string;
  location?: string;
  accessories?: string[];
};

export type SourceResult = {
  source: SourceKey;
  count: number;
  median: number;
  min: number;
  max: number;
  listings: Listing[];
  // 媒体側に存在する総件数 (取得した listings.length は表示分のみ)
  totalAvailable?: number;
  // ページネーション情報 (次ページが存在すれば設定される)
  hasNextPage?: boolean;
  // メルカリ用の次ページトークン
  nextPageToken?: string;
};

export type SearchResult = {
  id: string;
  query: {
    keyword: string;
    excludes?: string;
    period: "7" | "30" | "60" | "90" | "180" | "365" | "all";
  };
  searchedAt: string;
  productGuess?: string;
  summary: {
    median: number;
    min: number;
    max: number;
    totalCount: number;
  };
  sources: SourceResult[];
};
