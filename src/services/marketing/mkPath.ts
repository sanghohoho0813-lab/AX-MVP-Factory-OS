/**
 * D-566 마케팅 처음 시작 길 — 어디서부터 해야 할지 모르는 사람에게 '지금 할 한 가지' 를 차례로.
 * 대표(2026-11-10): "컨설턴트들이 가장 원하는 건 마케팅 — 고객 DB 확보다. 어디서부터 어떻게 시작해야 할지 모르는 사람이 대부분이라
 *                    그걸 이 OS 안에서 해결하고, 교육적인 면에서도 좋고, 매일 들어와서 하게."
 *
 *  - 다섯 걸음(내 채널 → 주제 → 글 한 편 → 올리기 → 연락 받는 길)을 실제 기록으로 본다 — 따로 저장하는 진행 기록 없음.
 *  - 걸음마다 '왜 하나요' 한 줄(배우면서 하게) + 큰 단추 하나(누르면 그 자리로).
 *  - 다섯 걸음을 다 하면 '오늘의 한 가지' — 요일마다 하나(월 주제 · 화목토 짧은 글 · 수금 짧은 영상 · 일 돌아보기) + 이번 주 올린 편 수.
 * 규칙 계산이다 — AI 가 아니다. 쉬운 말만 쓴다(D-507 — 업계 말 없이).
 */

export type PathKey = 'channel' | 'topic' | 'write' | 'post' | 'ending'

export interface PathStep {
  key: PathKey
  title: string
  /** 왜 하나요 — 한 줄 */
  why: string
  /** 큰 단추 글자 */
  action: string
  /** 누르면 가는 곳 */
  href: string
  done: boolean
}

export interface PathInput {
  /** 내 브랜드(이름 · 회사 · 분야)를 한 칸이라도 적었거나 올릴 주제 분야를 골랐다 */
  channel: boolean
  /** 담아 둔 주제 수 */
  ideas: number
  /** 써 둔 글 · 대본 수(스레드 + 짧은 영상) */
  written: number
  /** 올렸다고 표시한 글 · 대본 수 */
  posted: number
  /** 내 브랜드 '끝인사 · 바라는 행동' 을 적었다 */
  ending: boolean
}

export function mkPathSteps(i: PathInput): PathStep[] {
  return [
    { key: 'channel', title: '내 채널 알려 주기', why: '누가 쓰는 글인지 정해져야 읽는 사람이 믿어요. 이름 · 분야만 적어도 글이 내 것으로 나와요.', action: '이름 · 분야 적기', href: '/settings', done: i.channel },
    { key: 'topic', title: '이번 주 주제 하나 고르기', why: '사람들이 지금 찾는 주제로 써야 처음 보는 사람이 들어와요. 프로그램이 골라 둔 것 가운데 하나만 누르면 돼요.', action: '이번 주 주제 보기', href: '/marketing/youtube?view=plan', done: i.ideas > 0 || i.written > 0 },
    { key: 'write', title: '짧은 글 한 편 쓰기', why: '잘 쓴 한 편보다 꾸준한 열 편이 고객을 데려와요. 초안은 프로그램이 써 주니 고치기만 하면 돼요.', action: '짧은 글 쓰러 가기', href: '/marketing/threads', done: i.written > 0 },
    { key: 'post', title: '올리고 [올렸어요] 누르기', why: '올려야 반응을 알 수 있어요. 올린 날을 남겨 두면 어떤 글이 잘됐는지 나중에 보여 드려요.', action: '써 둔 글 보기', href: '/marketing/threads', done: i.posted > 0 },
    { key: 'ending', title: '글 끝에 연락 받는 길 넣기', why: '글을 본 사람이 연락할 길이 없으면 고객이 되지 않아요. 한 번 적어 두면 글 끝에 저절로 붙어요.', action: '끝인사 적기', href: '/settings?brand=more', done: i.ending },
  ]
}

/** 아직 안 한 첫 걸음(차례대로) — 다 했으면 null */
export function mkPathNext(steps: readonly PathStep[]): PathStep | null {
  return steps.find((s) => !s.done) ?? null
}

export interface DailyMission {
  key: 'topic' | 'thread' | 'short' | 'review'
  title: string
  why: string
  action: string
  href: string
}

const DAILY: Record<DailyMission['key'], DailyMission> = {
  topic: { key: 'topic', title: '이번 주 주제 고르기', why: '한 주를 시작할 때 주제를 정해 두면 나머지 요일은 쓰기만 하면 돼요.', action: '이번 주 주제 보기', href: '/marketing/youtube?view=plan' },
  thread: { key: 'thread', title: '짧은 글 한 편', why: '짧은 글은 자주 올릴수록 처음 보는 사람이 늘어요. 5분이면 돼요.', action: '짧은 글 쓰러 가기', href: '/marketing/threads' },
  short: { key: 'short', title: '짧은 영상 대본 한 편', why: '얼굴과 목소리가 나오면 믿음이 빨리 생겨요. 대본대로 1분만 찍으면 돼요.', action: '대본 만들러 가기', href: '/marketing/shorts' },
  review: { key: 'review', title: '이번 주 올린 글 돌아보기', why: '반응이 좋았던 글을 알아야 다음 주에 같은 방법으로 또 쓸 수 있어요.', action: '만든 것 보기', href: '/marketing/youtube?view=make' },
}

/** 요일(0 일 ~ 6 토)마다 오늘의 한 가지 — 월 주제 · 화목토 짧은 글 · 수금 짧은 영상 · 일 돌아보기 */
export function dailyMission(weekday: number): DailyMission {
  const d = ((Math.trunc(weekday) % 7) + 7) % 7
  if (d === 0) return DAILY.review
  if (d === 1) return DAILY.topic
  if (d === 3 || d === 5) return DAILY.short
  return DAILY.thread
}

/** YYYY-MM-DD 가 든 주의 월요일 */
export function weekStart(today: string): string {
  const [y, m, d] = today.split('-').map(Number)
  const t = new Date(Date.UTC(y, (m || 1) - 1, d || 1))
  const back = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - back)
  return t.toISOString().slice(0, 10)
}

/** 이번 주(월 ~ 오늘)에 올렸다고 표시한 편 수 */
export function postedThisWeek(posts: ReadonlyArray<{ status: string; postedOn: string }>, today: string): number {
  const from = weekStart(today)
  return posts.filter((p) => p.status === 'posted' && p.postedOn >= from && p.postedOn <= today).length
}

/** 요일 숫자(0 일 ~ 6 토) — YYYY-MM-DD 에서 */
export function weekdayOf(today: string): number {
  const [y, m, d] = today.split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay()
}
