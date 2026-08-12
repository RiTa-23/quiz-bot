import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EditorSettingsCard } from '../components/EditorSettingsCard'
import { QuestionForm } from '../components/QuestionForm'
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
import type { Author, Question, QuestionInput, QuizDetail } from '../lib/types'

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: '4択',
  true_false: '○×',
  free_text: '自由記述',
}

export function QuizDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { guildId } = useGuild()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useApi<QuizDetail>(
    id ? `/api/quizzes/${id}${guildId ? `?guild_id=${guildId}` : ''}` : null,
  )
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  if (loading) return <Spinner />
  if (error || !data) return <ErrorNote message={error ?? 'クイズを取得できませんでした'} />

  const canEdit = data.isOwner || data.role === 'editor'
  const canManage = data.isOwner

  // 失敗を呼び出し側に伝える。成功時のみフォームを閉じ、入力内容を失わせない
  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setActionError(null)
    try {
      await fn()
      reload()
      return true
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '操作に失敗しました')
      return false
    }
  }

  const addQuestion = async (input: QuestionInput) => {
    if (await run(() => api.post(`/api/quizzes/${data.id}/questions`, input))) setAdding(false)
  }
  const updateQuestion = async (qid: string, input: QuestionInput) => {
    if (await run(() => api.patch(`/api/quizzes/${data.id}/questions/${qid}`, input)))
      setEditingId(null)
  }
  const deleteQuestion = (qid: string) =>
    run(() => api.delete(`/api/quizzes/${data.id}/questions/${qid}`))

  return (
    <div className="space-y-6">
      <div>
        <Link to="/quizzes" className="text-sm text-indigo-600 hover:underline">
          ← クイズ一覧
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{data.title}</h1>
            {data.description && <p className="mt-1 text-gray-500">{data.description}</p>}
            <p className="mt-1 text-xs text-gray-400">
              <AuthorLabel author={data.authors[data.ownerUserId]} authorId={data.ownerUserId} />
            </p>
          </div>
          {data.visibility === 'public' && <Badge tone="indigo">公開</Badge>}
        </div>
      </div>

      {actionError && <ErrorNote message={actionError} />}

      {canManage && (
        <QuizMetaCard quiz={data} onSaved={reload} onDeleted={() => navigate('/quizzes')} />
      )}

      {/* 設問 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">設問（{data.questions.length}）</h2>
          {canEdit && !adding && <Button onClick={() => setAdding(true)}>＋ 設問を追加</Button>}
        </div>

        {adding && (
          <Card>
            <QuestionForm onSubmit={addQuestion} onCancel={() => setAdding(false)} />
          </Card>
        )}

        {data.questions.length === 0 && !adding && (
          <p className="text-sm text-gray-500">まだ設問がありません。</p>
        )}

        <ul className="space-y-3">
          {data.questions.map((q, i) =>
            editingId === q.id ? (
              <Card key={q.id}>
                <QuestionForm
                  initial={q}
                  onSubmit={(input) => updateQuestion(q.id, input)}
                  onCancel={() => setEditingId(null)}
                />
              </Card>
            ) : (
              <QuestionRow
                key={q.id}
                index={i}
                question={q}
                author={data.authors[q.createdByUserId ?? data.ownerUserId]}
                authorId={q.createdByUserId ?? data.ownerUserId}
                canEdit={canEdit}
                onEdit={() => setEditingId(q.id)}
                onDelete={() => deleteQuestion(q.id)}
              />
            ),
          )}
        </ul>
      </section>

      {canManage && guildId && <EditorSettingsCard quizId={data.id} guildId={guildId} />}
    </div>
  )
}

/** Discordで引けなかったユーザーはIDのままにする（退会済みなどで解決できないことがある） */
function AuthorLabel({ author, authorId }: { author?: Author; authorId: string }) {
  if (!author) return <span title={`ユーザーID: ${authorId}`}>作成者: 不明（ID: {authorId}）</span>
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {author.avatarUrl && (
        <img src={author.avatarUrl} alt="" className="h-4 w-4 rounded-full" loading="lazy" />
      )}
      作成者: {author.displayName}
    </span>
  )
}

function QuestionRow({
  index,
  question,
  author,
  authorId,
  canEdit,
  onEdit,
  onDelete,
}: {
  index: number
  question: Question
  author?: Author
  authorId: string
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 flex flex-wrap items-center gap-x-1 text-xs text-gray-400">
            <span>
              #{index + 1} ・ {TYPE_LABEL[question.type]} ・
            </span>
            <AuthorLabel author={author} authorId={authorId} />
          </p>
          <p className="text-gray-900">{question.body}</p>
          {question.choices && (
            <p className="mt-1 text-sm text-gray-500">{question.choices.join(' / ')}</p>
          )}
          {question.answers && (
            <p className="mt-1 text-sm text-emerald-600">正解: {question.answers.join(' / ')}</p>
          )}
          {question.explanation && (
            <p className="mt-1 text-sm text-gray-500">解説: {question.explanation}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" onClick={onEdit}>
              編集
            </Button>
            <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={onDelete}>
              削除
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

function QuizMetaCard({
  quiz,
  onSaved,
  onDeleted,
}: {
  quiz: QuizDetail
  onSaved: () => void
  onDeleted: () => void
}) {
  const [title, setTitle] = useState(quiz.title)
  const [description, setDescription] = useState(quiz.description ?? '')
  const [visibility, setVisibility] = useState(quiz.visibility)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.patch(`/api/quizzes/${quiz.id}`, {
        title: title.trim(),
        description: description.trim() || null,
        visibility,
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm(`「${quiz.title}」を削除します。設問・回答記録もすべて消え、元に戻せません。`))
      return
    setBusy(true)
    try {
      await api.delete(`/api/quizzes/${quiz.id}`)
      onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました')
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-medium">クイズ設定</h2>
      <Field label="タイトル">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="説明">
        <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={visibility === 'public'}
          onChange={(e) => setVisibility(e.target.checked ? 'public' : 'private')}
        />
        公開する（他のサーバーが追加して使えるようにする）
      </label>
      {error && <ErrorNote message={error} />}
      <div className="flex justify-between">
        <Button variant="danger" onClick={remove} disabled={busy}>
          クイズを削除
        </Button>
        <Button onClick={save} disabled={busy || !title.trim()}>
          保存
        </Button>
      </div>
    </Card>
  )
}
