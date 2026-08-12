import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import type { Me } from './types'

type GuildContextValue = {
  me: Me
  guildId: string | null
  setGuildId: (id: string) => void
  guildName: (id: string) => string
  reloadMe: () => void
}

const GuildContext = createContext<GuildContextValue | null>(null)

const STORAGE_KEY = 'quizbot.guildId'

export function GuildProvider({
  me,
  reload,
  children,
}: { me: Me; reload: () => void; children: ReactNode }) {
  const [guildId, setGuildIdState] = useState<string | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && me.guilds.some((g) => g.id === saved)) return saved
    return me.guilds[0]?.id ?? null
  })

  // 選択中サーバーが一覧から消えたら先頭に戻す
  useEffect(() => {
    if (guildId && !me.guilds.some((g) => g.id === guildId)) {
      setGuildIdState(me.guilds[0]?.id ?? null)
    }
  }, [guildId, me.guilds])

  const value = useMemo<GuildContextValue>(
    () => ({
      me,
      guildId,
      setGuildId: (id: string) => {
        localStorage.setItem(STORAGE_KEY, id)
        setGuildIdState(id)
      },
      guildName: (id: string) => me.guilds.find((g) => g.id === id)?.name ?? id,
      // 先にサーバー側のBot参加サーバーのキャッシュを更新してから読み直す（Bot導入直後の反映用）
      reloadMe: async () => {
        await api.get('/api/me?refresh=1').catch(() => {})
        reload()
      },
    }),
    [me, guildId, reload],
  )

  return <GuildContext.Provider value={value}>{children}</GuildContext.Provider>
}

export function useGuild(): GuildContextValue {
  const ctx = useContext(GuildContext)
  if (!ctx) throw new Error('useGuild must be used within GuildProvider')
  return ctx
}
