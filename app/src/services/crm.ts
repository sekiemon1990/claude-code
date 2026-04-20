import type { Deal, DealSnapshot } from '@/types';

/**
 * マクサスコア（CRM）との通信クライアント。
 *
 * 現時点では実APIが未提供のため、スタブ実装を返す。
 * 実装時は `fetchAssignedScheduledDeals` / `fetchDeal` を
 * 実際の HTTP クライアント（fetch + 認証ヘッダ）に差し替えればよい。
 *
 * 認証方針（暫定）:
 *   マクサスコアは Google アカウント認証のため、Firebase Auth の ID トークンを
 *   Authorization: Bearer として送信し、サーバ側で検証する想定。
 */

export type CrmContext = {
  firebaseIdToken: string | null;
  userEmail: string | null;
};

// ======================== スタブデータ ========================
// 実装時はこの mock ブロックを削除
const MOCK_ENABLED = true;

function mockDeals(context: CrmContext): Deal[] {
  const now = Date.now();
  const hours = (h: number) => new Date(now + h * 60 * 60 * 1000).toISOString();
  return [
    {
      id: 'deal_001',
      customerName: '田中 太郎 様',
      customerAddress: '東京都渋谷区恵比寿1-2-3',
      customerPhone: '090-0000-0001',
      reservationAt: hours(2),
      assessorEmail: context.userEmail ?? undefined,
      assessorName: '（自分）',
      status: 'scheduled',
      items: '腕時計（ロレックス）、ブランドバッグ数点',
      notes: 'マンション1階、駐車場あり',
    },
    {
      id: 'deal_002',
      customerName: '山田 花子 様',
      customerAddress: '神奈川県横浜市港北区新横浜2-3-4',
      customerPhone: '090-0000-0002',
      reservationAt: hours(5),
      assessorEmail: context.userEmail ?? undefined,
      assessorName: '（自分）',
      status: 'scheduled',
      items: '着物一式、貴金属',
    },
    {
      id: 'deal_003',
      customerName: '佐藤 次郎 様',
      customerAddress: '千葉県船橋市本町4-5-6',
      reservationAt: hours(26),
      assessorEmail: context.userEmail ?? undefined,
      assessorName: '（自分）',
      status: 'scheduled',
      items: '切手コレクション',
    },
  ];
}
// =============================================================

async function httpGet<T>(_context: CrmContext, _path: string): Promise<T> {
  // 実装時: fetch(`${CRM_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  throw new Error('CRM HTTP client not implemented yet');
}

/**
 * 自分が査定担当者に割り当てられており、予約中（scheduled）の案件のみを返す。
 * 予約日時が現在に近い順にソート済み。
 */
export async function fetchAssignedScheduledDeals(context: CrmContext): Promise<Deal[]> {
  let deals: Deal[];
  if (MOCK_ENABLED) {
    deals = mockDeals(context);
  } else {
    deals = await httpGet<Deal[]>(
      context,
      `/api/deals?assessorEmail=${encodeURIComponent(context.userEmail ?? '')}&status=scheduled`,
    );
  }

  const now = Date.now();
  return deals
    .filter((d) => d.status === 'scheduled')
    .sort((a, b) => {
      const da = Math.abs(new Date(a.reservationAt).getTime() - now);
      const db = Math.abs(new Date(b.reservationAt).getTime() - now);
      return da - db;
    });
}

/**
 * Deal ID から案件詳細を取得。ディープリンク経由で案件が指定された時に使う。
 * 呼び出し側で「自分が担当か」「予約中か」を検証することを推奨。
 */
export async function fetchDeal(context: CrmContext, dealId: string): Promise<Deal | null> {
  if (MOCK_ENABLED) {
    const all = mockDeals(context);
    return all.find((d) => d.id === dealId) ?? null;
  }
  return httpGet<Deal | null>(context, `/api/deals/${encodeURIComponent(dealId)}`);
}

export function toSnapshot(deal: Deal): DealSnapshot {
  return {
    id: deal.id,
    customerName: deal.customerName,
    reservationAt: deal.reservationAt,
    address: deal.customerAddress,
    items: deal.items,
  };
}
