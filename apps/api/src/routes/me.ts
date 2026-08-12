import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { SESSION_COOKIE, resolveSession } from '../auth'
import type { Bindings, Variables } from '../env'

export const meRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** ログイン状態と、操作対象に選べるサーバー一覧を返す。未ログインは 401。 */
meRoutes.get('/me', async (c) => {
  const session = await resolveSession(c.env, getCookie(c, SESSION_COOKIE))
  if (!session) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'ログインが必要です' } }, 401)
  }
  return c.json({
    userId: session.userId,
    username: session.username,
    guilds: session.guilds,
  })
})
