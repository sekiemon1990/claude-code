import type { FirestoreTimestamp as Timestamp } from '@/config/firebase';

export type RecordingStatus =
  | 'recording'
  | 'uploading'
  | 'uploaded'
  | 'transcribing'
  | 'transcribed'
  | 'generating_minutes'
  | 'completed'
  | 'failed';

/**
 * マクサスコアの案件（出張買取の予約）。
 * アプリ内で録音に紐付ける対象。
 */
export type Deal = {
  id: string;
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  reservationAt: string; // ISO 8601
  assessorUid?: string;
  assessorEmail?: string;
  assessorName?: string;
  /** 予約担当者 (インサイドセールス担当)。査定担当 (assessor*) とは別の役割 */
  insideSalesName?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  items?: string;
  notes?: string;
  /** マクサスコアの案件詳細ページ URL。未指定時はベース URL から生成 */
  dealUrl?: string;
};

/**
 * 録音作成時に凍結する案件情報スナップショット。
 * CRM 側で後から案件が更新されても、録音時点の状態を残す。
 */
export type DealSnapshot = {
  id: string;
  customerName: string;
  reservationAt: string;
  address?: string;
  items?: string;
  dealUrl?: string;
  /** 予約担当者 (インサイドセールス担当)。Chatwork 通知に表示するため snapshot に含める */
  insideSalesName?: string;
};

export type Recording = {
  id: string;
  ownerUid: string;
  dealId: string;
  dealSnapshot: DealSnapshot;
  title: string;
  storagePath: string;
  downloadUrl?: string;
  durationMs: number;
  status: RecordingStatus;
  errorMessage?: string;
  transcript?: string;
  minutes?: Minutes;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Chatwork 通知 / 録音ライフサイクル用フィールド (2026-05 追加)。
  // 既存ドキュメントは 'recording' を経由しないため全て optional。
  assessorName?: string;
  recordingStartedAt?: Timestamp;
  recordingEndedAt?: Timestamp | null;
  chatworkNotifiedStartAt?: Timestamp | null;
  chatworkNotifiedEndAt?: Timestamp | null;
};

export type Minutes = {
  summary: string;
  customerInfo: string;
  items: string;
  offeredPrice: string;
  nextActions: string;
  generatedAt: Timestamp;
};

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
};
