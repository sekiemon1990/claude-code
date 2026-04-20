import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import { transcribe } from './transcribe';
import { generateMinutes } from './generateMinutes';

export async function processRecording(recordingId: string, storagePath: string): Promise<void> {
  const docRef = admin.firestore().doc(`recordings/${recordingId}`);

  // 1. 文字起こし
  await docRef.update({
    status: 'transcribing',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const tmpPath = path.join(os.tmpdir(), path.basename(storagePath));
  await admin.storage().bucket().file(storagePath).download({ destination: tmpPath });

  let transcript: string;
  try {
    transcript = await transcribe(tmpPath);
  } finally {
    fs.promises.unlink(tmpPath).catch(() => {});
  }

  logger.info('Transcription completed', {
    recordingId,
    length: transcript.length,
  });

  await docRef.update({
    transcript,
    status: 'transcribed',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 2. 議事録生成
  await docRef.update({
    status: 'generating_minutes',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const minutes = await generateMinutes(transcript);

  logger.info('Minutes generated', { recordingId });

  await docRef.update({
    minutes: {
      ...minutes,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    status: 'completed',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
