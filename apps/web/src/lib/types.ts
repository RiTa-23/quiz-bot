export type QuizRole = 'owner' | 'editor' | 'shared' | 'none'

export type Quiz = {
  id: string
  title: string
  description: string | null
  ownerUserId: string
  ownerGuildId: string
  visibility: 'private' | 'shared'
  createdAt: string
  updatedAt: string
  role: QuizRole
}

export type Question = {
  id: string
  quizId: string
  type: 'multiple_choice' | 'true_false' | 'free_text'
  body: string
  choices: string[] | null
  answers?: string[]
  explanation: string | null
  sortOrder: number
}

export type QuizDetail = Quiz & { questions: Question[] }
