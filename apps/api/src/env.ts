export type Bindings = {
  DB: D1Database
  SESSIONS: KVNamespace
  ENVIRONMENT: string
  WEB_ORIGIN: string
  DISCORD_OAUTH_REDIRECT_URI: string
  DISCORD_CLIENT_ID: string
  DISCORD_CLIENT_SECRET: string
}

export type Variables = {
  userId: string
}
