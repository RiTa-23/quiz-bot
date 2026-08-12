import type { Components } from 'discord-hono'
import type { CommandContext, ComponentContext, ModalContext } from 'discord-hono'
import { actorFromInteraction } from '../actor'
import type { Bindings } from '../env'
import { editChannelMessage } from './discordRest'
import {
  FT_INPUT,
  buildConfigPanel,
  buildFreetextModal,
  buildSessionQuestion,
  buildSummary,
} from './messages'
import type { AnswerInput, AnswerOutcome, ControlResult, NextStep } from './types'

type Ctx =
  | CommandContext<{ Bindings: Bindings }>
  | ComponentContext<{ Bindings: Bindings }>
  | ModalContext<{ Bindings: Bindings }>

function channelIdOf(interaction: unknown): string {
  const i = interaction as { channel_id?: string; channel?: { id?: string } }
  return i.channel_id ?? i.channel?.id ?? ''
}

function stubOf(c: Ctx, guildId: string, channelId: string) {
  return c.env.QUIZ_SESSION.getByName(`${guildId}:${channelId}`)
}

const IGNORED_MESSAGE: Record<string, string> = {
  'not-active': 'この回答は受け付けられません。',
  stale: 'この問題はすでに次へ進みました。',
  'not-host': 'これはホストのプレイです。',
  closed: 'この問題はすでに締め切られました。',
  already: 'すでに回答済みです。',
}

const DENIED_MESSAGE: Record<'not-host' | 'no-session', string> = {
  'not-host': 'この設定パネルを操作できるのはホストだけです。自分で始めるには /quiz play を実行してください。',
  'no-session': 'この設定パネルは無効です。もう一度 /quiz play を実行してください。',
}

export async function handleQuizPlay(c: CommandContext<{ Bindings: Bindings }>) {
  const actor = actorFromInteraction(c.interaction)
  if (!actor.guildId) return c.ephemeral().res('この操作はサーバー内で実行してください。')
  const channelId = channelIdOf(c.interaction)
  const stub = stubOf(c, actor.guildId, channelId)
  const result = await stub.openDraft(actor, channelId)
  if (!result.ok) {
    return c
      .ephemeral()
      .res(
        `このチャンネルでは <@${result.hostUserId}> のクイズが進行中です。終わるまで待つか、別のチャンネルで実行してください。`,
      )
  }
  return c.res(buildConfigPanel(result.view))
}

function stubFromComponent(
  c: ComponentContext<{ Bindings: Bindings }> | ModalContext<{ Bindings: Bindings }>,
) {
  const actor = actorFromInteraction(c.interaction)
  const channelId = channelIdOf(c.interaction)
  return { actor, channelId, stub: stubOf(c, actor.guildId ?? '', channelId) }
}

/** ホスト以外の操作は元のパネルを変えず、本人にだけ理由を返す。 */
function respondControl(c: ComponentContext<{ Bindings: Bindings }>, result: ControlResult) {
  if (!result.ok) return c.ephemeral().res(DENIED_MESSAGE[result.reason])
  return c.resUpdate(buildConfigPanel(result.view))
}

export async function handleQuizSelect(c: ComponentContext<{ Bindings: Bindings }>) {
  const value = (c.interaction.data as { values?: string[] }).values?.[0] ?? ''
  const { actor, stub } = stubFromComponent(c)
  return respondControl(c, await stub.selectQuiz(actor.userId, value))
}

export async function handlePagePrev(c: ComponentContext<{ Bindings: Bindings }>) {
  const { actor, stub } = stubFromComponent(c)
  return respondControl(c, await stub.changePage(actor.userId, -1))
}

export async function handlePageNext(c: ComponentContext<{ Bindings: Bindings }>) {
  const { actor, stub } = stubFromComponent(c)
  return respondControl(c, await stub.changePage(actor.userId, 1))
}

export async function handleModeToggle(c: ComponentContext<{ Bindings: Bindings }>) {
  const { actor, stub } = stubFromComponent(c)
  return respondControl(c, await stub.toggleMode(actor.userId))
}

export async function handleCountSelect(c: ComponentContext<{ Bindings: Bindings }>) {
  const value = (c.interaction.data as { values?: string[] }).values?.[0] ?? '1'
  const { actor, stub } = stubFromComponent(c)
  return respondControl(c, await stub.setCount(actor.userId, Number.parseInt(value, 10)))
}

