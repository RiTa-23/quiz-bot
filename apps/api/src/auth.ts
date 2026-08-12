import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Bindings, Variables } from './env'

const SESSION_COOKIE = 'session_id'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30日

export type SessionGuild = { id: string; name: string }
type SessionData = { userId: string; username: string; guilds: SessionGuild[] }

const DISCORD_API = 'https://discord.com/api/v10'

export const authRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

authRoutes.get('/discord', (c) => {
  const state = crypto.randomUUID()
  const url = new URL('https://discord.com/oauth2/authorize')
  url.searchParams.set('client_id', c.env.DISCORD_CLIENT_ID)
  url.searchParams.set('redirect_uri', c.env.DISCORD_OAUTH_REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'identify guilds')
  url.searchParams.set('state', state)

  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 600,
  })
  return c.redirect(url.toString())
})

authRoutes.get('/discord/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const savedState = getCookie(c, 'oauth_state')

  if (!code || !state || state !== savedState) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'invalid oauth state' } }, 400)
  }

  const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.env.DISCORD_CLIENT_ID,
      client_secret: c.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: c.env.DISCORD_OAUTH_REDIRECT_URI,
    }),
  })
  if (!tokenRes.ok) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'discord oauth failed' } }, 401)
  }
  const token = (await tokenRes.json()) as { access_token: string }

  const userRes = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  if (!userRes.ok) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'failed to fetch discord user' } }, 401)
  }
  const user = (await userRes.json()) as { id: string; username: string }

  // ユーザーが所属するサーバー一覧を取得してセッションに保存する。
  // 以降のAPIは、リクエストで渡された guild_id がこの一覧に含まれるかを検証する（Issue #4）。
  const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  const guilds: SessionGuild[] = guildsRes.ok
    ? ((await guildsRes.json()) as { id: string; name: string }[]).map((g) => ({
        id: g.id,
        name: g.name,
      }))
    : []

  const sessionId = crypto.randomUUID()
  const session: SessionData = { userId: user.id, username: user.username, guilds }
  await c.env.SESSIONS.put(`session:${sessionId}`, JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS,
  })

  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_TTL_SECONDS,
  })
  deleteCookie(c, 'oauth_state')

  return c.redirect(c.env.WEB_ORIGIN)
})

authRoutes.post('/logout', async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE)
  if (sessionId) {
    await c.env.SESSIONS.delete(`session:${sessionId}`)
    deleteCookie(c, SESSION_COOKIE)
  }
  return c.json({ ok: true })
})

export type Session = { userId: string; username: string; guilds: SessionGuild[] }

/** Cookieのsession_idからセッションを解決する。未ログインならnull。 */
export async function resolveSession(
  env: Bindings,
  sessionId: string | undefined,
): Promise<Session | null> {
  if (!sessionId) return null
  const raw = await env.SESSIONS.get(`session:${sessionId}`)
  if (!raw) return null
  const s = JSON.parse(raw) as SessionData
  // 旧セッション（guilds未保存）でも落ちないようにする
  return { userId: s.userId, username: s.username, guilds: s.guilds ?? [] }
}

export { SESSION_COOKIE }
