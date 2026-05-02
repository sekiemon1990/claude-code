# 単独プロダクト 独立 repo 移行 汎用手順

`makxas-recording` (monorepo) **以外** の各プロダクトを、それぞれ独立 repo に切り出す手順。

対象 (5 セッション全員から回答受領済、推奨 repo 名で確定):
- `sekiemon1990/chatwork-mcp` ← `claude/chatwork-mcp-integration-Xi1b4` (Cloud Run、85%)
- `sekiemon1990/makxas-mf-accounting-automation` (**PRIVATE 必須**) ← `claude/automate-journal-entries-NJtzu` (デプロイ不要、25-30%)
- `sekiemon1990/mono-kifu-foundation` ← `claude/build-donation-website-nmT5R` (Vercel、35-40%)
- `sekiemon1990/kaitori-maxus-line` ← `claude/setup-line-headquarters-iPZJx` (デプロイ不要、Phase 1 100%)
- `sekiemon1990/ai-phone-screening-poc` ← `claude/ai-phone-screening-uQhyh` (PoC archive、40%)

---

# 共通テンプレ (各プロダクトで同じ流れ)

以下、`{NEW_REPO}` = 新 repo 名 (例: `donation-website`)、`{OLD_BRANCH}` = 元 branch 名 (例: `claude/build-donation-website-nmT5R`)、`{LOCAL_DIR}` = 担当セッションのローカル作業ディレクトリ (例: `~/Desktop/claude-code-foo`) と読み替え。

## Phase A: GitHub UI で新 repo 作成 (ユーザー手作業)

1. https://github.com/new を開く
2. Owner: `sekiemon1990`
3. Repository name: `{NEW_REPO}`
4. Description: 担当セッションから聞いた一行説明
5. **Private**
6. **README, .gitignore, license は何も追加しない** (空 repo)
7. `Create repository`

## Phase B: ローカルから push (担当セッション側で実行)

```bash
# 1. 作業ディレクトリ確認
cd {LOCAL_DIR}
git status
git branch --show-current
# 期待: {OLD_BRANCH}

# 2. 未コミット変更を保存
git add -A
git commit -m "chore: repo 分割移行前の作業状態を保存" || echo "no changes"
git push origin HEAD

# 3. 現在の branch を新 repo の main として push
#    (履歴をそのまま持ち込む方式)
git remote add new-origin git@github.com:sekiemon1990/{NEW_REPO}.git

# 4. 新 repo の main として push
git push new-origin {OLD_BRANCH}:main

# 5. ローカルの origin を新 repo に切り替え (旧 repo へは push しなくなる)
git remote remove origin
git remote rename new-origin origin

# 6. ローカル branch を main にして整える
git checkout -b main
git branch -D {OLD_BRANCH}  # 古い branch 名のローカルコピーを削除
git pull origin main

# 7. 動作確認 (プロダクトに応じて)
# Next.js: npm install && npm run dev
# Node サーバー: npm install && npm start
# Docker: docker build . && docker run ...

# 8. README.md を更新 (もし旧 repo を指す記述があれば修正)
```

## Phase C: デプロイ先の設定 (プロダクト種別による)

### Vercel (Next.js 系: donation-website)

1. https://vercel.com/new
2. `sekiemon1990/{NEW_REPO}` を import
3. Project Name: `{NEW_REPO}`
4. Framework: 自動検出 (Next.js)
5. Root Directory: `.` (リポジトリ root)
6. Environment Variables: 担当セッションから聞いた `.env.example` の値をすべてコピー
7. `Deploy`

### Render / Fly.io (Node サーバー系: ai-phone-screening)

担当セッションに「どのホスティングが想定か」を確認後、別途手順策定。
無料枠で済ませたいなら **Render** が簡単。Twilio 等の電話 API を使うなら **Fly.io** が WebSocket 安定。

### 自前 Docker / Cloud Run (chatwork-mcp)

`Dockerfile` がある場合は Cloud Run へ deploy:

