# quiz-bot

クイズ作成・出題・共有ができる Discord Bot。詳細な要件・設計は `docs/` を参照。実装より先に設計ドキュメントが存在するプロジェクトなので、コードを書く前に必ず該当ドキュメントを読むこと。

## ドキュメント構成（読む順番）

1. [docs/要件定義.md](docs/要件定義.md) — 機能要件、権限マトリクス、未確定事項
2. [docs/アーキテクチャ.md](docs/アーキテクチャ.md) — モノレポ構成、`packages/core` 共有方式、認証の流れ
3. [docs/技術選定.md](docs/技術選定.md) — 採用技術と選定理由
4. [docs/DB設計.md](docs/DB設計.md) — D1テーブル定義
5. [docs/API設計.md](docs/API設計.md) — `apps/api`（Web専用）のHTTPエンドポイント定義

**ドキュメントと実装が食い違った場合はドキュメントを更新すること。** 設計判断（テーブル追加、エンドポイント変更、権限ルール変更など）を実装だけで完結させず、対応する `docs/*.md` に反映する。

## リポジトリ構成（予定）

```
apps/
  bot/     # Discord Hono Worker
  api/     # Web用 Hono Worker（Reactから呼ばれるHTTP API）
  web/     # React フロントエンド
packages/
  core/    # 共有サービス層（クイズCRUD, 出題, 統計, レート制限, D1アクセス）
```

- ビジネスロジックは必ず `packages/core` に置き、`apps/bot` と `apps/api` の両方から直接importする。HTTPで内部的に叩き合う構成にしない（[docs/アーキテクチャ.md](docs/アーキテクチャ.md) 参照）
- 認証方式は経路ごとに異なる（Bot=Interaction署名検証 / API=OAuth2セッション）が、`packages/core` の関数は認証方式を知らず `Actor`（user_id, guild_id）のみを受け取る

## 技術スタック（詳細は docs/技術選定.md）

- パッケージ管理: **bun workspaces**（`bun install`。`wrangler`実行やテストで相性問題が出た場合はNode経由にフォールバックする方針）
- DBアクセス: Drizzle ORM（`packages/core/db`）
- Web UI: Tailwind CSS + shadcn/ui
- バリデーション: Zod（`drizzle-zod`でDB定義と同期）
- テスト: Vitest + `@cloudflare/vitest-pool-workers`
- Lint/Format: Biome
- CI/CD: GitHub Actions

## コーディング規約

- コメントは基本書かない。書くのはWHYが非自明な場合のみ（隠れた制約、既知の回避策など）。WHATの説明やタスク参照は書かない
- 型はDBスキーマ（Drizzle）から生成・共有し、`apps/bot` / `apps/api` で型を再定義しない
- 権限チェックは呼び出し側に書かせず、`packages/core` の関数内に内包する（[docs/要件定義.md](docs/要件定義.md) の権限マトリクス参照）
- 自由記述の正解（`answers`）はAPIレスポンスに含めない。正解を返してよいのは回答確定後の `attempts` エンドポイントのみ（[docs/API設計.md](docs/API設計.md) 参照）

## よく参照する未確定事項

以下は `docs/*.md` の「未確定事項」に記載済み。実装時に判断が必要になったらドキュメントの記述を更新すること。

- セッションストア（D1 or Workers KV）
- 自由記述の正規化ルール（トリム・大小文字・全角半角）
- レート制限の具体的な閾値
- bun環境での `vitest-pool-workers` 動作
