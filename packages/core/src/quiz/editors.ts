import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { Database } from '../db/client'
import { quizEditors } from '../db/schema'
import { conflict, notFound } from '../errors'
import type { Actor } from '../types'
import { assertIsOwner, getQuizOrThrow, resolveQuizRole } from './permissions'

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
  const role = await resolveQuizRole(db, actor, quiz)
  assertIsOwner(role)

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

  const id = randomUUID()
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
  const role = await resolveQuizRole(db, actor, quiz)
  assertIsOwner(role)

  const [existing] = await db
    .select({ id: quizEditors.id })
    .from(quizEditors)
    .where(and(eq(quizEditors.id, editorId), eq(quizEditors.quizId, quizId)))
    .limit(1)
  if (!existing) throw notFound('QuizEditor')

  await db.delete(quizEditors).where(eq(quizEditors.id, editorId))
}

export async function listEditors(db: Database, quizId: string): Promise<QuizEditor[]> {
  const rows = await db.select().from(quizEditors).where(eq(quizEditors.quizId, quizId))
  return rows
}
