import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { questions, quizAttempts } from '../db/schema'
import { assertCanView, getQuizOrThrow, resolveQuizRole } from '../quiz/permissions'
import type { Actor } from '../types'

export type QuizQuestionStats = {
  questionId: string
  body: string
  sortOrder: number
  totalAttempts: number
  correctCount: number
  correctRate: number
}

export type QuizStats = {
  quizId: string
  title: string
  totalAttempts: number
  correctCount: number
  correctRate: number
  uniqueUserCount: number
  questions: QuizQuestionStats[]
}

const rate = (correct: number, total: number) => (total > 0 ? correct / total : 0)

/**
 * クイズ単位の統計（1人モードの `quiz_attempts` 由来）。
 * 閲覧権限（role !== 'none'）を内部でチェックする。
 * guildId を渡すとそのサーバー分のみを集計する（共有クイズはサーバーごとに数字が変わる）。
 */
export async function getQuizStats(
  db: Database,
  actor: Actor,
  quizId: string,
  options?: { guildId?: string },
): Promise<QuizStats> {
  const quiz = await getQuizOrThrow(db, quizId)
  assertCanView(await resolveQuizRole(db, actor, quiz))

  const scopeGuildId = options?.guildId
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

  return {
    quizId: quiz.id,
    title: quiz.title,
    totalAttempts,
    correctCount,
    correctRate: rate(correctCount, totalAttempts),
    uniqueUserCount: userRow?.count ?? 0,
    questions: perQuestion,
  }
}
