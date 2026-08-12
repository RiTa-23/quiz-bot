import type { Actor } from '@quiz-bot/core'
import { forbidden } from '@quiz-bot/core'
import type { Context } from 'hono'
import type { Bindings, Variables } from './env'

type Ctx = Context<{ Bindings: Bindings; Variables: Variables }>

/** guildId=null は「サーバーに紐づかない管理操作（作成者本人としての判定）」を意味する。 */
export function actorForGuild(c: Ctx, guildId: string | null | undefined): Actor {
  const userId = c.get('userId')
  if (guildId === null || guildId === undefined || guildId === '') {
    return { userId, guildId: null }
  }
  const guilds = c.get('guilds')
  if (!guilds.some((g) => g.id === guildId)) {
    throw forbidden('指定されたサーバーのメンバーではありません')
  }
  return { userId, guildId }
}

export function actorFromQuery(c: Ctx): Actor {
  return actorForGuild(c, c.req.query('guild_id') ?? null)
}
