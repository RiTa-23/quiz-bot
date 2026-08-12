import type { EditorSettings } from '@quiz-bot/core'
import { Button, Components, Select } from 'discord-hono'
import { addPageRow, pageLabel, paginate } from '../paging'

// ── コンポーネントのハンドラキー ──
export const ED_QUIZ_SELECT = 'eds' // 対象クイズの選択
export const ED_GUILD_ON = 'edon' // サーバー全員に許可（custom_id data = quizId）
export const ED_GUILD_OFF = 'edoff' // サーバー全員への許可を解除（同上）
export const ED_USER_SELECT = 'edu' // 個別ユーザー指定（custom_id data = quizId）
export const ED_PAGE_PREV = 'edpp' // 前ページ（custom_id data = page:quizId）
export const ED_PAGE_NEXT = 'edpn' // 次ページ（同上）

/** Discordのセレクトが一度に選べる上限 */
const MAX_USERS = 25

/**
 * 編集権限の設定パネル。
 * 選択中のクイズIDは各コンポーネントの custom_id に持たせる。
 */
export function buildEditorPanel(
  quizzes: { id: string; title: string }[],
  selectedId: string,
  settings: EditorSettings | null,
  page = 0,
): { content: string; components: Components } {
  const components = new Components()
  const selected = quizzes.find((q) => q.id === selectedId)
  const slice = paginate(quizzes, page)

  components.row(
    new Select(ED_QUIZ_SELECT, 'String').options(
      ...slice.items.map((q) => ({
        label: q.title.slice(0, 100),
        value: q.id,
        default: q.id === selectedId,
      })),
    ),
  )
  addPageRow(
    components,
    slice,
    { prev: ED_PAGE_PREV, next: ED_PAGE_NEXT },
    `${slice.page}:${selectedId}`,
  )

  if (selected && settings) {
    // サーバー全員への許可トグル（現在の状態と逆の操作だけを押せるようにする）
    components.row(
      new Button(ED_GUILD_ON, '👥 サーバー全員に許可', 'Success')
        .custom_id(selected.id)
        .disabled(settings.guildAllowed),
      new Button(ED_GUILD_OFF, '解除する', 'Secondary')
        .custom_id(selected.id)
        .disabled(!settings.guildAllowed),
    )

    // 全員に許可しているときは個別指定を出さない（不要なため）
    // 上限を超えている場合もセレクトを出さない。表示しきれない人が選択から漏れ、
    // 「選んだ集合に揃える」動作によって黙って権限を失うため
    if (!settings.guildAllowed && settings.userIds.length <= MAX_USERS) {
      components.row(
        new Select(ED_USER_SELECT, 'User')
          .custom_id(selected.id)
          .min_values(0)
          .max_values(MAX_USERS)
          .placeholder('編集を許可するユーザーを検索・選択（複数可）')
          .default_values(...settings.userIds.map((id) => ({ id, type: 'user' as const }))),
      )
    }
  }

  const lines = ['🛠 **編集権限の設定**']
  if (!selected) {
    lines.push(`設定するクイズを選んでください。（${pageLabel(slice)}）`)
  } else {
    lines.push(`対象: ${selected.title}`, '')
    if (settings?.guildAllowed) {
      lines.push('現在: **このサーバーの全員が編集できます**')
      lines.push('個別指定に切り替えるには「解除する」を押してください。')
    } else {
      lines.push('現在: **サーバー全員への許可はオフ**')
      lines.push(
        settings && settings.userIds.length > 0
          ? `個別に許可中: ${settings.userIds.map((id) => `<@${id}>`).join(' ')}`
          : '個別に許可しているユーザーはいません。',
      )
      if (settings && settings.userIds.length > MAX_USERS) {
        lines.push(
          `⚠️ 個別許可が${MAX_USERS}人を超えているため、ここでは編集できません（誤って権限を失わないようメニューを表示していません）。`,
        )
      } else {
        lines.push(
          '下のメニューで選び直すと、その内容に置き換わります（選択を空にすると全員解除）。',
        )
      }
    }
  }

  return { content: lines.join('\n'), components }
}

/** メンションで通知が飛ばないようにする。 */
export const NO_PING = { allowed_mentions: { parse: [] as string[] } }
