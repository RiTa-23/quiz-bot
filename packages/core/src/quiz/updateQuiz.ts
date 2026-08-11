import { eq } from 'drizzle-orm'
import type { Database } from '../db/client'
import { quizzes } from '../db/schema'
import type { Actor, Quiz } from '../types'
import { assertIsOwnerUser, getQuizOrThrow } from './permissions'

export type UpdateQuizInput = {
  title?: string
  description?: string | null
  visibility?: 'private' | 'public'
}

export async function updateQuiz(
  db: Database,
  actor: Actor,
  quizId: string,
  input: UpdateQuizInput,
): Promise<Quiz> {
  const quiz = await getQuizOrThrow(db, quizId)
  assertIsOwnerUser(actor, quiz)

  const updatedAt = new Date().toISOString()
  await db
    .update(quizzes)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      updatedAt,
    })
    .where(eq(quizzes.id, quizId))

  return {
    ...quiz,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    updatedAt,
  }
}
