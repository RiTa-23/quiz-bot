import { and, desc, eq, gte, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { quizAttempts } from '../db/schema'

export type RankingEntry = {
  userId: string
  totalAttempts: number
  correctCount: number
  correctRate: number
}

export type RankingPeriod = 'all' | 'week' | 'month'

function periodStart(period: RankingPeriod): string | null {
  const now = new Date()
  if (period === 'week') {
    now.setDate(now.getDate() - 7)
    return now.toISOString()
  }
  if (period === 'month') {
    now.setMonth(now.getMonth() - 1)
    return now.toISOString()
  }
  return null
}

export async function getGuildRanking(
  db: Database,
  guildId: string,
  options?: { quizId?: string; period?: RankingPeriod },
): Promise<RankingEntry[]> {
  const conditions = [eq(quizAttempts.guildId, guildId)]
  if (options?.quizId) conditions.push(eq(quizAttempts.quizId, options.quizId))
  const since = periodStart(options?.period ?? 'all')
  if (since) conditions.push(gte(quizAttempts.answeredAt, since))

  const rows = await db
    .select({
      userId: quizAttempts.userId,
      totalAttempts: sql<number>`count(*)`,
      correctCount: sql<number>`sum(${quizAttempts.isCorrect})`,
    })
    .from(quizAttempts)
    .where(and(...conditions))
    .groupBy(quizAttempts.userId)
    .orderBy(desc(sql`sum(${quizAttempts.isCorrect})`))

  return rows.map((row) => ({
    userId: row.userId,
    totalAttempts: row.totalAttempts,
    correctCount: row.correctCount,
    correctRate: row.totalAttempts > 0 ? row.correctCount / row.totalAttempts : 0,
  }))
}
