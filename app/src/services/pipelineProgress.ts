import type { RecordingStatus } from '@/types';

/**
 * パイプライン進捗ステージ。録音停止後に走る一連の処理を %  で示すための
 * ステージ定義。各ステージの所要時間は実環境でブレるため、
 * 「現在どこまで終わっているか」の目安としての値。
 */
export const PIPELINE_STAGES: Array<{
  status: RecordingStatus;
  label: string;
  /** ステージ完了時のパーセント */
  percent: number;
}> = [
  { status: 'uploading', label: 'アップロード中', percent: 25 },
  { status: 'uploaded', label: '送信完了', percent: 35 },
  { status: 'transcribing', label: '文字起こし中', percent: 65 },
  { status: 'transcribed', label: '文字起こし完了', percent: 75 },
  { status: 'generating_minutes', label: '議事録生成中', percent: 95 },
  { status: 'completed', label: '完了', percent: 100 },
];

/**
 * 録音のステータスとアップロード進捗（0-100）から全体進捗 % を計算する。
 *
 * @param status 録音の現ステータス
 * @param uploadPercent 0-100。`uploading` の時に渡す
 */
export function pipelinePercent(
  status: RecordingStatus,
  uploadPercent?: number,
): number {
  if (status === 'failed') return 0;

  // uploading 中は 0 〜 25% の範囲をアップロードの実進捗で表現
  if (status === 'uploading') {
    const u = Math.max(0, Math.min(100, uploadPercent ?? 0));
    return Math.round((u / 100) * 25);
  }

  const stage = PIPELINE_STAGES.find((s) => s.status === status);
  return stage?.percent ?? 0;
}

export function pipelineLabel(status: RecordingStatus): string {
  const stage = PIPELINE_STAGES.find((s) => s.status === status);
  return stage?.label ?? '不明';
}

export function isPipelineProcessing(status: RecordingStatus): boolean {
  return (
    status === 'uploading' ||
    status === 'uploaded' ||
    status === 'transcribing' ||
    status === 'transcribed' ||
    status === 'generating_minutes'
  );
}
