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
      questionCount: sql<number>`(select count(*) from ${questions} where ${questions.quizId} = ${quizzes.id})`,
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
      questionCount: sql<number>`(select count(*) from ${questions} where ${questions.quizId} = ${quizzes.id})`,
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
