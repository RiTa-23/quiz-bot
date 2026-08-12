import { and, desc, eq, gte, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { buzzAttempts } from '../db/schema'
import type { RankingPeriod } from './guildRanking'

export type BuzzAttemptRecord = {
  sessionId: string
  quizId: string
  guildId: string
  questionId: string
  userId: string
  isCorrect: boolean
  isWinner: boolean
}

/** 早押しの回答結果をまとめて記録する（設問締め切り時にDOから呼ばれる）。 */
export async function recordBuzzAttempts(
  db: Database,
  entries: BuzzAttemptRecord[],
): Promise<void> {
  if (entries.length === 0) return
  const now = new Date().toISOString()
  await db.insert(buzzAttempts).values(
    entries.map((e) => ({
      id: crypto.randomUUID(),
      sessionId: e.sessionId,
      questionId: e.questionId,
      quizId: e.quizId,
      guildId: e.guildId,
      userId: e.userId,
      isCorrect: e.isCorrect,
      isWinner: e.isWinner,
      answeredAt: now,
    })),
  )
}

export type BuzzRankingEntry = {
  userId: string
  winCount: number
  answeredCount: number
}

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

/** サーバー内の早押し獲得数（最初に正解した回数）ランキング。 */
export async function getBuzzRanking(
  db: Database,
  guildId: string,
  options?: { quizId?: string; period?: RankingPeriod; limit?: number },
): Promise<BuzzRankingEntry[]> {
  const conditions = [eq(buzzAttempts.guildId, guildId)]
  if (options?.quizId) conditions.push(eq(buzzAttempts.quizId, options.quizId))
  const since = periodStart(options?.period ?? 'all')
  if (since) conditions.push(gte(buzzAttempts.answeredAt, since))

  const query = db
    .select({
      userId: buzzAttempts.userId,
      winCount: sql<number>`coalesce(sum(${buzzAttempts.isWinner}), 0)`,
      answeredCount: sql<number>`count(*)`,
    })
    .from(buzzAttempts)
    .where(and(...conditions))
    .groupBy(buzzAttempts.userId)
    // 上位N件で切るときに順位がぶれないよう、同点は回答数→userIdでタイブレークする
    .orderBy(desc(sql`sum(${buzzAttempts.isWinner})`), desc(sql`count(*)`), buzzAttempts.userId)

  const rows = await (options?.limit ? query.limit(options.limit) : query)

  return rows.map((r) => ({
    userId: r.userId,
    winCount: r.winCount ?? 0,
    answeredCount: r.answeredCount,
  }))
}
