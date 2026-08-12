import type { Actor } from '@quiz-bot/core'
import { forbidden } from '@quiz-bot/core'
import type { Context } from 'hono'
import type { Bindings, Variables } from './env'

type Ctx = Context<{ Bindings: Bindings; Variables: Variables }>

/**
 * クライアントが渡した guild_id が、ログインユーザーの所属サーバーに含まれるか検証する。
 * 含まれない guild_id を権限判定の Actor に使わせない（Issue #4）。
 * guildId を渡さない場合は guildId=null の Actor を返す（作成者本人としての管理操作用）。
 */
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

/** クエリ文字列 `guild_id` から検証済み Actor を作る。 */
export function actorFromQuery(c: Ctx): Actor {
  return actorForGuild(c, c.req.query('guild_id') ?? null)
}
