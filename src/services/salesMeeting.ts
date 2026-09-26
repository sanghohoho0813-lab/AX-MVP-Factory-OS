/**
 * 미팅 준비 (D-114 2단계) — 고객 기록 ↔ 영업 규칙 엔진(salesEngine.js) 다리.
 *
 * 엔진은 원본 영업 도구의 고객 모양(매출 백만원 · 15단계 키 …)을 읽는다. 여기서 고객 관리 기록을 그 모양으로 바꿔 넘기고,
 * 미팅 기록 · 고객 정보 수정을 고객 기록에 되돌려 적는다. 순수 함수만 둔다(저장은 clientOpsService).
 */

import type { ClientOpsRecord, SalesMeetingNote, SalesStage } from '../types/clientOps'
import { emptySales } from '../types/clientOps'
import { withActivity } from './clientOpsActivity'
import { salesStageOf } from './salesPipeline'
import { allDocumentMetas } from './clientOpsDocuments'
import { withCustomDocument } from './clientOpsService'
import {
  analyzeTranscript,
  deriveInterests,
  parseMemo,
  type SalesEngineItem,
  type TranscriptAnalysis,
} from './salesEngine'

/** 새 8단계 → 원본 대표 단계 키 (원본 PIPE6 의 set 값) — 점수의 '진행 단계' 가중치가 이 키로 매겨진다 */
const LEGACY_KEY: Record<SalesStage, string> = {
  lead: 'lead',
  m1sched: 'meeting1_scheduled',
  m1done: 'meeting1_done',
  m2: 'meeting2_scheduled',
  closing: 'closing_scheduled',
  contracted: 'contracted',
  hold: 'hold',
  lost: 'lost',
}

/** 고객 관리의 업종 글 → 원본 업종 칸(엔진이 '제조업' · 'IT/소프트웨어' 로 판단한다) */
export function engineIndustry(text: string): string {
  const t = text.trim()
  if (t === '') return ''
  const pairs: [RegExp, string][] = [
    [/제조/, '제조업'],
    [/소프트|IT|정보|플랫폼|앱|SW/i, 'IT/소프트웨어'],
    [/도소매|유통|도매|소매|무역/, '도소매업'],
    [/건설|시공|인테리어/, '건설업'],
    [/병원|의원|치과|한의/, '병의원'],
    [/음식|식당|카페|숙박|요식/, '음식/숙박'],
    [/운송|물류|운수/, '운송업'],
    [/세무|회계|법무|노무|특허/, '전문직'],
    [/서비스|교육|컨설팅|광고|디자인/, '서비스업'],
  ]
  for (const [re, v] of pairs) if (re.test(t)) return v
  return t
}

function yearsSince(date: string, today: Date): number | null {
  const m = /^(\d{4})-?(\d{2})?/.exec(date.replace(/[.\s/]/g, '-'))
  if (!m) return null
  const y = Number(m[1])
  if (!Number.isFinite(y) || y < 1900) return null
  return Math.max(0, today.getFullYear() - y)
}

/** 고객 기록 → 엔진이 읽는 한 줄 */
export function toEngineItem(record: ClientOpsRecord, today: Date = new Date()): SalesEngineItem {
  const s = record.sales
  const emp = parseInt(String(record.employeeCount ?? '').replace(/[^0-9]/g, ''), 10)
  return {
    name: record.companyName,
    industry: engineIndustry(record.businessCategory || record.industry || ''),
    revenue: s?.revenueM ?? undefined,
    empCount: Number.isFinite(emp) ? emp : undefined,
    estYears: yearsSince(record.establishedAt, today) ?? undefined,
    ceoAge: s?.ceoAge ?? undefined,
    interests: deriveInterests({ interests: s?.interests ?? [], flags: s?.flags ?? {} }),
    concern: s?.concern ?? '',
    memo: s?.memo ?? '',
    source: s?.source ?? '',
    stage: LEGACY_KEY[salesStageOf(record)],
    nextDate: record.nextActionDueDate || '',
    flags: s?.flags ?? {},
  }
}

/** 지금 단계에 맞는 미팅 차수 — 잠재 · 1차 예정 → 1차, 1차 완료 · 2차 → 2차, 클로징 이후 → 3차 */
export function roundForStage(stage: SalesStage): 1 | 2 | 3 {
  if (stage === 'lead' || stage === 'm1sched') return 1
  if (stage === 'm1done' || stage === 'm2') return 2
  return 3
}

