import {
  createDb,
  getBuzzRanking,
  getGuildRanking,
  getMemberStats,
  validationError,
} from '@quiz-bot/core'
import { Hono } from 'hono'
import { actorForGuild } from '../actor'
import type { Bindings, Variables } from '../env'
import { handleApiError } from '../errorHandler'
import { requireAuth } from '../middleware/requireAuth'

export const statsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

statsRoutes.use('*', requireAuth)

const PERIODS = ['all', 'week', 'month'] as const
type Period = (typeof PERIODS)[number]

const MAX_RANKING_LIMIT = 100

function parsePeriod(raw: string | undefined): Period | undefined {
  if (raw === undefined) return undefined
  if (!(PERIODS as readonly string[]).includes(raw)) {
    throw validationError('period は all / week / month のいずれかを指定してください')
  }
  return raw as Period
}

function parseLimit(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) {
    throw validationError('limit は1以上の数値を指定してください')
  }
  return Math.min(Math.floor(n), MAX_RANKING_LIMIT)
}

statsRoutes.get('/guilds/:guildId/stats/ranking', async (c) => {
  try {
    const guildId = c.req.param('guildId')
    actorForGuild(c, guildId)
    const db = createDb(c.env.DB)
    const ranking = await getGuildRanking(db, guildId, {
      quizId: c.req.query('quiz_id'),
      period: parsePeriod(c.req.query('period')),
      limit: parseLimit(c.req.query('limit')),
    })
    return c.json(ranking)
  } catch (error) {
    return handleApiError(c, error)
  }
})

statsRoutes.get('/guilds/:guildId/stats/buzz-ranking', async (c) => {
  try {
    const guildId = c.req.param('guildId')
    actorForGuild(c, guildId)
    const db = createDb(c.env.DB)
    const ranking = await getBuzzRanking(db, guildId, {
      quizId: c.req.query('quiz_id'),
      period: parsePeriod(c.req.query('period')),
      limit: parseLimit(c.req.query('limit')),
    })
    return c.json(ranking)
  } catch (error) {
    return handleApiError(c, error)
  }
})

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
