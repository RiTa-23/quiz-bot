import type { Actor } from '@quiz-bot/core'

type InteractionLike = {
  member?: { user?: { id: string } } | null
  user?: { id: string } | null
  guild_id?: string | null
}

/**
 * Discord Interaction（コマンド/コンポーネント/モーダル共通）から Actor を構築する。
 * packages/core は認証方式を知らずこの Actor だけを受け取る（アーキテクチャ.md参照）。
 */
export function actorFromInteraction(interaction: InteractionLike): Actor {
  const userId = interaction.member?.user?.id ?? interaction.user?.id
  if (!userId) {
    throw new Error('Discord Interactionからuser_idを取得できませんでした')
  }
  return {
    userId,
    guildId: interaction.guild_id ?? null,
  }
}
