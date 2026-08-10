import { and, eq } from 'drizzle-orm'
import type { Database } from '../db/client'
import { questions } from '../db/schema'
import { notFound, validationError } from '../errors'
import type { Actor, Question, QuestionType } from '../types'
import { assertCanEdit, getQuizOrThrow, resolveQuizRole } from './permissions'

export type AddQuestionInput = {
  type: QuestionType
  body: string
  choices?: string[] | null
  answers: string[]
  explanation?: string | null
  sortOrder?: number
}

function validateQuestionInput(input: AddQuestionInput | UpdateQuestionInput, type: QuestionType) {
  if (type === 'multiple_choice') {
    if (!input.choices || input.choices.length < 2) {
      throw validationError('4択の設問には2つ以上の選択肢が必要です')
    }
  }
  if (input.answers !== undefined && input.answers.length === 0) {
    throw validationError('正解パターンは1つ以上指定してください')
  }
}

export async function addQuestion(
  db: Database,
  actor: Actor,
  quizId: string,
  input: AddQuestionInput,
): Promise<Question> {
  const quiz = await getQuizOrThrow(db, quizId)
  const role = await resolveQuizRole(db, actor, quiz)
  assertCanEdit(role)
  validateQuestionInput(input, input.type)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const choices = input.type === 'multiple_choice' ? (input.choices ?? null) : null

  await db.insert(questions).values({
    id,
    quizId,
    type: input.type,
    body: input.body,
    choices,
    answers: input.answers,
    explanation: input.explanation ?? null,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  })

  return {
    id,
    quizId,
    type: input.type,
    body: input.body,
    choices,
    answers: input.answers,
    explanation: input.explanation ?? null,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  }
}

export type UpdateQuestionInput = {
  type?: QuestionType
  body?: string
  choices?: string[] | null
  answers?: string[]
  explanation?: string | null
  sortOrder?: number
}

export async function updateQuestion(
  db: Database,
  actor: Actor,
  quizId: string,
  questionId: string,
  input: UpdateQuestionInput,
): Promise<Question> {
  const quiz = await getQuizOrThrow(db, quizId)
  const role = await resolveQuizRole(db, actor, quiz)
  assertCanEdit(role)

  const [existing] = await db
    .select()
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.quizId, quizId)))
    .limit(1)
  if (!existing) throw notFound('Question')

  validateQuestionInput(input, input.type ?? existing.type)

  const updatedAt = new Date().toISOString()
  const patch = {
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.choices !== undefined ? { choices: input.choices } : {}),
    ...(input.answers !== undefined ? { answers: input.answers } : {}),
    ...(input.explanation !== undefined ? { explanation: input.explanation } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    updatedAt,
  }

  await db.update(questions).set(patch).where(eq(questions.id, questionId))

  return {
    id: existing.id,
    quizId: existing.quizId,
    type: patch.type ?? existing.type,
    body: patch.body ?? existing.body,
    choices: input.choices !== undefined ? input.choices : existing.choices,
    answers: patch.answers ?? existing.answers,
    explanation: input.explanation !== undefined ? input.explanation : existing.explanation,
    sortOrder: patch.sortOrder ?? existing.sortOrder,
    createdAt: existing.createdAt,
    updatedAt,
  }
}

export async function deleteQuestion(
  db: Database,
  actor: Actor,
  quizId: string,
  questionId: string,
): Promise<void> {
  const quiz = await getQuizOrThrow(db, quizId)
  const role = await resolveQuizRole(db, actor, quiz)
  assertCanEdit(role)

  await db.delete(questions).where(and(eq(questions.id, questionId), eq(questions.quizId, quizId)))
}
