import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

import { postToRoom } from './chatwork';
import { buildChatworkMessage, formatJstDateTime } from './formatJst';

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
    insideSalesName?: string;
  };
};

function buildMessage(rec: RecordingDoc): string {
  const startedAt = rec.recordingStartedAt?.toDate() ?? new Date();
  return buildChatworkMessage({
    title: `🟢 録音開始 - ${formatJstDateTime(startedAt)}`,
    customerName: rec.dealSnapshot?.customerName,
    address: rec.dealSnapshot?.address,
    reservationAtIso: rec.dealSnapshot?.reservationAt,
    assessorName: rec.assessorName,
    insideSalesName: rec.dealSnapshot?.insideSalesName,
    dealUrl: rec.dealSnapshot?.dealUrl,
  });
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
