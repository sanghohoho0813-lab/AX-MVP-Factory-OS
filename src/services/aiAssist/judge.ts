/**
 * D-263 악마판사 답 읽기 — 명세서 · 벤처 사업계획서 판사 단추(spec.judge · venture.judge)가 같은 모양으로 답한다.
 *   score   — amount = 합계(100점 만점) · detail = A~J 점수 한 줄
 *   verdict — tag = P0 · 감점 · 대표 확인 · detail = 무엇이 문제 · body = 어떻게 고쳤는지(대표 확인이면 물을 질문)
 *   그 밖   — 고친 칸(title = 칸 이름표 · body = 고친 전체 글)
 * 판정 기록(JudgeReport)은 명세서 초안 · 사업계획서 기록에 같이 남아 화면이 점수 · P0 · 고친 칸을 보여 준다.
 */
import type { AssistAnswer, AssistItem } from './client'

export type JudgeLevel = 'P0' | '감점' | '대표 확인'
export interface JudgeVerdict {
  level: JudgeLevel
  text: string
  fix: string
}
export interface JudgeReport {
  at: string
  /** 판정 범위 — 구성 · 전체(명세서) · 요약 · 전체(사업계획서) */
  scope: string
  score: number | null
  /** A~J 점수 한 줄 */
  scores: string
  verdicts: JudgeVerdict[]
  /** 판사가 직접 고친 칸 이름 */
  fixed: string[]
  /** 직접 고친 칸이라 덮지 않고 새 안으로 둔 칸 */
  kept: string[]
  /** 몇 번 판정했나(1 = 한 번에 통과 · 2 = 고친 뒤 다시 판정) */
  rounds: number
  /** 대표가 붙여 넣은 /악마판사 정의로 판정했나 */
  custom: boolean
  headline: string
}

/** 제출 · 출원해도 되는 판정 — 90점 이상 · P0 없음 */
export const JUDGE_PASS = 90
export const judgePassed = (r: Pick<JudgeReport, 'score' | 'verdicts'> | null | undefined): boolean => !!r && r.score != null && r.score >= JUDGE_PASS && !r.verdicts.some((v) => v.level === 'P0')

const squash = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[\s_\-:：·.]/g, '')
const isScore = (it: AssistItem) => ['score', '점수', '총점', '합계'].includes(squash(it.title))
const isVerdict = (it: AssistItem) => ['verdict', '판결', '판정', 'issue', '문제'].includes(squash(it.title))

function levelOf(tag: unknown): JudgeLevel {
  const t = String(tag ?? '')
  if (/p\s*0/i.test(t)) return 'P0'
  if (/확인|질문|ask/i.test(t)) return '대표 확인'
  return '감점'
}

function scoreOf(v: unknown): number | null {
  const m = /(\d{1,3})(?:\s*(?:\/\s*100|점))?/.exec(String(v ?? ''))
  if (!m) return null
  const n = Number(m[1])
  return n >= 0 && n <= 100 ? n : null
}

/** 판사 답 → 점수 · 판결 · 고친 칸 */
export function judgeOf(answer: AssistAnswer | null): { score: number | null; scores: string; verdicts: JudgeVerdict[]; rewrites: AssistItem[]; headline: string } {
  const items = answer?.items ?? []
  const s = items.find(isScore)
  const headline = String(answer?.headline ?? '').trim()
  const score = s ? (scoreOf(s.amount) ?? scoreOf(s.body) ?? scoreOf(s.detail)) : /점수|score/i.test(headline) ? scoreOf(/(?:점수|score)\s*[:：]?\s*(\d{1,3})/i.exec(headline)?.[1]) : null
  const verdicts = items
    .filter(isVerdict)
    .map((it) => ({ level: levelOf(it.tag), text: String(it.detail ?? '').trim() || String(it.body ?? '').trim(), fix: it.detail ? String(it.body ?? '').trim() : '' }))
    .filter((v) => v.text)
    .slice(0, 12)
  const rewrites = items.filter((it) => !isScore(it) && !isVerdict(it) && String(it.body ?? '').trim())
  return { score, scores: s ? String(s.detail ?? '').trim() : '', verdicts, rewrites, headline }
}

/** 저장된 판정 기록을 안전하게 읽는다 */
export function readJudgeReport(v: unknown): JudgeReport | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const str = (x: unknown) => (typeof x === 'string' ? x : '')
  const strs = (x: unknown) => (Array.isArray(x) ? x.map(str).filter(Boolean).slice(0, 20) : [])
  const verdicts = Array.isArray(o.verdicts)
    ? o.verdicts
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => ({ level: (['P0', '감점', '대표 확인'] as const).includes(x.level as JudgeLevel) ? (x.level as JudgeLevel) : '감점', text: str(x.text), fix: str(x.fix) }))
        .filter((x) => x.text)
        .slice(0, 12)
    : []
  const score = typeof o.score === 'number' && o.score >= 0 && o.score <= 100 ? o.score : null
  if (score == null && !verdicts.length && !str(o.headline)) return null
  return { at: str(o.at), scope: str(o.scope), score, scores: str(o.scores), verdicts, fixed: strs(o.fixed), kept: strs(o.kept), rounds: typeof o.rounds === 'number' && o.rounds >= 1 ? Math.min(3, Math.floor(o.rounds)) : 1, custom: o.custom === true, headline: str(o.headline) }
}

/** 화면 한 줄 — "악마판사 92점 · P0 0 · 고친 칸 2" */
export function judgeLine(r: JudgeReport | null | undefined): string {
  if (!r) return ''
  const p0 = r.verdicts.filter((v) => v.level === 'P0').length
  const ask = r.verdicts.filter((v) => v.level === '대표 확인').length
  return [`악마판사 ${r.score == null ? '점수 없음' : `${r.score}점`}`, `P0 ${p0}`, r.fixed.length ? `직접 고친 칸 ${r.fixed.length}` : '고친 칸 없음', ask ? `대표 확인 ${ask}` : ''].filter(Boolean).join(' · ')
}
