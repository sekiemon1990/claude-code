import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export type MinutesResult = {
  summary: string;
  customerInfo: string;
  items: string;
  offeredPrice: string;
  nextActions: string;
};

const SYSTEM_PROMPT = `あなたは出張買取業の営業支援アシスタントです。
営業マンとお客様の商談の文字起こしを受け取り、後続の営業活動・査定承認・CRM登録に必要な情報を構造化して抽出してください。

出力は必ず以下のJSONスキーマに従い、前後に説明文を付けずJSONだけを返してください：

{
  "summary": "商談全体の簡潔な要約（3〜5文）",
  "customerInfo": "お客様の氏名・居住エリア・連絡先・家族構成など把握できた範囲の情報",
  "items": "査定・買取対象となった品目のリスト（種類・ブランド・状態・数量など）",
  "offeredPrice": "営業マンが提示した金額／お客様の希望金額／合意金額（不明なら『言及なし』）",
  "nextActions": "営業マンが次に取るべきアクション（後日再訪、上長承認、書類送付、買取実行など）"
}

情報が文字起こしから読み取れない項目は、値を「言及なし」としてください。推測では埋めないでください。`;

export async function generateMinutes(transcript: string): Promise<MinutesResult> {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `以下は商談の文字起こしです。議事録を生成してください。\n\n---\n${transcript}\n---`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude からテキスト応答を取得できませんでした');
  }

  const raw = textBlock.text.trim();
  const jsonText = extractJson(raw);
  const parsed = JSON.parse(jsonText) as MinutesResult;

  return {
    summary: parsed.summary ?? '言及なし',
    customerInfo: parsed.customerInfo ?? '言及なし',
    items: parsed.items ?? '言及なし',
    offeredPrice: parsed.offeredPrice ?? '言及なし',
    nextActions: parsed.nextActions ?? '言及なし',
  };
}

// Claudeが念のためコードブロックで返してきた場合に備えて剥がす
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text;
}
