import NetInfo from '@react-native-community/netinfo';

import type { Deal, DealSnapshot } from '@/types';
import { getCachedDeals, setCachedDeals } from './dealsCache';

/**
 * マクサスコア（CRM）との通信クライアント。
 *
 * 現時点では実APIが未提供のため、スタブ実装を返す。
 * 実装時は `fetchAssignedScheduledDeals` / `fetchDeal` を
 * 実際の HTTP クライアント（fetch + 認証ヘッダ）に差し替えればよい。
 *
 * 認証・査定担当者特定の方針:
 *   - マクサスコアは Google アカウント認証
 *   - 本アプリも Google サインイン → Firebase Auth で同じ Google アカウントを認証
 *   - 営業マンの email を「査定担当者の特定キー」として使う
 *   - サーバ側は Firebase Auth の ID トークンを Authorization: Bearer で受け取り検証、
 *     かつ各 Deal の assessorEmail が認証ユーザーの email と一致するもののみ返す
 *   - クライアント側でも assessorEmail を email 比較で再フィルタ（防御的）
 */

export type CrmContext = {
  firebaseIdToken: string | null;
  userEmail: string | null;
};

/**
 * マクサスコアのベース URL（本番）。
 * 環境別に切替えたい場合は app.config.ts の extra から読む形に変更可能。
 *
 * 本番:        https://core.makxas.xyz
 * ステージング: https://core-stg.makxas.net
 */
export const MAKXAS_BASE_URL = 'https://core.makxas.xyz';

/**
 * Deal から案件詳細ページの URL を取得する。
 * 形式: `${BASE}/projects/{案件ID}/edit`
 * 例: https://core.makxas.xyz/projects/qqpgo2hv811rf1vhse3knt0sqpm/edit
 *
 * `deal.dealUrl` が CRM API から返ってきている場合はそちらを優先する
 * （CRM 側で URL 形式が変わっても追従できるように）。
 */
export function getDealUrl(deal: { id: string; dealUrl?: string }): string {
  if (deal.dealUrl) return deal.dealUrl;
  return `${MAKXAS_BASE_URL}/projects/${encodeURIComponent(deal.id)}/edit`;
}

/**
 * email を正規化して比較する（小文字化、前後空白除去）。
 * Google アカウントの email は基本的にケースインセンシティブのため、
 * 大文字小文字違いで弾かれる事故を防ぐ。
 */
export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// ======================== スタブデータ ========================
// 実装時はこの mock ブロックを削除
const MOCK_ENABLED = true;

/**
 * モックの「自分」「他人」email。
 * 自分の email はログインユーザーで動的に上書きされる（mockMe 関数経由）。
 * これにより誰がログインしてもダッシュボードで動作確認できる。
 */
const FALLBACK_ME = 'demo@makxas.co.jp';
const SOMEONE_ELSE = 'other.staff@makxas.co.jp';

function mockMe(context: CrmContext): string {
  return context.userEmail || FALLBACK_ME;
}

/**
 * 過去の完了済み案件のモック。
 * 「録音漏れ」検知用に CRM 上で完了になっている案件を返す。
 *
 * 実装時: GET /api/projects?assessorEmail=...&status=completed&since=<7d ago>
 *
 * 過去7日内に完了した案件を返す前提。本物のデータでは、
 * このうちアプリ内に対応する recording.dealId が無いものが「録音漏れ」。
 */
