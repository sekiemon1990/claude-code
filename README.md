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

## 案件必須の録音フロー

**録音は必ず「マクサスコアの案件」に紐付けて行う**設計。案件なしの録音はできない。

録音開始までの動線は2つ：

### A. マクサスコアの案件画面から録音ボタンを押す（ディープリンク）

マクサスコアの案件詳細ページに「録音アプリで開く」ボタンを設置し、
`makxasrec://deal/{dealId}` 形式の URL を起動する。

- アプリがインストールされていれば自動で起動し、その案件が選択された状態の録音画面へ
- 未ログインなら先にログイン画面 → ログイン後に録音画面へ
- ディープリンク受信時に次を検証し、満たさない場合はエラーダイアログ表示：
  - 案件が存在する
  - `assessorEmail` がログインユーザーの Email と一致（自分が担当）
  - `status === 'scheduled'`（予約中）

**CRM 側の実装例**：
```html
<a href="makxasrec://deal/12345">この案件で録音を開始</a>
```

### B. アプリ内から案件を選択して録音開始

アプリの一覧画面から「+ 新規録音」→ 案件選択画面 → 録音画面。

案件選択画面では以下のフィルタ・ソートを適用：
- 自分が査定担当者に設定されている
- ステータスが `予約中 (scheduled)`
- 予約日時が現在に近い順

## データフロー

1. 営業マンが**案件を選択**して録音 → ローカルに音声ファイル保存（案件情報スナップショットと共に）
2. バックグラウンドでキューをドレイン → Firebase Storage へアップロード、Firestore に `recordings/{id}` を `uploaded` ステータスで作成（`dealId` と `dealSnapshot` 付き）
3. Cloud Functions (`onRecordingUploaded`) が発火
   - Whisper API で文字起こし → Firestore 更新（`transcribed`）
   - Claude API で議事録を構造化生成 → Firestore 更新（`completed`）
4. アプリは Firestore をリアルタイム購読し、処理完了と同時に UI に反映

`dealSnapshot` を録音時点で凍結するため、CRM 側で後から案件が変更・削除されても、
録音時点の顧客情報・予約時刻・査定対象の記録は保持される。

## UI プレビュー（GitHub 上で動作確認）

このリポジトリには**ブラウザで動くデモアプリが同梱**されています。Firebase や API キーのセットアップ不要で、コマンドを打つ必要もありません。

**最短の確認方法** → [docs/PREVIEW.md](docs/PREVIEW.md) の手順に従って GitHub Pages を有効化するだけ（所要 2分）

### ローカルで試す場合

```bash
git clone <このリポジトリ>
cd claude-code
npm install
cd app
npm run demo
```

ブラウザで http://localhost:8081 が開き、以下が確認できる：

- 自動ログイン（デモ営業マンとして）
- 案件一覧（モックの3件：田中様／山田様／佐藤様）
- 録音画面（開始・停止がタイマーで動作）
- 停止後のアップロード進捗バー
- `文字起こし中` → `議事録生成中` → `完了` への自動遷移（setTimeout で模擬）
- 詳細画面で疑似文字起こしと疑似議事録を表示
- ストレージ残量警告のUI、オフラインバナーのUI

**デモで確認できないもの**：
- 実際の音声録音・再生（タイマー動作のみ）
- バックグラウンド送信（アプリを閉じた時）
- マクサスコアからのディープリンク起動（ブラウザでは起こりえないため）
- 実機の端末ストレージ残量

> Windows で実行する場合: `set EXPO_PUBLIC_DEMO=true&& expo start --web` などで環境変数を設定してください。

## 実機セットアップ

実機で「ログイン → 案件選択 → 録音 → 文字起こし → 議事録生成」が通るまでの手順は [**docs/SETUP.md**](docs/SETUP.md) に詳述。

所要時間の目安: 初回 90〜120分（Firebase / Google Cloud / EAS のアカウント準備込み）。

### クイックスタート（2回目以降の開発者向け）

`.env` と `.firebaserc` が既にある前提:

```bash
npm install
cd app && cp .env.example .env      # 初回のみ。値を埋める
cd ..

# Firebase 側
firebase deploy --only firestore:rules,firestore:indexes,storage,functions

# アプリ（開発ビルドが既にインストールされた実機で）
cd app && npm run start
```

### 技術上の注意

- **Expo Go では動作しない**。`expo-background-fetch` と Google Sign-In のカスタムスキームがネイティブモジュールを使うため、EAS Build で開発ビルドを作る必要がある
- **Cloud Functions は Blaze プラン必須**。無料枠内で収まる見込みだが支払情報の登録は必要

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

