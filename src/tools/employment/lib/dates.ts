/**
 * 날짜·나이 계산 — 원본(SubsidyApp.jsx 31~46 줄)의 순수 함수를 옮겼다.
 *
 * getDday 는 원본처럼 "오늘" 을 안에서 잡는다. 시험·회차 일정처럼 기준일을 고정해야 할 때는
 * getDdayFrom(ds, today) 를 쓴다 — 계산식은 같다.
 *
 * D-136: 날짜 글자를 `new Date(글자)` 로 읽지 않는다. '2026-01-15' 는 UTC 로, '2026.1.15' 는 현지 시각으로 읽혀
 * 한국(KST)·미국 시간대에서 회차가 하루 앞당겨지는 일이 있었다. 이제 글자에서 연·월·일 숫자를 직접 꺼내
 * 달력 날짜로만 계산한다. 잘못된 날짜(2026-02-31 · 'abc')는 던지지 않고 '' / null 을 돌려준다.
 * 이 파일은 원본 화면(orig/SubsidyApp.jsx)도 그대로 가져다 쓴다 — 계산은 한 곳에만 있다.
 */

export interface YMD {
  y: number
  m: number
  d: number
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

function validYMD(y: number, m: number, d: number): YMD | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null
  if (y < 1800 || y > 2200 || m < 1 || m > 12 || d < 1) return null
  if (d > daysInMonth(y, m)) return null
  return { y, m, d }
}

/**
 * 날짜 → 달력 날짜(연·월·일). 받는 모양: 2026-01-15 · 2026-1-5 · 2026.1.15 · 2026/1/15 · 2026년 1월 15일 · 20260115 ·
 * 시각이 붙은 ISO(2026-01-15T09:00:00Z — 이때만 현지 날짜로) · Date. 잘못된 날짜는 null.
 */
export function parseYMD(v: unknown): YMD | null {
  if (v == null || v === '') return null
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() }
  }
  const s = String(v).trim()
  if (!s) return null
  // 시각이 붙은 값(저장 시각 등)은 그 순간의 현지 날짜
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const t = new Date(s)
    if (Number.isNaN(t.getTime())) return null
    return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }
  }
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compact) return validYMD(Number(compact[1]), Number(compact[2]), Number(compact[3]))
  const m = s.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*[.일]?$/)
  if (!m) return null
  return validYMD(Number(m[1]), Number(m[2]), Number(m[3]))
}

const pad2 = (n: number) => (n < 10 ? '0' + n : String(n))

export function ymdString(p: YMD): string {
  return p.y + '-' + pad2(p.m) + '-' + pad2(p.d)
}

/** 날짜 → 'YYYY-MM-DD'. 잘못된 날짜는 '' */
export function toYMD(v: unknown): string {
  const p = parseYMD(v)
  return p ? ymdString(p) : ''
}

/** 현지 자정 Date (잘못된 날짜는 null) */
export function localDate(v: unknown): Date | null {
  const p = parseYMD(v)
  return p ? new Date(p.y, p.m - 1, p.d) : null
}

function dayNumber(p: YMD): number {
  return Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86400000)
}

export function fD(ds: string | null | undefined): string {
  const p = parseYMD(ds)
  return p ? p.y + '.' + p.m + '.' + p.d : ''
}

export function fDFull(ds: string | null | undefined): string {
  const p = parseYMD(ds)
  return p ? p.y + '년 ' + p.m + '월 ' + p.d + '일' : ''
}

/**
 * ds 에서 m 개월 뒤 (YYYY-MM-DD). 그 달에 같은 날이 없으면 그 달 말일(민법 160조 — 1월 31일 + 1개월 = 2월 28·29일).
 * 날짜가 잘못됐으면 ''.
 */
export function addMo(ds: string | null | undefined, m: number): string {
  const p = parseYMD(ds)
  const k = Number(m)
  if (!p || !Number.isFinite(k)) return ''
  const total = p.y * 12 + (p.m - 1) + Math.trunc(k)
  const y = Math.floor(total / 12)
  const mo = total - y * 12 + 1
  const d = Math.min(p.d, daysInMonth(y, mo))
  const out = validYMD(y, mo, d)
  return out ? ymdString(out) : ''
}

export function getDdayFrom(ds: string | null | undefined, todayDate: Date): number | null {
  const target = parseYMD(ds)
  const today = parseYMD(todayDate)
  if (!target || !today) return null
  return dayNumber(target) - dayNumber(today)
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
  const t = localDate(ds)
  return t ? t.getTime() > Date.now() : false
}

export interface AgeDetail {
  years: number
  months: number
  totalMonths: number
}

