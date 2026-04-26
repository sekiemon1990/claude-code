import type { Recording, RecordingStatus, DealSnapshot } from '@/types';

/**
 * インメモリのデモストア。Firestore/Storage の代わりに録音データを保持し、
 * 文字起こし → 議事録生成のパイプラインを setTimeout でシミュレートする。
 *
 * モジュール読み込み時に、過去の完了済み録音を seed することで、
 * ダッシュボードの集計（平均査定時間 / 収益性 / 録音漏れ率 など）が
 * デモ初回起動時から意味のある値を表示できるようにする。
 */

type Listener = (items: Recording[]) => void;
type DetailListener = (item: Recording | null) => void;

let autoId = 1;
const records = new Map<string, Recording>();
const listListeners = new Set<Listener>();
const detailListeners = new Map<string, Set<DetailListener>>();

function now() {
  // Firestore Timestamp 互換の { toDate() } オブジェクトを返す
  const d = new Date();
  return {
    toDate: () => d,
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
  } as unknown as Recording['createdAt'];
}

function emitList() {
  const items = Array.from(records.values()).sort((a, b) => {
    const at = a.createdAt?.toDate().getTime() ?? 0;
    const bt = b.createdAt?.toDate().getTime() ?? 0;
    return bt - at;
  });
  listListeners.forEach((l) => l(items));
}

function emitDetail(id: string) {
  const item = records.get(id) ?? null;
  detailListeners.get(id)?.forEach((l) => l(item));
}

function patch(id: string, patch: Partial<Recording>) {
  const cur = records.get(id);
  if (!cur) return;
  const next: Recording = {
    ...cur,
    ...patch,
    updatedAt: now(),
  };
  records.set(id, next);
  emitList();
  emitDetail(id);
}

export const demoStore = {
  subscribeList(onUpdate: Listener) {
    listListeners.add(onUpdate);
    onUpdate(Array.from(records.values()));
    return () => {
      listListeners.delete(onUpdate);
    };
  },

  subscribeDetail(id: string, onUpdate: DetailListener) {
    let set = detailListeners.get(id);
    if (!set) {
      set = new Set();
      detailListeners.set(id, set);
    }
    set.add(onUpdate);
    onUpdate(records.get(id) ?? null);
    return () => {
      set!.delete(onUpdate);
      if (set!.size === 0) detailListeners.delete(id);
    };
  },

  createAndSimulate(params: {
    ownerUid: string;
    dealSnapshot: DealSnapshot;
    title: string;
    durationMs: number;
  }): string {
    const id = `demo_rec_${autoId++}`;
    const rec: Recording = {
      id,
      ownerUid: params.ownerUid,
      dealId: params.dealSnapshot.id,
      dealSnapshot: params.dealSnapshot,
      title: params.title,
      storagePath: `demo/${id}/audio.m4a`,
      downloadUrl: undefined,
      durationMs: params.durationMs,
      status: 'uploading' satisfies RecordingStatus,
      createdAt: now(),
      updatedAt: now(),
    };
    records.set(id, rec);
    emitList();
    emitDetail(id);

    // シミュレーション: uploading → uploaded → transcribing → transcribed → generating_minutes → completed
    setTimeout(
      () =>
        patch(id, {
          status: 'uploaded',
          downloadUrl: `https://demo-storage.makxas.xyz/recordings/${id}/audio.m4a`,
        }),
      1200,
    );
    setTimeout(() => patch(id, { status: 'transcribing' }), 2400);
    setTimeout(
      () =>
        patch(id, {
          status: 'transcribed',
          transcript: makeFakeTranscript(params.dealSnapshot),
        }),
      5000,
    );
    setTimeout(() => patch(id, { status: 'generating_minutes' }), 5800);
    setTimeout(
      () =>
        patch(id, {
          status: 'completed',
          minutes: {
            summary: `${params.dealSnapshot.customerName}のご自宅で出張買取の商談を実施。査定品目の状態確認と金額交渉を行った。最終的に買取条件について合意に至った。`,
            customerInfo: `${params.dealSnapshot.customerName}、${
              params.dealSnapshot.address ?? '住所記載なし'
            }`,
            items: params.dealSnapshot.items ?? '記載なし',
            offeredPrice: '合計 280,000 円で合意',
            nextActions: '書類一式を3営業日以内に郵送、入金は翌週月曜',
            generatedAt: now(),
          },
        }),
      8500,
    );

    return id;
  },

  remove(id: string) {
    records.delete(id);
    emitList();
    emitDetail(id);
  },
};

