import type { Timestamp } from 'firebase/firestore';

export type RecordingStatus =
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
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  items?: string;
  notes?: string;
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
