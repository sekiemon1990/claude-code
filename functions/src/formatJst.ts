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

/**
 * 顧客名表示用のフォーマッタ。
 * dealSnapshot.customerName が末尾「様」付きで入っているケースが現場データで存在し、
 * メッセージ側でも「様」を付けると重複するため、末尾検査で重複を防ぐ。
 *
 * - 末尾の半角/全角スペースは trimEnd で除去 (ECMAScript 2019+ は U+3000 も対象)
 * - 末尾が「様」ならそのまま返す
 * - そうでなければ ` 様` を付与
 * - null/undefined/空白のみ は「(顧客不明) 様」を返す
 */
export function formatCustomerName(name: string | null | undefined): string {
  if (!name) return '(顧客不明) 様';
  const trimmed = name.trimEnd();
  if (!trimmed) return '(顧客不明) 様';
  if (trimmed.endsWith('様')) return trimmed;
  return `${trimmed} 様`;
}

/**
 * Chatwork 通知本文の共通レンダラ。
 * 録音開始/終了で本文構造は同じ。差分は title 行 (絵文字 / 文言 / 録音時間有無) のみなので
 * title を呼び出し側で組み立てて渡す。
 *
 * - reservationAtIso: dealSnapshot.reservationAt (ISO 8601 文字列)。空なら「(予約日時なし)」
 * - insideSalesName: trim 後空相当なら「予約: ...」行ごと省略 (空欄ノイズ回避)
 * - 出力は Chatwork タグ ([info]/[title]/[hr]) を含む 1 つの文字列
 */
export function buildChatworkMessage(params: {
  title: string;
  customerName: string | null | undefined;
  address: string | null | undefined;
  reservationAtIso: string | null | undefined;
  assessorName: string | null | undefined;
  insideSalesName?: string | null;
  dealUrl: string | null | undefined;
}): string {
  const customerLine = `顧客: ${formatCustomerName(params.customerName)}`;
  const addressLine = `訪問先: ${params.address ?? '(住所なし)'}`;
  const reservationLine = params.reservationAtIso
    ? `予約日時: ${formatJstDateTime(new Date(params.reservationAtIso))} 開始予定`
    : '予約日時: (予約日時なし)';
  const assessorLine = `査定: ${params.assessorName ?? '担当者不明'}`;
  const url = params.dealUrl ?? '(URL なし)';

  const handlerLines: string[] = [assessorLine];
  const insideSales = params.insideSalesName?.trim();
  if (insideSales) {
    handlerLines.push(`予約: ${insideSales}`);
  }

  return [
    `[info][title]${params.title}[/title]`,
    '[hr]',
    '▼ 案件情報',
    customerLine,
    addressLine,
    reservationLine,
    '',
    '▼ 担当者',
    ...handlerLines,
    '',
    '▼ リンク',
    url,
    '[/info]',
  ].join('\n');
}
