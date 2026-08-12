import { loginUrl } from '../lib/api'

export function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-900 px-4">
      <div className="w-full max-w-md border-t-4 border-gold-400 bg-paper p-8 shadow-panel">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-600">Quiz Bot</p>
        <h1 className="mt-1 text-2xl text-navy-900">クイズ管理</h1>
        <p className="mt-3 text-sm leading-relaxed text-navy-600">
          Discordサーバーで遊ぶクイズを、ここで作って共有できます。
          設問の追加や公開設定はこの画面から、出題は Discord の <code>/quiz play</code> から。
        </p>
        <a
          href={loginUrl()}
          className="mt-6 inline-block rounded bg-gold-400 px-4 py-2 font-bold text-navy-900 shadow-raised transition hover:bg-gold-200 active:translate-y-px active:shadow-none"
        >
          Discordでログイン
        </a>
      </div>
      <p className="mt-6 text-xs text-navy-200">
        ログインすると、Botが導入されているサーバーのクイズを管理できます。
      </p>
    </div>
  )
}
