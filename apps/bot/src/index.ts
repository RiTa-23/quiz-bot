import { AppError } from '@quiz-bot/core'
import { DiscordHono } from 'discord-hono'
import { handleQuizCommand } from './commands/quiz'
import type { Bindings } from './env'
import {
  handleCountModal,
  handleCountOpen,
  handleModeToggle,
  handlePageNext,
  handlePagePrev,
  handlePlay,
  handleQuizSelect,
  handleSessionAnswer,
  handleSessionFtModal,
  handleSessionFtOpen,
} from './session/handlers'
import {
  CFG_COUNT_MODAL,
  CFG_COUNT_OPEN,
  CFG_MODE_TOGGLE,
  CFG_PAGE_NEXT,
  CFG_PAGE_PREV,
  CFG_PLAY,
  CFG_QUIZ_SELECT,
  SESSION_ANSWER,
  SESSION_FT_MODAL,
  SESSION_FT_OPEN,
} from './session/messages'

export { QuizSession } from './session/QuizSession'

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

async function guard(
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

app.command('quiz', (c) => guard(c, () => handleQuizCommand(c), false))

// 出題設定GUI
app.component(CFG_QUIZ_SELECT, (c) => guard(c, () => handleQuizSelect(c), true))
app.component(CFG_PAGE_PREV, (c) => guard(c, () => handlePagePrev(c), true))
app.component(CFG_PAGE_NEXT, (c) => guard(c, () => handlePageNext(c), true))
app.component(CFG_MODE_TOGGLE, (c) => guard(c, () => handleModeToggle(c), true))
app.component(CFG_COUNT_OPEN, (c) => guard(c, () => handleCountOpen(c), true))
app.modal(CFG_COUNT_MODAL, (c) => guard(c, () => handleCountModal(c), true))
app.component(CFG_PLAY, (c) => guard(c, () => handlePlay(c), true))

// セッション回答
app.component(SESSION_ANSWER, (c) => guard(c, () => handleSessionAnswer(c), true))
app.component(SESSION_FT_OPEN, (c) => guard(c, () => handleSessionFtOpen(c), true))
app.modal(SESSION_FT_MODAL, (c) => guard(c, () => handleSessionFtModal(c), true))

export default app
