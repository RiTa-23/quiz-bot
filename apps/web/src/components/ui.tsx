import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANT: Record<Variant, string> = {
  // 主ボタンは金。押し込みを表現するため下辺に濃い金の影を敷く
  primary:
    'bg-gold-400 text-navy-900 shadow-raised hover:bg-gold-200 active:translate-y-px active:shadow-none disabled:bg-paper-sunken disabled:text-navy-300 disabled:shadow-none',
  secondary:
    'border border-paper-line bg-paper-raised text-navy-700 hover:border-navy-300 hover:bg-paper disabled:opacity-50',
  danger: 'bg-wrong text-white hover:brightness-110 disabled:opacity-40',
  ghost: 'text-navy-600 hover:bg-navy-50 disabled:opacity-50',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`shrink-0 whitespace-nowrap rounded px-3 py-1.5 text-sm font-bold transition ${VARIANT[variant]} ${className}`}
      {...props}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`min-w-0 rounded border border-paper-line bg-paper-raised p-4 shadow-panel ${className}`}
    >
      {children}
    </div>
  )
}

export function Spinner({ label = '読み込み中…' }: { label?: string }) {
  return (
    <output className="flex items-center gap-2 p-6 text-sm text-navy-300">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-paper-line border-t-gold-400"
      />
      <span>{label}</span>
    </output>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded border border-dashed border-paper-line bg-paper-sunken/50 px-4 py-6 text-center text-sm text-navy-300">
      {children}
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded border-l-4 border-wrong bg-paper-raised px-3 py-2 text-sm text-wrong shadow-panel">
      {message}
    </div>
  )
}

export function NoGuildNotice({
  hasGuilds,
  installUrl,
  onRefresh,
}: { hasGuilds: boolean; installUrl?: string; onRefresh?: () => void }) {
  return (
    <div className="rounded border-l-4 border-gold-400 bg-gold-100 p-4 text-sm text-navy-800">
      {hasGuilds ? (
        '操作するサーバーを選択してください。'
      ) : (
        <>
          <p className="font-medium">利用できるサーバーがありません。</p>
          <p className="mt-1">
            クイズBotが導入されているサーバーのみ選べます。下のリンクからBotを追加してください。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {installUrl && (
              <a
                href={installUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded bg-navy-900 px-3 py-1.5 text-sm font-bold text-paper hover:bg-navy-700"
              >
                Botをサーバーに追加する
              </a>
            )}
            {onRefresh && (
              <Button variant="secondary" onClick={onRefresh}>
                追加したら再読み込み
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: children is always a form control
    <label className="block space-y-1">
      <span className="text-xs font-bold uppercase tracking-wider text-navy-300">{label}</span>
      {children}
    </label>
  )
}

const inputBase =
  'w-full rounded border border-paper-line bg-paper-raised px-3 py-2 text-sm text-navy-900 placeholder:text-navy-200 focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-200'

export function TextInput({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputBase} ${className}`} {...props} />
}

export function TextArea({
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputBase} min-h-20 ${className}`} {...props} />
}

export function Select({
  className = '',
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${inputBase} ${className}`} {...props} />
}

export function Badge({
  children,
  tone = 'gray',
}: { children: ReactNode; tone?: 'gray' | 'green' | 'gold' }) {
  const tones = {
    gray: 'border-paper-line bg-paper-sunken text-navy-600',
    green: 'border-correct/30 bg-correct/10 text-correct',
    gold: 'border-gold-400 bg-gold-100 text-gold-600',
  }
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs font-bold tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
