import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { SESSION_COOKIE, resolveSession } from '../auth'
import type { Bindings, Variables } from '../env'

export const requireAuth = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const sessionId = getCookie(c, SESSION_COOKIE)
    const session = await resolveSession(c.env, sessionId)
    if (!session) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'ログインが必要です' } }, 401)
    }
    c.set('userId', session.userId)
    c.set('guilds', session.guilds)
    await next()
  },
)
