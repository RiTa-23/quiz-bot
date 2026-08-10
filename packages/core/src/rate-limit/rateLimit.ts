import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { Database } from '../db/client'
import { rateLimits } from '../db/schema'
import { rateLimited } from '../errors'

export type RateLimitScope = 'quiz_play' | 'answer_submit'

export type RateLimitRule = {
  windowSeconds: number
  maxCount: number
}

// 技術選定.md「レート制限の具体的な閾値」は未確定のため暫定値。運用しながら調整する。
export const RATE_LIMIT_RULES: Record<RateLimitScope, RateLimitRule> = {
  quiz_play: { windowSeconds: 10, maxCount: 1 },
  answer_submit: { windowSeconds: 5, maxCount: 3 },
}

/**
 * scope + subjectKey（例: `${guildId}:${userId}`）単位のクールダウンをチェックし、
 * 許可されれば呼び出しをカウントする。超過時は RATE_LIMITED エラーを投げる。
 */
export async function checkRateLimit(
  db: Database,
  scope: RateLimitScope,
  subjectKey: string,
): Promise<void> {
  const rule = RATE_LIMIT_RULES[scope]
  const now = Date.now()

  const [existing] = await db
    .select()
    .from(rateLimits)
    .where(and(eq(rateLimits.scope, scope), eq(rateLimits.subjectKey, subjectKey)))
    .limit(1)

  if (!existing) {
    await db.insert(rateLimits).values({
      id: randomUUID(),
      scope,
      subjectKey,
      windowStart: new Date(now).toISOString(),
      count: 1,
      updatedAt: new Date(now).toISOString(),
    })
    return
  }

  const windowStartMs = new Date(existing.windowStart).getTime()
  const withinWindow = now - windowStartMs < rule.windowSeconds * 1000

  if (!withinWindow) {
    await db
      .update(rateLimits)
      .set({ windowStart: new Date(now).toISOString(), count: 1, updatedAt: new Date(now).toISOString() })
      .where(eq(rateLimits.id, existing.id))
    return
  }

  if (existing.count >= rule.maxCount) {
    throw rateLimited()
  }

  await db
    .update(rateLimits)
    .set({ count: existing.count + 1, updatedAt: new Date(now).toISOString() })
    .where(eq(rateLimits.id, existing.id))
}
