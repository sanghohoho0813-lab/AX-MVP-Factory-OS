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
