// 날짜 관련 순수 유틸

// 만 나이 계산 (기준일 대비)
export function calcAge(birthDate: string, baseDate: Date = new Date()): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null

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
