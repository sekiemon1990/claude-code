<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:multi-session-rules -->
# 複数セッション並列開発ルール

このリポジトリは複数の Claude Code セッションが並行して作業している。各セッションは別の機能担当 (例: 査定ツール / 録音アプリ / AI スクリーニング 等) を担当しているため、衝突を避けるルールを守ること。

## ブランチ運用

- 自分のセッション専用ブランチで作業し、**main には直接 push しない**
- ブランチ命名: `claude/<feature-name>-<random-tag>` (現在の各セッションは既にこのパターンで動作)
- 他セッションのブランチには **絶対に commit / push しない**
- 別セッションが作った PR を merge / close しない

## マージ運用

- マージは **リポジトリ所有者 (sekiemon1990) が行う** か、自分のセッションの PR のみ自分でマージ
- マージは **1 つずつ順番に** (Vercel デプロイが終わってから次へ)
- 連続で複数 PR をマージしない (Vercel webhook が混乱する)
- マージ前に CI が緑になっていることを確認

## ファイル衝突回避

複数セッションが同じファイルを触る前提で:
- **共有型 (`src/lib/types.ts` 等)** を変更する場合は他セッションに影響しないか確認
- `package.json` / 依存追加は他セッションの作業を一時止めてから
- `next.config.ts` / `tsconfig.json` 等のビルド設定変更は影響大なので慎重に
- `supabase/*.sql` の新規マイグレーションは PR description に SQL を記載

## 作業開始時の必須手順

```bash
git fetch origin
git checkout main
git pull origin main
git log --oneline -10  # 他セッションの変更を把握
git checkout -b claude/<your-branch>
```

## デプロイ管理

- Vercel は同時ビルド数に制限あり (Hobby tier)
- **連続マージは 2-3 分間隔を空ける**
- Vercel が反応しない場合は Deployments タブから **「Redeploy」**
- 緊急時は空コミット push で webhook 再 trigger 可

## デバッグ時の注意

- 本番が壊れた場合、まず **どのセッション/PR で発生したか特定**
- Rollback は Vercel Deployments で `Rollback to Production` を使用
- 直接 main に hotfix する場合も、まず `git pull` で他セッションの変更を取り込んでから
<!-- END:multi-session-rules -->
