/**
 * 상담신청 → 잠재고객 (D-122) — 고객이 이미 적어 보낸 것을 영업 칸으로 옮긴다. 순수 함수.
 *
 * 예전에는 회사명 · 이름 · 연락처 · 이메일 · 업종 다섯 가지만 옮기고, 고객이 적은 문의 내용 · 원하는 진행 방식 ·
 * 희망 연락 시간 · 진단 등급은 카드에만 남았다(영업 보드 · 미팅 준비에서는 다시 물어야 했다).
 *   - 문의 내용(message · body · title) → 영업 '대표 고민'
 *   - 진행 방식 · 상품 · 문의 내용 낱말 → 영업 관심사(목록에 있는 것만)
 *   - 희망 연락 시간 → 다음 약속 '첫 연락(희망: …)' 오늘
 */
import type { ClientOpsRecord } from '../types/clientOps'
import { SALES_INTERESTS } from '../content/salesCatalog'
import { withSalesInfo } from './salesPipeline'
import { formatPhone } from '../lib/format'

const INTEREST_WORDS: [string, RegExp][] = [
  ['절세', /절세|세금/],
  ['가업승계', /승계|가업/],
  ['가지급금', /가지급금/],
  ['미처분이익잉여금', /잉여금/],
  ['정관정비', /정관/],
  ['임원퇴직금', /퇴직금/],
  ['법인세', /법인세/],
  ['연구소', /연구소|연구개발|R&D/i],
  ['벤처인증', /벤처|이노비즈|메인비즈|인증/],
  ['정책자금', /정책\s*자금|운전\s*자금|대출|보증/],
  ['고용지원금', /고용|채용|지원금/],
  ['법인보험', /보험/],
  ['법인전환', /법인\s*전환/],
]

export function interestsFromText(text: string): string[] {
  const out: string[] = []
  for (const [name, re] of INTEREST_WORDS) {
    if ((SALES_INTERESTS as readonly string[]).includes(name) && re.test(text) && !out.includes(name)) out.push(name)
  }
  return out
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const trimSeparators = (s: string) => s.replace(/^[\s/,·|;]+|[\s/,·|;]+$/g, '').trim()

/**
 * D-182: 고객이 한 칸에 '메일 / 전화' 를 같이 적어 보낸 것을 나눈다 — 휴대폰 칸에 메일이 들어가 있지 않게.
 * 이메일 칸이 비어 있을 때만 옮기고, 남은 전화번호는 010-0000-0000 으로. 나눌 것이 없으면 그대로.
 */
export function splitContact(phone: string, email: string): { phone: string; email: string } {
  let p = phone.trim()
  let e = email.trim()
  const inPhone = EMAIL_RE.exec(p)
  if (inPhone) {
    if (!e) e = inPhone[0]
    p = trimSeparators(p.replace(inPhone[0], ' '))
  }
  // 이메일 칸에 전화번호만 들어온 경우(골뱅이 없음 · 숫자 9자리 이상)
  if (e && !e.includes('@') && e.replace(/\D/g, '').length >= 9) {
    if (!p) p = e
    e = ''
  }
  const inEmail = EMAIL_RE.exec(e)
  if (inEmail && inEmail[0] !== e) {
    const rest = trimSeparators(e.replace(inEmail[0], ' '))
    if (!p && rest.replace(/\D/g, '').length >= 9) p = rest
    e = inEmail[0]
  }
  if (p && /^[\d\s()+-]+$/.test(p)) p = formatPhone(p)
  return { phone: p, email: e }
}

export function withInboxPayload(record: ClientOpsRecord, payload: Record<string, unknown>, today: string): ClientOpsRecord {
  const str = (k: string) => (typeof payload[k] === 'string' ? (payload[k] as string).trim() : '')
  const message = str('message') || str('body') || str('title')
  const hints = [str('program'), str('product_slug'), str('request_type'), message].filter(Boolean).join(' ')
  const interests = interestsFromText(hints)
  let next = withSalesInfo(record, {
    ...(message ? { concern: message.slice(0, 300) } : {}),
    ...(interests.length > 0 ? { interests: [...new Set([...(record.sales?.interests ?? []), ...interests])] } : {}),
  })
  // D-141: 지원사업 찾기에서 온 신청 — 고른 조건(지역 · 업종 · 업력 구간)을 그대로 남겨 맞는 공고를 바로 계산한다
  const grantQuery = str('grant_query')
  if (grantQuery && next.sales) {
    next = withSalesInfo(next, { grantQuery: grantQuery.slice(0, 500), interests: [...new Set([...(next.sales.interests ?? []), ...interestsFromText('정책자금 지원금')])] })
    const g = new URLSearchParams(grantQuery)
    const place = [g.get('r') ?? '', g.get('c') ?? ''].filter(Boolean).join(' ')
    if (place && !next.businessAddress.trim()) next = { ...next, businessAddress: place }
  }
  const when = str('preferred_contact_time')
  if (when && next.nextAction.trim() === '') {
    next = { ...next, nextAction: `첫 연락 (희망: ${when.slice(0, 40)})`, nextActionDueDate: today }
  }
  return next
}
