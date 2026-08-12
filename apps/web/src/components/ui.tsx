import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300',
  secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost: 'text-indigo-600 hover:bg-indigo-50 disabled:opacity-50',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${VARIANT[variant]} ${className}`}
      {...props}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function Spinner({ label = '読み込み中…' }: { label?: string }) {
  return <p className="p-6 text-sm text-gray-500">{label}</p>
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
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
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
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
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}

const inputBase =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

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
}: { children: ReactNode; tone?: 'gray' | 'green' | 'indigo' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-600',
    green: 'bg-emerald-100 text-emerald-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}
