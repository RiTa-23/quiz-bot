import { type QuestionType, addQuestion, createDb, listEditableQuizzes } from '@quiz-bot/core'
import type { CommandContext, ComponentContext, ModalContext } from 'discord-hono'
import { actorFromInteraction } from '../actor'
import type { Bindings } from '../env'
import {
  AQ_OPEN,
  type AddQuestionState,
  IN_ANSWERS,
  IN_BODY,
  IN_CHOICES,
  IN_EXPLANATION,
  IN_TF_ANSWER,
  buildAddQuestionPanel,
  buildQuestionModal,
} from './messages'

function splitCsv(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function selectValue(c: ComponentContext<{ Bindings: Bindings }>): string {
  return (c.interaction.data as { values?: string[] }).values?.[0] ?? ''
}

/** パネルの AQ_OPEN ボタン custom_id から選択状態（quizId:type:page）を復元する。 */
function readState(c: ComponentContext<{ Bindings: Bindings }>): AddQuestionState {
  const rows = (c.interaction.message?.components ?? []) as {
    components: { custom_id?: string }[]
  }[]
  for (const row of rows) {
    for (const comp of row.components) {
      if (comp.custom_id?.startsWith(`${AQ_OPEN};`)) {
        const [quizId, type, page] = comp.custom_id.slice(AQ_OPEN.length + 1).split(':')
        return { quizId: quizId ?? '', type: type ?? '', page: Number(page ?? '0') || 0 }
      }
    }
  }
  return { quizId: '', type: '', page: 0 }
}

async function editableQuizzes(c: ComponentContext<{ Bindings: Bindings }>) {
  const db = createDb(c.env.DB)
  return listEditableQuizzes(db, actorFromInteraction(c.interaction))
}

/** /quiz add-question: 設問作成パネルを開く（ephemeral）。 */
export async function handleAddQuestionCommand(c: CommandContext<{ Bindings: Bindings }>) {
  const actor = actorFromInteraction(c.interaction)
  if (!actor.guildId) return c.ephemeral().res('この操作はサーバー内で実行してください。')
  const db = createDb(c.env.DB)
  const quizzes = await listEditableQuizzes(db, actor)
  if (quizzes.length === 0) {
    return c
      .ephemeral()
      .res('編集できるクイズがありません。まず `/quiz create` で作成してください。')
  }
  const state: AddQuestionState = { quizId: quizzes[0]?.id ?? '', type: '', page: 0 }
  return c.ephemeral().res(buildAddQuestionPanel(quizzes, state))
}

export async function handleAqQuizSelect(c: ComponentContext<{ Bindings: Bindings }>) {
  const state = readState(c)
  state.quizId = selectValue(c)
  return c.resUpdate(buildAddQuestionPanel(await editableQuizzes(c), state))
}

export async function handleAqTypeSelect(c: ComponentContext<{ Bindings: Bindings }>) {
  const state = readState(c)
  state.type = selectValue(c)
  return c.resUpdate(buildAddQuestionPanel(await editableQuizzes(c), state))
}

export async function handleAqPagePrev(c: ComponentContext<{ Bindings: Bindings }>) {
  const state = readState(c)
  state.page -= 1
  return c.resUpdate(buildAddQuestionPanel(await editableQuizzes(c), state))
}

export async function handleAqPageNext(c: ComponentContext<{ Bindings: Bindings }>) {
  const state = readState(c)
  state.page += 1
  return c.resUpdate(buildAddQuestionPanel(await editableQuizzes(c), state))
}

export function handleAqOpen(c: ComponentContext<{ Bindings: Bindings }>) {
  const state = readState(c)
  if (!state.quizId || !state.type) {
    return c.ephemeral().res('クイズと出題形式を選択してください。')
  }
  return c.resModal(buildQuestionModal(state.quizId, state.type as QuestionType))
}

export async function handleAqModal(c: ModalContext<{ Bindings: Bindings }>) {
  const [quizId, type] = (c.var.custom_id ?? '').split(':')
  const v = c.var as Record<string, string | undefined>
  const qType = (type ?? 'free_text') as QuestionType

  let choices: string[] | null = null
  let answers: string[] = []
  if (qType === 'multiple_choice') {
    choices = splitCsv(v[IN_CHOICES])
    answers = splitCsv(v[IN_ANSWERS])
  } else if (qType === 'true_false') {
    answers = [(v[IN_TF_ANSWER] ?? '').trim()].filter(Boolean)
  } else {
    answers = splitCsv(v[IN_ANSWERS])
  }

  const db = createDb(c.env.DB)
  await addQuestion(db, actorFromInteraction(c.interaction), quizId ?? '', {
    type: qType,
    body: v[IN_BODY] ?? '',
    choices,
    answers,
    explanation: v[IN_EXPLANATION]?.trim() ? v[IN_EXPLANATION] : null,
  })
  return c.ephemeral().res('設問を追加しました。✅')
}
