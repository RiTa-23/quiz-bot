import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { Database } from '../db/client'
import { quizAttempts, questions } from '../db/schema'
import { conflict, notFound } from '../errors'
import { assertCanPlay, getQuizOrThrow, resolveQuizRole } from '../quiz/permissions'
import { checkRateLimit } from '../rate-limit/rateLimit'
import type { Actor } from '../types'
import { isCorrectAnswer } from './normalizeAnswer'

export type SubmitAttemptResult = {
  isCorrect: boolean
  correctAnswers: string[]
  explanation: string | null
}

/**
 * 回答結果の記録・正誤判定。
 * 同一 (question_id, guild_id, user_id) の重複回答は CONFLICT で拒否する（1設問1回まで）。
 */
export async function submitAttempt(
  db: Database,
  actor: Actor,
  quizId: string,
  questionId: string,
  submittedAnswer: string,
): Promise<SubmitAttemptResult> {
  if (actor.guildId === null) {
    throw notFound('Quiz')
  }

  const quiz = await getQuizOrThrow(db, quizId)
  const role = await resolveQuizRole(db, actor, quiz)
  assertCanPlay(role)

  await checkRateLimit(db, 'answer_submit', `${actor.guildId}:${actor.userId}`)

  const [question] = await db
    .select()
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.quizId, quizId)))
    .limit(1)
  if (!question) throw notFound('Question')

  const [existingAttempt] = await db
    .select({ id: quizAttempts.id })
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.questionId, questionId),
        eq(quizAttempts.guildId, actor.guildId),
        eq(quizAttempts.userId, actor.userId),
      ),
    )
    .limit(1)
  if (existingAttempt) throw conflict('この設問には既に回答済みです')

  const correct = isCorrectAnswer(question.type, submittedAnswer, question.answers)

  await db.insert(quizAttempts).values({
    id: randomUUID(),
    questionId,
    quizId,
    guildId: actor.guildId,
    userId: actor.userId,
    isCorrect: correct,
    submittedAnswer,
    answeredAt: new Date().toISOString(),
  })

  return {
    isCorrect: correct,
    correctAnswers: question.answers,
    explanation: question.explanation,
  }
}
