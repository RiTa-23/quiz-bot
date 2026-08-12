import type { CommandContext, ComponentContext } from 'discord-hono'
import type { Bindings } from '../env'
import { buildHelpPanel, isHelpTopic } from './helpMessages'

/**
 * /quiz help: 使い方パネル。
 * チャンネルを汚さないよう ephemeral で出し、トピックはボタンで切り替える。
 */
export function handleHelpCommand(c: CommandContext<{ Bindings: Bindings }>) {
  return c.ephemeral().res(buildHelpPanel('play', c.env.WEB_URL))
}

export function handleHelpSelect(c: ComponentContext<{ Bindings: Bindings }>) {
  const topic = c.var.custom_id ?? ''
  return c.resUpdate(buildHelpPanel(isHelpTopic(topic) ? topic : 'play', c.env.WEB_URL))
}
