import { Embed } from 'discord-hono'

/**
 * Botの表示色。Webと同じクイズ番組の配色にそろえる。
 * Discordの埋め込みは左端の色帯で種類を見分けさせるため、用途ごとに固定する。
 */
export const COLOR = {
  navy: 0x0b1b3a,
  gold: 0xe8b341,
  correct: 0x2e9e6b,
  wrong: 0xc8452f,
  muted: 0x6e82ab,
} as const

type Field = { name: string; value: string; inline?: boolean }

type PanelInput = {
  title: string
  description?: string
  color?: number
  fields?: Field[]
  footer?: string
}

/** 設定・管理パネル用の埋め込み。 */
export function panelEmbed({ title, description, color, fields, footer }: PanelInput): Embed {
  const embed = new Embed().title(title).color(color ?? COLOR.navy)
  if (description) embed.description(description)
  if (fields?.length) embed.fields(...fields)
  if (footer) embed.footer({ text: footer })
  return embed
}

/** 一覧が空のときなど、操作を促す控えめな埋め込み。 */
export function noticeEmbed(title: string, description: string): Embed {
  return new Embed().title(title).description(description).color(COLOR.muted)
}

/** 操作完了の通知。 */
export function successEmbed(title: string, description?: string): Embed {
  const embed = new Embed().title(title).color(COLOR.correct)
  if (description) embed.description(description)
  return embed
}
