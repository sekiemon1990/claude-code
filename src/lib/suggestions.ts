const STOP_WORDS = new Set([
  "中古",
  "本体",
  "セット",
  "ジャンク扱い",
  "送料無料",
  "送料込み",
  "送料込",
  "値下げ",
  "急ぎ",
  "限定",
  "現状",
  "希少",
  "極上",
  "新品同様",
  "極美品",
]);

const NEGATIVE_HINTS = [
  "ジャンク",
  "部品取り",
  "部品",
  "訳あり",
  "難あり",
  "破損",
  "欠品",
  "外装スレ",
  "状態が悪い",
  "不動",
  "動作不良",
  "傷あり",
  "ノークレーム",
];

export type Suggestions = {
  additions: { term: string; count: number }[];
  excludes: { term: string; count: number }[];
};

function tokenize(title: string): string[] {
  return title
    .replace(/[【】\[\]\(\)・、,。!?！？:：]/g, " ")
    .split(/[\s　]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

export function generateSuggestions(
  listings: { title: string }[],
  keyword: string
): Suggestions {
  const keywordLower = keyword.toLowerCase();
  const keywordTerms = new Set(
    keywordLower.split(/[\s　]+/).filter(Boolean)
  );

  const counts = new Map<string, number>();

  for (const l of listings) {
    const tokens = tokenize(l.title);
    const seen = new Set<string>();
    for (const t of tokens) {
      const lower = t.toLowerCase();
      if (keywordTerms.has(lower)) continue;
      if (keywordLower.includes(lower)) continue;
      if (seen.has(lower)) continue;
      seen.add(lower);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }

  const positive: { term: string; count: number }[] = [];
  const negative: { term: string; count: number }[] = [];

  for (const [term, count] of counts) {
    if (STOP_WORDS.has(term)) continue;
    if (count < 2) continue;
    if (NEGATIVE_HINTS.some((n) => term.includes(n))) {
      negative.push({ term, count });
    } else {
      positive.push({ term, count });
    }
  }

  positive.sort((a, b) => b.count - a.count);
  negative.sort((a, b) => b.count - a.count);

  return {
    additions: positive.slice(0, 6),
    excludes: negative.slice(0, 6),
  };
}
