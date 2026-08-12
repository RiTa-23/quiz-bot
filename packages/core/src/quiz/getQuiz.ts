import { eq } from 'drizzle-orm'
import type { Database } from '../db/client'
import { questions } from '../db/schema'
import type { Actor, PublicQuestion, Question, Quiz, QuizRole } from '../types'
import { assertCanViewQuiz, getQuizOrThrow, isOwnerUser, resolveQuizRole } from './permissions'

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
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function stripAnswers(question: Question): PublicQuestion {
  const { answers: _answers, ...rest } = question
  return rest
}

export type QuizDetail = Quiz & {
  questions: Question[] | PublicQuestion[]
  role: QuizRole
  isOwner: boolean
}

/**
 * クイズ詳細を取得する。owner/editor には正解(answers)を含めて返し、
 * それ以外（shared権限のプレビュー用途等）には含めない。
 * API設計.md「正解情報の非公開」ルールに従う。
 *
 * `role`（そのサーバーでの権限）と `isOwner`（サーバー非依存の作成者判定）は
 * 一覧（listQuizzes）と同じ意味で返す。Webの管理画面が編集UIの表示可否に使う。
 */
export async function getQuiz(db: Database, actor: Actor, quizId: string): Promise<QuizDetail> {
  const quiz = await getQuizOrThrow(db, quizId)
  const role = await resolveQuizRole(db, actor, quiz)
  assertCanViewQuiz(role, actor, quiz)

  const rows = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(questions.sortOrder)

  const parsed = rows.map(toQuestion)
  // 作成者はサーバーに依存せず正解を見られる（Web APIは guild_id を伴わない呼び出しがあり、
  // その場合 role は 'none' になるため、ロールだけで判定すると自分のクイズの正解が隠れてしまう）
  const isOwner = isOwnerUser(actor, quiz)
  const canSeeAnswers = isOwner || role === 'owner' || role === 'editor'

  return {
    ...quiz,
    questions: canSeeAnswers ? parsed : parsed.map(stripAnswers),
    role,
    isOwner,
  }
}
