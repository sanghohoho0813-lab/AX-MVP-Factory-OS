/**
 * 계약 완료 한 번에 (D-122) — 영업에서 '계약 완료' 를 누르면 계약 · 수금 · 영업자 · 업무까지 이어진다. 순수 함수.
 *
 * 예전에는 '계약 완료로' 가 수금 항목을 받을 날 · 영업자 없이 만들었고(달력 · 오늘 · 정산에 안 뜸),
 * 계약 카드(방식 · 현금 금액 · 보험)는 빈 채로, 업무는 하나도 시작되지 않았다. 게다가 보드 · 업체 상세에서
 * 계약 완료로 옮기면 수금 항목조차 생기지 않았다.
 *
 * 그래서 어디서 계약 완료를 누르든 같은 확인 시트(ContractCloseSheet)가 뜨고, 이미 아는 것으로 채워 둔다.
 *   - 계약일 = 오늘 · 받을 날 = 계약일 + 7일
 *   - 수금 항목 = 제안 상품마다(없으면 예상 수임료 한 줄)
 *   - 영업자 = 소개한 사람(sales.referrer) · 수수료율 = 그 사람과 예전에 쓴 율
 *   - 계약 방식 = 계약 경로(현금 → 현금 · 법인보험 → 보험 · 종합 → 현금 + 보험) · 현금 금액 = 합계
 *   - 보험 = 제안의 월납(만원 → 원)
 *   - 시작할 업무 = 상품 이름으로 짐작(법인설립 · 업종 · 특허 · 벤처 · AX · 정책자금)
 * 사람이 확인하고 누른다 — 짐작은 짐작일 뿐 저절로 저장하지 않는다.
 */

import type { ClientOpsRecord, ContractKind, FeeItem, InsurancePolicy, SalesPath, ServiceKey } from '../types/clientOps'
import { localDateOf } from '../lib/appClock'
import { withActivity } from './clientOpsActivity'
import { withContract, withService } from './clientOpsService'
import { withSalesStage } from './salesPipeline'
import { addDaysLocal } from './clientOpsNextAction'

export interface ContractCloseLine {
  label: string
  /** 원 */
  amount: number | null
}

export interface ContractCloseDraft {
  signedAt: string
  /** 받을 날(첫 수금) */
  dueDate: string
  kind: ContractKind | ''
  lines: ContractCloseLine[]
  agentName: string
  /** 영업자 수수료율(%) — 비우면 수수료 없음 */
  agentRatePct: number | null
  /** 월납 보험료(원) — 제안의 월납에서 */
  monthlyPremium: number | null
  /** 시작할 업무 */
  services: ServiceKey[]
}

/** 계약 경로 → 계약 방식 */
export const PATH_TO_KIND: Record<SalesPath, ContractKind> = { cash: 'cash', insurance: 'insurance', total: 'mixed', step: 'cash' }

/** 상품 이름 낱말 → 업무 (기본 6가지만 — 직접 만든 업무는 사람이 고른다) */
const SERVICE_WORDS: [ServiceKey, RegExp][] = [
  ['incorporation', /법인\s*설립|법인\s*전환/],
  ['businessScope', /업종|목적\s*사항|정관/],
  ['patent', /특허|상표|지식\s*재산|디자인\s*등록/],
  ['venture', /벤처|이노비즈|메인비즈/],
  ['ax', /\bAX\b|자동화|AI|인공지능|홈페이지|앱|MVP/i],
  ['policyFund', /정책\s*자금|지원\s*금|지원\s*사업|보증|R&D|바우처/],
]

export function servicesForProducts(names: string[]): ServiceKey[] {
  const out: ServiceKey[] = []
  for (const [key, re] of SERVICE_WORDS) if (names.some((n) => re.test(n))) out.push(key)
  return out
}

/** 이 사람과 예전에 쓴 수수료율(%) — 금액 · 수수료가 둘 다 있는 항목들의 가운데 값. 없으면 null */
export function agentRateOf(records: ClientOpsRecord[], agentName: string): number | null {
  const name = agentName.trim()
  if (!name) return null
  const rates = records
    .flatMap((r) => r.fees)
    .filter((f) => f.agentName.trim() === name && (f.amount ?? 0) > 0 && (f.agentFee ?? 0) > 0)
    .map((f) => ((f.agentFee as number) / (f.amount as number)) * 100)
    .sort((a, b) => a - b)
  if (rates.length === 0) return null
  const mid = rates[Math.floor(rates.length / 2)]
  return Math.round(mid * 10) / 10
}

