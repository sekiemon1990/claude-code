"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { classifyCondition } from "@/lib/conditions";
import type { Listing, SourceKey } from "@/lib/types";

type FlatListing = Listing & { source: SourceKey };

type Props = {
  keyword: string;
  productGuess?: string;
  listings: FlatListing[];
};

type Advice = {
  summary: string;
  recommendations: { rank: string; price: number; rate: number }[];
  warnings: string[];
};

function generateAdvice(
  keyword: string,
  productGuess: string | undefined,
  listings: FlatListing[]
): Advice {
  const prices = listings.map((l) => l.price).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)] ?? 0;
  const min = prices[0] ?? 0;
  const max = prices[prices.length - 1] ?? 0;
  const count = listings.length;

  const spread = max - min;
  const spreadRatio = median > 0 ? spread / median : 0;
  const spreadDesc =
    spreadRatio > 1.5
      ? "非常に広い"
      : spreadRatio > 0.8
        ? "やや広め"
        : "落ち着いた";

  const counts = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const l of listings) {
    const r = classifyCondition(l.condition);
    if (r !== "unknown") counts[r]++;
  }
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const summary = `${productGuess ?? keyword}の中古市場を分析しました。直近の取引${count}件から、中央値は ¥${median.toLocaleString("ja-JP")}、価格幅は ¥${min.toLocaleString("ja-JP")} 〜 ¥${max.toLocaleString("ja-JP")} で${spreadDesc}分布です。${dominant ? `状態${dominant}クラスの出品が多く、` : ""}相対的に${spreadRatio > 1 ? "状態確認の重要度が高い" : "標準的な"}カテゴリです。`;

  const recommendations = [
    { rank: "状態S/A", rate: 75, price: Math.round((median * 75) / 100) },
    { rank: "状態B", rate: 65, price: Math.round((median * 65) / 100) },
    { rank: "状態C", rate: 50, price: Math.round((median * 50) / 100) },
    { rank: "状態D", rate: 30, price: Math.round((median * 30) / 100) },
  ];

  const warnings: string[] = [];
  if (count < 10) {
    warnings.push(
      `データ件数が${count}件と少ないため、相場の振れ幅が大きい可能性があります。期間を広げての確認を推奨します。`
    );
  }
  if (spreadRatio > 1.2) {
    warnings.push(
      "価格幅が大きいため、状態（傷・付属品・年式）の確認を念入りに行ってください。同じ商品でも条件で大きく差が出ます。"
    );
  }
  if (counts.D >= Math.ceil(count * 0.2)) {
    warnings.push(
      "ジャンク品が一定数出回っており、ジャンク扱いを除外した相場で判断する方が安全です。"
    );
  }
  if (max > median * 2.5) {
    warnings.push(
      `最高値 ¥${max.toLocaleString("ja-JP")} はプレミア / 特殊条件の可能性があります。中央値ベースで査定することを推奨します。`
    );
  }
  if (warnings.length === 0) {
    warnings.push(
      "サンプル数・分布ともに安定しています。中央値を基準にした査定で問題ありません。"
    );
  }

  return { summary, recommendations, warnings };
}

export function AiAdvisor({ keyword, productGuess, listings }: Props) {
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    // 実装時はここで LLM API を叩く。プロトタイプは演出のため遅延
    await new Promise((r) => setTimeout(r, 800));
    setAdvice(generateAdvice(keyword, productGuess, listings));
    setLoading(false);
  }

  if (listings.length === 0) return null;

  return (
    <section className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">
            AI査定アシスタント
          </span>
          <span className="text-[10px] text-muted px-1.5 py-0.5 rounded bg-surface border border-border">
            β
          </span>
        </div>
      </div>

      {!advice && !loading && (
        <>
          <p className="text-xs text-muted leading-relaxed mb-3">
            検索結果からAIが相場分析と買取目安を提案します。
          </p>
          <button
            type="button"
            onClick={run}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 flex items-center justify-center gap-1.5"
          >
            <Sparkles size={14} />
            アドバイスを取得
          </button>
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center py-6 gap-2 text-muted">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">分析中...</span>
        </div>
      )}

      {advice && (
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-[11px] font-semibold text-primary mb-1">
              分析サマリー
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              {advice.summary}
            </p>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-primary mb-2">
              買取額の目安（状態別）
            </div>
            <div className="grid grid-cols-2 gap-2">
              {advice.recommendations.map((r) => (
                <div
                  key={r.rank}
                  className="bg-surface border border-border rounded-lg p-2.5"
                >
                  <div className="text-[10px] text-muted">
                    {r.rank}（{r.rate}%）
                  </div>
                  <div className="text-base font-bold text-foreground mt-0.5">
                    ¥{r.price.toLocaleString("ja-JP")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-primary mb-1.5">
              注意点
            </div>
            <ul className="flex flex-col gap-1.5">
              {advice.warnings.map((w, i) => (
                <li
                  key={i}
                  className="text-xs text-foreground leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-warning"
                >
                  {w}
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={run}
            className="text-xs text-primary hover:underline self-start"
          >
            再分析
          </button>
        </div>
      )}
    </section>
  );
}
