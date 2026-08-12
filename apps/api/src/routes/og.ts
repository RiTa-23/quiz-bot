import { Hono } from 'hono'
import { ImageResponse } from 'workers-og'
import type { Bindings } from '../env'

export const ogRoutes = new Hono<{ Bindings: Bindings }>()

const WIDTH = 1200
const HEIGHT = 630
const SITE_NAME = 'クイズ共有Bot'
const DEFAULT_TITLE = 'Discordでみんなとクイズを'
const DEFAULT_SUBTITLE = 'クイズを作って、サーバーのみんなで早押し。'
const TITLE_MAX = 60
const SUBTITLE_MAX = 90
const CACHE_SECONDS = 60 * 60 * 24

/**
 * 描画に必要な字だけをGoogle Fontsから取り出す。
 * 日本語のフォントは数MBあり Worker に同梱できないため、`text=` で
 * その画像に出てくる文字だけのサブセットを都度取得する。
 */
async function loadFontSubset(text: string, weight: number): Promise<ArrayBuffer | null> {
  const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encodeURIComponent(text)}`
  // Google Fonts は User-Agent で配信形式を変える。UAを送らないと satori が読める
  // TTF が返るため、あえて付けない（古いIEのUAだとEOT、モダンなUAだとwoff/woff2になる）
  const cssRes = await fetch(url, { cf: { cacheEverything: true, cacheTtl: CACHE_SECONDS } })
  if (!cssRes.ok) return null

  const src = /src:\s*url\(([^)]+)\)/.exec(await cssRes.text())?.[1]
  if (!src) return null

  const fontRes = await fetch(src, { cf: { cacheEverything: true, cacheTtl: CACHE_SECONDS } })
  return fontRes.ok ? await fontRes.arrayBuffer() : null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 深い紺の盤面に金の罫。Web/Botと同じ配色にそろえる。 */
function markup(title: string, subtitle: string): string {
  return `
    <div style="display:flex;flex-direction:column;justify-content:space-between;width:${WIDTH}px;height:${HEIGHT}px;background:#0B1B3A;padding:72px;border-bottom:16px solid #E8B341;box-sizing:border-box;">
      <div style="display:flex;align-items:center;">
        <div style="display:flex;color:#E8B341;font-size:34px;font-weight:700;">Q.</div>
        <div style="display:flex;color:#A7B5D1;font-size:30px;margin-left:14px;">${escapeHtml(SITE_NAME)}</div>
      </div>
      <div style="display:flex;flex-direction:column;border-left:10px solid #E8B341;padding-left:32px;">
        <div style="display:flex;color:#F7F5F0;font-size:66px;font-weight:700;line-height:1.25;">${escapeHtml(title)}</div>
        <div style="display:flex;color:#A7B5D1;font-size:30px;margin-top:24px;line-height:1.5;">${escapeHtml(subtitle)}</div>
      </div>
    </div>`
}

/**
 * OGP画像を生成する。`?title=` `?subtitle=` で差し替えられ、
 * 未指定ならサイト全体の既定カードを返す（index.html の og:image が指す先）。
 */
ogRoutes.get('/', async (c) => {
  const title = (c.req.query('title') || DEFAULT_TITLE).slice(0, TITLE_MAX)
  const subtitle = (c.req.query('subtitle') || DEFAULT_SUBTITLE).slice(0, SUBTITLE_MAX)

  const fonts = []
  // サブセットは「そのウェイトで実際に描く文字」を過不足なく渡す。
  // 足りないと豆腐（□）になるため、太字＝ロゴと見出し / 通常＝サイト名と説明で分ける
  const [bold, regular] = await Promise.all([
    loadFontSubset(`Q.${title}`, 700),
    loadFontSubset(`${SITE_NAME}${subtitle}`, 400),
  ])
  if (bold)
    fonts.push({ name: 'Noto Sans JP', data: bold, weight: 700 as const, style: 'normal' as const })
  if (regular)
    fonts.push({
      name: 'Noto Sans JP',
      data: regular,
      weight: 400 as const,
      style: 'normal' as const,
    })

  const image = new ImageResponse(markup(title, subtitle), {
    width: WIDTH,
    height: HEIGHT,
    format: (c.req.query('format') === 'svg' ? 'svg' : 'png') as 'svg' | 'png',
    ...(fonts.length > 0 ? { fonts } : {}),
    headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` },
  })
  return image
})
