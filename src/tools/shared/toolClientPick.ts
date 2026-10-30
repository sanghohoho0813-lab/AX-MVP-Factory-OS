/** D-354 모듈 업체 고르기 — 띠를 얹는 화면 · 창 열기 신호 · 찾기(화면 부품은 ToolClientPicker) */
import type { ClientOpsRecord } from '../../types/clientOps'

/** 업체 고르기 띠를 얹는 모듈 — 홍보 글 · 홈페이지 · 영업 도구는 자기 화면에 고르는 곳이 따로 있다 */
const PICK_PATHS = ['/tools/tax', '/tools/startup-tax', '/tools/employment', '/tools/labcare', '/tools/policy-funding', '/tools/cretop']

export function pickerOn(pathname: string): boolean {
  return PICK_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export const PICK_EVENT = 'axmvp:tool-client-pick'

/** 화면 안 다른 곳(상황 예시 등)에서 업체 고르기 창을 연다 */
export function openToolClientPicker() {
  window.dispatchEvent(new CustomEvent(PICK_EVENT))
}

/** 찾기 — 이름 · 대표 · 전화 · 사업자번호(숫자만 비교) */
export function filterPickClients(list: readonly ClientOpsRecord[], q: string): ClientOpsRecord[] {
  const live = list.filter((c) => c.archivedAt === null).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  const t = q.trim().toLowerCase()
  if (!t) return live
  const digits = t.replace(/\D/g, '')
  return live.filter((c) => {
    const text = [c.companyName, c.representativeName, c.contactName, c.industry].join(' ').toLowerCase()
    if (text.includes(t)) return true
    if (digits.length >= 3) return [c.contactPhone, c.businessNumber].some((v) => (v ?? '').replace(/\D/g, '').includes(digits))
    return false
  })
}
