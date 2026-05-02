# 録音管理 Web + 録音アプリ iOS の monorepo 移行手順

新 repo `sekiemon1990/makxas-recording` を作り、下記 3 つの branch を 1 つにまとめます。

| 元 branch | 役割 | monorepo 内の配置 |
|---|---|---|
| `claude/review-recording-app-KtyN1` (admin Web) | Next.js 管理画面 | `apps/admin/` |
| `claude/sales-recording-app-9LcDo` (iOS) | Expo iOS アプリ | `apps/mobile/` |
| `feat/noise-removal` (iOS の機能追加 branch) | iOS のノイズ除去機能 | `apps/mobile/` の feature branch として温存 |

## 完成形

```
sekiemon1990/makxas-recording/
├── apps/
│   ├── admin/              ← Next.js 管理画面 (Vercel デプロイ)
│   │   ├── app/
│   │   ├── package.json
│   │   └── next.config.ts
│   └── mobile/             ← Expo iOS (EAS Build)
│       ├── app/
│       ├── package.json
│       ├── app.json
│       └── eas.json
├── functions/              ← Firebase Cloud Functions (両アプリで共有)
│   └── src/
├── packages/
│   └── shared/             ← Firestore 型定義など (将来共通化)
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── .firebaserc.example
├── package.json            ← npm workspaces
├── README.md
└── AGENTS.md
```

---

# Phase 0: ユーザー手作業 (GitHub 上で 1 回だけ)

## 0-1. 新 repo を GitHub UI で作成

1. https://github.com/new を開く
2. Owner: `sekiemon1990`
3. Repository name: `makxas-recording`
4. Description: `出張買取 録音管理 Web + 録音アプリ iOS (Firebase 共有 monorepo)`
5. **Private** を選択 (後で必要なら public 化)
6. **README, .gitignore, license は何も追加しない** (空 repo にする ← これ重要)
7. `Create repository` をクリック

完了したら、表示される URL `git@github.com:sekiemon1990/makxas-recording.git` をメモ。

---

# Phase 1: admin (Next.js Web) を移行

## 担当セッション: `~/Desktop/claude-code-admin` (録音管理セッション)

下記をそのセッションに渡してください。

### 手順 (admin セッション側で実行)

```bash
# 1. 作業ディレクトリの確認 (現在 admin Next.js があるはず)
cd ~/Desktop/claude-code-admin
git status
git branch --show-current
# 期待: claude/review-recording-app-KtyN1

# 2. 未コミット変更があれば一旦コミット
git add -A
git commit -m "chore: monorepo 移行前の作業状態を保存"
git push origin HEAD

# 3. 新しい monorepo の clone 先を準備
cd ~/Desktop
git clone git@github.com:sekiemon1990/makxas-recording.git makxas-recording
cd makxas-recording

# 4. monorepo の枠組みを作成
mkdir -p apps/admin apps/mobile packages/shared

# 5. admin のソースを apps/admin/ にコピー
#    (.git は除外する! これ重要)
rsync -av --exclude='.git' --exclude='node_modules' --exclude='.next' \
  ~/Desktop/claude-code-admin/ apps/admin/

# 6. ルートに workspace 用の package.json を作成 (下記参照)
# 7. ルートに .gitignore を作成 (下記参照)
# 8. ルートに README.md を作成 (下記参照)
# 9. ルートに AGENTS.md を作成 (旧 repo からコピー)

# 10. 動作確認
cd apps/admin
npm install   # 一時的に admin 単独で動かしてエラーが無いか確認
npm run dev   # http://localhost:3000 が起動するか
# 確認できたら Ctrl+C で停止

# 11. ルートに戻って初回コミット
cd ~/Desktop/makxas-recording
git add -A
git commit -m "feat: admin (Next.js 録音管理画面) を monorepo に取り込み"
git push -u origin main
```

### ルート `package.json` (Phase 1 時点)

```json
{
  "name": "makxas-recording",
  "private": true,
  "version": "0.0.0",
  "workspaces": [
    "apps/*",
    "functions",
    "packages/*"
  ],
  "scripts": {
    "dev:admin": "npm --workspace apps/admin run dev",
    "build:admin": "npm --workspace apps/admin run build"
  }
}
```

### ルート `.gitignore`

```gitignore
node_modules/
.next/
.expo/
ios/build/
android/build/
.DS_Store
.env
.env.local
.firebaserc
*.log
dist/
out/
```

### ルート `README.md`

````markdown
# makxas-recording

出張買取 録音管理 Web + 録音アプリ iOS の monorepo。
共通 Firebase project (Firestore + Storage + Cloud Functions) を使用。

## 構成

