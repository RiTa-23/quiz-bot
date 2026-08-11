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
自分が閲覧・編集可能なクイズ一覧（作成分 + 自サーバーへの共有分 + Editor 権限分）を取得。

- Query: `guild_id`（指定時はそのサーバーに紐づくものに絞る）
- Response: `Quiz[]`（各要素に自分の権限ロール `owner | editor | shared | none` を含める）

### `POST /api/quizzes`
クイズ作成。

- Body: `{ title, description?, owner_guild_id, visibility? }`
- Response: `Quiz`

### `GET /api/quizzes/:id`
クイズ詳細取得（設問一覧を含む）。

- Response: `Quiz & { questions: Question[] }`
- 注意: `questions[].answers`（正解）は Owner / Editor 以外には含めない（不正回答対策）

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

## 共有

### `POST /api/quizzes/:id/shares`
他サーバーへの共有追加。Owner のみ。

- Body: `{ target_guild_id }`

### `DELETE /api/quizzes/:id/shares/:shareId`
共有解除。Owner のみ。

---

## 共同編集者

### `POST /api/quizzes/:id/editors`
編集者追加。Owner のみ。

- Body: `{ target_type: 'guild' | 'user', target_id }`

### `DELETE /api/quizzes/:id/editors/:editorId`
編集者削除。Owner のみ。

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
クイズ単位の統計。

- Response:
  ```json
  {
    "totalAttempts": 120,
    "correctRate": 0.62,
    "questions": [
      { "questionId": "...", "totalAttempts": 40, "correctRate": 0.55 }
    ]
  }
  ```

### `GET /api/guilds/:guildId/stats/ranking`
サーバー内の**1人モード**正答率ランキング（`quiz_attempts` 由来。Discordの1人モードのプレイ結果とWebプレビューの回答の両方を含む）。

- Query: `quiz_id`（絞り込み任意）, `period`（`all` \| `week` \| `month`）
- Response: `{ userId, totalAttempts, correctCount, correctRate }[]`

### `GET /api/guilds/:guildId/stats/buzz-ranking`
サーバー内の**早押し**獲得数ランキング（`buzz_attempts` 由来）。1人モードとは別集計。

- Query: `quiz_id`（絞り込み任意）, `period`（`all` \| `week` \| `month`）
- Response: `{ userId, winCount, answeredCount }[]`（`winCount` = 最初に正解した回数）

### `GET /api/users/:userId/stats`
ユーザー単位の解答履歴・正答率。ログインユーザー本人のみ取得可。1人モードと早押しを分けて返す。

- Response: `{ solo: { totalAttempts, correctRate, history: QuizAttempt[] }, buzz: { answeredCount, winCount } }`

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
