export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:8788'

/** 公開クイズの共有ページ（認証不要・OGP付き）。 */
export const shareUrl = (quizId: string) => `${API_ORIGIN}/q/${quizId}`

export type ApiError = { code: string; message: string }

export class ApiRequestError extends Error {
  code: string
  constructor(error: ApiError) {
    super(error.message)
    this.code = error.code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })

  if (res.status === 204) return undefined as T

  const json = await res.json()
  if (!res.ok) {
    throw new ApiRequestError((json as { error: ApiError }).error)
  }
  return json as T
}

const withBody = (method: string) => (path: string, body?: unknown) =>
  request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => withBody('POST')(path, body) as Promise<T>,
  patch: <T>(path: string, body?: unknown) => withBody('PATCH')(path, body) as Promise<T>,
  put: <T>(path: string, body?: unknown) => withBody('PUT')(path, body) as Promise<T>,
  delete: <T>(path: string, body?: unknown) => withBody('DELETE')(path, body) as Promise<T>,
}

export const loginUrl = () => `${API_ORIGIN}/auth/discord`
export const logout = () => api.post('/auth/logout')
