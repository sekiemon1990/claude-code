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

export type Listing = {
  id: string;
  title: string;
  price: number;
  endedAt: string;
  thumbnail?: string;
  url: string;
  bidCount?: number;
  condition?: string;
};

export type SourceResult = {
  source: SourceKey;
  count: number;
  median: number;
  min: number;
  max: number;
  listings: Listing[];
};

export type SearchResult = {
  id: string;
  query: {
    keyword: string;
    model?: string;
    excludes?: string;
    period: "30" | "90" | "all";
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
