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

async function loadEditorRows(db: Database, quizId: string) {
  return db
    .select({ targetType: quizEditors.targetType, targetId: quizEditors.targetId })
    .from(quizEditors)
    .where(eq(quizEditors.quizId, quizId))
}

function matchesEditor(
  rows: { targetType: 'guild' | 'user'; targetId: string }[],
  actor: Actor,
): boolean {
  return rows.some(
    (row) =>
      (row.targetType === 'user' && row.targetId === actor.userId) ||
      (row.targetType === 'guild' && actor.guildId !== null && row.targetId === actor.guildId),
  )
}

/**
 * そのクイズが「このサーバーで使えるか」。
 * 作成元サーバー / 追加済みサーバー / そのサーバーがEditor指定されている の3つが根拠。
 */
async function isAvailableInGuild(
  db: Database,
  actor: Actor,
  quiz: Quiz,
  editorRows: { targetType: 'guild' | 'user'; targetId: string }[],
): Promise<boolean> {
  if (actor.guildId === null) return false
  if (actor.guildId === quiz.ownerGuildId) return true

  const guildIsEditor = editorRows.some(
    (row) => row.targetType === 'guild' && row.targetId === actor.guildId,
  )
  if (guildIsEditor) return true

  const [share] = await db
    .select({ id: quizShares.id })
    .from(quizShares)
    .where(and(eq(quizShares.quizId, quiz.id), eq(quizShares.targetGuildId, actor.guildId)))
    .limit(1)
  return Boolean(share)
}

/**
 * 「このサーバーでの」ロールを解決する（要件定義.md の権限マトリクス）。
 * まずそのサーバーで利用可能かを判定し、利用できないなら作成者であっても 'none' を返す。
 * クイズの管理権限（作成者かどうか）はサーバーに依存しないため、
 * ロールではなく assertIsOwnerUser / assertCanEditQuiz で判定する。
 */
export async function resolveQuizRole(db: Database, actor: Actor, quiz: Quiz): Promise<QuizRole> {
  const editorRows = await loadEditorRows(db, quiz.id)
  if (!(await isAvailableInGuild(db, actor, quiz, editorRows))) return 'none'

  if (quiz.ownerUserId === actor.userId) return 'owner'
  if (matchesEditor(editorRows, actor)) return 'editor'
  return 'shared'
}

export async function getQuizOrThrow(db: Database, quizId: string): Promise<Quiz> {
  const [row] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1)
  if (!row) throw notFound('Quiz')
  return toQuiz(row)
}

/**
 * 出題可能か。ロールは「そのサーバーでの」権限なので、
 * 作成者であっても別のサーバーからは出題できない（要件定義.md 2.6）。
 */
export function assertCanPlay(role: QuizRole) {
  if (role === 'none') throw forbidden('このクイズを出題する権限がありません')
}

// ── 以下はサーバーに依存しない「管理権限」の判定 ──
// 出題（assertCanPlay）はサーバー単位で制限するが、自分のクイズの管理は
// どのサーバーからでも行える（要件定義.md 2.6）。

/** そのクイズの作成者本人か（サーバーを問わない）。 */
export function isOwnerUser(actor: Actor, quiz: Quiz): boolean {
  return quiz.ownerUserId === actor.userId
}

/** クイズ削除・公開設定変更・編集者管理: 作成者本人のみ（サーバーを問わない）。 */
export function assertIsOwnerUser(actor: Actor, quiz: Quiz) {
  if (!isOwnerUser(actor, quiz)) {
    throw forbidden('この操作はクイズの作成者のみ実行できます')
  }
}

/** 設問の追加・編集・削除: 作成者本人または Editor（サーバーを問わない）。 */
export async function assertCanEditQuiz(db: Database, actor: Actor, quiz: Quiz) {
  if (isOwnerUser(actor, quiz)) return
  const editorRows = await loadEditorRows(db, quiz.id)
  if (!matchesEditor(editorRows, actor)) {
    throw forbidden('このクイズを編集する権限がありません')
  }
}

/**
 * 詳細・統計の閲覧。そのサーバーで使えるか、または作成者本人なら許可する。
 * Web API は guild_id を伴わない呼び出しがあるため、作成者への緩和が必要。
 */
export function assertCanViewQuiz(role: QuizRole, actor: Actor, quiz: Quiz) {
  if (role === 'none' && !isOwnerUser(actor, quiz)) {
    throw forbidden('このクイズを閲覧する権限がありません')
  }
}
