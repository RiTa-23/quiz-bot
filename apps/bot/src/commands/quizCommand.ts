import { Command, Option, SubCommand } from 'discord-hono'

// Discord に登録するコマンド定義。register スクリプト（src/register.ts）から参照する。
export const quizCommand = new Command('quiz', 'クイズの作成・出題・管理').options(
  new SubCommand('create', 'クイズを新規作成する').options(
    new Option('title', 'クイズのタイトル').required(),
    new Option('description', 'クイズの説明'),
  ),
  new SubCommand('help', '使い方と遊び方を見る').options(
    new Option('share', 'チャンネル全員に見せる（既定は自分だけ）', 'Boolean'),
  ),
  new SubCommand('play', 'クイズの出題設定パネルを開く'),
  new SubCommand('delete', 'クイズを削除する（パネルで選択）'),
  new SubCommand('visibility', 'クイズの公開設定を変える（作成者のみ）'),
  new SubCommand('add-public', '公開クイズを探してこのサーバーに追加する'),
  new SubCommand('remove-public', '追加した公開クイズをこのサーバーから外す'),
  new SubCommand('editors', 'クイズの編集権限を設定する（作成者のみ）'),
  new SubCommand('add-question', 'クイズに設問を追加する（パネルで入力）'),
  new SubCommand('stats', 'クイズごとの成績を見る'),
  new SubCommand('my-stats', 'このサーバーでの自分の成績を見る'),
  new SubCommand('ranking', 'このサーバーのランキングを見る'),
)
