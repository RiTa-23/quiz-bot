import { Button, type Components } from 'discord-hono'

/** Discordのセレクトが一度に表示できる選択肢の上限。 */
export const PAGE_SIZE = 25

export type PageSlice<T> = {
  items: T[]
  /** 範囲内に丸めたあとのページ番号（0始まり） */
  page: number
  totalPages: number
  total: number
  /** 1ページに収まりきらず、ページ送りボタンが要るか */
  needsPaging: boolean
}

/** 一覧を1ページぶんに切り出す。範囲外のページ番号は端に丸める。 */
export function paginate<T>(all: T[], rawPage: number, size = PAGE_SIZE): PageSlice<T> {
  const totalPages = Math.max(1, Math.ceil(all.length / size))
  const page = Math.min(Math.max(0, Math.floor(rawPage) || 0), totalPages - 1)
  return {
    items: all.slice(page * size, page * size + size),
    page,
    totalPages,
    total: all.length,
    needsPaging: all.length > size,
  }
}

/**
 * ページ送りの行を必要なときだけ追加する。
 * `data` を渡すと両ボタンの custom_id に載る（ページ以外の状態を持ち回すパネル用）。
 */
export function addPageRow<T>(
  components: Components,
  slice: PageSlice<T>,
  keys: { prev: string; next: string },
  data?: string,
): void {
  if (!slice.needsPaging) return
  const prev = new Button(keys.prev, '◀ 前へ', 'Secondary').disabled(slice.page <= 0)
  const next = new Button(keys.next, '次へ ▶', 'Secondary').disabled(
    slice.page >= slice.totalPages - 1,
  )
  if (data !== undefined) {
    prev.custom_id(data)
    next.custom_id(data)
  }
  components.row(prev, next)
}

/**
 * 選択中の項目が載っているページを求める。
 * 選択後の再描画でページが先頭に戻らないよう、状態を持ち回す代わりに位置から復元する。
 */
export function pageOf<T extends { id: string }>(all: T[], id: string, size = PAGE_SIZE): number {
  const index = all.findIndex((item) => item.id === id)
  return index < 0 ? 0 : Math.floor(index / size)
}

/** 「25件中 2/3ページ」のような件数表示。ページ送りが不要なら件数だけ返す。 */
export function pageLabel<T>(slice: PageSlice<T>): string {
  if (!slice.needsPaging) return `${slice.total}件`
  return `${slice.total}件中 ${slice.page + 1}/${slice.totalPages}ページ`
}
