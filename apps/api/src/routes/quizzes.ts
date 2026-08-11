import {
  addEditor,
  addPublicQuiz,
  addQuestion,
  createDb,
  createQuiz,
  deleteQuestion,
  deleteQuiz,
  getQuiz,
  getQuizStats,
  getRandomQuestion,
  listQuizzes,
  removeAddedQuiz,
  removeEditor,
  submitAttempt,
  updateQuestion,
  updateQuiz,
} from '@quiz-bot/core'
import { Hono } from 'hono'
import { z } from 'zod'
import type { Bindings, Variables } from '../env'
import { handleApiError } from '../errorHandler'
import { requireAuth } from '../middleware/requireAuth'

export const quizzesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

quizzesRoutes.use('*', requireAuth)

function actorOf(c: {
  get: (key: 'userId') => string
  req: { query: (key: string) => string | undefined }
}) {
  return {
    userId: c.get('userId'),
    guildId: c.req.query('guild_id') ?? null,
  }
}

quizzesRoutes.get('/', async (c) => {
  try {
    const guildId = c.req.query('guild_id')
    const db = createDb(c.env.DB)
    const quizzes = await listQuizzes(db, actorOf(c), guildId ? { guildId } : undefined)
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
})

quizzesRoutes.post('/', async (c) => {
  try {
    const body = createQuizSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    const actor = { userId: c.get('userId'), guildId: body.owner_guild_id }
    const quiz = await createQuiz(db, actor, {
      title: body.title,
      description: body.description,
      visibility: body.visibility,
    })
    return c.json(quiz, 201)
  } catch (error) {
    return handleApiError(c, error)
  }
})

quizzesRoutes.get('/:id', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const quiz = await getQuiz(db, actorOf(c), c.req.param('id'))
    return c.json(quiz)
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
    const quiz = await updateQuiz(db, actorOf(c), c.req.param('id'), body)
    return c.json(quiz)
  } catch (error) {
    return handleApiError(c, error)
  }
})

quizzesRoutes.delete('/:id', async (c) => {
  try {
    const db = createDb(c.env.DB)
    await deleteQuiz(db, actorOf(c), c.req.param('id'))
    return c.body(null, 204)
  } catch (error) {
    return handleApiError(c, error)
  }
})

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
    const question = await addQuestion(db, actorOf(c), c.req.param('id'), {
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

const questionUpdateSchema = questionSchema.partial()

quizzesRoutes.patch('/:id/questions/:qid', async (c) => {
  try {
    const body = questionUpdateSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    const question = await updateQuestion(db, actorOf(c), c.req.param('id'), c.req.param('qid'), {
      type: body.type,
      body: body.body,
      choices: body.choices,
      answers: body.answers,
      explanation: body.explanation,
      sortOrder: body.sort_order,
    })
    return c.json(question)
  } catch (error) {
    return handleApiError(c, error)
  }
})

quizzesRoutes.delete('/:id/questions/:qid', async (c) => {
  try {
    const db = createDb(c.env.DB)
    await deleteQuestion(db, actorOf(c), c.req.param('id'), c.req.param('qid'))
    return c.body(null, 204)
  } catch (error) {
    return handleApiError(c, error)
  }
})

const shareSchema = z.object({ target_guild_id: z.string() })

// 公開クイズを指定サーバーに追加する（作成者による押し付けではなく、
// 追加する側の操作として扱う。Botの `/quiz add-public` と同じ経路）
quizzesRoutes.post('/:id/shares', async (c) => {
  try {
    const body = shareSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    const actor = { userId: c.get('userId'), guildId: body.target_guild_id }
    const result = await addPublicQuiz(db, actor, c.req.param('id'))
    return c.json(result, 201)
  } catch (error) {
    return handleApiError(c, error)
  }
})

quizzesRoutes.delete('/:id/shares', async (c) => {
  try {
    const body = shareSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    const actor = { userId: c.get('userId'), guildId: body.target_guild_id }
    await removeAddedQuiz(db, actor, c.req.param('id'))
    return c.body(null, 204)
  } catch (error) {
    return handleApiError(c, error)
  }
})

const editorSchema = z.object({
  target_type: z.enum(['guild', 'user']),
  target_id: z.string(),
})

quizzesRoutes.post('/:id/editors', async (c) => {
  try {
    const body = editorSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    const editor = await addEditor(db, actorOf(c), c.req.param('id'), {
      targetType: body.target_type,
      targetId: body.target_id,
    })
    return c.json(editor, 201)
  } catch (error) {
    return handleApiError(c, error)
  }
})

quizzesRoutes.delete('/:id/editors/:editorId', async (c) => {
  try {
    const db = createDb(c.env.DB)
    await removeEditor(db, actorOf(c), c.req.param('id'), c.req.param('editorId'))
    return c.body(null, 204)
  } catch (error) {
    return handleApiError(c, error)
  }
})

quizzesRoutes.get('/:id/questions/random', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const questionId = c.req.query('question_id')
    const question = await getRandomQuestion(db, actorOf(c), c.req.param('id'), { questionId })
    return c.json(question)
  } catch (error) {
    return handleApiError(c, error)
  }
})

const attemptSchema = z.object({
  guild_id: z.string(),
  user_id: z.string(),
  submitted_answer: z.string(),
})

quizzesRoutes.post('/:id/questions/:qid/attempts', async (c) => {
  try {
    const body = attemptSchema.parse(await c.req.json())
    const db = createDb(c.env.DB)
    const actor = { userId: c.get('userId'), guildId: body.guild_id }
    const result = await submitAttempt(
      db,
      actor,
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
    const stats = await getQuizStats(db, actorOf(c), c.req.param('id'))
    return c.json(stats)
  } catch (error) {
    return handleApiError(c, error)
  }
})
