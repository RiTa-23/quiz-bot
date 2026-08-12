import type {
  BuzzRankingEntry,
  EditorSettings,
  Me,
  MemberStats,
  PublicQuizListing,
  Quiz,
  QuizDetail,
  QuizStats,
  RankingEntry,
} from './types'

/**
 * dev限定のAPIモック（`bun run dev:mock`）。
 * ローカルではDiscordログインを通せず認証の先の画面を確認できないため、
 * 代表的なデータを返して各画面・各状態を目視できるようにする。
 * 本番ビルドでは VITE_MOCK が未設定なので、このモジュールは丸ごと除外される。
 */

const ME: Me = {
  userId: '100',
  username: 'you',
  displayName: 'あなた',
  guilds: [
    { id: 'g1', name: 'テストサーバー' },
    { id: 'g2', name: '開発サーバー' },
  ],
  botInstallUrl: 'https://discord.com/oauth2/authorize?mock',
}

const Q1: Quiz = {
  id: 'q1',
  title: '日本の地理クイズ',
  description: '都道府県や地名にまつわる全10問。',
  ownerUserId: '100',
  ownerGuildId: 'g1',
  visibility: 'public',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  role: 'owner',
  isOwner: true,
}

const Q2: Quiz = {
  id: 'q2',
  title: 'アニメ○×クイズ',
  description: null,
  ownerUserId: '100',
  ownerGuildId: 'g1',
  visibility: 'private',
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
  role: 'owner',
  isOwner: true,
}

const Q3: Quiz = {
  id: 'q3',
  title: '英単語クイズ（共有）',
  description: '別の人が作ったクイズを追加した状態の表示確認用。',
  ownerUserId: '200',
  ownerGuildId: 'g9',
  visibility: 'public',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z',
  role: 'editor',
  isOwner: false,
}

const QUIZZES: Quiz[] = [Q1, Q2, Q3]

const DETAILS: Record<string, QuizDetail> = {
  q1: {
    ...Q1,
    authors: {
      '100': { id: '100', displayName: 'あなた', avatarUrl: null },
      '200': { id: '200', displayName: 'ゲスト編集者', avatarUrl: null },
    },
    questions: [
      {
        id: 'qq1',
        quizId: 'q1',
        type: 'multiple_choice',
        body: '日本で最も面積の大きい都道府県はどれ？',
        choices: ['北海道', '岩手県', '福島県', '長野県'],
        answers: ['北海道'],
        explanation: '北海道は全国の約2割の面積を占めます。',
        sortOrder: 0,
        createdByUserId: '100',
      },
      {
        id: 'qq2',
        quizId: 'q1',
        type: 'true_false',
        body: '琵琶湖は滋賀県にある。',
        choices: null,
        answers: ['○'],
        explanation: null,
        sortOrder: 1,
        createdByUserId: '200',
      },
      {
        id: 'qq3',
        quizId: 'q1',
        type: 'free_text',
        body: '日本の首都は？（ひらがな・漢字どちらでも）',
        choices: null,
        answers: ['東京', 'とうきょう', 'Tokyo'],
        explanation: '複数の正解パターンを登録できます。',
        sortOrder: 2,
        createdByUserId: '100',
      },
    ],
  },
  q2: {
    ...Q2,
    authors: { '100': { id: '100', displayName: 'あなた', avatarUrl: null } },
    questions: [],
  },
  q3: {
    ...Q3,
    authors: { '200': { id: '200', displayName: 'ゲスト編集者', avatarUrl: null } },
    questions: [
      {
        id: 'qq9',
        quizId: 'q3',
        type: 'multiple_choice',
        body: '"apple" の意味は？',
        choices: ['りんご', 'みかん', 'ぶどう', 'もも'],
        answers: ['りんご'],
        explanation: null,
        sortOrder: 0,
        createdByUserId: '200',
      },
    ],
  },
}

const PUBLIC_AVAILABLE: PublicQuizListing[] = [
  { id: 'p1', title: '世界の国旗クイズ', description: '全12問', ownerGuildId: 'g9', questionCount: 12 },
  {
    id: 'p2',
    title: 'ことわざクイズ',
    description: '日本のことわざを集めた定番セット',
    ownerGuildId: 'g9',
    questionCount: 20,
  },
]

const PUBLIC_ADDED: PublicQuizListing[] = [
  { id: 'q3', title: '英単語クイズ（共有）', description: null, ownerGuildId: 'g9', questionCount: 30 },
]

const MEMBER_STATS: MemberStats = {
  userId: '100',
  guildId: 'g1',
  solo: {
    totalAttempts: 48,
    correctCount: 39,
    correctRate: 0.81,
    quizCount: 6,
    lastPlayedAt: '2026-08-10T00:00:00.000Z',
  },
  buzz: { answeredCount: 22, winCount: 14 },
  topQuizzes: [
    { quizId: 'q1', title: '日本の地理クイズ', totalAttempts: 20, correctCount: 18, correctRate: 0.9 },
    { quizId: 'q2', title: 'アニメ○×クイズ', totalAttempts: 15, correctCount: 11, correctRate: 0.73 },
  ],
}

