import { useMemo, useState } from 'react'
import type { Question, QuestionInput, QuestionType } from '../lib/types'
import { Button, ErrorNote, Field, Select, TextArea, TextInput } from './ui'

const TF = ['○', '×']

const linesToArr = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)

export function QuestionForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Question
  onSubmit: (input: QuestionInput) => Promise<void>
  onCancel?: () => void
}) {
  const [type, setType] = useState<QuestionType>(initial?.type ?? 'multiple_choice')
  const [body, setBody] = useState(initial?.body ?? '')
  const [choicesText, setChoicesText] = useState((initial?.choices ?? []).join('\n'))
  const [answersText, setAnswersText] = useState((initial?.answers ?? []).join('\n'))
  const [mcAnswers, setMcAnswers] = useState<string[]>(initial?.answers ?? [])
  const [tfAnswer, setTfAnswer] = useState<string>(initial?.answers?.[0] ?? '○')
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 重複した選択肢はReactのkey衝突と正解チェックの誤動作（同じ値が同時に切り替わる）を招くため除く
  const choices = useMemo(() => [...new Set(linesToArr(choicesText))], [choicesText])

  const submit = async () => {
    setError(null)
    let choicesOut: string[] | null = null
    let answers: string[] = []
    if (type === 'multiple_choice') {
      choicesOut = choices
      answers = mcAnswers.filter((a) => choices.includes(a))
      if (choices.length < 2) return setError('選択肢は2つ以上入力してください')
      if (answers.length === 0) return setError('正解を1つ以上選んでください')
    } else if (type === 'true_false') {
      answers = [tfAnswer]
    } else {
      answers = linesToArr(answersText)
      if (answers.length === 0) return setError('正解パターンを1つ以上入力してください')
    }
    if (!body.trim()) return setError('問題文を入力してください')

    setSubmitting(true)
    try {
      await onSubmit({
        type,
        body: body.trim(),
        choices: choicesOut,
        answers,
        explanation: explanation.trim() || null,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <Field label="出題形式">
        <Select value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
          <option value="multiple_choice">4択</option>
          <option value="true_false">○×</option>
          <option value="free_text">自由記述</option>
        </Select>
      </Field>
      <Field label="問題文">
        <TextArea value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>

      {type === 'multiple_choice' && (
        <>
          <Field label="選択肢（1行に1つ）">
            <TextArea
              value={choicesText}
              onChange={(e) => setChoicesText(e.target.value)}
              placeholder={'選択肢A\n選択肢B\n選択肢C\n選択肢D'}
            />
          </Field>
          <div className="space-y-1">
            <span className="text-sm font-medium text-gray-700">正解（チェックした選択肢）</span>
            {choices.length === 0 ? (
              <p className="text-sm text-gray-400">先に選択肢を入力してください。</p>
            ) : (
              <div className="space-y-1">
                {choices.map((ch) => (
                  <label key={ch} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={mcAnswers.includes(ch)}
                      onChange={(e) =>
                        setMcAnswers((prev) =>
                          e.target.checked ? [...prev, ch] : prev.filter((a) => a !== ch),
                        )
                      }
                    />
                    {ch}
                  </label>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {type === 'true_false' && (
        <Field label="正解">
          <div className="flex gap-4">
            {TF.map((v) => (
              <label key={v} className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="tf"
                  checked={tfAnswer === v}
                  onChange={() => setTfAnswer(v)}
                />
                {v}
              </label>
            ))}
          </div>
        </Field>
      )}

      {type === 'free_text' && (
        <Field label="正解パターン（1行に1つ・いずれか一致で正解）">
          <TextArea
            value={answersText}
            onChange={(e) => setAnswersText(e.target.value)}
            placeholder={'東京\nとうきょう\nTokyo'}
          />
        </Field>
      )}

      <Field label="解説（任意）">
        <TextInput value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </Field>

      {error && <ErrorNote message={error} />}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
        )}
        <Button onClick={submit} disabled={submitting}>
          保存
        </Button>
      </div>
    </div>
  )
}
