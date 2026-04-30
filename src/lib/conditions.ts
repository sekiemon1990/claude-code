export type ConditionRank = "S" | "A" | "B" | "C" | "D" | "unknown";

export const CONDITION_RANKS: Exclude<ConditionRank, "unknown">[] = [
  "S",
  "A",
  "B",
  "C",
  "D",
];

export type ConditionMeta = {
  rank: ConditionRank;
  label: string;
  description: string;
  color: string;
};

export const CONDITION_META: Record<ConditionRank, ConditionMeta> = {
  S: {
    rank: "S",
    label: "S",
    description: "新品同様・未使用に近い",
    color: "#0ea5e9",
  },
  A: {
    rank: "A",
    label: "A",
    description: "美品・目立った傷なし",
    color: "#16a34a",
  },
  B: {
    rank: "B",
    label: "B",
    description: "通常の中古",
    color: "#6b7280",
  },
  C: {
    rank: "C",
    label: "C",
    description: "傷・汚れあり / 訳あり",
    color: "#f59e0b",
  },
  D: {
    rank: "D",
    label: "D",
    description: "ジャンク / 状態不良",
    color: "#dc2626",
  },
  unknown: {
    rank: "unknown",
    label: "?",
    description: "状態不明",
    color: "#9ca3af",
  },
};

export function classifyCondition(condition?: string): ConditionRank {
  if (!condition) return "unknown";
  if (/(新品同様|未使用に近い|新品|^未使用$|未使用品)/.test(condition)) return "S";
  if (/(ジャンク|状態が悪い|破損|難あり|欠品)/.test(condition)) return "D";
  if (/(訳あり|傷や汚れあり|傷・汚れあり|ひどい)/.test(condition)) {
    if (!/(やや)/.test(condition)) return "C";
  }
  if (/(美品|目立った傷.*なし|目立った傷や汚れなし|目立った傷なし)/.test(condition)) {
    return "A";
  }
  if (/(やや傷や汚れあり|やや使用感|やや傷)/.test(condition)) return "B";
  if (/(中古)/.test(condition)) return "B";
  return "unknown";
}
