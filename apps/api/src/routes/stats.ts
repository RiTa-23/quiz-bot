import { createDb, getGuildRanking, getUserStats } from '@quiz-bot/core'
import { Hono } from 'hono'
import { handleApiError } from '../errorHandler'
import type { Bindings, Variables } from '../env'
import { requireAuth } from '../middleware/requireAuth'

export const statsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

statsRoutes.use('*', requireAuth)

statsRoutes.get('/guilds/:guildId/stats/ranking', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const quizId = c.req.query('quiz_id')
    const period = c.req.query('period') as 'all' | 'week' | 'month' | undefined
    const ranking = await getGuildRanking(db, c.req.param('guildId'), { quizId, period })
    return c.json(ranking)
  } catch (error) {
    return handleApiError(c, error)
  }
})

statsRoutes.get('/users/:userId/stats', async (c) => {
  try {
    if (c.req.param('userId') !== c.get('userId')) {
      return c.json({ error: { code: 'FORBIDDEN', message: '本人以外の統計は閲覧できません' } }, 403)
    }
    const db = createDb(c.env.DB)
    const stats = await getUserStats(db, c.req.param('userId'))
    return c.json(stats)
  } catch (error) {
    return handleApiError(c, error)
  }
})
