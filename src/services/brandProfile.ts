/**
 * SAAS-1 고객별 브랜드 · AI 설정 — 이 작업공간의 AI 가 누구의 말투 · 업종 · 사실로 쓰는가.
 *
 * 대표: "미래AI랩 대표 개인에게 맞춰진 콘텐츠 · AI 규칙을 고객별 독립 설정으로 분리. 고객마다 업종 · 전문분야 · 말투 ·
 * 브랜드 정보 · 벤치마킹 대상을 설정하고 일관되게 반영."
 *
 *  - 작업공간마다 한 줄(module_data 'brand' / 'profile') — 클라우드에서는 기기 사이 그대로, 다른 작업공간에서는 보이지 않는다(RLS).
 *  - AI 요청마다 서버로 같이 보낸다(callAssist). 서버는 대표가 아닌 계정에만 쓴다 — 대표 계정 AI 는 지금 규칙 그대로.
 *  - 칸 이름 · 최대 글자 수는 서버 api/_ai/brand.js BRAND_LIMITS 와 같다(단위 시험이 맞춘다).
 *  - '확인된 사실' 에 적은 숫자 · 경력만 AI 가 사실로 쓴다 — 적지 않은 실적은 만들지 않게 서버 규칙이 막는다.
 */
import { useSyncExternalStore } from 'react'
import { listRows, saveRow } from './moduleData'

export interface BrandProfile {
  name: string
  company: string
  industry: string
  specialties: string
  audience: string
  tone: string
  intro: string
  facts: string
  avoid: string
  ending: string
  benchmarks: string
}

export type BrandKey = keyof BrandProfile

export const BRAND_FIELDS: ReadonlyArray<{ key: BrandKey; label: string; placeholder: string; max: number; long?: boolean; core?: boolean }> = [
  { key: 'name', label: '부르는 이름', placeholder: '예: 박 컨설턴트 · 이 대표', max: 40, core: true },
  { key: 'company', label: '회사 · 브랜드', placeholder: '예: ○○경영컨설팅', max: 60, core: true },
  { key: 'industry', label: '업종 · 분야', placeholder: '예: 정책자금 컨설팅', max: 80, core: true },
  { key: 'specialties', label: '전문분야', placeholder: '예: 정책자금 · 고용지원금 · 기업부설연구소', max: 200, core: true },
  { key: 'audience', label: '주요 고객', placeholder: '예: 제조업 중소기업 대표(50~60대)', max: 200, core: true },
  { key: 'tone', label: '말투', placeholder: '예: 쉬운 말 · 과장 없이 · 상담실에서 말하듯', max: 200, core: true },
  { key: 'intro', label: '하는 일 · 강점', placeholder: '예: 서류 준비부터 신청 · 사후관리까지 한 번에', max: 300, long: true },
  { key: 'facts', label: '확인된 사실(경력 · 숫자)', placeholder: '예: 경력 7년 · 상담 120곳 — AI 는 여기 적은 숫자만 씁니다', max: 600, long: true },
  { key: 'avoid', label: '쓰지 않는 말 · 다루지 않는 것', placeholder: '예: 승인 보장 · 무조건 · 대출 알선', max: 300, long: true },
  { key: 'ending', label: '끝인사 · 바라는 행동', placeholder: '예: 궁금한 점은 상담 신청으로 남겨 주세요', max: 200 },
  { key: 'benchmarks', label: '참고하는 채널 · 계정', placeholder: '예: 유튜브 ○○○ · 블로그 ○○○ (줄마다 하나)', max: 400, long: true },
]

const MODULE = 'brand'
const BUCKET = 'profile'
const rowId = (workspaceId: string | null) => `brand_${workspaceId ?? 'local'}`

export function emptyBrand(): BrandProfile {
  return { name: '', company: '', industry: '', specialties: '', audience: '', tone: '', intro: '', facts: '', avoid: '', ending: '', benchmarks: '' }
}

/** 저장 · 서버로 보내기 전 — 칸마다 앞뒤 빈칸 · 최대 글자 수 */
export function normalizeBrand(raw: unknown): BrandProfile {
  const out = emptyBrand()
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  for (const f of BRAND_FIELDS) {
    const v = r[f.key]
    if (typeof v === 'string') out[f.key] = v.trim().slice(0, f.max)
  }
  return out
}

export function isBrandEmpty(b: BrandProfile | null | undefined): boolean {
  return !b || BRAND_FIELDS.every((f) => !b[f.key])
}

/** 핵심 칸(이름 · 회사 · 업종 · 전문분야 · 고객 · 말투) 중 채운 수 */
export function brandFilled(b: BrandProfile | null | undefined): { done: number; total: number } {
  const core = BRAND_FIELDS.filter((f) => f.core)
  return { done: b ? core.filter((f) => b[f.key]).length : 0, total: core.length }
}

/** 설정 화면 '이렇게 씁니다' 한 줄 — AI 를 부르지 않고 규칙으로(서버 첫 줄과 같은 모양) */
export function brandSummary(b: BrandProfile): string {
  const who = b.name ? `${b.name}${b.company ? `(${b.company})` : ''}` : b.company
  const field = [b.industry, b.specialties ? `전문 ${b.specialties}` : ''].filter(Boolean).join(' · ')
  const head = who ? `컨설턴트 ${who}의 업무 비서로` : field ? '컨설턴트의 업무 비서로' : '중소기업 · 정책자금 컨설턴트의 업무 비서로'
  return [head, field && `분야: ${field}`, b.tone && `말투: ${b.tone}`, b.audience && `고객: ${b.audience}`].filter(Boolean).join(' · ')
}

/* ---- 지금 작업공간의 설정(화면 여러 곳 · AI 요청이 같이 읽는다) ---- */

let current: { workspaceId: string | null; profile: BrandProfile; loaded: boolean } = { workspaceId: null, profile: emptyBrand(), loaded: false }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export async function loadBrand(workspaceId: string | null): Promise<BrandProfile> {
  const rows = await listRows(workspaceId, MODULE, BUCKET)
  const row = rows.find((r) => r.id === rowId(workspaceId)) ?? rows[0]
  const profile = normalizeBrand(row?.data)
  current = { workspaceId, profile, loaded: true }
  emit()
  return profile
}

export async function saveBrand(workspaceId: string | null, input: BrandProfile): Promise<BrandProfile> {
  const profile = normalizeBrand(input)
  await saveRow(workspaceId, MODULE, BUCKET, { id: rowId(workspaceId), data: { ...profile } })
  current = { workspaceId, profile, loaded: true }
  emit()
  return profile
}

export function useBrandProfile(): { workspaceId: string | null; profile: BrandProfile; loaded: boolean } {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
    () => current,
  )
}

/** AI 요청에 붙일 설정 — 비었거나 아직 못 읽었으면 없음(서버는 일반 컨설턴트로) */
export function brandForRequest(): BrandProfile | null {
  return current.loaded && !isBrandEmpty(current.profile) ? current.profile : null
}

/** 시험용 */
export function __setBrandForTest(workspaceId: string | null, profile: BrandProfile | null) {
  current = { workspaceId, profile: profile ?? emptyBrand(), loaded: !!profile }
  emit()
}
