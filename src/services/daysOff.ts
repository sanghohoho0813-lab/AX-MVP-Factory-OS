/**
 * 쉬는 날 (D-139) — 공휴일 · 대체공휴일 · 명절 연휴 · 회사 휴무를 달력에 표시한다.
 *
 * 대표: "대체공휴일이나 명절 같은 날을 직접 표시하고 싶다 — 표시하면 달력에서 빨갛게." → 빗금은 과하다고 해서 일요일처럼 날짜 글자만 빨갛게.
 *
 *  - 한 날 한 줄. 모듈 기록(`moduleData`) 의 `calendar` 상자 · `days_off` 갈래 (로컬이면 이 브라우저, 클라우드면 module_data 표).
 *    업체와 상관없는 기록이라 clientId 는 ''.
 *  - 법정 공휴일은 **자동으로 깔지 않는다** — '올해 공휴일 넣기' 로 대표가 넣고, 넣은 뒤에는 보통 쉬는 날처럼 지우고 고친다.
 *    (정부가 임시공휴일을 새로 정하거나 달리 발표하면 그대로 고칠 수 있게. 음력 명절 날짜는 ★ 관보로 한 번 확인.)
 *  - 영업일 계산 · 전 영업일 찾기 — 마감이 쉬는 날이면 앞당겨 챙기라고 알린다.
 */
import { deleteRow, listRows, saveRow } from './moduleData'

export type DayOffKind = 'holiday' | 'substitute' | 'festive' | 'company' | 'personal'

export interface DayOff {
  id: string
  /** YYYY-MM-DD */
  date: string
  name: string
  kind: DayOffKind
}

export const DAY_OFF_KIND_LABEL: Record<DayOffKind, string> = {
  holiday: '공휴일',
  substitute: '대체공휴일',
  festive: '명절',
  company: '회사 휴무',
  personal: '개인 휴가',
}

/** 표시할 때 누르기만 하면 되는 이름들 */
export const DAY_OFF_PRESETS: { name: string; kind: DayOffKind }[] = [
  { name: '대체공휴일', kind: 'substitute' },
  { name: '설날 연휴', kind: 'festive' },
  { name: '추석 연휴', kind: 'festive' },
  { name: '임시공휴일', kind: 'holiday' },
  { name: '회사 휴무', kind: 'company' },
  { name: '여름휴가', kind: 'personal' },
]

/**
 * 법정 공휴일(대체공휴일 포함) — '올해 공휴일 넣기' 로만 들어간다.
 * 대체공휴일 규칙: 설 · 추석 연휴는 일요일과 겹칠 때, 국경일(3·1절 · 광복절 · 개천절 · 한글날) · 어린이날 · 부처님오신날 · 성탄절은
 * 토 · 일요일과 겹칠 때 다음 평일. 신정 · 현충일은 대체 없음. 선거일 · 임시공휴일은 발표 때 직접 넣는다.
 */
