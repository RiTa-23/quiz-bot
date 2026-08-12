import { loginUrl } from '../lib/api'

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">クイズ管理</h1>
        <p className="mb-6 text-sm text-gray-500">
          Discordアカウントでログインしてクイズを作成・編集できます。
        </p>
        <a
          href={loginUrl()}
          className="inline-block rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
        >
          Discordでログイン
        </a>
      </div>
    </div>
  )
}
