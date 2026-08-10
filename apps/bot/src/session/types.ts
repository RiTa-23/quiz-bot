export type Mode = 'solo' | 'buzz'

export type SessionQuestionType = 'multiple_choice' | 'true_false' | 'free_text'

/** Discordに出してよい設問情報（正解・解説を含まない）。 */
export type PublicSessionQuestion = {
  id: string
  type: SessionQuestionType
  body: string
  choices: string[] | null
}

/** 出題設定GUIの表示モデル。 */
export type DraftView = {
  quizzes: { id: string; title: string }[] // 現在ページのクイズ
  page: number
  hasPrev: boolean
  hasNext: boolean
  totalQuizzes: number
  selectedQuizId: string | null
  selectedQuizTitle: string | null
  count: number
  mode: Mode
}

export type SummaryData =
  | { mode: 'solo'; correct: number; total: number }
  | { mode: 'buzz'; total: number; scores: { userId: string; score: number }[] }

/** 次の一手（次の設問 or 終了サマリ）。 */
export type NextStep =
  | { done: false; question: PublicSessionQuestion; number: number; total: number }
  | { done: true; summary: SummaryData }

/** DO.answer の結果。 */
export type AnswerOutcome =
  | { kind: 'ignored'; reason: 'not-active' | 'stale' | 'not-host' | 'closed' | 'already' }
  | {
      kind: 'solo-result'
      correct: boolean
      correctAnswers: string[]
      explanation: string | null
      next: NextStep
    }
  | { kind: 'buzz-wrong' }
  | {
      kind: 'buzz-win'
      winnerId: string
      correctAnswers: string[]
      explanation: string | null
      next: NextStep
    }

/** DO.start の結果。 */
export type StartResult =
  | { ok: true; first: PublicSessionQuestion; number: number; total: number; mode: Mode }
  | { ok: false; reason: 'no-quiz' | 'no-questions' }

/** 回答入力（4択/○×はインデックス、自由記述はテキスト）。 */
export type AnswerInput = { kind: 'choice'; idx: number } | { kind: 'text'; text: string }