export function mockPastCompletedDeals(context: CrmContext): Deal[] {
  const ME = mockMe(context);
  const now = Date.now();
  const days = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();
  // 90 日に分散させて、3ヶ月期間・1ヶ月期間・1週間期間それぞれで意味のある集計が出るように
  return [
    // 直近1週間 (5件、うち2件録音あり)
    { id: 'past_001', customerName: '高橋 二郎 様', customerAddress: '埼玉県さいたま市浦和区', reservationAt: days(1), assessorEmail: ME, assessorName: '自分', status: 'completed', items: '腕時計、ネックレス、指輪' },
    { id: 'past_002', customerName: '伊藤 三郎 様', customerAddress: '東京都世田谷区', reservationAt: days(2), assessorEmail: ME, assessorName: '自分', status: 'completed', items: 'ブランドバッグ2点、財布' },
    { id: 'past_003', customerName: '渡辺 四郎 様', customerAddress: '千葉県千葉市', reservationAt: days(3), assessorEmail: ME, assessorName: '自分', status: 'completed', items: '時計、コイン3点' },
    { id: 'past_004', customerName: '中村 五郎 様', customerAddress: '神奈川県川崎市', reservationAt: days(4), assessorEmail: ME, assessorName: '自分', status: 'completed', items: '着物一式' },
    { id: 'past_005', customerName: '小林 六郎 様', customerAddress: '東京都品川区', reservationAt: days(6), assessorEmail: ME, assessorName: '自分', status: 'completed', items: '貴金属、宝石類' },
    // 1ヶ月（8〜30日前、6件、うち2件録音あり）
    { id: 'past_006', customerName: '加藤 七郎 様', customerAddress: '東京都新宿区', reservationAt: days(9), assessorEmail: ME, assessorName: '自分', status: 'completed', items: 'ロレックス2点' },
    { id: 'past_007', customerName: '吉田 八郎 様', customerAddress: '神奈川県横浜市', reservationAt: days(12), assessorEmail: ME, assessorName: '自分', status: 'completed', items: 'ダイヤモンドネックレス' },
    { id: 'past_008', customerName: '山口 九郎 様', customerAddress: '千葉県市川市', reservationAt: days(15), assessorEmail: ME, assessorName: '自分', status: 'completed', items: '陶磁器コレクション' },
    { id: 'past_009', customerName: '松本 十郎 様', customerAddress: '埼玉県川越市', reservationAt: days(20), assessorEmail: ME, assessorName: '自分', status: 'completed', items: '切手、古銭' },
    { id: 'past_010', customerName: '井上 百一 様', customerAddress: '東京都目黒区', reservationAt: days(24), assessorEmail: ME, assessorName: '自分', status: 'completed', items: '骨董品3点' },
    { id: 'past_011', customerName: '木村 百二 様', customerAddress: '神奈川県藤沢市', reservationAt: days(28), assessorEmail: ME, assessorName: '自分', status: 'completed', items: 'ブランド時計、財布' },
    // 3ヶ月（31〜90日前、4件、うち1件録音あり）
    { id: 'past_012', customerName: '林 百三 様', customerAddress: '東京都杉並区', reservationAt: days(40), assessorEmail: ME, assessorName: '自分', status: 'completed', items: '宝石類、金貨' },
    { id: 'past_013', customerName: '清水 百四 様', customerAddress: '埼玉県越谷市', reservationAt: days(55), assessorEmail: ME, assessorName: '自分', status: 'completed', items: '着物、帯' },
    { id: 'past_014', customerName: '山本 百五 様', customerAddress: '千葉県松戸市', reservationAt: days(70), assessorEmail: ME, assessorName: '自分', status: 'completed', items: '楽器（バイオリン）' },
    { id: 'past_015', customerName: '池田 百六 様', customerAddress: '東京都板橋区', reservationAt: days(85), assessorEmail: ME, assessorName: '自分', status: 'completed', items: 'カメラ、レンズ多数' },
  ];
}

function mockDeals(context: CrmContext): Deal[] {
  const ME = mockMe(context);
  const now = Date.now();
  const minutes = (m: number) => new Date(now + m * 60 * 1000).toISOString();
  const hours = (h: number) => new Date(now + h * 60 * 60 * 1000).toISOString();
  // ID は本物の URL に近づけるため、makxas が使っている形式（小文字英数 26 桁前後）に合わせる
  return [
    // 動作確認用の常に直近にある案件（時間に関係なく必ずダッシュボードに表示される）
    {
      id: 'test_now_recording_target',
      customerName: '【テスト用】常時表示テスト案件 様',
      customerAddress: '東京都千代田区千代田1-1（テスト）',
      customerPhone: '090-9999-9999',
      reservationAt: minutes(30),
      assessorEmail: ME,
      assessorName: '自分',
      status: 'scheduled',
      items: '動作確認用テスト品目（録音テストにご利用ください）',
      notes: 'この案件は時刻に関係なく常に直近30分後の予定として表示されます',
    },
    {
      id: 'qqpgo2hv811rf1vhse3knt0sqpm',
      customerName: '田中 太郎 様',
      customerAddress: '東京都渋谷区恵比寿1-2-3',
      customerPhone: '090-0000-0001',
      reservationAt: hours(2),
      assessorEmail: ME,
      assessorName: '自分',
      status: 'scheduled',
      items: '腕時計（ロレックス）、ブランドバッグ数点',
      notes: 'マンション1階、駐車場あり',
    },
    {
      id: 'r5ynf3kbc92sg2wjte4lou1trqn',
      customerName: '山田 花子 様',
      customerAddress: '神奈川県横浜市港北区新横浜2-3-4',
      customerPhone: '090-0000-0002',
      reservationAt: hours(5),
      assessorEmail: ME,
      assessorName: '自分',
      status: 'scheduled',
      items: '着物一式、貴金属',
    },
    {
      id: 's6zog4lcd03th3xkuf5mpv2usro',
      customerName: '佐藤 次郎 様',
      customerAddress: '千葉県船橋市本町4-5-6',
      reservationAt: hours(26),
      assessorEmail: ME,
      assessorName: '自分',
      status: 'scheduled',
      items: '切手コレクション',
    },
    // 別の査定担当者の案件 → email 不一致でフィルタされて表示されない
    {
      id: 't7aph5mde14ui4ylvg6nqw3vtsp',
      customerName: '【他人案件】鈴木 三郎 様',
      customerAddress: '大阪府大阪市北区',
      reservationAt: hours(3),
      assessorEmail: SOMEONE_ELSE,
      assessorName: '別の営業マン',
      status: 'scheduled',
      items: 'これはあなたに割り当てられていない案件です',
    },
  ];
}
// =============================================================

