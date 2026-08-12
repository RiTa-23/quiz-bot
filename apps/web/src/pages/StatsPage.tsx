import { useState } from 'react'
import { Card, ErrorNote, NoGuildNotice, Select, Spinner } from '../components/ui'
import { useGuild } from '../lib/GuildContext'
import { useApi } from '../lib/hooks'
import type { BuzzRankingEntry, MemberStats, Quiz, QuizStats, RankingEntry } from '../lib/types'

const pct = (correct: number, total: number) =>
  total > 0 ? `${Math.round((correct / total) * 100)}%` : '—'

export function StatsPage() {
  const { me, guildId, guildName, reloadMe } = useGuild()
  if (!guildId)
    return (
      <NoGuildNotice
        hasGuilds={me.guilds.length > 0}
        installUrl={me.botInstallUrl}
        onRefresh={reloadMe}
      />
    )

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{guildName(guildId)} の統計</h1>
      <MyStats guildId={guildId} />
      <Rankings guildId={guildId} />
      <PerQuizStats guildId={guildId} />
    </div>
  )
}

function MyStats({ guildId }: { guildId: string }) {
  const { data, loading, error } = useApi<MemberStats>(`/api/guilds/${guildId}/me/stats`)
  if (loading) return <Spinner />
  if (error || !data) return <ErrorNote message={error ?? '取得できませんでした'} />

  return (
    <Card className="space-y-2">
      <h2 className="text-lg font-medium">自分の成績</h2>
      <p className="text-sm text-gray-700">
        🧍 1人モード: {data.solo.totalAttempts}回答 / 正解 {data.solo.correctCount}（
        {pct(data.solo.correctCount, data.solo.totalAttempts)}）
      </p>
      <p className="text-sm text-gray-700">
        ⚡ 早押し: {data.buzz.answeredCount}回答 / 獲得 {data.buzz.winCount}（
        {pct(data.buzz.winCount, data.buzz.answeredCount)}）
      </p>
      {data.topQuizzes.length > 0 && (
        <div className="pt-1">
          <p className="text-sm font-medium text-gray-600">よく遊んだクイズ</p>
          <ul className="text-sm text-gray-600">
            {data.topQuizzes.map((q) => (
              <li key={q.quizId}>
                ・{q.title} — {q.totalAttempts}問中 {q.correctCount}正解（
                {pct(q.correctCount, q.totalAttempts)}）
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Rankings({ guildId }: { guildId: string }) {
  const solo = useApi<RankingEntry[]>(`/api/guilds/${guildId}/stats/ranking`)
  const buzz = useApi<BuzzRankingEntry[]>(`/api/guilds/${guildId}/stats/buzz-ranking`)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <h2 className="mb-2 text-lg font-medium">🧍 1人モード ランキング</h2>
        {solo.loading && <Spinner />}
        {solo.data && solo.data.length === 0 && <p className="text-sm text-gray-500">記録なし</p>}
        <ol className="space-y-1 text-sm">
          {solo.data?.slice(0, 10).map((e, i) => (
            <li key={e.userId} className="flex justify-between">
              <span>
                {i + 1}. <UserTag id={e.userId} />
              </span>
              <span className="text-gray-500">
                {e.correctCount}正解（{pct(e.correctCount, e.totalAttempts)}）
              </span>
            </li>
          ))}
        </ol>
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-medium">⚡ 早押し ランキング</h2>
        {buzz.loading && <Spinner />}
        {buzz.data && buzz.data.length === 0 && <p className="text-sm text-gray-500">記録なし</p>}
        <ol className="space-y-1 text-sm">
          {buzz.data?.slice(0, 10).map((e, i) => (
            <li key={e.userId} className="flex justify-between">
              <span>
                {i + 1}. <UserTag id={e.userId} />
              </span>
              <span className="text-gray-500">
                {e.winCount}獲得 / {e.answeredCount}回答
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

function PerQuizStats({ guildId }: { guildId: string }) {
  const quizzes = useApi<Quiz[]>(`/api/quizzes?guild_id=${guildId}`)
  const [quizId, setQuizId] = useState<string>('')
  const stats = useApi<QuizStats>(
    quizId ? `/api/quizzes/${quizId}/stats?guild_id=${guildId}` : null,
  )

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-medium">クイズ別の統計</h2>
      {quizzes.data && (
        <Select value={quizId} onChange={(e) => setQuizId(e.target.value)}>
          <option value="">クイズを選択…</option>
          {quizzes.data.map((q) => (
            <option key={q.id} value={q.id}>
              {q.title}
            </option>
          ))}
        </Select>
      )}
      {stats.loading && <Spinner />}
      {stats.error && <ErrorNote message={stats.error} />}
      {stats.data && (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            全体: {stats.data.totalAttempts}回答 / 正答率{' '}
            {pct(stats.data.correctCount, stats.data.totalAttempts)} / 参加者{' '}
            {stats.data.uniqueUserCount}人
          </p>
          <ul className="space-y-1 text-sm">
            {stats.data.questions.map((q, i) => (
              <li key={q.questionId} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">
                  {i + 1}. {q.body}
                </span>
                <span className="shrink-0 text-gray-500">
                  {pct(q.correctCount, q.totalAttempts)}（{q.totalAttempts}回）
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

/** Web側ではユーザー名解決手段が無いためIDの先頭を表示する（将来: 名前解決）。 */
function UserTag({ id }: { id: string }) {
  return <span className="font-mono text-xs text-gray-600">{id.slice(0, 8)}…</span>
}