- `apps/admin/` — Next.js 録音管理画面 (Vercel デプロイ)
- `apps/mobile/` — Expo iOS 録音アプリ (EAS Build)
- `functions/` — Firebase Cloud Functions
- `packages/shared/` — 型定義・共通ロジック (将来)

## セットアップ

```bash
npm install
cp apps/admin/.env.example apps/admin/.env.local
cp .firebaserc.example .firebaserc

npm run dev:admin   # http://localhost:3000
```

詳細は `apps/admin/README.md` / `apps/mobile/README.md` 参照。
````

---

# Phase 2: Vercel に admin をつなぐ

## 担当: ユーザー (Vercel ダッシュボード手作業)

1. https://vercel.com/new を開く
2. `Import Git Repository` から `sekiemon1990/makxas-recording` を選択
3. Project 設定:
   - **Project Name**: `makxas-recording-admin`
   - **Framework Preset**: Next.js (自動検出されるはず)
   - **Root Directory**: `apps/admin` ← **重要、これを設定しないとビルドが落ちる**
   - **Build Command**: (デフォルトでよい)
   - **Output Directory**: (デフォルトでよい)
4. **Environment Variables** を設定 (旧プロジェクトの値をコピー):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (使っていれば)
   - `FIREBASE_ADMIN_PROJECT_ID`
   - `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `FIREBASE_ADMIN_PRIVATE_KEY`
   - その他 admin 側の `.env.example` に書いてあるもの全部
   - **どの env 変数が必要かは admin セッションに確認するのが確実**
5. `Deploy` をクリック
6. Production URL (例: `makxas-recording-admin.vercel.app`) が割り振られるのでメモ

### Supabase Auth のリダイレクト URL を追加

Supabase ダッシュボード → Authentication → URL Configuration:
- **Redirect URLs** に新 Vercel URL を追加 (例: `https://makxas-recording-admin.vercel.app/auth/callback`)
- 旧 URL も残してよい (両方動作)

---

# Phase 3: mobile (Expo iOS) を取り込み

## 担当セッション: `~/Desktop/claude-code` (Mac 上の iOS セッション)

### 注意: Phase 1 が完了して main に push されているのが前提

```bash
# 1. 作業ディレクトリ確認
cd ~/Desktop/claude-code
git status
git branch --show-current
# 期待: claude/sales-recording-app-9LcDo

# 2. 未コミット変更を保存
git add -A
git commit -m "chore: monorepo 移行前の作業状態を保存"
git push origin HEAD

# 3. feat/noise-removal も保存しておく
git fetch origin feat/noise-removal
git checkout feat/noise-removal
git push origin feat/noise-removal  # remote にあるならスキップ可

# 4. 新 monorepo を clone (Phase 1 で push 済みのもの)
cd ~/Desktop
git clone git@github.com:sekiemon1990/makxas-recording.git makxas-recording-mobile-tmp
# ↑ 別名で clone (admin セッションの作業 dir と被らないように)

cd makxas-recording-mobile-tmp

# 5. 新 branch を切る
git checkout -b feat/import-mobile-app

# 6. iOS アプリのソースを apps/mobile/ にコピー
#    (Firebase 設定ファイルはルートに既に admin が入れた可能性もあるので、
#     重複しないように Firebase 系はルートのみに置く)
rsync -av --exclude='.git' --exclude='node_modules' --exclude='ios/build' \
  --exclude='android/build' --exclude='.expo' \
  --exclude='firebase.json' --exclude='firestore.rules' \
  --exclude='firestore.indexes.json' --exclude='storage.rules' \
  --exclude='.firebaserc.example' --exclude='functions' \
  ~/Desktop/claude-code/ apps/mobile/

# 7. Firebase 系のルート配置 (admin にもあったが、iOS 側のものを正とする場合は上書き)
#    → admin / iOS どちらの firestore.rules を使うかは要相談
#    (両方の rules を merge する必要あり!)
cp ~/Desktop/claude-code/firebase.json ./firebase.json
cp ~/Desktop/claude-code/firestore.rules ./firestore.rules         # ★要 merge 確認
cp ~/Desktop/claude-code/firestore.indexes.json ./firestore.indexes.json
cp ~/Desktop/claude-code/storage.rules ./storage.rules
cp ~/Desktop/claude-code/.firebaserc.example ./.firebaserc.example

# 8. functions/ もルートへ
rsync -av --exclude='node_modules' --exclude='lib' \
  ~/Desktop/claude-code/functions/ functions/

# 9. ルート package.json の workspaces / scripts を更新 (下記参照)

# 10. 動作確認
cd apps/mobile
npm install
npx expo start --ios   # シミュレータ起動を確認 (Mac のみ)
# 確認できたら Ctrl+C で停止

# 11. コミット & PR
cd ~/Desktop/makxas-recording-mobile-tmp
git add -A
git commit -m "feat: mobile (Expo iOS 録音アプリ) を monorepo に取り込み"
git push -u origin feat/import-mobile-app

# 12. GitHub UI で PR を作成 → main にマージ
```

