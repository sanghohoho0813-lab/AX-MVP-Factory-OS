/**
 * 개발자에게 피드백 (D-188).
 *
 * 대표: "팀장님 화면 왼쪽 아래(버전 글자 자리)에 눈에 띄는 [개발자에게 피드백] — 주기적으로, 클릭 위주로 하는 설문.
 * 1~5점, 해당되는 것 모두 체크(중복 가능), 마지막에 직접 입력. 보내면 내 화면 [받은 피드백함] 에 예쁘게 정리돼 오고 알림도."
 *
 *  - 설문은 2주마다 한 회차(1~15일 · 16일~). 같은 질문을 되풀이해 회차마다 비교할 수 있게 한다.
 *  - 질문은 다음 고도화 순서를 정하는 데 쓰는 것만: 편한가 · 서류 읽기가 맞나 · 추천이 도움 되나 · 고객 앞에서 보여 줄 만한가 ·
 *    자주 쓴 것 · 불편한 것 · 다음에 생기면 좋을 것 · 제일 먼저 고칠 곳 · 하고 싶은 말.
 *  - 다 답하지 않아도 된다(안 써 본 것은 비워 둔다). 하나라도 답해야 보낸다.
 *  - 저장: 보내는 사람 작업공간의 모듈 기록(module_data · feedback/responses). 대표는 팀장 작업공간 편집자라(0020) 그대로 읽는다 — DB 변경 없음.
 *    대표가 읽으면 그 줄에 readAt 을 적는다(팀장 화면에 '대표님 읽음').
 *
 * 규칙 계산 — 외부 호출 · LLM 0.
 */

import { listRows, saveRow, type ModuleRow } from './moduleData'

export const FEEDBACK_MODULE = 'feedback'
export const FEEDBACK_BUCKET = 'responses'
/** 보낸 · 읽은 피드백이 바뀌었을 때 화면들(사이드바 숫자 · 종)이 다시 센다 */
export const FEEDBACK_CHANGED = 'axmvp:feedback-changed'

export type FeedbackQuestion =
  | { id: string; kind: 'rating'; title: string; low: string; high: string }
  | { id: string; kind: 'multi'; title: string; options: string[] }
  | { id: string; kind: 'single'; title: string; options: string[] }
  | { id: string; kind: 'text'; title: string; placeholder: string }

export const FEEDBACK_QUESTIONS: FeedbackQuestion[] = [
  { id: 'easy', kind: 'rating', title: '지난 2주, OS 로 일하기 얼마나 편했나요?', low: '많이 불편', high: '아주 편함' },
  { id: 'docs', kind: 'rating', title: '서류(사업자등록증 · 크레탑 …)를 올렸을 때 칸이 맞게 채워졌나요?', low: '거의 틀림', high: '거의 맞음' },
  { id: 'reco', kind: 'rating', title: '맞춤 추천(모듈 추천)이 상담 준비에 도움이 됐나요?', low: '도움 안 됨', high: '큰 도움' },
  { id: 'show', kind: 'rating', title: '고객 대표님 앞에서 이 화면을 보여 드리기 자신 있나요?', low: '보여 주기 어려움', high: '자신 있음' },
  {
    id: 'used',
    kind: 'multi',
    title: '이번에 자주 쓴 기능 — 해당되는 것 모두',
    options: ['오늘 할 일', '고객 관리', '서류 올리기', '맞춤 추천', '영업 관리 · 미팅 준비', '일정 달력', '지원사업 알림', '계산기 · 전문 모듈'],
  },
  {
    id: 'pain',
    kind: 'multi',
    title: '불편했던 점 — 해당되는 것 모두',
    options: ['글자가 작거나 화면이 복잡함', '단추 · 메뉴를 찾기 어려움', '휴대폰에서 쓰기 불편', '서류 읽기가 틀림', '느리거나 멈춤', '말(용어)이 어려움', '저장됐는지 헷갈림'],
  },
  {
    id: 'want',
    kind: 'multi',
    title: '다음에 있으면 좋겠는 것 — 해당되는 것 모두',
    options: ['고객에게 보낼 제안서 자동 만들기', '카톡 문구 더 많이', '휴대폰 일정 알림', '상담 녹음 → 메모 정리', '지원사업 더 정확히 맞추기', '계산기 상황 예시', '고객 서류 요청 자동', '사용법 영상 더'],
  },
  {
    id: 'first',
    kind: 'single',
    title: '제일 먼저 손봤으면 하는 곳 하나',
    options: ['오늘 할 일', '고객 관리 · 업체 상세', '서류함', '영업 관리', '일정 달력', '지원사업 알림', '계산기 · 전문 모듈', '휴대폰 화면'],
  },
  { id: 'note', kind: 'text', title: '그 밖에 하고 싶은 말 — 직접 적어 주세요', placeholder: '예: 업체 상세에서 ○○을 찾기 어려웠어요 / ○○ 기능이 있으면 좋겠어요' },
]

export type FeedbackAnswers = Record<string, number | string | string[]>

export interface FeedbackAuthor {
  id: string
  name: string
  title: string
  email: string
}

export interface FeedbackEntry {
  id: string
  workspaceId: string
  round: string
  roundLabel: string
  answers: FeedbackAnswers
  author: FeedbackAuthor
  at: string
  readAt: string | null
  device: string
}

/** 2주 회차 — '2026-10-B'(16일~) · '2026-10-A'(1~15일) */
export function feedbackRound(today: string): { id: string; label: string } {
  const [y, m, d] = today.split('-').map(Number)
  const half = d >= 16 ? 'B' : 'A'
  return { id: `${y}-${String(m).padStart(2, '0')}-${half}`, label: `${m}월 ${half === 'A' ? '1차' : '2차'} 설문` }
}

