import type { Bindings } from './env'

const DISCORD_API = 'https://discord.com/api/v10'
const CACHE_PREFIX = 'user:'
const CACHE_TTL_SECONDS = 60 * 60
const FETCH_TIMEOUT_MS = 3000
const MAX_CONCURRENCY = 8

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

/** キャッシュはあくまで高速化のためのもの。読めなくても壊れた値でもDiscordに問い合わせ直す。 */
async function readCache(env: Bindings, userId: string): Promise<DiscordUserSummary | null> {
  try {
    const cached = await env.SESSIONS.get(`${CACHE_PREFIX}${userId}`)
    return cached ? (JSON.parse(cached) as DiscordUserSummary) : null
  } catch (error) {
    console.error('user cache read failed', userId, error)
    return null
  }
}

async function writeCache(env: Bindings, summary: DiscordUserSummary): Promise<void> {
  try {
    await env.SESSIONS.put(`${CACHE_PREFIX}${summary.id}`, JSON.stringify(summary), {
      expirationTtl: CACHE_TTL_SECONDS,
    })
  } catch (error) {
    console.error('user cache write failed', summary.id, error)
  }
}

async function fetchOne(env: Bindings, userId: string): Promise<DiscordUserSummary | null> {
  const cached = await readCache(env, userId)
  if (cached) return cached

  // Discordが応答しないときにクイズ詳細ごと待たされないよう、明示的に打ち切る
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${DISCORD_API}/users/${userId}`, {
      headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  // 退会済みなどで引けない場合もあるため、失敗は握りつぶして呼び出し側でIDにフォールバックさせる
  if (!res.ok) return null

  const summary = toSummary((await res.json()) as DiscordUserResponse)
  await writeCache(env, summary)
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

  const map: Record<string, DiscordUserSummary> = {}
  // 設問ごとに作成者が違うと同時リクエストが増えるため、Workersのサブリクエスト上限に
  // 触れないよう小分けにする。1件失敗しても他の作成者名は返す。
  for (let i = 0; i < unique.length; i += MAX_CONCURRENCY) {
    const results = await Promise.all(
      unique.slice(i, i + MAX_CONCURRENCY).map(async (id) => {
        try {
          return await fetchOne(env, id)
        } catch (error) {
          console.error('fetchUserSummary failed', id, error)
          return null
        }
      }),
    )
    for (const user of results) {
      if (user) map[user.id] = user
    }
  }
  return map
}
