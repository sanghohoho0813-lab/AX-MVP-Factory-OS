/**
 * D-479 오늘 화면 '확인할 것' — 업체가 적으면(60곳 이하) 예전처럼 바로 계산, 많으면 12ms씩 끊어 계산한 뒤 한 번에 보여 준다.
 * 계산 결과는 업체별로 기억한다(services/decisions.ts) — 숫자 띠와 목록이 같은 결과를 쓴다.
 * 다 모이기 전에는 null(목록 칸은 아직 그리지 않는다 — '없음' 으로 잘못 보이지 않게).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { GrantNotice } from '../../services/grants/grantMatch'
import type { Decision } from '../../services/decisions'

/*
 * D-481 판정 엔진(decisions → clientInsights · 정책자금 · 인증 · 절세)은 화면이 뜬 뒤 따로 받는다 — 오늘 화면 첫 그림이 이것을 기다리지 않게.
 * 한 번 받으면 다음부터는 바로(받기 전에는 '모으는 중' 과 같다 — 목록 칸을 그리지 않는다).
 */
type Engine = typeof import('../../services/decisions')
let engine: Engine | null = null
const loadEngine = () =>
  import('../../services/decisions').then((m) => {
    engine = m
    return m
  })

/** 이만큼까지는 바로 계산(대표 · 팀장 실제 업체 수 — 화면 · 시험이 예전과 같다) */
export const DECISION_SYNC_MAX = 60
const SLICE_MS = 12
/** 다 모이기 전 · 없을 때 쓰는 빈 목록(매번 새 배열을 만들지 않게) */
export const NO_DECISIONS: Decision[] = []

export function useAllDecisions(clients: readonly ClientOpsRecord[], today: string, notices: readonly GrantNotice[], usable: (key: string) => boolean): Decision[] | null {
  return useAllDecisionsState(clients, today, notices, usable).list
}

/**
 * 확인할 것 모두 보기 화면용 — pending 이면 아직 모으는 중(빈 목록이어도 '없음' 이라고 하지 않는다).
 * list 는 다 모인 목록, 모으는 중이면 직전 목록(없으면 null).
 */
export function useAllDecisionsState(
  clients: readonly ClientOpsRecord[],
  today: string,
  notices: readonly GrantNotice[],
  usable: (key: string) => boolean,
): { list: Decision[] | null; pending: boolean } {
  const [eng, setEng] = useState<Engine | null>(engine)
  useEffect(() => {
    if (eng) return
    let alive = true
    void loadEngine().then((m) => {
      if (alive) setEng(m)
    })
    return () => {
      alive = false
    }
  }, [eng])
  const [tick, setTick] = useState(0)
  const missing = useMemo(() => {
    void tick
    return eng ? eng.missingDecisionCount(clients, today, notices, usable) : Number.POSITIVE_INFINITY
  }, [eng, clients, today, notices, usable, tick])
  const list = useMemo(() => (eng && missing <= DECISION_SYNC_MAX ? eng.buildAllDecisions(clients, today, notices, usable) : null), [eng, missing, clients, today, notices, usable])
  // 공고 · 권한이 늦게 들어와 다시 계산하는 동안은 직전 목록을 그대로(칸이 사라졌다 나타나지 않게)
  const last = useRef<Decision[] | null>(null)
  if (list) last.current = list
  useEffect(() => {
    if (!eng || missing <= DECISION_SYNC_MAX) return
    let alive = true
    let handle = 0
    const step = () => {
      if (!alive) return
      const left = eng.warmDecisions(clients, today, notices, usable, SLICE_MS)
      if (left > 0) handle = window.setTimeout(step, 0)
      else setTick((t) => t + 1)
    }
    handle = window.setTimeout(step, 0)
    return () => {
      alive = false
      window.clearTimeout(handle)
    }
  }, [eng, missing, clients, today, notices, usable])
  return { list: list ?? last.current, pending: list === null }
}
