# 担当セッション照会テンプレ

担当者不明の branch について、各セッションに「自分が触っているのはこの branch か」「現状どこまでできているか」を聞き出すための雛形。

## 使い方

1. 該当しそうな Claude Code セッションを開く
2. 下記「貼り付け文」を **そのままコピペ** して投げる
3. 返ってきた回答を、このセッション (`claude/split-monorepo-products-2uREq`) に持ち帰る

---

## 対象 branch (回答待ち)

| branch | 推測プロダクト名 |
|---|---|
| `claude/ai-phone-screening-uQhyh` | AI 電話スクリーニング (Node.js) |
| `claude/build-donation-website-nmT5R` | 寄付サイト (Next.js) |
| `claude/chatwork-mcp-integration-Xi1b4` | Chatwork MCP サーバー (Docker) |
| `claude/setup-line-headquarters-iPZJx` | LINE 本部 bot |
| `claude/automate-journal-entries-NJtzu` | 仕訳自動化 (中身ほぼ空 → 削除候補) |

---

## 貼り付け文 (各セッションへ)

```
あなたのセッションが触っている GitHub branch を教えてください。

現在 sekiemon1990 のリポジトリ整理を進めています。
リポジトリ `sekiemon1990/claude-code` 上に下記の branch があり、
どれがあなたの担当か (もしくは無関係か) を確認したいです:

  - claude/ai-phone-screening-uQhyh
  - claude/build-donation-website-nmT5R
  - claude/chatwork-mcp-integration-Xi1b4
  - claude/setup-line-headquarters-iPZJx
  - claude/automate-journal-entries-NJtzu

以下の質問に答えてください (該当しなければ「無関係」と書いてください):

1. 上記 branch のうち、あなたが現在作業中のものはどれですか?
2. そのプロダクトの正式名称は何ですか? (例: 「AI 電話スクリーニング」)
3. プロダクトの一行説明をお願いします (何をするシステムか)
4. 技術スタック (主要なもの 3-5 個):
   - 例: Next.js / React / Tailwind / Supabase / Vercel
5. デプロイ先は何ですか? (Vercel / Render / Fly.io / Cloud Run / 自社サーバー / iOS App Store / 未定 等)
6. 他プロダクトと共有している外部リソースはありますか?
   - DB (Supabase / Firebase 等)
   - 認証 (Google OAuth 等)
   - API キー (LINE / Chatwork / Anthropic 等)
   - 「無し」でも OK です
7. 必要な環境変数 (`.env`) のキー名一覧:
   - 例: `NEXT_PUBLIC_SUPABASE_URL`, `ANTHROPIC_API_KEY`, ...
   - `.env.example` があるならそのまま貼ってください
8. 開発の進捗 (ざっくり %):
   - 例: 「0% (構想のみ)」「30% (DB 設計と画面 1 つ)」「80% (本番投入直前)」
9. このプロダクトを今後 **独立リポジトリ** に切り出してよいですか?
   (yes/no/相談したい)
10. ローカルの作業ディレクトリ (絶対パス) を教えてください:
    - 例: `~/Desktop/claude-code-foo`
    - これは新 repo へ git push する際の参照用です

回答は箇条書きで構いません。よろしくお願いします。
```

---

## 回答収集テーブル (回答が来たらここに転記)

### `claude/ai-phone-screening-uQhyh` ✅ 回答受領
- 担当セッション: 別 Claude Code web セッション (識別子無し、ユーザー記憶のみ)
- 正式名称: **AI 電話スクリーニング PoC** (AI Phone Screening)
- 一行説明: Twilio 着信を OpenAI Realtime / Gemini Live に WebSocket ブリッジするリアルタイム会話 PoC
- スタック: Node.js 20+ / Fastify / @fastify/websocket / ws / Twilio Media Streams / OpenAI Realtime / Gemini Live
- デプロイ先: 未定 (現状ローカル + ngrok)
- 共有リソース: なし (DB/認証なし、API キーは個別)
- 環境変数: `PROVIDER`, `PORT`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_VOICE`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_VOICE`, `SYSTEM_MESSAGE`
- 進捗: 約 40% (コア実装 OK、Twilio 実機テスト未実施)
- 独立 repo OK?: **yes (相談したい)** ← 方針転換あり、本格版は **Pipecat ベースで別アーキテクチャ** に移行予定
- ローカルパス: `/home/user/claude-code` (web 版 sandbox なので識別子にならない)
- **要相談**: PoC を独立 repo (例: `ai-phone-screening-poc`) として archive 保存するか、将来の本格版の起点とするか

