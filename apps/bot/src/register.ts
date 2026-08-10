import { register } from 'discord-hono'
import { quizCommand } from './commands/quizCommand'

// Discordにスラッシュコマンドを登録するスクリプト。
// 実行例: DISCORD_APPLICATION_ID=xxx DISCORD_TOKEN=xxx bun run src/register.ts
await register(
  [quizCommand],
  process.env.DISCORD_APPLICATION_ID,
  process.env.DISCORD_TOKEN,
  process.env.DISCORD_TEST_GUILD_ID,
)

console.log('コマンドを登録しました。')
