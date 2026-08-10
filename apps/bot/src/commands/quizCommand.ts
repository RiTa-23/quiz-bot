import { Command, Option, SubCommand } from 'discord-hono'

// Discord に登録するコマンド定義。register スクリプト（src/register.ts）から参照する。
export const quizCommand = new Command('quiz', 'クイズの作成・出題・管理').options(
  new SubCommand('create', 'クイズを新規作成する').options(
    new Option('title', 'クイズのタイトル').required(),
    new Option('description', 'クイズの説明'),
  ),
  new SubCommand('play', 'クイズの出題設定パネルを開く'),
  new SubCommand('delete', 'クイズを削除する').options(
    new Option('quiz_id', 'クイズID').required(),
  ),
  new SubCommand('share', '他サーバーにクイズを共有する').options(
    new Option('quiz_id', 'クイズID').required(),
    new Option('target_guild_id', '共有先サーバーID').required(),
  ),
  new SubCommand('add-editor', 'クイズの共同編集者を追加する').options(
    new Option('quiz_id', 'クイズID').required(),
    new Option('target_type', 'guild または user').required(),
    new Option('target_id', 'サーバーIDまたはユーザーID').required(),
  ),
  new SubCommand('add-question', 'クイズに設問を追加する').options(
    new Option('quiz_id', 'クイズID').required(),
    new Option('type', 'multiple_choice / true_false / free_text').required(),
    new Option('body', '問題文').required(),
    new Option('answers', '正解パターン（カンマ区切り）').required(),
    new Option('choices', '選択肢（カンマ区切り、4択のみ）'),
    new Option('explanation', '解説'),
  ),
)
