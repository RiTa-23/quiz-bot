import { Button, Components, Modal, Select, TextInput } from 'discord-hono'
import type { DraftView, NextStep, PublicSessionQuestion, SummaryData } from './types'

// ── コンポーネントのハンドラキー（custom_id の先頭 ';' より前）──
export const CFG_QUIZ_SELECT = 'cqs' // クイズ選択プルダウン
export const CFG_PAGE_PREV = 'cpp' // 前ページ
export const CFG_PAGE_NEXT = 'cpn' // 次ページ
export const CFG_MODE_TOGGLE = 'cmt' // プレイ形式トグル
export const CFG_COUNT_SELECT = 'ccs' // 出題数プルダウン
export const CFG_PLAY = 'cpl' // Play開始

export const SESSION_ANSWER = 'sba' // セッション: 4択/○×ボタン回答（data = questionId:idx）
export const SESSION_FT_OPEN = 'sfo' // セッション: 自由記述モーダルを開く（data = questionId:messageId）
export const SESSION_FT_MODAL = 'sfm' // セッション: 自由記述モーダル送信（data = questionId:messageId）
export const FT_INPUT = 'answer'

const TRUE_FALSE_LABELS = ['⭕ ○', '❌ ×']

function modeLabel(mode: DraftView['mode']): string {
  return mode === 'solo' ? '1人' : 'みんなで早押し'
}

/**
 * 出題数プルダウンの選択肢を作る。Discordの上限25件に収めるため、
 * 少ない数は1刻み、多い数は区切りのよい値のみを出す。
 */
function countOptions(max: number): number[] {
  const candidates = [
    ...Array.from({ length: 10 }, (_, i) => i + 1),
    15,
    20,
    25,
    30,
    35,
    40,
    45,
    50,
  ]
  const usable = candidates.filter((n) => n <= max)
  if (usable.length === 0) return [1]
  // 上限値そのものも選べるようにする
  if (!usable.includes(max)) usable.push(max)
  return usable.slice(0, 25)
}

/** 出題設定GUIメッセージを組み立てる。 */
export function buildConfigPanel(view: DraftView): { content: string; components: Components } {
  const components = new Components()

  const select = new Select(CFG_QUIZ_SELECT, 'String').options(
    ...view.quizzes.map((q) => ({
      label: q.title.slice(0, 100),
      value: q.id,
      default: q.id === view.selectedQuizId,
    })),
  )
  components.row(select)

  if (view.hasPrev || view.hasNext) {
    components.row(
      new Button(CFG_PAGE_PREV, '◀ 前へ', 'Secondary').disabled(!view.hasPrev),
      new Button(CFG_PAGE_NEXT, '次へ ▶', 'Secondary').disabled(!view.hasNext),
    )
  }

  const max = Math.min(view.questionCount || 1, 50)
  components.row(
    new Select(CFG_COUNT_SELECT, 'String').options(
      ...countOptions(max).map((n) => ({
        label: `出題数: ${n}問`,
        value: String(n),
        default: n === view.count,
      })),
    ),
  )

  components.row(
    new Button(CFG_MODE_TOGGLE, `形式: ${modeLabel(view.mode)}`, 'Secondary'),
    new Button(CFG_PLAY, '▶ Play', 'Success'),
  )

  const content = [
    '**クイズ設定**',
    `クイズ: ${view.selectedQuizTitle ?? '（未選択）'}（全${view.questionCount}問）`,
    `出題数: ${view.count}`,
    `プレイ形式: ${modeLabel(view.mode)}`,
    '設定したら **Play** を押してください。',
  ].join('\n')

  return { content, components }
}

function answerComponents(q: PublicSessionQuestion, messageId: string): Components {
  const components = new Components()
  if (q.type === 'multiple_choice' && q.choices) {
    components.row(
      ...q.choices.map((choice, i) =>
        new Button(SESSION_ANSWER, choice.slice(0, 80), 'Secondary').custom_id(`${q.id}:${i}`),
      ),
    )
  } else if (q.type === 'true_false') {
    components.row(
      new Button(SESSION_ANSWER, TRUE_FALSE_LABELS[0] ?? '○', 'Success').custom_id(`${q.id}:0`),
      new Button(SESSION_ANSWER, TRUE_FALSE_LABELS[1] ?? '×', 'Danger').custom_id(`${q.id}:1`),
    )
  } else {
    components.row(
      new Button(SESSION_FT_OPEN, '✍️ 回答する', 'Primary').custom_id(`${q.id}:${messageId}`),
    )
  }
  return components
}

/** 出題メッセージ。header に前問の結果などを付けられる。 */
export function buildSessionQuestion(
  step: Extract<NextStep, { done: false }>,
  messageId: string,
  header?: string,
): { content: string; components: Components } {
  const lines = []
  if (header) lines.push(header, '')
  lines.push(`**問題 ${step.number}/${step.total}**`, step.question.body)
  if (step.question.choices && step.question.type === 'multiple_choice') {
    lines.push('', step.question.choices.map((c, i) => `${i + 1}. ${c}`).join('\n'))
  }
  return {
    content: lines.join('\n'),
    components: answerComponents(step.question, messageId),
  }
}

/** 自由記述モーダル。 */
export function buildFreetextModal(questionId: string, messageId: string): Modal {
  return new Modal(SESSION_FT_MODAL, '回答を入力')
    .custom_id(`${questionId}:${messageId}`)
    .row(new TextInput(FT_INPUT, '回答', 'Single').required())
}

/** 終了サマリメッセージ。components は空にする。 */
export function buildSummary(summary: SummaryData): string {
  if (summary.mode === 'solo') {
    return `**結果**\n${summary.total}問中 ${summary.correct}問 正解！`
  }
  const ranking = summary.scores
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((s, i) => `${i + 1}. <@${s.userId}> — ${s.score}点`)
    .join('\n')
  return `**早押し結果**（全${summary.total}問）\n${ranking || '正解者なし'}`
}
