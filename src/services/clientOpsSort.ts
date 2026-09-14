/**
 * 고객 목록 정렬 — 무엇을 기준으로 훑을 것인가.
 *
 * 기본은 '급한 순' 이다. 목록을 여는 이유의 대부분이 "오늘 뭐부터 챙기지" 이기 때문이다.
 * 그런데 전화를 받았을 때는 이름으로 찾고, 정책자금 자격을 볼 때는 업력으로 보고,
 * 계약 관리를 할 때는 계약일로 본다 — 그때마다 기준을 바꿀 수 있어야 한다.
 *
 * 순수 함수이므로 단위 시험으로 고정한다.
 */

import type { ClientOpsRecord } from '../types/clientOps'
import { sortClientsByUrgency } from './clientOpsAlerts'
import { todayLocalDate } from '../lib/appClock'
import { yearsInBusiness } from './clientOpsProfile'
import { monthsSinceContract } from './contractSummary'

export type ClientSortKey = 'urgency' | 'name' | 'years' | 'contract'

export const CLIENT_SORT_ORDER: ClientSortKey[] = ['urgency', 'name', 'years', 'contract']

export const CLIENT_SORT_LABEL: Record<ClientSortKey, string> = {
  urgency: '급한 순',
  name: '가나다순',
  years: '업력순',
  contract: '계약 오래된 순',
}

export const CLIENT_SORT_HINT: Record<ClientSortKey, string> = {
  urgency: '마감 지남·연체가 위로',
  name: '업체 이름 순서대로',
  years: '오래된 회사가 위로',
  contract: '오래 함께한 업체가 위로',
}

export function isClientSortKey(v: unknown): v is ClientSortKey {
  return typeof v === 'string' && (CLIENT_SORT_ORDER as string[]).includes(v)
}

/**
 * 값이 없는 업체는 언제나 맨 뒤로 보낸다.
 * 설립일을 아직 안 적은 업체가 '업력순' 에서 맨 위에 오면 목록을 못 믿게 된다.
 */
function byNumberDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return b - a
}

export function sortClients(
  records: ClientOpsRecord[],
  key: ClientSortKey,
  today: string = todayLocalDate(),
): ClientOpsRecord[] {
  const list = [...records]
  switch (key) {
    case 'urgency':
      return sortClientsByUrgency(list, today)
    case 'name':
      // 한글 이름은 코드 순서가 아니라 사람이 읽는 순서로 — localeCompare('ko')
      return list.sort((a, b) => a.companyName.localeCompare(b.companyName, 'ko'))
    case 'years':
      return list.sort(
        (a, b) =>
          byNumberDesc(
            yearsInBusiness(a.establishedAt, today)?.nthYear ?? null,
            yearsInBusiness(b.establishedAt, today)?.nthYear ?? null,
          ) || a.companyName.localeCompare(b.companyName, 'ko'),
      )
    case 'contract':
      return list.sort(
        (a, b) =>
          byNumberDesc(
            monthsSinceContract(a.contract.signedAt, today),
            monthsSinceContract(b.contract.signedAt, today),
          ) || a.companyName.localeCompare(b.companyName, 'ko'),
      )
  }
}
