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
