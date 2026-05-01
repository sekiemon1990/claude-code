/**
 * 中古品マーケットでよく使われる日本語検索キーワード辞書。
 * オートコンプリートの「即時表示」用。AI 候補が遅延する間にこれを見せる。
 */

export const KEYWORD_DICTIONARY: string[] = [
  // ---- スマートフォン ----
  "iPhone 15 Pro Max",
  "iPhone 15 Pro",
  "iPhone 15 Plus",
  "iPhone 15",
  "iPhone 14 Pro Max",
  "iPhone 14 Pro",
  "iPhone 14",
  "iPhone 13 Pro Max",
  "iPhone 13 Pro",
  "iPhone 13",
  "iPhone 13 mini",
  "iPhone 12 Pro Max",
  "iPhone 12 Pro",
  "iPhone 12",
  "iPhone 12 mini",
  "iPhone SE 第3世代",
  "iPhone SE 第2世代",
  "iPhone 11 Pro",
  "iPhone 11",
  "iPhone X",
  "iPhone 本体 SIMフリー",
  "iPhone ジャンク",
  "Galaxy S24",
  "Galaxy S23",
  "Galaxy Z Flip5",
  "Galaxy Z Fold5",
  "Pixel 8 Pro",
  "Pixel 8",
  "Pixel 7a",
  "Xperia 1 V",
  "Xperia 5 V",

  // ---- 時計 ----
  "ロレックス サブマリーナ",
  "ロレックス デイトナ",
  "ロレックス GMTマスター",
  "ロレックス エクスプローラー",
  "ロレックス デイトジャスト",
  "ロレックス ヨットマスター",
  "オメガ スピードマスター",
  "オメガ シーマスター",
  "タグホイヤー カレラ",
  "タグホイヤー アクアレーサー",
  "チューダー ブラックベイ",
  "セイコー グランドセイコー",
  "セイコー プロスペックス",
  "カシオ Gショック",

  // ---- カメラ ----
  "SONY α7 IV",
  "SONY α7 III",
  "SONY α7C",
  "SONY α7R V",
  "SONY α7S III",
  "Canon EOS R5",
  "Canon EOS R6",
  "Canon EOS Kiss",
  "Nikon Z8",
  "Nikon Z6 II",
  "FUJIFILM X-T5",
  "FUJIFILM X100V",
  "ライカ Q3",
  "ライカ M11",

  // ---- バッグ・ファッション ----
  "ルイヴィトン ネヴァーフル",
  "ルイヴィトン スピーディ",
  "ルイヴィトン アルマ",
  "ルイヴィトン ポシェット",
  "ルイヴィトン モノグラム",
  "エルメス バーキン",
  "エルメス ケリー",
  "エルメス ピコタン",
  "シャネル マトラッセ",
  "シャネル ボーイシャネル",
  "シャネル ココハンドル",
  "グッチ オフィディア",
  "プラダ サフィアーノ",
  "コーチ シグネチャー",

  // ---- ジュエリー ----
  "カルティエ ラブブレス",
  "カルティエ トリニティ",
  "ティファニー Tスマイル",
  "ティファニー オープンハート",
  "ブルガリ ビーゼロワン",

  // ---- ゲーム ----
  "Nintendo Switch 有機EL",
  "Nintendo Switch ライト",
  "Nintendo Switch 本体",
  "PlayStation 5",
  "PlayStation 4",
  "Xbox Series X",
  "Xbox Series S",
  "Steam Deck",

  // ---- オーディオ ----
  "AirPods Pro 第2世代",
  "AirPods Pro",
  "AirPods Max",
  "Bose QuietComfort",
  "ソニー WH-1000XM5",
  "ソニー WF-1000XM5",
  "Sennheiser Momentum",

  // ---- PC ----
  "MacBook Pro M3",
  "MacBook Air M2",
  "MacBook Air M3",
  "iPad Pro M4",
  "iPad Air",
  "iPad mini",
  "Surface Pro",
  "Surface Laptop",

  // ---- 家電 ----
  "ダイソン V15 Detect",
  "ダイソン V12 Detect",
  "ダイソン V10",
  "ダイソン V8",
  "ルンバ i7",
  "ルンバ j7",
  "シャーク 掃除機",
  "ブラーバ",
  "バルミューダ トースター",
  "デロンギ エスプレッソ",
  "ネスプレッソ",

  // ---- 楽器 ----
  "Fender ストラトキャスター",
  "Fender テレキャスター",
  "Gibson レスポール",
  "Gibson SG",
  "Martin アコギ",
  "ヤマハ サイレントギター",
  "ローランド 電子ピアノ",

  // ---- 工具・自転車 ----
  "マキタ インパクトドライバー",
  "マキタ 電動ドリル",
  "ハイコーキ",
  "ロードバイク カーボン",
  "クロスバイク",

  // ---- 出張買取で多いキーワード接尾辞 ----
  // (prefix にこれらが既に含まれている場合は AI に任せる)
];

/**
 * 入力プレフィックスにマッチするキーワードを返す (上限件数)
 */
export function findDictionaryMatches(prefix: string, limit = 8): string[] {
  const q = prefix.trim().toLowerCase();
  if (!q) return [];
  // 前方一致を優先、その後に部分一致
  const prefixMatches: string[] = [];
  const includeMatches: string[] = [];
  for (const k of KEYWORD_DICTIONARY) {
    const lower = k.toLowerCase();
    if (lower === q) continue;
    if (lower.startsWith(q)) {
      prefixMatches.push(k);
    } else if (lower.includes(q)) {
      includeMatches.push(k);
    }
    if (prefixMatches.length >= limit) break;
  }
  return [...prefixMatches, ...includeMatches].slice(0, limit);
}
