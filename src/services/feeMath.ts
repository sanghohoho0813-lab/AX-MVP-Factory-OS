/**
 * 수금 계산 — 청구액과 '진짜 내 돈' 은 다르다.
 *
 * 성공보수 2,000만원을 받아도 그중 일부는 소개해 준 영업자에게 나간다.
 * 청구액만 보고 있으면 실제로 남는 돈을 늘 다시 계산하게 되고, 계산기를 두드리다
 * 틀린다. 항목마다 영업자 수수료를 적어 두면 실수령과 이익률이 저절로 따라온다.
 *
 * 저장하는 것은 청구액과 수수료 두 개뿐이다. 실수령·이익률은 **매번 계산한다** —
 * 저장하면 금액을 고쳤을 때 옛 이익률이 남는다.
 *
 * 순수 함수이므로 단위 시험으로 고정한다.
 */

import type { FeeItem } from '../types/clientOps'

export interface FeeMath {
  /** 청구액 — 고객에게 받기로 한 돈. 미정이면 null */
  gross: number | null
  /** 영업자에게 나갈 수수료 */
  agent: number
  /** 실수령 — 청구액에서 수수료를 뺀 것. 청구액이 미정이면 null */
  net: number | null
  /**
   * 이익률(%) — 실수령 ÷ 청구액.
   * 청구액이 없거나 0이면 null. 지어내지 않는다.
   */
  marginPct: number | null
}

/**
 * 항목 하나의 '내 몫' — 합계에 더할 때 쓴다.
 * 청구액이 미정이면 0 (세지 않는다). 화면 어디서든 돈을 더할 때는 이것을 쓴다 —
 * 청구액(`amount`)을 직접 더하면 영업자에게 나갈 돈까지 내 돈으로 센다.
 */
export function netAmountOf(fee: Pick<FeeItem, 'amount' | 'agentFee'>): number {
  return feeMathOf(fee).net ?? 0
}

/** 한 항목의 계산 */
export function feeMathOf(fee: Pick<FeeItem, 'amount' | 'agentFee'>): FeeMath {
  const gross = typeof fee.amount === 'number' && Number.isFinite(fee.amount) ? fee.amount : null
  const agent = typeof fee.agentFee === 'number' && Number.isFinite(fee.agentFee) && fee.agentFee > 0 ? fee.agentFee : 0
  const net = gross === null ? null : gross - agent
  return { gross, agent, net, marginPct: marginPct(gross, agent) }
}

/**
 * 이익률 — 소수점 한 자리까지.
 * 수수료가 청구액보다 크면 음수가 나온다. 그대로 보여 준다 — 손해도 사실이다.
 */
export function marginPct(gross: number | null, agent: number): number | null {
  if (gross === null || gross <= 0) return null
  return Math.round(((gross - agent) / gross) * 1000) / 10
}

