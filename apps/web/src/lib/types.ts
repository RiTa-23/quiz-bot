export type QuizRole = 'owner' | 'editor' | 'shared' | 'none'
export type Visibility = 'private' | 'public'
export type QuestionType = 'multiple_choice' | 'true_false' | 'free_text'

export type Me = {
  userId: string
  username: string
  /** Discordの表示名。画面上のユーザー表示はこれに統一する */
  displayName: string
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
  /** 設問を追加したユーザーID。未設定の設問はクイズ作成者として扱う */
  createdByUserId: string | null
}

export type Author = {
  id: string
  displayName: string
  avatarUrl: string | null
}

export type QuizDetail = Quiz & {
  questions: Question[]
  /** 作成者IDから表示名への対応。Discordで引けなかったユーザーは含まれない */
  authors: Record<string, Author>
}

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
  /** このクイズを追加しているサーバー数（人気度） */
  shareCount: number
}

export type QuizQuestionStats = {
  questionId: string
  body: string
  sortOrder: number
  totalAttempts: number
  correctCount: number
  correctRate: number
}

export type QuizGuildStats = {
  guildId: string
  totalAttempts: number
  correctCount: number
  correctRate: number
  uniqueUserCount: number
}

export type QuizStats = {
  quizId: string
  title: string
  totalAttempts: number
  correctCount: number
  correctRate: number
  uniqueUserCount: number
  questions: QuizQuestionStats[]
  /** このクイズを追加しているサーバー数 */
  shareCount: number
  /** 全サーバー集計を要求したときのみ入る（作成者限定） */
  byGuild?: QuizGuildStats[]
}

/** APIが添えるDiscordの表示名。引けなかったユーザーは null */
type WithDisplayName = { displayName: string | null }

export type RankingEntry = WithDisplayName & {
  userId: string
  totalAttempts: number
  correctCount: number
  correctRate: number
}

export type BuzzRankingEntry = WithDisplayName & {
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
