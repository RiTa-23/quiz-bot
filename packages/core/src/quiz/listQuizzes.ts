import { eq, inArray, or } from 'drizzle-orm'
import type { Database } from '../db/client'
import { quizEditors, quizShares, quizzes } from '../db/schema'
import type { Actor, Quiz, QuizRole } from '../types'

export type QuizListItem = Quiz & { role: QuizRole }

/**
 * actor が閲覧・編集可能なクイズ一覧（作成分 + 自サーバーへの共有分 + Editor権限分）。
 * guildId が指定されていればそのサーバーに紐づくものに絞る。
 */
export async function listQuizzes(
  db: Database,
  actor: Actor,
  filter?: { guildId?: string },
): Promise<QuizListItem[]> {
  const guildId = filter?.guildId ?? actor.guildId

  const editorQuizIds = (
    await db
      .select({ quizId: quizEditors.quizId })
      .from(quizEditors)
      .where(
        guildId
          ? or(eq(quizEditors.targetId, actor.userId), eq(quizEditors.targetId, guildId))
          : eq(quizEditors.targetId, actor.userId),
      )
  ).map((r) => r.quizId)

  const sharedQuizIds = guildId
    ? (
        await db
          .select({ quizId: quizShares.quizId })
          .from(quizShares)
          .where(eq(quizShares.targetGuildId, guildId))
      ).map((r) => r.quizId)
    : []

  const conditions = [eq(quizzes.ownerUserId, actor.userId)]
  if (guildId) conditions.push(eq(quizzes.ownerGuildId, guildId))
  const relatedIds = [...new Set([...editorQuizIds, ...sharedQuizIds])]

  const rows = await db
    .select()
    .from(quizzes)
    .where(relatedIds.length > 0 ? or(...conditions, inArray(quizzes.id, relatedIds)) : or(...conditions))

  return rows.map((row) => {
    let role: QuizRole = 'none'
    if (row.ownerUserId === actor.userId) role = 'owner'
    else if (editorQuizIds.includes(row.id)) role = 'editor'
    else if (sharedQuizIds.includes(row.id) || (guildId && row.ownerGuildId === guildId))
      role = 'shared'

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      ownerUserId: row.ownerUserId,
      ownerGuildId: row.ownerGuildId,
      visibility: row.visibility,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      role,
    }
  })
}
