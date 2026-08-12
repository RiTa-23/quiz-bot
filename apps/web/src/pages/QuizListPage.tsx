import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
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
  const { guildId, guildName } = useGuild()
  const { data, loading, error, reload } = useApi<Quiz[]>(
    guildId ? `/api/quizzes?guild_id=${guildId}` : null,
  )
  const [creating, setCreating] = useState(false)

  if (!guildId) return <ErrorNote message="操作するサーバーを選択してください。" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{guildName(guildId)} のクイズ</h1>
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
      {data && data.length === 0 && (
        <p className="text-sm text-gray-500">まだクイズがありません。「新規作成」から作れます。</p>
      )}
      {data && data.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {data.map((q) => (
            <li key={q.id} className="p-4 hover:bg-gray-50">
              <Link to={`/quizzes/${q.id}`} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{q.title}</p>
                  {q.description && (
                    <p className="truncate text-sm text-gray-500">{q.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {q.visibility === 'public' && <Badge tone="indigo">公開</Badge>}
                  <Badge tone={q.isOwner ? 'green' : 'gray'}>{ROLE_LABEL[q.role] ?? q.role}</Badge>
                </div>
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