export const KR_PUBLIC_HOLIDAYS: Record<number, { date: string; name: string; kind: DayOffKind }[]> = {
  2026: [
    { date: '2026-01-01', name: '신정', kind: 'holiday' },
    { date: '2026-02-16', name: '설날 연휴', kind: 'festive' },
    { date: '2026-02-17', name: '설날', kind: 'festive' },
    { date: '2026-02-18', name: '설날 연휴', kind: 'festive' },
    { date: '2026-03-01', name: '삼일절', kind: 'holiday' },
    { date: '2026-03-02', name: '대체공휴일(삼일절)', kind: 'substitute' },
    { date: '2026-05-05', name: '어린이날', kind: 'holiday' },
    { date: '2026-05-24', name: '부처님오신날', kind: 'holiday' },
    { date: '2026-05-25', name: '대체공휴일(부처님오신날)', kind: 'substitute' },
    { date: '2026-06-03', name: '지방선거일', kind: 'holiday' },
    { date: '2026-06-06', name: '현충일', kind: 'holiday' },
    { date: '2026-08-15', name: '광복절', kind: 'holiday' },
    { date: '2026-08-17', name: '대체공휴일(광복절)', kind: 'substitute' },
    { date: '2026-09-24', name: '추석 연휴', kind: 'festive' },
    { date: '2026-09-25', name: '추석', kind: 'festive' },
    { date: '2026-09-26', name: '추석 연휴', kind: 'festive' },
    { date: '2026-10-03', name: '개천절', kind: 'holiday' },
    { date: '2026-10-05', name: '대체공휴일(개천절)', kind: 'substitute' },
    { date: '2026-10-09', name: '한글날', kind: 'holiday' },
    { date: '2026-12-25', name: '성탄절', kind: 'holiday' },
  ],
  2027: [
    { date: '2027-01-01', name: '신정', kind: 'holiday' },
    { date: '2027-02-05', name: '설날 연휴', kind: 'festive' },
    { date: '2027-02-06', name: '설날', kind: 'festive' },
    { date: '2027-02-07', name: '설날 연휴', kind: 'festive' },
    { date: '2027-02-08', name: '대체공휴일(설날)', kind: 'substitute' },
    { date: '2027-03-01', name: '삼일절', kind: 'holiday' },
    { date: '2027-05-05', name: '어린이날', kind: 'holiday' },
    { date: '2027-05-13', name: '부처님오신날', kind: 'holiday' },
    { date: '2027-06-06', name: '현충일', kind: 'holiday' },
    { date: '2027-08-15', name: '광복절', kind: 'holiday' },
    { date: '2027-08-16', name: '대체공휴일(광복절)', kind: 'substitute' },
    { date: '2027-09-14', name: '추석 연휴', kind: 'festive' },
    { date: '2027-09-15', name: '추석', kind: 'festive' },
    { date: '2027-09-16', name: '추석 연휴', kind: 'festive' },
    { date: '2027-10-03', name: '개천절', kind: 'holiday' },
    { date: '2027-10-04', name: '대체공휴일(개천절)', kind: 'substitute' },
    { date: '2027-10-09', name: '한글날', kind: 'holiday' },
    { date: '2027-10-11', name: '대체공휴일(한글날)', kind: 'substitute' },
    { date: '2027-12-25', name: '성탄절', kind: 'holiday' },
    { date: '2027-12-27', name: '대체공휴일(성탄절)', kind: 'substitute' },
  ],
}

const MODULE = 'calendar'
const BUCKET = 'days_off'
const KINDS: DayOffKind[] = ['holiday', 'substitute', 'festive', 'company', 'personal']
const ISO = /^\d{4}-\d{2}-\d{2}$/

