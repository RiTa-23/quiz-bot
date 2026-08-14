import { and, desc, eq, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { questions, quizAttempts, quizShares } from '../db/schema'
import { forbidden } from '../errors'
import { assertCanViewQuiz, getQuizOrThrow, resolveQuizRole } from '../quiz/permissions'
import type { Actor } from '../types'

export type QuizQuestionStats = {
  questionId: string
  body: string
  sortOrder: number
  totalAttempts: number
  correctCount: number
  correctRate: number
}

/** サーバー別の内訳（作成者が全サーバー集計を見るときだけ返す）。 */
export type QuizGuildStats = {
  guildId: string
  totalAttempts: number
  correctCount: number
  correctRate: number
  uniqueUserCount: number
}

export type QuizStats = {
  quizId: string
  title: string
  totalAttempts: number
  correctCount: number
  correctRate: number
  uniqueUserCount: number
  questions: QuizQuestionStats[]
  /** このクイズを追加しているサーバー数 */
  shareCount: number
  /** 全サーバー集計（scope: 'all'）のときのみ入る。作成者限定 */
  byGuild?: QuizGuildStats[]
}

const rate = (correct: number, total: number) => (total > 0 ? correct / total : 0)

/**
 * クイズ単位の統計（1人モードの `quiz_attempts` 由来）。
 * 閲覧権限（role !== 'none'）を内部でチェックする。
 * guildId を渡すとそのサーバー分のみを集計する（共有クイズはサーバーごとに数字が変わる）。
 * scope: 'all' は全サーバーを横断して集計し、サーバー別の内訳も返す。
 * 他サーバーでの遊ばれ方が見えることになるため、**作成者本人だけ**に許す。
 */
export async function getQuizStats(
  db: Database,
  actor: Actor,
  quizId: string,
  options?: { guildId?: string; scope?: 'guild' | 'all' },
): Promise<QuizStats> {
  const quiz = await getQuizOrThrow(db, quizId)
  assertCanViewQuiz(await resolveQuizRole(db, actor, quiz), actor, quiz)

  const allGuilds = options?.scope === 'all' || !options?.guildId
  if (allGuilds && quiz.ownerUserId !== actor.userId) {
    throw forbidden('全サーバーの統計を見られるのはクイズの作成者だけです')
  }

  const scopeGuildId = allGuilds ? undefined : options?.guildId
  // 絞り込みは JOIN 条件に置く。WHERE に置くと LEFT JOIN が INNER JOIN に退化し、
  // 未回答の設問が一覧から消えてしまう。
  const joinCondition = scopeGuildId
    ? and(eq(quizAttempts.questionId, questions.id), eq(quizAttempts.guildId, scopeGuildId))
    : eq(quizAttempts.questionId, questions.id)

  const rows = await db
    .select({
      questionId: questions.id,
      body: questions.body,
      sortOrder: questions.sortOrder,
      totalAttempts: sql<number>`count(${quizAttempts.id})`,
      correctCount: sql<number>`coalesce(sum(${quizAttempts.isCorrect}), 0)`,
    })
    .from(questions)
    .leftJoin(quizAttempts, joinCondition)
    .where(eq(questions.quizId, quizId))
    .groupBy(questions.id)
    .orderBy(questions.sortOrder)

  const perQuestion: QuizQuestionStats[] = rows.map((row) => ({
    questionId: row.questionId,
    body: row.body,
    sortOrder: row.sortOrder,
    totalAttempts: row.totalAttempts,
    correctCount: row.correctCount,
    correctRate: rate(row.correctCount, row.totalAttempts),
  }))

  const totalAttempts = perQuestion.reduce((sum, q) => sum + q.totalAttempts, 0)
  const correctCount = perQuestion.reduce((sum, q) => sum + q.correctCount, 0)

  const userConditions = [eq(quizAttempts.quizId, quizId)]
  if (scopeGuildId) userConditions.push(eq(quizAttempts.guildId, scopeGuildId))
  const [userRow] = await db
    .select({ count: sql<number>`count(distinct ${quizAttempts.userId})` })
    .from(quizAttempts)
    .where(and(...userConditions))

  const [shareRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(quizShares)
    .where(eq(quizShares.quizId, quizId))

  // 全サーバー集計のときだけ、どのサーバーでどれだけ遊ばれたかを添える
  const byGuild = allGuilds
    ? (
        await db
          .select({
            guildId: quizAttempts.guildId,
            totalAttempts: sql<number>`count(${quizAttempts.id})`,
            correctCount: sql<number>`coalesce(sum(${quizAttempts.isCorrect}), 0)`,
            uniqueUserCount: sql<number>`count(distinct ${quizAttempts.userId})`,
          })
          .from(quizAttempts)
          .where(eq(quizAttempts.quizId, quizId))
          .groupBy(quizAttempts.guildId)
          .orderBy(desc(sql`count(${quizAttempts.id})`))
      ).map((row) => ({
        guildId: row.guildId,
        totalAttempts: row.totalAttempts,
        correctCount: row.correctCount,
        correctRate: rate(row.correctCount, row.totalAttempts),
        uniqueUserCount: row.uniqueUserCount,
      }))
    : undefined

  return {
    quizId: quiz.id,
    title: quiz.title,
    totalAttempts,
    correctCount,
    correctRate: rate(correctCount, totalAttempts),
    uniqueUserCount: userRow?.count ?? 0,
    questions: perQuestion,
    shareCount: shareRow?.count ?? 0,
    ...(byGuild ? { byGuild } : {}),
  }
}
