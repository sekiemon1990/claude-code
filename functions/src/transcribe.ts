import * as fs from 'fs';
import OpenAI from 'openai';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

/**
 * Whisper で日本語音声を文字起こしする。
 */
export async function transcribe(audioPath: string): Promise<string> {
  const openai = getClient();
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'whisper-1',
    language: 'ja',
    response_format: 'text',
  });
  // response_format: 'text' の場合は string
  return typeof response === 'string' ? response : (response as { text: string }).text;
}
