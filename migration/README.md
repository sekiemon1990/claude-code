# 複数プロダクト Repo 分割プロジェクト

このディレクトリは、現状 `sekiemon1990/claude-code` 1 つに混在している複数プロダクトを、プロダクトごとの独立リポジトリに分割するための **作業手順書集** です。

担当: 環境構築コーディネーターセッション (`claude/split-monorepo-products-2uREq`)

## ファイル一覧

| ファイル | 用途 | 誰が見る |
|---|---|---|
| `README.md` (このファイル) | 全体俯瞰 | 全員 |
| `00-session-inquiry-template.md` | 担当不明 branch の各セッションに状況を聞き出すための雛形 | ユーザー (各セッションに貼り付け) |
| `01-makxas-recording-monorepo.md` | 録音管理 Web + iOS を 1 つの monorepo にまとめる手順 | ユーザー + 録音 admin/iOS 両セッション |
| `02-generic-product-migration.md` | それ以外のプロダクトを単独 repo に切り出す汎用手順 | ユーザー + 該当セッション |

---

## 全体マップ

| # | 新 repo | 種別 | 元 branch | 担当セッション | Vercel? | 進捗 |
|---|---|---|---|---|---|---|
| 1 | `sekiemon1990/claude-code` (将来 `makxas-search` に rename) | Web | main | `/home/user/claude-code` (マクサスサーチ) | ✅ 既存稼働 | - (現状維持) |
| 2 | `sekiemon1990/makxas-recording` (monorepo) | Web+iOS | `claude/review-recording-app-KtyN1` + `claude/sales-recording-app-9LcDo` + `feat/noise-removal` | `~/Desktop/claude-code-admin` (admin) + `~/Desktop/claude-code` Mac (iOS) | ✅ admin のみ | 未着手 |
| 3 | `sekiemon1990/ai-phone-screening` | Node サーバー | `claude/ai-phone-screening-uQhyh` | **要照会** | ❌ (Node サーバーで Render/Fly 想定) | 担当照会待ち |
| 4 | `sekiemon1990/donation-website` | Web | `claude/build-donation-website-nmT5R` | **要照会** | ✅ | 担当照会待ち |
| 5 | `sekiemon1990/chatwork-mcp` | MCP server | `claude/chatwork-mcp-integration-Xi1b4` | **要照会** | ❌ (Docker) | 担当照会待ち |
| 6 | `sekiemon1990/line-headquarters` | LINE bot | `claude/setup-line-headquarters-iPZJx` | **要照会** | ❌ | 担当照会待ち |
| - | (削除) | - | `claude/automate-journal-entries-NJtzu` | **要確認** | - | コードほぼ無し → 削除予定 |

---

## 進める順番

1. **`makxas-recording` monorepo (#2)** ← 最優先 (担当判明済 + 最も成熟)
2. **担当不明 4 件 (#3-6)** ← `00-session-inquiry-template.md` で並行照会 → 回答後に `02-generic-product-migration.md` で各個移行
3. **`automate-journal-entries` の処遇確認** → 削除 or 保留
4. **旧 repo `sekiemon1990/claude-code` のクリーンアップ** (不要 branch 削除、`makxas-search` への rename 検討)

---

## 共有リソースの扱い (重要)

以下は複数プロダクトで **共有** している外部リソース。repo を分けても **同じインスタンスを共有** します。

| 共有リソース | 共有しているプロダクト | 注意点 |
|---|---|---|
| Supabase (Auth) | マクサスサーチ + 録音管理 Web | 同じ Google OAuth 設定。SQL マイグレーションは衝突注意 |
| Firebase (Firestore + Storage + Cloud Functions) | 録音管理 Web + 録音アプリ iOS | monorepo 化するので 1 repo 内で完結する想定 |

### 共有コード (将来課題)
`src/lib/supabase/*` / `src/lib/utils.ts` / `src/components/QueryProvider.tsx` 等の汎用 UI は
- **当面は各 repo に copy** (シンプル)
- **将来的に `@makxas/ui` 等の private npm package 化** を検討

---

## このセッションの作業範囲

- ✅ 手順書の作成 (このディレクトリ)
- ✅ 担当不明 branch の照会テンプレ作成
- ❌ **マクサスサーチ本体への変更** (別セッション担当)
- ❌ **GitHub の新 repo 作成 / git push / Vercel 設定** (権限スコープ外、ユーザー手作業)
- ❌ **他セッションへの直接通信** (ユーザー経由)

## ユーザーへの依頼事項 (まとめ)

1. 担当不明 4 セッションに `00-session-inquiry-template.md` を貼り付けて回答を持ってくる
2. 録音管理 / 録音 iOS の 2 セッションに `01-makxas-recording-monorepo.md` の該当パートを共有
3. 各プロダクトの「新 repo 作成 → git push → Vercel 設定」を `01` / `02` の手順に従って実行
4. 完了したら、このセッションに「#X 完了」と報告 (該当 branch の削除等を進めます)
