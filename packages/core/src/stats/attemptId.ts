/**
 * セッション回答の主キーを、内容から決定的に組み立てる。
 *
 * DOのバッファは書き込み失敗時に再送するため、ランダムIDだと
 * 「実際は書けていたが応答が失われた」ケースで重複行が入る。
 * 同じ回答が必ず同じ主キーになるようにして、再送を衝突無視で吸収する。
 * （1セッション内で同じ設問が2回出ることはないため、この3つ組で一意になる）
 */
export function attemptId(sessionId: string, questionId: string, userId: string): string {
  return `${sessionId}:${questionId}:${userId}`
}
