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
  quizzes: { id: string; title: string; description: string | null }[] // 現在ページのクイズ
  page: number
  hasPrev: boolean
  hasNext: boolean
  totalQuizzes: number
  selectedQuizId: string | null
  selectedQuizTitle: string | null
  selectedQuizDescription: string | null
  /** 選択中クイズの設問数（出題数プルダウンの上限） */
  questionCount: number
  count: number
  mode: Mode
}

/** 早押しの参加者募集パネルの表示モデル。 */
export type LobbyView = {
  hostUserId: string
  quizTitle: string | null
  quizDescription: string | null
  count: number
  participants: string[]
  /** ホストを含めて2人以上そろい、開始できる状態か */
  canStart: boolean
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
  | {
      kind: 'ignored'
      reason: 'not-active' | 'stale' | 'not-host' | 'not-participant' | 'closed' | 'already'
    }
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

/** 設定GUIの操作結果。操作できるのはホスト（/quiz play の実行者）だけ。 */
export type ControlResult =
  | { ok: true; view: DraftView }
  | { ok: false; reason: 'not-host' | 'no-session' }

/** /quiz play の結果。進行中セッションを他人が上書きするのを防ぐ。 */
export type OpenDraftResult =
  | { ok: true; view: DraftView }
  | { ok: false; reason: 'active-session'; hostUserId: string }

/** DO.start の結果。 */
export type StartResult =
  | { ok: true; first: PublicSessionQuestion; number: number; total: number; mode: Mode }
  | {
      ok: false
      reason: 'no-quiz' | 'no-questions' | 'not-host' | 'no-session' | 'not-enough-players'
    }

/** 設定パネルのPlay押下結果。早押しは募集パネルへ、1人はそのまま開始する。 */
export type PlayResult =
  | { kind: 'lobby'; result: LobbyResult }
  | { kind: 'start'; result: StartResult }

/** 募集パネルの操作結果。 */
export type LobbyResult =
  | { ok: true; view: LobbyView }
  | { ok: false; reason: 'not-host' | 'no-session' | 'no-quiz' | 'host-cannot-join' | 'already' }

/** 回答入力（4択/○×はインデックス、自由記述はテキスト）。 */
export type AnswerInput = { kind: 'choice'; idx: number } | { kind: 'text'; text: string }
