/**
 * D-479 오늘 화면 '확인할 것' — 업체가 적으면(60곳 이하) 예전처럼 바로 계산, 많으면 12ms씩 끊어 계산한 뒤 한 번에 보여 준다.
 * 계산 결과는 업체별로 기억한다(services/decisions.ts) — 숫자 띠와 목록이 같은 결과를 쓴다.
 * 다 모이기 전에는 null(목록 칸은 아직 그리지 않는다 — '없음' 으로 잘못 보이지 않게).
 */
import { useEffect, useMemo, useState } from 'react'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { GrantNotice } from '../../services/grants/grantMatch'
import { buildAllDecisions, missingDecisionCount, warmDecisions, type Decision } from '../../services/decisions'

/** 이만큼까지는 바로 계산(대표 · 팀장 실제 업체 수 — 화면 · 시험이 예전과 같다) */
export const DECISION_SYNC_MAX = 60
const SLICE_MS = 12
/** 다 모이기 전 · 없을 때 쓰는 빈 목록(매번 새 배열을 만들지 않게) */
export const NO_DECISIONS: Decision[] = []

export function useAllDecisions(clients: readonly ClientOpsRecord[], today: string, notices: readonly GrantNotice[], usable: (key: string) => boolean): Decision[] | null {
  const [tick, setTick] = useState(0)
  const missing = useMemo(() => {
    void tick
    return missingDecisionCount(clients, today, notices, usable)
  }, [clients, today, notices, usable, tick])
  const list = useMemo(() => (missing <= DECISION_SYNC_MAX ? buildAllDecisions(clients, today, notices, usable) : null), [missing, clients, today, notices, usable])
  useEffect(() => {
    if (missing <= DECISION_SYNC_MAX) return
    let alive = true
    let handle = 0
    const step = () => {
      if (!alive) return
      const left = warmDecisions(clients, today, notices, usable, SLICE_MS)
      if (left > 0) handle = window.setTimeout(step, 0)
      else setTick((t) => t + 1)
    }
    handle = window.setTimeout(step, 0)
    return () => {
      alive = false
      window.clearTimeout(handle)
    }
  }, [missing, clients, today, notices, usable])
  return list
}