async function httpGet<T>(_context: CrmContext, _path: string): Promise<T> {
  // 実装時: fetch(`${CRM_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  throw new Error('CRM HTTP client not implemented yet');
}

export type DealsResult = {
  deals: Deal[];
  /** どこから取得したか。UI で「オフライン中」表示の判断に使う */
  source: 'network' | 'cache';
  /** キャッシュから返した場合の取得時刻（ms） */
  cachedAt?: number;
};

/**
 * 自分が査定担当者に割り当てられており、予約中（scheduled）の案件のみを返す。
 * 予約日時が現在に近い順にソート済み。
 *
 * オフライン時はローカルキャッシュから返す（ユーザーごとに保存）。
 * クライアント側でも assessorEmail のチェックを再度行う（多層防御）。
 */
export async function fetchAssignedScheduledDeals(
  context: CrmContext,
): Promise<DealsResult> {
  const userKey = context.userEmail ?? 'anonymous';
  const now = Date.now();
  const sortAndFilter = (deals: Deal[]): Deal[] =>
    deals
      .filter((d) => d.status === 'scheduled')
      .filter((d) => emailsMatch(d.assessorEmail, context.userEmail))
      .sort((a, b) => {
        const da = Math.abs(new Date(a.reservationAt).getTime() - now);
        const db = Math.abs(new Date(b.reservationAt).getTime() - now);
        return da - db;
      });

  // オフラインの場合は最初からキャッシュを参照
  const net = await NetInfo.fetch();
  const offline = !net.isConnected || net.isInternetReachable === false;

  if (offline) {
    const cached = await getCachedDeals(userKey);
    if (cached) {
      return { deals: sortAndFilter(cached.deals), source: 'cache', cachedAt: cached.fetchedAt };
    }
    return { deals: [], source: 'cache', cachedAt: 0 };
  }

  // オンラインなら fetch を試みて、失敗したらキャッシュに fallback
  try {
    let raw: Deal[];
    if (MOCK_ENABLED) {
      raw = mockDeals(context);
    } else {
      raw = await httpGet<Deal[]>(
        context,
        `/api/deals?assessorEmail=${encodeURIComponent(context.userEmail ?? '')}&status=scheduled`,
      );
    }
    // 取得できた生データをそのまま（フィルタ前で）キャッシュ → 次回オフライン時にも使える
    await setCachedDeals(userKey, raw);
    return { deals: sortAndFilter(raw), source: 'network' };
  } catch (err) {
    const cached = await getCachedDeals(userKey);
    if (cached) {
      return {
        deals: sortAndFilter(cached.deals),
        source: 'cache',
        cachedAt: cached.fetchedAt,
      };
    }
    throw err;
  }
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

/**
 * 過去 N 日に完了した自分の案件を取得する。
 * アプリ側で recording の dealId と突き合わせ、欠けているものを
 * 「録音漏れ」として可視化する用途。
 */
export async function fetchRecentCompletedDeals(
  context: CrmContext,
  days = 7,
): Promise<Deal[]> {
  if (MOCK_ENABLED) {
    return mockPastCompletedDeals(context).filter((d) => emailsMatch(d.assessorEmail, context.userEmail));
  }
  return httpGet<Deal[]>(
    context,
    `/api/deals?assessorEmail=${encodeURIComponent(
      context.userEmail ?? '',
    )}&status=completed&since=${days}d`,
  );
}

/**
 * 議事録をマクサスコア側の案件メモへ書き戻す。
 * 現状はスタブ。実 API が用意され次第、CRM 側の対応エンドポイント
 * （例: POST /api/projects/{id}/notes）に置き換える。
 */
export async function postMinutesToCrm(
  context: CrmContext,
  dealId: string,
  body: { minutesText: string; audioUrl?: string; recordingId: string },
): Promise<{ ok: boolean }> {
  if (MOCK_ENABLED) {
    // eslint-disable-next-line no-console
    console.info('[crm:postMinutesToCrm:mock]', { dealId, ...body });
    await new Promise((r) => setTimeout(r, 600));
    return { ok: true };
  }
  const res = await httpGet<{ ok: boolean }>(
    context,
    `/api/projects/${encodeURIComponent(dealId)}/notes`,
  );
  return res;
}

export function toSnapshot(deal: Deal): DealSnapshot {
  return {
    id: deal.id,
    customerName: deal.customerName,
    reservationAt: deal.reservationAt,
    address: deal.customerAddress,
    items: deal.items,
    dealUrl: getDealUrl(deal),
  };
}
