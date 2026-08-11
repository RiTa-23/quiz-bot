import { Button, Components, Select } from 'discord-hono'

// ── コンポーネントのハンドラキー ──
export const DQ_SELECT = 'dqs' // 削除対象クイズの選択プルダウン
export const DQ_PAGE_PREV = 'dqpp' // 前ページ
export const DQ_PAGE_NEXT = 'dqpn' // 次ページ
export const DQ_CONFIRM = 'dqc' // 削除の確認へ（custom_id data = quizId:page）
export const DQ_EXECUTE = 'dqe' // 削除実行（custom_id data = quizId）
export const DQ_CANCEL = 'dqx' // キャンセル

export const PAGE_SIZE = 25

export type DeleteState = { quizId: string; page: number }

/** 削除対象を選ぶパネル。選択状態は DQ_CONFIRM ボタンの custom_id に埋め込む。 */
export function buildDeletePanel(
  allQuizzes: { id: string; title: string; description: string | null }[],
  state: DeleteState,
): { content: string; components: Components } {
  const totalPages = Math.max(1, Math.ceil(allQuizzes.length / PAGE_SIZE))
  const page = Math.min(Math.max(0, state.page), totalPages - 1)
  const pageItems = allQuizzes.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const components = new Components()

  components.row(
    new Select(DQ_SELECT, 'String').options(
      ...pageItems.map((q) => ({
        label: q.title.slice(0, 100),
        value: q.id,
        default: q.id === state.quizId,
        ...(q.description ? { description: q.description.slice(0, 100) } : {}),
      })),
    ),
  )

  if (allQuizzes.length > PAGE_SIZE) {
    components.row(
      new Button(DQ_PAGE_PREV, '◀ 前へ', 'Secondary').disabled(page <= 0),
      new Button(DQ_PAGE_NEXT, '次へ ▶', 'Secondary').disabled(page >= totalPages - 1),
    )
  }

  components.row(
    new Button(DQ_CONFIRM, '🗑 このクイズを削除', 'Danger').custom_id(`${state.quizId}:${page}`),
  )

  const selected = allQuizzes.find((q) => q.id === state.quizId)
  const lines = ['**クイズの削除**', `対象: ${selected?.title ?? '（未選択）'}`]
  if (selected?.description) lines.push(`> ${selected.description}`)
  lines.push('削除するクイズを選んでボタンを押してください。')

  return { content: lines.join('\n'), components }
}

/** 削除前の最終確認。 */
export function buildDeleteConfirm(
  quizId: string,
  title: string,
): { content: string; components: Components } {
  const components = new Components()
  components.row(
    new Button(DQ_EXECUTE, '本当に削除する', 'Danger').custom_id(quizId),
    new Button(DQ_CANCEL, 'キャンセル', 'Secondary'),
  )
  return {
    content: [
      '⚠️ **本当に削除しますか？**',
      `対象: **${title}**`,
      'このクイズの設問・共有設定・回答記録もすべて削除され、元に戻せません。',
    ].join('\n'),
    components,
  }
}
