import type { Database } from '../db/client'
import { quizEditors, quizzes } from '../db/schema'
import { validationError } from '../errors'
import type { Actor, Quiz } from '../types'

export type CreateQuizInput = {
  title: string
  description?: string | null
  visibility?: 'private' | 'public'
  /** 作成元サーバーの全員に編集を許可するか（既定: true）。`/quiz editors` で後から変更できる。 */
  allowGuildEdit?: boolean
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

  // 既定では作成元サーバーの全員が編集できるようにする（身内でクイズを育てる想定）。
  // 作成者だけに絞りたい場合は `/quiz editors` でオフにできる。
  if (input.allowGuildEdit ?? true) {
    await db.insert(quizEditors).values({
      id: crypto.randomUUID(),
      quizId: id,
      targetType: 'guild',
      targetId: actor.guildId,
      role: 'editor',
      addedByUserId: actor.userId,
      createdAt: now,
    })
  }

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
