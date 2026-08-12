import { eq } from 'drizzle-orm'
import type { Database } from '../db/client'
import { quizzes } from '../db/schema'
import type { Actor } from '../types'
import { assertIsOwnerUser, getQuizOrThrow } from './permissions'

export async function deleteQuiz(db: Database, actor: Actor, quizId: string): Promise<void> {
  const quiz = await getQuizOrThrow(db, quizId)
  assertIsOwnerUser(actor, quiz)

  // questions/quiz_shares/quiz_editors/quiz_attempts は ON DELETE CASCADE で連鎖削除される
  await db.delete(quizzes).where(eq(quizzes.id, quizId))
}
