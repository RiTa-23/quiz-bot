/**
 * 自由記述の正誤判定用の正規化ルール（技術選定.md/要件定義.mdの未確定事項に対する暫定実装）。
 * トリム・小文字化・全角英数記号を半角化・全角スペース除去を行う。
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
    .replace(/\s+/g, ' ')
}

export function isCorrectFreeTextAnswer(submitted: string, answers: string[]): boolean {
  const normalizedSubmitted = normalizeAnswer(submitted)
  return answers.some((answer) => normalizeAnswer(answer) === normalizedSubmitted)
}

export function isCorrectAnswer(
  type: 'multiple_choice' | 'true_false' | 'free_text',
  submitted: string,
  answers: string[],
): boolean {
  if (type === 'free_text') {
    return isCorrectFreeTextAnswer(submitted, answers)
  }
  // 4択・○×は選択肢の値そのものを完全一致で比較する
  return answers.includes(submitted)
}
