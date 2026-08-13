import {
  addPublicQuiz,
  addQuestion,
  addQuestions,
  createDb,
  createQuiz,
  deleteQuestion,
  deleteQuiz,
  getEditorSettings,
  getQuiz,
  getQuizStats,
  getRandomQuestion,
  listAddedQuizzes,
  listPublicQuizzes,
  listQuizzes,
  removeAddedQuiz,
  setGuildEditor,
  setUserEditors,
  submitAttempt,
  updateQuestion,
  updateQuiz,
} from '@quiz-bot/core'
import { Hono } from 'hono'
import { z } from 'zod'
import { actorForGuild, actorFromQuery } from '../actor'
import { fetchUserSummaries } from '../discordUsers'
import type { Bindings, Variables } from '../env'
import { handleApiError } from '../errorHandler'
import { requireAuth } from '../middleware/requireAuth'

export const quizzesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

quizzesRoutes.use('*', requireAuth)

// ── 公開クイズの探索（/:id より前に定義する。でないと `public` が :id として解釈される）──

quizzesRoutes.get('/public', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const keyword = c.req.query('keyword')
    const quizzes = await listPublicQuizzes(db, actorFromQuery(c), { keyword })
    return c.json(quizzes)
  } catch (error) {
    return handleApiError(c, error)
  }
})

quizzesRoutes.get('/added', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const quizzes = await listAddedQuizzes(db, actorFromQuery(c))
    return c.json(quizzes)
  } catch (error) {
    return handleApiError(c, error)
  }
})

// ── クイズ ──

quizzesRoutes.get('/', async (c) => {
  try {
    const guildId = c.req.query('guild_id')
    const db = createDb(c.env.DB)
    const quizzes = await listQuizzes(db, actorFromQuery(c), guildId ? { guildId } : undefined)
    return c.json(quizzes)
  } catch (error) {
    return handleApiError(c, error)
  }
})

const createQuizSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  owner_guild_id: z.string(),
  visibility: z.enum(['private', 'public']).optional(),
  allow_guild_edit: z.boolean().optional(),
})

quizzesRoutes.post('/', async (c) => {
  try {
    const body = createQuizSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    const actor = actorForGuild(c, body.owner_guild_id)
    const quiz = await createQuiz(db, actor, {
      title: body.title,
      description: body.description,
      visibility: body.visibility,
      allowGuildEdit: body.allow_guild_edit,
    })
    return c.json(quiz, 201)
  } catch (error) {
    return handleApiError(c, error)
  }
})

quizzesRoutes.get('/:id', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const quiz = await getQuiz(db, actorFromQuery(c), c.req.param('id'))
    // 表示名はDBに持たないため、クイズ作成者と各設問の作成者をここで解決して同梱する
    const authors = await fetchUserSummaries(c.env, [
      quiz.ownerUserId,
      ...quiz.questions.map((q) => q.createdByUserId ?? quiz.ownerUserId),
    ])
    return c.json({ ...quiz, authors })
  } catch (error) {
    return handleApiError(c, error)
  }
})

const updateQuizSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  visibility: z.enum(['private', 'public']).optional(),
})

quizzesRoutes.patch('/:id', async (c) => {
  try {
    const body = updateQuizSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    // 管理操作は作成者本人チェック（core内）で担保されるため guildId は不要
    const quiz = await updateQuiz(db, actorForGuild(c, null), c.req.param('id'), body)
    return c.json(quiz)
  } catch (error) {
    return handleApiError(c, error)
  }
})

quizzesRoutes.delete('/:id', async (c) => {
  try {
    const db = createDb(c.env.DB)
    await deleteQuiz(db, actorForGuild(c, null), c.req.param('id'))
    return c.body(null, 204)
  } catch (error) {
    return handleApiError(c, error)
  }
})

// ── 設問 ──

const questionSchema = z.object({
  type: z.enum(['multiple_choice', 'true_false', 'free_text']),
  body: z.string().min(1),
  choices: z.array(z.string()).nullable().optional(),
  answers: z.array(z.string()).min(1),
  explanation: z.string().nullable().optional(),
  sort_order: z.number().optional(),
})

quizzesRoutes.post('/:id/questions', async (c) => {
  try {
    const body = questionSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    const question = await addQuestion(db, actorFromQuery(c), c.req.param('id'), {
      type: body.type,
      body: body.body,
      choices: body.choices,
      answers: body.answers,
      explanation: body.explanation,
      sortOrder: body.sort_order,
    })
    return c.json(question, 201)
  } catch (error) {
    return handleApiError(c, error)
  }
})

const bulkQuestionsSchema = z.object({
  questions: z.array(questionSchema).min(1).max(100),
})

