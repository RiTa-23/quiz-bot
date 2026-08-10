import { eq } from 'drizzle-orm'
import type { Database } from '../db/client'
import { questions } from '../db/schema'
import { notFound } from '../errors'
import { assertCanPlay, getQuizOrThrow, resolveQuizRole } from '../quiz/permissions'
import { checkRateLimit } from '../rate-limit/rateLimit'
import type { Actor, PublicQuestion, Question } from '../types'

function toQuestion(row: typeof questions.$inferSelect): Question {
  return {
    id: row.id,
    quizId: row.quizId,
    type: row.type,
    body: row.body,
    choices: row.choices,
    answers: row.answers,
    explanation: row.explanation,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function stripAnswers(question: Question): PublicQuestion {
  const { answers: _answers, ...rest } = question
  return rest
}

export async function getRandomQuestion(
  db: Database,
  actor: Actor,
  quizId: string,
  options?: { questionId?: string },
): Promise<PublicQuestion> {
  if (actor.guildId === null) {
    throw notFound('Quiz')
  }

  const quiz = await getQuizOrThrow(db, quizId)
  const role = await resolveQuizRole(db, actor, quiz)
  assertCanPlay(role)

  await checkRateLimit(db, 'quiz_play', `${actor.guildId}:${actor.userId}`)

  const rows = await db.select().from(questions).where(eq(questions.quizId, quizId))
  if (rows.length === 0) throw notFound('Question')

  const target = options?.questionId
    ? rows.find((row) => row.id === options.questionId)
    : rows[Math.floor(Math.random() * rows.length)]

  if (!target) throw notFound('Question')

  return stripAnswers(toQuestion(target))
}
