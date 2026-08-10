import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { QuizDetail } from '../lib/types'

export function QuizDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [quiz, setQuiz] = useState<QuizDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api
      .get<QuizDetail>(`/api/quizzes/${id}`)
      .then(setQuiz)
      .catch((e: Error) => setError(e.message))
  }, [id])

  if (error) return <div className="p-6 text-red-600">読み込みに失敗しました: {error}</div>
  if (!quiz) return <div className="p-6 text-gray-500">読み込み中...</div>

  const canEdit = quiz.role === 'owner' || quiz.role === 'editor'

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">{quiz.title}</h1>
      <p className="mb-6 text-gray-500">{quiz.description}</p>

      <h2 className="mb-2 text-lg font-medium">設問一覧</h2>
      <ul className="space-y-3">
        {quiz.questions.map((q, i) => (
          <li key={q.id} className="rounded-md border bg-white p-4">
            <p className="mb-1 text-sm text-gray-400">
              #{i + 1} ({q.type})
            </p>
            <p className="mb-2">{q.body}</p>
            {q.choices && <p className="text-sm text-gray-500">{q.choices.join(' / ')}</p>}
            {canEdit && q.answers && (
              <p className="mt-2 text-sm text-emerald-600">正解: {q.answers.join(' / ')}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
