/** D-634 대화 말풍선 옆 시각 — 카카오톡처럼 '오후 3:12' */
export function chatTime(at?: string | number | Date | null): string {
  const d = toDate(at)
  if (!d) return ''
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${m}`
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'] as const

function toDate(at?: string | number | Date | null): Date | null {
  if (at == null || at === '') return null
  const d = at instanceof Date ? at : new Date(at)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 그 날의 열쇠(이 기기 시각 기준 'YYYY-MM-DD') — 날짜 줄을 언제 넣을지 가르는 데만 */
export function chatDayKey(at?: string | number | Date | null): string {
  const d = toDate(at)
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : ''
}

/**
 * D-638 날짜 — 대표(2026-11-19) "지난 대화에 시간도 잘 나오는 게 좋은데 날짜도 잘 나오게".
 *   오늘 · 어제 · '11월 17일 (월)' · 올해가 아니면 '2025년 12월 3일 (수)'
 */
export function chatDay(at?: string | number | Date | null, now: Date = new Date()): string {
  const d = toDate(at)
  if (!d) return ''
  const key = chatDayKey(d)
  if (key === chatDayKey(now)) return '오늘'
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (key === chatDayKey(y)) return '어제'
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}년 ${md}`
}

/** 날짜 + 시각 — '오늘 오후 3:12' · '11월 17일 (월) 오전 9:05' */
export function chatStamp(at?: string | number | Date | null, now: Date = new Date()): string {
  const day = chatDay(at, now)
  return day ? `${day} ${chatTime(at)}` : ''
}

/** 대화 가운데 날짜 줄(카카오톡처럼) — '2026년 11월 19일 수요일' */
export function chatDayLine(at?: string | number | Date | null): string {
  const d = toDate(at)
  return d ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일` : ''
}
