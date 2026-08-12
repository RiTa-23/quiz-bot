import type { Database } from '../db/client'
import { quizAttempts } from '../db/schema'

export type SoloAttemptRecord = {
  sessionId: string
  quizId: string
  guildId: string
  questionId: string
  userId: string
  isCorrect: boolean
  submittedAnswer: string | null
}

/**
 * 1人モードの回答結果をまとめて記録する（セッション進行中にDOから呼ばれる）。
 * プレイ可否は呼び出し側（getSessionQuestions）で確認済みのため、
 * ここでは権限チェック・レート制限を行わない（recordBuzzAttempts と同様）。
 */
export async function recordSoloAttempts(
  db: Database,
  entries: SoloAttemptRecord[],
): Promise<void> {
  if (entries.length === 0) return
  const now = new Date().toISOString()
  await db.insert(quizAttempts).values(
    entries.map((e) => ({
      id: crypto.randomUUID(),
      sessionId: e.sessionId,
      questionId: e.questionId,
      quizId: e.quizId,
      guildId: e.guildId,
      userId: e.userId,
      isCorrect: e.isCorrect,
      submittedAnswer: e.submittedAnswer,
      answeredAt: now,
    })),
  )
}
