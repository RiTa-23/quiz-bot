import {
  addPublicQuiz,
  createDb,
  listAddedQuizzes,
  listOwnedQuizzes,
  listPublicQuizzes,
  removeAddedQuiz,
  updateQuiz,
} from '@quiz-bot/core'
import type { CommandContext, ComponentContext, ModalContext } from 'discord-hono'
import { actorFromInteraction } from '../actor'
import type { Bindings } from '../env'
import {
  KEYWORD_INPUT,
  PUB_SEARCH_OPEN,
  buildPublicPanel,
  buildRemovePanel,
  buildSearchModal,
  buildVisibilityPanel,
  visibilityLabel,
} from './messages'

const GUILD_ONLY = 'この操作はサーバー内で実行してください。'

function selectValue(c: ComponentContext<{ Bindings: Bindings }>): string {
  return (c.interaction.data as { values?: string[] }).values?.[0] ?? ''
}

/** 検索ボタンの custom_id から現在の検索語を読み戻す。 */
function readKeyword(c: ComponentContext<{ Bindings: Bindings }>): string {
  const rows = (c.interaction.message?.components ?? []) as {
    components: { custom_id?: string }[]
  }[]
  for (const row of rows) {
    for (const comp of row.components) {
      if (comp.custom_id?.startsWith(`${PUB_SEARCH_OPEN};`)) {
        return comp.custom_id.slice(PUB_SEARCH_OPEN.length + 1)
      }
    }
  }
  return ''
}

async function renderPanel(
  c: ComponentContext<{ Bindings: Bindings }> | ModalContext<{ Bindings: Bindings }>,
  keyword: string,
) {
  const actor = actorFromInteraction(c.interaction)
  const db = createDb(c.env.DB)
  const quizzes = await listPublicQuizzes(db, actor, { keyword })
  return buildPublicPanel(quizzes, keyword)
}

/** /quiz add-public: 公開クイズの一覧・検索パネルを開く。 */
export async function handleAddPublicCommand(c: CommandContext<{ Bindings: Bindings }>) {
  const actor = actorFromInteraction(c.interaction)
  if (!actor.guildId) return c.ephemeral().res(GUILD_ONLY)

  const db = createDb(c.env.DB)
  const quizzes = await listPublicQuizzes(db, actor, {})
  return c.ephemeral().res(buildPublicPanel(quizzes, ''))
}

/** 公開クイズを選択 → このサーバーに追加する。 */
export async function handlePubSelect(c: ComponentContext<{ Bindings: Bindings }>) {
  const actor = actorFromInteraction(c.interaction)
  const db = createDb(c.env.DB)
  const added = await addPublicQuiz(db, actor, selectValue(c))
  return c.resUpdate({
    content: `✅ **${added.title}** をこのサーバーに追加しました。\n\`/quiz play\` で出題できます。`,
    components: [],
  })
}

export function handlePubSearchOpen(c: ComponentContext<{ Bindings: Bindings }>) {
  return c.resModal(buildSearchModal(readKeyword(c)))
}

export async function handlePubSearchModal(c: ModalContext<{ Bindings: Bindings }>) {
  const keyword = ((c.var as Record<string, string | undefined>)[KEYWORD_INPUT] ?? '').trim()
  // モーダルからは元のパネルを直接更新できないため、結果を新しいephemeralとして返す
  return c.ephemeral().res(await renderPanel(c, keyword))
}

export async function handlePubClear(c: ComponentContext<{ Bindings: Bindings }>) {
  return c.resUpdate(await renderPanel(c, ''))
}

/** /quiz remove-public: 追加済みクイズを外すパネル。 */
export async function handleRemovePublicCommand(c: CommandContext<{ Bindings: Bindings }>) {
  const actor = actorFromInteraction(c.interaction)
  if (!actor.guildId) return c.ephemeral().res(GUILD_ONLY)

  const db = createDb(c.env.DB)
  const quizzes = await listAddedQuizzes(db, actor)
  return c.ephemeral().res(buildRemovePanel(quizzes))
}

export async function handleRmSelect(c: ComponentContext<{ Bindings: Bindings }>) {
  const actor = actorFromInteraction(c.interaction)
  const db = createDb(c.env.DB)
  const removed = await removeAddedQuiz(db, actor, selectValue(c))
  return c.resUpdate({
    content: `🗑 **${removed.title}** をこのサーバーから外しました。`,
    components: [],
  })
}

/** /quiz visibility: クイズの公開設定を切り替えるパネル（作成者のみ）。 */
export async function handleVisibilityCommand(c: CommandContext<{ Bindings: Bindings }>) {
  const actor = actorFromInteraction(c.interaction)
  if (!actor.guildId) return c.ephemeral().res(GUILD_ONLY)

  const db = createDb(c.env.DB)
  const quizzes = await listOwnedQuizzes(db, actor)
  if (quizzes.length === 0) {
    return c.ephemeral().res('公開設定を変更できるクイズがありません。（作成者のみ変更できます）')
  }
  return c.ephemeral().res(buildVisibilityPanel(quizzes, ''))
}

export async function handleVisSelect(c: ComponentContext<{ Bindings: Bindings }>) {
  const actor = actorFromInteraction(c.interaction)
  const db = createDb(c.env.DB)
  const quizzes = await listOwnedQuizzes(db, actor)
  return c.resUpdate(buildVisibilityPanel(quizzes, selectValue(c)))
}

async function setVisibility(
  c: ComponentContext<{ Bindings: Bindings }>,
  visibility: 'private' | 'public',
) {
  const actor = actorFromInteraction(c.interaction)
  const db = createDb(c.env.DB)
  const quiz = await updateQuiz(db, actor, c.var.custom_id ?? '', { visibility })

  const note =
    visibility === 'public'
      ? '他のサーバーから `/quiz add-public` で追加できるようになりました。'
      : '他のサーバーからは新たに追加できなくなりました。（すでに追加済みのサーバーでは引き続き利用できます）'
  return c.resUpdate({
    content: `**${quiz.title}** を **${visibilityLabel(visibility)}** に設定しました。\n${note}`,
    components: [],
  })
}

export const handleVisPublic = (c: ComponentContext<{ Bindings: Bindings }>) =>
  setVisibility(c, 'public')
export const handleVisPrivate = (c: ComponentContext<{ Bindings: Bindings }>) =>
  setVisibility(c, 'private')
