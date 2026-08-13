import { and, desc, eq } from 'drizzle-orm'
import type { Database } from '../db/client'
import { questions } from '../db/schema'
import { notFound, validationError } from '../errors'
import type { Actor, Question, QuestionType } from '../types'
import { assertCanEditQuiz, getQuizOrThrow } from './permissions'

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
    // 選択肢に無い正解を登録すると、回答は選択肢の値で送られるため永久に正解できない設問になる
    if (input.answers !== undefined) {
      const choices = input.choices
      const invalid = input.answers.filter((a) => !choices.includes(a))
      if (invalid.length > 0) {
        throw validationError(`正解は選択肢の中から指定してください: ${invalid.join(' / ')}`)
      }
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
  await assertCanEditQuiz(db, actor, quiz)
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
    createdByUserId: actor.userId,
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
    createdByUserId: actor.userId,
    createdAt: now,
    updatedAt: now,
  }
}

// D1 は1クエリのバインド変数を100までに制限する。設問1行=11列なので、
// 余裕をもって8行ずつに分割して多行INSERTする（分割ぶんは1バッチで原子的に流す）。
const INSERT_CHUNK = 8

export async function addQuestions(
  db: Database,
  actor: Actor,
  quizId: string,
  inputs: AddQuestionInput[],
): Promise<Question[]> {
  const quiz = await getQuizOrThrow(db, quizId)
  await assertCanEditQuiz(db, actor, quiz)
  if (inputs.length === 0) throw validationError('追加する設問がありません')

  inputs.forEach((input, i) => {
    try {
      validateQuestionInput(input, input.type)
    } catch (e) {
      throw validationError(`${i + 1}問目: ${e instanceof Error ? e.message : '入力が不正です'}`)
    }
  })

  // 既存設問の後ろに、ファイルの並び順のまま追加する
  const [top] = await db
    .select({ sortOrder: questions.sortOrder })
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(desc(questions.sortOrder))
    .limit(1)
  const base = (top?.sortOrder ?? -1) + 1

  const now = new Date().toISOString()
  const rows = inputs.map((input, i) => ({
    id: crypto.randomUUID(),
    quizId,
    type: input.type,
    body: input.body,
    choices: input.type === 'multiple_choice' ? (input.choices ?? null) : null,
    answers: input.answers,
    explanation: input.explanation ?? null,
    sortOrder: input.sortOrder ?? base + i,
    createdByUserId: actor.userId,
    createdAt: now,
    updatedAt: now,
  }))

  const statements = []
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    statements.push(db.insert(questions).values(rows.slice(i, i + INSERT_CHUNK)))
  }
  const [first, ...rest] = statements
  // 途中のチャンクで失敗しても設問が中途半端に残らないよう、全文を1バッチで実行する
  if (first) await db.batch([first, ...rest])

  return rows.map((r) => ({
    id: r.id,
    quizId: r.quizId,
    type: r.type,
    body: r.body,
    choices: r.choices,
    answers: r.answers,
    explanation: r.explanation,
    sortOrder: r.sortOrder,
    createdByUserId: r.createdByUserId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
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
  await assertCanEditQuiz(db, actor, quiz)

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
    createdByUserId: existing.createdByUserId,
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
  await assertCanEditQuiz(db, actor, quiz)

  await db.delete(questions).where(and(eq(questions.id, questionId), eq(questions.quizId, quizId)))
}
