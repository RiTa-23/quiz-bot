import { and, eq, inArray, or } from 'drizzle-orm'
import type { Database } from '../db/client'
import { quizEditors, quizShares, quizzes } from '../db/schema'
import type { Actor, Quiz, QuizRole } from '../types'

/**
 * `role` は「そのサーバーでの」権限（出題・閲覧の可否）。
 * `isOwner` はサーバーに依存しない作成者判定で、管理系コマンドの一覧に使う。
 */
export type QuizListItem = Quiz & { role: QuizRole; isOwner: boolean }

/**
 * actor に関係するクイズ一覧（作成分 + 自サーバー発 + 追加済みの公開クイズ + Editor権限分）。
 * 自分が作成したクイズは所属サーバーに関係なく含まれるが、その場合 `role` は 'none' になりうる
 * （他サーバーでは出題できないため。要件定義.md 2.6）。
 */
export async function listQuizzes(
  db: Database,
  actor: Actor,
  filter?: { guildId?: string },
): Promise<QuizListItem[]> {
  const guildId = filter?.guildId ?? actor.guildId

  const userEditorQuizIds = (
    await db
      .select({ quizId: quizEditors.quizId })
      .from(quizEditors)
      .where(and(eq(quizEditors.targetType, 'user'), eq(quizEditors.targetId, actor.userId)))
  ).map((r) => r.quizId)

  const guildEditorQuizIds = guildId
    ? (
        await db
          .select({ quizId: quizEditors.quizId })
          .from(quizEditors)
          .where(and(eq(quizEditors.targetType, 'guild'), eq(quizEditors.targetId, guildId)))
      ).map((r) => r.quizId)
    : []

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
  const relatedIds = [...new Set([...userEditorQuizIds, ...guildEditorQuizIds, ...sharedQuizIds])]

  const rows = await db
    .select()
    .from(quizzes)
    .where(
      relatedIds.length > 0
        ? or(...conditions, inArray(quizzes.id, relatedIds))
        : or(...conditions),
    )

  return rows.map((row) => {
    const isOwner = row.ownerUserId === actor.userId
    // そのサーバーで使えるか（作成元 / 追加済み / そのサーバーがEditor指定）
    const availableInGuild = Boolean(
      guildId &&
        (row.ownerGuildId === guildId ||
          sharedQuizIds.includes(row.id) ||
          guildEditorQuizIds.includes(row.id)),
    )

    let role: QuizRole = 'none'
    if (availableInGuild) {
      if (isOwner) role = 'owner'
      else if (userEditorQuizIds.includes(row.id) || guildEditorQuizIds.includes(row.id))
        role = 'editor'
      else role = 'shared'
    }

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
      isOwner,
    }
  })
}
