import { Link } from 'react-router-dom'
import { Badge, EmptyNote, ErrorNote, Spinner } from '../components/ui'
import { useGuild } from '../lib/GuildContext'
import { useApi } from '../lib/hooks'
import type { Quiz } from '../lib/types'

/**
 * 自分が作成したクイズ（isOwner）の一覧。サーバーに依存しない。
 * guild を選んでいる場合は、その一覧に対する「このサーバーでの利用状況」も添える
 * （role !== 'none' なら登録済み）。クイズ一覧ページはこの利用状況で絞り込むため、
 * 未登録の自作クイズはここでしか見えない。
 */
export function MyQuizzesPage() {
  const { guildId, guildName } = useGuild()
  const { data, loading, error } = useApi<Quiz[]>(
    guildId ? `/api/quizzes?guild_id=${guildId}` : '/api/quizzes',
  )

  const mine = data?.filter((q) => q.isOwner)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="break-words text-2xl">マイクイズ</h1>
        <p className="mt-1 text-sm text-navy-300">
          あなたが作成したクイズです。
          {guildId && `「登録済み / 未登録」は ${guildName(guildId)} での利用状況を表します。`}
        </p>
      </div>

      {loading && <Spinner />}
      {error && <ErrorNote message={error} />}
      {mine && mine.length === 0 && (
        <EmptyNote>
          まだクイズを作成していません。「ライブラリ」ページの「＋ 新規作成」から作れます。
        </EmptyNote>
      )}
      {mine && mine.length > 0 && (
        <ul className="divide-y divide-paper-line overflow-hidden rounded border border-paper-line bg-paper-raised shadow-panel">
          {mine.map((q) => (
            <li key={q.id}>
              <Link
                to={`/quizzes/${q.id}`}
                className="group flex items-center gap-3 p-4 transition hover:bg-paper focus-visible:bg-paper focus-visible:ring-inset focus-visible:ring-offset-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-900">{q.title}</p>
                  {q.description && (
                    <p className="truncate text-sm text-navy-300">{q.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {q.visibility === 'public' && <Badge tone="gold">公開</Badge>}
                  {guildId &&
                    (q.role !== 'none' ? (
                      <Badge tone="green">登録済み</Badge>
                    ) : (
                      <Badge tone="gray">未登録</Badge>
                    ))}
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
