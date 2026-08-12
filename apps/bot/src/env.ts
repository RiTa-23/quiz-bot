import type { QuizSession } from './session/QuizSession'

export type Bindings = {
  DB: D1Database
  QUIZ_SESSION: DurableObjectNamespace<QuizSession>
  DISCORD_APPLICATION_ID: string
  DISCORD_PUBLIC_KEY: string
  DISCORD_TOKEN: string
  /** helpから案内するWeb管理画面のURL */
  WEB_URL?: string
}
