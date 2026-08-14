import { and, eq, like, ne, notInArray, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { questions, quizShares, quizzes } from '../db/schema'
import { conflict, forbidden, notFound, validationError } from '../errors'
import type { Actor } from '../types'
import { getQuizOrThrow } from './permissions'

export type QuizShare = {
  id: string
  quizId: string
  targetGuildId: string
  sharedByUserId: string
  createdAt: string
}

export type PublicQuizListing = {
  id: string
  title: string
  description: string | null
  ownerGuildId: string
  questionCount: number
}

const DEFAULT_LIST_LIMIT = 25

/**
 * クイズの設問数を数える相関サブクエリ。
 * テーブル名は明示的に書く。Drizzleはトップレベルにjoinが無いと `sql` 内の
 * カラム参照からテーブル修飾を落とすため、`${questions.quizId} = ${quizzes.id}`
 * と書くとサブクエリ側で両方 questions の列に解決され、常に0件になる。
 */
const questionCountSql = sql<number>`(select count(*) from questions where questions.quiz_id = quizzes.id)`

function requireGuild(actor: Actor): string {
  if (actor.guildId === null) {
    throw validationError('この操作はサーバー内で実行してください')
  }
  return actor.guildId
}

/**
 * 他サーバーが公開しているクイズのうち、まだこのサーバーに追加していないものを返す。
 * keyword を渡すとタイトルの部分一致で絞り込む。
 */
export async function listPublicQuizzes(
  db: Database,
  actor: Actor,
  options?: { keyword?: string; limit?: number },
): Promise<PublicQuizListing[]> {
  const guildId = requireGuild(actor)

  const addedIds = (
    await db
      .select({ quizId: quizShares.quizId })
      .from(quizShares)
      .where(eq(quizShares.targetGuildId, guildId))
  ).map((row) => row.quizId)

  const conditions = [
    eq(quizzes.visibility, 'public'),
    // 自サーバー発のクイズは元から使えるので候補に出さない
    ne(quizzes.ownerGuildId, guildId),
  ]
  const keyword = options?.keyword?.trim()
  if (keyword) conditions.push(like(quizzes.title, `%${keyword}%`))
  if (addedIds.length > 0) conditions.push(notInArray(quizzes.id, addedIds))

  const rows = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      ownerGuildId: quizzes.ownerGuildId,
      questionCount: questionCountSql,
    })
    .from(quizzes)
    .where(and(...conditions))
    .orderBy(quizzes.createdAt)
    .limit(options?.limit ?? DEFAULT_LIST_LIMIT)

  return rows
}

/** このサーバーが追加済みの公開クイズ一覧（追加を取り消す画面用）。 */
export async function listAddedQuizzes(db: Database, actor: Actor): Promise<PublicQuizListing[]> {
  const guildId = requireGuild(actor)

  const rows = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      ownerGuildId: quizzes.ownerGuildId,
      questionCount: questionCountSql,
    })
    .from(quizShares)
    .innerJoin(quizzes, eq(quizzes.id, quizShares.quizId))
    .where(eq(quizShares.targetGuildId, guildId))
    .orderBy(quizShares.createdAt)

  return rows
}

/**
 * 公開クイズをこのサーバーに追加する（本家への参照を持つだけで複製はしない）。
 * サーバーのメンバーであれば誰でも実行できる。
 */
export async function addPublicQuiz(
  db: Database,
  actor: Actor,
  quizId: string,
): Promise<{ quizId: string; title: string }> {
  const guildId = requireGuild(actor)
  const quiz = await getQuizOrThrow(db, quizId)

  if (quiz.visibility !== 'public') {
    throw forbidden('このクイズは公開されていません')
  }
  if (quiz.ownerGuildId === guildId) {
    throw conflict('このクイズはこのサーバーのものです')
  }

  const [existing] = await db
    .select({ id: quizShares.id })
    .from(quizShares)
    .where(and(eq(quizShares.quizId, quizId), eq(quizShares.targetGuildId, guildId)))
    .limit(1)
  if (existing) throw conflict('このクイズは既に追加されています')

  await db.insert(quizShares).values({
    id: crypto.randomUUID(),
    quizId,
    targetGuildId: guildId,
    sharedByUserId: actor.userId,
    createdAt: new Date().toISOString(),
  })

  return { quizId: quiz.id, title: quiz.title }
}

/** 追加済みの公開クイズをこのサーバーから外す。元のクイズ自体は消えない。 */
export async function removeAddedQuiz(
  db: Database,
  actor: Actor,
  quizId: string,
): Promise<{ quizId: string; title: string }> {
  const guildId = requireGuild(actor)
  const quiz = await getQuizOrThrow(db, quizId)

  const [existing] = await db
    .select({ id: quizShares.id })
    .from(quizShares)
    .where(and(eq(quizShares.quizId, quizId), eq(quizShares.targetGuildId, guildId)))
    .limit(1)
  if (!existing) throw notFound('QuizShare')

  await db.delete(quizShares).where(eq(quizShares.id, existing.id))
  return { quizId: quiz.id, title: quiz.title }
}

/** そのクイズを追加しているサーバーの一覧（作成者向け）。 */
export async function listShares(db: Database, quizId: string): Promise<QuizShare[]> {
  return db.select().from(quizShares).where(eq(quizShares.quizId, quizId))
}

export type PublicQuizSummary = {
  id: string
  title: string
  description: string | null
  ownerUserId: string
  questionCount: number
  questionTypes: { multipleChoice: number; trueFalse: number; freeText: number }
  createdAt: string
}

/**
 * 共有リンク用に、公開クイズの概要を**認証なし**で取得する。
 * 誰でも見られる経路のため、`visibility = 'public'` のクイズだけを返し、
 * 設問本文・正解は一切含めない（[docs/API設計.md](../../../../docs/API設計.md) の正解非公開ルール）。
 */
export async function getPublicQuizSummary(
  db: Database,
  quizId: string,
): Promise<PublicQuizSummary | null> {
  const [quiz] = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      ownerUserId: quizzes.ownerUserId,
      createdAt: quizzes.createdAt,
    })
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.visibility, 'public')))
    .limit(1)
  if (!quiz) return null

  const rows = await db
    .select({ type: questions.type })
    .from(questions)
    .where(eq(questions.quizId, quizId))

  return {
    ...quiz,
    questionCount: rows.length,
    questionTypes: {
      multipleChoice: rows.filter((q) => q.type === 'multiple_choice').length,
      trueFalse: rows.filter((q) => q.type === 'true_false').length,
      freeText: rows.filter((q) => q.type === 'free_text').length,
    },
  }
}
