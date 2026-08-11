# API設計（ドラフト）

[要件定義.md](./要件定義.md) / [DB設計.md](./DB設計.md) / [アーキテクチャ.md](./アーキテクチャ.md) に基づくAPI定義。

このAPI（`apps/api`, Hono on Cloudflare Workers）は **React Web アプリ専用のHTTPインターフェース** であり、`packages/core` の共有サービス層をラップして公開するもの。Discord Bot（`apps/bot`）はこのHTTP APIを呼ばず、`packages/core` を直接importして同じロジックを利用する（詳細は [アーキテクチャ.md](./アーキテクチャ.md)）。以下のエンドポイント一覧は Web からの呼び出しのみを対象とする。

**命名規則:** リクエストボディのキーは `snake_case`（Web側フォーム値との対応をわかりやすくするため）。レスポンスボディは `packages/core` の型をそのままJSON化するため `camelCase`（例: `ownerUserId`, `isCorrect`, `correctAnswers`, `totalAttempts`）。

## 認証

- `GET /auth/discord` — Discord OAuth2 認可フロー開始
- `GET /auth/discord/callback` — OAuth2 コールバック、セッション発行（Cookie or JWT）
- `POST /auth/logout` — ログアウト

以降のエンドポイントは原則ログイン必須。セッションから解決した `user_id` を `Actor` として `packages/core` の関数に渡す。

---

## クイズ

### `GET /api/quizzes`
自分が閲覧・編集可能なクイズ一覧（作成分 + 自サーバーが追加した公開クイズ + Editor 権限分）を取得。

- Query: `guild_id`（指定時はそのサーバーに紐づくものに絞る）
- Response: `Quiz[]`。各要素に以下を含める
  - `role`: **そのサーバーでの**権限（`owner | editor | shared | none`）。出題・統計閲覧の可否に対応する
  - `isOwner`: 作成者本人か（**サーバーに依存しない**）。設問編集・削除・公開設定変更の可否に対応する
- 自分が作成したクイズは所属サーバーに関わらず一覧に含まれるが、そのサーバーで使えない場合 `role` は `none`（`isOwner` は `true`）になる（[要件定義.md](./要件定義.md) 2.6.1）

### `POST /api/quizzes`
クイズ作成。

- Body: `{ title, description?, owner_guild_id, visibility?, allow_guild_edit? }`
- Response: `Quiz`
- 既定で `owner_guild_id` のサーバー全員に編集権限が付与される（`quiz_editors` に guild 行が1件作られる）。作成者だけに絞る場合は `allow_guild_edit: false` を指定する

### `GET /api/quizzes/:id`
クイズ詳細取得（設問一覧を含む）。

- Response: `Quiz & { questions: Question[] }`
- 注意: `questions[].answers`（正解）は Owner / Editor 以外には含めない（不正回答対策）
- 閲覧できるのは「そのサーバーで使えるクイズ」または「自分が作成したクイズ」。`guild_id` を付けない呼び出しでも、**作成者なら自分のクイズを取得できる**（管理画面向け）

### `PATCH /api/quizzes/:id`
クイズ情報更新（タイトル・説明・公開設定）。Owner のみ。

- Body: `{ title?, description?, visibility? }`

### `DELETE /api/quizzes/:id`
クイズ削除。Owner のみ。

---

## 設問

### `POST /api/quizzes/:id/questions`
設問追加。Owner / Editor。

- Body: `{ type, body, choices?, answers, explanation?, sort_order? }`
  - `type = free_text` の場合、`answers` は複数の正解パターンを配列で受け取る

### `PATCH /api/quizzes/:id/questions/:qid`
設問更新。Owner / Editor。

### `DELETE /api/quizzes/:id/questions/:qid`
設問削除。Owner / Editor。

---

## 公開クイズの追加

共有は「作成者が公開設定にする → 使う側のサーバーが追加する」方式（[要件定義.md](./要件定義.md) 2.6）。**追加する側の操作**なので Owner 権限は不要で、対象クイズが `visibility: 'public'` であることが条件。

公開設定そのものの変更は `PATCH /api/quizzes/:id` の `visibility` で行う（Owner のみ）。

### `POST /api/quizzes/:id/shares`
公開クイズを指定サーバーに追加する。

- Body: `{ target_guild_id }`
- Response: `{ quizId, title }`
- エラー: 非公開のクイズは `403`、自サーバー発のクイズ／追加済みは `409`

### `DELETE /api/quizzes/:id/shares`
追加した公開クイズをサーバーから外す。元のクイズ自体は削除されない。

- Body: `{ target_guild_id }`
- 未追加の場合は `404`

---

## 共同編集者

編集権限の対象は「サーバー単位（そのサーバーの全員）」と「ユーザー単位」の2種類（[要件定義.md](./要件定義.md) 2.5）。Discord側は `/quiz editors` のパネルで設定する。

### `POST /api/quizzes/:id/editors`
編集者追加。Owner のみ。

- Body: `{ target_type: 'guild' | 'user', target_id }`

### `DELETE /api/quizzes/:id/editors/:editorId`
編集者削除。Owner のみ。

