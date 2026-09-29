import type { FormData, Lineage, StartupForm } from '../types'
import { daysBetween, parseLocalDate, toLocalDay } from './date'

// ---------------------------------------------------------------------------
// 창업일 승계 (lineage)
//
// 법인전환·사업양수 등은 "새로운 창업"으로 보지 않는다.
// 그렇다고 창업기업 지위가 사라지는 것이 아니라, 창업일이 기존 사업의
// 최초 개시일로 승계(소급)되어 업력·감면 잔여기간을 그 날짜 기준으로 본다.
//
// - 창업지원법: 창업기업 업력 7년 이내 (승계된 창업일 기준, 달력 날짜로 센다)
// - 조특법: 창업중소기업 세액감면 5개 과세연도 (D-136: 날짜가 아니라 과세연도로 센다)
//   법은 "최초로 소득이 난 과세연도 + 4년" 이지만, 소득이 난 해를 모르므로
//   보수적으로 "창업한 해 + 4년" 까지로 본다. 과세연도는 달력 연도(1~12월)로 본다.
// ---------------------------------------------------------------------------

// 창업일이 승계되는 유형
const INHERITED_FORMS: StartupForm[] = ['conversion', 'acquisition', 'succession']

export const STARTUP_LAW_YEARS = 7 // 창업기업 업력 한도
export const TAX_LAW_YEARS = 5 // 창업중소기업 세액감면 기간 (과세연도 수)

/** 시작일부터 기준일까지 달력 기준 업력(년, 소수). 시작일이 기준일보다 뒤면 null */
export function calendarYearsBetween(from: string, to: Date): number | null {
  const start = parseLocalDate(from)
  if (!start) return null
  const base = toLocalDay(to)
  if (start.getTime() > base.getTime()) return null
  let full = base.getFullYear() - start.getFullYear()
  const anniv = (n: number) => new Date(start.getFullYear() + n, start.getMonth(), start.getDate())
  if (anniv(full).getTime() > base.getTime()) full -= 1
  const span = daysBetween(anniv(full), anniv(full + 1))
  const part = span > 0 ? daysBetween(anniv(full), base) / span : 0
  return full + part
}

/** 창업한 해 기준 감면 마지막 과세연도 (보수적: 창업연도 + 4) */
export function taxLastYearOf(startDate: string): number | null {
  const start = parseLocalDate(startDate)
  return start ? start.getFullYear() + TAX_LAW_YEARS - 1 : null
}

export function buildLineage(form: FormData, baseDate: Date = new Date()): Lineage {
  const original = form.advanced.originalStartDate
  const inherited = INHERITED_FORMS.includes(form.startupForm as StartupForm)

  // 승계형인데 기존 개시일을 모르면 판단 보류 (잘못된 날짜도 모르는 것으로 본다)
  const originalOk = parseLocalDate(original) !== null
  const needsOriginalDate = inherited && !originalOk

  // 실질 창업일: 승계형이고 기존 개시일이 있으면 그 날짜, 아니면 입력한 창업일
  const effectiveStartDate = inherited && originalOk ? original : form.startupDate

  let effectiveStartLabel: string
  if (inherited && originalOk) {
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
    needsOriginalDate || !effectiveStartDate ? null : calendarYearsBetween(effectiveStartDate, baseDate)

  const within7Years =
    businessAgeYears === null ? null : businessAgeYears <= STARTUP_LAW_YEARS

  // 감면 과세연도: 올해 포함 남은 과세연도 수 (정수) — "약 0년 남음" 같은 글이 나오지 않는다
  const taxLastYear = businessAgeYears === null ? null : taxLastYearOf(effectiveStartDate)
  const taxRemainingYears =
    taxLastYear === null ? null : Math.max(0, taxLastYear - baseDate.getFullYear() + 1)
  const hasTaxRemaining = taxRemainingYears === null ? null : taxRemainingYears > 0

  return {
    inherited,
    effectiveStartDate: effectiveStartDate || '',
    effectiveStartLabel,
    businessAgeYears,
    within7Years,
    taxLastYear,
    taxRemainingYears,
    hasTaxRemaining,
    needsOriginalDate,
  }
}

// 표시용: 업력 문자열
export function formatAge(years: number | null): string {
  if (years === null) return '-'
  const y = Math.floor(years)
  const m = Math.floor((years - y) * 12 + 1e-9)
  if (m === 0) return `${y}년`
  return `${y}년 ${m}개월`
}

// 표시용: 남은 감면 과세연도
export function formatTaxRemaining(lineage: Pick<Lineage, 'taxLastYear' | 'taxRemainingYears'>): string {
  const { taxLastYear, taxRemainingYears } = lineage
  if (taxLastYear === null || taxRemainingYears === null) return '-'
  if (taxRemainingYears <= 0) return `${taxLastYear}년 과세연도로 끝남`
  if (taxRemainingYears === 1) return `올해(${taxLastYear}년)가 마지막 과세연도`
  return `${taxLastYear}년 과세연도까지 (올해 포함 ${taxRemainingYears}개)`
}
