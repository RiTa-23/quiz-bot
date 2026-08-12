import { type ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useGuild } from '../lib/GuildContext'
import { logout } from '../lib/api'
import { ErrorNote, Select } from './ui'

// 現在地は下辺の金の罫で示す。塗りつぶしより盤面の落ち着きを保てる
const navClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap border-b-2 px-3 py-3 text-sm font-bold transition ${
    isActive
      ? 'border-gold-400 text-paper'
      : 'border-transparent text-navy-200 hover:border-navy-300 hover:text-paper'
  }`

export function Layout({ children }: { children: ReactNode }) {
  const { me, guildId, setGuildId } = useGuild()
  const navigate = useNavigate()

  const [logoutError, setLogoutError] = useState<string | null>(null)

  // 失敗時に遷移すると、セッションが残ったままログアウトしたと誤認させるため留まる
  const onLogout = async () => {
    setLogoutError(null)
    try {
      await logout()
      navigate('/login')
    } catch {
      setLogoutError('ログアウトに失敗しました。通信状況を確認して、もう一度お試しください。')
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b-4 border-gold-400 bg-navy-900">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 px-4">
          <span className="whitespace-nowrap py-3 font-bold tracking-tight text-paper">
            <span className="text-gold-400">Q.</span> クイズ管理
          </span>
          <nav className="flex gap-1 overflow-x-auto">
            <NavLink to="/quizzes" className={navClass}>
              クイズ
            </NavLink>
            <NavLink to="/public" className={navClass}>
              公開クイズ
            </NavLink>
            <NavLink to="/stats" className={navClass}>
              統計
            </NavLink>
          </nav>
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3 py-2">
            {me.guilds.length > 0 ? (
              <Select
                value={guildId ?? ''}
                onChange={(e) => setGuildId(e.target.value)}
                className="min-w-0 max-w-48"
              >
                {me.guilds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <span className="max-w-32 truncate text-sm text-navy-200 sm:max-w-none">
              {me.displayName || me.username}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="shrink-0 whitespace-nowrap text-sm text-navy-200 underline-offset-2 hover:text-paper hover:underline"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        {logoutError && (
          <div className="mb-4">
            <ErrorNote message={logoutError} />
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
