import { AppError } from '@quiz-bot/core'
import { DiscordHono } from 'discord-hono'
import {
  handleDqCancel,
  handleDqConfirm,
  handleDqExecute,
  handleDqPageNext,
  handleDqPagePrev,
  handleDqSelect,
} from './authoring/deleteHandlers'
import {
  DQ_CANCEL,
  DQ_CONFIRM,
  DQ_EXECUTE,
  DQ_PAGE_NEXT,
  DQ_PAGE_PREV,
  DQ_SELECT,
} from './authoring/deleteMessages'
import {
  handleAqModal,
  handleAqOpen,
  handleAqPageNext,
  handleAqPagePrev,
  handleAqQuizSelect,
  handleAqTfBatsu,
  handleAqTfMaru,
  handleAqTypeSelect,
} from './authoring/handlers'
import {
  AQ_MODAL,
  AQ_OPEN,
  AQ_PAGE_NEXT,
  AQ_PAGE_PREV,
  AQ_QUIZ_SELECT,
  AQ_TF_BATSU,
  AQ_TF_MARU,
  AQ_TYPE_SELECT,
} from './authoring/messages'
import { handleQuizCommand } from './commands/quiz'
import type { Bindings } from './env'
import {
  handleCountSelect,
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
  CFG_COUNT_SELECT,
  CFG_MODE_TOGGLE,
  CFG_PAGE_NEXT,
  CFG_PAGE_PREV,
  CFG_PLAY,
  CFG_QUIZ_SELECT,
  SESSION_ANSWER,
  SESSION_FT_MODAL,
  SESSION_FT_OPEN,
} from './session/messages'

import { handleQsPageNext, handleQsPagePrev, handleQsSelect } from './stats/statsHandlers'
import { QS_PAGE_NEXT, QS_PAGE_PREV, QS_SELECT } from './stats/statsMessages'

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
app.component(CFG_COUNT_SELECT, (c) => guard(c, () => handleCountSelect(c), true))
app.component(CFG_PLAY, (c) => guard(c, () => handlePlay(c), true))

// セッション回答
app.component(SESSION_ANSWER, (c) => guard(c, () => handleSessionAnswer(c), true))
app.component(SESSION_FT_OPEN, (c) => guard(c, () => handleSessionFtOpen(c), true))
app.modal(SESSION_FT_MODAL, (c) => guard(c, () => handleSessionFtModal(c), true))

// 設問作成GUI
app.component(AQ_QUIZ_SELECT, (c) => guard(c, () => handleAqQuizSelect(c), true))
app.component(AQ_TYPE_SELECT, (c) => guard(c, () => handleAqTypeSelect(c), true))
app.component(AQ_PAGE_PREV, (c) => guard(c, () => handleAqPagePrev(c), true))
app.component(AQ_PAGE_NEXT, (c) => guard(c, () => handleAqPageNext(c), true))
app.component(AQ_TF_MARU, (c) => guard(c, () => handleAqTfMaru(c), true))
app.component(AQ_TF_BATSU, (c) => guard(c, () => handleAqTfBatsu(c), true))
app.component(AQ_OPEN, (c) => guard(c, () => handleAqOpen(c), true))
app.modal(AQ_MODAL, (c) => guard(c, () => handleAqModal(c), true))

// クイズ削除GUI
app.component(DQ_SELECT, (c) => guard(c, () => handleDqSelect(c), true))
app.component(DQ_PAGE_PREV, (c) => guard(c, () => handleDqPagePrev(c), true))
app.component(DQ_PAGE_NEXT, (c) => guard(c, () => handleDqPageNext(c), true))
app.component(DQ_CONFIRM, (c) => guard(c, () => handleDqConfirm(c), true))
app.component(DQ_EXECUTE, (c) => guard(c, () => handleDqExecute(c), true))
app.component(DQ_CANCEL, (c) => guard(c, () => handleDqCancel(c), true))

// 統計GUI
app.component(QS_SELECT, (c) => guard(c, () => handleQsSelect(c), true))
app.component(QS_PAGE_PREV, (c) => guard(c, () => handleQsPagePrev(c), true))
app.component(QS_PAGE_NEXT, (c) => guard(c, () => handleQsPageNext(c), true))

export default app