function validDate(s: string): boolean {
  if (!ISO.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** 저장된 줄 → 쉬는 날. 모양이 틀리면 버린다(달력에 이상한 칸을 만들지 않게) */
export function toDayOff(row: { id: string; data: Record<string, unknown> }): DayOff | null {
  const date = typeof row.data.date === 'string' ? row.data.date : ''
  if (!validDate(date)) return null
  const name = typeof row.data.name === 'string' && row.data.name.trim() ? row.data.name.trim().slice(0, 30) : '쉬는 날'
  const kind = KINDS.includes(row.data.kind as DayOffKind) ? (row.data.kind as DayOffKind) : 'holiday'
  return { id: row.id, date, name, kind }
}

/** 날짜 → 그날의 쉬는 날(여럿이면 먼저 넣은 것부터) */
export function daysOffByDate(list: readonly DayOff[]): Map<string, DayOff[]> {
  const map = new Map<string, DayOff[]>()
  for (const d of list) map.set(d.date, [...(map.get(d.date) ?? []), d])
  return map
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** '10월 5일(월)' */
export function dateLabel(date: string): string {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일(${'일월화수목금토'[weekdayOf(date)]})`
}

/** 시작일부터 n 일 연속(연휴) — 최대 14일 */
export function rangeDates(start: string, days: number): string[] {
  if (!validDate(start)) return []
  const n = Math.max(1, Math.min(14, Math.floor(days) || 1))
  return Array.from({ length: n }, (_, i) => addDays(start, i))
}

/** 쉬는 날인가 — 주말은 따로(isWeekend) */
export function isWeekend(date: string): boolean {
  const w = weekdayOf(date)
  return w === 0 || w === 6
}

/** 이 달 영업일(주말 · 쉬는 날 뺀 날) 과 평일에 든 쉬는 날 수 */
export function monthWorkdays(year: number, month1to12: number, offDates: ReadonlySet<string>): { workdays: number; weekdayOffs: number; days: number } {
  const days = new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
  let workdays = 0
  let weekdayOffs = 0
  for (let d = 1; d <= days; d++) {
    const iso = `${year}-${String(month1to12).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (isWeekend(iso)) continue
    if (offDates.has(iso)) weekdayOffs++
    else workdays++
  }
  return { workdays, weekdayOffs, days }
}

/** 이 날이 주말이나 쉬는 날이면, 그 전 영업일 (최대 20일 거슬러 봄) */
export function prevWorkday(date: string, offDates: ReadonlySet<string>): string | null {
  if (!validDate(date)) return null
  let d = addDays(date, -1)
  for (let i = 0; i < 20; i++) {
    if (!isWeekend(d) && !offDates.has(d)) return d
    d = addDays(d, -1)
  }
  return null
}

/** 그 해 법정 공휴일 가운데 아직 안 넣은 것(같은 날에 이미 무엇이든 있으면 넣은 것으로 본다) */
export function missingPublicHolidays(year: number, existing: readonly DayOff[]): { date: string; name: string; kind: DayOffKind }[] {
  const have = new Set(existing.map((d) => d.date))
  return (KR_PUBLIC_HOLIDAYS[year] ?? []).filter((h) => !have.has(h.date))
}

/* ---------------- 저장 ---------------- */

export async function listDaysOff(workspaceId: string | null): Promise<DayOff[]> {
  const rows = await listRows(workspaceId, MODULE, BUCKET)
  const out = rows.map((r) => toDayOff(r)).filter((d): d is DayOff => d !== null)
  const list = out.sort((a, b) => a.date.localeCompare(b.date))
  rememberDaysOff(list)
  return list
}

/** 여러 날을 한 번에(연휴 · 공휴일 넣기). 같은 날 같은 이름은 다시 넣지 않는다 */
export async function addDaysOff(workspaceId: string | null, items: readonly { date: string; name: string; kind: DayOffKind }[], existing: readonly DayOff[]): Promise<number> {
  const have = new Set(existing.map((d) => `${d.date}|${d.name}`))
  let n = 0
  for (const it of items) {
    if (!validDate(it.date)) continue
    const name = it.name.trim().slice(0, 30) || '쉬는 날'
    if (have.has(`${it.date}|${name}`)) continue
    await saveRow(workspaceId, MODULE, BUCKET, { clientId: '', data: { date: it.date, name, kind: it.kind } })
    have.add(`${it.date}|${name}`)
    n++
  }
  return n
}

export async function removeDayOff(workspaceId: string | null, id: string): Promise<void> {
  await deleteRow(workspaceId, MODULE, BUCKET, id)
}

/* ---------------- 다른 화면(큰 달력)에서 읽는 사본 ---------------- */

const CACHE_KEY = 'axmvp.daysOff.cache'

/** 마지막으로 읽은 쉬는 날 — OS 의 모든 날짜 칸(큰 달력)이 빨간 글자로 그릴 때 쓴다. 날짜와 이름만 */
export function rememberDaysOff(list: readonly DayOff[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(CACHE_KEY, JSON.stringify(list.map((d) => [d.date, d.name])))
  } catch {
    /* 저장 공간이 차도 달력 표시만 빠진다 */
  }
}

export function cachedDaysOff(): Map<string, string> {
  try {
    if (typeof localStorage === 'undefined') return new Map()
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]') as unknown
    if (!Array.isArray(raw)) return new Map()
    const map = new Map<string, string>()
    for (const x of raw) if (Array.isArray(x) && typeof x[0] === 'string' && validDate(x[0])) map.set(x[0], typeof x[1] === 'string' ? x[1] : '쉬는 날')
    return map
  } catch {
    return new Map()
  }
}