/** 답에서 비어 있는 것을 뺀다 — 점수는 1~5 정수, 고르기는 보기 안의 것만, 글은 2,000자까지 */
export function cleanAnswers(raw: FeedbackAnswers): FeedbackAnswers {
  const out: FeedbackAnswers = {}
  for (const q of FEEDBACK_QUESTIONS) {
    const v = raw[q.id]
    if (q.kind === 'rating') {
      if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5) out[q.id] = v
    } else if (q.kind === 'multi') {
      const picked = Array.isArray(v) ? q.options.filter((o) => v.includes(o)) : []
      if (picked.length > 0) out[q.id] = picked
    } else if (q.kind === 'single') {
      if (typeof v === 'string' && q.options.includes(v)) out[q.id] = v
    } else {
      const t = typeof v === 'string' ? v.trim().slice(0, 2000) : ''
      if (t) out[q.id] = t
    }
  }
  return out
}

export function answeredCount(raw: FeedbackAnswers): number {
  return Object.keys(cleanAnswers(raw)).length
}

function entryOf(row: ModuleRow, workspaceId: string): FeedbackEntry {
  const d = row.data as Partial<FeedbackEntry> & { author?: Partial<FeedbackAuthor> }
  return {
    id: row.id,
    workspaceId,
    round: String(d.round ?? ''),
    roundLabel: String(d.roundLabel ?? ''),
    answers: cleanAnswers((d.answers ?? {}) as FeedbackAnswers),
    author: { id: String(d.author?.id ?? ''), name: String(d.author?.name ?? ''), title: String(d.author?.title ?? ''), email: String(d.author?.email ?? '') },
    at: String(d.at ?? row.createdAt),
    readAt: typeof d.readAt === 'string' && d.readAt ? d.readAt : null,
    device: String(d.device ?? ''),
  }
}

/** 작업공간 하나의 피드백 — 최신 먼저 */
export async function listFeedback(workspaceId: string | null): Promise<FeedbackEntry[]> {
  if (!workspaceId) return []
  const rows = await listRows(workspaceId, FEEDBACK_MODULE, FEEDBACK_BUCKET)
  return rows.map((r) => entryOf(r, workspaceId)).sort((a, b) => b.at.localeCompare(a.at))
}

function changed(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FEEDBACK_CHANGED))
}

export async function submitFeedback(
  workspaceId: string | null,
  input: { answers: FeedbackAnswers; author: FeedbackAuthor; today: string; at: string; device: string },
): Promise<FeedbackEntry> {
  const answers = cleanAnswers(input.answers)
  if (Object.keys(answers).length === 0) throw new Error('하나라도 답해 주세요.')
  const round = feedbackRound(input.today)
  const data = { kind: 'survey', round: round.id, roundLabel: round.label, answers, author: input.author, at: input.at, readAt: null, device: input.device }
  const row = await saveRow(workspaceId, FEEDBACK_MODULE, FEEDBACK_BUCKET, { data })
  changed()
  return entryOf(row, workspaceId ?? '')
}

/** 대표가 읽음 — 그 줄에 읽은 시각을 적는다(팀장 화면에 '대표님 읽음') */
export async function markFeedbackRead(entries: readonly FeedbackEntry[], at: string): Promise<number> {
  let n = 0
  for (const e of entries) {
    if (e.readAt) continue
    const { id, workspaceId, ...rest } = e
    await saveRow(workspaceId, FEEDBACK_MODULE, FEEDBACK_BUCKET, { id, data: { kind: 'survey', ...rest, readAt: at } })
    n += 1
  }
  if (n > 0) changed()
  return n
}

export interface FeedbackSummary {
  responses: number
  /** D-222 보낸 사람 수(같은 사람이 여러 번 보내도 1명) */
  people: number
  ratings: { id: string; title: string; average: number | null; count: number; low: string; high: string }[]
  choices: { id: string; title: string; multi: boolean; counts: { option: string; count: number }[] }[]
  texts: { at: string; name: string; text: string }[]
}

/** 회차(또는 전체) 모아 보기 — 평균 점수 · 고른 수 많은 순 · 직접 쓴 말 */
export function summarizeFeedback(entries: readonly FeedbackEntry[]): FeedbackSummary {
  const ratings = FEEDBACK_QUESTIONS.filter((q) => q.kind === 'rating').map((q) => {
    const vals = entries.map((e) => e.answers[q.id]).filter((v): v is number => typeof v === 'number')
    const average = vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null
    return { id: q.id, title: q.title, average, count: vals.length, low: q.kind === 'rating' ? q.low : '', high: q.kind === 'rating' ? q.high : '' }
  })
  const choices = FEEDBACK_QUESTIONS.filter((q) => q.kind === 'multi' || q.kind === 'single').map((q) => {
    const options = q.kind === 'multi' || q.kind === 'single' ? q.options : []
    const counts = options
      .map((option) => ({ option, count: entries.filter((e) => { const v = e.answers[q.id]; return Array.isArray(v) ? v.includes(option) : v === option }).length }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count || options.indexOf(a.option) - options.indexOf(b.option))
    return { id: q.id, title: q.title, multi: q.kind === 'multi', counts }
  })
  const texts = entries
    .filter((e) => typeof e.answers.note === 'string')
    .map((e) => ({ at: e.at, name: e.author.name, text: String(e.answers.note) }))
  const people = new Set(entries.map((e) => e.author.id || e.author.email || e.author.name)).size
  return { responses: entries.length, people, ratings, choices, texts }
}
