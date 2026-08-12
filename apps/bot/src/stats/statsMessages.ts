import type { BuzzRankingEntry, MemberStats, QuizStats, RankingEntry } from '@quiz-bot/core'
import { Button, Components, type Embed, Select } from 'discord-hono'
import { COLOR, noticeEmbed, panelEmbed } from '../embeds'
import { addPageRow, pageLabel, paginate } from '../paging'

// ── コンポーネントのハンドラキー ──
export const QS_SELECT = 'qss' // クイズ選択プルダウン
export const QS_PAGE_PREV = 'qspp' // 前ページ（custom_id data = page:invokerId）
export const QS_PAGE_NEXT = 'qspn' // 次ページ（同上）

export const RANKING_LIMIT = 10
const MAX_CONTENT = 1900
const BODY_MAX = 60

export type StatsPanelState = { page: number; invokerId: string }

/**
 * 公開メッセージに <@id> を並べると全員に通知が飛ぶため、メンションを解決させない。
 * discord-hono は components/embeds 以外のフィールドをそのまま Discord へ渡す。
 */
export const NO_PING = { allowed_mentions: { parse: [] as string[] } }

/** 割合表示。母数0は「0%」ではなく「—」にして未回答と全問不正解を区別する。 */
export function pct(correct: number, total: number): string {
  if (total <= 0) return '—'
  return `${Math.round((correct / total) * 100)}%`
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** 2000文字上限に収まるよう行を積む。溢れた分は件数だけ伝える。 */
function joinWithBudget(head: string[], items: string[], overflowLabel: string): string {
  const lines = [...head]
  let used = lines.join('\n').length
  let shown = 0
  for (const item of items) {
    if (used + item.length + 1 > MAX_CONTENT) break
    lines.push(item)
    used += item.length + 1
    shown += 1
  }
  const rest = items.length - shown
  if (rest > 0) lines.push(`…ほか${rest}${overflowLabel}`)
  return lines.join('\n')
}

/** /quiz stats のクイズ選択パネル。 */
export function buildStatsPanel(
  allQuizzes: { id: string; title: string; description: string | null }[],
  state: StatsPanelState,
): { content: string; components: Components } {
  const slice = paginate(allQuizzes, state.page)
  const components = new Components()
  components.row(
    new Select(QS_SELECT, 'String').options(
      ...slice.items.map((q) => ({
        label: q.title.slice(0, 100),
        value: q.id,
        ...(q.description ? { description: q.description.slice(0, 100) } : {}),
      })),
    ),
  )

  addPageRow(
    components,
    slice,
    { prev: QS_PAGE_PREV, next: QS_PAGE_NEXT },
    `${slice.page}:${state.invokerId}`,
  )

  const content = [
    '📊 **クイズの統計**',
    `統計を見たいクイズを選んでください。（${pageLabel(slice)}）`,
  ].join('\n')

  return { content, components }
}

/** クイズ単位の統計メッセージ。 */
export function buildQuizStatsMessage(stats: QuizStats): string {
  const head = [
    `📊 **${stats.title}** の統計（このサーバー・1人モード・全期間）`,
    '',
    `全体: ${stats.totalAttempts}回答 / 正答率 ${pct(stats.correctCount, stats.totalAttempts)} / 参加者 ${stats.uniqueUserCount}人`,
  ]

  if (stats.questions.length === 0) {
    return [
      ...head,
      '',
      'このクイズにはまだ設問がありません。`/quiz add-question` で追加できます。',
    ].join('\n')
  }

  if (stats.totalAttempts === 0) {
    head.push('', 'まだ誰もプレイしていません。`/quiz play` で出題できます。')
  }

  head.push('', '**設問別**')
  const items = stats.questions.map(
    (q, i) =>
      `${i + 1}. ${pct(q.correctCount, q.totalAttempts)} (${q.totalAttempts}回) ${truncate(q.body, BODY_MAX)}`,
  )
  return joinWithBudget(head, items, '問')
}

/** /quiz my-stats の埋め込み。 */
export function buildMemberStatsMessage(stats: MemberStats): Embed {
  const { solo, buzz } = stats
  if (solo.totalAttempts === 0 && buzz.answeredCount === 0) {
    return noticeEmbed(
      '成績',
      `<@${stats.userId}> のこのサーバーでの記録はまだありません。\n\`/quiz play\` で遊ぶと記録されます。`,
    )
  }

  const fields = [
    {
      name: '1人モード',
      value:
        solo.totalAttempts === 0
          ? '記録なし'
          : `正解 **${solo.correctCount}** / ${solo.totalAttempts}問（${pct(solo.correctCount, solo.totalAttempts)}）\nプレイしたクイズ: ${solo.quizCount}件`,
      inline: true,
    },
    {
      name: '早押し',
      value:
        buzz.answeredCount === 0
          ? '記録なし'
          : `獲得 **${buzz.winCount}** / ${buzz.answeredCount}回答（${pct(buzz.winCount, buzz.answeredCount)}）`,
      inline: true,
    },
  ]

  if (stats.topQuizzes.length > 0) {
    fields.push({
      name: 'よく遊んだクイズ',
      value: stats.topQuizzes
        .map(
          (q) =>
            `・${truncate(q.title, 40)} — ${q.correctCount}/${q.totalAttempts}（${pct(q.correctCount, q.totalAttempts)}）`,
        )
        .join('\n'),
      inline: false,
    })
  }

  return panelEmbed({
    title: '成績',
    description: `<@${stats.userId}> のこのサーバーでの記録（全期間）`,
    fields,
  })
}

const MEDALS = ['🥇', '🥈', '🥉']

const rank = (i: number) => MEDALS[i] ?? `${i + 1}.`

/** /quiz ranking の埋め込み。 */
export function buildRankingMessage(solo: RankingEntry[], buzz: BuzzRankingEntry[]): Embed {
  if (solo.length === 0 && buzz.length === 0) {
    return noticeEmbed(
      'サーバーランキング',
      'このサーバーにはまだプレイ記録がありません。\n`/quiz play` で遊ぶとランキングに反映されます。',
    )
  }

  const soloList =
    solo.length === 0
      ? 'まだ記録がありません'
      : solo
          .map(
            (e, i) =>
              `${rank(i)} <@${e.userId}> — **${e.correctCount}**正解 / ${e.totalAttempts}問（${pct(e.correctCount, e.totalAttempts)}）`,
          )
          .join('\n')

  const buzzList =
    buzz.length === 0
      ? 'まだ記録がありません'
      : buzz
          .map(
            (e, i) =>
              `${rank(i)} <@${e.userId}> — **${e.winCount}**獲得 / ${e.answeredCount}回答（${pct(e.winCount, e.answeredCount)}）`,
          )
          .join('\n')

  return panelEmbed({
    title: 'サーバーランキング',
    color: COLOR.gold,
    fields: [
      { name: '1人モード（正解数順）', value: truncate(soloList, MAX_CONTENT / 2) },
      { name: '早押し（獲得数順）', value: truncate(buzzList, MAX_CONTENT / 2) },
    ],
    footer: '全期間',
  })
}