quizzesRoutes.post('/:id/questions/bulk', async (c) => {
  try {
    const body = bulkQuestionsSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    const created = await addQuestions(
      db,
      actorFromQuery(c),
      c.req.param('id'),
      body.questions.map((q) => ({
        type: q.type,
        body: q.body,
        choices: q.choices,
        answers: q.answers,
        explanation: q.explanation,
        sortOrder: q.sort_order,
      })),
    )
    return c.json(created, 201)
  } catch (error) {
    return handleApiError(c, error)
  }
})

const questionUpdateSchema = questionSchema.partial()

quizzesRoutes.patch('/:id/questions/:qid', async (c) => {
  try {
    const body = questionUpdateSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    const question = await updateQuestion(
      db,
      actorFromQuery(c),
      c.req.param('id'),
      c.req.param('qid'),
      {
        type: body.type,
        body: body.body,
        choices: body.choices,
        answers: body.answers,
        explanation: body.explanation,
        sortOrder: body.sort_order,
      },
    )
    return c.json(question)
  } catch (error) {
    return handleApiError(c, error)
  }
})

quizzesRoutes.delete('/:id/questions/:qid', async (c) => {
  try {
    const db = createDb(c.env.DB)
    await deleteQuestion(db, actorFromQuery(c), c.req.param('id'), c.req.param('qid'))
    return c.body(null, 204)
  } catch (error) {
    return handleApiError(c, error)
  }
})

// ── 公開クイズの追加・取り外し（追加する側のサーバー操作）──

const shareSchema = z.object({ target_guild_id: z.string() })

quizzesRoutes.post('/:id/shares', async (c) => {
  try {
    const body = shareSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    const result = await addPublicQuiz(
      db,
      actorForGuild(c, body.target_guild_id),
      c.req.param('id'),
    )
    return c.json(result, 201)
  } catch (error) {
    return handleApiError(c, error)
  }
})

quizzesRoutes.delete('/:id/shares', async (c) => {
  try {
    const body = shareSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    await removeAddedQuiz(db, actorForGuild(c, body.target_guild_id), c.req.param('id'))
    return c.body(null, 204)
  } catch (error) {
    return handleApiError(c, error)
  }
})

// ── 編集権限（作成者のみ。設定を指定状態に揃える）──

quizzesRoutes.get('/:id/editors', async (c) => {
  try {
    const db = createDb(c.env.DB)
    // guildAllowed はこのサーバーに対する設定なので guild_id を検証して渡す
    const settings = await getEditorSettings(db, actorFromQuery(c), c.req.param('id'))
    return c.json(settings)
  } catch (error) {
    return handleApiError(c, error)
  }
})

const guildEditorSchema = z.object({ guild_id: z.string(), allowed: z.boolean() })

quizzesRoutes.put('/:id/editors/guild', async (c) => {
  try {
    const body = guildEditorSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    await setGuildEditor(db, actorForGuild(c, body.guild_id), c.req.param('id'), body.allowed)
    return c.body(null, 204)
  } catch (error) {
    return handleApiError(c, error)
  }
})

const userEditorsSchema = z.object({ user_ids: z.array(z.string()) })

quizzesRoutes.put('/:id/editors/users', async (c) => {
  try {
    const body = userEditorsSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    await setUserEditors(db, actorForGuild(c, null), c.req.param('id'), body.user_ids)
    return c.body(null, 204)
  } catch (error) {
    return handleApiError(c, error)
  }
})

// ── 出題プレビュー（Web上での動作確認用）──

quizzesRoutes.get('/:id/questions/random', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const questionId = c.req.query('question_id')
    const question = await getRandomQuestion(db, actorFromQuery(c), c.req.param('id'), {
      questionId,
    })
    return c.json(question)
  } catch (error) {
    return handleApiError(c, error)
  }
})

const attemptSchema = z.object({
  guild_id: z.string(),
  submitted_answer: z.string(),
})

quizzesRoutes.post('/:id/questions/:qid/attempts', async (c) => {
  try {
    const body = attemptSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    const result = await submitAttempt(
      db,
      actorForGuild(c, body.guild_id),
      c.req.param('id'),
      c.req.param('qid'),
      body.submitted_answer,
    )
    return c.json(result)
  } catch (error) {
    return handleApiError(c, error)
  }
})

quizzesRoutes.get('/:id/stats', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const guildId = c.req.query('guild_id')
    const stats = await getQuizStats(db, actorFromQuery(c), c.req.param('id'), {
      guildId: guildId || undefined,
    })
    return c.json(stats)
  } catch (error) {
    return handleApiError(c, error)
  }
})
