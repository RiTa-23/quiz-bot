import { Button, Components, type Embed } from 'discord-hono'
import { COLOR, panelEmbed } from '../embeds'

export const HELP_SELECT = 'hlp' // 説明トピックの切り替え

export type HelpTopic = 'play' | 'create' | 'share' | 'stats'

const TOPICS: Record<HelpTopic, { label: string; emoji: string }> = {
  play: { label: '遊び方', emoji: '🎮' },
  create: { label: 'クイズを作る', emoji: '✏️' },
  share: { label: '共有する', emoji: '🌐' },
  stats: { label: '成績を見る', emoji: '📊' },
}

export const HELP_TOPICS = Object.keys(TOPICS) as HelpTopic[]

export function isHelpTopic(value: string): value is HelpTopic {
  return value in TOPICS
}

type Section = { name: string; value: string }

const CONTENT: Record<HelpTopic, { summary: string; sections: Section[] }> = {
  play: {
    summary: '`/quiz play` を実行すると、このチャンネルに出題パネルが開きます。',
    sections: [
      {
        name: '1. 設定する',
        value:
          'パネルでクイズ・出題数・プレイ形式を選びます。\n操作できるのはコマンドを実行した人（ホスト）だけです。',
      },
      {
        name: '2. 形式をえらぶ',
        value:
          '**1人** — ホストがひとりで解きます。「Play」ですぐ開始。\n**みんなで早押し** — 「募集開始」で参加者を集めます。',
      },
      {
        name: '3. 早押しで遊ぶ',
        value:
          '参加ボタンで集まり、ホストを含めて2人以上になるとホストが開始できます。\n各問**最初に正解した人が得点**。1問あたり**1分**で締め切り、募集は**10分**で終了します。',
      },
      {
        name: '回答のしかた',
        value: '4択・○×はボタン、自由記述は「回答する」からモーダルで入力します。',
      },
    ],
  },
  create: {
    summary: 'クイズは Discord でもWebでも作れます。',
    sections: [
      {
        name: 'クイズを作る',
        value: '`/quiz create title:タイトル` で作成します。説明文は任意です。',
      },
      {
        name: '設問を追加する',
        value:
          '`/quiz add-question` でパネルを開き、クイズと出題形式（4択 / ○× / 自由記述）を選んで入力します。',
      },
      {
        name: '自由記述の正解',
        value:
          '正解は複数登録できます（「東京」「とうきょう」など）。どれかに一致すれば正解になります。',
      },
      {
        name: '編集を任せる',
        value:
          '`/quiz editors` で他の人に設問の編集を許可できます（クイズの作成者のみ設定できます）。',
      },
      { name: '消す', value: '`/quiz delete` でパネルから選んで削除します。' },
    ],
  },
  share: {
    summary: '作ったクイズは、他のサーバーにも配れます。',
    sections: [
      {
        name: '公開する',
        value: '`/quiz visibility` で自分のクイズを「公開」に切り替えます（作成者のみ）。',
      },
      {
        name: '追加する',
        value:
          '`/quiz add-public` で公開クイズを探して、このサーバーに追加します。タイトル検索もできます。',
      },
      {
        name: '外す',
        value:
          '`/quiz remove-public` で追加を取り消します。追加は複製ではなく参照なので、元のクイズの修正がそのまま反映されます。',
      },
    ],
  },
  stats: {
    summary: '成績はサーバーごとに記録されます。結果はチャンネルに公開されます。',
    sections: [
      {
        name: 'クイズごと',
        value: '`/quiz stats` — クイズを選んで正答率や設問ごとの成績を見ます。',
      },
      { name: '自分の成績', value: '`/quiz my-stats` — このサーバーでの自分の記録を見ます。' },
      {
        name: 'ランキング',
        value: '`/quiz ranking` — 1人モードの正解数と、早押しの獲得数のTOP10を出します。',
      },
      {
        name: '記録のしかた',
        value: '1人モードと早押しは**別々に記録**されます（回答の性質が違うため）。',
      },
    ],
  },
}

/** トピック切り替えボタン。選択中は押せなくして現在地を示す。 */
function topicButtons(current: HelpTopic): Components {
  const components = new Components()
  components.row(
    ...HELP_TOPICS.map((topic) =>
      new Button(HELP_SELECT, `${TOPICS[topic].emoji} ${TOPICS[topic].label}`, 'Secondary')
        .custom_id(topic)
        .disabled(topic === current),
    ),
  )
  return components
}

export function buildHelpPanel(
  topic: HelpTopic,
  webUrl?: string,
): { embeds: Embed[]; components: Components } {
  const { summary, sections } = CONTENT[topic]
  const embed = panelEmbed({
    title: `クイズBotの使い方 — ${TOPICS[topic].label}`,
    description: summary,
    color: topic === 'play' ? COLOR.gold : COLOR.navy,
    fields: sections,
    footer: webUrl ? `Webからも管理できます: ${webUrl}` : undefined,
  })
  return { embeds: [embed], components: topicButtons(topic) }
}
