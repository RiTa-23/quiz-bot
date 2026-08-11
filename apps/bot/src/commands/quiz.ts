import { addEditor, addShare, createDb, createQuiz } from '@quiz-bot/core'
import type { CommandContext } from 'discord-hono'
import { actorFromInteraction } from '../actor'
import { handleDeleteCommand } from '../authoring/deleteHandlers'
import { handleAddQuestionCommand } from '../authoring/handlers'
import type { Bindings } from '../env'
import { handleQuizPlay } from '../session/handlers'

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

    case 'share': {
      await addShare(db, actor, v.quiz_id ?? '', v.target_guild_id ?? '')
      return c.res(`サーバー \`${v.target_guild_id}\` にクイズを共有しました。`)
    }

    case 'add-editor': {
      const targetType = v.target_type === 'guild' ? 'guild' : 'user'
      await addEditor(db, actor, v.quiz_id ?? '', { targetType, targetId: v.target_id ?? '' })
      return c.res('共同編集者を追加しました。')
    }

    case 'add-question':
      return handleAddQuestionCommand(c)

    default:
      return c.res('不明なサブコマンドです。')
  }
}
