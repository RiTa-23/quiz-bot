import { Command, Option, SubCommand } from 'discord-hono'

// Discord に登録するコマンド定義。register スクリプト（src/register.ts）から参照する。
export const quizCommand = new Command('quiz', 'クイズの作成・出題・管理').options(
  new SubCommand('create', 'クイズを新規作成する').options(
    new Option('title', 'クイズのタイトル').required(),
    new Option('description', 'クイズの説明'),
  ),
  new SubCommand('play', 'クイズの出題設定パネルを開く'),
  new SubCommand('delete', 'クイズを削除する（パネルで選択）'),
  new SubCommand('visibility', 'クイズの公開設定を変える（作成者のみ）'),
  new SubCommand('add-public', '公開クイズを探してこのサーバーに追加する'),
  new SubCommand('remove-public', '追加した公開クイズをこのサーバーから外す'),
  new SubCommand('add-editor', 'クイズの共同編集者を追加する').options(
    new Option('quiz_id', 'クイズID').required(),
    new Option('target_type', 'guild または user').required(),
    new Option('target_id', 'サーバーIDまたはユーザーID').required(),
  ),
  new SubCommand('add-question', 'クイズに設問を追加する（パネルで入力）'),
  new SubCommand('stats', 'クイズごとの成績を見る'),
  new SubCommand('my-stats', 'このサーバーでの自分の成績を見る'),
  new SubCommand('ranking', 'このサーバーのランキングを見る'),
)