### バックグラウンド送信（アプリを閉じた状態でも送信）

- `expo-task-manager` + `expo-background-fetch` で `com.makxas.salesrecording.upload` タスクを登録
- アプリ起動時に `registerBackgroundUploadTask()` が呼ばれる
- **iOS**：BGTaskScheduler 経由で約15分毎にシステムが最適化して起動（端末の状況によって実際の頻度は変動）
- **Android**：WorkManager で実行。端末再起動後も自動再登録
- バックグラウンドタスク内では Firebase Auth のセッションを AsyncStorage から復元するため、ログイン済みならユーザー操作なしで送信が続く

#### iOS 配布時の注意
`app.json` の `ios.infoPlist.BGTaskSchedulerPermittedIdentifiers` にタスクIDを登録済み。
App Store 審査時、バックグラウンド実行の用途を Privacy Manifest 等に明記すること。

#### 端末設定との関係
ユーザーが端末の「App のバックグラウンド更新」をオフにしている場合、`BackgroundFetch.getStatusAsync()` が `Denied` を返し、登録をスキップする。  
この場合でも**フォアグラウンド復帰時・一覧画面フォーカス時・ネットワーク復帰時**の送信は通常通り動作する。

### ストレージ残量の監視

`useStorageStatus` フックで端末の空き容量を監視：

| レベル | しきい値 | 動作 |
|--------|---------|------|
| OK | 500MB 以上 | 通常表示 |
| 警告 | 100〜500MB | 一覧画面・録音画面に警告バナー表示 |
| クリティカル | 100MB 未満 | 録音開始を拒否（既存録音は送信可能） |

- 1分毎と前面復帰時にポーリング
- しきい値は `app/src/hooks/useStorageStatus.ts` の `WARN_THRESHOLD` / `CRITICAL_THRESHOLD` を変更すれば調整可能

### 既知の制約（今後の拡張候補）

- Wi-Fi 接続時のみ送信したい場合は、ユーザー設定でトグルを追加する（`NetInfo.type === 'wifi'` で制御可能）
- iOS のバックグラウンド更新頻度はシステム依存。より短い間隔が必要な場合は `BGProcessingTask`（長時間処理用）も検討できるが、App Store 審査ハードルが上がる

## マクサスコア（CRM）連携の実装ポイント

現時点では `app/src/services/crm.ts` にスタブ実装を置いてモックデータを返している。
本番接続時は以下の3点を差し替えればよい：

1. `MOCK_ENABLED = false` に変更
2. `httpGet()` 関数に実際の fetch 処理を実装（`CRM_BASE_URL` の定義も）
3. 認証方針の決定：
   - 推奨：Firebase Auth の ID トークン（`user.getIdToken()`）を Authorization ヘッダで送信し、CRM サーバで Firebase Admin SDK を使って検証
   - 代案：サーバ間の信頼関係を使った専用 API キー

必要な CRM API（最小セット）:

| Method | Path | 用途 |
|--------|------|------|
| GET | `/api/deals?assessorEmail=xxx&status=scheduled` | 案件一覧（自分担当・予約中） |
| GET | `/api/deals/{dealId}` | 案件詳細（ディープリンク時の検証用） |

議事録を CRM に書き戻したい場合は、Cloud Functions 側で以下を追加：

| Method | Path | 用途 |
|--------|------|------|
| POST | `/api/deals/{dealId}/minutes` | 議事録を案件に添付 |

## 今後の拡張ポイント

- **CRM への議事録書き戻し**：Cloud Functions の `processRecording` 完了時に CRM API を叩く
- **議事録テンプレートのカスタマイズ**：`functions/src/generateMinutes.ts` の `SYSTEM_PROMPT` を業務に合わせて調整。案件の `dealSnapshot.items` を事前情報としてプロンプトに注入すると抽出精度が向上する
- **文字起こしの精度向上**：Whisper を `whisper-1` から `gpt-4o-transcribe` 等へ切替え、または Google Speech-to-Text（日本語カスタムモデル）との比較
- **Google カレンダー連携**：議事録の「次回アクション」から自動で予定登録
- **Universal Links / App Links**：`makxasrec://` のカスタムスキームから `https://app.makxas.com/deal/{id}` 形式へ移行し、iOS/Android のドメイン検証ファイルを設置すると UX が向上

## 法的・運用上の注意

- 商談の録音は、**事前にお客様に告知し、同意を得た上**で行ってください
- 録音データは個人情報を含むため、アクセス権限・保持期間・削除フローを事業者ポリシーで定めてください
- 議事録は AI 生成のため、**必ず担当者が内容を確認**してから CRM に登録・共有してください
