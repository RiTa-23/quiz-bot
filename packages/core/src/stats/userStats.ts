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

export async function getUserStats(db: Database, userId: string): Promise<UserStats> {
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

  return {
    totalAttempts,
    correctRate: totalAttempts > 0 ? correctCount / totalAttempts : 0,
    history,
  }
}
