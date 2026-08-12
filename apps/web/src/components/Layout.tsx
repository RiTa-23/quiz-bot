import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useGuild } from '../lib/GuildContext'
import { logout } from '../lib/api'
import { Select } from './ui'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
  }`

export function Layout({ children }: { children: ReactNode }) {
  const { me, guildId, setGuildId } = useGuild()
  const navigate = useNavigate()

  const onLogout = async () => {
    await logout().catch(() => {})
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="font-semibold text-gray-900">クイズ管理</span>
          <nav className="flex gap-1">
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
          <div className="ml-auto flex items-center gap-2">
            {me.guilds.length > 0 ? (
              <Select
                value={guildId ?? ''}
                onChange={(e) => setGuildId(e.target.value)}
                className="max-w-48"
              >
                {me.guilds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <span className="text-sm text-gray-500">{me.username}</span>
            <button
              type="button"
              onClick={onLogout}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  )
}
