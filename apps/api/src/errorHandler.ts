import { AppError, type AppErrorCode } from '@quiz-bot/core'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

const STATUS_BY_CODE: Record<AppErrorCode, ContentfulStatusCode> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  VALIDATION_ERROR: 422,
}

export function handleApiError(c: Context, error: unknown): Response {
  if (error instanceof AppError) {
    return c.json(
      { error: { code: error.code, message: error.message } },
      STATUS_BY_CODE[error.code],
    )
  }
  console.error(error)
  return c.json({ error: { code: 'INTERNAL', message: 'internal server error' } }, 500)
}
