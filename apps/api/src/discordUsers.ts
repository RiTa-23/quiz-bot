import type { Bindings } from './env'

const DISCORD_API = 'https://discord.com/api/v10'
const CACHE_PREFIX = 'user:'
const CACHE_TTL_SECONDS = 60 * 60

export type DiscordUserSummary = {
  id: string
  /** 表示名。global_name があればそれ、無ければ username */
  displayName: string
  avatarUrl: string | null
}

type DiscordUserResponse = {
  id: string
  username: string
  global_name?: string | null
  avatar?: string | null
}

function toSummary(user: DiscordUserResponse): DiscordUserSummary {
  return {
    id: user.id,
    displayName: user.global_name || user.username,
    avatarUrl: user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
      : null,
  }
}

async function fetchOne(env: Bindings, userId: string): Promise<DiscordUserSummary | null> {
  const cached = await env.SESSIONS.get(`${CACHE_PREFIX}${userId}`)
  if (cached) return JSON.parse(cached) as DiscordUserSummary

  const res = await fetch(`${DISCORD_API}/users/${userId}`, {
    headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
  })
  // 退会済みなどで引けない場合もあるため、失敗は握りつぶして呼び出し側でIDにフォールバックさせる
  if (!res.ok) return null

  const summary = toSummary((await res.json()) as DiscordUserResponse)
  await env.SESSIONS.put(`${CACHE_PREFIX}${userId}`, JSON.stringify(summary), {
    expirationTtl: CACHE_TTL_SECONDS,
  })
  return summary
}

/**
 * ユーザーIDから表示名を引く。ユーザー名はDBに保持せず都度解決する（改名に追随するため）。
 * Discordのレート制限を避けるためKVに1時間キャッシュし、引けなかったIDは結果に含めない。
 */
export async function fetchUserSummaries(
  env: Bindings,
  userIds: string[],
): Promise<Record<string, DiscordUserSummary>> {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0 || !env.DISCORD_TOKEN) return {}

  const results = await Promise.all(
    unique.map(async (id) => {
      try {
        return await fetchOne(env, id)
      } catch (error) {
        console.error('fetchUserSummary failed', id, error)
        return null
      }
    }),
  )

  const map: Record<string, DiscordUserSummary> = {}
  for (const user of results) {
    if (user) map[user.id] = user
  }
  return map
}
