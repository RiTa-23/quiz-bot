import { AppError } from '@quiz-bot/core'
import { DiscordHono } from 'discord-hono'
import { handleQuizCommand, quizCommand } from './commands/quiz'
import type { Bindings } from './env'

const ERROR_MESSAGES: Record<AppError['code'], string> = {
  UNAUTHORIZED: 'ログインが必要です。',
  FORBIDDEN: 'この操作を行う権限がありません。',
  NOT_FOUND: '対象が見つかりませんでした。',
  CONFLICT: 'この操作は既に実行済みか、競合しています。',
  RATE_LIMITED: 'しばらく時間をおいてから再度お試しください。',
  VALIDATION_ERROR: '入力内容を確認してください。',
}

async function safeHandle(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler()
  } catch (error) {
    if (error instanceof AppError) {
      return new Response(ERROR_MESSAGES[error.code] ?? error.message, { status: 200 })
    }
    throw error
  }
}

const app = new DiscordHono<{ Bindings: Bindings }>()

app.command(quizCommand, (c) => safeHandle(() => handleQuizCommand(c)))

export default app
