# API設計（ドラフト）

[要件定義.md](./要件定義.md) / [DB設計.md](./DB設計.md) / [アーキテクチャ.md](./アーキテクチャ.md) に基づくAPI定義。

このAPI（`apps/api`, Hono on Cloudflare Workers）は **React Web アプリ専用のHTTPインターフェース** であり、`packages/core` の共有サービス層をラップして公開するもの。Discord Bot（`apps/bot`）はこのHTTP APIを呼ばず、`packages/core` を直接importして同じロジックを利用する（詳細は [アーキテクチャ.md](./アーキテクチャ.md)）。以下のエンドポイント一覧は Web からの呼び出しのみを対象とする。

**命名規則:** リクエストボディのキーは `snake_case`（Web側フォーム値との対応をわかりやすくするため）。レスポンスボディは `packages/core` の型をそのままJSON化するため `camelCase`（例: `ownerUserId`, `isCorrect`, `correctAnswers`, `totalAttempts`）。

## 認証

- `GET /auth/discord` — Discord OAuth2 認可フロー開始（`identify guilds` スコープ）
- `GET /auth/discord/callback` — OAuth2 コールバック、セッション発行。この時に `/users/@me/guilds` を取得し、**所属サーバー一覧をセッションに保存する**
- `POST /auth/logout` — ログアウト

### `GET /api/bot-install-url`
Bot導入用のOAuth2 URLを返す。**認証不要**（ルートの紹介ページがログイン前に導入導線を出すため）。

- Response: `{ botInstallUrl }`

### `GET /api/me`
ログイン状態と、操作対象に選べるサーバー一覧を返す。未ログインは `401 UNAUTHORIZED`。

- Query: `refresh=1`（任意）— Bot 参加サーバーのキャッシュを無視して取り直す。Bot 導入直後に反映を待たせないための導線で、常用しない
- Response: `{ userId, username, displayName, guilds: { id, name }[], botInstallUrl }`
- `displayName` は Discord の表示名（`global_name`。未設定なら `username`）。**Web上のユーザー表示はこれに統一する**
- `guilds` は「**ユーザーが所属し、かつ Bot が導入済み**」のサーバーのみ。Web の画面上部のサーバー選択に使う（Bot 未導入のサーバーを選んでも出題・記録ができないため候補に出さない）
- Bot の参加サーバーは Bot トークンで `/users/@me/guilds` を引いて判定し、Discord のレート制限を避けるため KV に 1 分キャッシュする（`bot:guild_ids`）
- Bot トークン未設定や取得失敗時は**絞り込まずに全所属サーバーを返す**（一覧が引けないことを理由に操作を止めない）
- `botInstallUrl` は Bot 導入用の OAuth2 URL（`scope=bot applications.commands` / `permissions=3072`）。スコープや権限値を Web 側に持たせないようサーバーで組み立てる

> セッションに保存するのは**ユーザーの全所属サーバー**で、絞り込みはこのエンドポイントの応答のみに適用する。所属検証（後述）は「ユーザーがそのサーバーのメンバーか」を見るものであり、Bot の導入有無とは別の軸。こうすることで、Bot が後から抜けたサーバーのクイズでも作成者の管理操作は壊れない。

以降のエンドポイントは原則ログイン必須。セッションから解決した `user_id` を `Actor` として `packages/core` の関数に渡す。

**サーバー所属の検証（重要）:** クライアントが渡す `guild_id` / `:guildId` は、そのまま信用せず**セッションに保存した所属サーバー一覧と照合する**。所属していないサーバーIDを指定した場合は `403 FORBIDDEN` を返す（他人のサーバーになりすまして一覧・統計・出題記録を操作されるのを防ぐ）。`guild_id` を省略した呼び出しは `guildId = null` の `Actor` になり、サーバー横断の管理操作（作成者本人チェック）に用いる。

検証対象はクエリの `guild_id` とパスの `:guildId` に限らず、**ボディで受け取るサーバーIDも同様**に照合する。具体的には `POST /api/quizzes/:id/shares` と `DELETE /api/quizzes/:id/shares` の `target_guild_id`、`PUT /api/quizzes/:id/editors/guild` の `guild_id`、`POST /api/quizzes/:id/questions/:qid/attempts` の `guild_id` で、未所属なら `403 FORBIDDEN`。

なお設問の追加・更新・削除は「作成者本人 or Editor」で判定するが、**Editor はサーバー単位の指定を含む**ため、クエリの `guild_id` を渡さないとサーバー単位の編集者が権限を失う。Web からは選択中のサーバーを必ず `guild_id` として送ること。

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

