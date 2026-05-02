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

### `claude/ai-phone-screening-uQhyh`
- 担当セッション: (未回収)
- 正式名称:
- 一行説明:
- スタック:
- デプロイ先:
- 共有リソース:
- 環境変数:
- 進捗:
- 独立 repo OK?:
- ローカルパス:

### `claude/build-donation-website-nmT5R`
- 担当セッション: (未回収)
- 正式名称:
- 一行説明:
- スタック:
- デプロイ先:
- 共有リソース:
- 環境変数:
- 進捗:
- 独立 repo OK?:
- ローカルパス:

### `claude/chatwork-mcp-integration-Xi1b4`
- 担当セッション: (未回収)
- 正式名称:
- 一行説明:
- スタック:
- デプロイ先:
- 共有リソース:
- 環境変数:
- 進捗:
- 独立 repo OK?:
- ローカルパス:

### `claude/setup-line-headquarters-iPZJx`
- 担当セッション: (未回収)
- 正式名称:
- 一行説明:
- スタック:
- デプロイ先:
- 共有リソース:
- 環境変数:
- 進捗:
- 独立 repo OK?:
- ローカルパス:

### `claude/automate-journal-entries-NJtzu`
- 担当セッション: (未回収)
- ※ コードがほぼ空 (.mcp.json と README.md のみ)。通常は **削除** で問題なし
- もし「これから着手する予定」「重要なメモが入っている」等あれば残す判断
