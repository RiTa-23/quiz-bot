import {
  createDb,
  getEditorSettings,
  listOwnedQuizzes,
  setGuildEditor,
  setUserEditors,
} from '@quiz-bot/core'
import type { CommandContext, ComponentContext } from 'discord-hono'
import { actorFromInteraction } from '../actor'
import type { Bindings } from '../env'
import { NO_PING, buildEditorPanel } from './editorMessages'

const GUILD_ONLY = 'この操作はサーバー内で実行してください。'

/** 現在の設定を読み直してパネルを描き直す。 */
async function renderPanel(c: ComponentContext<{ Bindings: Bindings }>, quizId: string) {
  const actor = actorFromInteraction(c.interaction)
  const db = createDb(c.env.DB)
  const quizzes = await listOwnedQuizzes(db, actor)
  const settings = quizId ? await getEditorSettings(db, actor, quizId) : null
  return { ...buildEditorPanel(quizzes, quizId, settings), ...NO_PING }
}

/** /quiz editors: 編集権限の設定パネルを開く（作成者のみ）。 */
export async function handleEditorsCommand(c: CommandContext<{ Bindings: Bindings }>) {
  const actor = actorFromInteraction(c.interaction)
  if (!actor.guildId) return c.ephemeral().res(GUILD_ONLY)

  const db = createDb(c.env.DB)
  const quizzes = await listOwnedQuizzes(db, actor)
  if (quizzes.length === 0) {
    return c.ephemeral().res('編集権限を設定できるクイズがありません。（作成者のみ設定できます）')
  }
  return c.ephemeral().res({ ...buildEditorPanel(quizzes, '', null), ...NO_PING })
}

export async function handleEdQuizSelect(c: ComponentContext<{ Bindings: Bindings }>) {
  const quizId = (c.interaction.data as { values?: string[] }).values?.[0] ?? ''
  return c.resUpdate(await renderPanel(c, quizId))
}

async function toggleGuild(c: ComponentContext<{ Bindings: Bindings }>, allowed: boolean) {
  const quizId = c.var.custom_id ?? ''
  const actor = actorFromInteraction(c.interaction)
  const db = createDb(c.env.DB)
  await setGuildEditor(db, actor, quizId, allowed)
  return c.resUpdate(await renderPanel(c, quizId))
}

export const handleEdGuildOn = (c: ComponentContext<{ Bindings: Bindings }>) => toggleGuild(c, true)
export const handleEdGuildOff = (c: ComponentContext<{ Bindings: Bindings }>) =>
  toggleGuild(c, false)

/** ユーザー選択は「選ばれた集合に揃える」操作（選ばなかった人の許可は外れる）。 */
export async function handleEdUserSelect(c: ComponentContext<{ Bindings: Bindings }>) {
  const quizId = c.var.custom_id ?? ''
  const userIds = (c.interaction.data as { values?: string[] }).values ?? []
  const actor = actorFromInteraction(c.interaction)
  const db = createDb(c.env.DB)
  await setUserEditors(db, actor, quizId, userIds)
  return c.resUpdate(await renderPanel(c, quizId))
}
