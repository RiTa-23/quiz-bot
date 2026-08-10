# DB設計（Cloudflare D1）

[要件定義.md](./要件定義.md) に基づくデータモデル定義。DB は Cloudflare D1（SQLite）を使用する。

## ER概要

```
Quiz 1---N Question
Quiz 1---N QuizShare
Quiz 1---N QuizEditor
Question 1---N QuizAttempt
```

---

## テーブル定義

### quizzes

| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT (uuid) PK | クイズID |
| title | TEXT NOT NULL | タイトル |
| description | TEXT | 説明 |
| owner_user_id | TEXT NOT NULL | 作成者 Discord ユーザーID |
| owner_guild_id | TEXT NOT NULL | 作成元 Discord サーバーID |
| visibility | TEXT NOT NULL DEFAULT 'private' | `private`(サーバー限定) \| `shared` |
| created_at | TEXT NOT NULL | ISO8601 |
| updated_at | TEXT NOT NULL | ISO8601 |

インデックス: `owner_guild_id`, `owner_user_id`

### questions

| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT (uuid) PK | 設問ID |
| quiz_id | TEXT NOT NULL FK -> quizzes.id | 紐づくクイズ |
| type | TEXT NOT NULL | `multiple_choice` \| `true_false` \| `free_text` |
| body | TEXT NOT NULL | 問題文 |
| choices | TEXT (json) | 4択の選択肢。`["選択肢1","選択肢2",...]`（4択のみ） |
| answers | TEXT (json) NOT NULL | 正解パターンの配列。`["東京","とうきょう","Tokyo"]` のように複数正解を許容 |
| explanation | TEXT | 解説（任意） |
| sort_order | INTEGER NOT NULL DEFAULT 0 | 表示順 |
| created_at | TEXT NOT NULL | |
| updated_at | TEXT NOT NULL | |

インデックス: `quiz_id`

**自由記述の正解判定について**
- `answers` に複数の正解文字列パターンを保持し、いずれかに一致すれば正解とする
- 判定時の正規化（トリム・大小文字・全角半角統一など）はアプリケーション側で実施し、DB には正規化前の正解文字列をそのまま保持する

### quiz_shares（他サーバーへの個別共有）

| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT (uuid) PK | |
| quiz_id | TEXT NOT NULL FK -> quizzes.id | |
| target_guild_id | TEXT NOT NULL | 共有先サーバーID |
| shared_by_user_id | TEXT NOT NULL | 共有操作を行ったユーザーID |
| created_at | TEXT NOT NULL | |

制約: `UNIQUE(quiz_id, target_guild_id)`
インデックス: `target_guild_id`（「このサーバーに共有されているクイズ一覧」取得用）

### quiz_editors（共同編集者）

| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT (uuid) PK | |
| quiz_id | TEXT NOT NULL FK -> quizzes.id | |
| target_type | TEXT NOT NULL | `guild` \| `user` |
| target_id | TEXT NOT NULL | サーバーID or ユーザーID |
| role | TEXT NOT NULL DEFAULT 'editor' | 将来拡張用（現時点では `editor` のみ） |
| added_by_user_id | TEXT NOT NULL | 追加操作を行ったユーザーID |
| created_at | TEXT NOT NULL | |

制約: `UNIQUE(quiz_id, target_type, target_id)`
インデックス: `quiz_id`, `(target_type, target_id)`

### quiz_attempts（出題・回答履歴）

出題結果の統計表示（要件2.7）と、不正回答対策（1設問1回まで）の両方の基盤となるテーブル。

| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT (uuid) PK | |
| question_id | TEXT NOT NULL FK -> questions.id | |
| quiz_id | TEXT NOT NULL FK -> quizzes.id | 集計クエリ簡略化用の非正規化カラム |
| guild_id | TEXT NOT NULL | 出題されたサーバーID |
| user_id | TEXT NOT NULL | 回答したユーザーID |
| is_correct | INTEGER NOT NULL | 0/1 |
| submitted_answer | TEXT | 自由記述の場合の回答内容（統計・不正検知用） |
| answered_at | TEXT NOT NULL | ISO8601 |

制約: `UNIQUE(question_id, guild_id, user_id)` — 同一設問への複数回回答を防止（不正回答対策）
インデックス: `quiz_id`（クイズ単位集計）, `(guild_id, user_id)`（サーバー内ランキング集計）, `user_id`（ユーザー単位の履歴集計）

**統計表示への利用イメージ**
- クイズ単位の正答率: `SELECT AVG(is_correct) FROM quiz_attempts WHERE quiz_id = ?`
- 設問ごとの正答率: `GROUP BY question_id`
- サーバー内ランキング: `WHERE guild_id = ? GROUP BY user_id ORDER BY SUM(is_correct) DESC`
- ユーザー履歴: `WHERE user_id = ? ORDER BY answered_at DESC`

### rate_limits（レート制限用カウンタ）

出題コマンド・回答送信それぞれのクールダウン管理に使用。TTLベースで運用し、定期的に古い行を削除する（あるいは Cloudflare Workers KV への置き換えも検討可）。

| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT (uuid) PK | |
| scope | TEXT NOT NULL | `quiz_play` \| `answer_submit` など、制限対象の種別 |
| subject_key | TEXT NOT NULL | 制限対象を一意に表すキー（例: `guild_id:user_id`） |
| window_start | TEXT NOT NULL | 現在のカウント窓の開始時刻（ISO8601） |
| count | INTEGER NOT NULL DEFAULT 1 | 窓内での実行回数 |
| updated_at | TEXT NOT NULL | |

制約: `UNIQUE(scope, subject_key)`

> 補足: D1（SQLite）はレイテンシ・書き込み特性の観点でレート制限のような高頻度更新に不向きな場合がある。実装時に Workers KV や Durable Objects への切り出しを検討する（[要件定義.md](./要件定義.md) の未確定事項参照）。

---

## マイグレーション方針

- Cloudflare D1 のマイグレーション機能（`wrangler d1 migrations`）を使用し、`migrations/0001_init.sql` のような連番ファイルで管理する
- 初期マイグレーションで上記6テーブルを作成する
