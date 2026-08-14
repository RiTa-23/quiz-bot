import { useState } from 'react'
import { Card, ErrorNote, NoGuildNotice, Select, Spinner } from '../components/ui'
import { useGuild } from '../lib/GuildContext'
import { useApi } from '../lib/hooks'
import type { BuzzRankingEntry, MemberStats, Quiz, QuizStats, RankingEntry } from '../lib/types'

const RANKING_SIZE = 10

const pct = (correct: number, total: number) =>
  total > 0 ? `${Math.round((correct / total) * 100)}%` : '—'

/** 自分が入っていないサーバーは名前を引けないため、IDを晒さず「他のサーバー」と表示する。 */
function guildLabel(id: string, guildName: (id: string) => string): string {
  const name = guildName(id)
  return name === id ? '他のサーバー' : name
}

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
      <h1 className="break-words text-2xl">{guildName(guildId)} の統計</h1>
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
      <h2 className="rule-gold text-lg">自分の成績</h2>
      <p className="text-sm text-navy-700">
        🧍 1人モード: {data.solo.totalAttempts}回答 / 正解 {data.solo.correctCount}（
        {pct(data.solo.correctCount, data.solo.totalAttempts)}）
      </p>
      <p className="text-sm text-navy-700">
        ⚡ 早押し: {data.buzz.answeredCount}回答 / 獲得 {data.buzz.winCount}（
        {pct(data.buzz.winCount, data.buzz.answeredCount)}）
      </p>
      {data.topQuizzes.length > 0 && (
        <div className="pt-1">
          <p className="text-sm font-medium text-navy-600">よく遊んだクイズ</p>
          <ul className="text-sm text-navy-600">
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
  const solo = useApi<RankingEntry[]>(`/api/guilds/${guildId}/stats/ranking?limit=${RANKING_SIZE}`)
  const buzz = useApi<BuzzRankingEntry[]>(
    `/api/guilds/${guildId}/stats/buzz-ranking?limit=${RANKING_SIZE}`,
  )

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <h2 className="rule-gold mb-2 text-lg">1人モード ランキング</h2>
        {solo.loading && <Spinner />}
        {!solo.loading && solo.error && <ErrorNote message={solo.error} />}
        {!solo.loading && !solo.error && solo.data?.length === 0 && (
          <p className="text-sm text-navy-300">記録なし</p>
        )}
        <ol className="space-y-1 text-sm">
          {!solo.loading &&
            !solo.error &&
            solo.data?.map((e, i) => (
              <li key={e.userId} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate">
                  {i + 1}. <UserTag id={e.userId} name={e.displayName} />
                </span>
                <span className="shrink-0 whitespace-nowrap text-navy-300">
                  {e.correctCount}正解（{pct(e.correctCount, e.totalAttempts)}）
                </span>
              </li>
            ))}
        </ol>
      </Card>
      <Card>
        <h2 className="rule-gold mb-2 text-lg">早押し ランキング</h2>
        {buzz.loading && <Spinner />}
        {!buzz.loading && buzz.error && <ErrorNote message={buzz.error} />}
        {!buzz.loading && !buzz.error && buzz.data?.length === 0 && (
          <p className="text-sm text-navy-300">記録なし</p>
        )}
        <ol className="space-y-1 text-sm">
          {!buzz.loading &&
            !buzz.error &&
            buzz.data?.map((e, i) => (
              <li key={e.userId} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate">
                  {i + 1}. <UserTag id={e.userId} name={e.displayName} />
                </span>
                <span className="shrink-0 whitespace-nowrap text-navy-300">
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
  const { guildName } = useGuild()
  const quizzes = useApi<Quiz[]>(`/api/quizzes?guild_id=${guildId}`)
  const [quizId, setQuizId] = useState<string>('')
  const [allGuilds, setAllGuilds] = useState(false)

  // 全サーバー集計は作成者だけが見られるため、他人のクイズに切り替えたら戻す
  const isOwner = quizzes.data?.find((q) => q.id === quizId)?.isOwner ?? false
  const scoped = allGuilds && isOwner
  const stats = useApi<QuizStats>(
    quizId ? `/api/quizzes/${quizId}/stats?guild_id=${guildId}${scoped ? '&scope=all' : ''}` : null,
  )

  return (
    <Card className="space-y-3">
      <h2 className="rule-gold text-lg">クイズ別の統計</h2>
      {quizzes.loading && <Spinner />}
      {!quizzes.loading && quizzes.error && <ErrorNote message={quizzes.error} />}
      {!quizzes.loading && !quizzes.error && quizzes.data?.length === 0 && (
        <p className="text-sm text-navy-300">このサーバーにはまだクイズがありません。</p>
      )}
      {!quizzes.loading && !quizzes.error && (quizzes.data?.length ?? 0) > 0 && (
        <Select value={quizId} onChange={(e) => setQuizId(e.target.value)}>
          <option value="">クイズを選択…</option>
          {quizzes.data?.map((q) => (
            <option key={q.id} value={q.id}>
              {q.title}
            </option>
          ))}
        </Select>
      )}
      {quizId && isOwner && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-navy-300">集計範囲</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setAllGuilds(false)}
              className={`rounded border px-2 py-1 font-bold ${scoped ? 'border-paper-line text-navy-600' : 'border-gold-400 bg-gold-100 text-gold-600'}`}
            >
              このサーバー
            </button>
            <button
              type="button"
              onClick={() => setAllGuilds(true)}
              className={`rounded border px-2 py-1 font-bold ${scoped ? 'border-gold-400 bg-gold-100 text-gold-600' : 'border-paper-line text-navy-600'}`}
            >
              全サーバー
            </button>
          </div>
          <span className="text-xs text-navy-200">作成者のみ</span>
        </div>
      )}
      {quizId && stats.loading && <Spinner />}
      {quizId && !stats.loading && stats.error && <ErrorNote message={stats.error} />}
      {quizId && !stats.loading && !stats.error && stats.data && (
        <div className="space-y-3">
          <p className="text-sm text-navy-700">
            {scoped ? '全サーバー合計' : 'このサーバー'}: {stats.data.totalAttempts}回答 / 正答率{' '}
            {pct(stats.data.correctCount, stats.data.totalAttempts)} / 参加者{' '}
            {stats.data.uniqueUserCount}人
          </p>
          <p className="text-sm text-navy-300">🌐 {stats.data.shareCount}サーバーが追加中</p>

          {stats.data.byGuild && (
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-navy-300">
                サーバー別
              </h3>
              {stats.data.byGuild.length === 0 ? (
                <p className="text-sm text-navy-300">まだどのサーバーでもプレイされていません。</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {stats.data.byGuild.map((g) => (
                    <li key={g.guildId} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{guildLabel(g.guildId, guildName)}</span>
                      <span className="shrink-0 whitespace-nowrap text-navy-300">
                        {pct(g.correctCount, g.totalAttempts)}（{g.totalAttempts}回 /{' '}
                        {g.uniqueUserCount}人）
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-navy-300">設問別</h3>
            <ul className="space-y-1 text-sm">
              {stats.data.questions.map((q, i) => (
                <li key={q.questionId} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {i + 1}. {q.body}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-navy-300">
                    {pct(q.correctCount, q.totalAttempts)}（{q.totalAttempts}回）
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  )
}

/**
 * ユーザー表示はDiscordの表示名に統一する。
 * 退会などで名前を引けなかった場合だけ、識別できるようIDを出す。
 */
function UserTag({ id, name }: { id: string; name: string | null }) {
  if (!name) {
    return (
      <span className="font-mono text-xs text-navy-200" title={id}>
        不明なユーザー
      </span>
    )
  }
  return (
    <span className="font-medium text-navy-900" title={id}>
      {name}
    </span>
  )
}
