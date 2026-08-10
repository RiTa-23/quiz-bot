import {
  addEditor,
  addQuestion,
  addShare,
  createDb,
  createQuiz,
  deleteQuiz,
  getRandomQuestion,
  submitAttempt,
} from '@quiz-bot/core'
import type { CommandContext } from 'discord-hono'
import { Command, SubCommand } from 'discord-hono'
import { actorFromContext } from '../actor'
import type { Bindings } from '../env'

// discord-hono のコマンド定義ビルダーAPIは変更されることがあるため、
// 初回 `wrangler dev` 実行時に discord-hono のドキュメントと突き合わせて確認すること。

export const quizCommand = new Command('quiz', 'クイズの作成・出題・管理')
  .options(
    new SubCommand('create', 'クイズを新規作成する')
      .string('title', 'クイズのタイトル', true)
      .string('description', 'クイズの説明'),
    new SubCommand('play', 'クイズを出題する').string('quiz_id', 'クイズID', true),
    new SubCommand('answer', '出題された設問に回答する')
      .string('quiz_id', 'クイズID', true)
      .string('question_id', '設問ID', true)
      .string('answer', '回答内容', true),
    new SubCommand('delete', 'クイズを削除する').string('quiz_id', 'クイズID', true),
    new SubCommand('share', '他サーバーにクイズを共有する')
      .string('quiz_id', 'クイズID', true)
      .string('target_guild_id', '共有先サーバーID', true),
    new SubCommand('add-editor', 'クイズの共同編集者を追加する')
      .string('quiz_id', 'クイズID', true)
      .string('target_type', 'guild または user', true)
      .string('target_id', 'サーバーIDまたはユーザーID', true),
    new SubCommand('add-question', 'クイズに設問を追加する')
      .string('quiz_id', 'クイズID', true)
      .string('type', 'multiple_choice / true_false / free_text', true)
      .string('body', '問題文', true)
      .string('answers', '正解パターン（カンマ区切り）', true)
      .string('choices', '選択肢（カンマ区切り、4択のみ）')
      .string('explanation', '解説'),
  )

export async function handleQuizCommand(c: CommandContext<Bindings>) {
  const sub = c.sub.string
  const db = createDb(c.env.DB)
  const actor = actorFromContext(c)

  switch (c.sub.command) {
    case 'create': {
      const quiz = await createQuiz(db, actor, {
        title: sub('title') ?? '',
        description: sub('description') ?? null,
      })
      return c.res(`クイズを作成しました: **${quiz.title}**\nID: \`${quiz.id}\``)
    }

    case 'play': {
      const quizId = sub('quiz_id') ?? ''
      const question = await getRandomQuestion(db, actor, quizId)
      const choicesText = question.choices ? `\n${question.choices.join(' / ')}` : ''
      return c.res(`**問題**\n${question.body}${choicesText}\n(question_id: \`${question.id}\`)`)
    }

    case 'answer': {
      const quizId = sub('quiz_id') ?? ''
      const questionId = sub('question_id') ?? ''
      const result = await submitAttempt(db, actor, quizId, questionId, sub('answer') ?? '')
      const verdict = result.isCorrect ? '正解です！🎉' : '不正解です。'
      const explanation = result.explanation ? `\n解説: ${result.explanation}` : ''
      return c.res(`${verdict}\n正解: ${result.correctAnswers.join(' / ')}${explanation}`)
    }

    case 'delete': {
      const quizId = sub('quiz_id') ?? ''
      await deleteQuiz(db, actor, quizId)
      return c.res('クイズを削除しました。')
    }

    case 'share': {
      const quizId = sub('quiz_id') ?? ''
      const targetGuildId = sub('target_guild_id') ?? ''
      await addShare(db, actor, quizId, targetGuildId)
      return c.res(`サーバー \`${targetGuildId}\` にクイズを共有しました。`)
    }

    case 'add-editor': {
      const quizId = sub('quiz_id') ?? ''
      const targetType = sub('target_type') === 'guild' ? 'guild' : 'user'
      const targetId = sub('target_id') ?? ''
      await addEditor(db, actor, quizId, { targetType, targetId })
      return c.res('共同編集者を追加しました。')
    }

    case 'add-question': {
      const quizId = sub('quiz_id') ?? ''
      const type = (sub('type') ?? 'free_text') as 'multiple_choice' | 'true_false' | 'free_text'
      const answers = (sub('answers') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      const choicesRaw = sub('choices')
      const choices = choicesRaw
        ? choicesRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : null
      await addQuestion(db, actor, quizId, {
        type,
        body: sub('body') ?? '',
        choices,
        answers,
        explanation: sub('explanation') ?? null,
      })
      return c.res('設問を追加しました。')
    }

    default:
      return c.res('不明なサブコマンドです。')
  }
}
