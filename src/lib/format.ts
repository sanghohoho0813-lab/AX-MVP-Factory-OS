/** 한국 원화·날짜·전화번호·사업자등록번호·D-day 공용 유틸리티 */

/** 1200000000 → "1,200,000,000원" */
export function formatKrw(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return '-'
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 1200000000 → "12억원", 350000000 → "3.5억원", 80000000 → "8,000만원" */
export function formatKrwCompact(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return ''
  if (amount >= 100_000_000) {
    const eok = amount / 100_000_000
    const rounded = Math.round(eok * 10) / 10
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}억원`
  }
  if (amount >= 10_000) {
    return `${Math.round(amount / 10_000).toLocaleString('ko-KR')}만원`
  }
  return `${amount.toLocaleString('ko-KR')}원`
}

/** ISO 날짜/일시 → "2026.07.19" */
export function formatDate(iso: string | null): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}.${m}.${d}`
}

/** ISO 일시 → "2026.07.19 14:20" */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${formatDate(iso)} ${hh}:${mm}`
}

/** 숫자만 남기고 010-0000-0000 형태로 정리 (자릿수가 다르면 원문 유지) */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    if (digits.startsWith('02')) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return value.trim()
}

/** 숫자만 남기고 000-00-00000 형태로 자동 포맷 */
export function formatBusinessNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

/** 법인등록번호 — 000000-0000000 */
export function formatCorporateNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 13)
  if (digits.length <= 6) return digits
  return `${digits.slice(0, 6)}-${digits.slice(6)}`
}

/* ------------------------------------------------------------------ */
/* 번호 서식 — 화면에는 하이픈, 복사할 때는 고를 수 있게                    */
/* ------------------------------------------------------------------ */

/**
 * 서식이 정해진 번호의 종류.
 * 기록에 어떤 모양으로 들어와 있든(하이픈 있든 없든) 화면에는 서류에 적히는 모양으로 보여 준다.
 */
export type NumberKind = 'business' | 'corporate' | 'phone'

/** 보이는 모양 — 하이픈 포함. 자릿수가 안 맞으면 원문을 그대로 둔다(지어내지 않는다) */
export function formatNumberOf(kind: NumberKind, value: string): string {
  const raw = value.trim()
  if (raw === '') return ''
  const n = raw.replace(/\D/g, '').length
  switch (kind) {
    case 'business':
      return n === 10 ? formatBusinessNumber(raw) : raw
    case 'corporate':
      return n === 13 ? formatCorporateNumber(raw) : raw
    case 'phone':
      return n === 10 || n === 11 ? formatPhone(raw) : raw
  }
}

/** 복사용 — 하이픈을 뺀 숫자만. 숫자가 없으면 원문 */
export function digitsOf(value: string): string {
  const d = value.replace(/\D/g, '')
  return d === '' ? value.trim() : d
}

/**
 * 하이픈으로 나뉜 조각들 — `313-81-12508` → `['313', '81', '12508']`.
 *
 * 신청서 입력칸이 `[  ] - [  ] - [  ]` 로 나뉘어 있는 곳이 많다. 그때는 전체를 복사해서
 * 붙인 뒤 손으로 지우는 것이 아니라, 조각 하나씩 복사해 칸을 옮겨 가며 붙이는 것이 맞다.
 *
 * 나눌 것이 없거나(하이픈 없음) 숫자가 아닌 조각이 섞이면 빈 배열 — 그때는 나누지 않는다.
 */
export function numberSegments(value: string): string[] {
  const parts = value.trim().split('-')
  if (parts.length < 2) return []
  return parts.every((p) => /^\d+$/.test(p)) ? parts : []
}

export interface DDayInfo {
  /** "D-3" | "D-Day" | "D+2" */
  label: string
  /** 음수면 지연 */
  daysLeft: number
  overdue: boolean
}

/** 오늘 자정 기준 D-day 계산 */
export function getDDay(dateIso: string | null): DDayInfo | null {
  if (!dateIso) return null
  const target = new Date(dateIso)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  const daysLeft = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (daysLeft === 0) return { label: 'D-Day', daysLeft, overdue: false }
  if (daysLeft > 0) return { label: `D-${daysLeft}`, daysLeft, overdue: false }
  return { label: `D+${Math.abs(daysLeft)}`, daysLeft, overdue: true }
}

/* ------------------------------------------------------------------ */
/* 검증                                                                 */
/* ------------------------------------------------------------------ */

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

export function isValidUrl(value: string): boolean {
  const trimmed = value.trim()
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`
    const url = new URL(withProtocol)
    return url.hostname.includes('.')
  } catch {
    return false
  }
}

/** 000-00-00000 형식(숫자 10자리) 여부 */
export function isValidBusinessNumber(value: string): boolean {
  return /^\d{3}-\d{2}-\d{5}$/.test(value.trim())
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 9 && digits.length <= 11
}

/** 검색용 정규화: 소문자 + 앞뒤 공백 제거 */
export function normalizeQuery(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * 요약 칸에 넣을 금액 — 좁은 칸에서 잘리지 않도록 만원·억 단위로 줄인다.
 * 목록·상세처럼 자리가 있는 곳에서는 formatKrw 를 그대로 쓴다.
 */
export function krwTile(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return '0원'
  return formatKrwCompact(amount)
}

/**
 * 파일 크기 — 사람이 읽는 단위.
 * 1024 가 아니라 1000 으로 나눈다. 운영체제가 보여주는 값과 맞추려는 것이다.
 */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1000) return `${bytes}B`
  if (bytes < 1000 * 1000) return `${Math.round(bytes / 1000)}KB`
  const mb = bytes / (1000 * 1000)
  if (mb < 1000) return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)}MB`
  return `${(mb / 1000).toFixed(1)}GB`
}
