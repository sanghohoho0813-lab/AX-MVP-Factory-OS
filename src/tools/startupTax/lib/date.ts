// 날짜 관련 순수 유틸
//
// D-136: 'YYYY-MM-DD' 는 반드시 그 나라 달력 날짜(로컬)로 읽는다.
// new Date('YYYY-MM-DD') 는 UTC 자정으로 읽혀서 서쪽 시간대에서는 하루 앞 날짜가 된다.

/** 'YYYY-MM-DD' → 로컬 자정 Date. 형식이 틀리거나 없는 날짜(2월 30일 등)면 null */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null
  const date = new Date(y, mo - 1, d)
  // 0~99 년은 1900 년대로 바뀌므로 다시 맞춘다
  date.setFullYear(y)
  return date
}

/** 기준일의 달력 날짜만 (시각 버림) */
export function toLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** 두 날짜 사이 달력 일수 (시간대·서머타임과 무관) */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b - a) / 86_400_000)
}

// 만 나이 계산 (기준일 대비). 2월 29일생은 평년에는 3월 1일에 한 살 더한다(민법 §160③).
export function calcAge(birthDate: string, baseDate: Date = new Date()): number | null {
  const birth = parseLocalDate(birthDate)
  if (!birth) return null

  let age = baseDate.getFullYear() - birth.getFullYear()
  const monthDiff = baseDate.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && baseDate.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}

// 청년 여부: 만 15세 이상 34세 이하 (병역기간 미반영)
export function isYouthAge(age: number | null): boolean | null {
  if (age === null) return null
  return age >= 15 && age <= 34
}

// YYYY-MM-DD 포맷
export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// YYYY년 MM월 DD일 포맷 (PDF/요약용)
export function formatKoreanDate(value: string): string {
  if (!value) return '-'
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}

// 해당 연/월의 일수
export function daysInMonth(year: number, month: number): number {
  // month: 1~12
  return new Date(year, month, 0).getDate()
}

// 'YYYY-MM-DD' 문자열 분해
export function splitDate(value: string): { year: number; month: number; day: number } | null {
  if (!value) return null
  const parts = value.split('-')
  if (parts.length !== 3) return null
  const [y, m, d] = parts.map(Number)
  if (!y || !m || !d) return null
  return { year: y, month: m, day: d }
}

// 분해된 값을 'YYYY-MM-DD'로 결합 (일자 보정 포함)
export function joinDate(year: number, month: number, day: number): string {
  const maxDay = daysInMonth(year, month)
  const safeDay = Math.min(day, maxDay)
  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
}
