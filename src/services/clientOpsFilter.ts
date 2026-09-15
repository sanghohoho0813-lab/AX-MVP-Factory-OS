/**
 * 고객 목록 '보기' — 정렬(D-72)이 순서를 정한다면, 보기는 **무엇을 보일지** 를 정한다.
 *
 * 대표가 목록에서 자주 하는 질문은 세 갈래다.
 *   "보험 계약한 데가 어디였지"      → 계약 종류
 *   "돈 못 받은 데만 보자"           → 못 받은 내 돈
 *   "예정일 지난 데부터 전화하자"    → 연체
 * 검색칸에 낱말을 넣어 찾을 수 없는 조건들이라 고르는 칸으로 둔다.
 *
 * 순수 함수. 단위 시험으로 고정한다.
 */

import type { ClientOpsRecord } from '../types/clientOps'
import { CONTRACT_KIND_LABEL, contractStageOf } from '../types/clientOps'
import { clientOpsProgress } from './clientOpsAlerts'
import { todayLocalDate } from '../lib/appClock'

export type ClientFilterKey = 'all' | 'cash' | 'insurance' | 'mixed' | 'unsigned' | 'unpaid' | 'overdue'

export const CLIENT_FILTER_ORDER: ClientFilterKey[] = ['all', 'unpaid', 'overdue', 'cash', 'insurance', 'mixed', 'unsigned']

export const CLIENT_FILTER_LABEL: Record<ClientFilterKey, string> = {
  all: '전체',
  unpaid: '못 받은 돈 있음',
  overdue: '연체 있음',
  cash: `${CONTRACT_KIND_LABEL.cash} 계약`,
  insurance: `${CONTRACT_KIND_LABEL.insurance} 계약`,
  mixed: CONTRACT_KIND_LABEL.mixed,
  unsigned: '계약 전',
}

export function isClientFilterKey(v: unknown): v is ClientFilterKey {
  return typeof v === 'string' && (CLIENT_FILTER_ORDER as string[]).includes(v)
}

/** 이 업체가 보기 조건에 맞는가 */
export function matchesClientFilter(r: ClientOpsRecord, key: ClientFilterKey, today: string = todayLocalDate()): boolean {
  switch (key) {
    case 'all':
      return true
    case 'cash':
    case 'insurance':
    case 'mixed':
      return r.contract.kind === key
    case 'unsigned':
      // 계약 단계가 '계약 전' 인 업체. 종료한 업체는 계약 전이 아니다 — 계약 정보를 적었어도 단계가 우선
      return contractStageOf(r.status) === 'pre'
    case 'unpaid':
      return clientOpsProgress(r, today).unpaidNet > 0
    case 'overdue':
      return clientOpsProgress(r, today).overduePayments > 0
  }
}

export function filterClients(records: ClientOpsRecord[], key: ClientFilterKey, today: string = todayLocalDate()): ClientOpsRecord[] {
  if (key === 'all') return records
  return records.filter((r) => matchesClientFilter(r, key, today))
}
