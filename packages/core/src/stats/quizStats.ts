import { eq, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { quizAttempts } from '../db/schema'

export type QuizStats = {
  totalAttempts: number
  correctRate: number
  questions: { questionId: string; totalAttempts: number; correctRate: number }[]
}

export async function getQuizStats(db: Database, quizId: string): Promise<QuizStats> {
  const overall = await db
    .select({
      totalAttempts: sql<number>`count(*)`,
      correctCount: sql<number>`sum(${quizAttempts.isCorrect})`,
    })
    .from(quizAttempts)
    .where(eq(quizAttempts.quizId, quizId))

  const totalAttempts = overall[0]?.totalAttempts ?? 0
  const correctCount = overall[0]?.correctCount ?? 0

  const perQuestion = await db
    .select({
      questionId: quizAttempts.questionId,
      totalAttempts: sql<number>`count(*)`,
      correctCount: sql<number>`sum(${quizAttempts.isCorrect})`,
    })
    .from(quizAttempts)
    .where(eq(quizAttempts.quizId, quizId))
    .groupBy(quizAttempts.questionId)

  return {
    totalAttempts,
    correctRate: totalAttempts > 0 ? correctCount / totalAttempts : 0,
    questions: perQuestion.map((row) => ({
      questionId: row.questionId,
      totalAttempts: row.totalAttempts,
      correctRate: row.totalAttempts > 0 ? row.correctCount / row.totalAttempts : 0,
    })),
  }
}
