import { loginUrl } from '../lib/api'

export function LoginPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">クイズ共有Bot 管理画面</h1>
        <p className="mb-6 text-sm text-gray-500">Discordアカウントでログインしてください</p>
        <a
          href={loginUrl()}
          className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
        >
          Discordでログイン
        </a>
      </div>
    </div>
  )
}
