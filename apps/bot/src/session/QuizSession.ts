import { DurableObject } from 'cloudflare:workers'
import {
  type Actor,
  AppError,
  type BuzzAttemptRecord,
  type Question,
  type SoloAttemptRecord,
  countQuizQuestions,
  createDb,
  getSessionQuestions,
  isCorrectAnswer,
  listPlayableQuizzes,
  recordBuzzAttempts,
  recordSoloAttempts,
} from '@quiz-bot/core'
import type { Bindings } from '../env'
import { editChannelMessage } from './discordRest'
import { buildSessionQuestion, buildSummary } from './messages'
import type {
  AnswerInput,
  AnswerOutcome,
  ControlResult,
  DraftView,
  Mode,
  NextStep,
  OpenDraftResult,
  PublicSessionQuestion,
  StartResult,
} from './types'

const PAGE_SIZE = 25
const MAX_COUNT = 50
const BUZZ_TIMEOUT_MS = 10 * 60 * 1000
const TRUE_FALSE_CHOICES = ['○', '×']

type SessionQuestion = {
  id: string
  type: 'multiple_choice' | 'true_false' | 'free_text'
  body: string
  choices: string[] | null
  answers: string[]
  explanation: string | null
}

type State = {
  status: 'draft' | 'active' | 'finished'
  guildId: string
  channelId: string
  hostUserId: string
  messageId: string | null
  // draft
  quizId: string | null
  page: number
  count: number
  mode: Mode
  // active
  questions: SessionQuestion[]
  index: number
  // solo
  soloCorrect: number
  // D1へ未送信のソロ回答。書き込み失敗時に次の回答で再送するためのバッファ。
  // デプロイを跨いだ既存セッションには存在しないため optional。
  soloPending?: SoloAttemptRecord[]
  // buzz (current question)
  buzzClosed: boolean
  buzzAnswered: string[]
  pending: BuzzAttemptRecord[]
  // buzz totals
  buzzScores: Record<string, number>
  sessionId: string
}

function toSessionQuestion(q: Question): SessionQuestion {
  return {
    id: q.id,
    type: q.type,
    body: q.body,
    choices: q.choices,
    answers: q.answers,
    explanation: q.explanation,
  }
}

function toPublic(q: SessionQuestion): PublicSessionQuestion {
  return { id: q.id, type: q.type, body: q.body, choices: q.choices }
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j] as T, a[i] as T]
  }
  return a
}

