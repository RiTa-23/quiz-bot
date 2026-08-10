---
name: doc-sync-check
description: Check whether docs/*.md (要件定義, アーキテクチャ, 技術選定, DB設計, API設計) still match the current implementation, and update the docs when they've drifted. Use before finishing a task that changed the DB schema, API routes, permission rules, or package structure.
---

# doc-sync-check

このプロジェクトは設計ドキュメント（`docs/`）が先にあり、実装がそれに追従する運用。実装がドキュメントと食い違ったまま放置されないようにするためのチェックリスト。

## 実行タイミング

以下のいずれかを変更したタスクの完了前に実行する:
- `packages/core/db` のテーブル・カラム定義
- `apps/api` のHTTPルート
- 権限チェックロジック（Owner/Editor/共有先の扱い）
- `apps/*` / `packages/*` のディレクトリ構成そのもの

## チェック手順

1. 変更したコードと対応するドキュメントを突き合わせる
   - DBスキーマ変更 → [docs/DB設計.md](../../../docs/DB設計.md) のテーブル定義
   - APIルート変更 → [docs/API設計.md](../../../docs/API設計.md) のエンドポイント一覧
   - 権限ルール変更 → [docs/要件定義.md](../../../docs/要件定義.md) の権限マトリクス
   - パッケージ構成変更 → [docs/アーキテクチャ.md](../../../docs/アーキテクチャ.md) の構成図
2. ズレがあれば実装ではなくドキュメントを更新する（ドキュメントが正、実装が追従するという原則を保つ）
3. 「未確定事項」節に載っていた項目が今回の変更で決定した場合、該当行を削除し決定内容を本文に反映する
4. 新たに未確定な判断が出てきた場合は「未確定事項」に追記する

## 出力

変更したドキュメントのファイル名と、更新した節を簡潔に報告する。ズレがなければ「ドキュメントとの整合性に問題なし」と一言で報告する。