- Response: `Quiz & { questions: Question[], role, isOwner, authors }`
- `role` / `isOwner` は `GET /api/quizzes` と同じ意味（前者はそのサーバーでの権限、後者はサーバー非依存の作成者判定）。Web の管理画面が**設問の追加・編集・削除UIの表示可否**に使うため、詳細でも必ず返す
- `questions[].createdByUserId` は設問を追加したユーザーID。設問は Editor も追加できるためクイズ作成者とは限らない（[DB設計.md](./DB設計.md) 参照）
- `authors` は `{ [userId]: { id, displayName, avatarUrl } }` の対応表。クイズ作成者と各設問の作成者ぶんを含む
  - 表示名はDBに保持せず、APIがDiscordから解決してKVに1時間キャッシュする（改名に追随するため）
  - 退会済みなどで解決できなかったIDは `authors` に含まれない。Web側はIDのまま/「不明」にフォールバックする
- 注意: `questions[].answers`（正解）は Owner / Editor 以外には含めない（不正回答対策）
- 閲覧できるのは「そのサーバーで使えるクイズ」または「自分が作成したクイズ」。`guild_id` を付けない呼び出しでも、**作成者なら自分のクイズを取得できる**（管理画面向け）

### `PATCH /api/quizzes/:id`
クイズ情報更新（タイトル・説明・公開設定）。Owner のみ。

- Body: `{ title?, description?, visibility? }`

### `DELETE /api/quizzes/:id`
クイズ削除。Owner のみ。

---

## OGP画像

### `GET /og`
SNS共有用のOGP画像（PNG 1200x630）を生成して返す。**認証・CORSの対象外**（クローラーが認証なしで取得するため）。

- Query: `title` / `subtitle`（省略時はサイト全体の既定カード）
- Web の `index.html` の `og:image` がこのエンドポイントを指す
- 日本語フォントはWorkerに同梱せず、描画する文字だけのサブセットを Google Fonts から取得する（`text=` 指定。UAを送らないと satori が読めるTTFが返る）
- 生成結果は `Cache-Control: public, max-age=86400`

### `GET /q/:id`
公開クイズの共有ページ（HTML）。**認証・CORSの対象外**。

- `visibility = 'public'` のクイズのみ200。非公開・存在しないIDは404
- クローラー向けにサーバー側でHTMLを組み立て、`og:title` にクイズ名、`og:image` に `/og?title=...` を入れる
  - SPAの `index.html` は全URLで同一のため、URLごとに違うOGPを出すにはこの経路が要る
- **設問本文と正解は含めない**。出すのはタイトル・説明・設問数・形式の内訳・作成者の表示名のみ
- `Cache-Control: public, max-age=300`

---

## 設問

### `POST /api/quizzes/:id/questions`
設問追加。Owner / Editor。

- Body: `{ type, body, choices?, answers, explanation?, sort_order? }`
  - `type = free_text` の場合、`answers` は複数の正解パターンを配列で受け取る

### `POST /api/quizzes/:id/questions/bulk`
設問の一括追加（Webの「JSONで一括追加」用）。Owner / Editor。

- Body: `{ questions: [{ type, body, choices?, answers, explanation? }, ...] }`（1〜100件）
- 各要素は `POST .../questions` と同じ形式。バリデーションは全件を先に検証し、1件でも不正なら追加せず `400`（メッセージに何問目かを含める）
- `sort_order` は既存設問の後ろに、配列の並び順で自動採番する
- D1のバインド変数上限（100/クエリ）に合わせて内部で分割INSERTするが、`db.batch` で原子的に実行する（途中失敗で中途半端に残らない）
- Response: 追加された `Question[]`（`201`）

### `PATCH /api/quizzes/:id/questions/:qid`
設問更新。Owner / Editor。

### `DELETE /api/quizzes/:id/questions/:qid`
設問削除。Owner / Editor。

---

## 公開クイズの追加

共有は「作成者が公開設定にする → 使う側のサーバーが追加する」方式（[要件定義.md](./要件定義.md) 2.6）。**追加する側の操作**なので Owner 権限は不要で、対象クイズが `visibility: 'public'` であることが条件。

公開設定そのものの変更は `PATCH /api/quizzes/:id` の `visibility` で行う（Owner のみ）。

### `GET /api/quizzes/public`
指定サーバーにまだ追加していない、追加可能な公開クイズ一覧。

