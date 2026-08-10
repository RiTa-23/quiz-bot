export type AppErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'

export class AppError extends Error {
  readonly code: AppErrorCode

  constructor(code: AppErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

export const notFound = (resource: string) => new AppError('NOT_FOUND', `${resource} not found`)

export const forbidden = (message = 'この操作を行う権限がありません') =>
  new AppError('FORBIDDEN', message)

export const conflict = (message: string) => new AppError('CONFLICT', message)

export const rateLimited = (message = 'しばらく時間をおいてから再度お試しください') =>
  new AppError('RATE_LIMITED', message)

export const validationError = (message: string) => new AppError('VALIDATION_ERROR', message)
