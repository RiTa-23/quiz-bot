import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useApi } from '../lib/hooks'
import type { EditorSettings } from '../lib/types'
import { Button, Card, ErrorNote, Spinner, TextArea } from './ui'

/**
 * 編集権限の設定（作成者のみ）。
 * - このサーバー全員への許可トグル
 * - 個別ユーザー（DiscordユーザーID）指定
 * Botの User Select と違いWebでは検索できないため、IDを1行ずつ入力する。
 */
export function EditorSettingsCard({ quizId, guildId }: { quizId: string; guildId: string }) {
  const { data, loading, error, reload } = useApi<EditorSettings>(
    `/api/quizzes/${quizId}/editors?guild_id=${guildId}`,
  )
  const [usersText, setUsersText] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (data) setUsersText(data.userIds.join('\n'))
  }, [data])

  if (loading) return <Spinner label="編集権限を読み込み中…" />
  if (error || !data) return <ErrorNote message={error ?? '編集権限を取得できませんでした'} />

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setActionError(null)
    try {
      await fn()
      reload()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '操作に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const toggleGuild = (allowed: boolean) =>
    run(() => api.put(`/api/quizzes/${quizId}/editors/guild`, { guild_id: guildId, allowed }))

  const saveUsers = () =>
    run(() =>
      api.put(`/api/quizzes/${quizId}/editors/users`, {
        user_ids: usersText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    )

  return (
    <Card className="space-y-3">
      <h2 className="rule-gold text-lg">編集権限</h2>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={data.guildAllowed}
          disabled={busy}
          onChange={(e) => toggleGuild(e.target.checked)}
        />
        このサーバーの全員に編集を許可する
      </label>

      {!data.guildAllowed && (
        <div className="space-y-2">
          <p className="text-sm text-navy-600">
            個別に許可するユーザー（DiscordユーザーIDを1行に1つ）
          </p>
          <TextArea
            value={usersText}
            onChange={(e) => setUsersText(e.target.value)}
            placeholder={'123456789012345678\n234567890123456789'}
          />
          <div className="flex justify-end">
            <Button onClick={saveUsers} disabled={busy}>
              ユーザー指定を保存
            </Button>
          </div>
        </div>
      )}

      {actionError && <ErrorNote message={actionError} />}
    </Card>
  )
}
