import { and, eq, or } from 'drizzle-orm'
import type { Database } from '../db/client'
import { quizEditors, quizShares, quizzes } from '../db/schema'
import { forbidden, notFound } from '../errors'
import type { Actor, Quiz, QuizRole } from '../types'

function toQuiz(row: typeof quizzes.$inferSelect): Quiz {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    ownerUserId: row.ownerUserId,
    ownerGuildId: row.ownerGuildId,
    visibility: row.visibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * 要件定義.md の権限マトリクスに基づき actor のロールを解決する。
 * owner > editor(user/guild指定) > shared(共有先サーバー) > none の優先順位。
 */
export async function resolveQuizRole(db: Database, actor: Actor, quiz: Quiz): Promise<QuizRole> {
  if (quiz.ownerUserId === actor.userId) return 'owner'

  const editorRows = await db
    .select({ targetType: quizEditors.targetType, targetId: quizEditors.targetId })
    .from(quizEditors)
    .where(eq(quizEditors.quizId, quiz.id))

  const isEditor = editorRows.some(
    (row) =>
      (row.targetType === 'user' && row.targetId === actor.userId) ||
      (row.targetType === 'guild' && actor.guildId !== null && row.targetId === actor.guildId),
  )
  if (isEditor) return 'editor'

  if (actor.guildId !== null) {
    if (actor.guildId === quiz.ownerGuildId) return 'shared'

    const [share] = await db
      .select({ id: quizShares.id })
      .from(quizShares)
      .where(and(eq(quizShares.quizId, quiz.id), eq(quizShares.targetGuildId, actor.guildId)))
      .limit(1)
    if (share) return 'shared'
  }

  return 'none'
}

export async function getQuizOrThrow(db: Database, quizId: string): Promise<Quiz> {
  const [row] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1)
  if (!row) throw notFound('Quiz')
  return toQuiz(row)
}

/** 出題可能: owner, editor, shared(共有先サーバー含む自サーバー) */
export function assertCanPlay(role: QuizRole) {
  if (role === 'none') throw forbidden('このクイズを出題する権限がありません')
}

/** 設問の追加・編集・削除可能: owner, editor */
export function assertCanEdit(role: QuizRole) {
  if (role !== 'owner' && role !== 'editor') {
    throw forbidden('このクイズを編集する権限がありません')
  }
}

/** クイズ削除・共有設定変更・編集者管理可能: owner のみ */
export function assertIsOwner(role: QuizRole) {
  if (role !== 'owner') throw forbidden('この操作はクイズの作成者のみ実行できます')
}

/** 一覧表示・詳細閲覧に自分がどこかしら関与しているか */
export function assertCanView(role: QuizRole) {
  if (role === 'none') throw forbidden('このクイズを閲覧する権限がありません')
}
