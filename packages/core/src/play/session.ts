import { eq, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { questions } from '../db/schema'
import { notFound } from '../errors'
import { listQuizzes } from '../quiz/listQuizzes'
import { assertCanPlay, getQuizOrThrow, resolveQuizRole } from '../quiz/permissions'
import type { Actor, Question } from '../types'

export type PlayableQuiz = { id: string; title: string; description: string | null }

function toPlayableQuiz(q: {
  id: string
  title: string
  description: string | null
}): PlayableQuiz {
  return { id: q.id, title: q.title, description: q.description }
}

/**
 * そのサーバーで出題可能なクイズ（作成元サーバー + 追加した公開クイズ + ギルドEditor）を返す。
 * 自分が作成したクイズでも、別のサーバーにいる場合は含まれない（要件定義.md 2.6）。
 * 出題設定GUIのクイズ選択プルダウン用。
 */
export async function listPlayableQuizzes(db: Database, actor: Actor): Promise<PlayableQuiz[]> {
  const quizzes = await listQuizzes(db, actor)
  return quizzes
    .filter((q) => q.role !== 'none')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(toPlayableQuiz)
}

/**
 * actor が設問を編集できるクイズ（作成者 または Editor）を返す。
 * 管理操作はサーバーをまたいで行えるため、別サーバーにいても自分のクイズは含まれる。
 */
export async function listEditableQuizzes(db: Database, actor: Actor): Promise<PlayableQuiz[]> {
  const quizzes = await listQuizzes(db, actor)
  return quizzes
    .filter((q) => q.isOwner || q.role === 'editor')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(toPlayableQuiz)
}

/**
 * actor が削除できるクイズ（Owner のみ）を作成日時昇順で返す。
 * 削除GUIのクイズ選択プルダウン用。権限マトリクス（要件定義.md）に従い
 * Editor は削除できないため除外する。
 */
export async function listDeletableQuizzes(db: Database, actor: Actor): Promise<PlayableQuiz[]> {
  const quizzes = await listQuizzes(db, actor)
  return quizzes
    .filter((q) => q.isOwner)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(toPlayableQuiz)
}

export type OwnedQuiz = PlayableQuiz & { visibility: 'private' | 'public' }

/**
 * actor が作成したクイズを公開設定つきで返す。公開設定GUI用。
 * 公開設定を変更できるのは作成者のみ（updateQuiz が assertIsOwnerUser で担保する）。
 */
export async function listOwnedQuizzes(db: Database, actor: Actor): Promise<OwnedQuiz[]> {
  const quizzes = await listQuizzes(db, actor)
  return quizzes
    .filter((q) => q.isOwner)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((q) => ({ ...toPlayableQuiz(q), visibility: q.visibility }))
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
