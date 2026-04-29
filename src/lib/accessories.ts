type AccessoryRule = {
  label: string;
  keywords: string[];
};

const RULES: AccessoryRule[] = [
  {
    label: "元箱",
    keywords: ["元箱", "外箱", "化粧箱", "オリジナルボックス", "オリジナル箱"],
  },
  {
    label: "取扱説明書",
    keywords: ["取扱説明書", "取説", "説明書", "マニュアル"],
  },
  {
    label: "保証書",
    keywords: ["保証書", "ギャランティカード"],
  },
  {
    label: "充電器",
    keywords: ["充電器", "充電ケーブル", "ACアダプタ", "ACアダプター"],
  },
  {
    label: "バッテリー",
    keywords: ["バッテリー", "予備電池"],
  },
  {
    label: "ストラップ",
    keywords: ["ストラップ", "ショルダーストラップ"],
  },
  {
    label: "専用ケース",
    keywords: ["専用ケース", "純正ケース", "保護ケース", "ポーチ"],
  },
  {
    label: "レンズ",
    keywords: ["レンズ"],
  },
  {
    label: "レンズキャップ",
    keywords: ["レンズキャップ", "ボディキャップ"],
  },
  {
    label: "レンズフード",
    keywords: ["レンズフード", "フード"],
  },
  {
    label: "保護フィルター",
    keywords: ["保護フィルター", "プロテクトフィルター", "UVフィルター"],
  },
  {
    label: "メモリーカード",
    keywords: ["メモリーカード", "SDカード", "CFカード"],
  },
  {
    label: "三脚",
    keywords: ["三脚"],
  },
  {
    label: "リモコン",
    keywords: ["リモコン", "リモートコントローラー", "ワイヤレスリモコン"],
  },
  {
    label: "コントローラー",
    keywords: ["コントローラー", "Joy-Con", "ジョイコン"],
  },
  {
    label: "ケーブル",
    keywords: ["HDMIケーブル", "USBケーブル", "Lightningケーブル", "電源ケーブル"],
  },
  {
    label: "イヤホン",
    keywords: ["イヤホン", "ヘッドホン", "イヤーピース"],
  },
  {
    label: "替えブラシ",
    keywords: ["替えブラシ", "替ブラシ"],
  },
  {
    label: "アタッチメント",
    keywords: ["アタッチメント", "ノズル", "ヘッド"],
  },
];

const NEGATIVE_HINTS = ["なし", "無し", "欠品", "未使用ですが", "本体のみ"];

export function extractAccessories(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      if (!hasNegationNear(text, rule.keywords)) {
        found.add(rule.label);
      }
    }
  }
  return Array.from(found);
}

function hasNegationNear(text: string, keywords: string[]): boolean {
  for (const k of keywords) {
    let idx = 0;
    while ((idx = text.indexOf(k, idx)) !== -1) {
      const after = text.slice(idx + k.length, idx + k.length + 8);
      if (NEGATIVE_HINTS.some((n) => after.startsWith(n))) {
        return true;
      }
      idx += k.length;
    }
  }
  return false;
}

export function detectAccessories(input: {
  title?: string;
  description?: string;
  accessories?: string[];
}): { items: string[]; isInferred: boolean } {
  if (input.accessories && input.accessories.length > 0) {
    return { items: input.accessories, isInferred: false };
  }
  const text = [input.title ?? "", input.description ?? ""].join(" ");
  const items = extractAccessories(text);
  return { items, isInferred: items.length > 0 };
}