```bash
# Cloud Run へのデプロイ例 (要 gcloud CLI)
gcloud run deploy {NEW_REPO} \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated   # MCP server が public 必要なら
```

### LINE bot (line-headquarters)

LINE Messaging API の Webhook URL を、デプロイ先 (Render / Cloud Run / 自前サーバー) に向ける。
担当セッションの構成を見てから決定。

---

# プロダクト別の補足 (5 セッション全員から回答受領済)

## #5 chatwork-mcp ← 最優先 (85% 完成済)
- 正式名称: Chatwork MCP Server
- 新 repo: `sekiemon1990/chatwork-mcp` (PRIVATE で開始、将来 npm 公開も視野なら public 化)
- スタック: TypeScript / @modelcontextprotocol/sdk v1.29 / Express / Zod
- デプロイ先: Cloud Run (`Dockerfile` + `deploy/cloud-run.md` + GitHub Actions cron sample 同梱)
- 環境変数: `CHATWORK_API_TOKEN` (必須), `CHATWORK_API_BASE_URL`, `PORT`, `MCP_BEARER_TOKEN`, `ANTHROPIC_API_KEY`
- 進捗: 約 85% (実 Chatwork API での E2E と Cloud Run 実デプロイのみ未)
- Phase B の Phase B-3 で git push、Phase C は **Cloud Run** 手順を後日策定

