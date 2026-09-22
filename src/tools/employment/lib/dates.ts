/**
 * 날짜·나이 계산 — 원본(SubsidyApp.jsx 31~46 줄)의 순수 함수를 그대로 옮겼다.
 *
 * getDday 는 원본처럼 "오늘" 을 안에서 잡는다. 시험·회차 일정처럼 기준일을 고정해야 할 때는
 * getDdayFrom(ds, today) 를 쓴다 — 계산식은 같다.
 */

export function fD(ds: string | null | undefined): string {
  if (!ds) return ''
  const d = new Date(ds)
  return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate()
}

export function fDFull(ds: string | null | undefined): string {
  if (!ds) return ''
  const d = new Date(ds)
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'
}

/** ds 에서 m 개월 뒤 (YYYY-MM-DD). 원본과 같이 setMonth 뒤 toISOString 을 쓴다. */
export function addMo(ds: string | null | undefined, m: number): string {
  if (!ds) return ''
  const d = new Date(ds)
  d.setMonth(d.getMonth() + m)
  return d.toISOString().split('T')[0]
}

export function getDdayFrom(ds: string | null | undefined, todayDate: Date): number | null {
  if (!ds) return null
  const today = new Date(todayDate)
  today.setHours(0, 0, 0, 0)
  const target = new Date(ds)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function getDday(ds: string | null | undefined): number | null {
  return getDdayFrom(ds, new Date())
}

export function formatDday(d: number | null): string {
  if (d === null) return ''
  if (d === 0) return 'D-Day'
  if (d < 0) return 'D+' + Math.abs(d)
  return 'D-' + d
}

export function isFuture(ds: string | null | undefined): boolean {
  if (!ds) return true
  return new Date(ds) > new Date()
}

export interface AgeDetail {
  years: number
  months: number
  totalMonths: number
}

export function calcAgeDetailed(b: string | null | undefined, r?: string | Date | null): AgeDetail | null {
  if (!b) return null
  const bd = new Date(b)
  const rd = r ? new Date(r) : new Date()
  let years = rd.getFullYear() - bd.getFullYear()
  let months = rd.getMonth() - bd.getMonth()
  if (rd.getDate() < bd.getDate()) months--
  if (months < 0) {
    years--
    months += 12
  }
  return { years: years, months: months, totalMonths: years * 12 + months }
}

export function cAge(b: string | null | undefined, r?: string | Date | null): number | null {
  const d = calcAgeDetailed(b, r)
  return d ? d.years : null
}

export interface MilitaryLimit {
  maxTotalMonths: number
  maxYears: number
  maxRemainMonths: number
  isBorderline: boolean
}

/** 군복무 개월만큼 청년 상한(만 34세)을 늘리되 만 39세를 넘지 않는다. */
export function calcMilitaryLimit(milMonths: number | null | undefined): MilitaryLimit {
  const base = 34 * 12
  const ext = base + (milMonths || 0)
  const capped = Math.min(ext, 39 * 12)
  return {
    maxTotalMonths: capped,
    maxYears: Math.floor(capped / 12),
    maxRemainMonths: capped % 12,
    isBorderline: (milMonths || 0) > 0 && capped > 34 * 12,
  }
}

export interface JuminParsed {
  birthDate: string
  gender: 'male' | 'female'
  year: number
}

/** 주민번호 앞 7자리 → 생년월일·성별만. 원본 숫자는 돌려주지 않는다. */
export function parseJumin(jumin: string | null | undefined): JuminParsed | null {
  if (!jumin || jumin.length < 7) return null
  const clean = jumin.replace(/[^0-9]/g, '')
  if (clean.length < 7) return null
  const yy = parseInt(clean.substring(0, 2))
  const mm = parseInt(clean.substring(2, 4))
  const dd = parseInt(clean.substring(4, 6))
  const gc2 = parseInt(clean.substring(6, 7))
  let century = 1900
  let gender: 'male' | 'female' = 'male'
  if (gc2 === 1 || gc2 === 2) {
    century = 1900
  } else if (gc2 === 3 || gc2 === 4) {
    century = 2000
  } else if (gc2 === 9 || gc2 === 0) {
    century = 1800
  }
  if (gc2 % 2 === 0) {
    gender = 'female'
  }
  const year = century + yy
  const bd = year + '-' + (mm < 10 ? '0' + mm : mm) + '-' + (dd < 10 ? '0' + dd : dd)
  return { birthDate: bd, gender: gender, year: year }
}
