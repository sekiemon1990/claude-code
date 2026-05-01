import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 15;

type RequestBody = {
  prefix: string;
};

const SYSTEM_PROMPT = `あなたは日本の中古品マーケット (ヤフオク・メルカリ等) における
検索キーワードのオートコンプリートエンジンです。

ユーザーが商品名や型番を入力途中の状態で、続きとして妥当な完成形候補を
5〜8 個提案します。

# 重要な原則
- 入力途中の文字列を必ず含む形で補完する (Amazon の検索オートコンプリートと同じ感覚)
- 中古市場で実際に存在する具体的なモデル名・型番に寄せる
- 1 候補は短くシンプルに (検索しやすい長さ、20 文字以内目安)
- 古いモデルから新しいモデルまでバランスよく
- 「ジャンク」「本体のみ」「アクセサリー」など買取現場でよく使う絞り込みも含めても良い
- ブランド名 / シリーズ / 型番 / 容量 / 色 などを補完する形が中心

# 出力フォーマット
以下の JSON スキーマに厳密に従ってください。説明文や前置き、
コードブロック装飾なしで JSON 本体のみを出力してください。

{
  "candidates": ["候補1", "候補2", ...]
}`;

const SUGGEST_SCHEMA = {
  type: "object" as const,
  properties: {
    candidates: {
      type: "array",
      description: "オートコンプリート候補の配列 (5〜8 件)",
      items: { type: "string" },
    },
  },
  required: ["candidates"],
  additionalProperties: false,
};

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

  const prefix = (body.prefix ?? "").trim();
  if (!prefix || prefix.length < 2) {
    return NextResponse.json({ candidates: [] });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: SUGGEST_SCHEMA },
      },
      messages: [{ role: "user", content: `入力途中のキーワード: ${prefix}` }],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    if (!textBlock) {
      return NextResponse.json({ candidates: [] });
    }
    let parsed: { candidates: string[] };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return NextResponse.json({ candidates: [] });
    }
    return NextResponse.json({ candidates: parsed.candidates });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        "[keyword-suggest] API error:",
        error.status,
        error.message,
      );
      return NextResponse.json({ candidates: [] }, { status: 200 });
    }
    console.error("[keyword-suggest] error:", error);
    return NextResponse.json({ candidates: [] }, { status: 200 });
  }
}
