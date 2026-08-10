export { createDb, type Database } from './db/client'
export * from './errors'
export * from './types'

export { createQuiz, type CreateQuizInput } from './quiz/createQuiz'
export { getQuiz, type QuizDetail } from './quiz/getQuiz'
export { listQuizzes, type QuizListItem } from './quiz/listQuizzes'
export { updateQuiz, type UpdateQuizInput } from './quiz/updateQuiz'
export { deleteQuiz } from './quiz/deleteQuiz'
export { addQuestion, updateQuestion, deleteQuestion } from './quiz/questions'
export type { AddQuestionInput, UpdateQuestionInput } from './quiz/questions'
export { addShare, removeShare, listShares, type QuizShare } from './quiz/shares'
export { addEditor, removeEditor, listEditors, type QuizEditor } from './quiz/editors'
export { resolveQuizRole } from './quiz/permissions'

export { getRandomQuestion, getPlayQuestion } from './play/getRandomQuestion'
export { submitAttempt, type SubmitAttemptResult } from './play/submitAttempt'
export { normalizeAnswer, isCorrectAnswer } from './play/normalizeAnswer'

export { getQuizStats, type QuizStats } from './stats/quizStats'
export { getGuildRanking, type RankingEntry, type RankingPeriod } from './stats/guildRanking'
export { getUserStats, type UserStats } from './stats/userStats'

export { checkRateLimit, type RateLimitScope } from './rate-limit/rateLimit'
