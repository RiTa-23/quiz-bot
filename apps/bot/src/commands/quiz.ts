import { createDb, createQuiz } from '@quiz-bot/core'
import type { CommandContext } from 'discord-hono'
import { actorFromInteraction } from '../actor'
import { handleDeleteCommand } from '../authoring/deleteHandlers'
import { handleAddQuestionCommand } from '../authoring/handlers'
import type { Bindings } from '../env'
import { handleQuizPlay } from '../session/handlers'
import { handleEditorsCommand } from '../sharing/editorHandlers'
import {
  handleAddPublicCommand,
  handleRemovePublicCommand,
  handleVisibilityCommand,
} from '../sharing/handlers'
import {
  handleMyStatsCommand,
  handleRankingCommand,
  handleStatsCommand,
} from '../stats/statsHandlers'

export async function handleQuizCommand(c: CommandContext<{ Bindings: Bindings }>) {
  const v = c.var as Record<string, string | undefined>
  const db = createDb(c.env.DB)
  const actor = actorFromInteraction(c.interaction)

  switch (c.sub.command) {
    case 'create': {
      const quiz = await createQuiz(db, actor, {
        title: v.title ?? '',
        description: v.description ?? null,
      })
      const lines = [`クイズを作成しました: **${quiz.title}**`]
      if (quiz.description) lines.push(`> ${quiz.description}`)
      lines.push('`/quiz add-question` で設問を追加できます。')
      return c.res(lines.join('\n'))
    }

    case 'play':
      return handleQuizPlay(c)

    case 'delete':
      return handleDeleteCommand(c)

    case 'visibility':
      return handleVisibilityCommand(c)

    case 'add-public':
      return handleAddPublicCommand(c)

    case 'remove-public':
      return handleRemovePublicCommand(c)

    case 'editors':
      return handleEditorsCommand(c)

    case 'add-question':
      return handleAddQuestionCommand(c)

    case 'stats':
      return handleStatsCommand(c)

    case 'my-stats':
      return handleMyStatsCommand(c)

    case 'ranking':
      return handleRankingCommand(c)

    default:
      return c.res('不明なサブコマンドです。')
  }
}