const SOLO_RANKING: RankingEntry[] = [
  { userId: '100', displayName: 'あなた', totalAttempts: 48, correctCount: 39, correctRate: 0.81 },
  { userId: '200', displayName: 'ゲスト編集者', totalAttempts: 40, correctCount: 30, correctRate: 0.75 },
  { userId: '300', displayName: 'たろう', totalAttempts: 33, correctCount: 22, correctRate: 0.67 },
  { userId: '400', displayName: null, totalAttempts: 10, correctCount: 5, correctRate: 0.5 },
]

const BUZZ_RANKING: BuzzRankingEntry[] = [
  { userId: '200', displayName: 'ゲスト編集者', winCount: 18, answeredCount: 25 },
  { userId: '100', displayName: 'あなた', winCount: 14, answeredCount: 22 },
  { userId: '300', displayName: 'たろう', winCount: 7, answeredCount: 19 },
]

const QUIZ_STATS: Record<string, QuizStats> = {
  q1: {
    quizId: 'q1',
    title: '日本の地理クイズ',
    totalAttempts: 60,
    correctCount: 48,
    correctRate: 0.8,
    uniqueUserCount: 12,
    questions: [
      {
        questionId: 'qq1',
        body: '日本で最も面積の大きい都道府県はどれ？',
        sortOrder: 0,
        totalAttempts: 20,
        correctCount: 18,
        correctRate: 0.9,
      },
      {
        questionId: 'qq2',
        body: '琵琶湖は滋賀県にある。',
        sortOrder: 1,
        totalAttempts: 20,
        correctCount: 17,
        correctRate: 0.85,
      },
      {
        questionId: 'qq3',
        body: '日本の首都は？（ひらがな・漢字どちらでも）',
        sortOrder: 2,
        totalAttempts: 20,
        correctCount: 13,
        correctRate: 0.65,
      },
    ],
  },
}

const EDITORS: EditorSettings = {
  guildAllowed: false,
  userIds: ['123456789012345678'],
}

const NOT_FOUND = Symbol('not-found')

function route(pathname: string, method: string, query: URLSearchParams): unknown | typeof NOT_FOUND {
  const seg = pathname.split('/').filter(Boolean)
  const at = (i: number) => seg[i]

  // 認証・共通
  if (pathname === '/api/me') return ME
  if (pathname === '/api/bot-install-url') return { botInstallUrl: ME.botInstallUrl }
  if (pathname === '/auth/logout') return {}

  if (at(0) === 'api' && at(1) === 'guilds') {
    // /api/guilds/:gid/me/stats, /stats/ranking, /stats/buzz-ranking
    if (at(3) === 'me' && at(4) === 'stats') return MEMBER_STATS
    if (at(3) === 'stats' && at(4) === 'ranking') return SOLO_RANKING
    if (at(3) === 'stats' && at(4) === 'buzz-ranking') return BUZZ_RANKING
  }

  if (at(0) === 'api' && at(1) === 'quizzes') {
    const third = at(2)

    // コレクション系（:idより先に判定する）
    if (third === undefined) {
      if (method === 'POST') return {} // 作成
      return QUIZZES
    }
    if (third === 'public') {
      const kw = query.get('keyword')?.trim().toLowerCase()
      if (!kw) return PUBLIC_AVAILABLE
      return PUBLIC_AVAILABLE.filter((q) => q.title.toLowerCase().includes(kw))
    }
    if (third === 'added') return PUBLIC_ADDED

    // 個別クイズ /api/quizzes/:id/...
    const id = third
    const sub = at(3)
    if (sub === undefined) {
      if (method === 'GET') return DETAILS[id] ?? NOT_FOUND
      return {} // PATCH / DELETE
    }
    if (sub === 'stats') return QUIZ_STATS[id] ?? QUIZ_STATS.q1
    if (sub === 'editors') {
      if (method === 'GET') return EDITORS
      return {} // PUT（guild / users）
    }
    if (sub === 'questions') return {} // POST / PATCH / DELETE
    if (sub === 'shares') return {} // POST / DELETE
  }

  return NOT_FOUND
}

export async function mockRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, 'http://mock.local')
  const method = (init?.method ?? 'GET').toUpperCase()

  // 新しいSpinnerや遷移を確認できるよう、わずかに遅延させる
  await new Promise((r) => setTimeout(r, 200))

  const result = route(url.pathname, method, url.searchParams)
  if (result === NOT_FOUND) {
    throw new Error(`[mock] 未定義のエンドポイント: ${method} ${url.pathname}`)
  }
  return result as T
}
