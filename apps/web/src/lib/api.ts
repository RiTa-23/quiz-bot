const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:8788'

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

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export const loginUrl = () => `${API_ORIGIN}/auth/discord`
