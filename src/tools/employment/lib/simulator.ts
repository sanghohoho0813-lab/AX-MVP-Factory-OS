/**
 * 수령액 시뮬레이터 — 인원 × 입사일 → 월별 현금흐름 (D-91).
 *
 * 원본(SubsidyApp.jsx 744줄 Simulator)의 계산을 그대로 옮겼다:
 * 사람 수만큼 회차표를 돌려 `입사일 + n개월` 이 속한 달에 금액을 더한다.
 * 같은 달에 여러 회차가 겹치면 합쳐서 한 줄로 보여 준다.
 */

import { addMo } from './dates'
import type { Program } from './programs'

export interface SimMonth {
  /** YYYY-MM */
  month: string
  amount: number
  /** 그 달에 걸린 회차 수 */
  count: number
}

export interface SimResult {
  monthly: SimMonth[]
  total: number
  perPerson: number
}

export function simulate(program: Pick<Program, 'rounds' | 'totalAmount'> | undefined, count: number, startDate: string): SimResult {
  if (!program || !Number.isFinite(count) || count <= 0) return { monthly: [], total: 0, perPerson: 0 }
  const start = startDate || new Date().toISOString().split('T')[0]
  const monthly: SimMonth[] = []
  let total = 0
  for (let i = 0; i < count; i += 1) {
    for (const r of program.rounds ?? []) {
      const ym = addMo(start, r.month).substring(0, 7)
      const found = monthly.find((m) => m.month === ym)
      if (found) {
        found.amount += r.amount
        found.count += 1
      } else {
        monthly.push({ month: ym, amount: r.amount, count: 1 })
      }
      total += r.amount
    }
  }
  monthly.sort((a, b) => a.month.localeCompare(b.month))
  return { monthly, total, perPerson: program.totalAmount || 0 }
}

/** 상담용 한 줄 요약 — 원본의 '복사' 문구와 같은 뜻 */
export function simulationText(programName: string, count: number, result: SimResult): string {
  if (result.monthly.length === 0) return ''
  const first = result.monthly[0]
  const last = result.monthly[result.monthly.length - 1]
  return [
    `${programName} · ${count}명 기준`,
    `예상 총 수령액 ${result.total.toLocaleString()}원 (1인당 최대 ${result.perPerson.toLocaleString()}원)`,
    `수령 기간 ${first.month} ~ ${last.month}`,
    '규칙표 기준 1차 계산이며 운영기관 심사 결과에 따라 달라질 수 있습니다.',
  ].join('\n')
}