/** 확인 시트에 채워 둘 값 */
export function contractCloseDraft(
  record: ClientOpsRecord,
  opts: { today: string; products?: { name: string; fee: number }[]; records?: ClientOpsRecord[] },
): ContractCloseDraft {
  const s = record.sales
  const products = opts.products ?? []
  const lines: ContractCloseLine[] =
    products.length > 0
      ? products.map((p) => ({ label: p.name, amount: p.fee > 0 ? p.fee * 10_000 : null }))
      : s?.expectedFee
        ? [{ label: '계약금', amount: s.expectedFee }]
        : [{ label: '계약금', amount: null }]
  const agentName = (s?.referrer ?? '').trim()
  const monthly = s?.proposal?.monthly
  const kindFromPath = s?.path ? PATH_TO_KIND[s.path] : ''
  const kind: ContractKind | '' = record.contract.kind || kindFromPath || (monthly ? 'mixed' : '')
  const names = [...products.map((p) => p.name), ...(s?.proposal?.packages ?? []), ...(s?.interests ?? [])]
  return {
    signedAt: record.contract.signedAt || opts.today,
    dueDate: addDaysLocal(opts.today, 7),
    kind,
    lines,
    agentName,
    agentRatePct: agentName ? agentRateOf(opts.records ?? [record], agentName) : null,
    monthlyPremium: monthly?.premium ? monthly.premium * 10_000 : null,
    services: servicesForProducts(names).filter((k) => record.services[k]?.status === 'not_started' || record.services[k] === undefined),
  }
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/**
 * 확인한 대로 저장 — 영업 단계 계약 완료(계약 단계도) · 계약 정보 · 수금 항목(받을 날 · 영업자 · 수수료) ·
 * 보험 한 줄 · 업무 시작 · 제안 상태. 같은 이름의 수금 항목이 이미 있으면 새로 만들지 않는다(두 번 눌러도 한 번).
 */
export function withContractClose(record: ClientOpsRecord, d: ContractCloseDraft, at: string = new Date().toISOString()): ClientOpsRecord {
  let next = withSalesStage(record, 'contracted', at)
  const signedAt = /^\d{4}-\d{2}-\d{2}$/.test(d.signedAt) ? d.signedAt : localDateOf(at)

  // 계약 정보 — 현금 금액은 수금 합계, 보험은 월납 한 줄(이미 같은 월납 보험이 있으면 더하지 않는다)
  const total = d.lines.reduce((sum, l) => sum + (l.amount ?? 0), 0)
  const wantsCash = d.kind === 'cash' || d.kind === 'mixed' || d.kind === ''
  const wantsIns = d.kind === 'insurance' || d.kind === 'mixed'
  const policies: InsurancePolicy[] = [...next.contract.policies]
  if (wantsIns && d.monthlyPremium && !policies.some((p) => p.monthlyPremium === d.monthlyPremium)) {
    policies.push({ id: newId('pol'), insurer: '', productName: '법인보험(제안 월납)', monthlyPremium: d.monthlyPremium, startedAt: signedAt, payTerm: '', note: '영업 제안의 월납에서' })
  }
  next = withContract(next, {
    ...next.contract,
    signedAt,
    kind: d.kind,
    cashAmount: wantsCash ? (next.contract.cashAmount ?? (total > 0 ? total : null)) : next.contract.cashAmount,
    policies,
  })

  // 수금 항목
  const have = new Set(next.fees.map((f) => f.label))
  const rate = d.agentRatePct !== null && d.agentRatePct > 0 ? d.agentRatePct : null
  const added: FeeItem[] = []
  for (const l of d.lines) {
    const label = l.label.trim() || '계약금'
    if (have.has(label)) continue
    have.add(label)
    added.push({
      id: newId('fee'),
      serviceKey: null,
      kind: 'deposit',
      label,
      amount: l.amount,
      agentFee: rate !== null && l.amount ? Math.round((l.amount * rate) / 100) : null,
      agentName: rate !== null ? d.agentName.trim() : '',
      agentPaidAt: null,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(d.dueDate) ? d.dueDate : '',
      receivedAt: null,
      note: '계약 완료에서',
    })
  }
  if (added.length > 0) {
    next = { ...next, fees: [...next.fees, ...added] }
    const sum = added.reduce((s, f) => s + (f.amount ?? 0), 0)
    next = withActivity(next, 'fee_added', `수금 항목 ${added.length}개${sum > 0 ? ` ${sum.toLocaleString('ko-KR')}원` : ''}${d.dueDate ? ` · 받을 날 ${d.dueDate}` : ''}${rate !== null && d.agentName ? ` · 영업자 ${d.agentName} ${rate}%` : ''}`, null, at)
  }

  // 업무 시작
  for (const key of d.services) {
    if (!next.services[key] || next.services[key].status !== 'not_started') continue
    next = withService(next, key, { status: 'in_progress' })
  }

  // 제안 상태
  if (next.sales?.proposal) next = { ...next, sales: { ...next.sales, proposal: { ...next.sales.proposal, status: '계약 완료', at: localDateOf(at) } } }
  return next
}

/**
 * 계약 현금 금액 vs 수금 항목 합계 (D-122) — 같은 돈이 세 곳(예상 수임료 · 계약 현금 · 수금 항목)에 따로 적혀
 * 서로 어긋나도 알 길이 없었다. 계약 현금 금액이 있고 수금 합계와 다르면 차이를 돌려준다(같으면 null).
 */
export function contractGap(record: ClientOpsRecord): { cash: number; fees: number; gap: number } | null {
  const cash = record.contract.cashAmount
  if (cash === null || cash <= 0) return null
  const fees = record.fees.reduce((sum, f) => sum + (f.amount ?? 0), 0)
  const gap = cash - fees
  return gap === 0 ? null : { cash, fees, gap }
}
