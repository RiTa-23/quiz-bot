import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  EmptyNote,
  ErrorNote,
  Field,
  NoGuildNotice,
  Spinner,
  TextArea,
  TextInput,
} from '../components/ui'
import { useGuild } from '../lib/GuildContext'
import { api } from '../lib/api'
import { useApi } from '../lib/hooks'
import type { Quiz } from '../lib/types'

const ROLE_LABEL: Record<string, string> = {
  owner: '作成者',
  editor: '編集可',
  shared: '追加済み',
  none: '—',
}

export function QuizListPage() {
  const { me, guildId, guildName, reloadMe } = useGuild()
  const { data, loading, error, reload } = useApi<Quiz[]>(
    guildId ? `/api/quizzes?guild_id=${guildId}` : null,
  )
  const [creating, setCreating] = useState(false)

  if (!guildId)
    return (
      <NoGuildNotice
        hasGuilds={me.guilds.length > 0}
        installUrl={me.botInstallUrl}
        onRefresh={reloadMe}
      />
    )

  // このサーバーで使えるクイズだけを出す（作成元 / 追加済み公開クイズ / Editor指定）。
  // 自分が作成しただけで未登録のクイズは role が none になり、マイクイズ側に出る。
  const visible = data?.filter((q) => q.role !== 'none')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="min-w-0 break-words text-2xl">{guildName(guildId)} のクイズ</h1>
        <Button onClick={() => setCreating((v) => !v)}>
          {creating ? '閉じる' : '＋ 新規作成'}
        </Button>
      </div>

      {creating && (
        <CreateQuizForm
          guildId={guildId}
          onCreated={() => {
            setCreating(false)
            reload()
          }}
        />
      )}

      {loading && <Spinner />}
      {error && <ErrorNote message={error} />}
      {visible && visible.length === 0 && (
        <EmptyNote>
          このサーバーで使えるクイズはありません。「＋
          新規作成」で作るか、「みつける」から追加できます。
          <br />
          自分が作成したクイズは「マイクイズ」で確認できます。
        </EmptyNote>
      )}
      {visible && visible.length > 0 && (
        <ul className="divide-y divide-paper-line overflow-hidden rounded border border-paper-line bg-paper-raised shadow-panel">
          {visible.map((q) => (
            <li key={q.id}>
              <Link
                to={`/quizzes/${q.id}`}
                className="group flex items-center gap-3 p-4 transition hover:bg-paper focus-visible:bg-paper"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-900">{q.title}</p>
                  {q.description && (
                    <p className="truncate text-sm text-navy-300">{q.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {q.visibility === 'public' && <Badge tone="gold">公開</Badge>}
                  <Badge tone={q.isOwner ? 'green' : 'gray'}>{ROLE_LABEL[q.role] ?? q.role}</Badge>
                </div>
                <span
                  aria-hidden
                  className="shrink-0 text-navy-200 transition group-hover:translate-x-0.5 group-hover:text-gold-500"
                >
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CreateQuizForm({ guildId, onCreated }: { guildId: string; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/api/quizzes', {
        title: title.trim(),
        description: description.trim() || null,
        owner_guild_id: guildId,
      })
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : '作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="space-y-3">
      <Field label="タイトル">
        <TextInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: 日本史クイズ"
        />
      </Field>
      <Field label="説明（任意）">
        <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {error && <ErrorNote message={error} />}
      <div className="flex justify-end">
        <Button onClick={submit} disabled={submitting || !title.trim()}>
          作成
        </Button>
      </div>
    </Card>
  )
}
