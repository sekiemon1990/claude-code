# 単独プロダクト 独立 repo 移行 汎用手順

`makxas-recording` (monorepo) **以外** の各プロダクトを、それぞれ独立 repo に切り出す手順。

対象 (担当セッションへの照会で詳細を埋めてから着手):
- `sekiemon1990/ai-phone-screening` ← `claude/ai-phone-screening-uQhyh`
- `sekiemon1990/donation-website` ← `claude/build-donation-website-nmT5R`
- `sekiemon1990/chatwork-mcp` ← `claude/chatwork-mcp-integration-Xi1b4`
- `sekiemon1990/line-headquarters` ← `claude/setup-line-headquarters-iPZJx`

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

# プロダクト別の補足 (照会で判明したら埋める)

## #3 ai-phone-screening
- 構造: Node サーバー (`server.js` + `audio.js` + `providers/`)
- 推定: **Twilio + LLM プロバイダ系** (`providers/` の名前から推測)
- 推奨デプロイ先: Render or Fly.io
- 環境変数: `.env.example` 参照 (担当セッションから取得)
- Vercel: ❌ (long-running Node サーバーは Vercel に不向き)

## #4 donation-website
- 構造: Next.js (`next.config.ts`, `app/`, `components/`, `data/`)
- 推奨デプロイ先: ✅ Vercel
- 環境変数: 担当セッションから `.env.example` を取得して設定
- 注意: 寄付決済を扱うなら Stripe / Square 等の API キーが必要かも

## #5 chatwork-mcp
- 構造: TS サーバー + Dockerfile (`src/`, `deploy/`, `Dockerfile`)
- 推奨デプロイ先: Cloud Run / Fly.io / 自前サーバー
- 環境変数: `CHATWORK_API_TOKEN` 等
- Vercel: ❌ (Docker 前提)

## #6 line-headquarters
- 構造: bot 設定 (`bot/`, `config/`, `design/`)
- 推奨デプロイ先: 担当セッションに確認 (LINE Messaging API の Webhook が動く環境)
- 環境変数: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` 等

## (削除候補) automate-journal-entries
- 中身: `.mcp.json` + `CLAUDE.md` + `README.md` のみ (実装コード無し)
- 担当セッションに「これから着手予定か / 削除してよいか」確認
- 削除する場合: 旧 repo の branch 削除 (Phase D 参照)

---

# Phase D: 旧 repo `sekiemon1990/claude-code` の不要 branch 削除

**全プロダクトの移行が完了してから** 実行。
各 branch の中身は新 repo に保存済みなので、旧 branch は削除して構わない。

```bash
# 環境構築コーディネーターセッション (このセッション) から実行
cd /home/user/claude-code
git fetch --all --prune

# 削除候補 (移行完了したら削除):
git push origin --delete claude/review-recording-app-KtyN1
git push origin --delete claude/sales-recording-app-9LcDo
git push origin --delete feat/noise-removal
git push origin --delete claude/ai-phone-screening-uQhyh
git push origin --delete claude/build-donation-website-nmT5R
git push origin --delete claude/chatwork-mcp-integration-Xi1b4
git push origin --delete claude/setup-line-headquarters-iPZJx
git push origin --delete claude/automate-journal-entries-NJtzu

# マージ済の作業 branch (既に main に入っている)
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
