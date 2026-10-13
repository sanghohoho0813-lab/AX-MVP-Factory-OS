/**
 * 고객 관리 카드 추천 띠 · '추천 많은 순' (D-190).
 *
 * 판정 엔진(정책자금 · 창업감면 · 기업인증 …)은 목록 첫 화면과 따로 받는다 — 목록은 바로 뜨고, 띠는 곧이어 붙는다.
 * 지원사업은 목록이 이미 한 번에 센 '맞는 공고 수' 를 쓴다(업체마다 공고를 다시 대 보지 않는다).
 */
import { useEffect, useMemo, useState } from 'react'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { RecoChip } from '../../services/clientInsights'
import { useEntitlements } from '../../lib/entitlementsStore'

type Engine = typeof import('../../services/clientInsights')
let loaded: Engine | null = null

export interface ClientReco {
  chips: Map<string, RecoChip[]>
  scores: Map<string, number>
  ready: boolean
}

export function useClientReco(records: readonly ClientOpsRecord[], today: string, grantFit: (id: string) => number): ClientReco {
  const [engine, setEngine] = useState<Engine | null>(loaded)
  const { ent } = useEntitlements()
  useEffect(() => {
    if (loaded) return
    let alive = true
    void import('../../services/clientInsights').then((m) => {
      loaded = m
      if (alive) setEngine(m)
    })
    return () => {
      alive = false
    }
  }, [])
  return useMemo(() => {
    const chips = new Map<string, RecoChip[]>()
    const scores = new Map<string, number>()
    const usable = (key: string) => key === 'grants' || ent.feature(key).usable
    for (const r of records) {
      let list: RecoChip[]
      try {
        list = engine ? engine.cardRecoChips(r, today, grantFit(r.id), usable) : grantFit(r.id) > 0 ? [{ key: 'grants', label: `지원사업 ${grantFit(r.id)}건`, tone: 'good' }] : []
      } catch {
        // 한 업체 값이 엔진을 넘어뜨려도 목록은 그대로
        list = []
      }
      chips.set(r.id, list)
      scores.set(r.id, list.reduce((s, c) => s + (c.tone === 'good' ? 2 : 1), 0))
    }
    return { chips, scores, ready: engine !== null }
  }, [engine, records, today, grantFit, ent])
}
