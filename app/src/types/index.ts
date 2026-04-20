import type { Timestamp } from 'firebase/firestore';

export type RecordingStatus =
  | 'uploading'
  | 'uploaded'
  | 'transcribing'
  | 'transcribed'
  | 'generating_minutes'
  | 'completed'
  | 'failed';

export type Recording = {
  id: string;
  ownerUid: string;
  title: string;
  storagePath: string;
  downloadUrl?: string;
  durationMs: number;
  status: RecordingStatus;
  errorMessage?: string;
  transcript?: string;
  minutes?: Minutes;
  // 将来的にマクサスコアの案件IDを紐付ける
  crmDealId?: string | null;
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
