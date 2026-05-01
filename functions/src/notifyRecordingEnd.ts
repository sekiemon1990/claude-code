import * as admin from 'firebase-admin';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

import { postToRoom } from './chatwork';
import { buildChatworkMessage, formatJstDateTime, formatJstDuration } from './formatJst';

type RecordingDoc = {
  status?: string;
  assessorName?: string;
  durationMs?: number;
  recordingEndedAt?: admin.firestore.Timestamp;
  chatworkNotifiedEndAt?: admin.firestore.Timestamp | null;
  dealSnapshot?: {
    customerName?: string;
    address?: string;
    reservationAt?: string;
    dealUrl?: string;
    insideSalesName?: string;
  };
};

function buildMessage(rec: RecordingDoc): string {
  const endedAt = rec.recordingEndedAt?.toDate() ?? new Date();
  // 録音時間は durationMs を直接使う ((end - start) を使わない: 中断・再開で実時間と差が出るため)
  const duration = formatJstDuration(rec.durationMs ?? 0);
  return buildChatworkMessage({
    title: `🔴 録音終了 - ${formatJstDateTime(endedAt)} (録音時間: ${duration})`,
    customerName: rec.dealSnapshot?.customerName,
    address: rec.dealSnapshot?.address,
    reservationAtIso: rec.dealSnapshot?.reservationAt,
    assessorName: rec.assessorName,
    insideSalesName: rec.dealSnapshot?.insideSalesName,
    dealUrl: rec.dealSnapshot?.dealUrl,
  });
}

export const notifyRecordingEnd = onDocumentUpdated(
  {
    document: 'recordings/{recordingId}',
    region: 'asia-northeast1',
    retry: true,
    secrets: ['CHATWORK_API_TOKEN', 'CHATWORK_ROOM_ID_GLOBAL'],
  },
  async (event) => {
    const before = event.data?.before.data() as RecordingDoc | undefined;
    const after = event.data?.after.data() as RecordingDoc | undefined;
    if (!before || !after) return;
    // 'recording' → 'uploading' 遷移の瞬間のみ起動 (重複起動防止)
    if (before.status !== 'recording' || after.status !== 'uploading') return;
    if (after.chatworkNotifiedEndAt) return;

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
          chatworkNotifiedEndAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
      logger.error('[CHATWORK] post succeeded but flag update failed', {
        recordingId,
        phase: 'end',
        err: err instanceof Error ? err.message : String(err),
      });
    }
  },
);
