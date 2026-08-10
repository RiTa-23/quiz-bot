import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiRequestError, api } from '../lib/api'
import type { Quiz } from '../lib/types'

export function QuizListPage() {
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get<Quiz[]>('/api/quizzes')
      .then(setQuizzes)
      .catch((e: Error) => {
        if (e instanceof ApiRequestError && e.code === 'UNAUTHORIZED') {
          navigate('/login')
          return
        }
        setError(e.message)
      })
  }, [navigate])

  if (error) return <div className="p-6 text-red-600">読み込みに失敗しました: {error}</div>
  if (!quizzes) return <div className="p-6 text-gray-500">読み込み中...</div>

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">クイズ一覧</h1>
      {quizzes.length === 0 ? (
        <p className="text-gray-500">クイズがまだありません。</p>
      ) : (
        <ul className="divide-y rounded-md border bg-white">
          {quizzes.map((quiz) => (
            <li key={quiz.id} className="p-4 hover:bg-gray-50">
              <Link to={`/quizzes/${quiz.id}`} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{quiz.title}</p>
                  <p className="text-sm text-gray-500">{quiz.description}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                  {quiz.role}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
