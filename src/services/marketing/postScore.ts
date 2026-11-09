/**
 * D-559 올리기 전 점수(100점 만점) — 규칙 계산(AI 아님).
 * 대표(2026-11-09): "클릭 한 번 · 요청 한 줄이면 바로 올려도 어색하지 않은, 최소 90점 · 당장 판매해도 되는 결과."
 *
 * 화면마다 이미 있는 규칙 검사 줄(스레드 · 릴스 · 1주일치) + 모든 글에 같은 점검 넷을 점수 하나로 묶는다.
 *  - 꼭 고칠 것 하나 −15 · 볼 것 하나 −5
 *  - 빈칸 [ ] 한 곳 −5(최대 −20) — 채우지 않으면 바로 올릴 수 없다
 *  - AI 티 나는 말('알아보겠습니다 · 결론적으로 · 다양한 · 여러분' …) 하나 −5(최대 −15)
 *  - 너무 긴 문장 −5(한 번) · 스레드 첫 줄에 숫자 없음 −5(D-558 제목 10개 중 8~9개 숫자)
 * 90점 이상 + 꼭 고칠 것 0 = '바로 올려도 돼요'. 감점 항목은 그대로 AI 에 '고칠 곳' 으로 보낼 수 있게 짧은 글로 만든다.
 */

import { consultLint } from './consultRules'

export type ScoreKind = 'thread' | 'short' | 'long'
export type ScoreLevel = 'ok' | 'warn' | 'bad'

export interface ScoreLine {
  key: string
  level: ScoreLevel
  text: string
}

export interface ScoreItem {
  key: string
  level: 'warn' | 'bad'
  minus: number
  text: string
}

export interface PostScore {
  score: number
  /** 90점 이상이고 꼭 고칠 것이 없다 */
  pass: boolean
  bad: number
  items: ScoreItem[]
}

export const PASS_SCORE = 90
export const BAD_MINUS = 15
export const WARN_MINUS = 5

/** 사람이 잘 안 쓰는 말 — 글이 기계가 쓴 것처럼 보이게 하는 말 */
const AI_TONE: readonly RegExp[] = [
  /알아보(?:겠습니다|도록\s*하겠습니다|볼게요|았습니다)/,
  /살펴보(?:겠습니다|도록\s*하겠습니다|볼게요|았습니다)/,
  /결론적으로|요약하자면|정리하자면|마무리하자면/,
  /에\s*대해\s*(?:이야기|말씀|설명)(?:해|을)?\s*(?:보겠|드리겠|드릴게)/,
  /다양한\s|효과적(?:인|으로)\s|중요한\s*역할/,
  /도움이\s*되(?:셨|었)기를|도움이\s*되시길/,
  /여러분/,
]

/** 첫 줄 숫자 — 숫자 · '세 가지 · 두 단계' 같은 말 숫자 */
const FIRST_NUM = /\d|(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*(?:가지|단계|번|개|줄|명|곳|달|해)/
/** 대본 줄의 시간 표시 · 화면 지시는 말이 아니다 */
const TIME_TAG = /^\s*\[\d{1,2}:\d{2}\]\s*/
const SCREEN_NOTE = /\((?:화면|자막|장면)[^)]*\)/g
const LONG_SENTENCE: Record<ScoreKind, number> = { thread: 60, short: 50, long: 90 }

/** 빈칸 — '[0:00]' 시간 표시는 빼고 센다 */
export function holesOf(text: string): string[] {
  return (text.match(/\[[^\]\n]{1,60}\]/g) ?? []).filter((b) => !/^\[\d{1,2}:\d{2}\]$/.test(b))
}

const spoken = (text: string) =>
  text
    .split('\n')
    .map((l) => l.replace(TIME_TAG, '').replace(SCREEN_NOTE, '').trim())
    .filter(Boolean)

const sentencesOf = (text: string) =>
  spoken(text)
    .flatMap((l) => l.split(/(?<=[.!?。？！])\s+/))
    .map((s) => s.trim())
    .filter((s) => s && !/^#/.test(s) && !/^\[[^\]]*\]$/.test(s))

const firstLine = (text: string) => spoken(text)[0] ?? ''
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)

/** 모든 글에 같은 점검 넷(빈칸 · AI 티 · 긴 문장 · 스레드 첫 줄 숫자) */
export function commonChecks(text: string, kind: ScoreKind): ScoreItem[] {
  const out: ScoreItem[] = []
  const t = text.trim()
  if (!t) return out
  const holes = holesOf(t)
  if (holes.length) out.push({ key: 'holes', level: 'warn', minus: Math.min(20, holes.length * WARN_MINUS), text: `빈칸 ${holes.length}곳 — 채우고 올려요: ${holes.slice(0, 3).join(' ')}` })
  const tone = AI_TONE.map((re) => re.exec(t)?.[0]?.trim() ?? '').filter(Boolean)
  if (tone.length) out.push({ key: 'ai-tone', level: 'warn', minus: Math.min(15, tone.length * WARN_MINUS), text: `기계가 쓴 것 같은 말 ${tone.length}개 — 사람이 말하듯 바꿔요: ${tone.map((w) => `"${w}"`).join(' · ')}` })
  const max = LONG_SENTENCE[kind]
  const long = sentencesOf(t).filter((s) => s.length > max)
  if (long.length) out.push({ key: 'long-sentence', level: 'warn', minus: WARN_MINUS, text: `긴 문장 ${long.length}개(${max}자 넘음) — 두 문장으로 끊어요: "${cut(long[0], 24)}"` })
  if (kind === 'thread') {
    const first = firstLine(t)
    if (first && !FIRST_NUM.test(first)) out.push({ key: 'first-num', level: 'warn', minus: WARN_MINUS, text: '첫 줄에 숫자가 없어요 — 개수 · 단계 · 기간 숫자를 넣으면 더 봐요' })
  }
  return out
}

