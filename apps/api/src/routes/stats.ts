import { createDb, getBuzzRanking, getGuildRanking, getMemberStats } from '@quiz-bot/core'
import { Hono } from 'hono'
import { actorForGuild } from '../actor'
import type { Bindings, Variables } from '../env'
import { handleApiError } from '../errorHandler'
import { requireAuth } from '../middleware/requireAuth'

export const statsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

statsRoutes.use('*', requireAuth)

/** サーバー内の1人モード正答率ランキング。所属サーバーのみ閲覧可。 */
statsRoutes.get('/guilds/:guildId/stats/ranking', async (c) => {
  try {
    const guildId = c.req.param('guildId')
    actorForGuild(c, guildId) // 所属検証（未所属は403）
    const db = createDb(c.env.DB)
    const quizId = c.req.query('quiz_id')
    const period = c.req.query('period') as 'all' | 'week' | 'month' | undefined
    const ranking = await getGuildRanking(db, guildId, { quizId, period })
    return c.json(ranking)
  } catch (error) {
    return handleApiError(c, error)
  }
})

/** サーバー内の早押し獲得数ランキング。所属サーバーのみ閲覧可。 */
statsRoutes.get('/guilds/:guildId/stats/buzz-ranking', async (c) => {
  try {
    const guildId = c.req.param('guildId')
    actorForGuild(c, guildId)
    const db = createDb(c.env.DB)
    const quizId = c.req.query('quiz_id')
    const period = c.req.query('period') as 'all' | 'week' | 'month' | undefined
    const ranking = await getBuzzRanking(db, guildId, { quizId, period })
    return c.json(ranking)
  } catch (error) {
    return handleApiError(c, error)
  }
})

/** ログインユーザーの、そのサーバーでの成績（1人モード＋早押し）。 */
statsRoutes.get('/guilds/:guildId/me/stats', async (c) => {
  try {
    const actor = actorForGuild(c, c.req.param('guildId'))
    const db = createDb(c.env.DB)
    const stats = await getMemberStats(db, actor)
    return c.json(stats)
  } catch (error) {
    return handleApiError(c, error)
  }
})
