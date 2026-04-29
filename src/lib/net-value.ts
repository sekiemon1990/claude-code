import type { SourceKey, ShippingType } from "./types";
import { estimateShipping } from "./shipping-estimate";

// プラットフォーム手数料（売り手側、概算）
export const PLATFORM_FEES: Record<SourceKey, number> = {
  yahoo_auction: 0.088, // 8.8%
  mercari: 0.10, // 10%
  jimoty: 0, // 直接取引
};

// 販売コスト目安（梱包・出品作業・撮影等）
type SalesCostRule = {
  size: string;
  amount: number;
};

const SALES_COST_BY_SIZE: SalesCostRule[] = [
  { size: "ネコポス", amount: 200 },
  { size: "ネコポス〜60", amount: 300 },
  { size: "ゆうパケット", amount: 200 },
  { size: "60サイズ", amount: 500 },
  { size: "80サイズ", amount: 700 },
  { size: "100サイズ", amount: 1000 },
  { size: "120サイズ", amount: 1300 },
  { size: "140サイズ", amount: 1700 },
  { size: "160サイズ", amount: 2200 },
  { size: "大型らくらく便", amount: 3500 },
  { size: "家財宅急便", amount: 5000 },
];

const PICKUP_COST = 0; // 引き取りは梱包・配送コスト不要

export type NetValueBreakdown = {
  listedPrice: number;
  platformFee: number;
  platformFeeRate: number;
  shippingCost: number;
  shippingSize: string;
  salesCost: number;
  netValue: number;
};

export function calculateNetValue({
  source,
  shipping,
  listedPrice,
  title,
}: {
  source: SourceKey;
  shipping: ShippingType | undefined;
  listedPrice: number;
  title: string;
}): NetValueBreakdown {
  const ship = estimateShipping(title);
  const platformFeeRate = PLATFORM_FEES[source];
  const platformFee = Math.round(listedPrice * platformFeeRate);

  let shippingCost = 0;
  let salesCost = 0;

  if (shipping === "free") {
    // 出品者が送料を負担。実質は表示価格 - 手数料 - 送料 - 販売コスト
    shippingCost = ship.amount;
    const sizeRule = SALES_COST_BY_SIZE.find((r) => r.size === ship.size);
    salesCost = sizeRule?.amount ?? 800;
  } else if (shipping === "paid") {
    // 買い手が別途送料負担。送料は控除対象外。販売コストのみ。
    shippingCost = 0;
    const sizeRule = SALES_COST_BY_SIZE.find((r) => r.size === ship.size);
    salesCost = sizeRule?.amount ?? 800;
  } else if (shipping === "pickup") {
    // 引き取り。手数料・送料・梱包コストなし
    shippingCost = 0;
    salesCost = PICKUP_COST;
  }

  const netValue = listedPrice - platformFee - shippingCost - salesCost;

  return {
    listedPrice,
    platformFee,
    platformFeeRate,
    shippingCost,
    shippingSize: ship.size,
    salesCost,
    netValue,
  };
}