/** 만 나이(년·개월). 기준일 r 이 없으면 오늘. 날짜가 잘못됐으면 null */
export function calcAgeDetailed(b: string | null | undefined, r?: string | Date | null): AgeDetail | null {
  const bd = parseYMD(b)
  const rd = parseYMD(r ? r : new Date())
  if (!bd || !rd) return null
  let years = rd.y - bd.y
  let months = rd.m - bd.m
  if (rd.d < bd.d) months--
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

/* ── 청년 나이 (D-136) ─────────────────────────────────────────────
 * 청년 = 채용일 현재 만 15세 이상 34세 이하 (35번째 생일 전날까지).
 * 병역을 마친 사람은 복무 기간(입력 상한 6년)을 나이에서 빼고 따지되, 공고 문구대로 최대 만 39세 이하(40번째 생일 전날까지).
 * ★ 6년 가산과 39세 상한이 겹치면(복무 5년 넘음) 39세 상한을 따른다 — 보수적으로. 관할기관 확인.
 * 이전 계산은 '만 34세 0개월' 을 상한으로 잡아 34세 1개월~11개월을 떨어뜨렸다.
 */
export const YOUTH_MIN_AGE = 15
export const YOUTH_MAX_AGE = 34
/** 병역 가산을 해도 넘을 수 없는 나이 (만 39세 이하) */
export const YOUTH_MAX_AGE_WITH_SERVICE = 39
/** 병역 가산 상한 (개월) — 6년 */
export const MIL_EXT_MAX_MONTHS = 72

export interface MilitaryLimit {
  /** 이 개월 수(만 나이 총개월)까지 청년 — 이하면 통과 */
  maxTotalMonths: number
  /** 표시용: 34세 + 복무 개월 */
  maxYears: number
  maxRemainMonths: number
  /** 실제로 더해 준 복무 개월 (0~72) */
  extMonths: number
  isBorderline: boolean
}

export function milExtMonths(milMonths: number | null | undefined): number {
  const n = Number(milMonths)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(Math.floor(n), MIL_EXT_MAX_MONTHS)
}

/** 군복무 개월만큼 청년 상한을 늘린다(최대 6년 → 만 39세 이하). 통과 조건: 만 나이 총개월 ≤ maxTotalMonths */
export function calcMilitaryLimit(milMonths: number | null | undefined): MilitaryLimit {
  const ext = milExtMonths(milMonths)
  const nominal = Math.min(YOUTH_MAX_AGE * 12 + ext, YOUTH_MAX_AGE_WITH_SERVICE * 12)
  return {
    maxTotalMonths: Math.min((YOUTH_MAX_AGE + 1) * 12 - 1 + ext, (YOUTH_MAX_AGE_WITH_SERVICE + 1) * 12 - 1),
    maxYears: Math.floor(nominal / 12),
    maxRemainMonths: nominal % 12,
    extMonths: ext,
    isBorderline: ext > 0,
  }
}

/** 상한 표시 — '만34세' 또는 '만34세(+복무 18개월)' */
export function youthLimitLabel(milMonths: number | null | undefined): string {
  const ext = milExtMonths(milMonths)
  return ext > 0 ? '만34세(+복무 ' + ext + '개월 · 최대 39세)' : '만34세'
}

export interface YouthAge {
  /** 생년월일·기준일이 제대로 있는지 */
  known: boolean
  /** 기준일 만 나이 */
  age: number | null
  totalMonths: number | null
  /** 복무 기간을 빼고 계산한 만 나이 */
  adjustedAge: number | null
  ok: boolean
  /** 복무 가산 덕분에만 통과 (관할기관 확인 권장) */
  byService: boolean
}

/**
 * 청년 나이 판정 — 채용 진단·자격요건(EligChk)·명부 진단이 모두 이 함수 하나를 쓴다.
 * refDate 는 입사(채용)일. 없으면 오늘.
 */
export function youthAgeAt(birthDate: string | null | undefined, refDate: string | Date | null | undefined, milMonths?: number | null): YouthAge {
  const ref = parseYMD(refDate ? refDate : new Date())
  const age = ref ? calcAgeDetailed(birthDate, ymdString(ref)) : null
  if (!age || !ref) return { known: false, age: null, totalMonths: null, adjustedAge: null, ok: false, byService: false }
  const ext = milExtMonths(milMonths)
  const adj = calcAgeDetailed(birthDate, addMo(ymdString(ref), -ext))
  const adjustedAge = adj ? adj.years : age.years
  const ok = age.years >= YOUTH_MIN_AGE && adjustedAge <= YOUTH_MAX_AGE && age.years <= YOUTH_MAX_AGE_WITH_SERVICE
  return { known: true, age: age.years, totalMonths: age.totalMonths, adjustedAge, ok, byService: ok && age.years > YOUTH_MAX_AGE }
}

export type YearsVerdict = 'ok' | 'fail' | 'border'

/**
 * 나이를 '만 N세' 로만 알 때(채용 진단 입력) — 개월을 몰라서 경계일 수 있다.
 * N세 0개월~11개월 전부 통과면 ok, 전부 탈락이면 fail, 갈리면 border(★ 생년월일로 확인).
 */
export function youthByYears(ageYears: number | null | undefined, milMonths?: number | null): YearsVerdict | null {
  if (ageYears == null || !Number.isFinite(ageYears)) return null
  if (ageYears < YOUTH_MIN_AGE || ageYears > YOUTH_MAX_AGE_WITH_SERVICE) return 'fail'
  const ext = milExtMonths(milMonths)
  const limit = (YOUTH_MAX_AGE + 1) * 12 // 복무를 뺀 총개월이 이보다 작아야 한다
  const lo = ageYears * 12 - ext
  const hi = ageYears * 12 + 11 - ext
  if (hi < limit) return 'ok'
  if (lo >= limit) return 'fail'
  return 'border'
}

export interface JuminParsed {
  birthDate: string
  gender: 'male' | 'female'
  year: number
}

/** 주민번호 앞 7자리 → 생년월일·성별만. 원본 숫자는 돌려주지 않는다. 날짜가 말이 안 되면 null */
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
  if (gc2 === 1 || gc2 === 2 || gc2 === 5 || gc2 === 6) {
    century = 1900
  } else if (gc2 === 3 || gc2 === 4 || gc2 === 7 || gc2 === 8) {
    century = 2000
  } else if (gc2 === 9 || gc2 === 0) {
    century = 1800
  }
  if (gc2 % 2 === 0) {
    gender = 'female'
  }
  const year = century + yy
  const ok = validYMD(year, mm, dd)
  if (!ok) return null
  return { birthDate: ymdString(ok), gender: gender, year: year }
}
