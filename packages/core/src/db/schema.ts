import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, unique, uniqueIndex } from 'drizzle-orm/sqlite-core'

const nowIso = () => sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`

export const quizzes = sqliteTable(
  'quizzes',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    ownerUserId: text('owner_user_id').notNull(),
    ownerGuildId: text('owner_guild_id').notNull(),
    visibility: text('visibility', { enum: ['private', 'public'] })
      .notNull()
      .default('private'),
    createdAt: text('created_at').notNull().default(nowIso()),
    updatedAt: text('updated_at').notNull().default(nowIso()),
  },
  (table) => [
    index('quizzes_owner_guild_id_idx').on(table.ownerGuildId),
    index('quizzes_owner_user_id_idx').on(table.ownerUserId),
  ],
)

export const questions = sqliteTable(
  'questions',
  {
    id: text('id').primaryKey(),
    quizId: text('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['multiple_choice', 'true_false', 'free_text'] }).notNull(),
    body: text('body').notNull(),
    choices: text('choices', { mode: 'json' }).$type<string[] | null>(),
    answers: text('answers', { mode: 'json' }).notNull().$type<string[]>(),
    explanation: text('explanation'),
    sortOrder: integer('sort_order').notNull().default(0),
    // 設問はEditorも追加できるため、クイズ作成者(quizzes.owner_user_id)とは別に持つ。
    // 導入前の行はマイグレーションでクイズ作成者を埋めているため実質的に非NULL。
    createdByUserId: text('created_by_user_id'),
    createdAt: text('created_at').notNull().default(nowIso()),
    updatedAt: text('updated_at').notNull().default(nowIso()),
  },
  (table) => [index('questions_quiz_id_idx').on(table.quizId)],
)

export const quizShares = sqliteTable(
  'quiz_shares',
  {
    id: text('id').primaryKey(),
    quizId: text('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    targetGuildId: text('target_guild_id').notNull(),
    sharedByUserId: text('shared_by_user_id').notNull(),
    createdAt: text('created_at').notNull().default(nowIso()),
  },
  (table) => [
    unique('quiz_shares_quiz_target_unique').on(table.quizId, table.targetGuildId),
    index('quiz_shares_target_guild_id_idx').on(table.targetGuildId),
  ],
)

export const quizEditors = sqliteTable(
  'quiz_editors',
  {
    id: text('id').primaryKey(),
    quizId: text('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    targetType: text('target_type', { enum: ['guild', 'user'] }).notNull(),
    targetId: text('target_id').notNull(),
    role: text('role', { enum: ['editor'] })
      .notNull()
      .default('editor'),
    addedByUserId: text('added_by_user_id').notNull(),
    createdAt: text('created_at').notNull().default(nowIso()),
  },
  (table) => [
    unique('quiz_editors_quiz_target_unique').on(table.quizId, table.targetType, table.targetId),
    index('quiz_editors_quiz_id_idx').on(table.quizId),
    index('quiz_editors_target_idx').on(table.targetType, table.targetId),
  ],
)

export const quizAttempts = sqliteTable(
  'quiz_attempts',
  {
    id: text('id').primaryKey(),
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    quizId: text('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    isCorrect: integer('is_correct', { mode: 'boolean' }).notNull(),
    submittedAnswer: text('submitted_answer'),
    answeredAt: text('answered_at').notNull().default(nowIso()),
    // null = Webプレビュー経由の回答 / 非null = 1人モードセッションの回答
    sessionId: text('session_id'),
  },
  (table) => [
    // 「1設問1回まで」はプレビュー経由の回答にのみ適用する。
    // 1人モードは同じクイズを繰り返し遊べるため、セッションごとに重複記録を許す。
    uniqueIndex('quiz_attempts_preview_question_guild_user_unique')
      .on(table.questionId, table.guildId, table.userId)
      .where(sql`${table.sessionId} is null`),
    index('quiz_attempts_quiz_id_idx').on(table.quizId),
    index('quiz_attempts_guild_user_idx').on(table.guildId, table.userId),
    index('quiz_attempts_user_id_idx').on(table.userId),
    index('quiz_attempts_session_id_idx').on(table.sessionId),
  ],
)

export const buzzAttempts = sqliteTable(
  'buzz_attempts',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull(),
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    quizId: text('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    isCorrect: integer('is_correct', { mode: 'boolean' }).notNull(),
    isWinner: integer('is_winner', { mode: 'boolean' }).notNull(),
    answeredAt: text('answered_at').notNull().default(nowIso()),
  },
  (table) => [
    index('buzz_attempts_guild_user_idx').on(table.guildId, table.userId),
    index('buzz_attempts_quiz_id_idx').on(table.quizId),
    index('buzz_attempts_session_id_idx').on(table.sessionId),
  ],
)

export const rateLimits = sqliteTable(
  'rate_limits',
  {
    id: text('id').primaryKey(),
    scope: text('scope', { enum: ['quiz_play', 'answer_submit'] }).notNull(),
    subjectKey: text('subject_key').notNull(),
    windowStart: text('window_start').notNull(),
    count: integer('count').notNull().default(1),
    updatedAt: text('updated_at').notNull().default(nowIso()),
  },
  (table) => [unique('rate_limits_scope_subject_unique').on(table.scope, table.subjectKey)],
)
