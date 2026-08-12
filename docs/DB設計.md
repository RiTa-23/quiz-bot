# DB設計（Cloudflare D1）

[要件定義.md](./要件定義.md) に基づくデータモデル定義。DB は Cloudflare D1（SQLite）を使用する。

## ER概要

```
Quiz 1---N Question
Quiz 1---N QuizShare
Quiz 1---N QuizEditor
Question 1---N QuizAttempt    （1人モードの回答記録）
Question 1---N BuzzAttempt    （早押しモードの回答記録）
```

- `rate_limits` はどのエンティティにも紐づかない独立テーブル
- 出題セッションの進行状態は D1 ではなく Durable Object が持つ（本ドキュメント末尾参照）

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
| visibility | TEXT NOT NULL DEFAULT 'private' | `private`（サーバー限定）\| `public`（公開＝他サーバーが追加可能）。値の検証はアプリ側（Drizzleのenum）で行い、DBにCHECK制約は置いていない |
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

### quiz_shares（公開クイズをどのサーバーが追加したか）

「そのサーバーが公開クイズを自サーバーに追加した」という事実を表す。**クイズの複製ではなく参照**であり、本文は `quizzes` / `questions` 側にしか存在しない（要件定義.md 2.6 参照）。

| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT (uuid) PK | |
| quiz_id | TEXT NOT NULL FK -> quizzes.id | 追加した公開クイズ |
| target_guild_id | TEXT NOT NULL | 追加したサーバーID |
| shared_by_user_id | TEXT NOT NULL | 追加操作を行ったユーザーID |
| created_at | TEXT NOT NULL | |

制約: `UNIQUE(quiz_id, target_guild_id)` — 同じクイズを二重に追加できない
インデックス: `target_guild_id`（「このサーバーが追加したクイズ一覧」取得用）

- 行の作成は `/quiz add-public`（`addPublicQuiz`）、削除は `/quiz remove-public`（`removeAddedQuiz`）
- 追加できるのは `quizzes.visibility = 'public'` のクイズのみ。ただし**追加後に作成者が `private` に戻してもこの行は残る**ため、既に追加したサーバーでは引き続き利用できる
- 作成者がクイズを削除すると `ON DELETE CASCADE` でこの行も消える（追加していたサーバーでは使えなくなる）
- **「そのサーバーでクイズが使えるか」の根拠は3つだけ**: `quizzes.owner_guild_id`（作成元）/ このテーブルの行（追加済み）/ `quiz_editors` の `target_type='guild'` 行（ギルドEditor指定）。`resolveQuizRole` はこの3つを見て利用可否を決め、当てはまらなければ**作成者であっても** `none` を返す（要件定義.md 2.6.1）
- 一方、クイズの管理権限（作成者か）は `quizzes.owner_user_id` だけで決まり、サーバーに依存しない

### quiz_editors（共同編集者）

クイズ作成時に、作成元サーバーに対する行（`target_type='guild'`）が**自動で1件挿入される**（既定で作成元サーバーの全員が編集できる。要件定義.md 2.5）。`/quiz editors` でオフにすると削除される。

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

1人モードの回答履歴を記録するテーブル。出題結果の統計表示（要件2.7）と、Webプレビューの不正回答対策（1設問1回まで）の基盤となる。

| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT PK | セッション回答は `session_id:question_id:user_id`、プレビュー経由は uuid（下記「再送の冪等性」参照） |
| question_id | TEXT NOT NULL FK -> questions.id | |
| quiz_id | TEXT NOT NULL FK -> quizzes.id | 集計クエリ簡略化用の非正規化カラム |
| guild_id | TEXT NOT NULL | 出題されたサーバーID |
| user_id | TEXT NOT NULL | 回答したユーザーID |
| is_correct | INTEGER NOT NULL | 0/1 |
| submitted_answer | TEXT | 自由記述の場合の回答内容（統計・不正検知用） |
| answered_at | TEXT NOT NULL | ISO8601 |
| session_id | TEXT | 1人モードのセッションID。**NULL は Web のプレビュー経由**の回答を表す |

制約: `UNIQUE(question_id, guild_id, user_id) WHERE session_id IS NULL` — **部分ユニークインデックス**。
プレビュー経由の回答についてのみ「1設問1回まで」を強制する（不正回答対策）。1人モードは同じクイズを繰り返しプレイできる必要があるため、`session_id` を持つ行はこの制約の対象外とし、セッションごとに重複記録できる。

インデックス: `quiz_id`（クイズ単位集計）, `(guild_id, user_id)`（サーバー内ランキング集計）, `user_id`（ユーザー単位の履歴集計）, `session_id`

**記録のタイミング**
- 1人モード: `QuizSession`（Durable Object）が回答のたびに `packages/core` 経由で1行書き込む。セッションを途中で放棄しても、それまでの回答は残る
- Webのプレビュー実行: `POST /api/quizzes/:id/questions/:qid/attempts`（`session_id` は NULL）

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

### buzz_attempts（早押しモードの回答記録）

早押しモードの回答結果を記録する。1人モードの `quiz_attempts` とは分離し、早押し固有の属性（勝者フラグ）を持つ（要件定義.md 2.7 参照）。同じ設問が別セッションで再出題されうるため、列の組み合わせに対するユニーク制約は持たない（重複防止は主キーで行う。下記「再送の冪等性」参照）。

| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT (uuid) PK | |
| session_id | TEXT NOT NULL | 早押しセッションの識別子（Durable Object が発番） |
| question_id | TEXT NOT NULL FK -> questions.id | |
| quiz_id | TEXT NOT NULL FK -> quizzes.id | 集計用の非正規化カラム |
| guild_id | TEXT NOT NULL | 出題されたサーバーID |
| user_id | TEXT NOT NULL | 回答したユーザーID |
| is_correct | INTEGER NOT NULL | 0/1 |
| is_winner | INTEGER NOT NULL | 0/1。その設問を最初に正解したか（得点者。1設問につき最大1人） |
| answered_at | TEXT NOT NULL | ISO8601 |

インデックス: `(guild_id, user_id)`（早押しランキング集計）, `quiz_id`, `session_id`

**統計への利用イメージ**
- サーバー内の早押し獲得数ランキング: `SELECT user_id, SUM(is_winner) FROM buzz_attempts WHERE guild_id = ? GROUP BY user_id ORDER BY SUM(is_winner) DESC`
- ユーザーの早押し参加数: `SELECT COUNT(*) FROM buzz_attempts WHERE user_id = ?`

**記録のタイミング**
- 早押しの進行状態そのものは Durable Object のSQLiteが持つ（[アーキテクチャ.md](./アーキテクチャ.md)）。各設問の締め切り確定時に、その設問への回答結果（勝者と、締め切りまでに回答した参加者）を DO から `packages/core` 経由で `buzz_attempts` に書き込む

---

## 出題セッションの状態は D1 に持たない

複数問セッション・早押しの進行状態（設定内容、現在の問番号、参加者スコア、早押しの締め切り状態など）は **D1 ではなく Durable Object（`QuizSession`）のSQLiteストレージ**に保持する。理由と設計は [アーキテクチャ.md](./アーキテクチャ.md) の「出題セッションの状態管理」を参照。

- D1 に持つのは**恒久データ**のみ（クイズ本体・設問・共有・編集者・回答記録・レート制限）
- DO が持つのは**セッション進行中の一時状態**のみ。セッション終了後は破棄してよい
- 恒久的な回答記録が必要な場合は、DOから `packages/core` 経由で D1 の `quiz_attempts` に書く（DOのSQLiteに記録を残すのではない）

### 再送の冪等性（quiz_attempts / buzz_attempts 共通）

DOからD1への書き込みは失敗しても進行を止めず、バッファに残して再送する（[アーキテクチャ.md](./アーキテクチャ.md) 参照）。このとき「1回目は実際には書けていたが応答が失われた」ケースで重複行が入らないよう、**セッション経由の回答は主キーを内容から決定的に組み立てる**。

- `id = ${session_id}:${question_id}:${user_id}`
- INSERT は `ON CONFLICT DO NOTHING` で行うため、同じ回答を何度再送しても1行に収束する
- 1セッション内で同じ設問が2回出ることはないため、この3つ組で一意になる
- Webプレビュー経由の `quiz_attempts`（`session_id` が NULL）は従来どおりランダムなuuid。こちらは既存の部分ユニークインデックスで重複を防いでいる

この方式は列に対する追加のユニーク制約を必要としないため、**マイグレーションは不要**（既存行のランダムIDとも衝突しない）。
- したがって本セクションのD1テーブル定義に、セッション用テーブルは追加しない

DO内SQLiteのスキーマ（`QuizSession` が内部で持つテーブル）は Durable Object の実装詳細として `apps/bot` 側で定義し、本ドキュメント（D1設計）の対象外とする。

---

## 削除時の連鎖（回答記録の扱い）

`quiz_attempts` / `buzz_attempts` はいずれも `quiz_id` / `question_id` に `ON DELETE CASCADE` を持ち、D1でも外部キーは有効（`PRAGMA foreign_keys = 1`）。

- クイズを削除すると、そのクイズの回答記録（ソロ・早押しとも）が連鎖削除される
- 設問を1件削除すると、その設問の回答記録が連鎖削除される

孤児レコードを作らず実装をシンプルに保つため、**この挙動を意図的に採用している**。トレードオフとして、クイズを削除するとそこで得た成績はランキング等から失われる（要件定義.md 2.7 参照）。長期の成績保持が必要になった場合は、クイズのソフトデリート化または外部キーの見直しを検討する。

## マイグレーション方針

- Cloudflare D1 のマイグレーション機能（`wrangler d1 migrations`）を使用し、`migrations/0001_init.sql` のような連番ファイルで管理する
- 初期マイグレーション（`0001_init.sql`）で最初の6テーブル（quizzes / questions / quiz_shares / quiz_editors / quiz_attempts / rate_limits）を作成済み
- `buzz_attempts` は早押し機能の実装時に後続マイグレーション（`0002_buzz_attempts.sql`）で追加した
- `0003_quiz_attempts_session.sql` で `quiz_attempts` に `session_id` を追加し、旧 `UNIQUE(question_id, guild_id, user_id)` を破棄して `WHERE session_id IS NULL` 付きの部分ユニークインデックスに置き換えた（1人モードの恒久記録対応）
- Durable Object（`QuizSession`）のSQLiteは D1 マイグレーションの対象外。DOクラスは `apps/bot` の `wrangler.jsonc` で `new_sqlite_classes` として登録する（[アーキテクチャ.md](./アーキテクチャ.md) 参照）
