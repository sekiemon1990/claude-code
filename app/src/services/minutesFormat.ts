import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

import type { Recording } from '@/types';

/**
 * 議事録をテキスト化してクリップボードや共有に渡せる形にする。
 * マクサスコアのメモ欄に貼り付ける用途を想定し、Markdown 風だが見出しのみ。
 */
export function formatMinutesAsText(rec: Recording): string {
  const lines: string[] = [];
  lines.push('===== 商談議事録 =====');
  if (rec.dealSnapshot) {
    lines.push(`お客様: ${rec.dealSnapshot.customerName}`);
    lines.push(
      `予約日時: ${format(new Date(rec.dealSnapshot.reservationAt), 'yyyy/M/d (E) HH:mm', {
        locale: ja,
      })}`,
    );
    if (rec.dealSnapshot.address) lines.push(`住所: ${rec.dealSnapshot.address}`);
    if (rec.dealSnapshot.dealUrl) lines.push(`案件URL: ${rec.dealSnapshot.dealUrl}`);
  }
  if (rec.createdAt) {
    lines.push(
      `録音日時: ${format(rec.createdAt.toDate(), 'yyyy/M/d HH:mm', { locale: ja })}`,
    );
  }
  lines.push(`録音時間: ${Math.round(rec.durationMs / 1000)}秒`);
  if (rec.downloadUrl) lines.push(`録音音声: ${rec.downloadUrl}`);
  lines.push('');

  const m = rec.minutes;
  if (m) {
    lines.push('## サマリ');
    lines.push(m.summary);
    lines.push('');
    lines.push('## お客様情報');
    lines.push(m.customerInfo);
    lines.push('');
    lines.push('## 査定品目');
    lines.push(m.items);
    lines.push('');
    lines.push('## 提示額');
    lines.push(m.offeredPrice);
    lines.push('');
    lines.push('## 次回アクション');
    lines.push(m.nextActions);
    lines.push('');
  }

  if (rec.transcript) {
    lines.push('## 文字起こし全文');
    lines.push(rec.transcript);
    lines.push('');
  }

  return lines.join('\n');
}
