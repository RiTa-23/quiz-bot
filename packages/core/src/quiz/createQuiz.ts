import type { Database } from '../db/client'
import { quizzes } from '../db/schema'
import { validationError } from '../errors'
import type { Actor, Quiz } from '../types'

export type CreateQuizInput = {
  title: string
  description?: string | null
  visibility?: 'private' | 'public'
}

export async function createQuiz(
  db: Database,
  actor: Actor,
  input: CreateQuizInput,
): Promise<Quiz> {
  if (actor.guildId === null) {
    throw validationError('クイズの作成にはサーバーコンテキストが必要です')
  }
  if (input.title.trim().length === 0) {
    throw validationError('タイトルは必須です')
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.insert(quizzes).values({
    id,
    title: input.title,
    description: input.description ?? null,
    ownerUserId: actor.userId,
    ownerGuildId: actor.guildId,
    visibility: input.visibility ?? 'private',
    createdAt: now,
    updatedAt: now,
  })

  return {
    id,
    title: input.title,
    description: input.description ?? null,
    ownerUserId: actor.userId,
    ownerGuildId: actor.guildId,
    visibility: input.visibility ?? 'private',
    createdAt: now,
    updatedAt: now,
  }
}
