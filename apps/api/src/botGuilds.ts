import type { Bindings } from './env'

const DISCORD_API = 'https://discord.com/api/v10'
const CACHE_KEY = 'bot:guild_ids'
const CACHE_TTL_SECONDS = 60
const PAGE_LIMIT = 200
const MAX_PAGES = 50

/**
 * Botが参加しているサーバーIDの集合。Discordのレート制限を避けるためKVに短時間キャッシュする。
 * 取得できない場合は null を返し、呼び出し側は「絞り込まない」フォールバックを取る
 * （Botの一覧が引けないことを理由にユーザーの操作を止めない）。
 *
 * forceRefresh: Bot導入直後にキャッシュ切れを待たせないための明示的な再取得。
 */
export async function fetchBotGuildIds(
  env: Bindings,
  opts: { forceRefresh?: boolean } = {},
): Promise<Set<string> | null> {
  if (!env.DISCORD_TOKEN) return null

  if (!opts.forceRefresh) {
    const cached = await env.SESSIONS.get(CACHE_KEY)
    if (cached) return new Set(JSON.parse(cached) as string[])
  }

  const ids: string[] = []
  let after: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${DISCORD_API}/users/@me/guilds`)
    url.searchParams.set('limit', String(PAGE_LIMIT))
    if (after) url.searchParams.set('after', after)

    const res = await fetch(url, { headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` } })
    if (!res.ok) return null

    const batch = (await res.json()) as { id: string }[]
    for (const g of batch) ids.push(g.id)
    if (batch.length < PAGE_LIMIT) break
    after = batch[batch.length - 1]?.id
    if (!after) break
  }

  await env.SESSIONS.put(CACHE_KEY, JSON.stringify(ids), { expirationTtl: CACHE_TTL_SECONDS })
  return new Set(ids)
}
