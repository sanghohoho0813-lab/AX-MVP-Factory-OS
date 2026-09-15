/**
 * 업체 검색 — 회사명만이 아니라 '내가 적어 둔 것' 전부에서 찾는다.
 *
 * 대표는 회사명을 정확히 기억하지 못할 때가 많다. 대신 담당자 이름, 전화번호 뒷자리,
 * 법인번호, 직접 만든 칸("담당 세무사", "영업자")에 적은 값으로 찾으려 한다.
 * 그래서 검색 대상은 기본 정보 + 직접 만든 칸 + 영업자 이름까지 넓힌다.
 *
 * 숫자만 넣으면(예: 1234) 하이픈을 걷어낸 숫자열에서도 찾는다 — 사업자번호를 "123-45"
 * 로 적었는지 "12345" 로 적었는지 기억할 필요가 없다.
 *
 * 순수 함수. 단위 시험으로 고정한다.
 */

import type { ClientOpsRecord } from '../types/clientOps'

/** 검색 대상 문자열 하나로 모은다 (소문자). 화면은 이것을 includes 로만 본다. */
export function clientSearchText(r: ClientOpsRecord): string {
  const parts: string[] = [
    r.companyName,
    r.contactName,
    r.contactTitle,
    r.contactPhone,
    r.contactEmail,
    r.companyPhone,
    r.representativeName,
    r.businessNumber,
    r.corporateNumber,
    r.industry,
    r.businessCategory,
    r.businessItem,
    r.businessAddress,
    r.homepage,
    ...r.customFields.flatMap((f) => [f.label, f.value]),
    ...r.fees.map((f) => f.agentName),
    ...r.contract.policies.flatMap((p) => [p.insurer, p.productName]),
  ]
  return parts
    .filter((v) => typeof v === 'string' && v.trim() !== '')
    .join(' ')
    .toLowerCase()
}

/** 숫자만 남긴 검색 대상 — 번호 조각으로 찾을 때 */
function digitsText(r: ClientOpsRecord): string {
  return [r.contactPhone, r.companyPhone, r.businessNumber, r.corporateNumber, ...r.customFields.map((f) => f.value)]
    .map((v) => v.replace(/\D/g, ''))
    .filter((v) => v !== '')
    .join(' ')
}

/** 검색어에 맞는 업체인지. 빈 검색어는 전부 맞는다 */
export function matchesClientSearch(r: ClientOpsRecord, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  if (clientSearchText(r).includes(q)) return true
  // 숫자·하이픈만 넣었으면 번호에서도 찾는다
  const qd = q.replace(/\D/g, '')
  if (qd !== '' && /^[\d\s-]+$/.test(q)) return digitsText(r).includes(qd)
  return false
}