/** '90%' · '87.5%' — 정수면 소수점을 붙이지 않는다 */
export function marginText(pct: number | null): string {
  if (pct === null) return ''
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`
}

export interface FeeTotals {
  /** 청구액 합계 (미정 제외) */
  gross: number
  /** 영업자 수수료 합계 */
  agent: number
  /** 실수령 합계 */
  net: number
  /** 전체 이익률 */
  marginPct: number | null
  /** 아직 못 받은 청구액 */
  unpaidGross: number
  /** 아직 못 받은 실수령 — '진짜 내가 받아야 할 돈' */
  unpaidNet: number
  /** 이미 받은 실수령 */
  receivedNet: number
  /** 금액을 아직 안 적은 항목 수 (합계에서 빠진다) */
  unknownCount: number
}

export function feeTotals(fees: FeeItem[]): FeeTotals {
  let gross = 0
  let agent = 0
  let unpaidGross = 0
  let unpaidNet = 0
  let receivedNet = 0
  let unknownCount = 0

  for (const f of fees) {
    const m = feeMathOf(f)
    if (m.gross === null) {
      unknownCount += 1
      continue
    }
    gross += m.gross
    agent += m.agent
    if (f.receivedAt === null) {
      unpaidGross += m.gross
      unpaidNet += m.net ?? 0
    } else {
      receivedNet += m.net ?? 0
    }
  }

  return {
    gross,
    agent,
    net: gross - agent,
    marginPct: marginPct(gross > 0 ? gross : null, agent),
    unpaidGross,
    unpaidNet,
    receivedNet,
    unknownCount,
  }
}

export interface AgentShare {
  /** 영업자 이름. 이름을 안 적은 수수료는 '이름 없음' 으로 묶인다 */
  name: string
  /** 그 사람에게 나갈 수수료 합계 */
  amount: number
}

/**
 * 영업자별로 나갈 돈 — "누구한테 얼마" 를 한 줄로.
 * 같은 이름(앞뒤 공백 무시)은 합치고, 많이 나가는 순으로 정렬한다. 수수료 0인 항목은 세지 않는다.
 */
export function agentShares(fees: Pick<FeeItem, 'agentFee' | 'agentName'>[]): AgentShare[] {
  const map = new Map<string, number>()
  for (const f of fees) {
    const amount = typeof f.agentFee === 'number' && Number.isFinite(f.agentFee) && f.agentFee > 0 ? f.agentFee : 0
    if (amount === 0) continue
    const name = (f.agentName ?? '').trim() || '이름 없음'
    map.set(name, (map.get(name) ?? 0) + amount)
  }
  return [...map.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'ko'))
}

/* ------------------------------------------------------------------ */
/* 영업자 정산 — 누구한테 지금 얼마를 줘야 하는가 (D-78)                  */
/* ------------------------------------------------------------------ */

/** 영업자 이름을 안 적은 수수료를 묶는 이름 */
export const UNNAMED_AGENT = '이름 없음'

export interface AgentLedgerItem {
  clientId: string
  clientName: string
  feeId: string
  /** 수금 항목 이름 (예: 성공보수) */
  label: string
  /** 청구액 — 미정이면 null */
  amount: number | null
  /** 이 항목에서 영업자에게 나갈 돈 */
  agentFee: number
  /** 고객이 입금한 날. 아직이면 null — 그 전에는 줄 돈이 아니다 */
  receivedAt: string | null
  /** 영업자에게 준 날. 아직이면 null */
  agentPaidAt: string | null
}

export interface AgentLedgerRow {
  name: string
  /** 이 사람에게 나갈 수수료 전부 */
  total: number
  /** 지금 줘야 할 돈 — 고객이 입금했는데 아직 안 준 것 */
  payable: number
  /** 이미 준 돈 */
  paid: number
  /** 아직 고객이 입금하지 않아 줄 때가 안 된 돈 */
  waiting: number
  items: AgentLedgerItem[]
}

/**
 * 영업자별 정산 장부.
 *
 * 돈이 나가는 순서는 하나다: 고객이 입금한다 → 영업자에게 준다.
 * 그래서 '줄 돈' 은 **고객 입금이 확인된 항목** 에서만 센다. 고객이 아직 안 준 돈을
 * 영업자에게 먼저 주는 일은 없어야 하므로, 그 몫은 `waiting` 으로 따로 둔다.
 *
 * 보관한 업체는 넣지 않는다. 수수료 0 인 항목도 넣지 않는다.
 * 줄 돈이 많은 사람이 위, 같으면 전체 수수료가 많은 사람, 그래도 같으면 가나다순.
 */
export function agentLedger(
  records: Pick<ClientOpsRecordLike, 'id' | 'companyName' | 'fees' | 'archivedAt'>[],
): AgentLedgerRow[] {
  const rows = new Map<string, AgentLedgerRow>()
  for (const r of records) {
    if (r.archivedAt !== null) continue
    for (const f of r.fees) {
      const agent = typeof f.agentFee === 'number' && Number.isFinite(f.agentFee) && f.agentFee > 0 ? f.agentFee : 0
      if (agent === 0) continue
      const name = (f.agentName ?? '').trim() || UNNAMED_AGENT
      const row = rows.get(name) ?? { name, total: 0, payable: 0, paid: 0, waiting: 0, items: [] }
      row.total += agent
      if (f.agentPaidAt) row.paid += agent
      else if (f.receivedAt) row.payable += agent
      else row.waiting += agent
      row.items.push({
        clientId: r.id,
        clientName: r.companyName,
        feeId: f.id,
        label: f.label,
        amount: f.amount,
        agentFee: agent,
        receivedAt: f.receivedAt,
        agentPaidAt: f.agentPaidAt,
      })
      rows.set(name, row)
    }
  }
  const stage = (i: AgentLedgerItem) => (i.agentPaidAt ? 2 : i.receivedAt ? 0 : 1)
  return [...rows.values()]
    .map((row) => ({
      ...row,
      // 줄 돈 → 기다리는 돈 → 준 돈 순. 같은 단계면 업체 이름순
      items: [...row.items].sort((a, b) => stage(a) - stage(b) || a.clientName.localeCompare(b.clientName, 'ko')),
    }))
    .sort((a, b) => b.payable - a.payable || b.total - a.total || a.name.localeCompare(b.name, 'ko'))
}

/** 장부 전체 합계 — 위 칸 네 개 */
export function agentLedgerTotals(rows: AgentLedgerRow[]): { total: number; payable: number; paid: number; waiting: number; agents: number } {
  return rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      payable: acc.payable + r.payable,
      paid: acc.paid + r.paid,
      waiting: acc.waiting + r.waiting,
      agents: acc.agents + 1,
    }),
    { total: 0, payable: 0, paid: 0, waiting: 0, agents: 0 },
  )
}

/** 장부가 필요한 만큼만 — 화면·시험이 통째 레코드를 만들지 않아도 되게 */
interface ClientOpsRecordLike {
  id: string
  companyName: string
  fees: Pick<FeeItem, 'id' | 'label' | 'amount' | 'agentFee' | 'agentName' | 'agentPaidAt' | 'receivedAt'>[]
  archivedAt: string | null
}
