/**
 * 議事録から数値を抽出するユーティリティ。
 * Claude が自然言語で書いた金額・品目を機械的にパースして
 * 集計（収益性、1商品あたりの査定時間など）に使う。
 *
 * 100% の精度は出ないので、パースに失敗したら集計から除外する設計。
 * 将来的には Claude 側で構造化出力（金額を数値で返す）にするのが
 * 望ましいが、現状の自然言語出力からの best-effort 抽出。
 */

/**
 * 金額表記から数値（円）を抽出する。
 * 対応パターン:
 *   "280,000円" / "280000 円" → 280000
 *   "30万円" / "30万" → 300000
 *   "1.5万円" → 15000
 *   "言及なし" など金額が含まれない → null
 */
export function parsePrice(text: string | undefined | null): number | null {
  if (!text) return null;

  // 「○○万円」「○○万」を優先（「30万円」が「30」円と誤認されないように）
  const manMatch = text.match(/([0-9.,]+)\s*万/);
  if (manMatch) {
    const num = parseFloat(manMatch[1].replace(/,/g, ''));
    if (!Number.isNaN(num)) return Math.round(num * 10000);
  }

  // 「○○円」「○○ 円」
  const yenMatch = text.match(/([0-9,]+)\s*円/);
  if (yenMatch) {
    const num = parseInt(yenMatch[1].replace(/,/g, ''), 10);
    if (!Number.isNaN(num)) return num;
  }

  return null;
}

/**
 * 査定品目テキストから「品目数」を概算する。
 * 句読点（、，,・）で分割した数を返す。
 *
 * 例:
 *   "腕時計（ロレックス）、ブランドバッグ数点" → 2
 *   "着物一式、貴金属" → 2
 *   "切手コレクション" → 1
 *
 * 「数点」「複数」のような曖昧な表現は 1 として扱う（過大推計を避ける）。
 */
export function countItems(text: string | undefined | null): number {
  if (!text) return 0;
  const parts = text
    .split(/[、,，・]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length;
}

export function formatYen(amount: number | null): string {
  if (amount == null) return '—';
  if (amount >= 10000) {
    const man = amount / 10000;
    return man % 1 === 0 ? `${man}万円` : `${man.toFixed(1)}万円`;
  }
  return `${amount.toLocaleString()}円`;
}
