import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { SESSION_COOKIE, resolveUserId } from '../auth'
import type { Bindings, Variables } from '../env'

export const requireAuth = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const sessionId = getCookie(c, SESSION_COOKIE)
    const userId = await resolveUserId(c.env, sessionId)
    if (!userId) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'ログインが必要です' } }, 401)
    }
    c.set('userId', userId)
    await next()
  },
)