export async function handlePlay(c: ComponentContext<{ Bindings: Bindings }>) {
  const { actor, stub } = stubFromComponent(c)
  const messageId = c.interaction.message.id
  const result = await stub.start(actor.userId, messageId)
  if (!result.ok) {
    if (result.reason === 'not-host' || result.reason === 'no-session') {
      return c.ephemeral().res(DENIED_MESSAGE[result.reason])
    }
    const msg = result.reason === 'no-quiz' ? 'クイズを選択してください。' : '設問がありません。'
    return c.ephemeral().res(msg)
  }
  const step: Extract<NextStep, { done: false }> = {
    done: false,
    question: result.first,
    number: result.number,
    total: result.total,
  }
  return c.resUpdate(buildSessionQuestion(step, messageId))
}

function advanceHeader(
  outcome: Extract<AnswerOutcome, { kind: 'solo-result' | 'buzz-win' }>,
): string {
  const answers = outcome.correctAnswers.join(' / ')
  const exp = outcome.explanation ? `\n解説: ${outcome.explanation}` : ''
  if (outcome.kind === 'buzz-win') {
    return `🎉 <@${outcome.winnerId}> が正解！ 正解: ${answers}${exp}`
  }
  const mark = outcome.correct ? '✅ 正解' : '❌ 不正解'
  return `前問: ${mark}（正解: ${answers}）${exp}`
}

/** 前問結果 + 次の設問（or サマリ）のメッセージを組み立てる。componentsがnullなら空にする。 */
function renderAdvance(
  outcome: Extract<AnswerOutcome, { kind: 'solo-result' | 'buzz-win' }>,
  messageId: string,
): { content: string; components: Components | null } {
  const header = advanceHeader(outcome)
  if (outcome.next.done) {
    return { content: `${header}\n\n${buildSummary(outcome.next.summary)}`, components: null }
  }
  return buildSessionQuestion(outcome.next, messageId, header)
}

/** 4択・○×のセッション回答（ボタン）。 */
export async function handleSessionAnswer(c: ComponentContext<{ Bindings: Bindings }>) {
  const [questionId, idxStr] = (c.var.custom_id ?? '').split(':')
  const { actor, stub } = stubFromComponent(c)
  const input: AnswerInput = { kind: 'choice', idx: Number(idxStr) }
  const outcome = await stub.answer(actor.userId, questionId ?? '', input)

  if (outcome.kind === 'ignored')
    return c.ephemeral().res(IGNORED_MESSAGE[outcome.reason] ?? 'エラー')
  if (outcome.kind === 'buzz-wrong') return c.ephemeral().res('不正解… 早い者勝ちです。')

  const messageId = c.interaction.message.id
  const rendered = renderAdvance(outcome, messageId)
  return c.resUpdate({
    content: rendered.content,
    components: rendered.components ?? [],
    // 勝者や順位に <@id> が入るため、通知が飛ばないようにする
    allowed_mentions: { parse: [] },
  })
}

/** 自由記述: モーダルを開く。 */
export function handleSessionFtOpen(c: ComponentContext<{ Bindings: Bindings }>) {
  const [questionId, messageId] = (c.var.custom_id ?? '').split(':')
  return c.resModal(buildFreetextModal(questionId ?? '', messageId ?? ''))
}

/** 自由記述: モーダル送信。モーダルは元メッセージを更新できないためRESTで編集する。 */
export async function handleSessionFtModal(c: ModalContext<{ Bindings: Bindings }>) {
  const [questionId, messageId] = (c.var.custom_id ?? '').split(':')
  const text = (c.var as Record<string, string | undefined>)[FT_INPUT] ?? ''
  const { actor, channelId, stub } = stubFromComponent(c)
  const outcome = await stub.answer(actor.userId, questionId ?? '', { kind: 'text', text })

  if (outcome.kind === 'ignored')
    return c.ephemeral().res(IGNORED_MESSAGE[outcome.reason] ?? 'エラー')
  if (outcome.kind === 'buzz-wrong') return c.ephemeral().res('不正解… 早い者勝ちです。')

  const rendered = renderAdvance(outcome, messageId ?? '')
  if (messageId) {
    await editChannelMessage(c.env.DISCORD_TOKEN, channelId, messageId, {
      content: rendered.content,
      components: rendered.components ? rendered.components.toJSON() : [],
    })
  }
  return c.ephemeral().res(outcome.kind === 'buzz-win' ? '正解！🎉' : '回答を記録しました。')
}