### Phase 3 完了後のルート `package.json`

```json
{
  "name": "makxas-recording",
  "private": true,
  "version": "0.0.0",
  "workspaces": [
    "apps/*",
    "functions",
    "packages/*"
  ],
  "scripts": {
    "dev:admin": "npm --workspace apps/admin run dev",
    "build:admin": "npm --workspace apps/admin run build",
    "dev:mobile": "npm --workspace apps/mobile run start",
    "build:mobile:ios": "npm --workspace apps/mobile run ios",
    "deploy:functions": "firebase deploy --only functions"
  }
}
```

### `firestore.rules` の merge 注意

**admin と iOS の両方が同じ Firestore に書き込む** ため、片方の rules が消えると本番が壊れる可能性あり。

手順:
1. `~/Desktop/claude-code-admin/firestore.rules` (admin 側) と `~/Desktop/claude-code/firestore.rules` (iOS 側) を **両方開く**
2. `match /` ブロックごとに両方の権限を allow するよう merge
3. テスト: Firebase emulator で両アプリを動かして、書き込み/読み込みが両方通ることを確認

迷ったら admin / iOS 両セッションに「あなたが書き込んでいる Firestore コレクション一覧と必要な権限を教えて」と聞くのが確実。

---

# Phase 4: feat/noise-removal を新 repo に持ち込み

## 担当セッション: iOS セッション (Mac)

```bash
cd ~/Desktop/makxas-recording-mobile-tmp
git checkout main
git pull origin main

# 1. ノイズ除去 branch を新 repo 用に作成
git checkout -b feat/noise-removal

# 2. 旧 repo の feat/noise-removal との差分を持ち込む
#    (旧 repo では iOS アプリがリポジトリ root に置かれていたが、
#     新 repo では apps/mobile/ 配下に移動しているため、ファイルパスを修正する)
#
# 一番安全な方法: 旧 feat/noise-removal を一旦 checkout して、
# 差分ファイルを apps/mobile/ にコピー

cd ~/Desktop/claude-code           # 旧 repo
git checkout feat/noise-removal
# 旧 sales-recording-app からの差分ファイル一覧を確認
git diff --name-only claude/sales-recording-app-9LcDo..feat/noise-removal

# 該当ファイルを apps/mobile/ 配下にコピー
# (差分が多いなら、旧 branch の特定ファイル群を新 repo の apps/mobile/ に rsync)

cd ~/Desktop/makxas-recording-mobile-tmp
# rsync などで該当ファイルだけコピー (具体的なファイルは差分次第)

git add -A
git commit -m "feat: ノイズ除去機能を取り込み"
git push -u origin feat/noise-removal
# GitHub UI で PR 作成
```

---

# Phase 5: 旧 branch のクリーンアップ

Phase 1-4 完了確認後、**ユーザーが** 旧 repo の不要 branch を削除:

```bash
cd ~/Desktop/claude-code   # マクサスサーチ本体側 (環境構築コーディネーターセッション)
# このセッションで一括削除コマンドを発行できるよう手順書化済 (削除リスト参照)
```

→ 削除リストは `02-generic-product-migration.md` の最後にまとめて記載。

---

# トラブル時のチェックリスト

| 症状 | 確認 |
|---|---|
| Vercel ビルドが「Cannot find module 'next'」で落ちる | Vercel 設定の `Root Directory` が `apps/admin` になっているか |
| Vercel ビルドが「Module not found」で落ちる | `npm install` が monorepo root で走っているか (workspaces 認識) |
| Supabase Auth でログインできない | Supabase Redirect URLs に新 Vercel URL を追加したか |
| iOS で Firestore 書き込みエラー | `firestore.rules` の merge ミスで権限が消えていないか |
| 旧 Vercel project (`claude-code-psi-eight`) との混乱 | これはマクサスサーチ用なので **そのまま稼働させる**。録音管理は別 project |

---

## 進捗報告フォーマット (各セッションから環境構築セッションへ)

下記を埋めてユーザー経由で報告:

```
[Phase X] 完了報告
- 実施 phase: (例: Phase 1 admin 移行)
- 動作確認: (例: localhost:3000 で OK / Vercel preview で OK)
- 残課題: (例: env 変数 FOO_API_KEY を後で追加する必要あり)
- 詰まった点: (もしあれば)
```
