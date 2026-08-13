import { Button, Components, type Embed, Modal, Select, TextInput } from 'discord-hono'
import { COLOR, panelEmbed } from '../embeds'
import type { DraftView, LobbyView, NextStep, PublicSessionQuestion, SummaryData } from './types'

// ── コンポーネントのハンドラキー（custom_id の先頭 ';' より前）──
export const CFG_QUIZ_SELECT = 'cqs' // クイズ選択プルダウン
export const CFG_PAGE_PREV = 'cpp' // 前ページ
export const CFG_PAGE_NEXT = 'cpn' // 次ページ
export const CFG_MODE_TOGGLE = 'cmt' // プレイ形式トグル
export const CFG_COUNT_SELECT = 'ccs' // 出題数プルダウン
export const CFG_PLAY = 'cpl' // Play開始（早押しでは募集開始）
export const LOBBY_JOIN = 'lbj' // 募集パネル: 参加
export const LOBBY_START = 'lbs' // 募集パネル: ゲーム開始

export const SESSION_ANSWER = 'sba' // セッション: 4択/○×ボタン回答（data = questionId:idx）
export const SESSION_FT_OPEN = 'sfo' // セッション: 自由記述モーダルを開く（data = questionId:messageId）
export const SESSION_FT_MODAL = 'sfm' // セッション: 自由記述モーダル送信（data = questionId:messageId）
export const FT_INPUT = 'answer'

// 絵文字だけにする（「⭕ ○」のように絵文字とテキストが重複して見えるため）。
// 回答の判定値は QuizSession の TRUE_FALSE_CHOICES 側で持つのでラベルは表示専用。
const TRUE_FALSE_LABELS = ['⭕', '❌']

