import { Button, Components, Modal, Select, TextInput } from 'discord-hono'

// ── コンポーネントのハンドラキー ──
export const AQ_QUIZ_SELECT = 'aqs' // クイズ選択プルダウン
export const AQ_TYPE_SELECT = 'aqt' // 出題形式プルダウン
export const AQ_PAGE_PREV = 'aqpp' // 前ページ
export const AQ_PAGE_NEXT = 'aqpn' // 次ページ
export const AQ_OPEN = 'aqo' // 入力モーダルを開く（custom_id data = quizId:type:page で状態を保持）
export const AQ_MODAL = 'aqm' // 入力モーダル送信（custom_id data = quizId:type）

// モーダルのテキスト入力ID
export const IN_BODY = 'body'
export const IN_CHOICES = 'choices'
export const IN_ANSWERS = 'answers'
export const IN_TF_ANSWER = 'tf_answer'
export const IN_EXPLANATION = 'explanation'

export const PAGE_SIZE = 25

export type QuestionType = 'multiple_choice' | 'true_false' | 'free_text'

const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'multiple_choice', label: '4択' },
  { value: 'true_false', label: '○×' },
  { value: 'free_text', label: '自由記述' },
]

export function typeLabel(type: string): string {
  return TYPE_OPTIONS.find((t) => t.value === type)?.label ?? '（未選択）'
}

export type AddQuestionState = { quizId: string; type: string; page: number }

/** 設問作成パネル。選択状態は AQ_OPEN ボタンの custom_id に埋め込んで保持する。 */
export function buildAddQuestionPanel(
  allQuizzes: { id: string; title: string }[],
  state: AddQuestionState,
): { content: string; components: Components } {
  const totalPages = Math.max(1, Math.ceil(allQuizzes.length / PAGE_SIZE))
  const page = Math.min(Math.max(0, state.page), totalPages - 1)
  const pageItems = allQuizzes.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const components = new Components()

  components.row(
    new Select(AQ_QUIZ_SELECT, 'String').options(
      ...pageItems.map((q) => ({
        label: q.title.slice(0, 100),
        value: q.id,
        default: q.id === state.quizId,
      })),
    ),
  )

  if (allQuizzes.length > PAGE_SIZE) {
    components.row(
      new Button(AQ_PAGE_PREV, '◀ 前へ', 'Secondary').disabled(page <= 0),
      new Button(AQ_PAGE_NEXT, '次へ ▶', 'Secondary').disabled(page >= totalPages - 1),
    )
  }

  components.row(
    new Select(AQ_TYPE_SELECT, 'String').options(
      ...TYPE_OPTIONS.map((t) => ({
        label: t.label,
        value: t.value,
        default: t.value === state.type,
      })),
    ),
  )

  components.row(
    new Button(AQ_OPEN, '📝 設問を入力', 'Success').custom_id(
      `${state.quizId}:${state.type}:${page}`,
    ),
  )

  const selectedTitle = allQuizzes.find((q) => q.id === state.quizId)?.title ?? '（未選択）'
  const content = [
    '**設問の追加**',
    `クイズ: ${selectedTitle}`,
    `出題形式: ${typeLabel(state.type)}`,
    'クイズと出題形式を選んで「設問を入力」を押してください。',
  ].join('\n')

  return { content, components }
}

/** 出題形式に応じた入力モーダルを組み立てる。 */
export function buildQuestionModal(quizId: string, type: QuestionType): Modal {
  const modal = new Modal(AQ_MODAL, '設問を入力').custom_id(`${quizId}:${type}`)
  modal.row(new TextInput(IN_BODY, '問題文', 'Multi').required())

  if (type === 'multiple_choice') {
    modal.row(new TextInput(IN_CHOICES, '選択肢（カンマ区切り）', 'Multi').required())
    modal.row(
      new TextInput(IN_ANSWERS, '正解（カンマ区切り。選択肢の値と一致）', 'Single').required(),
    )
  } else if (type === 'true_false') {
    modal.row(new TextInput(IN_TF_ANSWER, '正解（○ または ×）', 'Single').required())
  } else {
    modal.row(new TextInput(IN_ANSWERS, '正解パターン（カンマ区切り）', 'Multi').required())
  }

  modal.row(new TextInput(IN_EXPLANATION, '解説（任意）', 'Multi').required(false))
  return modal
}
