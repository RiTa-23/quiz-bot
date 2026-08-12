import { useState } from 'react'
import { Badge, Button, Card, ErrorNote, NoGuildNotice, Spinner, TextInput } from '../components/ui'
import { useGuild } from '../lib/GuildContext'
import { api } from '../lib/api'
import { useApi } from '../lib/hooks'
import type { PublicQuizListing } from '../lib/types'

export function PublicQuizzesPage() {
  const { me, guildId, guildName, reloadMe } = useGuild()
  const [keyword, setKeyword] = useState('')
  const [applied, setApplied] = useState('')

  const listPath = guildId
    ? `/api/quizzes/public?guild_id=${guildId}${applied ? `&keyword=${encodeURIComponent(applied)}` : ''}`
    : null
  const { data, loading, error, reload } = useApi<PublicQuizListing[]>(listPath)
  const added = useApi<PublicQuizListing[]>(
    guildId ? `/api/quizzes/added?guild_id=${guildId}` : null,
  )
  const [actionError, setActionError] = useState<string | null>(null)

  if (!guildId)
    return (
      <NoGuildNotice
        hasGuilds={me.guilds.length > 0}
        installUrl={me.botInstallUrl}
        onRefresh={reloadMe}
      />
    )

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null)
    try {
      await fn()
      reload()
      added.reload()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '操作に失敗しました')
    }
  }

  const add = (quizId: string) =>
    run(() => api.post(`/api/quizzes/${quizId}/shares`, { target_guild_id: guildId }))
  const remove = (quizId: string) =>
    run(() => api.delete(`/api/quizzes/${quizId}/shares`, { target_guild_id: guildId }))

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">公開クイズ（{guildName(guildId)} に追加）</h1>
      {actionError && <ErrorNote message={actionError} />}

      <div className="flex gap-2">
        <TextInput
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="タイトルで検索"
          onKeyDown={(e) => e.key === 'Enter' && setApplied(keyword)}
        />
        <Button onClick={() => setApplied(keyword)}>検索</Button>
        {applied && (
          <Button
            variant="secondary"
            onClick={() => {
              setKeyword('')
              setApplied('')
            }}
          >
            クリア
          </Button>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-500">追加できるクイズ</h2>
        {loading && <Spinner />}
        {error && <ErrorNote message={error} />}
        {data && data.length === 0 && (
          <p className="text-sm text-gray-500">
            {applied
              ? '該当する公開クイズが見つかりませんでした。'
              : '追加できる公開クイズはありません。'}
          </p>
        )}
        {data?.map((q) => (
          <Card key={q.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{q.title}</p>
              <p className="text-sm text-gray-500">
                {q.questionCount}問{q.description ? ` ・ ${q.description}` : ''}
              </p>
            </div>
            <Button onClick={() => add(q.id)}>追加</Button>
          </Card>
        ))}
      </section>

      {added.data && added.data.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500">追加済み</h2>
          {added.data.map((q) => (
            <Card key={q.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{q.title}</p>
                <p className="text-sm text-gray-500">{q.questionCount}問</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="green">追加済み</Badge>
                <Button variant="secondary" onClick={() => remove(q.id)}>
                  外す
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  )
}
