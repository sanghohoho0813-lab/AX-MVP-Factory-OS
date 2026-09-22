import type { FormData, Lineage, StartupForm } from '../types'

// ---------------------------------------------------------------------------
// 창업일 승계 (lineage)
//
// 법인전환·사업양수 등은 "새로운 창업"으로 보지 않는다.
// 그렇다고 창업기업 지위가 사라지는 것이 아니라, 창업일이 기존 사업의
// 최초 개시일로 승계(소급)되어 업력·감면 잔여기간을 그 날짜 기준으로 본다.
//
// - 창업지원법: 창업기업 업력 7년 이내 (승계된 창업일 기준)
// - 조특법: 창업중소기업 세액감면 5년 (승계된 창업일 기준 잔여기간)
// ---------------------------------------------------------------------------

// 창업일이 승계되는 유형
const INHERITED_FORMS: StartupForm[] = ['conversion', 'acquisition', 'succession']

export const STARTUP_LAW_YEARS = 7 // 창업기업 업력 한도
export const TAX_LAW_YEARS = 5 // 창업중소기업 세액감면 기간

function diffYears(from: string, to: Date): number | null {
  if (!from) return null
  const d = new Date(from)
  if (Number.isNaN(d.getTime())) return null
  const ms = to.getTime() - d.getTime()
  if (ms < 0) return null
  return ms / (1000 * 60 * 60 * 24 * 365.25)
}

export function buildLineage(form: FormData, baseDate: Date = new Date()): Lineage {
  const original = form.advanced.originalStartDate
  const inherited = INHERITED_FORMS.includes(form.startupForm as StartupForm)

  // 승계형인데 기존 개시일을 모르면 판단 보류
  const needsOriginalDate = inherited && !original

  // 실질 창업일: 승계형이고 기존 개시일이 있으면 그 날짜, 아니면 입력한 창업일
  const effectiveStartDate = inherited && original ? original : form.startupDate

  let effectiveStartLabel: string
  if (inherited && original) {
    effectiveStartLabel =
      '법인전환·양수·승계 유형으로 창업일이 기존 사업 최초 개시일로 승계됩니다. 업력과 감면 잔여기간은 그 날짜를 기준으로 판단합니다.'
  } else if (inherited) {
    effectiveStartLabel =
      '창업일이 기존 사업 최초 개시일로 승계되는 유형입니다. 기존 개인사업 최초 개시일을 입력하면 업력·감면 잔여기간을 계산할 수 있습니다.'
  } else {
    effectiveStartLabel = '신규 창업으로 입력한 창업일을 기준으로 판단합니다.'
  }

  // 승계형인데 기존 개시일을 모르면 업력을 단정할 수 없다.
  // (법인 설립일로 계산하면 실제 창업일보다 짧게 나와 잘못된 판단이 된다)
  const businessAgeYears =
    needsOriginalDate || !effectiveStartDate ? null : diffYears(effectiveStartDate, baseDate)

  const within7Years =
    businessAgeYears === null ? null : businessAgeYears <= STARTUP_LAW_YEARS

  const taxRemainingYears =
    businessAgeYears === null ? null : Math.max(0, TAX_LAW_YEARS - businessAgeYears)
  const hasTaxRemaining = taxRemainingYears === null ? null : taxRemainingYears > 0

  return {
    inherited,
    effectiveStartDate: effectiveStartDate || '',
    effectiveStartLabel,
    businessAgeYears,
    within7Years,
    taxRemainingYears,
    hasTaxRemaining,
    needsOriginalDate,
  }
}

// 표시용: 업력 문자열
export function formatAge(years: number | null): string {
  if (years === null) return '-'
  const y = Math.floor(years)
  const m = Math.round((years - y) * 12)
  if (m === 0) return `${y}년`
  if (m === 12) return `${y + 1}년`
  return `${y}년 ${m}개월`
}
