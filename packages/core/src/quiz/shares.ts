import { and, eq } from 'drizzle-orm'
import type { Database } from '../db/client'
import { quizShares } from '../db/schema'
import { conflict, notFound } from '../errors'
import type { Actor } from '../types'
import { assertIsOwner, getQuizOrThrow, resolveQuizRole } from './permissions'

export type QuizShare = {
  id: string
  quizId: string
  targetGuildId: string
  sharedByUserId: string
  createdAt: string
}

export async function addShare(
  db: Database,
  actor: Actor,
  quizId: string,
  targetGuildId: string,
): Promise<QuizShare> {
  const quiz = await getQuizOrThrow(db, quizId)
  const role = await resolveQuizRole(db, actor, quiz)
  assertIsOwner(role)

  const [existing] = await db
    .select({ id: quizShares.id })
    .from(quizShares)
    .where(and(eq(quizShares.quizId, quizId), eq(quizShares.targetGuildId, targetGuildId)))
    .limit(1)
  if (existing) throw conflict('このサーバーには既に共有済みです')

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  await db.insert(quizShares).values({
    id,
    quizId,
    targetGuildId,
    sharedByUserId: actor.userId,
    createdAt,
  })

  return { id, quizId, targetGuildId, sharedByUserId: actor.userId, createdAt }
}

export async function removeShare(
  db: Database,
  actor: Actor,
  quizId: string,
  shareId: string,
): Promise<void> {
  const quiz = await getQuizOrThrow(db, quizId)
  const role = await resolveQuizRole(db, actor, quiz)
  assertIsOwner(role)

  const [existing] = await db
    .select({ id: quizShares.id })
    .from(quizShares)
    .where(and(eq(quizShares.id, shareId), eq(quizShares.quizId, quizId)))
    .limit(1)
  if (!existing) throw notFound('QuizShare')

  await db.delete(quizShares).where(eq(quizShares.id, shareId))
}

export async function listShares(db: Database, quizId: string): Promise<QuizShare[]> {
  const rows = await db.select().from(quizShares).where(eq(quizShares.quizId, quizId))
  return rows
}
