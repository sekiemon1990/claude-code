import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

import { postToRoom } from './chatwork';
import { formatJstDateTime } from './formatJst';

type RecordingDoc = {
  status?: string;
  assessorName?: string;
  recordingStartedAt?: admin.firestore.Timestamp;
  chatworkNotifiedStartAt?: admin.firestore.Timestamp | null;
  dealSnapshot?: {
    customerName?: string;
    address?: string;
    reservationAt?: string;
    dealUrl?: string;
  };
};

function buildMessage(rec: RecordingDoc): string {
  const startedAt = rec.recordingStartedAt?.toDate() ?? new Date();
  const reservationAt = rec.dealSnapshot?.reservationAt
    ? formatJstDateTime(new Date(rec.dealSnapshot.reservationAt))
    : '(予約日時なし)';
  const lines = [
    `[録音開始] ${formatJstDateTime(startedAt)}`,
    `査定担当: ${rec.assessorName ?? '担当者不明'}`,
    `予約日時: ${reservationAt} 開始予定`,
    `案件URL: ${rec.dealSnapshot?.dealUrl ?? '(URL なし)'}`,
    `顧客: ${rec.dealSnapshot?.customerName ?? '(顧客名なし)'} 様`,
    `訪問先: ${rec.dealSnapshot?.address ?? '(住所なし)'}`,
  ];
  return lines.join('\n');
}

export const notifyRecordingStart = onDocumentCreated(
  {
    document: 'recordings/{recordingId}',
    region: 'asia-northeast1',
    retry: true,
    secrets: ['CHATWORK_API_TOKEN', 'CHATWORK_ROOM_ID_GLOBAL'],
  },
  async (event) => {
    const after = event.data?.data() as RecordingDoc | undefined;
    if (!after) return;
    if (after.status !== 'recording') return;
    if (after.chatworkNotifiedStartAt) return;

    const recordingId = event.params.recordingId;
    const token = process.env.CHATWORK_API_TOKEN;
    const roomId = process.env.CHATWORK_ROOM_ID_GLOBAL;
    if (!token || !roomId) {
      logger.error('[CHATWORK] missing secrets', { recordingId });
      return;
    }

    const message = buildMessage(after);
    await postToRoom(roomId, message, token);

    try {
      await admin
        .firestore()
        .doc(`recordings/${recordingId}`)
        .update({
          chatworkNotifiedStartAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
      // POST は成功したが flag 更新で失敗。retry で再 POST すると二重投稿になるため、
      // ここでは throw せず明確なログだけ残して終了する。
      logger.error('[CHATWORK] post succeeded but flag update failed', {
        recordingId,
        phase: 'start',
        err: err instanceof Error ? err.message : String(err),
      });
    }
  },
);