// 参加者1人あたり約25文字（`・<@snowflake>`）。人数が増えてもメッセージの
// 2000文字上限を超えないよう、一覧の表示件数だけを打ち切る（人数表示は全数）。
const LOBBY_LIST_LIMIT = 40

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
export function buildConfigPanel(view: DraftView): { embeds: Embed[]; components: Components } {
  const components = new Components()

  // Discordのセレクトは選択肢0件を受け付けないため、出題できるクイズが無いときは
  // コンポーネントを一切付けずに案内文だけ返す
  if (view.quizzes.length === 0) {
    return {
      embeds: [
        panelEmbed({
          title: 'クイズ設定',
          description: [
            'このサーバーで出題できるクイズがありません。',
            '`/quiz create` で作成するか、`/quiz add-public` で公開クイズを追加してください。',
          ].join('\n'),
          color: COLOR.muted,
        }),
      ],
      components,
    }
  }

  const select = new Select(CFG_QUIZ_SELECT, 'String').options(
    ...view.quizzes.map((q) => ({
      label: q.title.slice(0, 100),
      value: q.id,
      default: q.id === view.selectedQuizId,
      ...(q.description ? { description: q.description.slice(0, 100) } : {}),
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

  const playLabel = view.mode === 'buzz' ? '📣 募集開始' : '▶ Play'
  components.row(
    new Button(CFG_MODE_TOGGLE, `形式: ${modeLabel(view.mode)}`, 'Secondary'),
    new Button(CFG_PLAY, playLabel, 'Success'),
  )

  const embed = panelEmbed({
    title: 'クイズ設定',
    description: view.selectedQuizDescription ?? undefined,
    fields: [
      {
        name: 'クイズ',
        value: `${view.selectedQuizTitle ?? '（未選択）'}\n全${view.questionCount}問`,
        inline: true,
      },
      { name: '出題数', value: `${view.count}問`, inline: true },
      { name: 'プレイ形式', value: modeLabel(view.mode), inline: true },
    ],
    footer:
      view.mode === 'buzz'
        ? '設定したら「募集開始」を押してください'
        : '設定したら「Play」を押してください',
  })

  return { embeds: [embed], components }
}

/** 早押しの参加者募集パネル。 */
export function buildLobbyPanel(view: LobbyView): { embeds: Embed[]; components: Components } {
  const components = new Components()
  components.row(
    new Button(LOBBY_JOIN, '🙋 参加する', 'Primary'),
    ...(view.canStart ? [new Button(LOBBY_START, '▶ Play', 'Success')] : []),
  )

  const roster =
    view.participants
      .slice(0, LOBBY_LIST_LIMIT)
      .map((id) => `${id === view.hostUserId ? '👑' : '・'} <@${id}>`)
      .join('\n') +
    (view.participants.length > LOBBY_LIST_LIMIT
      ? `\nほか${view.participants.length - LOBBY_LIST_LIMIT}人`
      : '')

  const embed = panelEmbed({
    title: 'みんなで早押し — 参加者募集中',
    description: view.quizDescription ?? undefined,
    color: COLOR.gold,
    fields: [
      { name: 'クイズ', value: view.quizTitle ?? '（未選択）', inline: true },
      { name: '出題数', value: `${view.count}問`, inline: true },
      { name: `参加者（${view.participants.length}人）`, value: roster || '—' },
    ],
    footer: view.canStart
      ? 'ホストが「Play」を押すと開始します'
      : 'あと1人以上でゲームを開始できます',
  })

  return { embeds: [embed], components }
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
      // ❌ は絵文字自体が赤いため、Danger(赤)だと背景と同化する
      new Button(SESSION_ANSWER, TRUE_FALSE_LABELS[1] ?? '×', 'Primary').custom_id(`${q.id}:1`),
    )
  } else {
    components.row(
      new Button(SESSION_FT_OPEN, '✍️ 回答する', 'Primary').custom_id(`${q.id}:${messageId}`),
    )
  }
  return components
}

const TYPE_HINT: Record<PublicSessionQuestion['type'], string> = {
  multiple_choice: '4択',
  true_false: '○×',
  free_text: '自由記述',
}

/**
 * 出題メッセージ。前問の結果（header）がある場合はその埋め込みを上に重ねる。
 * 設問本体は必ず最後の埋め込みになるため、回答ボタンとの距離が近く保たれる。
 */
export function buildSessionQuestion(
  step: Extract<NextStep, { done: false }>,
  messageId: string,
  header?: Embed,
): { embeds: Embed[]; components: Components } {
  const embed = panelEmbed({
    title: `問題 ${step.number} / ${step.total}`,
    description: step.question.body,
    footer: TYPE_HINT[step.question.type],
    fields:
      step.question.choices && step.question.type === 'multiple_choice'
        ? [
            {
              name: '選択肢',
              value: step.question.choices.map((c, i) => `**${i + 1}.** ${c}`).join('\n'),
            },
          ]
        : undefined,
  })
  return {
    embeds: header ? [header, embed] : [embed],
    components: answerComponents(step.question, messageId),
  }
}

/** 自由記述モーダル。 */
export function buildFreetextModal(questionId: string, messageId: string): Modal {
  return new Modal(SESSION_FT_MODAL, '回答を入力')
    .custom_id(`${questionId}:${messageId}`)
    .row(new TextInput(FT_INPUT, '回答', 'Single').required())
}

const MEDALS = ['🥇', '🥈', '🥉']

/** 終了サマリの埋め込み。components は空にする。 */
export function buildSummary(summary: SummaryData): Embed {
  if (summary.mode === 'solo') {
    const rate = Math.round((summary.correct / Math.max(1, summary.total)) * 100)
    return panelEmbed({
      title: '結果',
      color: summary.correct === summary.total ? COLOR.gold : COLOR.navy,
      fields: [
        { name: '正解数', value: `**${summary.correct}** / ${summary.total}問`, inline: true },
        { name: '正答率', value: `${rate}%`, inline: true },
      ],
    })
  }
  const ranking = summary.scores
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((s, i) => `${MEDALS[i] ?? `${i + 1}.`} <@${s.userId}> — **${s.score}**点`)
    .join('\n')
  return panelEmbed({
    title: '早押し結果',
    color: COLOR.gold,
    description: ranking || '正解者なし',
    footer: `全${summary.total}問`,
  })
}

/** 前問の結果。正誤で色を変え、出題の埋め込みの上に重ねて使う。 */
export function buildAdvanceHeader(input: {
  kind: 'solo-result' | 'buzz-win' | 'timeout' | 'all-wrong'
  correct?: boolean
  winnerId?: string
  correctAnswers?: string[]
  explanation?: string | null
}): Embed {
  const answers = input.correctAnswers?.join(' / ') ?? ''
  if (input.kind === 'timeout') {
    return panelEmbed({ title: '時間切れ', description: '正解者なし', color: COLOR.muted })
  }
  if (input.kind === 'all-wrong') {
    return panelEmbed({
      title: '全員不正解',
      color: COLOR.wrong,
      fields: [
        { name: '正解', value: answers || '—', inline: true },
        ...(input.explanation ? [{ name: '解説', value: input.explanation }] : []),
      ],
    })
  }
  const title =
    input.kind === 'buzz-win' ? `<@${input.winnerId}> が正解！` : input.correct ? '正解' : '不正解'
  // Embed.fields は追記ではなく置換のため、一度に渡す
  return panelEmbed({
    title: input.kind === 'buzz-win' ? '前問の結果' : title,
    color: input.kind === 'buzz-win' || input.correct ? COLOR.correct : COLOR.wrong,
    fields: [
      ...(input.kind === 'buzz-win'
        ? [{ name: '勝者', value: `<@${input.winnerId}>`, inline: true }]
        : [{ name: '判定', value: title, inline: true }]),
      { name: '正解', value: answers || '—', inline: true },
      ...(input.explanation ? [{ name: '解説', value: input.explanation }] : []),
    ],
  })
}
