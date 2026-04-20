# 出張買取 録音アプリ

出張買取営業向け、商談の**録音 → 文字起こし → 議事録自動生成**を行うスマートフォンアプリ（iOS/Android 対応）。

将来的に自社CRM（マクサスコア）と連携し、案件に紐付けて録音・議事録を管理する構成を想定している。

## 構成

```
/
├── app/         Expo (React Native + TypeScript) アプリ
├── functions/   Firebase Cloud Functions（文字起こし・議事録生成）
├── firebase.json
├── firestore.rules
├── storage.rules
└── firestore.indexes.json
```

### データフロー

1. 営業マンがアプリで録音 → ローカルに音声ファイル保存
2. アプリが Firebase Storage へアップロード、Firestore に `recordings/{id}` を `uploaded` ステータスで作成
3. Cloud Functions (`onRecordingUploaded`) が発火
   - Whisper API で文字起こし → Firestore 更新（`transcribed`）
   - Claude API で議事録を構造化生成 → Firestore 更新（`completed`）
4. アプリは Firestore をリアルタイム購読し、処理完了と同時に UI に反映

## 必要なもの

- Node.js 20+
- Firebase CLI（`npm install -g firebase-tools`）
- Firebase プロジェクト（Authentication / Firestore / Storage / Functions を有効化）
- OpenAI API キー（Whisper）
- Anthropic API キー（Claude）
- Google Cloud の OAuth クライアント（Web / iOS / Android）
- Expo アカウント（ビルド用）

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install                         # ルート + ワークスペース
```

### 2. Firebase プロジェクトの接続

```bash
firebase login
firebase use --add                  # 対象プロジェクトを選択
```

### 3. Firebase Authentication の設定

Firebase コンソールで:
- Authentication → Sign-in method → **Google** を有効化
- 認可済みドメインに本番配布ドメインを追加（Expo Go で検証する場合は不要）

### 4. Google OAuth クライアント ID の作成

Google Cloud Console → APIs & Services → Credentials で以下を作成し、`app/app.json` の `extra` に設定：

| 環境 | Client ID の種類 | 設定先 |
|------|-----------------|--------|
| Web（Firebase Auth 用）| Web アプリケーション | `googleWebClientId` |
| iOS | iOS | `googleIosClientId` |
| Android | Android（SHA-1 必須）| `googleAndroidClientId` |

### 5. Firebase 設定を `app/app.json` に反映

Firebase コンソール → プロジェクト設定 → 「アプリ」から Web アプリ用の設定値を取得し、以下を埋める：

```json
"extra": {
  "firebaseApiKey": "...",
  "firebaseAuthDomain": "...",
  "firebaseProjectId": "...",
  "firebaseStorageBucket": "...",
  "firebaseMessagingSenderId": "...",
  "firebaseAppId": "...",
  "googleWebClientId": "...",
  "googleIosClientId": "...",
  "googleAndroidClientId": "..."
}
```

本番ビルド時は `eas.json` などで環境別に切り替えることを推奨。

### 6. Cloud Functions 用シークレットの登録

```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set ANTHROPIC_API_KEY
```

### 7. セキュリティルール・インデックスのデプロイ

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 8. Cloud Functions のデプロイ

```bash
npm run functions:build
firebase deploy --only functions
```

### 9. アプリの起動（開発）

```bash
npm run app              # Expo 開発サーバー
npm run app:ios          # iOS シミュレータ
npm run app:android      # Android エミュレータ
```

実機で試す場合は `Expo Go` でQRコードをスキャン。ただし Google Sign-In のリダイレクト URL の都合上、本格検証は**開発ビルド（`eas build --profile development`）**を推奨。

## 主な画面

- **ログイン画面**：Google サインイン
- **商談一覧**：Firestore をリアルタイム購読。ステータス（録音中／文字起こし中／完了／エラー）が即時反映
- **録音画面**：開始・一時停止・再開・停止＆アップロード。アップロード進捗表示あり
- **詳細画面**：音声再生、議事録（サマリ／お客様情報／査定品目／提示額／次回アクション）、文字起こし全文、削除

## セキュリティ

- Firestore / Storage のルールで、自分が作成した録音のみ読み書き可能
- 録音アップロードは `audio/*` のみ許可、サイズ上限 200MB
- API キー（OpenAI / Anthropic）は Cloud Functions のシークレットで管理し、クライアントには出さない
- 商談録音の前に**お客様への告知と同意取得**を必ず実施する運用を推奨（ログイン画面および録音ボタン画面に注意書きを明示）

## 録音データの扱い（Local-First 設計）

**商談の録音データは最重要資産**です。通信エラー・アプリクラッシュ・タイミングの悪い端末シャットダウンなどで失われないよう、次の原則で設計しています：

1. **録音は必ずまず端末内のストレージに保存される**
   - 停止ボタン押下時に `FileSystem.documentDirectory/recordings/` へ永続保存
   - 保存完了まではUIをブロック（アップロード完了までは待たない）
2. **クラウドへのアップロードは、別プロセスとしてバックグラウンドで実行**
   - 録音直後は「未送信」状態で一覧に並び、端末とネットワーク状況が整い次第、順次送信
   - 送信中はプログレスバー（％）で進捗を可視化
3. **ローカルファイルは、アップロード完了が確認できてから初めて削除される**
   - 送信失敗時は端末内に残り続けるので、データが吹き飛ぶことはない
   - 自動リトライは5回まで。超過後は「失敗」として停止し、手動で再試行・破棄を選択できる
4. **起動時クリーンアップ**：キュー内のファイルが何らかの理由で失われていた場合のみ、エントリをキューから除外（ファイルと整合しないゴーストを防ぐ）

### 自動アップロードのトリガー

| トリガー | 仕組み |
|---------|--------|
| ネットワーク復帰 | `@react-native-community/netinfo` のイベント |
| アプリ前面復帰 | `AppState` の `active` 遷移 |
| 一覧画面フォーカス | `useFocusEffect` |
| 手動 | 一覧画面の「再試行」ボタン（バナー or 各行） |

### UI

- **上部バナー**：送信中件数・待機件数・失敗件数をリアルタイム表示
- **未送信アイテム行**：
  - `ローカル保存済み・送信待ち` / `送信中 45%` / `送信失敗（N回試行）`
  - アップロード中はプログレスバー表示
  - 失敗時はエラーメッセージ、再試行・破棄ボタンを表示

### 既知の制約（今後の拡張候補）

- アプリを閉じたままでの送信は未対応。現状は前面復帰時・フォーカス時のみ送信。完全バックグラウンド送信が必要な場合は `expo-task-manager` + `expo-background-fetch` を追加する
- Wi-Fi 接続時のみ送信したい場合は、ユーザー設定でトグルを追加する（`NetInfo.type === 'wifi'` で制御可能）
- 端末ストレージの空き容量が逼迫した場合のアラートは未実装（必要なら `FileSystem.getFreeDiskStorageAsync()` で監視可能）

## 今後の拡張ポイント

- **マクサスコア連携**：`recordings.crmDealId` フィールドを既に用意済み。
  1. アプリ側：録音作成時に案件選択 UI を追加し `crmDealId` を保存
  2. Cloud Functions：`completed` 遷移時に CRM API を叩いて議事録を案件に添付
- **議事録テンプレートのカスタマイズ**：`functions/src/generateMinutes.ts` の `SYSTEM_PROMPT` を業務に合わせて調整
- **文字起こしの精度向上**：Whisper を `whisper-1` から `gpt-4o-transcribe` 等へ切替え、または Google Speech-to-Text（日本語カスタムモデル）との比較
- **Google カレンダー連携**：議事録の「次回アクション」から自動で予定登録

## 法的・運用上の注意

- 商談の録音は、**事前にお客様に告知し、同意を得た上**で行ってください
- 録音データは個人情報を含むため、アクセス権限・保持期間・削除フローを事業者ポリシーで定めてください
- 議事録は AI 生成のため、**必ず担当者が内容を確認**してから CRM に登録・共有してください