/** 미팅을 기록하면 옮겨 갈 단계 — 1차 기록 → 1차 미팅 완료, 2차 → 2차 미팅, 3차 → 3차 클로징 */
export function stageAfterMeeting(round: 1 | 2 | 3): SalesStage {
  return round === 1 ? 'm1done' : round === 2 ? 'm2' : 'closing'
}

export interface SalesProfilePatch {
  ceoAge?: number | null
  revenueM?: number | null
  flags?: Record<string, boolean>
  memo?: string
}

/** 대표 나이 · 매출 · 체크 17 · 메모 고치기 — 바뀐 것만 활동 기록 한 줄 */
export function withSalesProfile(record: ClientOpsRecord, patch: SalesProfilePatch, at: string = new Date().toISOString()): ClientOpsRecord {
  const base = record.sales ?? emptySales(salesStageOf(record), at)
  const next = { ...base }
  const changed: string[] = []
  if (patch.ceoAge !== undefined && (patch.ceoAge ?? null) !== (base.ceoAge ?? null)) {
    next.ceoAge = patch.ceoAge
    changed.push('대표 나이')
  }
  if (patch.revenueM !== undefined && (patch.revenueM ?? null) !== (base.revenueM ?? null)) {
    next.revenueM = patch.revenueM
    changed.push('매출')
  }
  if (patch.flags !== undefined) {
    const on = Object.fromEntries(Object.entries(patch.flags).filter(([, v]) => v).map(([k]) => [k, true]))
    const key = (f: Record<string, boolean> | undefined) => Object.keys(f ?? {}).filter((k) => f?.[k]).sort().join('|')
    if (key(on) !== key(base.flags)) {
      next.flags = on
      changed.push('고객 체크')
    }
  }
  if (patch.memo !== undefined && patch.memo !== (base.memo ?? '')) {
    next.memo = patch.memo
    changed.push('상담 메모')
  }
  if (changed.length === 0) return record.sales ? record : { ...record, sales: next }
  return withActivity({ ...record, sales: next }, 'sales', `영업 고객 정보 수정 — ${changed.join(' · ')}`, null, at)
}

/**
 * 메모 글 → 칸 채우기 (원본 parseMemo). 비어 있는 칸만 채우고 체크는 더한다 — 사람이 적은 값을 덮지 않는다.
 * 돌려주는 것: 채울 값 + 무엇을 채웠는지 이름.
 */
export function profileFromMemo(record: ClientOpsRecord, memo: string): { patch: SalesProfilePatch; filled: string[] } {
  const p = parseMemo(memo)
  const s = record.sales
  const patch: SalesProfilePatch = {}
  const filled: string[] = []
  if (p.ceoAge && !s?.ceoAge) {
    patch.ceoAge = p.ceoAge
    filled.push(`대표 ${p.ceoAge}세`)
  }
  if (p.revenue && !s?.revenueM) {
    patch.revenueM = p.revenue
    filled.push(`매출 ${Math.round(p.revenue / 100)}억`)
  }
  const newFlags = Object.entries(p.flags).filter(([k, v]) => v === true && !s?.flags?.[k]).map(([k]) => k)
  if (newFlags.length > 0) {
    patch.flags = { ...(s?.flags ?? {}), ...Object.fromEntries(newFlags.map((k) => [k, true])) }
    filled.push(`체크 ${newFlags.length}개`)
  }
  return { patch, filled }
}

