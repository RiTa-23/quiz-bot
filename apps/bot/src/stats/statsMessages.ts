import type { BuzzRankingEntry, MemberStats, QuizStats, RankingEntry } from '@quiz-bot/core'
import { Button, Components, Select } from 'discord-hono'

// ── コンポーネントのハンドラキー ──
export const QS_SELECT = 'qss' // クイズ選択プルダウン
export const QS_PAGE_PREV = 'qspp' // 前ページ（custom_id data = page:invokerId）
export const QS_PAGE_NEXT = 'qspn' // 次ページ（同上）

export const PAGE_SIZE = 25
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
  const totalPages = Math.max(1, Math.ceil(allQuizzes.length / PAGE_SIZE))
  const page = Math.min(Math.max(0, state.page), totalPages - 1)
  const pageItems = allQuizzes.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const components = new Components()
  components.row(
    new Select(QS_SELECT, 'String').options(
      ...pageItems.map((q) => ({
        label: q.title.slice(0, 100),
        value: q.id,
        ...(q.description ? { description: q.description.slice(0, 100) } : {}),
      })),
    ),
  )

  if (allQuizzes.length > PAGE_SIZE) {
    const data = `${page}:${state.invokerId}`
    components.row(
      new Button(QS_PAGE_PREV, '◀ 前へ', 'Secondary').custom_id(data).disabled(page <= 0),
      new Button(QS_PAGE_NEXT, '次へ ▶', 'Secondary')
        .custom_id(data)
        .disabled(page >= totalPages - 1),
    )
  }

  const content = [
    '📊 **クイズの統計**',
    `統計を見たいクイズを選んでください。（${allQuizzes.length}件中 ${page + 1}/${totalPages}ページ）`,
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

/** /quiz my-stats のメッセージ。 */
export function buildMemberStatsMessage(stats: MemberStats): string {
  const { solo, buzz } = stats
  if (solo.totalAttempts === 0 && buzz.answeredCount === 0) {
    return `<@${stats.userId}> のこのサーバーでの記録はまだありません。\`/quiz play\` で遊ぶと記録されます。`
  }

  const lines = [
    `📊 <@${stats.userId}> の成績（このサーバー・全期間）`,
    '',
    '**🧍 1人モード**',
    solo.totalAttempts === 0
      ? '記録なし'
      : `回答 ${solo.totalAttempts}問 / 正解 ${solo.correctCount}問（正答率 ${pct(solo.correctCount, solo.totalAttempts)}）\nプレイしたクイズ: ${solo.quizCount}件`,
    '',
    '**⚡ 早押し**',
    buzz.answeredCount === 0
      ? '記録なし'
      : `回答 ${buzz.answeredCount}回 / 獲得 ${buzz.winCount}回（獲得率 ${pct(buzz.winCount, buzz.answeredCount)}）`,
  ]

  if (stats.topQuizzes.length > 0) {
    lines.push('', '**よく遊んだクイズ**')
    for (const q of stats.topQuizzes) {
      lines.push(
        `・${truncate(q.title, 40)} — ${q.totalAttempts}問中 ${q.correctCount}正解（${pct(q.correctCount, q.totalAttempts)}）`,
      )
    }
  }
  return lines.join('\n')
}

/** /quiz ranking のメッセージ。 */
export function buildRankingMessage(solo: RankingEntry[], buzz: BuzzRankingEntry[]): string {
  if (solo.length === 0 && buzz.length === 0) {
    return 'このサーバーにはまだプレイ記録がありません。`/quiz play` で遊ぶとランキングに反映されます。'
  }

  const lines = ['📊 **サーバーランキング**（全期間）', '', '**🧍 1人モード**（正解数順）']
  if (solo.length === 0) {
    lines.push('まだ記録がありません')
  } else {
    solo.forEach((e, i) => {
      lines.push(
        `${i + 1}. <@${e.userId}> — ${e.correctCount}正解 / ${e.totalAttempts}問（${pct(e.correctCount, e.totalAttempts)}）`,
      )
    })
  }

  lines.push('', '**⚡ 早押し**（獲得数順）')
  if (buzz.length === 0) {
    lines.push('まだ記録がありません')
  } else {
    buzz.forEach((e, i) => {
      lines.push(
        `${i + 1}. <@${e.userId}> — ${e.winCount}獲得 / ${e.answeredCount}回答（${pct(e.winCount, e.answeredCount)}）`,
      )
    })
  }

  const content = lines.join('\n')
  return content.length > MAX_CONTENT ? `${content.slice(0, MAX_CONTENT)}…` : content
}
