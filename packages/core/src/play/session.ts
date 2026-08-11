import { eq, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { questions } from '../db/schema'
import { notFound } from '../errors'
import { listQuizzes } from '../quiz/listQuizzes'
import { assertCanPlay, getQuizOrThrow, resolveQuizRole } from '../quiz/permissions'
import type { Actor, Question } from '../types'

export type PlayableQuiz = { id: string; title: string }

/**
 * そのサーバーで出題可能なクイズ（自サーバー作成 + 共有 + Editor権限）を作成日時昇順で返す。
 * 出題設定GUIのクイズ選択プルダウン用。
 */
export async function listPlayableQuizzes(db: Database, actor: Actor): Promise<PlayableQuiz[]> {
  const quizzes = await listQuizzes(db, actor)
  return quizzes
    .filter((q) => q.role !== 'none')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((q) => ({ id: q.id, title: q.title }))
}

/**
 * actor が設問を編集できるクイズ（Owner または Editor）を作成日時昇順で返す。
 * 設問作成GUIのクイズ選択プルダウン用（共有先サーバーは編集不可なので除外）。
 */
export async function listEditableQuizzes(db: Database, actor: Actor): Promise<PlayableQuiz[]> {
  const quizzes = await listQuizzes(db, actor)
  return quizzes
    .filter((q) => q.role === 'owner' || q.role === 'editor')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((q) => ({ id: q.id, title: q.title }))
}

/**
 * actor が削除できるクイズ（Owner のみ）を作成日時昇順で返す。
 * 削除GUIのクイズ選択プルダウン用。権限マトリクス（要件定義.md）に従い
 * Editor は削除できないため除外する。
 */
export async function listDeletableQuizzes(db: Database, actor: Actor): Promise<PlayableQuiz[]> {
  const quizzes = await listQuizzes(db, actor)
  return quizzes
    .filter((q) => q.role === 'owner')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((q) => ({ id: q.id, title: q.title }))
}

/** クイズの設問数を返す（出題数プルダウンの上限算出用）。 */
export async function countQuizQuestions(db: Database, quizId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(questions)
    .where(eq(questions.quizId, quizId))
  return rows[0]?.count ?? 0
}

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

/**
 * セッション開始用に、クイズの全設問を正解(answers)込みで取得する。
 * 出題可能権限をチェックする。取得した設問は Durable Object 内でのみ保持し、
 * 正解を Discord のメッセージには出さない（アーキテクチャ.md / API設計.md の非公開ルール）。
 */
export async function getSessionQuestions(
  db: Database,
  actor: Actor,
  quizId: string,
): Promise<Question[]> {
  const quiz = await getQuizOrThrow(db, quizId)
  const role = await resolveQuizRole(db, actor, quiz)
  assertCanPlay(role)

  const rows = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(questions.sortOrder)

  if (rows.length === 0) throw notFound('Question')
  return rows.map(toQuestion)
}
