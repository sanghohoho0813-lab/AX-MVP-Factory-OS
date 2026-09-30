/**
 * 수금 상태 (D-140) — 이 돈은 지금 어떤 상태인가. 미수금은 여기 한 곳에서만 정한다.
 *
 * 대표: "아직 지급조건이 오지 않은 돈을 못 받은 돈 · 미수금으로 잡지 않는다.
 *        정책자금 조달 조건이 아직 충족되지 않은 성공보수를 미수금으로 계산하면 안 된다."
 *
 *   입금 완료  receivedAt 이 있다(사람이 '입금 확인' 을 눌렀다)
 *   조건 대기  조건(정책자금 실행 · N원 이상 조달 · 프로젝트 완료 · 직접 조건)이 아직 — 받을 시점이 아니다. 날짜가 없어도 정상
 *   받을 예정  받기로 한 날이 앞날
 *   청구 가능  조건이 충족됐거나 · 계약 시 받는 돈 · 받기로 한 날이 오늘
 *   미수금    받기로 한 날이 지났는데 입금 전
 *   받을 날 미정  조건도 날짜도 없는 예전 항목 — 예전처럼 '못 받은 돈' 에는 들어가고 미수금은 아니다(D-139 까지와 같음)
 *
 * 예전 기록(조건 칸이 없음)은 날짜로만 판정한다 — D-139 까지와 결과가 같다(미수금이 새로 생기지 않는다).
 * 정책자금 조건은 **실제 입금(실행)액** 으로만 자동 판정한다. 선정 · 확정만으로는 충족으로 보지 않는다.
 */
import type { ClientOpsRecord, FeeConditionKind, FeeItem, FundingApplication } from '../types/clientOps'
import { FEE_CONDITION_LABEL } from '../types/clientOps'

export type FeeState = 'received' | 'waiting' | 'scheduled' | 'claimable' | 'overdue' | 'undated'

export const FEE_STATE_LABEL: Record<FeeState, string> = {
  received: '입금 완료',
  waiting: '조건 대기',
  scheduled: '받을 예정',
  claimable: '청구 가능',
  overdue: '미수금',
  undated: '받을 날 미정',
}

/** 날짜가 아니라 조건으로 받는 돈 */
export const CONDITIONAL_KINDS: FeeConditionKind[] = ['funding_executed', 'funding_50m', 'funding_100m', 'project_done', 'custom']

export function isConditional(fee: Pick<FeeItem, 'conditionKind'>): boolean {
  return !!fee.conditionKind && (CONDITIONAL_KINDS as string[]).includes(fee.conditionKind)
}

/** 업체의 정책자금 실제 조달(입금) — 사람이 적은 실행액만 */
export interface FundingFacts {
  /** 실제 입금된 금액 합계(원) */
  executedTotal: number
  /** 한 건이라도 실제 입금됐는가 */
  executedAny: boolean
}

export const NO_FUNDING: FundingFacts = { executedTotal: 0, executedAny: false }

export function fundingFactsOf(apps: readonly Pick<FundingApplication, 'executedAmount'>[] | undefined): FundingFacts {
  let total = 0
  for (const a of apps ?? []) if (typeof a.executedAmount === 'number' && Number.isFinite(a.executedAmount) && a.executedAmount > 0) total += a.executedAmount
  return { executedTotal: total, executedAny: total > 0 }
}

/** 정책자금 조건이 실제 조달 결과로 충족됐는가 (다른 조건은 null — 사람만 판정) */
export function autoConditionMet(kind: FeeConditionKind | '' | undefined, f: FundingFacts): boolean | null {
  if (kind === 'funding_executed') return f.executedAny
  if (kind === 'funding_50m') return f.executedTotal >= 50_000_000
  if (kind === 'funding_100m') return f.executedTotal >= 100_000_000
  return null
}

/** 조건이 충족됐는가 — 사람이 눌렀거나(conditionMetAt) · 정책자금 실제 조달이 기준을 넘었거나 */
export function conditionMet(fee: Pick<FeeItem, 'conditionKind' | 'conditionMetAt'>, f: FundingFacts = NO_FUNDING): boolean {
  if (!isConditional(fee)) return true
  if (fee.conditionMetAt) return true
  return autoConditionMet(fee.conditionKind, f) === true
}

