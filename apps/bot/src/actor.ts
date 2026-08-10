import type { Actor } from '@quiz-bot/core'
import type { CommandContext } from 'discord-hono'

/**
 * Discord Interactionから Actor（user_id, guild_id）を構築する。
 * packages/core は認証方式を知らずこの Actor だけを受け取る（アーキテクチャ.md参照）。
 */
export function actorFromContext(c: CommandContext): Actor {
  const userId = c.interaction.member?.user?.id ?? c.interaction.user?.id
  if (!userId) {
    throw new Error('Discord Interactionからuser_idを取得できませんでした')
  }
  return {
    userId,
    guildId: c.interaction.guild_id ?? null,
  }
}
