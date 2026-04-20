# セットアップガイド（実機検証まで）

このドキュメントに沿って進めれば、実機で「ログイン → 案件選択 → 録音 → 文字起こし → 議事録生成」が通るところまで到達できる。

所要時間: **初回 90〜120分**（Firebase / Google Cloud / EAS のアカウント準備込み）。

---

## 目次

1. [前提と用意するもの](#1-前提と用意するもの)
2. [Firebase プロジェクトの作成](#2-firebase-プロジェクトの作成)
3. [Authentication（Google サインイン）の設定](#3-authenticationgoogle-サインインの設定)
4. [Firestore / Storage の有効化](#4-firestore--storage-の有効化)
5. [Cloud Functions の有効化（Blaze プラン必須）](#5-cloud-functions-の有効化blaze-プラン必須)
6. [Google OAuth クライアント ID の作成](#6-google-oauth-クライアント-id-の作成)
7. [ローカル環境変数の設定](#7-ローカル環境変数の設定)
8. [セキュリティルール・インデックスのデプロイ](#8-セキュリティルールインデックスのデプロイ)
9. [Cloud Functions 用シークレットの登録とデプロイ](#9-cloud-functions-用シークレットの登録とデプロイ)
10. [EAS（Expo Application Services）のセットアップ](#10-easexpo-application-servicesのセットアップ)
11. [開発ビルドの作成と実機インストール](#11-開発ビルドの作成と実機インストール)
12. [動作確認](#12-動作確認)
13. [よくあるハマり](#13-よくあるハマり)

---

## 1. 前提と用意するもの

### アカウント

- [ ] **Google アカウント**（Firebase / Google Cloud / EAS で使う）
- [ ] **Apple Developer アカウント**（iOS 実機配布する場合、年間 $99）
- [ ] **Google Play Developer アカウント**（Android 正式配布する場合、$25 一回払い）※開発ビルドの内部配布だけなら不要

### 開発環境

```bash
# Node.js 20 以上
node -v

# 必要な CLI
npm install -g firebase-tools
npm install -g eas-cli
```

- [ ] macOS なら Xcode（iOS ビルド用）
- [ ] Android Studio（Android エミュレータ・SHA-1 確認用）

### クレジットカード

- [ ] Firebase の Cloud Functions が **Blaze プラン必須**。無料枠内で収まる見込みだが、支払い情報の登録は必要

### API キー（後で取得）

- [ ] **OpenAI API キー**（Whisper 用）— https://platform.openai.com/
- [ ] **Anthropic API キー**（Claude 用）— https://console.anthropic.com/

---

## 2. Firebase プロジェクトの作成

1. https://console.firebase.google.com/ を開く
2. 「**プロジェクトを追加**」→ プロジェクト名を入力
   - 例: `sales-recording-prod`（本番用）、`sales-recording-stg`（ステージング用）
   - ※ 後でステージング/本番を分ける予定があるなら最初から2つ作ってもよい
3. Google アナリティクスは任意（無くても OK）
4. プロジェクトが作成されたら、**ダッシュボード左上の歯車 → プロジェクトを設定** を開く
5. 「**全般**」タブの下部に「マイアプリ」欄がある → **`</>` アイコン（Web）** を選択してアプリを追加
   - ニックネーム: `sales-recording-app-web`（何でもOK）
   - Firebase Hosting は不要（チェック外す）
6. 表示される `firebaseConfig` の値を**メモ**しておく（後でローカル `.env` に転記）

```javascript
// こういうのが表示されるので、値をメモする
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "sales-recording-prod.firebaseapp.com",
  projectId: "sales-recording-prod",
  storageBucket: "sales-recording-prod.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef..."
};
```

> **補足**: これらは「秘密鍵」ではなくプロジェクト識別子。セキュリティは Firebase セキュリティルール側で担保する。

---

## 3. Authentication（Google サインイン）の設定

1. Firebase コンソール左メニュー → **Authentication** → 「始める」
2. **Sign-in method** タブ → **Google** を有効化
   - プロジェクトの公開名とサポートメールを入力して保存
3. Google Workspace 運用する場合は、**承認済みドメイン**に自社ドメインを追加しておく（例: `makxas.co.jp`）

> **後で使える制限**: 特定ドメインのみログイン可にするには、Cloud Functions または Firestore rules で `context.auth.token.email` の末尾をチェックする。MVP では未実装。

---

## 4. Firestore / Storage の有効化

### Firestore

1. Firebase コンソール → **Firestore Database** → 「データベースを作成」
2. **本番環境モード**を選択（後からルールを自前でデプロイするため）
3. リージョン: `asia-northeast1`（東京）を推奨

### Storage

1. Firebase コンソール → **Storage** → 「始める」
2. ルールは後で置き換えるので、初期の「本番環境ルール」で OK
3. 同じく `asia-northeast1`

---

## 5. Cloud Functions の有効化（Blaze プラン必須）

1. Firebase コンソール → **Functions** → 「始める」
2. **Blaze プラン（従量課金）へのアップグレード**を求められる
   - ダイアログに従ってクレジットカード情報を登録
   - **予算アラート**を設定しておくと安心（例: $10/月で通知）
3. Functions 自体は `firebase deploy` で初めて作成されるので、ここではアップグレードだけで OK

### 無料枠の目安（参考）
- Cloud Functions: 200万回/月、400,000 GB-秒/月まで無料
- Firestore: 読み込み 50,000/日、書き込み 20,000/日まで無料
- Storage: 5GB まで無料
- **Whisper/Claude の API 料金は Firebase とは別**（OpenAI / Anthropic 側）

---

## 6. Google OAuth クライアント ID の作成

Google サインインには **3種類**のクライアント ID を作る必要がある。

Google Cloud Console を開く: https://console.cloud.google.com/

> **注意**: Firebase プロジェクト作成時に自動で Google Cloud プロジェクトが作られている。プロジェクト選択欄で Firebase と同じプロジェクトを選ぶこと。

### 6-1. OAuth 同意画面の設定

1. **APIs & Services → OAuth consent screen**
2. User Type: **Internal**（Workspace ユーザー限定）or **External**（誰でも）
3. アプリ名・サポートメール・承認済みドメイン（例: `makxas.co.jp`）を入力
4. スコープは `email` / `profile` / `openid` が既定で入っていれば十分

### 6-2. クライアント ID の作成

**APIs & Services → Credentials → 認証情報を作成 → OAuth クライアント ID**

#### (a) Web クライアント
- **アプリケーションの種類**: ウェブ アプリケーション
- **名前**: `sales-recording-web`
- 承認済みのリダイレクト URI: **空でOK**（Firebase Auth が内部で使う）
- 作成後に表示される **クライアント ID** を `GOOGLE_WEB_CLIENT_ID` にメモ

#### (b) iOS クライアント
- **アプリケーションの種類**: iOS
- **名前**: `sales-recording-ios`
- **バンドル ID**: `com.makxas.salesrecording`
- **クライアント ID** を `GOOGLE_IOS_CLIENT_ID` にメモ

#### (c) Android クライアント
- **アプリケーションの種類**: Android
- **名前**: `sales-recording-android`
- **パッケージ名**: `com.makxas.salesrecording`
- **SHA-1 証明書フィンガープリント**: 開発ビルドと本番ビルドで異なるので両方登録
  - 開発ビルドの SHA-1 は EAS ビルド後に `eas credentials` で確認できる（Step 10 参照）
  - ひとまず作成して、後で SHA-1 を追記する形で OK
- **クライアント ID** を `GOOGLE_ANDROID_CLIENT_ID` にメモ

---

## 7. ローカル環境変数の設定

リポジトリを clone して初期化。

```bash
git clone <このリポジトリ>
cd claude-code
npm install
```

### 7-1. アプリ側の `.env` 作成

```bash
cp app/.env.example app/.env
```

`app/.env` を開き、Step 2 と Step 6 でメモした値を入れる:

```env
FIREBASE_API_KEY=AIzaSyC...
FIREBASE_AUTH_DOMAIN=sales-recording-prod.firebaseapp.com
FIREBASE_PROJECT_ID=sales-recording-prod
FIREBASE_STORAGE_BUCKET=sales-recording-prod.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef...

GOOGLE_WEB_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=123456789-yyyy.apps.googleusercontent.com
GOOGLE_ANDROID_CLIENT_ID=123456789-zzzz.apps.googleusercontent.com
```

### 7-2. Firebase プロジェクトの紐付け

```bash
firebase login          # ブラウザが開くので Google アカウントでログイン
firebase use --add      # 対象プロジェクトを選択 → エイリアス名を「default」に
```

これで `.firebaserc` が作成される（このファイルはコミットされない）。

---

## 8. セキュリティルール・インデックスのデプロイ

リポジトリ直下で:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

成功すると:
- `firestore.rules` が適用される
- Storage のルールが適用される
- `firestore.indexes.json` のインデックスが作成開始（数分かかることがある）

---

## 9. Cloud Functions 用シークレットの登録とデプロイ

### 9-1. API キーをシークレットとして登録

```bash
firebase functions:secrets:set OPENAI_API_KEY
# → プロンプトが出るので OpenAI のキーを貼り付け

firebase functions:secrets:set ANTHROPIC_API_KEY
# → Anthropic のキーを貼り付け
```

### 9-2. Functions をビルドしてデプロイ

```bash
cd functions && npm install && cd ..
npm run functions:build
firebase deploy --only functions
```

初回デプロイは 5〜10分かかる。成功するとコンソールに関数 `onRecordingUploaded` が出現する。

---

## 10. EAS（Expo Application Services）のセットアップ

Expo Go では動かない（`expo-background-fetch` や Google Sign-In 用のカスタムスキームを含むため、開発ビルドが必要）。EAS Build でネイティブビルドを作る。

```bash
cd app
eas login             # Expo アカウントでログイン（無料）
eas init              # プロジェクト作成、EAS_PROJECT_ID が .env に書き込まれる
```

`.env` に `EAS_PROJECT_ID` が入っていることを確認。

---

## 11. 開発ビルドの作成と実機インストール

### iOS シミュレータ用（開発用・SHA-1 不要）

```bash
eas build --profile development --platform ios
```

- 初回は Apple Developer 情報を求められる（証明書は EAS が自動管理してくれる）
- 10〜15分でビルド完了
- 完了すると `.ipa` のダウンロードリンクが表示される
- ローカルの Xcode Simulator へはドラッグ＆ドロップでインストール

### iOS 実機用

```bash
eas build --profile development --platform ios
# → device UDID を聞かれる。実機の UDID を登録する
```

### Android

```bash
eas build --profile development --platform android
```

ビルド完了後の APK を実機にインストール（QR コード or URL 経由）。

### Android: SHA-1 を OAuth クライアントに登録

ビルド後に:

```bash
eas credentials
# → Android → Keystore → 「View keystore credentials」で SHA-1 が見える
```

Step 6 (c) で作った Android クライアント ID の設定画面に戻り、この SHA-1 を追記する。

### 開発サーバーの起動

別ターミナルで:

```bash
cd app
npm run start
```

実機の開発ビルドアプリを開くと、Metro バンドラに接続できる（または QR コードをスキャン）。

---

## 12. 動作確認

### 12-1. ログイン

- アプリ起動 → 「Google でログイン」→ ブラウザが開く → アカウント選択 → アプリに戻る → 一覧画面が表示される

### 12-2. 案件選択から録音（Flow B）

- FAB「+ 新規録音」→ 案件選択画面（現時点ではスタブデータで「田中様」「山田様」「佐藤様」が出る）
- 案件を選択 → 録音画面
- 「録音開始」→ 数秒話す → 「停止して保存」
- 一覧に戻り、黄色い破線の行が出現 → 送信中 X% → 送信完了 → ステータスが「文字起こし中」→「議事録生成中」→「完了」と遷移
- 行をタップ → 詳細画面で議事録・文字起こしが確認できる

### 12-3. ディープリンク（Flow A）

- iOS Safari で `makxasrec://deal/deal_001` を入力 → アプリが起動して録音画面に遷移
- Android Chrome でも同様

### 12-4. オフライン動作

- 機内モード ON → 録音 → 停止 → 一覧にオフラインバナーが出る
- 機内モード OFF → 自動で送信開始 → プログレスバーが進む

---

## 13. よくあるハマり

| 症状 | 原因と対応 |
|------|----------|
| **「OPENAI_API_KEY is not set」などのエラー** | `firebase functions:secrets:set` でキーを登録したか確認。登録後は `firebase deploy --only functions` で再デプロイ |
| **Google ログインで `DEVELOPER_ERROR`** | Android の SHA-1 が OAuth クライアントに登録されていない。Step 11 の「SHA-1 を OAuth クライアントに登録」を実施 |
| **Google ログインで `redirect_uri_mismatch`** | Web Client ID が間違っている可能性。`FIREBASE_AUTH_DOMAIN` の `.firebaseapp.com` ドメインが OAuth の承認済みリダイレクト URI に入っているか確認 |
| **録音停止時に Firestore へ書き込めない** | セキュリティルールがデプロイされていない。Step 8 を再実行 |
| **ディープリンクでアプリが開かない** | `app.config.ts` の `scheme` が `makxasrec` になっているか確認。iOS はシミュレータを一度アンインストール → 再インストール |
| **バックグラウンド送信が効かない** | iOS の「設定 → 一般 → App のバックグラウンド更新」が OFF になっていないか確認 |
| **Firestore の複合インデックスが必要と言われる** | `firestore.indexes.json` をデプロイし、数分待つ（反映に時間がかかる） |

---

## 付録: ステージング/本番の分け方

ステージングと本番で Firebase プロジェクトを分けたい場合:

```bash
firebase use --add stg      # ステージングプロジェクトを追加
firebase use --add prod     # 本番プロジェクトを追加

firebase use stg            # 切り替え
firebase deploy             # 現在選択中のプロジェクトへデプロイ
```

アプリ側は `.env.staging` / `.env.production` と `EXPO_PUBLIC_APP_VARIANT` で切り替える構成を追加可能（現状は1環境のみ）。

---

## 次のステップ

セットアップが終わり実機で動作確認ができたら、次は：

- マクサスコアの実 API に差し替え（`app/src/services/crm.ts` の `MOCK_ENABLED` を `false`）
- 議事録テンプレートを業務に合わせて調整（`functions/src/generateMinutes.ts`）
- Apple Developer Program への登録と App Store Connect セットアップ（本番配布時）
