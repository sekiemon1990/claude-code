import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

type RequestBody = {
  keyword: string;
  productGuess?: string;
  listings: {
    source: string;
    title: string;
    price: number;
    condition?: string;
    endedAt: string;
  }[];
};

type Recommendation = {
  rank: string;
  rate: number;
  price: number;
};

type Advice = {
  summary: string;
  recommendations: Recommendation[];
  warnings: string[];
};

const SYSTEM_PROMPT = `あなたは中古品の買取査定を支援する AI アシスタントです。
ヤフオク・メルカリ・ジモティーなど中古市場の取引データを分析し、出張買取スタッフが
顧客宅で素早く判断できる査定アドバイスを日本語で提供します。

# 役割
- 提供された落札・取引データから市場の特徴を読み取り、簡潔な要約を作成する
- 中古品の状態ランク (S/A/B/C/D) ごとに、買取目安額を中央値ベースで算出する
- 査定者が現場で気をつけるべき注意点を 1〜3 個提示する

# 重要な原則
- 中央値を判断軸とする。最高値はプレミア / 特殊条件の可能性があり、過信しない
- 状態 S/A は中央値の 70-80%、B は 60-70%、C は 40-55%、D は 25-40% を基準に、
  カテゴリの相場感や流通量を踏まえて調整する
- 取引件数が少ない (10件未満) 場合は信頼性が低いことを必ず明示する
- 価格幅が中央値の 1.2 倍以上に広がっている場合は、状態確認 (傷・付属品・年式) の
  重要性を強調する
- ジャンク品が全体の 2 割以上ある場合は、ジャンクを除外した相場で再判断するよう警告する
- 注意点は具体的で行動につながる内容にする (例: 「箱・取説の有無を確認」など)

# 出力
provide_appraisal ツールを使って構造化された結果のみを返してください。
ツール以外のテキスト出力はしないでください。`;

const TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    summary: {
      type: "string",
      description:
        "市場の特徴を 2〜3 文で説明する要約。中央値・件数・分布の特徴・状態の傾向を含めること。",
    },
    recommendations: {
      type: "array",
      description: "状態ランクごとの買取目安",
      items: {
        type: "object",
        properties: {
          rank: {
            type: "string",
            description: "状態ランク (例: '状態S/A', '状態B', '状態C', '状態D')",
          },
          rate: {
            type: "number",
            description: "中央値に対する買取率 (%)",
          },
          price: {
            type: "number",
            description: "買取目安額 (円, 整数)",
          },
        },
        required: ["rank", "rate", "price"],
      },
      minItems: 4,
      maxItems: 4,
    },
    warnings: {
      type: "array",
      description: "現場の査定者が気をつけるべき注意点 (1〜3 個)",
      items: { type: "string" },
      minItems: 1,
      maxItems: 3,
    },
  },
  required: ["summary", "recommendations", "warnings"],
};

function summarizeListings(body: RequestBody): string {
  const lines: string[] = [];
  lines.push(`検索キーワード: ${body.keyword}`);
  if (body.productGuess) {
    lines.push(`推定商品: ${body.productGuess}`);
  }
  lines.push(`取引データ件数: ${body.listings.length} 件`);
  lines.push("");
  lines.push("# 取引データ");
  for (const l of body.listings.slice(0, 50)) {
    lines.push(
      `- [${l.source}] ${l.title} / ¥${l.price.toLocaleString("ja-JP")} / 状態: ${l.condition ?? "不明"}`,
    );
  }
  return lines.join("\n");
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 },
    );
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.keyword || !Array.isArray(body.listings)) {
    return NextResponse.json(
      { error: "keyword と listings は必須です" },
      { status: 400 },
    );
  }
  if (body.listings.length === 0) {
    return NextResponse.json(
      { error: "取引データが 0 件です" },
      { status: 400 },
    );
  }

  const client = new Anthropic();
  const userContent = summarizeListings(body);

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          name: "provide_appraisal",
          description: "中古品の査定アドバイスを構造化して返す",
          input_schema: TOOL_INPUT_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: "provide_appraisal" },
      messages: [{ role: "user", content: userContent }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolUse) {
      return NextResponse.json(
        { error: "AI からの応答が不正です" },
        { status: 502 },
      );
    }

    const advice = toolUse.input as Advice;
    return NextResponse.json({ advice });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "リクエストが集中しています。少し待って再度お試しください。" },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      console.error("[ai-advisor] API error:", error.status, error.message);
      return NextResponse.json(
        { error: `AI 応答エラー (${error.status})` },
        { status: 502 },
      );
    }
    console.error("[ai-advisor] unknown error:", error);
    return NextResponse.json(
      { error: "AI 査定の取得に失敗しました" },
      { status: 500 },
    );
  }
}
