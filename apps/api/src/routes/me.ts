import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { SESSION_COOKIE, resolveSession } from '../auth'
import { fetchBotGuildIds } from '../botGuilds'
import type { Bindings, Variables } from '../env'

export const meRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// View Channel + Send Messages。Botは出題メッセージを PATCH で更新するためチャンネル閲覧が必須。
const BOT_PERMISSIONS = '3072'

function buildBotInstallUrl(clientId: string): string {
  const url = new URL('https://discord.com/oauth2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('scope', 'bot applications.commands')
  url.searchParams.set('permissions', BOT_PERMISSIONS)
  return url.toString()
}

/** 一覧は Bot 導入済みに絞る。未導入のサーバーを選んでも出題・記録ができないため。 */
meRoutes.get('/me', async (c) => {
  const session = await resolveSession(c.env, getCookie(c, SESSION_COOKIE))
  if (!session) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'ログインが必要です' } }, 401)
  }

  const forceRefresh = c.req.query('refresh') === '1'
  const botGuildIds = await fetchBotGuildIds(c.env, { forceRefresh })
  const guilds = botGuildIds ? session.guilds.filter((g) => botGuildIds.has(g.id)) : session.guilds

  return c.json({
    userId: session.userId,
    username: session.username,
    guilds,
    botInstallUrl: buildBotInstallUrl(c.env.DISCORD_CLIENT_ID),
  })
})
