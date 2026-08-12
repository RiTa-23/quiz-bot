import {
  createDb,
  getBuzzRanking,
  getGuildRanking,
  getMemberStats,
  getQuizStats,
  listPlayableQuizzes,
} from '@quiz-bot/core'
import type { CommandContext, ComponentContext } from 'discord-hono'
import { actorFromInteraction } from '../actor'
import type { Bindings } from '../env'
import {
  NO_PING,
  QS_PAGE_NEXT,
  RANKING_LIMIT,
  type StatsPanelState,
  buildMemberStatsMessage,
  buildQuizStatsMessage,
  buildRankingMessage,
  buildStatsPanel,
} from './statsMessages'

const GUILD_ONLY = 'この操作はサーバー内で実行してください。'

function selectValue(c: ComponentContext<{ Bindings: Bindings }>): string {
  return (c.interaction.data as { values?: string[] }).values?.[0] ?? ''
}

/** ページングボタンの custom_id から状態（page:invokerId）を復元する。 */
function readState(c: ComponentContext<{ Bindings: Bindings }>): StatsPanelState {
  const rows = (c.interaction.message?.components ?? []) as {
    components: { custom_id?: string }[]
  }[]
  for (const row of rows) {
    for (const comp of row.components) {
      if (comp.custom_id?.startsWith(`${QS_PAGE_NEXT};`)) {
        const [page, invokerId] = comp.custom_id.slice(QS_PAGE_NEXT.length + 1).split(':')
        return { page: Number(page ?? '0') || 0, invokerId: invokerId ?? '' }
      }
    }
  }
  return { page: 0, invokerId: '' }
}

/** /quiz stats: クイズ選択パネルを公開で開く。 */
export async function handleStatsCommand(c: CommandContext<{ Bindings: Bindings }>) {
  const actor = actorFromInteraction(c.interaction)
  if (!actor.guildId) return c.ephemeral().res(GUILD_ONLY)

  const db = createDb(c.env.DB)
  const quizzes = await listPlayableQuizzes(db, actor)
  if (quizzes.length === 0) {
    return c.ephemeral().res('統計を表示できるクイズがありません。')
  }
  return c.res(buildStatsPanel(quizzes, { page: 0, invokerId: actor.userId }))
}

/**
 * クイズを選択 → 統計を新しい公開メッセージとして投稿する（パネルは残す）。
 * 公開メッセージなので誰でも操作できるが、権限チェックは常に
 * 「押した本人」の Actor で getQuizStats 内部に行わせる。
 */
export async function handleQsSelect(c: ComponentContext<{ Bindings: Bindings }>) {
  const actor = actorFromInteraction(c.interaction)
  if (!actor.guildId) return c.ephemeral().res(GUILD_ONLY)

  const db = createDb(c.env.DB)
  const stats = await getQuizStats(db, actor, selectValue(c), { guildId: actor.guildId })
  return c.res({ content: buildQuizStatsMessage(stats), ...NO_PING })
}

/** ページ送りは共有メッセージを書き換えるため、実行者本人のみに制限する。 */
async function changePage(c: ComponentContext<{ Bindings: Bindings }>, delta: number) {
  const actor = actorFromInteraction(c.interaction)
  const state = readState(c)
  if (state.invokerId && actor.userId !== state.invokerId) {
    return c
      .ephemeral()
      .res('ページ送りはコマンド実行者のみ操作できます。プルダウンの選択は誰でも可能です。')
  }
  const db = createDb(c.env.DB)
  const quizzes = await listPlayableQuizzes(db, actor)
  return c.resUpdate(
    buildStatsPanel(quizzes, { page: state.page + delta, invokerId: state.invokerId }),
  )
}

export const handleQsPagePrev = (c: ComponentContext<{ Bindings: Bindings }>) => changePage(c, -1)
export const handleQsPageNext = (c: ComponentContext<{ Bindings: Bindings }>) => changePage(c, 1)

/** /quiz my-stats: 実行者本人のこのサーバーでの成績。 */
export async function handleMyStatsCommand(c: CommandContext<{ Bindings: Bindings }>) {
  const actor = actorFromInteraction(c.interaction)
  if (!actor.guildId) return c.ephemeral().res(GUILD_ONLY)

  const db = createDb(c.env.DB)
  const stats = await getMemberStats(db, actor)
  return c.res({ content: buildMemberStatsMessage(stats), ...NO_PING })
}

/** /quiz ranking: サーバー内のソロ・早押しランキング。 */
export async function handleRankingCommand(c: CommandContext<{ Bindings: Bindings }>) {
  const actor = actorFromInteraction(c.interaction)
  if (!actor.guildId) return c.ephemeral().res(GUILD_ONLY)

  const db = createDb(c.env.DB)
  const [solo, buzz] = await Promise.all([
    getGuildRanking(db, actor.guildId, { limit: RANKING_LIMIT }),
    getBuzzRanking(db, actor.guildId, { limit: RANKING_LIMIT }),
  ])
  return c.res({ content: buildRankingMessage(solo, buzz), ...NO_PING })
}