/** 규칙 검사 목록에 덧붙여 보여 줄 공통 점검(빈칸은 규칙 검사 줄에 이미 있다) */
export const EXTRA_SCORE_KEYS: ReadonlySet<string> = new Set(['ai-tone', 'long-sentence', 'first-num'])

/** 이미 있는 규칙 검사 줄 → 감점(빈칸 줄은 공통 점검이 센다) */
const fromLines = (lines: readonly ScoreLine[]): ScoreItem[] =>
  lines
    .filter((l) => l.level !== 'ok' && l.key !== 'brackets')
    .map((l) => ({ key: l.key, level: l.level as 'warn' | 'bad', minus: l.level === 'bad' ? BAD_MINUS : WARN_MINUS, text: l.text }))

const total = (items: readonly ScoreItem[]): PostScore => {
  const sorted = [...items].sort((a, b) => (a.level === b.level ? b.minus - a.minus : a.level === 'bad' ? -1 : 1))
  const score = Math.max(0, 100 - sorted.reduce((a, x) => a + x.minus, 0))
  const bad = sorted.filter((x) => x.level === 'bad').length
  return { score, pass: score >= PASS_SCORE && bad === 0, bad, items: sorted }
}

/** 글 하나의 점수 — text 는 점검할 글 전체(대본이면 대본 + 설명 글), lines 는 그 화면의 규칙 검사 줄 */
export function scorePost(input: { kind: ScoreKind; text: string; lines: readonly ScoreLine[] }): PostScore | null {
  if (!input.text.trim()) return null
  return total([...fromLines(input.lines), ...commonChecks(input.text, input.kind)])
}

/**
 * 긴 영상 대본(제목 → 길이 → 대본) — 고른 길이에 맞는 분량 · 제목 숫자 · 컨설팅 글 점검 + 공통 점검.
 * target = 고른 길이의 목표 글자 수(1분 약 350자) · 글자 수는 줄바꿈만 빼고 센다.
 */
export function scoreScript(input: { title: string; text: string; target: number }): PostScore | null {
  const t = input.text.trim()
  if (!t) return null
  const lines: ScoreLine[] = []
  const n = t.replace(/\n/g, '').length
  if (input.target > 0 && (n < input.target * 0.6 || n > input.target * 1.5))
    lines.push({ key: 'length', level: 'warn', text: `분량 ${n.toLocaleString('ko-KR')}자 — 고른 길이(약 ${input.target.toLocaleString('ko-KR')}자)보다 ${n < input.target ? '많이 모자라요' : '많이 길어요'}` })
  if (input.title.trim() && !FIRST_NUM.test(input.title)) lines.push({ key: 'title-num', level: 'warn', text: '제목에 숫자가 없어요 — 개수 · 단계 · 기간 숫자를 넣으면 더 봐요' })
  lines.push(...consultLint(t))
  return total([...fromLines(lines), ...commonChecks(t, 'long')])
}

/** 1주일치처럼 줄 글만 남은 점검 묶음(꼭 고칠 것 · 볼 것 수) → 점수 */
export function scoreFromCounts(bad: number, warn: number): { score: number; pass: boolean } {
  const score = Math.max(0, 100 - bad * BAD_MINUS - warn * WARN_MINUS)
  return { score, pass: score >= PASS_SCORE && bad === 0 }
}

/** 점수 한 줄 — '92점 · 바로 올려도 돼요' / '75점 · 고칠 곳 3' */
export const scoreLabel = (s: Pick<PostScore, 'score' | 'pass'> & { items?: readonly ScoreItem[] }) =>
  s.pass ? `${s.score}점 · 바로 올려도 돼요` : `${s.score}점 · 고칠 곳 ${s.items?.length ?? 0}`

/** AI 에 보낼 '고칠 곳' 줄(감점이 큰 것부터 · 최대 8줄 · 줄마다 짧게) */
export function fixLines(s: PostScore): string[] {
  return s.items.slice(0, 8).map((x, i) => `${i + 1}) ${cut(x.text.replace(/\s+/g, ' '), 180)}`)
}

/** 점수 매기는 법(화면 '?' 설명 · 문서) */
export const SCORE_RULES: readonly string[] = [
  `100점에서 시작 — 꼭 고칠 것 하나 −${BAD_MINUS}점 · 볼 것 하나 −${WARN_MINUS}점`,
  `빈칸 [ ] 한 곳 −${WARN_MINUS}점(최대 −20) · 기계가 쓴 것 같은 말 하나 −${WARN_MINUS}점(최대 −15)`,
  `너무 긴 문장 −${WARN_MINUS}점 · 스레드 첫 줄에 숫자 없음 −${WARN_MINUS}점`,
  `${PASS_SCORE}점 이상이고 꼭 고칠 것이 없으면 '바로 올려도 돼요'`,
]
