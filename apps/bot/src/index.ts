import { AppError } from '@quiz-bot/core'
import { DiscordHono } from 'discord-hono'
import { handleQuizCommand } from './commands/quiz'
import type { Bindings } from './env'

const ERROR_MESSAGES: Record<AppError['code'], string> = {
  UNAUTHORIZED: 'ログインが必要です。',
  FORBIDDEN: 'この操作を行う権限がありません。',
  NOT_FOUND: '対象が見つかりませんでした。',
  CONFLICT: 'この操作は既に実行済みか、競合しています。',
  RATE_LIMITED: 'しばらく時間をおいてから再度お試しください。',
  VALIDATION_ERROR: '入力内容を確認してください。',
}

const app = new DiscordHono<{ Bindings: Bindings }>()

app.command('quiz', async (c) => {
  try {
    return await handleQuizCommand(c)
  } catch (error) {
    if (error instanceof AppError) {
      return c.res(ERROR_MESSAGES[error.code] ?? error.message)
    }
    throw error
  }
})

export default app