## #7 makxas-mf-accounting-automation ← 2 番目 (PRIVATE 必須)
- 正式名称: 株式会社マクサス MF 会計 仕訳自動化
- 新 repo: `sekiemon1990/makxas-mf-accounting-automation` (**必ず PRIVATE**)
- 理由: `CLAUDE.md` (8321 bytes) に事業者プロファイル・業務ルール・取引パターン記載
- スタック: Claude Code CLI + MoneyForward 公式リモート MCP β + Python 3
- デプロイ先: 不要 (担当者ローカル PC `/Users/kentoseki/mf-accounting-automation` で対話実行)
- 環境変数: 不要 (OAuth は Claude Code CLI が暗号化保管)
- 中身: `.mcp.json` + `CLAUDE.md` のみ (業務データは含まず)
- 進捗: 25-30%、初の自動仕訳投稿成功済 (#20390 ¥1.2M)

## #4 mono-kifu-foundation ← 3 番目
- 正式名称: モノ寄付基金 (Mono Kifu Foundation) / 一般財団法人運営
- 新 repo: `sekiemon1990/mono-kifu-foundation` (PRIVATE 推奨)
- スタック: Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS v4 / Noto Sans JP
- デプロイ先: ✅ Vercel (これから初回デプロイ)
- 環境変数: 現状不要 (フロントモック)。将来 `MAXASCORE_API_BASE_URL`, `MAXASCORE_API_KEY`, `SMTP_*`, `NEXT_PUBLIC_SITE_URL`
- 進捗: 約 35-40% (寄付者向けフロント 90%、管理画面/DB/認証は 0%)
- 注意: 当初予定の「コングラント」連携は不要に変更済。マクサスコア連携は将来予定

## #6 kaitori-maxus-line ← 4 番目
- 正式名称: 買取マクサス 公式 LINE 構築プロジェクト (本部用アカウント)
- 新 repo: `sekiemon1990/kaitori-maxus-line` (PRIVATE 推奨、設計判断履歴を保持)
- スタック: Markdown / YAML / JSON / SVG / HTML / Git LFS (動画用)
- デプロイ先: **不要** (LINE 公式アカウントマネージャーが本番、リポジトリは設計の単一情報源)
- 環境変数: 不要 (将来 Bot 化時に `LINE_CHANNEL_*` 等)
- 進捗: Phase 1 (設計・構築) 100% / 全体 約 40%
- ⚠️ **Git LFS 注意**: このリポジトリは Git LFS を使用。新 repo に push する際 `git lfs push --all new-origin main` も別途実行が必要 (`02-generic-product-migration.md` Phase B-3.5 を参照)
- 重要: コミット履歴 (設計判断の経緯) を保ったまま移行

## #3 ai-phone-screening-poc ← 5 番目 (PoC archive 化)
- 正式名称: AI 電話スクリーニング PoC
- 新 repo: `sekiemon1990/ai-phone-screening-poc` ← **`-poc` suffix 推奨**
- 理由: 担当セッションから「方針転換あり、本格版は **Pipecat ベースの別アーキテクチャ** で別 repo として始める」との回答
- スタック: Node.js 20+ / Fastify / @fastify/websocket / ws / Twilio / OpenAI Realtime / Gemini Live
- デプロイ先: 未定 (PoC のためデプロイなし、後日本格版が始まるまで凍結)
- 環境変数: `PROVIDER`, `PORT`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_VOICE`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_VOICE`, `SYSTEM_MESSAGE`
- 進捗: 約 40% (コア実装 OK、Twilio 実機未テスト)
- **移行後の処置**: GitHub UI で Settings → 一番下 → `Archive this repository` をクリックして read-only 化推奨 (誤って commit されないように)
- 本格版 (Pipecat) は別途 `makxas-phone-system` 等の名前で新規開始 (このセッションの管轄外)

---

## Phase B-3.5: Git LFS が使われている repo の追加手順 (#6 kaitori-maxus-line のみ)

```bash
# Phase B の git push の後に追加実行
git lfs install
git lfs push --all new-origin main
# LFS オブジェクトが GitHub に上がったか確認
git lfs ls-files
```

---

# Phase D: 旧 repo `sekiemon1990/claude-code` の不要 branch 削除

**全プロダクトの移行が完了してから** 実行。
各 branch の中身は新 repo に保存済みなので、旧 branch は削除して構わない。

```bash
# 環境構築コーディネーターセッション (このセッション) から実行
cd /home/user/claude-code
git fetch --all --prune

# 削除候補 (各プロダクトの新 repo への移行を完了確認してから 1 件ずつ削除):

# Phase 1 完了後 → chatwork-mcp 関連
git push origin --delete claude/chatwork-mcp-integration-Xi1b4

# Phase 2 完了後 → makxas-mf-accounting-automation 関連
git push origin --delete claude/automate-journal-entries-NJtzu

# Phase 3 完了後 → mono-kifu-foundation 関連
git push origin --delete claude/build-donation-website-nmT5R

# Phase 4 完了後 → kaitori-maxus-line 関連
git push origin --delete claude/setup-line-headquarters-iPZJx

# Phase 5 完了後 → makxas-recording 関連 (3 branch)
git push origin --delete claude/review-recording-app-KtyN1
git push origin --delete claude/sales-recording-app-9LcDo
git push origin --delete feat/noise-removal

# Phase 6 完了後 → ai-phone-screening-poc 関連
git push origin --delete claude/ai-phone-screening-uQhyh

# 全 Phase 完了後 → マージ済の作業 branch (既に main に入っている)
git push origin --delete claude/appraisal-tool-design-WT1gY
git push origin --delete claude/appraisal-tool-design-WT1gY-rules

# 環境構築用 branch (このセッションのもの) は最後に削除
# git push origin --delete claude/split-monorepo-products-2uREq
```

⚠️ **重要**: 削除前に必ず「新 repo に push 済か」を `git log --oneline -5` 等で確認すること。

---

# Phase E: 旧 repo を `makxas-search` にリネーム (将来)

旧 repo `sekiemon1990/claude-code` を `sekiemon1990/makxas-search` にリネームする場合の手順:

1. GitHub UI: Settings → Repository name → `makxas-search` に変更 → Rename
2. Vercel: 自動的に新 URL を認識するが、念のため Settings → Git で確認
3. 各セッションのローカル: `git remote set-url origin git@github.com:sekiemon1990/makxas-search.git`

⚠️ 旧 URL からの redirect は GitHub が自動で行うが、CI / external link は手動更新が必要。
このリネームは **全セッションが落ち着いてから** 行うこと。