// ============= 過去録音の seed（デモ用の履歴データ） =============

type SeedSpec = {
  recordingId: string;
  dealId: string;
  customerName: string;
  reservationDaysAgo: number;
  address: string;
  items: string;
  durationSec: number;
  offeredPriceText: string;
};

function makeTimestamp(daysAgo: number): Recording['createdAt'] {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    toDate: () => d,
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
  } as unknown as Recording['createdAt'];
}

const SEEDS: SeedSpec[] = [
  // 直近1週間
  {
    recordingId: 'seed_001',
    dealId: 'past_001',
    customerName: '高橋 二郎 様',
    reservationDaysAgo: 1,
    address: '埼玉県さいたま市浦和区',
    items: '腕時計、ネックレス、指輪',
    durationSec: 32 * 60,
    offeredPriceText: '合計 320,000 円で合意',
  },
  {
    recordingId: 'seed_002',
    dealId: 'past_002',
    customerName: '伊藤 三郎 様',
    reservationDaysAgo: 2,
    address: '東京都世田谷区',
    items: 'ブランドバッグ2点、財布',
    durationSec: 22 * 60,
    offeredPriceText: '合計 180,000 円で合意',
  },
  // 1ヶ月以内
  {
    recordingId: 'seed_003',
    dealId: 'past_006',
    customerName: '加藤 七郎 様',
    reservationDaysAgo: 9,
    address: '東京都新宿区',
    items: 'ロレックス2点',
    durationSec: 28 * 60,
    offeredPriceText: '合計 850,000 円で合意',
  },
  {
    recordingId: 'seed_004',
    dealId: 'past_007',
    customerName: '吉田 八郎 様',
    reservationDaysAgo: 12,
    address: '神奈川県横浜市',
    items: 'ダイヤモンドネックレス',
    durationSec: 18 * 60,
    offeredPriceText: '合計 450,000 円で合意',
  },
  // 3ヶ月以内（1件のみ録音あり）
  {
    recordingId: 'seed_005',
    dealId: 'past_012',
    customerName: '林 百三 様',
    reservationDaysAgo: 40,
    address: '東京都杉並区',
    items: '宝石類、金貨',
    durationSec: 35 * 60,
    offeredPriceText: '合計 1,200,000 円で合意',
  },
];

function seedHistoricalRecordings() {
  for (const s of SEEDS) {
    const ts = makeTimestamp(s.reservationDaysAgo);
    const rec: Recording = {
      id: s.recordingId,
      ownerUid: 'demo-user-01',
      dealId: s.dealId,
      dealSnapshot: {
        id: s.dealId,
        customerName: s.customerName,
        reservationAt: new Date(
          Date.now() - s.reservationDaysAgo * 24 * 60 * 60 * 1000,
        ).toISOString(),
        address: s.address,
        items: s.items,
      },
      title: s.customerName,
      storagePath: `demo/${s.recordingId}/audio.m4a`,
      downloadUrl: `https://demo-storage.makxas.xyz/recordings/${s.recordingId}/audio.m4a`,
      durationMs: s.durationSec * 1000,
      status: 'completed',
      transcript: '（過去録音のダミー文字起こし）',
      minutes: {
        summary: `${s.customerName}との出張買取商談。合意に至った。`,
        customerInfo: `${s.customerName}、${s.address}`,
        items: s.items,
        offeredPrice: s.offeredPriceText,
        nextActions: '書類送付、入金処理',
        generatedAt: ts,
      },
      createdAt: ts,
      updatedAt: ts,
    };
    records.set(s.recordingId, rec);
  }
}

// モジュール読み込み時に1回だけ seed
seedHistoricalRecordings();

// =================================================================

function makeFakeTranscript(deal: DealSnapshot): string {
  return [
    `営業: ${deal.customerName}、本日はお時間いただきありがとうございます。出張買取のご予約で伺いました。`,
    `お客様: よろしくお願いします。${deal.items ?? 'お願いしていた品物'}を見ていただけますか。`,
    '営業: 承知しました。まず状態を確認させてください。…… なるほど、保存状態が大変良いですね。',
    'お客様: 長年大切に保管していたものなんです。',
    '営業: それでしたら、査定額として弊社からは 合計 280,000 円でご提示させていただきます。',
    'お客様: 思ったより良い金額ですね。それでお願いします。',
    '営業: ありがとうございます。書類一式を3営業日以内に郵送し、入金は翌週月曜となります。',
    'お客様: はい、承知しました。よろしくお願いします。',
  ].join('\n');
}
