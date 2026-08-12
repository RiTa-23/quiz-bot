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
export {
  getPublicQuizSummary,
  type PublicQuizSummary,
  listPublicQuizzes,
  listAddedQuizzes,
  addPublicQuiz,
  removeAddedQuiz,
  listShares,
  type QuizShare,
  type PublicQuizListing,
} from './quiz/shares'
export {
  addEditor,
  removeEditor,
  listEditors,
  getEditorSettings,
  setGuildEditor,
  setUserEditors,
  type QuizEditor,
  type EditorSettings,
} from './quiz/editors'
export { resolveQuizRole } from './quiz/permissions'

export { getRandomQuestion, getPlayQuestion } from './play/getRandomQuestion'
export { submitAttempt, type SubmitAttemptResult } from './play/submitAttempt'
export { normalizeAnswer, isCorrectAnswer } from './play/normalizeAnswer'
export {
  listPlayableQuizzes,
  listEditableQuizzes,
  listDeletableQuizzes,
  listOwnedQuizzes,
  getSessionQuestions,
  countQuizQuestions,
  type PlayableQuiz,
  type OwnedQuiz,
} from './play/session'

export { getQuizStats, type QuizStats, type QuizQuestionStats } from './stats/quizStats'
export {
  getMemberStats,
  type MemberStats,
  type MemberQuizBreakdown,
} from './stats/memberStats'
export { getGuildRanking, type RankingEntry, type RankingPeriod } from './stats/guildRanking'
export { getUserStats, type UserStats } from './stats/userStats'
export {
  recordBuzzAttempts,
  getBuzzRanking,
  type BuzzAttemptRecord,
  type BuzzRankingEntry,
} from './stats/buzz'
export { recordSoloAttempts, type SoloAttemptRecord } from './stats/solo'

export { checkRateLimit, type RateLimitScope } from './rate-limit/rateLimit'
