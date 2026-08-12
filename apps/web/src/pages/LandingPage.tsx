import { Link } from 'react-router-dom'
import { loginUrl } from '../lib/api'
import { useApi } from '../lib/hooks'
import type { Me } from '../lib/types'

const STEPS = [
  {
    n: '1',
    title: 'Botを追加する',
    body: '遊びたいDiscordサーバーにBotを招待します。追加できるのはサーバーの管理権限を持つ人だけです。',
  },
  {
    n: '2',
    title: 'クイズを用意する',
    body: 'Discordなら /quiz create と /quiz add-question 、この管理画面ならフォームから作れます。公開クイズを取り込んでもかまいません。',
  },
  {
    n: '3',
    title: '出題する',
    body: '/quiz play で出題パネルが開きます。ひとりで解くか、みんなで早押しするかを選べます。',
  },
]

const MODES = [
  {
    title: '1人で解く',
    lead: 'コマンドを実行した人が、自分のペースで解きます。',
    points: ['制限時間なし', '全問終わると正解数と正答率を表示', '途中でやめても解いたぶんは記録に残る'],
  },
  {
    title: 'みんなで早押し',
    lead: '募集して集まった人たちで、最初に正解した人が得点します。',
    points: [
      '「募集開始」で参加者を集める（ホストを含めて2人から）',
      '1問あたり1分。誰も正解しなければ次の問題へ',
      '最後に得点ランキングを表示',
    ],
  },
]

const COMMANDS: { cmd: string; desc: string }[] = [
  { cmd: '/quiz help', desc: '使い方と遊び方を見る' },
  { cmd: '/quiz play', desc: 'クイズを出題する（1人 / みんなで早押し）' },
  { cmd: '/quiz create', desc: 'クイズを新しく作る' },
  { cmd: '/quiz add-question', desc: '設問を追加する（4択 / ○× / 自由記述）' },
  { cmd: '/quiz editors', desc: '設問を編集できる人を決める' },
  { cmd: '/quiz visibility', desc: '自分のクイズを公開/サーバー限定に切り替える' },
  { cmd: '/quiz add-public', desc: '公開クイズを探してサーバーに追加する' },
  { cmd: '/quiz stats', desc: 'クイズごとの成績を見る' },
  { cmd: '/quiz ranking', desc: 'サーバー内のランキングを見る' },
]

function Section({
  title,
  lead,
  children,
}: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14">
      <h2 className="rule-gold text-xl sm:text-2xl">{title}</h2>
      {lead && <p className="mt-3 text-navy-600">{lead}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

export function LandingPage() {
  // 未ログインなら401になるだけなので、そのまま導線を出し分ける材料にする
  const { data: me } = useApi<Me>('/api/me')
  const { data: install } = useApi<{ botInstallUrl: string }>('/api/bot-install-url')

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b-4 border-gold-400 bg-navy-900">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:py-24">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-400">Quiz Bot</p>
          <h1 className="mt-3 text-3xl leading-tight text-paper sm:text-5xl">
            Discordで、
            <br />
            みんなとクイズを。
          </h1>
          <p className="mt-5 max-w-xl leading-relaxed text-navy-100">
            クイズを作って、サーバーの仲間と早押しで対戦できるBotです。
            設問づくりと共有はこの画面から、出題はDiscordから。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {install && (
              <a
                href={install.botInstallUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded bg-gold-400 px-5 py-2.5 font-bold text-navy-900 shadow-raised transition hover:bg-gold-200 active:translate-y-px active:shadow-none"
              >
                Botをサーバーに追加
              </a>
            )}
            {me ? (
              <Link
                to="/quizzes"
                className="rounded border border-navy-300 px-5 py-2.5 font-bold text-paper transition hover:border-gold-400 hover:text-gold-400"
              >
                管理画面へ
              </Link>
            ) : (
              <a
                href={loginUrl()}
                className="rounded border border-navy-300 px-5 py-2.5 font-bold text-paper transition hover:border-gold-400 hover:text-gold-400"
              >
                Discordでログイン
              </a>
            )}
          </div>
        </div>
      </header>

      <Section title="はじめかた">
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="min-w-0 rounded border border-paper-line bg-paper-raised p-5 shadow-panel"
            >
              <span className="inline-block border-b-2 border-gold-400 pb-1 font-bold text-gold-600">
                STEP {s.n}
              </span>
              <h3 className="mt-3 text-lg">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="2つの遊び方" lead="出題パネルで形式を選べます。">
        <div className="grid gap-4 sm:grid-cols-2">
          {MODES.map((m) => (
            <div
              key={m.title}
              className="min-w-0 rounded border border-paper-line bg-paper-raised p-5 shadow-panel"
            >
              <h3 className="text-lg">{m.title}</h3>
              <p className="mt-2 text-sm text-navy-600">{m.lead}</p>
              <ul className="mt-4 space-y-2 text-sm text-navy-700">
                {m.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span aria-hidden className="text-gold-500">
                      ―
                    </span>
                    <span className="min-w-0">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="つくる・くばる・ふりかえる"
        lead="出題以外もひととおりそろっています。"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              h: '3つの出題形式',
              b: '4択・○×・自由記述に対応。自由記述は「東京」「とうきょう」のように複数の正解を登録できます。',
            },
            {
              h: '他サーバーへ共有',
              b: 'クイズを公開にすると、他のサーバーが取り込んで遊べます。取り込みは複製ではなく参照なので、直した内容がそのまま反映されます。',
            },
            {
              h: '成績とランキング',
              b: '1人モードと早押しを別々に記録します。サーバー内のランキングや、クイズごとの正答率を見られます。',
            },
          ].map((c) => (
            <div
              key={c.h}
              className="min-w-0 rounded border border-paper-line bg-paper-raised p-5 shadow-panel"
            >
              <h3 className="text-lg">{c.h}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">{c.b}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="コマンド一覧" lead="Discordで /quiz と入力すると候補が出ます。">
        <div className="overflow-x-auto rounded border border-paper-line bg-paper-raised shadow-panel">
          <table className="w-full text-sm">
            <tbody>
              {COMMANDS.map((c) => (
                <tr key={c.cmd} className="border-b border-paper-line last:border-0">
                  <th className="whitespace-nowrap px-4 py-3 text-left align-top font-mono font-bold text-navy-900">
                    {c.cmd}
                  </th>
                  <td className="px-4 py-3 text-navy-600">{c.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <footer className="border-t border-paper-line">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-navy-300">
          <span>クイズ共有Bot</span>
          {me ? (
            <Link to="/quizzes" className="underline-offset-2 hover:text-gold-600 hover:underline">
              管理画面へ
            </Link>
          ) : (
            <a href={loginUrl()} className="underline-offset-2 hover:text-gold-600 hover:underline">
              Discordでログイン
            </a>
          )}
        </div>
      </footer>
    </div>
  )
}
