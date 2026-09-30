/**
 * 계약 → 받은 돈 → 남은 돈 (D-140) — 세 가지만 고르면 수금 항목은 OS 가 만든다. 순수 함수.
 *
 * 대표: "사용자가 이해해야 하는 것은 얼마짜리 계약인가 · 지금 얼마 받았는가 · 남은 돈은 언제/어떤 조건에서 받는가 뿐."
 *
 *  - 받은 돈은 '지금 받은 돈' 으로 **사람이 고른 것만** 입금 완료로 적는다(계약 저장 = 입금 아님).
 *  - 남은 돈은 조건으로 둔다 — 성공보수에 날짜를 지어내지 않는다('날짜 정하기' 를 골랐을 때만 날짜).
 *  - 이미 수금 항목이 있으면 **모자란 만큼만** 새로 만든다(있는 항목 · 입금 기록은 건드리지 않는다).
 */
import type { ClientOpsRecord, FeeConditionKind, FeeItem, FeeKind } from '../types/clientOps'
import { FEE_CONDITION_LABEL } from '../types/clientOps'
import { withActivity } from './clientOpsActivity'
import { withContract } from './clientOpsService'
import { withSalesStage } from './salesPipeline'
import { contractStageOf } from '../types/clientOps'

/** AX 계약 — 자주 파는 금액(원). AX 가 아닌 계약에는 강제하지 않는다(직접 입력) */
export const AX_QUICK_AMOUNTS = [5_000_000, 15_000_000, 30_000_000]

export type PayMethod = 'full_upfront' | 'upfront_rest' | 'after_funding' | 'split'

export const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  full_upfront: '전액 선금',
  upfront_rest: '선금 + 나머지 나중',
  after_funding: '정책자금 조달 후 받기',
  split: '직접 나누기',
}

/** 금액마다 먼저 권하는 방식 — 권할 뿐 강제하지 않는다 */
export function recommendedMethod(total: number): PayMethod {
  return total > 0 && total <= 5_000_000 ? 'full_upfront' : 'upfront_rest'
}

export interface When {
  kind: FeeConditionKind
  /** kind 가 'date' 일 때 */
  date?: string
  /** kind 가 'custom' 일 때 */
  text?: string
}

export interface PlanLine {
  label: string
  kind: FeeKind
  amount: number
  when: When
  /** 지금 받았다(사람이 골랐다) → 입금 완료로 적는다 */
  receivedNow: boolean
}

export interface ContractPlanInput {
  /** 이번에 나눌 돈(계약금액 − 이미 적힌 수금 항목) */
  portion: number
  method: PayMethod
  /** 지금 받은 돈 */
  paidNow: number
  /** 선금 + 나머지에서 아직 안 받았을 때 — 계약 시 받을 선금 */
  upfront?: number
  /** 남은 돈을 언제 */
  rest?: When
  /** 직접 나누기 */
  lines?: PlanLine[]
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)))

/** 고른 것 → 만들 수금 항목 (금액 0 인 줄은 만들지 않는다) */
export function planLines(input: ContractPlanInput): PlanLine[] {
  const portion = Math.max(0, Math.round(input.portion))
  if (input.method === 'split') return (input.lines ?? []).filter((l) => l.amount > 0).map((l) => ({ ...l, amount: Math.round(l.amount), label: l.label.trim() || '수금' }))
  if (portion === 0) return []
  const paid = clamp(input.paidNow, 0, portion)
  const out: PlanLine[] = []
  const onContract: When = { kind: 'on_contract' }
  if (input.method === 'full_upfront') {
    if (paid > 0) out.push({ label: paid === portion ? '계약금(전액)' : '계약금', kind: 'deposit', amount: paid, when: onContract, receivedNow: true })
    if (portion - paid > 0) out.push({ label: paid > 0 ? '잔금' : '계약금(전액)', kind: 'deposit', amount: portion - paid, when: onContract, receivedNow: false })
    return out
  }
  if (input.method === 'upfront_rest') {
    if (paid > 0) out.push({ label: '계약금', kind: 'deposit', amount: paid, when: onContract, receivedNow: true })
    else if ((input.upfront ?? 0) > 0) out.push({ label: '계약금', kind: 'deposit', amount: clamp(input.upfront ?? 0, 0, portion), when: onContract, receivedNow: false })
    const planned = out.reduce((s, l) => s + l.amount, 0)
    if (portion - planned > 0) out.push({ label: '잔금', kind: 'interim', amount: portion - planned, when: input.rest ?? { kind: 'project_done' }, receivedNow: false })
    return out
  }
  // 정책자금 조달 후 받기 — 받은 돈이 있으면 착수금, 나머지는 성공보수(조건)
  if (paid > 0) out.push({ label: '착수금', kind: 'deposit', amount: paid, when: onContract, receivedNow: true })
  if (portion - paid > 0) out.push({ label: '성공보수', kind: 'success', amount: portion - paid, when: input.rest ?? { kind: 'funding_executed' }, receivedNow: false })
  return out
}

