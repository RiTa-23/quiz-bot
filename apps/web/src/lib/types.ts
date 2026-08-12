export type QuizRole = 'owner' | 'editor' | 'shared' | 'none'
export type Visibility = 'private' | 'public'
export type QuestionType = 'multiple_choice' | 'true_false' | 'free_text'

export type Me = {
  userId: string
  username: string
  guilds: { id: string; name: string }[]
  botInstallUrl: string
}

export type Quiz = {
  id: string
  title: string
  description: string | null
  ownerUserId: string
  ownerGuildId: string
  visibility: Visibility
  createdAt: string
  updatedAt: string
  role: QuizRole
  isOwner: boolean
}

export type Question = {
  id: string
  quizId: string
  type: QuestionType
  body: string
  choices: string[] | null
  answers?: string[]
  explanation: string | null
  sortOrder: number
}

export type QuizDetail = Quiz & { questions: Question[] }

export type QuestionInput = {
  type: QuestionType
  body: string
  choices?: string[] | null
  answers: string[]
  explanation?: string | null
  sort_order?: number
}

export type EditorSettings = {
  guildAllowed: boolean
  userIds: string[]
}

export type PublicQuizListing = {
  id: string
  title: string
  description: string | null
  ownerGuildId: string
  questionCount: number
}

export type QuizQuestionStats = {
  questionId: string
  body: string
  sortOrder: number
  totalAttempts: number
  correctCount: number
  correctRate: number
}

export type QuizStats = {
  quizId: string
  title: string
  totalAttempts: number
  correctCount: number
  correctRate: number
  uniqueUserCount: number
  questions: QuizQuestionStats[]
}

export type RankingEntry = {
  userId: string
  totalAttempts: number
  correctCount: number
  correctRate: number
}

export type BuzzRankingEntry = {
  userId: string
  winCount: number
  answeredCount: number
}

export type MemberStats = {
  userId: string
  guildId: string
  solo: {
    totalAttempts: number
    correctCount: number
    correctRate: number
    quizCount: number
    lastPlayedAt: string | null
  }
  buzz: { answeredCount: number; winCount: number }
  topQuizzes: {
    quizId: string
    title: string
    totalAttempts: number
    correctCount: number
    correctRate: number
  }[]
}
