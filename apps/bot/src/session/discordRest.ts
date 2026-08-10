const DISCORD_API = 'https://discord.com/api/v10'

/**
 * Botトークンでチャンネル内メッセージを編集する。
 * Interactionコンテキストの外（Durable Objectのalarm等）から出題メッセージを更新するために使う。
 */
export async function editChannelMessage(
  token: string,
  channelId: string,
  messageId: string,
  payload: { content: string; components: unknown[] },
): Promise<void> {
  await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}
