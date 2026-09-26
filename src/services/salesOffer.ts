/**
 * 상품 · 제안 · 계약 준비 (D-114 3단계) — 고객 기록 ↔ 제안 규칙(salesProposal.js) 다리. 순수 함수.
 *
 *  - 상품표 가격은 원본 40종 그대로 시작하고(대표 결정 D-114 ④), 고친 가격만 따로 둔다(모듈 기록 sales-os/catalog).
 *  - 제안(고른 상품 · 합계 · 상태 · 월납)은 영업 칸 proposal 에, 계약 준비 체크는 contractPrep 에.
 *  - '계약 완료' 로 넘기면 영업 단계 · 계약 단계가 바뀌고, 고른 상품마다 수금 항목(계약금)이 생긴다.
 */

import type { ClientOpsRecord, FeeItem, SalesProposal } from '../types/clientOps'
import { emptySales } from '../types/clientOps'
import { localDateOf } from '../lib/appClock'
import { withActivity } from './clientOpsActivity'
import { salesStageOf, withSalesStage } from './salesPipeline'
import { toEngineItem } from './salesMeeting'
import { DEFAULT_PACKAGES, type ProposalItem, type SalesPackage } from './salesProposal'

/** 상품표 — 원본 40종에 고친 가격(만원)을 덮는다 */
export function catalogWithPrices(prices: Record<string, number> | null | undefined): SalesPackage[] {
  const p = prices ?? {}
  return DEFAULT_PACKAGES.map((pkg) => {
    const v = p[pkg.id]
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? { ...pkg, fee: v } : pkg
  })
}

/** 저장된 가격 표 정리 — 원본과 같은 값은 뺀다(원본이 바뀌면 따라가게) */
export function cleanPrices(prices: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const pkg of DEFAULT_PACKAGES) {
    const v = prices[pkg.id]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v !== pkg.fee) out[pkg.id] = Math.round(v)
  }
  return out
}

/** 고객 기록 → 제안 문서가 읽는 한 줄 (월납 제안 값 포함) */
export function toProposalItem(record: ClientOpsRecord, today: Date = new Date()): ProposalItem {
  const m = record.sales?.proposal?.monthly
  return {
    ...toEngineItem(record, today),
    ...(m ? { proposalMonthlyPremium: m.premium, proposalMonths: m.months, proposalRefundRate: m.rate } : {}),
    ...(m?.netIncome ? { netIncome: m.netIncome } : {}),
  }
}

/** 고른 상품 합계(만원) */
export function feeSum(pkgs: SalesPackage[]): number {
  return pkgs.reduce((s, p) => s + (Number(p.fee) || 0), 0)
}

/**
 * 제안 저장 — 고른 상품 · 합계 · 상태 · 월납. 예상 수임료(원)도 합계로 맞춘다.
 * 바뀐 것이 없으면 그대로 돌려준다.
 */
export function withProposal(
  record: ClientOpsRecord,
  next: Omit<SalesProposal, 'at'>,
  at: string = new Date().toISOString(),
): ClientOpsRecord {
  const base = record.sales ?? emptySales(salesStageOf(record), at)
  const prev = base.proposal
  const proposal: SalesProposal = { ...next, packages: [...new Set(next.packages)], at: localDateOf(at) }
  const same = prev && JSON.stringify({ ...prev, at: '' }) === JSON.stringify({ ...proposal, at: '' })
  if (same) return record
  const expectedFee = proposal.feeManwon > 0 ? proposal.feeManwon * 10_000 : base.expectedFee
  // D-122: 계약한 제안을 새 상품 제안(추가 계약)이 덮으면 지난 제안으로 옮긴다 — 예전에는 처음 계약 내용이 사라졌다
  const archive = prev && prev.status === '계약 완료' && prev.packages.join('|') !== proposal.packages.join('|')
  const pastProposals = archive ? [prev, ...(base.pastProposals ?? [])].slice(0, 10) : base.pastProposals
  const out = { ...record, sales: { ...base, proposal, expectedFee, ...(pastProposals ? { pastProposals } : {}) } }
  const bits = [proposal.status, proposal.packages.length ? `${proposal.packages.length}개 · ${proposal.feeManwon.toLocaleString('ko-KR')}만원` : '', proposal.monthly ? `월납 ${proposal.monthly.premium.toLocaleString('ko-KR')}만원` : '']
  return withActivity(out, 'sales', `제안 저장 — ${bits.filter(Boolean).join(' · ')}`, null, at)
}

/** 계약 준비 체크 켜고 끄기 */
export function withContractPrep(record: ClientOpsRecord, item: string, on: boolean, at: string = new Date().toISOString()): ClientOpsRecord {
  const base = record.sales ?? emptySales(salesStageOf(record), at)
  const cur = new Set(base.contractPrep ?? [])
  if (on === cur.has(item)) return record
  if (on) cur.add(item)
  else cur.delete(item)
  return { ...record, sales: { ...base, contractPrep: [...cur] } }
}

function newFeeId(): string {
  return `fee_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/**
 * 계약 완료 — 영업 단계 '계약 완료'(계약 단계도 따라감) + 고른 상품마다 수금 항목(계약금, 금액 = 상품표 가격).
 * 이미 같은 이름의 수금 항목이 있으면 만들지 않는다(두 번 눌러도 한 번).
 */
export function withContractFromProposal(record: ClientOpsRecord, pkgs: SalesPackage[], at: string = new Date().toISOString()): ClientOpsRecord {
  let next = withSalesStage(record, 'contracted', at)
  const have = new Set(next.fees.map((f) => f.label))
  const added: FeeItem[] = []
  for (const pkg of pkgs) {
    if (have.has(pkg.name)) continue
    added.push({
      id: newFeeId(),
      serviceKey: null,
      kind: 'deposit',
      label: pkg.name,
      amount: pkg.fee > 0 ? pkg.fee * 10_000 : null,
      agentFee: null,
      agentName: '',
      agentPaidAt: null,
      dueDate: '',
      receivedAt: null,
      note: '영업 관리 제안에서 계약',
    })
  }
  if (next.sales?.proposal) next = { ...next, sales: { ...next.sales, proposal: { ...next.sales.proposal, status: '계약 완료', at: localDateOf(at) } } }
  if (added.length === 0) return next
  next = { ...next, fees: [...next.fees, ...added] }
  const total = added.reduce((s, f) => s + (f.amount ?? 0), 0)
  return withActivity(next, 'fee_added', `수금 항목 추가 — 제안 상품 ${added.length}개${total > 0 ? ` ${total.toLocaleString('ko-KR')}원` : ''}`, null, at)
}
