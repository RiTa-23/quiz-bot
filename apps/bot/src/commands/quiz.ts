import { addEditor, addQuestion, addShare, createDb, createQuiz, deleteQuiz } from '@quiz-bot/core'
import type { CommandContext } from 'discord-hono'
import { actorFromInteraction } from '../actor'
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
      return c.res(`クイズを作成しました: **${quiz.title}**\nID: \`${quiz.id}\``)
    }

    case 'play':
      return handleQuizPlay(c)

    case 'delete': {
      await deleteQuiz(db, actor, v.quiz_id ?? '')
      return c.res('クイズを削除しました。')
    }

    case 'share': {
      await addShare(db, actor, v.quiz_id ?? '', v.target_guild_id ?? '')
      return c.res(`サーバー \`${v.target_guild_id}\` にクイズを共有しました。`)
    }

    case 'add-editor': {
      const targetType = v.target_type === 'guild' ? 'guild' : 'user'
      await addEditor(db, actor, v.quiz_id ?? '', { targetType, targetId: v.target_id ?? '' })
      return c.res('共同編集者を追加しました。')
    }

    case 'add-question': {
      const type = (v.type ?? 'free_text') as 'multiple_choice' | 'true_false' | 'free_text'
      const answers = (v.answers ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const choices = v.choices
        ? v.choices
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : null
      await addQuestion(db, actor, v.quiz_id ?? '', {
        type,
        body: v.body ?? '',
        choices,
        answers,
        explanation: v.explanation ?? null,
      })
      return c.res('設問を追加しました。')
    }

    default:
      return c.res('不明なサブコマンドです。')
  }
}
