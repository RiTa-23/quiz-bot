import type { CommandContext, ComponentContext } from 'discord-hono'
import type { Bindings } from '../env'
import { buildHelpPanel, isHelpTopic } from './helpMessages'

/**
 * /quiz help: 使い方パネル。
 * 既定では実行者にだけ見せ、`share: true` のときだけチャンネルに公開する
 * （説明を読みたいだけの人がチャンネルを流さずに済むようにするため）。
 */
export function handleHelpCommand(c: CommandContext<{ Bindings: Bindings }>) {
  const share = (c.var as { share?: boolean }).share === true
  const panel = buildHelpPanel('play', c.env.WEB_URL, share)
  return share ? c.res(panel) : c.ephemeral().res(panel)
}

/**
 * トピック切り替え。公開パネルは誰でも切り替えられる
 * （説明を見せ合う用途のため、実行者に限定しない）。
 */
export function handleHelpSelect(c: ComponentContext<{ Bindings: Bindings }>) {
  const [topic = '', shared] = (c.var.custom_id ?? '').split(':')
  return c.resUpdate(
    buildHelpPanel(isHelpTopic(topic) ? topic : 'play', c.env.WEB_URL, shared === 's'),
  )
}
