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
  options?: { quizId?: string; period?: RankingPeriod; limit?: number },
): Promise<RankingEntry[]> {
  const conditions = [eq(quizAttempts.guildId, guildId)]
  if (options?.quizId) conditions.push(eq(quizAttempts.quizId, options.quizId))
  const since = periodStart(options?.period ?? 'all')
  if (since) conditions.push(gte(quizAttempts.answeredAt, since))

  const query = db
    .select({
      userId: quizAttempts.userId,
      totalAttempts: sql<number>`count(*)`,
      correctCount: sql<number>`coalesce(sum(${quizAttempts.isCorrect}), 0)`,
    })
    .from(quizAttempts)
    .where(and(...conditions))
    .groupBy(quizAttempts.userId)
    // 上位N件で切るときに順位がぶれないよう、同点は回答数→userIdでタイブレークする
    .orderBy(desc(sql`sum(${quizAttempts.isCorrect})`), desc(sql`count(*)`), quizAttempts.userId)

  const rows = await (options?.limit ? query.limit(options.limit) : query)

  return rows.map((row) => ({
    userId: row.userId,
    totalAttempts: row.totalAttempts,
    correctCount: row.correctCount,
    correctRate: row.totalAttempts > 0 ? row.correctCount / row.totalAttempts : 0,
  }))
}
