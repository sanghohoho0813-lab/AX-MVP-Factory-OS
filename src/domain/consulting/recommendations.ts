/**
 * 시스템이 먼저 의견을 낸다 (§5).
 *
 * "이 회사로 벤처인증을 진행할 수 있을까요?" 를 사용자에게 그냥 묻지 않는다.
 * 지금 가진 사실로 판단할 수 있는 만큼만 추천하고 **왜 그렇게 봤는지**를 함께 보여 준다.
 *
 * 규칙 계산이다. AI 판단이 아니고, 점수를 지어내지도 않는다(§54).
 * 근거가 모자라면 추천하지 않고 `null` 을 돌려준다 — 그때는 사용자가 고른다.
 */

import type { ConsultingProject, GateDecision } from '../../types/consulting'
import { KIPO_REFERENCES, KIPO_SYSTEM_STARTERS, kipoByCode } from './kipoReferences'
import { clip, subjectParticle } from './koreanText'

export interface Recommendation<T> {
  value: T
  /** 화면에 그대로 보여 줄 한 줄 이유들 */
  reasons: string[]
}

function fact(p: ConsultingProject, key: keyof ConsultingProject['factsheet']): string {
  return (p.factsheet[key]?.value ?? '').trim()
}

function filled(p: ConsultingProject, key: keyof ConsultingProject['factsheet']): boolean {
  return fact(p, key) !== ''
}

/* ------------------------------------------------------------------ */
/* S1 진행 판단                                                          */
/* ------------------------------------------------------------------ */

/**
 * 진행할 만한가 — 사실이 얼마나 갖춰졌는지로만 본다.
 *
 *   현장문제 · 고객/거래처 · 핵심기술 후보 세 가지가 이 판단의 뼈대다.
 *   문제와 고객이 다 있으면 '진행'. 하나라도 비면 '보강 후 진행'.
 *   문제 자체가 없으면 아직 추천하지 않는다(사람이 판단할 일이다).
 *
 * NO-GO 는 추천하지 않는다. 사람이 회사를 보고 내리는 결정이지 규칙이 낼 답이 아니다.
 */
export function recommendGate(p: ConsultingProject): Recommendation<GateDecision> | null {
  const problem = fact(p, 'coreProblem')
  if (problem === '') return null

  const has = {
    customers: filled(p, 'customers') || filled(p, 'accounts'),
    method: filled(p, 'currentMethod'),
    market: filled(p, 'som') || filled(p, 'sam'),
  }
  const reasons: string[] = []
  reasons.push(`풀려는 현장문제가 정리돼 있습니다 — ${clip(problem, 45)}`)

  const missing: string[] = []
  if (!has.customers) missing.push('실제 고객·거래처 수')
  if (!has.method) missing.push('지금은 어떻게 하고 있는지')
  if (!has.market) missing.push('시장 규모 근거')

  if (missing.length === 0) {
    reasons.push('고객 · 기존방식 · 시장 근거가 모두 있습니다.')
    return { value: 'go', reasons }
  }
  reasons.push(`아직 확인하지 않은 것: ${missing.join(' · ')}`)
  reasons.push('이것들은 뒤 단계에서 채워도 됩니다 — 지금 멈출 이유는 아닙니다.')
  // 고객이 있으면 진행, 고객까지 없으면 보강 후 진행
  return has.customers ? { value: 'go', reasons } : { value: 'hold', reasons }
}

/* ------------------------------------------------------------------ */
/* S5 참고자료 (KIPO)                                                    */
/* ------------------------------------------------------------------ */

/** 낱말 겹침으로 분야를 고른다 — 검색과 같은 방식, 점수를 만들지 않는다 */
function overlap(hay: string, words: string[]): number {
  const low = hay.toLowerCase()
  return words.filter((w) => w.length >= 2 && low.includes(w)).length
}

/**
 * 118종에서 사람이 직접 찾게 하지 않는다 (§27).
 * 현장문제·핵심기술의 낱말과 겹치는 사례를 고르고, 겹치는 것이 없으면
 * 시스템·플랫폼 발명의 기본 참고 4종에서 2개를 준다.
 */
export function recommendKipo(p: ConsultingProject, count = 2): Recommendation<string[]> | null {
  const source = `${fact(p, 'coreProblem')} ${fact(p, 'coreTech')} ${p.coreThread.patentPoint}`.trim()
  if (source === '') return null
  const words = source
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/)
    .filter((w) => w.length >= 2)

  const scored = KIPO_REFERENCES.map((r) => ({ r, n: overlap(`${r.field} ${r.title}`, words) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.r.code.localeCompare(b.r.code))

  const already = new Set(p.kipo.map((s) => s.code))
  const picked: { code: string; why: string }[] = []
  for (const x of scored) {
    if (picked.length >= count || already.has(x.r.code)) continue
    picked.push({ code: x.r.code, why: `${subjectParticle(x.r.field)} 지금 기술과 가깝습니다` })
  }
  if (picked.length < count) {
    for (const code of KIPO_SYSTEM_STARTERS) {
      if (picked.length >= count || already.has(code) || picked.some((x) => x.code === code)) continue
      const r = kipoByCode(code)
      if (r) picked.push({ code, why: `${r.field} — 시스템·플랫폼 발명에서 먼저 보는 사례입니다` })
    }
  }
  if (picked.length === 0) return null
  return {
    value: picked.map((x) => x.code),
    reasons: picked.map((x) => {
      const r = kipoByCode(x.code)
      return `${x.code} ${clip(r?.title ?? '', 40)} · ${x.why}`
    }),
  }
}
