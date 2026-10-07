/**
 * 업체 고르는 칸의 순서 (D-168 대표 요청) — "개인사업자를 제일 앞에, 법인은 가나다 순으로".
 *
 * 업체 기록에는 개인 · 법인 칸이 따로 없다. 그래서 이미 있는 값으로 가린다(규칙 — 외부 호출 없음).
 *   1. 법인번호가 있으면 법인
 *   2. 사업자등록번호 가운데 두 자리 — 81 · 82 · 84 · 85 · 86 · 87 · 88 은 법인, 01~79 · 90~99 는 개인(국세청 구분)
 *   3. 이름에 (주) · 주식회사 · ㈜ · (유) · 유한회사 · 합자 · 합명 · 회사법인 이 있으면 법인
 * D-171 대표: "주식회사라고 안 쓰여 있으면 개인사업자" — 위 셋에 걸리지 않으면 개인사업자. 묶음은 개인사업자 · 법인 둘뿐.
 */

export type EntityKind = 'individual' | 'corporation' | 'unknown'

export interface OrderableClient {
  companyName: string
  businessNumber?: string
  corporateNumber?: string
}

const CORP_NAME = /\(주\)|㈜|주식회사|\(유\)|유한회사|유한책임회사|합자회사|합명회사|회사법인|\(사\)|사단법인|재단법인/

export function entityKindOf(c: OrderableClient): EntityKind {
  if ((c.corporateNumber ?? '').trim() !== '') return 'corporation'
  const digits = (c.businessNumber ?? '').replace(/\D/g, '')
  if (digits.length === 10) {
    const mid = Number(digits.slice(3, 5))
    if ([81, 82, 84, 85, 86, 87, 88].includes(mid)) return 'corporation'
    if ((mid >= 1 && mid <= 79) || (mid >= 90 && mid <= 99)) return 'individual'
  }
  if (CORP_NAME.test(c.companyName)) return 'corporation'
  return 'individual'
}

const RANK: Record<EntityKind, number> = { individual: 0, corporation: 1, unknown: 2 }
export const ENTITY_GROUP_LABEL: Record<EntityKind, string> = { individual: '개인사업자', corporation: '법인', unknown: '구분 모름' }

/** 이름 가나다 순 — '(주)' · '주식회사' 같은 앞말은 빼고 견준다(㈜가나 가 '가' 에 오게) */
function sortName(name: string): string {
  return name.replace(/^\s*(\(주\)|㈜|주식회사|\(유\)|유한회사)\s*/, '').trim()
}

/** 개인사업자 → 법인, 묶음 안에서는 가나다 순 */
export function orderForPicker<T extends OrderableClient>(list: readonly T[]): T[] {
  return [...list].sort(
    (a, b) => RANK[entityKindOf(a)] - RANK[entityKindOf(b)] || sortName(a.companyName).localeCompare(sortName(b.companyName), 'ko'),
  )
}

/** 고르는 칸에 묶음 이름까지 붙여 — 빈 묶음은 뺀다 */
export function pickerGroups<T extends OrderableClient>(list: readonly T[]): { kind: EntityKind; label: string; items: T[] }[] {
  const ordered = orderForPicker(list)
  return (['individual', 'corporation'] as EntityKind[])
    .map((kind) => ({ kind, label: ENTITY_GROUP_LABEL[kind], items: ordered.filter((c) => entityKindOf(c) === kind) }))
    .filter((g) => g.items.length > 0)
}
