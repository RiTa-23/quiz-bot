import { AppError } from '@quiz-bot/core'
import { DiscordHono } from 'discord-hono'
import { handleQuizCommand } from './commands/quiz'
import type { Bindings } from './env'
import {
  ANSWER_BUTTON,
  FREETEXT_MODAL,
  FREETEXT_OPEN,
  handleAnswerButton,
  handleFreetextModal,
  handleFreetextOpen,
} from './interactions/answer'

const ERROR_MESSAGES: Record<AppError['code'], string> = {
  UNAUTHORIZED: 'ログインが必要です。',
  FORBIDDEN: 'この操作を行う権限がありません。',
  NOT_FOUND: '対象が見つかりませんでした。',
  CONFLICT: 'この操作は既に実行済みか、競合しています。',
  RATE_LIMITED: 'しばらく時間をおいてから再度お試しください。',
  VALIDATION_ERROR: '入力内容を確認してください。',
}

type AnyContext = {
  ephemeral: () => { res: (m: string) => Response }
  res: (m: string) => Response
}

async function withErrorHandling(
  c: AnyContext,
  handler: () => Promise<Response> | Response,
  ephemeral: boolean,
): Promise<Response> {
  try {
    return await handler()
  } catch (error) {
    if (error instanceof AppError) {
      const message = ERROR_MESSAGES[error.code] ?? error.message
      return ephemeral ? c.ephemeral().res(message) : c.res(message)
    }
    throw error
  }
}

const app = new DiscordHono<{ Bindings: Bindings }>()

app.command('quiz', (c) => withErrorHandling(c, () => handleQuizCommand(c), false))

app.component(ANSWER_BUTTON, (c) => withErrorHandling(c, () => handleAnswerButton(c), true))
app.component(FREETEXT_OPEN, (c) => withErrorHandling(c, () => handleFreetextOpen(c), true))
app.modal(FREETEXT_MODAL, (c) => withErrorHandling(c, () => handleFreetextModal(c), true))

export default app