function noteId(): string {
  return `mtg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export interface MeetingRecordOptions {
  round: 1 | 2 | 3
  text: string
  analysis: TranscriptAnalysis
  /** 다음 할 일 · 날짜 — 비우면 그대로 둔다 */
  nextAction?: string
  nextActionDueDate?: string
  /** D-124: 1차 미팅에서 확인한 관심사 — 주면 이것으로 바꾼다(주지 않으면 나온 주제를 더하기만) */
  interests?: string[]
}

/** 미팅 기록을 남긴다 — 영업 칸 미팅 목록 · 활동 기록 · (고르면) 다음 할 일 */
export function withMeetingNote(record: ClientOpsRecord, opts: MeetingRecordOptions, at: string = new Date().toISOString()): ClientOpsRecord {
  const base = record.sales ?? emptySales(salesStageOf(record), at)
  const note: SalesMeetingNote = {
    id: noteId(),
    at,
    round: opts.round,
    text: opts.text.trim(),
    reaction: opts.analysis.reaction,
    issues: opts.analysis.issues,
    hesitant: opts.analysis.hesitant,
    nextDocs: opts.analysis.nextDocs,
  }
  // D-122: 미팅에서 나온 주제를 영업 관심사에 더한다(빼지는 않는다) — 작업실 도구 · 상품 추천 · 주제별 연락이
  // 관심사를 읽는데, 예전에는 미팅 뒤에도 그대로라 미팅에서 나온 말이 아무 데도 이어지지 않았다.
  const confirmed = opts.interests ? [...new Set(opts.interests.map((i) => i.trim()).filter(Boolean))] : null
  const learned = confirmed ? confirmed.filter((i) => !base.interests.includes(i)) : interestsFromIssues(note.issues).filter((i) => !base.interests.includes(i))
  let next: ClientOpsRecord = { ...record, sales: { ...base, interests: confirmed ?? [...base.interests, ...learned], meetings: [note, ...(base.meetings ?? [])].slice(0, 30) } }
  if (opts.nextAction !== undefined && opts.nextAction.trim() !== '') {
    next = { ...next, nextAction: opts.nextAction.trim(), nextActionDueDate: opts.nextActionDueDate ?? next.nextActionDueDate }
  }
  const topics = note.issues.slice(0, 3).join(' · ')
  return withActivity(next, 'sales', `${opts.round}차 미팅 기록 — ${note.reaction}${topics ? ` · ${topics}` : ''}${confirmed ? ` · 관심사 확인: ${confirmed.join(' · ') || '없음'}` : learned.length ? ` · 관심사 더함: ${learned.join(' · ')}` : ''}`, null, at)
}

/** 미팅 주제(원본 규칙 이름) → 영업 관심사 (D-122) */
const ISSUE_TO_INTEREST: Record<string, string[]> = {
  가지급금: ['가지급금'],
  미처분이익잉여금: ['미처분이익잉여금'],
  가업승계: ['가업승계'],
  정관정비: ['정관정비'],
  임원퇴직금: ['임원퇴직금'],
  '연구소/세액공제': ['연구소'],
  '벤처/인증': ['벤처인증'],
  정책자금: ['정책자금'],
  고용지원금: ['고용지원금'],
  법인보험: ['법인보험'],
}

export function interestsFromIssues(issues: string[]): string[] {
  const out: string[] = []
  for (const i of issues) for (const x of ISSUE_TO_INTEREST[i] ?? []) if (!out.includes(x)) out.push(x)
  return out
}

export { analyzeTranscript }

/* ------------------------------------------------------------------ */
/* D-122 미팅에서 받기로 한 자료 → 서류함 칸                               */
/* ------------------------------------------------------------------ */

const coreOf = (label: string) => label.replace(/\(.*?\)/g, '').replace(/[\s·]/g, '')

/**
 * 미팅에서 받기로 한 자료 가운데 서류함에 아직 칸이 없는 것 — 표준 칸 이름 · 직접 만든 칸 이름과 비교한다
 * ('재무제표(최근 3개년)' 은 표준 '최근 3개년 재무제표' 로 본다). 예전에는 자료 요청 카톡으로만 남아
 * 받았는지 챙길 곳이 없었다.
 */
export function missingDocSlots(record: ClientOpsRecord, docs: string[]): string[] {
  const have = [...allDocumentMetas(record).map((m) => m.label)].map(coreOf)
  return [...new Set(docs.map((d) => d.trim()).filter(Boolean))].filter((d) => {
    const c = coreOf(d)
    if (c === '') return false
    return !have.some((h) => h.includes(c) || c.includes(h) || (c.includes('재무제표') && h.includes('재무제표')))
  })
}

/** 고른 자료마다 서류함에 칸을 만든다(있으면 건너뛴다) */
export function withDocSlots(record: ClientOpsRecord, docs: string[]): ClientOpsRecord {
  let next = record
  for (const d of missingDocSlots(record, docs)) next = withCustomDocument(next, { label: d })
  return next
}
