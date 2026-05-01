/**
 * Asia/Tokyo タイムゾーンでの日時整形ユーティリティ。
 * Cloud Functions は UTC で動くので明示的に JST に変換する必要がある。
 */

const JST_DATETIME = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatJstDateTime(d: Date): string {
  // ja-JP の出力は "2026/05/01 14:30" のような形式 → "2026-05-01 14:30" に正規化
  const parts = JST_DATETIME.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

export function formatJstDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}時間${m}分${s}秒`;
  return `${m}分${s}秒`;
}
