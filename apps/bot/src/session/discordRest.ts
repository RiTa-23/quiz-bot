const DISCORD_API = 'https://discord.com/api/v10'

/**
 * Botトークンでチャンネル内メッセージを編集する。
 * Interactionコンテキストの外（Durable Objectのalarm等）から出題メッセージを更新するために使う。
 */
export async function editChannelMessage(
  token: string,
  channelId: string,
  messageId: string,
  payload: { content?: string; embeds?: unknown[]; components: unknown[] },
): Promise<void> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    // 早押しの結果には <@id> が並ぶため、通知が飛ばないようメンションを解決させない
    body: JSON.stringify({ ...payload, allowed_mentions: { parse: [] } }),
  })

  // 失敗を握りつぶすとセッションだけ進んでDiscordの表示が取り残されるため、呼び出し側へ伝える
  if (!res.ok) {
    throw new Error(`Discord message edit failed: ${res.status} ${await res.text()}`)
  }
}
