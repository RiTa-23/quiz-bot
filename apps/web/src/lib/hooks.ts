import { useCallback, useEffect, useState } from 'react'
import { ApiRequestError, api } from './api'

export type AsyncState<T> = {
  data: T | null
  loading: boolean
  error: string | null
  unauthorized: boolean
  reload: () => void
}

/** GET を叩いて状態を返すフック。path が null の間は待機する。 */
export function useApi<T>(path: string | null): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unauthorized, setUnauthorized] = useState(false)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((n) => n + 1), [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick で明示的に再取得する
  useEffect(() => {
    if (path === null) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .get<T>(path)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        if (e instanceof ApiRequestError && e.code === 'UNAUTHORIZED') {
          setUnauthorized(true)
        } else {
          setError(e instanceof Error ? e.message : '読み込みに失敗しました')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [path, tick])

  return { data, loading, error, unauthorized, reload }
}
