type Rule = {
  keywords: string[];
  amount: number;
  size: string;
};

const RULES: Rule[] = [
  // 極小・軽量
  {
    keywords: ["腕時計", "時計", "ロレックス", "オメガ", "カルティエ"],
    amount: 1000,
    size: "ネコポス〜60",
  },
  {
    keywords: ["指輪", "リング", "ネックレス", "ピアス", "ブレスレット", "ジュエリー"],
    amount: 800,
    size: "ネコポス",
  },
  {
    keywords: ["iPhone", "スマホ", "Pixel", "Galaxy"],
    amount: 800,
    size: "ネコポス〜60",
  },

  // カメラ・レンズ
  {
    keywords: ["α7", "α6", "EOS", "Nikon", "ライカ", "GoPro", "ボディ", "レンズ", "カメラ"],
    amount: 1500,
    size: "60サイズ",
  },

  // バッグ類
  {
    keywords: ["バッグ", "鞄", "リュック", "トート", "クラッチ", "ハンドバッグ", "ボストン"],
    amount: 1500,
    size: "80サイズ",
  },

  // 小型ゲーム機・本
  {
    keywords: ["Switch", "Joy-Con"],
    amount: 1200,
    size: "60サイズ",
  },
  {
    keywords: ["DVD", "Blu-ray", "本", "書籍", "コミック"],
    amount: 800,
    size: "ゆうパケット",
  },

  // 据置ゲーム機
  {
    keywords: ["PS5", "PS4", "Xbox", "プレステ"],
    amount: 1500,
    size: "80サイズ",
  },

  // PC
  {
    keywords: ["MacBook", "ノートパソコン", "ノートPC", "iPad", "タブレット"],
    amount: 1800,
    size: "80サイズ",
  },

  // 家電（中型）
  {
    keywords: ["ダイソン", "掃除機", "ロボット掃除機", "Roomba"],
    amount: 2500,
    size: "100サイズ",
  },
  {
    keywords: ["電子レンジ", "オーブン", "コーヒーメーカー", "炊飯器", "トースター"],
    amount: 3500,
    size: "120サイズ",
  },
  {
    keywords: ["プリンター", "スキャナー"],
    amount: 3000,
    size: "120サイズ",
  },

  // オーディオ
  {
    keywords: ["スピーカー", "アンプ", "プリアンプ", "ターンテーブル"],
    amount: 3500,
    size: "120サイズ",
  },
  {
    keywords: ["ヘッドホン", "イヤホン"],
    amount: 1000,
    size: "60サイズ",
  },

  // 楽器
  {
    keywords: ["ギター", "ベース", "バイオリン"],
    amount: 3500,
    size: "140サイズ",
  },
  {
    keywords: ["ピアノ", "電子ピアノ", "シンセサイザー", "キーボード（楽器）"],
    amount: 8000,
    size: "大型らくらく便",
  },
  {
    keywords: ["ドラム", "サックス", "トランペット"],
    amount: 4500,
    size: "160サイズ",
  },

  // 家電（大型）
  {
    keywords: ["テレビ", "TV", "55インチ", "65インチ"],
    amount: 6500,
    size: "大型らくらく便",
  },
  {
    keywords: ["冷蔵庫", "洗濯機", "ドラム式", "乾燥機"],
    amount: 9000,
    size: "大型らくらく便",
  },
  {
    keywords: ["エアコン", "空気清浄機"],
    amount: 4500,
    size: "160サイズ",
  },

  // 家具
  {
    keywords: ["ソファ", "ベッド", "ダイニングテーブル", "キャビネット"],
    amount: 12000,
    size: "家財宅急便",
  },
  {
    keywords: ["椅子", "イス", "デスク"],
    amount: 5000,
    size: "160サイズ",
  },
];

const DEFAULT: { amount: number; size: string } = {
  amount: 1200,
  size: "60サイズ",
};

export type ShippingEstimate = {
  amount: number;
  size: string;
  isDefault: boolean;
};

export function estimateShipping(text: string): ShippingEstimate {
  const lower = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => lower.includes(k.toLowerCase()))) {
      return { ...rule, isDefault: false };
    }
  }
  return { ...DEFAULT, isDefault: true };
}
