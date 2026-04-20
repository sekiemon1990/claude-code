import type { Recording, RecordingStatus, DealSnapshot } from '@/types';

/**
 * インメモリのデモストア。Firestore/Storage の代わりに録音データを保持し、
 * 文字起こし → 議事録生成のパイプラインを setTimeout でシミュレートする。
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
    setTimeout(() => patch(id, { status: 'uploaded' }), 1200);
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
