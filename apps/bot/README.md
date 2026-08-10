# @quiz-bot/bot

Discord Hono による Bot Worker。`packages/core` を直接importし、DBアクセス・権限チェック・出題ロジックはすべて `core` 側に委譲する（HTTP経由の内部API呼び出しはしない）。

## セットアップ

1. `wrangler.jsonc` の `d1_databases[0].database_id` を実際のD1データベースIDに置き換える（`wrangler d1 create quiz-bot-db` で作成）
2. 以下のsecretsを設定する
   ```
   wrangler secret put DISCORD_TOKEN
   wrangler secret put DISCORD_PUBLIC_KEY
   wrangler secret put DISCORD_APPLICATION_ID
   ```
3. `bun install` → `bun run dev`（`apps/bot`で実行、またはルートから `bun run dev:bot`）

## 注意

- `discord-hono` のコマンド定義ビルダー（`Command`/`SubCommand`）のAPIはバージョンによって変わることがある。初回 `wrangler dev` 実行時に [discord-hono公式ドキュメント](https://discord-hono.luis.fun/) と突き合わせて確認すること
- コマンド登録（`wrangler dev` 起動時 or デプロイ後のコマンド同期）は discord-hono の手順に従う
