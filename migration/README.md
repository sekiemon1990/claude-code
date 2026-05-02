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
| 1 | `sekiemon1990/claude-code` (将来 `makxas-search` に rename) | Web | main | このセッション (マクサスサーチ本体は別セッションが担当) | ✅ 既存稼働 | - (現状維持) |
| 2 | `sekiemon1990/makxas-recording` (monorepo) | Web+iOS | `claude/review-recording-app-KtyN1` + `claude/sales-recording-app-9LcDo` + `feat/noise-removal` | 録音管理 + iOS の 2 セッション | ✅ admin のみ | 未着手 |
| 3 | `sekiemon1990/ai-phone-screening-poc` (※ 推奨に変更) | Node サーバー | `claude/ai-phone-screening-uQhyh` | AI 電話スクリーニング PoC セッション | ❌ (PoC、本格版は別 repo で Pipecat 化予定) | 約 40% (PoC 段階) |
| 4 | `sekiemon1990/mono-kifu-foundation` | Web | `claude/build-donation-website-nmT5R` | モノ寄付基金セッション | ✅ Vercel | 約 35-40% (フロント 90%) |
| 5 | `sekiemon1990/chatwork-mcp` | MCP server | `claude/chatwork-mcp-integration-Xi1b4` | Chatwork MCP セッション | ❌ (Cloud Run 想定) | 約 85% (実 API E2E のみ未) |
| 6 | `sekiemon1990/kaitori-maxus-line` | ドキュメント+設定 | `claude/setup-line-headquarters-iPZJx` | 買取マクサス LINE セッション | ❌ (LINE 公式アカウントが本番) | Phase 1 100% / 全体 40% |
| 7 | `sekiemon1990/makxas-mf-accounting-automation` (PRIVATE 必須) | AI エージェント設定 | `claude/automate-journal-entries-NJtzu` | MF 仕訳自動化セッション | ❌ (Claude Code CLI 対話実行) | 約 25-30% (初仕訳投稿成功済) |

---

## 進める順番 (5 セッション全員から回答受領済 / 2026-05-02)

1. **`chatwork-mcp` (#5)** ← 進捗 85% で最も成熟、独立度 100%、最速で完了できる
2. **`makxas-mf-accounting-automation` (#7) PRIVATE** ← 中身が `.mcp.json` + `CLAUDE.md` のみで超軽量、`CLAUDE.md` に事業者情報があるため必ず PRIVATE
3. **`mono-kifu-foundation` (#4)** ← Vercel デプロイ準備中、独立度高い
4. **`kaitori-maxus-line` (#6)** ← デプロイ不要 (LINE 公式アカウントが本番)、ドキュメント中心で安全
5. **`makxas-recording` monorepo (#2)** ← 最複雑 (Firebase 共有、3 branch 統合)、本番稼働中要素あり、後回しで慎重に
6. **`ai-phone-screening-poc` (#3)** ← PoC archive 化、最後に
7. **旧 repo クリーンアップ** (不要 branch 削除、将来 `makxas-search` への rename)

### 順番の根拠
- **小さい/独立度高い** ものから先に流して、Vercel デプロイ枠と GitHub UI 操作の手順に慣れる
- **monorepo 化 (#2)** は Firebase 設定 merge など本番リスクがあるので最後の集中作業として確保
- **AI Phone PoC** は本格版が別アーキテクチャになるので慌てて移行する必要なし、最後

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
