import { createDb, deleteQuiz, listDeletableQuizzes } from '@quiz-bot/core'
import type { CommandContext, ComponentContext } from 'discord-hono'
import { actorFromInteraction } from '../actor'
import type { Bindings } from '../env'
import {
  DQ_CONFIRM,
  type DeleteState,
  buildDeleteConfirm,
  buildDeletePanel,
} from './deleteMessages'

function selectValue(c: ComponentContext<{ Bindings: Bindings }>): string {
  return (c.interaction.data as { values?: string[] }).values?.[0] ?? ''
}

/** パネルの DQ_CONFIRM ボタン custom_id から選択状態（quizId:page）を復元する。 */
function readState(c: ComponentContext<{ Bindings: Bindings }>): DeleteState {
  const rows = (c.interaction.message?.components ?? []) as {
    components: { custom_id?: string }[]
  }[]
  for (const row of rows) {
    for (const comp of row.components) {
      if (comp.custom_id?.startsWith(`${DQ_CONFIRM};`)) {
        const [quizId, page] = comp.custom_id.slice(DQ_CONFIRM.length + 1).split(':')
        return { quizId: quizId ?? '', page: Number(page ?? '0') || 0 }
      }
    }
  }
  return { quizId: '', page: 0 }
}

async function deletableQuizzes(c: ComponentContext<{ Bindings: Bindings }>) {
  const db = createDb(c.env.DB)
  return listDeletableQuizzes(db, actorFromInteraction(c.interaction))
}

/** /quiz delete: 削除パネルを開く（ephemeral）。 */
export async function handleDeleteCommand(c: CommandContext<{ Bindings: Bindings }>) {
  const actor = actorFromInteraction(c.interaction)
  if (!actor.guildId) return c.ephemeral().res('この操作はサーバー内で実行してください。')
  const db = createDb(c.env.DB)
  const quizzes = await listDeletableQuizzes(db, actor)
  if (quizzes.length === 0) {
    return c.ephemeral().res('削除できるクイズがありません。（削除できるのは作成者のみです）')
  }
  const state: DeleteState = { quizId: quizzes[0]?.id ?? '', page: 0 }
  return c.ephemeral().res(buildDeletePanel(quizzes, state))
}

export async function handleDqSelect(c: ComponentContext<{ Bindings: Bindings }>) {
  const state = readState(c)
  state.quizId = selectValue(c)
  return c.resUpdate(buildDeletePanel(await deletableQuizzes(c), state))
}

export async function handleDqPagePrev(c: ComponentContext<{ Bindings: Bindings }>) {
  const state = readState(c)
  state.page -= 1
  return c.resUpdate(buildDeletePanel(await deletableQuizzes(c), state))
}

export async function handleDqPageNext(c: ComponentContext<{ Bindings: Bindings }>) {
  const state = readState(c)
  state.page += 1
  return c.resUpdate(buildDeletePanel(await deletableQuizzes(c), state))
}

/** 削除ボタン → 最終確認を表示する。 */
export async function handleDqConfirm(c: ComponentContext<{ Bindings: Bindings }>) {
  const state = readState(c)
  if (!state.quizId) return c.ephemeral().res('削除するクイズを選択してください。')
  const quizzes = await deletableQuizzes(c)
  const target = quizzes.find((q) => q.id === state.quizId)
  if (!target) return c.ephemeral().res('対象のクイズが見つかりませんでした。')
  return c.resUpdate(buildDeleteConfirm(target.id, target.title))
}

/** 最終確認で「本当に削除する」 → 実行。権限チェックは core の deleteQuiz が行う。 */
export async function handleDqExecute(c: ComponentContext<{ Bindings: Bindings }>) {
  const quizId = c.var.custom_id ?? ''
  const db = createDb(c.env.DB)
  await deleteQuiz(db, actorFromInteraction(c.interaction), quizId)
  return c.resUpdate({ content: '🗑 クイズを削除しました。', components: [] })
}

export function handleDqCancel(c: ComponentContext<{ Bindings: Bindings }>) {
  return c.resUpdate({ content: '削除をキャンセルしました。', components: [] })
}