- Query: `guild_id`（必須。所属検証あり）, `keyword`（タイトル部分一致・任意）
- Response: `{ id, title, description, questionCount }[]`
- 自サーバー発のクイズと追加済みのものは除外される

### `GET /api/quizzes/added`
指定サーバーが追加済みの公開クイズ一覧。

- Query: `guild_id`（必須。所属検証あり）
- Response: `{ id, title, description, questionCount }[]`

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

編集権限の対象は「サーバー単位（そのサーバーの全員）」と「ユーザー単位」の2種類（[要件定義.md](./要件定義.md) 2.5）。Discord側は `/quiz editors` のパネルで、Web側は「設定を指定の状態に揃える」形の一括設定エンドポイントで操作する（行ID指定ではない）。いずれも Owner のみ。

### `GET /api/quizzes/:id/editors`
現在の編集権限設定を取得。

- Query: `guild_id`（`guildAllowed` はこのサーバーに対する設定なので必須。所属検証あり）
- Response: `{ guildAllowed: boolean, userIds: string[] }`

### `PUT /api/quizzes/:id/editors/guild`
指定サーバーの「全員編集可」設定を切り替える。

- Body: `{ guild_id, allowed }`（`guild_id` は所属検証あり）
- Response: `204 No Content`

### `PUT /api/quizzes/:id/editors/users`
ユーザー単位の編集者リストを、渡した集合に**総入れ替え**する。

- Body: `{ user_ids: string[] }`
- Response: `204 No Content`

---

## 出題・回答（Web上でのプレビュー用途）

Discord上での実際の出題・回答フローは `apps/bot` が `packages/core` を直接呼んで処理するため、このHTTP APIは経由しない。以下は Web アプリ側で「プレビュー実行」や動作確認を行うためのエンドポイント。

### `GET /api/quizzes/:id/questions/random`
出題プレビュー用に1問取得（ランダム or 指定）。

- Query: `question_id`（指定の場合）
- Response: `Question`（`answers` フィールドは含めない）

### `POST /api/quizzes/:id/questions/:qid/attempts`
プレビュー実行時の回答結果の記録・正誤判定（実際の出題記録は Bot 側から `packages/core` 経由で直接記録される）。

- Body: `{ guild_id, submitted_answer }`（`user_id` はセッションから解決するため受け取らない。`guild_id` は所属検証あり）
- Response: `{ isCorrect, correctAnswers, explanation }`
  - 正解発表のタイミングでのみ `correctAnswers` を返す
- 制約: 同一 `(question_id, guild_id, user_id)` で**プレビュー経由の**回答が既にある場合は `409 Conflict`（1設問1回まで）。Discordの1人モードで記録された行（`session_id` 付き）は判定対象に含めないため、ソロでプレイ済みの設問でもプレビューは実行できる
- レート制限: `(guild_id, user_id)` 単位で **5秒に3回**まで。4回目は `429 Too Many Requests`（`RATE_LIMITED`）を返す

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

- Query: `quiz_id`（絞り込み任意）, `period`（`all` \| `week` \| `month`）, `limit`（任意。未指定なら全件・最大100）
- `period` / `limit` は不正な値なら `422 VALIDATION_ERROR`
- Response: `{ userId, totalAttempts, correctCount, correctRate, displayName }[]`
- `displayName` は Discord の表示名。APIがBotトークンで解決してKVに1時間キャッシュする（IDのままではWebで誰の記録か分からないため）。退会などで引けなかった場合は `null`
- `:guildId` は所属検証あり（未所属は `403`）

### `GET /api/guilds/:guildId/stats/buzz-ranking`
サーバー内の**早押し**獲得数ランキング。

- Query: `quiz_id`（絞り込み任意）, `period`（`all` \| `week` \| `month`）, `limit`（任意。未指定なら全件・最大100）
- `period` / `limit` は不正な値なら `422 VALIDATION_ERROR`
- Response: `{ userId, winCount, answeredCount, displayName }[]`
- `displayName` の扱いは1人モードのランキングと同じ
- `:guildId` は所属検証あり

### `GET /api/guilds/:guildId/me/stats`
ログインユーザーの、そのサーバーでの成績（1人モード＋早押し）。本人のみ・所属サーバーのみ。

- Response:
  ```json
  {
    "solo": { "totalAttempts": 42, "correctCount": 30 },
    "buzz": { "answeredCount": 18, "winCount": 7 },
    "topQuizzes": [ { "quizId": "...", "title": "日本史クイズ", "totalAttempts": 20, "correctCount": 14 } ]
  }
  ```

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