> Bot側は行ID指定ではなく「設定を指定の状態に揃える」形の内部API（`setGuildEditor` / `setUserEditors`）を使う。Webからも同様の一括設定が必要になったら、対応するエンドポイントを追加する。

---

## 出題・回答（Web上でのプレビュー用途）

Discord上での実際の出題・回答フローは `apps/bot` が `packages/core` を直接呼んで処理するため、このHTTP APIは経由しない。以下は Web アプリ側で「プレビュー実行」や動作確認を行うためのエンドポイント。

### `GET /api/quizzes/:id/questions/random`
出題プレビュー用に1問取得（ランダム or 指定）。

- Query: `question_id`（指定の場合）
- Response: `Question`（`answers` フィールドは含めない）

### `POST /api/quizzes/:id/questions/:qid/attempts`
プレビュー実行時の回答結果の記録・正誤判定（実際の出題記録は Bot 側から `packages/core` 経由で直接記録される）。

- Body: `{ guild_id, user_id, submitted_answer }`
- Response: `{ isCorrect, correctAnswers, explanation }`
  - 正解発表のタイミングでのみ `correctAnswers` を返す
- 制約: 同一 `(question_id, guild_id, user_id)` で**プレビュー経由の**回答が既にある場合は `409 Conflict`（1設問1回まで）。Discordの1人モードで記録された行（`session_id` 付き）は判定対象に含めないため、ソロでプレイ済みの設問でもプレビューは実行できる
- レート制限: 同一 `user_id` からの短時間連投は `429 Too Many Requests`

---

## 統計

### `GET /api/quizzes/:id/stats`
クイズ単位の統計（`quiz_attempts` 由来＝1人モード）。**閲覧権限が必要**で、権限がなければ `403 FORBIDDEN` を返す（「そのサーバーで使えるクイズ」または「自分が作成したクイズ」なら閲覧可）。

- 設問一覧には**まだ誰も答えていない設問も含まれる**（`totalAttempts: 0`）
- Response:
  ```json
  {
    "quizId": "...",
    "title": "日本史クイズ",
    "totalAttempts": 120,
    "correctCount": 74,
    "correctRate": 0.62,
    "uniqueUserCount": 8,
    "questions": [
      { "questionId": "...", "body": "鎌倉幕府を開いたのは誰か？", "sortOrder": 0,
        "totalAttempts": 40, "correctCount": 22, "correctRate": 0.55 }
    ]
  }
  ```

> Bot（`/quiz stats`）は同じ関数をサーバー単位に絞って呼ぶため数字が異なる。このAPIは全サーバー合算。

### `GET /api/guilds/:guildId/stats/ranking`
サーバー内の**1人モード**正答率ランキング（`quiz_attempts` 由来。Discordの1人モードのプレイ結果とWebプレビューの回答の両方を含む）。

- Query: `quiz_id`（絞り込み任意）, `period`（`all` \| `week` \| `month`）, `limit`（任意。未指定なら全件）
- Response: `{ userId, totalAttempts, correctCount, correctRate }[]`

### `GET /api/users/:userId/stats`
ユーザー単位の解答履歴・正答率。ログインユーザー本人のみ取得可。

- Query: `limit`（履歴の件数上限。既定100・最大500）
- Response: `{ totalAttempts, correctRate, history: QuizAttempt[] }`
- **1人モード（`quiz_attempts`）のみ**の集計で、全サーバー横断。早押しは含まない

---

## 未実装（記載のみ）

以下はドキュメント上の構想であり、まだ実装されていない。実装時にこの節から上へ移すこと。

- `GET /api/guilds/:guildId/stats/buzz-ranking` — サーバー内の早押し獲得数ランキング。集計関数 `getBuzzRanking` は `packages/core` に存在するが、APIルートが未作成（DiscordのBot側では `/quiz ranking` で利用中）
- `GET /api/users/:userId/stats` を `{ solo, buzz }` の形に拡張し、早押し成績も返すこと（ギルド絞り込みの扱いを決める必要がある）

---

## レート制限・不正回答対策（API横断のルール）

- 出題エンドポイント（`GET /api/quizzes/:id/questions/random`）: 同一 `guild_id + user_id` に対しクールダウンを設け、短時間の連続呼び出しは `429`
- 回答エンドポイント（`POST /api/quizzes/:id/questions/:qid/attempts`）:
  - 同一設問への複数回回答を `409` で拒否（DB の `UNIQUE(question_id, guild_id, user_id)` 制約に準拠）
  - 同一ユーザーからの短時間の連続送信を `429` で拒否
- 正解情報の非公開:
  - クイズ詳細・出題エンドポイントのレスポンスに正解 (`answers`) を含めない（Owner/Editor が管理画面で見る場合のみ例外）
  - 正解は `attempts` エンドポイントでの回答確定後にのみクライアントへ返す

---

## エラーレスポンス（共通形式）

```json
{
  "error": {
    "code": "FORBIDDEN" ,
    "message": "この操作を行う権限がありません"
  }
}
```

主なコード: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `VALIDATION_ERROR`