export class QuizSession extends DurableObject<Bindings> {
  private state: State | null = null

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get<State>('state')) ?? null
    })
  }

  private async save(): Promise<void> {
    if (this.state) await this.ctx.storage.put('state', this.state)
  }

  private actor(): Actor {
    const s = this.state
    if (!s) throw new Error('session not initialized')
    return { userId: s.hostUserId, guildId: s.guildId }
  }

  private async view(): Promise<DraftView> {
    const s = this.state
    if (!s) throw new Error('session not initialized')
    const db = createDb(this.env.DB)
    const all = await listPlayableQuizzes(db, this.actor())
    const totalQuizzes = all.length
    const maxPage = Math.max(0, Math.ceil(totalQuizzes / PAGE_SIZE) - 1)
    if (s.page > maxPage) s.page = maxPage
    const pageItems = all.slice(s.page * PAGE_SIZE, s.page * PAGE_SIZE + PAGE_SIZE)
    const selected = all.find((q) => q.id === s.quizId) ?? null

    const questionCount = selected ? await countQuizQuestions(db, selected.id) : 0
    // 選択中クイズの設問数を超える出題数は自動で丸める
    if (questionCount > 0 && s.count > questionCount) s.count = questionCount

    return {
      quizzes: pageItems,
      page: s.page,
      hasPrev: s.page > 0,
      hasNext: s.page < maxPage,
      totalQuizzes,
      selectedQuizId: selected?.id ?? null,
      selectedQuizTitle: selected?.title ?? null,
      selectedQuizDescription: selected?.description ?? null,
      questionCount,
      count: s.count,
      mode: s.mode,
    }
  }

  /**
   * /quiz play 実行時: ドラフトを初期化して設定GUIの表示モデルを返す。
   * 進行中のセッションは他人からは上書きさせない（設問・スコアが失われるため）。
   * ホスト本人には許可する。詰まったセッションを畳む唯一の手段になるため。
   */
  async openDraft(actor: Actor, channelId: string): Promise<OpenDraftResult> {
    const prev = this.state
    if (prev && prev.status === 'active') {
      if (prev.hostUserId !== actor.userId) {
        return { ok: false, reason: 'active-session', hostUserId: prev.hostUserId }
      }
      await this.discardActive()
    }

    const db = createDb(this.env.DB)
    const all = await listPlayableQuizzes(db, actor)
    this.state = {
      status: 'draft',
      guildId: actor.guildId ?? '',
      channelId,
      hostUserId: actor.userId,
      messageId: null,
      quizId: all[0]?.id ?? null,
      page: 0,
      count: 1,
      mode: 'solo',
      questions: [],
      index: 0,
      soloCorrect: 0,
      soloPending: [],
      buzzClosed: false,
      buzzAnswered: [],
      pending: [],
      buzzScores: {},
      sessionId: crypto.randomUUID(),
    }
    await this.save()
    return { ok: true, view: await this.view() }
  }

  /** 進行中セッションを畳む。記録済みの回答を捨てないよう先に書き出し、アラームも解除する。 */
  private async discardActive(): Promise<void> {
    try {
      await this.flushPending()
    } catch (error) {
      console.error('flushPending failed on discard', error)
    }
    await this.flushSoloPending()
    await this.ctx.storage.deleteAlarm()
  }

  /** 設定GUIを操作できるのはホストだけ。 */
  private guardHost(userId: string): { ok: false; reason: 'not-host' | 'no-session' } | null {
    const s = this.state
    if (!s) return { ok: false, reason: 'no-session' }
    if (s.hostUserId !== userId) return { ok: false, reason: 'not-host' }
    return null
  }

  async selectQuiz(userId: string, quizId: string): Promise<ControlResult> {
    const denied = this.guardHost(userId)
    if (denied) return denied
    ;(this.state as State).quizId = quizId
    await this.save()
    return { ok: true, view: await this.view() }
  }

  async changePage(userId: string, delta: number): Promise<ControlResult> {
    const denied = this.guardHost(userId)
    if (denied) return denied
    const s = this.state as State
    s.page = Math.max(0, s.page + delta)
    await this.save()
    return { ok: true, view: await this.view() }
  }

  async toggleMode(userId: string): Promise<ControlResult> {
    const denied = this.guardHost(userId)
    if (denied) return denied
    const s = this.state as State
    s.mode = s.mode === 'solo' ? 'buzz' : 'solo'
    await this.save()
    return { ok: true, view: await this.view() }
  }

  async setCount(userId: string, n: number): Promise<ControlResult> {
    const denied = this.guardHost(userId)
    if (denied) return denied
    const s = this.state as State
    s.count = Math.max(1, Math.min(MAX_COUNT, Number.isFinite(n) ? Math.floor(n) : 1))
    await this.save()
    return { ok: true, view: await this.view() }
  }

  /** Play押下時: 設問を確定してセッションを開始する。 */
  async start(userId: string, messageId: string): Promise<StartResult> {
    const denied = this.guardHost(userId)
    if (denied) return denied
    const s = this.state as State
    if (!s.quizId) return { ok: false, reason: 'no-quiz' }

    const db = createDb(this.env.DB)
    // getSessionQuestions は設問0件のとき notFound を投げるので、それだけを
    // 「設問なし」として扱う。D1障害などは握りつぶさず呼び出し側へ伝える。
    let all: Question[]
    try {
      all = await getSessionQuestions(db, this.actor(), s.quizId)
    } catch (error) {
      if (error instanceof AppError && error.code === 'NOT_FOUND') {
        return { ok: false, reason: 'no-questions' }
      }
      throw error
    }

    const picked = shuffle(all).slice(0, Math.min(s.count, all.length)).map(toSessionQuestion)
    s.questions = picked
    s.index = 0
    s.status = 'active'
    s.messageId = messageId
    s.soloCorrect = 0
    s.soloPending = []
    s.buzzScores = {}
    this.resetQuestionState()
    await this.save()

    if (s.mode === 'buzz') await this.ctx.storage.setAlarm(Date.now() + BUZZ_TIMEOUT_MS)

    const first = picked[0] as SessionQuestion
    return { ok: true, first: toPublic(first), number: 1, total: picked.length, mode: s.mode }
  }

  private resetQuestionState() {
    if (!this.state) return
    this.state.buzzClosed = false
    this.state.buzzAnswered = []
    this.state.pending = []
  }

  private current(): SessionQuestion | null {
    const s = this.state
    if (!s || s.status !== 'active') return null
    return s.questions[s.index] ?? null
  }

  private buildNext(): NextStep {
    const s = this.state as State
    const nextIndex = s.index + 1
    if (nextIndex >= s.questions.length) {
      s.status = 'finished'
      if (s.mode === 'solo') {
        return {
          done: true,
          summary: { mode: 'solo', correct: s.soloCorrect, total: s.questions.length },
        }
      }
      const scores = Object.entries(s.buzzScores).map(([userId, score]) => ({ userId, score }))
      return { done: true, summary: { mode: 'buzz', total: s.questions.length, scores } }
    }
    s.index = nextIndex
    const q = s.questions[nextIndex] as SessionQuestion
    return { done: false, question: toPublic(q), number: nextIndex + 1, total: s.questions.length }
  }

  private resolveSubmitted(q: SessionQuestion, input: AnswerInput): string {
    if (input.kind === 'text') return input.text
    if (q.type === 'true_false') return TRUE_FALSE_CHOICES[input.idx] ?? ''
    return q.choices?.[input.idx] ?? ''
  }

  /** 回答を処理する。DOが直列実行するため早押しの勝者確定は原子的。 */
  async answer(userId: string, questionId: string, input: AnswerInput): Promise<AnswerOutcome> {
    const s = this.state
    if (!s || s.status !== 'active') return { kind: 'ignored', reason: 'not-active' }
    const q = this.current()
    if (!q || q.id !== questionId) return { kind: 'ignored', reason: 'stale' }

    const submitted = this.resolveSubmitted(q, input)
    const correct = isCorrectAnswer(q.type, submitted, q.answers)

    if (s.mode === 'solo') {
      if (userId !== s.hostUserId) return { kind: 'ignored', reason: 'not-host' }
      if (correct) s.soloCorrect += 1

      if (s.quizId) {
        // デプロイを跨いだ既存セッションにはこのフィールドが無いため防御的に初期化する
        if (!s.soloPending) s.soloPending = []
        s.soloPending.push({
          sessionId: s.sessionId,
          quizId: s.quizId,
          guildId: s.guildId,
          questionId: q.id,
          userId,
          isCorrect: correct,
          submittedAnswer: submitted,
        })
        await this.flushSoloPending()
      }

      const next = this.buildNext()
      this.resetQuestionState()
      await this.save()
      return {
        kind: 'solo-result',
        correct,
        correctAnswers: q.answers,
        explanation: q.explanation,
        next,
      }
    }

    // buzz
    if (s.buzzClosed) return { kind: 'ignored', reason: 'closed' }
    if (s.buzzAnswered.includes(userId)) return { kind: 'ignored', reason: 'already' }
    s.buzzAnswered.push(userId)
    s.pending.push({
      sessionId: s.sessionId,
      quizId: s.quizId ?? '',
      guildId: s.guildId,
      questionId: q.id,
      userId,
      isCorrect: correct,
      isWinner: correct,
    })

    if (!correct) {
      await this.save()
      return { kind: 'buzz-wrong' }
    }

    // 最初の正解者 = 勝者
    s.buzzClosed = true
    s.buzzScores[userId] = (s.buzzScores[userId] ?? 0) + 1
    await this.flushPending()
    await this.ctx.storage.deleteAlarm()
    const next = this.buildNext()
    if (!next.done && s.mode === 'buzz') {
      this.resetQuestionState()
      await this.ctx.storage.setAlarm(Date.now() + BUZZ_TIMEOUT_MS)
    }
    await this.save()
    return {
      kind: 'buzz-win',
      winnerId: userId,
      correctAnswers: q.answers,
      explanation: q.explanation,
      next,
    }
  }

  /**
   * ソロの回答をD1へ書き込む。ユーザーのInteraction応答パス上で呼ばれるため、
   * 失敗してもプレイを止めない（バッファに残し次の回答時に再送する）。
   */
  private async flushSoloPending(): Promise<void> {
    const s = this.state
    if (!s?.soloPending?.length) return
    try {
      await recordSoloAttempts(createDb(this.env.DB), s.soloPending)
      s.soloPending = []
    } catch (error) {
      console.error('recordSoloAttempts failed', error)
    }
  }

  private async flushPending(): Promise<void> {
    const s = this.state
    if (!s || s.pending.length === 0) return
    const db = createDb(this.env.DB)
    await recordBuzzAttempts(db, s.pending)
    s.pending = []
  }

  /** 早押しの制限時間切れ。正解者なしで締め切り、次の問題を投稿する。 */
  async alarm(): Promise<void> {
    const s = this.state
    if (!s || s.status !== 'active' || s.mode !== 'buzz' || s.buzzClosed) return
    s.buzzClosed = true
    await this.flushPending()
    const next = this.buildNext()

    if (!s.messageId) {
      await this.save()
      return
    }

    if (next.done) {
      await editChannelMessage(this.env.DISCORD_TOKEN, s.channelId, s.messageId, {
        content: `⏰ 時間切れ。\n\n${buildSummary(next.summary)}`,
        components: [],
      })
    } else {
      const msg = buildSessionQuestion(next, s.messageId, '⏰ 時間切れ（正解者なし）')
      await editChannelMessage(this.env.DISCORD_TOKEN, s.channelId, s.messageId, {
        content: msg.content,
        components: msg.components.toJSON(),
      })
      this.resetQuestionState()
      await this.ctx.storage.setAlarm(Date.now() + BUZZ_TIMEOUT_MS)
    }
    await this.save()
  }
}
