---
name: d1-migration
description: Workflow for changing the Cloudflare D1 schema in this project — edit the Drizzle schema in packages/core/db, generate a migration with drizzle-kit, and apply it via wrangler d1 migrations. Use whenever a task requires adding, removing, or altering a table/column described in docs/DB設計.md.
---

# d1-migration

このプロジェクトのDBスキーマ変更手順。[docs/DB設計.md](../../../docs/DB設計.md) のテーブル定義を単一の正として、Drizzleスキーマ・マイグレーションSQL・ドキュメントの3点を必ず同期させる。

## 手順

1. [docs/DB設計.md](../../../docs/DB設計.md) を先に更新する（テーブル/カラムの追加・変更内容を反映）
2. `packages/core/db/schema.ts`（Drizzleスキーマ）を1と同じ内容に更新する
3. マイグレーションSQLを生成する
   ```
   bun run drizzle-kit generate
   ```
4. 生成されたSQLの内容を確認する（意図しないカラム削除・型変更がないか）
5. ローカルD1に適用して動作確認する
   ```
   bunx wrangler d1 migrations apply <DB_NAME> --local
   ```
6. 本番適用は別途ユーザーの承認を得てから行う（`--local` を付けずに実行するのは破壊的操作に相当するため、勝手に実行しない）

## 注意

- `packages/core/db` 以外の場所（`apps/bot`, `apps/api`）でテーブル定義やSQLを直接書かない。DBアクセスは必ず `packages/core` 経由にする（[docs/アーキテクチャ.md](../../../docs/アーキテクチャ.md) の共有サービス層方針）
- `answers`（自由記述の正解パターン）や `submitted_answer` のような機密性のあるカラムを新設する場合、[docs/API設計.md](../../../docs/API設計.md) の「正解情報の非公開」ルールに抵触しないか確認する
