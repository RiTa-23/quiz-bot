export type Actor = {
  userId: string
  guildId: string | null
}

export type QuizRole = 'owner' | 'editor' | 'shared' | 'none'

export type QuestionType = 'multiple_choice' | 'true_false' | 'free_text'

export type Quiz = {
  id: string
  title: string
  description: string | null
  ownerUserId: string
  ownerGuildId: string
  visibility: 'private' | 'shared'
  createdAt: string
  updatedAt: string
}

export type Question = {
  id: string
  quizId: string
  type: QuestionType
  body: string
  choices: string[] | null
  answers: string[]
  explanation: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/** answersフィールドを含まない、出題・一覧表示用の設問 */
export type PublicQuestion = Omit<Question, 'answers'>
