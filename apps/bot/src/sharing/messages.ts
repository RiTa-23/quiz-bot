import type { PublicQuizListing } from '@quiz-bot/core'
import { Button, Components, Modal, Select, TextInput } from 'discord-hono'

// ── コンポーネントのハンドラキー ──
export const PUB_SELECT = 'pbs' // 公開クイズ選択プルダウン
export const PUB_SEARCH_OPEN = 'pbo' // 検索モーダルを開く（custom_id data = keyword）
export const PUB_SEARCH_MODAL = 'pbm' // 検索モーダル送信
export const PUB_CLEAR = 'pbc' // 検索条件をクリア
export const RM_SELECT = 'rms' // 追加済みクイズの取り外しプルダウン
export const VIS_SELECT = 'vss' // 公開設定を変えるクイズの選択
export const VIS_PUBLIC = 'vsp' // 公開にする（custom_id data = quizId）
export const VIS_PRIVATE = 'vsl' // サーバー限定にする（custom_id data = quizId）

export const KEYWORD_INPUT = 'keyword'
const LIST_LIMIT = 25

export type OwnedQuiz = { id: string; title: string; visibility: 'private' | 'public' }

export const visibilityLabel = (v: 'private' | 'public') =>
  v === 'public' ? '🌐 公開' : '🔒 サーバー限定'

/** 公開設定パネル。選択中のクイズIDはボタンの custom_id に保持する。 */
export function buildVisibilityPanel(
  quizzes: OwnedQuiz[],
  selectedId: string,
): { content: string; components: Components } {
  const components = new Components()
  const selected = quizzes.find((q) => q.id === selectedId)

  components.row(
    new Select(VIS_SELECT, 'String').options(
      ...quizzes.slice(0, LIST_LIMIT).map((q) => ({
        label: q.title.slice(0, 100),
        value: q.id,
        description: visibilityLabel(q.visibility),
        default: q.id === selectedId,
      })),
    ),
  )

  if (selected) {
    components.row(
      new Button(VIS_PUBLIC, '🌐 公開にする', 'Success')
        .custom_id(selected.id)
        .disabled(selected.visibility === 'public'),
      new Button(VIS_PRIVATE, '🔒 サーバー限定にする', 'Secondary')
        .custom_id(selected.id)
        .disabled(selected.visibility === 'private'),
    )
  }

  const lines = ['⚙️ **クイズの公開設定**']
  if (selected) {
    lines.push(`対象: ${selected.title}`, `現在: ${visibilityLabel(selected.visibility)}`)
  } else {
    lines.push('設定を変えるクイズを選んでください。')
  }
  lines.push('公開にすると、他のサーバーが `/quiz add-public` で追加できるようになります。')

  return { content: lines.join('\n'), components }
}

/** 公開クイズの一覧・検索パネル。検索語は検索ボタンの custom_id に保持する。 */
export function buildPublicPanel(
  quizzes: PublicQuizListing[],
  keyword: string,
): { content: string; components: Components } {
  const components = new Components()

  if (quizzes.length > 0) {
    components.row(
      new Select(PUB_SELECT, 'String').options(
        ...quizzes.slice(0, LIST_LIMIT).map((q) => ({
          label: q.title.slice(0, 100),
          value: q.id,
          description: `${q.questionCount}問${q.description ? ` / ${q.description}` : ''}`.slice(
            0,
            100,
          ),
        })),
      ),
    )
  }

  const searchButton = new Button(PUB_SEARCH_OPEN, '🔍 タイトルで検索', 'Primary').custom_id(
    keyword,
  )
  if (keyword) {
    components.row(searchButton, new Button(PUB_CLEAR, '検索条件をクリア', 'Secondary'))
  } else {
    components.row(searchButton)
  }

  const lines = ['🌐 **公開クイズを追加**']
  if (keyword) lines.push(`検索: 「${keyword}」`)
  lines.push(
    quizzes.length === 0
      ? keyword
        ? '該当する公開クイズが見つかりませんでした。'
        : '追加できる公開クイズがまだありません。'
      : `追加したいクイズを選んでください。（${quizzes.length}件${quizzes.length >= LIST_LIMIT ? '以上' : ''}）`,
  )
  lines.push('※ 追加済みのクイズと、このサーバーのクイズは一覧に出ません。')

  return { content: lines.join('\n'), components }
}

/** タイトル検索モーダル。 */
export function buildSearchModal(current: string): Modal {
  const input = new TextInput(KEYWORD_INPUT, 'クイズのタイトル（一部でも可）', 'Single').required(
    false,
  )
  if (current) input.value(current)
  return new Modal(PUB_SEARCH_MODAL, '公開クイズを検索').row(input)
}

/** 追加済みクイズの取り外しパネル。 */
export function buildRemovePanel(quizzes: PublicQuizListing[]): {
  content: string
  components: Components
} {
  const components = new Components()
  if (quizzes.length > 0) {
    components.row(
      new Select(RM_SELECT, 'String').options(
        ...quizzes.slice(0, LIST_LIMIT).map((q) => ({
          label: q.title.slice(0, 100),
          value: q.id,
          description: `${q.questionCount}問`.slice(0, 100),
        })),
      ),
    )
  }

  const content =
    quizzes.length === 0
      ? 'このサーバーに追加した公開クイズはありません。'
      : [
          '🌐 **追加した公開クイズを外す**',
          '外すクイズを選んでください。元のクイズ自体は削除されません。',
        ].join('\n')

  return { content, components }
}
