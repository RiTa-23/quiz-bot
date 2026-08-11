import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '../db/client'
import { quizEditors } from '../db/schema'
import { conflict, notFound, validationError } from '../errors'
import type { Actor } from '../types'
import { assertIsOwnerUser, getQuizOrThrow } from './permissions'

export type QuizEditor = {
  id: string
  quizId: string
  targetType: 'guild' | 'user'
  targetId: string
  role: 'editor'
  addedByUserId: string
  createdAt: string
}

export async function addEditor(
  db: Database,
  actor: Actor,
  quizId: string,
  input: { targetType: 'guild' | 'user'; targetId: string },
): Promise<QuizEditor> {
  const quiz = await getQuizOrThrow(db, quizId)
  assertIsOwnerUser(actor, quiz)

  const [existing] = await db
    .select({ id: quizEditors.id })
    .from(quizEditors)
    .where(
      and(
        eq(quizEditors.quizId, quizId),
        eq(quizEditors.targetType, input.targetType),
        eq(quizEditors.targetId, input.targetId),
      ),
    )
    .limit(1)
  if (existing) throw conflict('既に編集者として登録されています')

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  await db.insert(quizEditors).values({
    id,
    quizId,
    targetType: input.targetType,
    targetId: input.targetId,
    role: 'editor',
    addedByUserId: actor.userId,
    createdAt,
  })

  return {
    id,
    quizId,
    targetType: input.targetType,
    targetId: input.targetId,
    role: 'editor',
    addedByUserId: actor.userId,
    createdAt,
  }
}

export async function removeEditor(
  db: Database,
  actor: Actor,
  quizId: string,
  editorId: string,
): Promise<void> {
  const quiz = await getQuizOrThrow(db, quizId)
  assertIsOwnerUser(actor, quiz)

  const [existing] = await db
    .select({ id: quizEditors.id })
    .from(quizEditors)
    .where(and(eq(quizEditors.id, editorId), eq(quizEditors.quizId, quizId)))
    .limit(1)
  if (!existing) throw notFound('QuizEditor')

  await db.delete(quizEditors).where(eq(quizEditors.id, editorId))
}

export type EditorSettings = {
  /** このサーバーの全員に編集を許可しているか */
  guildAllowed: boolean
  /** 個別に編集を許可しているユーザー */
  userIds: string[]
}

/**
 * 編集権限の設定を取得する（作成者のみ）。
 * `guildAllowed` は actor が今いるサーバーに対する設定を指す。
 */
export async function getEditorSettings(
  db: Database,
  actor: Actor,
  quizId: string,
): Promise<EditorSettings> {
  const quiz = await getQuizOrThrow(db, quizId)
  assertIsOwnerUser(actor, quiz)

  const rows = await db
    .select({ targetType: quizEditors.targetType, targetId: quizEditors.targetId })
    .from(quizEditors)
    .where(eq(quizEditors.quizId, quizId))

  return {
    guildAllowed: rows.some(
      (r) => r.targetType === 'guild' && actor.guildId !== null && r.targetId === actor.guildId,
    ),
    userIds: rows.filter((r) => r.targetType === 'user').map((r) => r.targetId),
  }
}

/** このサーバー全員への編集許可をオン/オフする（作成者のみ）。 */
export async function setGuildEditor(
  db: Database,
  actor: Actor,
  quizId: string,
  allowed: boolean,
): Promise<void> {
  const quiz = await getQuizOrThrow(db, quizId)
  assertIsOwnerUser(actor, quiz)
  if (actor.guildId === null) throw validationError('この操作はサーバー内で実行してください')

  const where = and(
    eq(quizEditors.quizId, quizId),
    eq(quizEditors.targetType, 'guild'),
    eq(quizEditors.targetId, actor.guildId),
  )

  if (!allowed) {
    await db.delete(quizEditors).where(where)
    return
  }

  const [existing] = await db.select({ id: quizEditors.id }).from(quizEditors).where(where).limit(1)
  if (existing) return

  await db.insert(quizEditors).values({
    id: crypto.randomUUID(),
    quizId,
    targetType: 'guild',
    targetId: actor.guildId,
    role: 'editor',
    addedByUserId: actor.userId,
    createdAt: new Date().toISOString(),
  })
}

/**
 * 個別に編集を許可するユーザーを指定した集合に揃える（作成者のみ）。
 * 渡されなかったユーザーの許可は取り消す。
 */
export async function setUserEditors(
  db: Database,
  actor: Actor,
  quizId: string,
  userIds: string[],
): Promise<void> {
  const quiz = await getQuizOrThrow(db, quizId)
  assertIsOwnerUser(actor, quiz)

  const desired = [...new Set(userIds)].filter((id) => id !== actor.userId)
  const current = (
    await db
      .select({ targetId: quizEditors.targetId })
      .from(quizEditors)
      .where(and(eq(quizEditors.quizId, quizId), eq(quizEditors.targetType, 'user')))
  ).map((r) => r.targetId)

  const toAdd = desired.filter((id) => !current.includes(id))
  const toRemove = current.filter((id) => !desired.includes(id))

  if (toAdd.length > 0) {
    const now = new Date().toISOString()
    await db.insert(quizEditors).values(
      toAdd.map((targetId) => ({
        id: crypto.randomUUID(),
        quizId,
        targetType: 'user' as const,
        targetId,
        role: 'editor' as const,
        addedByUserId: actor.userId,
        createdAt: now,
      })),
    )
  }

  if (toRemove.length > 0) {
    await db
      .delete(quizEditors)
      .where(
        and(
          eq(quizEditors.quizId, quizId),
          eq(quizEditors.targetType, 'user'),
          inArray(quizEditors.targetId, toRemove),
        ),
      )
  }
}

export async function listEditors(db: Database, quizId: string): Promise<QuizEditor[]> {
  const rows = await db.select().from(quizEditors).where(eq(quizEditors.quizId, quizId))
  return rows
}
