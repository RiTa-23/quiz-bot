import { desc, eq, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { quizAttempts } from '../db/schema'

export type UserAttemptHistoryItem = {
  id: string
  questionId: string
  quizId: string
  guildId: string
  isCorrect: boolean
  answeredAt: string
}

export type UserStats = {
  totalAttempts: number
  correctRate: number
  history: UserAttemptHistoryItem[]
}

const DEFAULT_HISTORY_LIMIT = 100
const MAX_HISTORY_LIMIT = 500

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit < 1) return DEFAULT_HISTORY_LIMIT
  return Math.min(Math.floor(limit), MAX_HISTORY_LIMIT)
}

/**
 * ユーザー単位の解答履歴・正答率（Web API用）。
 * 全サーバー横断で集計する点に注意（Discord側はギルド内に限定した getMemberStats を使う）。
 */
export async function getUserStats(
  db: Database,
  userId: string,
  options?: { limit?: number },
): Promise<UserStats> {
  const summary = await db
    .select({
      totalAttempts: sql<number>`count(*)`,
      correctCount: sql<number>`sum(${quizAttempts.isCorrect})`,
    })
    .from(quizAttempts)
    .where(eq(quizAttempts.userId, userId))

  const totalAttempts = summary[0]?.totalAttempts ?? 0
  const correctCount = summary[0]?.correctCount ?? 0

  const history = await db
    .select({
      id: quizAttempts.id,
      questionId: quizAttempts.questionId,
      quizId: quizAttempts.quizId,
      guildId: quizAttempts.guildId,
      isCorrect: quizAttempts.isCorrect,
      answeredAt: quizAttempts.answeredAt,
    })
    .from(quizAttempts)
    .where(eq(quizAttempts.userId, userId))
    .orderBy(desc(quizAttempts.answeredAt))
    // 直接の呼び出し側が不正な値を渡しても件数上限を超えないよう、ここでも丸める
    .limit(clampLimit(options?.limit))

  return {
    totalAttempts,
    correctRate: totalAttempts > 0 ? correctCount / totalAttempts : 0,
    history,
  }
}
