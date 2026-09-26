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

export function withInboxPayload(record: ClientOpsRecord, payload: Record<string, unknown>, today: string): ClientOpsRecord {
  const str = (k: string) => (typeof payload[k] === 'string' ? (payload[k] as string).trim() : '')
  const message = str('message') || str('body') || str('title')
  const hints = [str('program'), str('product_slug'), str('request_type'), message].filter(Boolean).join(' ')
  const interests = interestsFromText(hints)
  let next = withSalesInfo(record, {
    ...(message ? { concern: message.slice(0, 300) } : {}),
    ...(interests.length > 0 ? { interests: [...new Set([...(record.sales?.interests ?? []), ...interests])] } : {}),
  })
  const when = str('preferred_contact_time')
  if (when && next.nextAction.trim() === '') {
    next = { ...next, nextAction: `첫 연락 (희망: ${when.slice(0, 40)})`, nextActionDueDate: today }
  }
  return next
}