### `claude/build-donation-website-nmT5R` ✅ 回答受領
- 担当セッション: 別 Claude Code web セッション (識別子無し)
- 正式名称: **モノ寄付基金** (Mono Kifu Foundation) / 運営: 一般財団法人 モノ寄付基金
- 一行説明: 不要品を箱で送ると専門査定額が提携 NPO への寄付になる「寄付版メルカリ」型プラットフォーム
- スタック: Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS v4 / Noto Sans JP
- デプロイ先: **Vercel** (未デプロイ、これから)
- 共有リソース: 現時点なし。将来 **マクサスコア** (査定基盤) と API 連携予定
- 環境変数: 現状なし (フロントエンドモックのみ)。将来 `MAXASCORE_API_BASE_URL`, `MAXASCORE_API_KEY`, `SMTP_*`, `NEXT_PUBLIC_SITE_URL`
- 進捗: 約 35-40% (寄付者向けフロント 90%、管理画面/DB/API/認証は 0%)
- 独立 repo OK?: **yes** (推奨 repo 名: `mono-kifu-foundation`)
- ローカルパス: `/home/user/claude-code` (sandbox)

### `claude/chatwork-mcp-integration-Xi1b4` ✅ 回答受領
- 担当セッション: 別 Claude Code web セッション (識別子無し)
- 正式名称: **Chatwork MCP Server** (パッケージ名 `chatwork-mcp`)
- 一行説明: Chatwork REST API を MCP サーバーとしてラップし、Claude / Claude Code から操作可能にする
- スタック: TypeScript (Node.js 18+) / `@modelcontextprotocol/sdk` v1.29 / Express / Zod / `@anthropic-ai/claude-agent-sdk` (devDep)
- デプロイ先: ローカル stdio (Claude Code 同梱) / Cloud Run (Dockerfile + 手順あり、未デプロイ) / GitHub Actions cron sample
- 共有リソース: なし (ステートレス)。`CHATWORK_API_TOKEN` と `ANTHROPIC_API_KEY` は利用者個別
- 環境変数: `CHATWORK_API_TOKEN` (必須), `CHATWORK_API_BASE_URL`, `PORT`, `MCP_BEARER_TOKEN`, `ANTHROPIC_API_KEY`
- 進捗: **約 85%** (コード完成、型チェック/ビルド/MCP プロトコル疎通 OK、実 API E2E 検証と Cloud Run 実デプロイ未実施)
- 独立 repo OK?: **yes** (推奨 repo 名: `chatwork-mcp` / 将来 npm 公開も視野)
- ローカルパス: `/home/user/claude-code` (sandbox)、HEAD `0b55e14`

### `claude/setup-line-headquarters-iPZJx` ✅ 回答受領
- 担当セッション: 別 Claude Code web セッション (識別子無し)
- 正式名称: **買取マクサス 公式 LINE 構築プロジェクト** (本部用アカウント)
- 一行説明: 買取業の公式 LINE アカウントを集客チャネルとして構築するための **設計書 / シナリオ / デザインモック / 運用マニュアル一式** (コードプロダクトではなくドキュメント中心)
- スタック: Markdown / YAML / JSON / SVG / HTML / Git LFS。コード実装は無し
- デプロイ先: **不要** (LINE 公式アカウントマネージャーが本番、リポジトリは設計の単一情報源)
- 共有リソース: 現時点なし。将来 LINE Messaging API、CRM 連携の可能性
- 環境変数: 現状不要 (`.env.example` 未作成)。将来 `LINE_CHANNEL_*`, `SLACK_WEBHOOK_URL`, `CRM_API_KEY`
- 進捗: Phase 1 (設計) 100% / 全体 約 40%
- 独立 repo OK?: **yes** (推奨 repo 名: `kaitori-maxus-line` or `maxus-official-line`)
- ローカルパス: `/home/user/claude-code` (sandbox)、HEAD `02b0671`
- **重要**: コミット履歴 (設計判断の経緯) を保ったまま移行推奨

### `claude/automate-journal-entries-NJtzu` ✅ 回答受領
- 担当セッション: 別 Claude Code web セッション (識別子無し) + ユーザーローカル `/Users/kentoseki/mf-accounting-automation`
- 正式名称: **株式会社マクサス MF 会計 仕訳自動化** (仮称)
- 一行説明: MF 会計クラウドに対し Claude Code + 公式 MCP server 経由で仕訳作成・分類・月次健全性チェックを自動化
- スタック: Claude Code CLI v2.1.114 / MoneyForward Cloud Accounting MCP Server (公式リモート β、HTTP+OAuth) / `CLAUDE.md` 宣言型ルール / Python 3 (集計用)
- デプロイ先: 未定 (現状ローカル PC で対話実行、財務影響大なため当面サーバーレス化せず)
- 共有リソース: MF 会計 OAuth (株式会社マクサスのアカウント)、他 branch との共有なし
- 環境変数: 不要 (OAuth トークンは Claude Code CLI 暗号化保管 `~/.claude/` 配下)
- 進捗: 約 **25-30%** (マスタ収集完了、初の自動仕訳投稿成功済 #20390 ¥1.2M)
- 独立 repo OK?: **yes** (推奨 repo 名: `makxas-mf-accounting-automation` or `mf-accounting-automation`)
- **重要**: PRIVATE 必須 (`CLAUDE.md` に事業者プロファイル・業務ルール記載のため)
- 中身: `.mcp.json` (公開 OK) + `CLAUDE.md` (公開 OK、パスワード等は含まず) のみ。業務データは含まず
