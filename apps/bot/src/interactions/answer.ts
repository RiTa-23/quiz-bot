import { type PublicQuestion, createDb, getPlayQuestion, submitAttempt } from '@quiz-bot/core'
import { Button, Components, Modal, TextInput } from 'discord-hono'
import type { ComponentContext, ModalContext } from 'discord-hono'
import { actorFromInteraction } from '../actor'
import type { Bindings } from '../env'

// custom_id のデータ部は区切りに ';' を使えないため ':' で quizId:questionId(:idx) を連結する。
// UUID には ':' が含まれないので安全。
const DELIM = ':'

// component / modal の各ハンドラキー（custom_id の先頭 ';' より前）
export const ANSWER_BUTTON = 'ans' // 4択・○×のボタン回答
export const FREETEXT_OPEN = 'ftq' // 自由記述: モーダルを開くボタン
export const FREETEXT_MODAL = 'fta' // 自由記述: モーダル送信
const TEXT_INPUT_ID = 'answer'

const TRUE_FALSE_CHOICES = ['○', '×']

/** 出題メッセージ（問題文 + 回答用コンポーネント）を組み立てる。 */
export function buildQuestionMessage(q: PublicQuestion) {
  const components = new Components()

  if (q.type === 'multiple_choice' && q.choices) {
    components.row(
      ...q.choices.map((choice, i) =>
        new Button(ANSWER_BUTTON, choice.slice(0, 80), 'Secondary').custom_id(
          `${q.quizId}${DELIM}${q.id}${DELIM}${i}`,
        ),
      ),
    )
  } else if (q.type === 'true_false') {
    components.row(
      new Button(ANSWER_BUTTON, '⭕ ○', 'Success').custom_id(`${q.quizId}${DELIM}${q.id}${DELIM}0`),
      new Button(ANSWER_BUTTON, '❌ ×', 'Danger').custom_id(`${q.quizId}${DELIM}${q.id}${DELIM}1`),
    )
  } else {
    components.row(
      new Button(FREETEXT_OPEN, '✍️ 回答する', 'Primary').custom_id(`${q.quizId}${DELIM}${q.id}`),
    )
  }

  return { content: `**問題**\n${q.body}`, components }
}

function formatResult(isCorrect: boolean, correctAnswers: string[], explanation: string | null) {
  const verdict = isCorrect ? '正解です！🎉' : '不正解です。'
  const exp = explanation ? `\n解説: ${explanation}` : ''
  return `${verdict}\n正解: ${correctAnswers.join(' / ')}${exp}`
}

/** 4択・○×ボタンの回答ハンドラ。 */
export async function handleAnswerButton(c: ComponentContext<{ Bindings: Bindings }>) {
  const [quizId, questionId, idxStr] = (c.var.custom_id ?? '').split(DELIM)
  const db = createDb(c.env.DB)
  const actor = actorFromInteraction(c.interaction)

  const question = await getPlayQuestion(db, actor, quizId ?? '', questionId ?? '')
  const idx = Number(idxStr)
  const submitted =
    question.type === 'true_false'
      ? (TRUE_FALSE_CHOICES[idx] ?? '')
      : (question.choices?.[idx] ?? '')

  const result = await submitAttempt(db, actor, quizId ?? '', questionId ?? '', submitted)
  return c
    .ephemeral()
    .res(formatResult(result.isCorrect, result.correctAnswers, result.explanation))
}

/** 自由記述「回答する」ボタン → モーダルを開く。 */
export function handleFreetextOpen(c: ComponentContext<{ Bindings: Bindings }>) {
  const data = c.var.custom_id ?? ''
  return c.resModal(
    new Modal(FREETEXT_MODAL, '回答を入力')
      .custom_id(data)
      .row(new TextInput(TEXT_INPUT_ID, '回答', 'Single').required()),
  )
}

/** 自由記述モーダルの送信ハンドラ。 */
export async function handleFreetextModal(c: ModalContext<{ Bindings: Bindings }>) {
  const [quizId, questionId] = (c.var.custom_id ?? '').split(DELIM)
  const submitted = (c.var as Record<string, string | undefined>)[TEXT_INPUT_ID] ?? ''
  const db = createDb(c.env.DB)
  const actor = actorFromInteraction(c.interaction)

  const result = await submitAttempt(db, actor, quizId ?? '', questionId ?? '', submitted)
  return c
    .ephemeral()
    .res(formatResult(result.isCorrect, result.correctAnswers, result.explanation))
}