export function feeStateOf(fee: FeeItem, today: string, f: FundingFacts = NO_FUNDING): FeeState {
  if (fee.receivedAt) return 'received'
  if (isConditional(fee) && !conditionMet(fee, f)) return 'waiting'
  const due = /^\d{4}-\d{2}-\d{2}$/.test(fee.dueDate) ? fee.dueDate : ''
  if (due) {
    if (due < today) return 'overdue'
    if (due > today) return 'scheduled'
    return 'claimable'
  }
  // 날짜 없음: 조건이 충족된 돈 · 계약 시 받는 돈은 지금 받을 돈. 아무것도 없는 예전 항목은 '받을 날 미정'
  if (isConditional(fee) || fee.conditionKind === 'on_contract') return 'claimable'
  return 'undated'
}

/** 조건 대기인가 — '못 받은 돈' 에서 빼는 유일한 규칙 */
export function isWaiting(fee: FeeItem, f: FundingFacts = NO_FUNDING): boolean {
  return !fee.receivedAt && isConditional(fee) && !conditionMet(fee, f)
}

/** 화면 한 줄 — '정책자금 1억원 이상 조달 시' · '10월 15일' · '계약 시' */
export function conditionText(fee: Pick<FeeItem, 'conditionKind' | 'conditionText' | 'dueDate'>): string {
  const k = fee.conditionKind
  if (k === 'custom') return fee.conditionText?.trim() || '직접 적은 조건'
  if (k && k !== 'date') return FEE_CONDITION_LABEL[k]
  if (fee.dueDate) return `${Number(fee.dueDate.slice(5, 7))}월 ${Number(fee.dueDate.slice(8))}일`
  return ''
}

export interface MoneyPlan {
  /** 계약금액 — 계약의 현금 금액과 수금 항목 합계 중 큰 쪽 */
  contract: number
  /** 수금 항목 합계 */
  planned: number
  /** 계약금액 중 아직 수금 항목으로 안 나눈 돈(음수면 항목이 더 많다) */
  unplanned: number
  received: number
  /** 지금 받을 돈 = 청구 가능 + 미수금 */
  now: number
  overdue: number
  /** 조건부 · 예정 = 조건 대기 + 받을 예정 + 받을 날 미정 */
  later: number
  waiting: number
  scheduled: number
  undated: number
  /** 영업자 수수료 합계 */
  agent: number
  /** 금액을 안 적은 항목 */
  unknownCount: number
  byState: Record<FeeState, number>
}

/** 한 업체의 돈 — 계약 · 받은 돈 · 지금 받을 돈 · 조건부 예정 (청구액 기준) */
export function moneyPlanOf(record: Pick<ClientOpsRecord, 'fees' | 'contract' | 'fundingApplications'>, today: string): MoneyPlan {
  const f = fundingFactsOf(record.fundingApplications)
  const byState: Record<FeeState, number> = { received: 0, waiting: 0, scheduled: 0, claimable: 0, overdue: 0, undated: 0 }
  let planned = 0
  let agent = 0
  let unknownCount = 0
  for (const fee of record.fees) {
    // feeMath 를 부르지 않는다(feeMath 가 이 파일을 쓰므로 — 서로 부르지 않게)
    const gross = typeof fee.amount === 'number' && Number.isFinite(fee.amount) ? fee.amount : null
    agent += typeof fee.agentFee === 'number' && Number.isFinite(fee.agentFee) && fee.agentFee > 0 ? fee.agentFee : 0
    if (gross === null) {
      unknownCount += 1
      continue
    }
    planned += gross
    byState[feeStateOf(fee, today, f)] += gross
  }
  // 계약금액이 수금 항목보다 작으면(나중에 성공보수를 더 적은 예전 기록) 큰 쪽 — 받을 돈을 계약보다 작게 보이지 않게
  const contract = Math.max(record.contract.cashAmount !== null && record.contract.cashAmount > 0 ? record.contract.cashAmount : 0, planned)
  return {
    contract,
    planned,
    unplanned: contract - planned,
    received: byState.received,
    now: byState.claimable + byState.overdue,
    overdue: byState.overdue,
    later: byState.waiting + byState.scheduled + byState.undated,
    waiting: byState.waiting,
    scheduled: byState.scheduled,
    undated: byState.undated,
    agent,
    unknownCount,
    byState,
  }
}