/** 받는 조건 한 줄 — 미리보기용 */
export function whenText(w: When): string {
  if (w.kind === 'date') return w.date ? `${Number(w.date.slice(5, 7))}월 ${Number(w.date.slice(8))}일` : '날짜 미정'
  if (w.kind === 'custom') return w.text?.trim() || '직접 적은 조건'
  return FEE_CONDITION_LABEL[w.kind]
}

function newId(): string {
  return `fee_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export interface SavePlanOptions {
  today: string
  /** 계약금액 — 계약 정보가 비어 있으면 이것으로 채운다 */
  total: number
  /** 사람이 계약금액을 골랐다(수금 항목이 없던 업체) → 계약 정보의 금액도 이것으로 */
  setTotal?: boolean
  signedAt?: string
  agentName?: string
  /** 영업자 수수료율(%) */
  agentRatePct?: number | null
  at?: string
}

/**
 * 저장 — 계약 정보(금액 · 계약일 · 현금) · 계약 단계(계약 전이면 계약 중으로) · 수금 항목.
 * 있는 수금 항목 · 입금 기록은 그대로 두고 새 줄만 더한다. 이름이 겹치면 '잔금 2' 처럼 번호를 붙인다.
 */
export function withContractPlan(record: ClientOpsRecord, lines: PlanLine[], o: SavePlanOptions): ClientOpsRecord {
  const at = o.at ?? new Date().toISOString()
  let next = record
  if (contractStageOf(record.status) === 'pre') {
    next = record.sales ? withSalesStage(next, 'contracted', at) : { ...next, status: 'active' }
  }
  const signedAt = /^\d{4}-\d{2}-\d{2}$/.test(o.signedAt ?? '') ? (o.signedAt as string) : next.contract.signedAt || o.today
  next = withContract(next, {
    ...next.contract,
    signedAt,
    kind: next.contract.kind || 'cash',
    cashAmount: o.setTotal && o.total > 0 ? o.total : next.contract.cashAmount !== null && next.contract.cashAmount > 0 ? next.contract.cashAmount : o.total > 0 ? o.total : null,
  })
  const taken = new Set(next.fees.map((f) => f.label))
  const rate = o.agentRatePct != null && o.agentRatePct > 0 ? o.agentRatePct : null
  const added: FeeItem[] = lines.map((l) => {
    let label = l.label
    for (let i = 2; taken.has(label); i++) label = `${l.label} ${i}`
    taken.add(label)
    const date = l.when.kind === 'date' && l.when.date && /^\d{4}-\d{2}-\d{2}$/.test(l.when.date) ? l.when.date : ''
    return {
      id: newId(),
      serviceKey: null,
      kind: l.kind,
      label,
      amount: l.amount,
      agentFee: rate !== null ? Math.round((l.amount * rate) / 100) : null,
      agentName: rate !== null ? (o.agentName ?? '').trim() : '',
      agentPaidAt: null,
      dueDate: date,
      receivedAt: l.receivedNow ? o.today : null,
      note: '계약 · 수금 한 번에',
      conditionKind: l.when.kind,
      ...(l.when.kind === 'custom' && l.when.text?.trim() ? { conditionText: l.when.text.trim().slice(0, 80) } : {}),
    }
  })
  if (added.length === 0) return next
  next = { ...next, fees: [...next.fees, ...added] }
  const sum = added.reduce((s, f) => s + (f.amount ?? 0), 0)
  const got = added.filter((f) => f.receivedAt).reduce((s, f) => s + (f.amount ?? 0), 0)
  return withActivity(next, 'fee_added', `수금 계획 ${added.length}개 · ${sum.toLocaleString('ko-KR')}원${got > 0 ? ` (오늘 입금 ${got.toLocaleString('ko-KR')}원)` : ''}`, null, at)
}
