import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorNote, Spinner } from './components/ui'
import { GuildProvider } from './lib/GuildContext'
import { useApi } from './lib/hooks'
import type { Me } from './lib/types'
import { LoginPage } from './pages/LoginPage'
import { PublicQuizzesPage } from './pages/PublicQuizzesPage'
import { QuizDetailPage } from './pages/QuizDetailPage'
import { QuizListPage } from './pages/QuizListPage'
import { StatsPage } from './pages/StatsPage'

/** ログイン必須の領域。/api/me でセッションを確認し、guildコンテキストを供給する。 */
function AuthedApp() {
  const { data: me, loading, unauthorized, error, reload } = useApi<Me>('/api/me')

  if (unauthorized) return <Navigate to="/login" replace />
  if (loading) return <Spinner />
  if (error || !me)
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorNote message={error ?? 'ユーザー情報を取得できませんでした'} />
      </div>
    )

  return (
    <GuildProvider me={me} reload={reload}>
      <Layout>
        <Routes>
          <Route path="/quizzes" element={<QuizListPage />} />
          <Route path="/quizzes/:id" element={<QuizDetailPage />} />
          <Route path="/public" element={<PublicQuizzesPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="*" element={<Navigate to="/quizzes" replace />} />
        </Routes>
      </Layout>
    </GuildProvider>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<AuthedApp />} />
    </Routes>
  )
}
