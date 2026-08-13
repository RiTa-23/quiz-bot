import { useState } from 'react'
import type { QuestionInput, QuestionType } from '../lib/types'
import { Button, ErrorNote } from './ui'

const TYPES: QuestionType[] = ['multiple_choice', 'true_false', 'free_text']
const MAX = 100

const EXAMPLE = [
  {
    type: 'multiple_choice',
    body: '日本で一番高い山は？',
    choices: ['富士山', '北岳', '槍ヶ岳', '穂高岳'],
    answers: ['富士山'],
    explanation: '標高3776m。',
  },
  {
    type: 'true_false',
    body: '富士山は静岡県と山梨県にまたがっている。',
    answer: true,
  },
  {
    type: 'free_text',
    body: '日本の首都は？（ひらがな・漢字どちらでも）',
    answers: ['東京', 'とうきょう', 'Tokyo'],
  },
]

const asStringArray = (v: unknown): string[] => {
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.map((x) => String(x))
  return []
}

const clean = (arr: string[]) => arr.map((s) => s.trim()).filter(Boolean)

// ○×は記号の表記ゆれ（○/〇/◯・×/✕/x）で一致しない事故を避けるため、JSONでは真偽値で書く。
// 内部の正解表現は "○" / "×" なので、ここで変換する。
const toBool = (v: unknown): boolean | null => {
  if (typeof v === 'boolean') return v
  if (Array.isArray(v)) return v.length > 0 ? toBool(v[0]) : null
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'true') return true
    if (s === 'false') return false
  }
  return null
}

function toQuestionInput(item: unknown, i: number): QuestionInput {
  const n = i + 1
  if (typeof item !== 'object' || item === null) throw new Error(`${n}問目: 設問の形式が不正です`)
  const o = item as Record<string, unknown>

  if (typeof o.type !== 'string' || !TYPES.includes(o.type as QuestionType)) {
    throw new Error(
      `${n}問目: type は multiple_choice / true_false / free_text のいずれかにしてください`,
    )
  }
  const type = o.type as QuestionType
  const body = typeof o.body === 'string' ? o.body.trim() : ''
  if (!body) throw new Error(`${n}問目: body（問題文）を入力してください`)

  const answers = clean(asStringArray(o.answers))
  const explanation =
    typeof o.explanation === 'string' && o.explanation.trim() ? o.explanation.trim() : null

  if (type === 'multiple_choice') {
    const choices = [...new Set(clean(asStringArray(o.choices)))]
    if (choices.length < 2) throw new Error(`${n}問目: choices（選択肢）を2つ以上入力してください`)
    if (answers.length === 0) throw new Error(`${n}問目: answers（正解）を1つ以上指定してください`)
    const invalid = answers.filter((a) => !choices.includes(a))
    if (invalid.length) {
      throw new Error(`${n}問目: 正解は選択肢の中から指定してください（${invalid.join(' / ')}）`)
    }
    return { type, body, choices, answers, explanation }
  }
  if (type === 'true_false') {
    const bool = toBool(o.answer ?? o.answers)
    if (bool === null) {
      throw new Error(`${n}問目: ○×問題は answer を true / false で指定してください`)
    }
    return { type, body, choices: null, answers: [bool ? '○' : '×'], explanation }
  }
  if (answers.length === 0)
    throw new Error(`${n}問目: answers（正解パターン）を1つ以上入力してください`)
  return { type, body, choices: null, answers, explanation }
}

export function parseQuestions(raw: string): QuestionInput[] {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('JSONとして読み取れませんでした。ファイルの内容を確認してください。')
  }
  const arr = Array.isArray(data)
    ? data
    : typeof data === 'object' &&
        data !== null &&
        Array.isArray((data as { questions?: unknown }).questions)
      ? (data as { questions: unknown[] }).questions
      : null
  if (!arr) throw new Error('設問の配列、または { "questions": [...] } の形式にしてください')
  if (arr.length === 0) throw new Error('設問が1つも含まれていません')
  if (arr.length > MAX) throw new Error(`一度に追加できるのは${MAX}問までです（${arr.length}問）`)
  return arr.map(toQuestionInput)
}

export function QuestionImportCard({
  onImport,
  onCancel,
}: {
  onImport: (inputs: QuestionInput[]) => Promise<boolean>
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 入力できているうちだけ件数を出す（未入力・パース不可のときは黙る）
  let count: number | null = null
  if (text.trim()) {
    try {
      count = parseQuestions(text).length
    } catch {
      count = null
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setFileName(file.name)
    try {
      setText(await file.text())
    } catch {
      setError('ファイルを読み込めませんでした')
    }
  }

  const submit = async () => {
    setError(null)
    let inputs: QuestionInput[]
    try {
      inputs = parseQuestions(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み取りに失敗しました')
      return
    }
    setSubmitting(true)
    const ok = await onImport(inputs)
    if (!ok) setSubmitting(false)
  }

  const downloadTemplate = () => {
    const blob = new Blob([JSON.stringify(EXAMPLE, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'quiz-questions-template.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-navy-900">JSONで一括追加</h3>
        <p className="mt-1 text-sm text-navy-600">
          設問を並べたJSONファイルを読み込むと、まとめて追加できます（一度に{MAX}問まで）。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded border border-paper-line bg-paper-raised px-3 py-1.5 text-sm font-bold text-navy-700 hover:border-navy-300 hover:bg-paper">
          ファイルを選ぶ
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        {fileName && <span className="min-w-0 truncate text-sm text-navy-300">{fileName}</span>}
        <Button variant="ghost" onClick={downloadTemplate}>
          テンプレートをダウンロード
        </Button>
      </div>

      <details className="rounded border border-paper-line bg-paper-sunken/50 px-3 py-2 text-sm text-navy-600">
        <summary className="cursor-pointer font-bold text-navy-700">対応フォーマット</summary>
        <ul className="mt-2 space-y-1">
          <li>
            全体は設問の配列、または <code>{'{ "questions": [ ... ] }'}</code>
          </li>
          <li>
            <code>type</code>: <code>multiple_choice</code> / <code>true_false</code> /{' '}
            <code>free_text</code>
          </li>
          <li>
            <code>body</code>: 問題文（必須）
          </li>
          <li>
            <code>choices</code>: 4択のときの選択肢（2つ以上）
          </li>
          <li>
            <code>answers</code>: 正解の配列（4択・自由記述）
          </li>
          <li>
            ○×は <code>answer</code> に <code>true</code>（○）か <code>false</code>（×）で指定
          </li>
          <li>
            <code>explanation</code>: 解説（任意）
          </li>
        </ul>
      </details>

      <label className="block space-y-1">
        <span className="text-xs font-bold uppercase tracking-wider text-navy-300">
          JSON（ファイルを選ぶか、ここに貼り付け）
        </span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setFileName(null)
          }}
          spellCheck={false}
          placeholder={JSON.stringify(EXAMPLE.slice(0, 1), null, 2)}
          className="h-56 w-full rounded border border-paper-line bg-paper-raised px-3 py-2 font-mono text-xs text-navy-900 placeholder:text-navy-200 focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-200"
        />
      </label>

      {count !== null && (
        <p className="text-sm text-correct">{count}問を読み取りました。追加できます。</p>
      )}
      {error && <ErrorNote message={error} />}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          キャンセル
        </Button>
        <Button onClick={submit} disabled={submitting || !text.trim()}>
          {count !== null ? `${count}問を追加` : '追加'}
        </Button>
      </div>
    </div>
  )
}
