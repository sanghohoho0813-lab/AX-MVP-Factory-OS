/**
 * 정책자금 상담 기록 (D-91).
 *
 * 원본(policy-funding-os)은 고객 명단을 따로 들고 있었다. 여기서는 만들지 않는다 —
 * 업체는 고객 운영 하나뿐이고, 이 모듈은 그 업체의 **상담 상태**만 쌓는다.
 *
 * 저장: moduleData 의 `policy-funding` 상자, `consults` 갈래.
 */

import type { CustomerStage } from '../types'
import { CUSTOMER_STAGES } from '../types'

export interface ConsultData extends Record<string, unknown> {
  stage: CustomerStage
  /** 다음에 할 일 한 줄 */
  nextAction: string
  /** 마지막으로 연락한 날 YYYY-MM-DD */
  lastContactedAt: string
  memo: string
  /** 진단에서 나온 1순위 기관 (없으면 빈 글자) */
  topAgency: string
  /** 진단 점수 (없으면 null) */
  score: number | null
}

export function emptyConsult(): ConsultData {
  return { stage: '신규 DB', nextAction: '', lastContactedAt: '', memo: '', topAgency: '', score: null }
}

export function isStage(v: unknown): v is CustomerStage {
  return typeof v === 'string' && (CUSTOMER_STAGES as readonly string[]).includes(v)
}

/** 아직 살아 있는 상담인가 (실패·승인으로 끝난 것은 뺀다) */
export function isOpenStage(stage: CustomerStage): boolean {
  return stage !== '승인' && stage !== '실패'
}

/** 며칠째 연락이 없는가 (연락한 적 없으면 null) */
export function daysSinceContact(lastContactedAt: string, today: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastContactedAt)) return null
  const then = new Date(`${lastContactedAt}T00:00:00`)
  if (Number.isNaN(then.getTime())) return null
  const t = new Date(today)
  t.setHours(0, 0, 0, 0)
  return Math.floor((t.getTime() - then.getTime()) / 86400000)
}

export interface ConsultSummary {
  /** 단계별 수 */
  byStage: Record<string, number>
  open: number
  approved: number
  failed: number
  /** 2주 넘게 연락 없는 살아 있는 상담 */
  stale: number
}

export function summarizeConsults(
  rows: readonly { stage: CustomerStage; lastContactedAt: string }[],
  today: Date,
  staleDays = 14,
): ConsultSummary {
  const byStage: Record<string, number> = {}
  let open = 0
  let approved = 0
  let failed = 0
  let stale = 0
  for (const r of rows) {
    byStage[r.stage] = (byStage[r.stage] ?? 0) + 1
    if (r.stage === '승인') approved += 1
    else if (r.stage === '실패') failed += 1
    else {
      open += 1
      const d = daysSinceContact(r.lastContactedAt, today)
      if (d === null || d >= staleDays) stale += 1
    }
  }
  return { byStage, open, approved, failed, stale }
}
