import { and, desc, eq, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { buzzAttempts, quizAttempts, quizzes } from '../db/schema'
import { validationError } from '../errors'
import type { Actor } from '../types'

export type MemberQuizBreakdown = {
  quizId: string
  title: string
  totalAttempts: number
  correctCount: number
  correctRate: number
}

export type MemberStats = {
  userId: string
  guildId: string
  solo: {
    totalAttempts: number
    correctCount: number
    correctRate: number
    quizCount: number
    lastPlayedAt: string | null
  }
  buzz: { answeredCount: number; winCount: number }
  topQuizzes: MemberQuizBreakdown[]
}

const rate = (correct: number, total: number) => (total > 0 ? correct / total : 0)

/**
 * 実行者本人の、そのサーバー内での成績（1人モードと早押しの両方）。
 * 他ユーザーの成績を引く口はあえて設けていない。
 */
export async function getMemberStats(
  db: Database,
  actor: Actor,
  options?: { quizLimit?: number },
): Promise<MemberStats> {
  if (actor.guildId === null) {
    throw validationError('この操作はサーバー内で実行してください')
  }
  const guildId = actor.guildId
  const userId = actor.userId
  const scope = and(eq(quizAttempts.guildId, guildId), eq(quizAttempts.userId, userId))

  const [soloRow] = await db
    .select({
      totalAttempts: sql<number>`count(*)`,
      correctCount: sql<number>`coalesce(sum(${quizAttempts.isCorrect}), 0)`,
      quizCount: sql<number>`count(distinct ${quizAttempts.quizId})`,
      lastPlayedAt: sql<string | null>`max(${quizAttempts.answeredAt})`,
    })
    .from(quizAttempts)
    .where(scope)

  const [buzzRow] = await db
    .select({
      answeredCount: sql<number>`count(*)`,
      winCount: sql<number>`coalesce(sum(${buzzAttempts.isWinner}), 0)`,
    })
    .from(buzzAttempts)
    .where(and(eq(buzzAttempts.guildId, guildId), eq(buzzAttempts.userId, userId)))

  const topRows = await db
    .select({
      quizId: quizAttempts.quizId,
      title: quizzes.title,
      totalAttempts: sql<number>`count(*)`,
      correctCount: sql<number>`coalesce(sum(${quizAttempts.isCorrect}), 0)`,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
    .where(scope)
    .groupBy(quizAttempts.quizId)
    .orderBy(desc(sql`count(*)`))
    .limit(options?.quizLimit ?? 5)

  const soloTotal = soloRow?.totalAttempts ?? 0
  const soloCorrect = soloRow?.correctCount ?? 0

  return {
    userId,
    guildId,
    solo: {
      totalAttempts: soloTotal,
      correctCount: soloCorrect,
      correctRate: rate(soloCorrect, soloTotal),
      quizCount: soloRow?.quizCount ?? 0,
      lastPlayedAt: soloRow?.lastPlayedAt ?? null,
    },
    buzz: {
      answeredCount: buzzRow?.answeredCount ?? 0,
      winCount: buzzRow?.winCount ?? 0,
    },
    topQuizzes: topRows.map((row) => ({
      quizId: row.quizId,
      title: row.title,
      totalAttempts: row.totalAttempts,
      correctCount: row.correctCount,
      correctRate: rate(row.correctCount, row.totalAttempts),
    })),
  }
}
