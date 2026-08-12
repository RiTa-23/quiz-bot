import { type PublicQuizSummary, createDb, getPublicQuizSummary } from '@quiz-bot/core'
import { Hono } from 'hono'
import { fetchUserSummaries } from '../discordUsers'
import type { Bindings } from '../env'

export const shareRoutes = new Hono<{ Bindings: Bindings }>()

const CACHE_SECONDS = 300

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function typeSummary(types: PublicQuizSummary['questionTypes']): string {
  const parts: string[] = []
  if (types.multipleChoice > 0) parts.push(`4択 ${types.multipleChoice}`)
  if (types.trueFalse > 0) parts.push(`○× ${types.trueFalse}`)
  if (types.freeText > 0) parts.push(`自由記述 ${types.freeText}`)
  return parts.join(' / ') || '設問なし'
}

/**
 * 共有ページのHTML。SPAではなくここで組み立てるのは、
 * クローラーがJSを実行せず、静的なindex.htmlでは全URLで同じOGPになるため。
 */
function page(quiz: PublicQuizSummary, authorName: string, env: Bindings, origin: string): string {
  const title = `${quiz.title} — クイズ共有Bot`
  const subtitle = `全${quiz.questionCount}問 / ${typeSummary(quiz.questionTypes)}`
  const description =
    quiz.description?.trim() || `${subtitle}　Discordのサーバーに追加して遊べます。`
  const ogImage = `${origin}/og?title=${encodeURIComponent(quiz.title)}&subtitle=${encodeURIComponent(subtitle)}`
  const webUrl = env.WEB_ORIGIN ?? ''

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#0B1B3A" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="クイズ共有Bot" />
<meta property="og:title" content="${escapeHtml(quiz.title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(ogImage)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<style>
  :root { color-scheme: light }
  * { box-sizing: border-box }
  body {
    margin: 0; background: #0B1B3A; color: #0B1B3A;
    font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic Medium", system-ui, sans-serif;
    display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px;
  }
  main { width: 100%; max-width: 640px; background: #F7F5F0; border-top: 6px solid #E8B341; padding: 32px }
  .eyebrow { margin: 0; color: #B07D14; font-size: 12px; font-weight: 700; letter-spacing: .2em }
  h1 { margin: 6px 0 0; font-size: 28px; letter-spacing: -.02em; line-height: 1.3 }
  .desc { margin: 12px 0 0; color: #132649; line-height: 1.7 }
  dl { display: flex; flex-wrap: wrap; gap: 24px; margin: 24px 0 0; padding: 20px 0 0; border-top: 1px solid #DED8CB }
  dt { margin: 0; color: #6E82AB; font-size: 12px; font-weight: 700; letter-spacing: .08em }
  dd { margin: 4px 0 0; font-size: 15px; font-weight: 700 }
  .cta { display: inline-block; margin: 28px 0 0; padding: 12px 20px; background: #E8B341; color: #0B1B3A;
         font-weight: 700; text-decoration: none; box-shadow: 0 2px 0 0 #B07D14 }
  .cta:active { transform: translateY(1px); box-shadow: none }
  .how { margin: 20px 0 0; padding: 16px; background: #EFEBE2; font-size: 14px; line-height: 1.8 }
  code { background: #0B1B3A; color: #F7F5F0; padding: 2px 6px; font-size: 13px
  }
  .foot { margin: 24px 0 0; color: #6E82AB; font-size: 12px }
  .foot a { color: #6E82AB }
</style>
</head>
<body>
<main>
  <p class="eyebrow">QUIZ</p>
  <h1>${escapeHtml(quiz.title)}</h1>
  ${quiz.description ? `<p class="desc">${escapeHtml(quiz.description)}</p>` : ''}
  <dl>
    <div><dt>設問数</dt><dd>${quiz.questionCount}問</dd></div>
    <div><dt>形式</dt><dd>${escapeHtml(typeSummary(quiz.questionTypes))}</dd></div>
    <div><dt>作成者</dt><dd>${escapeHtml(authorName)}</dd></div>
  </dl>
  <div class="how">
    <strong>遊び方</strong><br />
    1. Botをサーバーに追加する<br />
    2. <code>/quiz add-public</code> でこのクイズを追加<br />
    3. <code>/quiz play</code> で出題（1人 / みんなで早押し）
  </div>
  ${webUrl ? `<a class="cta" href="${escapeHtml(webUrl)}">クイズ共有Botを見る</a>` : ''}
  <p class="foot">このページは公開クイズの紹介ページです。設問と正解は含まれません。</p>
</main>
</body>
</html>`
}

/** 公開クイズの共有ページ。認証不要で、非公開クイズは404にする。 */
shareRoutes.get('/:id', async (c) => {
  const db = createDb(c.env.DB)
  const quiz = await getPublicQuizSummary(db, c.req.param('id'))
  if (!quiz) {
    return c.html(
      '<!doctype html><meta charset="UTF-8"><title>見つかりません</title><p>このクイズは存在しないか、公開されていません。',
      404,
    )
  }

  const authors = await fetchUserSummaries(c.env, [quiz.ownerUserId])
  const authorName = authors[quiz.ownerUserId]?.displayName ?? '不明'
  // 本番はカスタムドメイン越しに http で届くことがあり、そのままだと og:image が
  // http になってクローラーに弾かれる。ローカル以外は https に固定する。
  const url = new URL(c.req.url)
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  const origin = isLocal ? url.origin : `https://${url.host}`

  return c.html(page(quiz, authorName, c.env, origin), 200, {
    'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
  })
})
