import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { SESSION_COOKIE, resolveSession } from '../auth'
import { fetchBotGuildIds } from '../botGuilds'
import type { Bindings, Variables } from '../env'

export const meRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * ログイン状態と、操作対象に選べるサーバー一覧を返す。未ログインは 401。
 * 一覧は Bot が導入済みのサーバーのみ（未導入のサーバーを選んでも何も操作できないため）。
 */
meRoutes.get('/me', async (c) => {
  const session = await resolveSession(c.env, getCookie(c, SESSION_COOKIE))
  if (!session) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'ログインが必要です' } }, 401)
  }

  const botGuildIds = await fetchBotGuildIds(c.env)
  const guilds = botGuildIds ? session.guilds.filter((g) => botGuildIds.has(g.id)) : session.guilds

  return c.json({
    userId: session.userId,
    username: session.username,
    guilds,
  })
})
