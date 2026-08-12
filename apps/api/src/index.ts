import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authRoutes } from './auth'
import type { Bindings, Variables } from './env'
import { meRoutes } from './routes/me'
import { ogRoutes } from './routes/og'
import { quizzesRoutes } from './routes/quizzes'
import { statsRoutes } from './routes/stats'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', async (c, next) => {
  const middleware = cors({ origin: c.env.WEB_ORIGIN, credentials: true })
  return middleware(c, next)
})

// OGPはクローラーが認証なしで取得するため、CORS・認証の対象外に置く
app.route('/og', ogRoutes)
app.route('/auth', authRoutes)
app.route('/api', meRoutes)
app.route('/api/quizzes', quizzesRoutes)
app.route('/api', statsRoutes)

export default app
