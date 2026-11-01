/**
 * 고객 관리 카드 추천 띠 · '추천 많은 순' (D-190).
 *
 * 판정 엔진(정책자금 · 창업감면 · 기업인증 …)은 목록 첫 화면과 따로 받는다 — 목록은 바로 뜨고, 띠는 곧이어 붙는다.
 * 지원사업은 목록이 이미 한 번에 센 '맞는 공고 수' 를 쓴다(업체마다 공고를 다시 대 보지 않는다).
 *
 * D-479 업체가 많을 때(1,000곳 기준 목록 2.9초 · 그중 2.4초 화면 멈춤 — 업체마다 판정 엔진 전체를 돌렸다):
 *  - 업체별 모듈 판정을 기억한다 — 기록 · 오늘 날짜 · 권한이 그대로면 다시 계산하지 않는다(오늘 화면 ↔ 고객 관리가 같이 쓴다).
 *    '지원사업 n건' 은 공고 수가 늦게 들어와도 판정을 다시 돌리지 않고 얹기만 한다(withGrantChip — cardRecoChips 마지막 단계와 같음).
 *  - 처음 계산은 짧게 끊어서(한 번에 12ms) — 그 사이 화면은 움직이고, 다 되면 띠가 한 번에 붙는다(새로 계산할 업체가 60곳 이하면 예전처럼 바로).
 *  판정 엔진 · 계산식은 그대로다(부르는 횟수 · 때만 바뀐다).
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

interface Memo {
  rec: ClientOpsRecord
  sig: string
  ctx: string
  chips: RecoChip[]
}

/** 업체 id → 마지막 계산(기록이 같고 ctx 가 같을 때만 다시 쓴다) */
const memo = new Map<string, Memo>()
/** 권한 묶음(ent)마다 번호 — 권한이 바뀌면 ctx 가 달라져 다시 계산 */
const entIds = new WeakMap<object, number>()
let entSeq = 0
const entIdOf = (ent: object) => {
  let id = entIds.get(ent)
  if (id === undefined) {
    id = ++entSeq
    entIds.set(ent, id)
  }
  return id
}

const sigOf = (r: ClientOpsRecord) => {
  try {
    return JSON.stringify(r)
  } catch {
    return `${r.id}|${r.updatedAt}|${Math.random()}`
  }
}

/** 기록은 같은데 날짜 · 권한이 바뀌어 다시 계산할 띠 — 다시 계산하는 동안 깜빡이지 않게 직전 것을 보여 준다 */
function staleChips(r: ClientOpsRecord): RecoChip[] | undefined {
  const m = memo.get(r.id)
  if (!m) return undefined
  return m.rec === r || m.sig === sigOf(r) ? m.chips : undefined
}

/** 기억해 둔 띠 — 없거나 낡았으면 undefined */
function remembered(r: ClientOpsRecord, ctx: string): RecoChip[] | undefined {
  const m = memo.get(r.id)
  if (!m || m.ctx !== ctx) return undefined
  if (m.rec === r) return m.chips
  const sig = sigOf(r)
  if (sig !== m.sig) return undefined
  m.rec = r // 같은 내용의 새 객체(저장소를 다시 읽음) — 다음엔 바로 맞는다
  return m.chips
}

function computeChips(engine: Engine, r: ClientOpsRecord, today: string, usable: (key: string) => boolean, ctx: string): RecoChip[] {
  let list: RecoChip[]
  try {
    // 모듈 판정만(공고 0) — 공고 칩은 모을 때 얹는다
    list = engine.cardRecoChips(r, today, 0, usable)
  } catch {
    // 한 업체 값이 엔진을 넘어뜨려도 목록은 그대로
    list = []
  }
  memo.set(r.id, { rec: r, sig: sigOf(r), ctx, chips: list })
  return list
}

const grantOnly = (fit: number): RecoChip[] => (fit > 0 ? [{ key: 'grants', label: `지원사업 ${fit}건`, tone: 'good' }] : [])
const scoreOf = (list: RecoChip[]) => list.reduce((s, c) => s + (c.tone === 'good' ? 2 : 1), 0)

/** 한 번에 이만큼만 계산하고 화면에 차례를 넘긴다 */
const SLICE_MS = 12
/** 이만큼까지는 바로 계산(대표 · 팀장 실제 업체 수 — 화면 · 시험이 예전과 같다) */
const SYNC_MAX = 60

export function useClientReco(records: readonly ClientOpsRecord[], today: string, grantFit: (id: string) => number): ClientReco {
  const [engine, setEngine] = useState<Engine | null>(loaded)
  const { ent } = useEntitlements()
  const [tick, setTick] = useState(0)
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

  const result = useMemo(() => {
    void tick // 계산이 끝나면 다시 모은다
    const chips = new Map<string, RecoChip[]>()
    const scores = new Map<string, number>()
    const ctx = `${today}|${entIdOf(ent)}`
    const usable = (key: string) => key === 'grants' || ent.feature(key).usable
    // 업체가 적으면(60곳 이하) 예전처럼 바로 계산 — 많을 때만 아래에서 나눠 계산한다
    if (engine) {
      const todo = records.filter((r) => remembered(r, ctx) === undefined)
      if (todo.length > 0 && todo.length <= SYNC_MAX) for (const r of todo) computeChips(engine, r, today, usable, ctx)
    }
    let missing = 0
    for (const r of records) {
      const fit = grantFit(r.id)
      const mods = engine ? remembered(r, ctx) : undefined
      let list: RecoChip[]
      if (mods === undefined || !engine) {
        if (engine) missing++
        const stale = engine ? staleChips(r) : undefined
        list = stale && engine ? engine.withGrantChip(stale, fit, usable) : grantOnly(fit)
      } else {
        list = engine.withGrantChip(mods, fit, usable)
      }
      chips.set(r.id, list)
      scores.set(r.id, scoreOf(list))
    }
    return { chips, scores, ready: engine !== null && missing === 0, missing }
  }, [engine, records, today, grantFit, ent, tick])

  const missing = result.missing
  useEffect(() => {
    if (!engine || missing === 0) return
    let alive = true
    let handle = 0
    const ctx = `${today}|${entIdOf(ent)}`
    const usable = (key: string) => key === 'grants' || ent.feature(key).usable
    const todo = records.slice()
    let i = 0
    const step = () => {
      if (!alive) return
      const t0 = performance.now()
      while (i < todo.length && performance.now() - t0 < SLICE_MS) {
        const r = todo[i++]
        if (remembered(r, ctx) === undefined) computeChips(engine, r, today, usable, ctx)
      }
      if (i < todo.length) handle = window.setTimeout(step, 0)
      else setTick((t) => t + 1)
    }
    handle = window.setTimeout(step, 0)
    return () => {
      alive = false
      window.clearTimeout(handle)
    }
  }, [engine, missing, records, today, ent])

  return useMemo(() => ({ chips: result.chips, scores: result.scores, ready: result.ready }), [result])
}
