import * as admin from 'firebase-admin';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

import { processRecording } from './processRecording';

admin.initializeApp();

export { notifyRecordingStart } from './notifyRecordingStart';
export { notifyRecordingEnd } from './notifyRecordingEnd';

/**
 * 録音ドキュメントのステータスが `uploaded` に変わったら、
 * 文字起こし → 議事録生成のパイプラインを走らせる。
 */
export const onRecordingUploaded = onDocumentUpdated(
  {
    document: 'recordings/{recordingId}',
    region: 'asia-northeast1',
    timeoutSeconds: 540,
    memory: '1GiB',
    secrets: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // `uploaded` に遷移した瞬間のみ起動する（重複起動防止）
    if (before.status === 'uploaded' || after.status !== 'uploaded') return;

    const recordingId = event.params.recordingId;
    logger.info('Recording uploaded, starting pipeline', { recordingId });

    try {
      await processRecording(recordingId, after.storagePath);
    } catch (err) {
      logger.error('Pipeline failed', { recordingId, err });
      await admin
        .firestore()
        .doc(`recordings/${recordingId}`)
        .update({
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
  },
);
