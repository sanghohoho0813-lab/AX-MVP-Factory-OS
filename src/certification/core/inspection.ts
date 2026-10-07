/**
 * 실사 · 현장평가 대비 (D-170) — 한 번에 한 질문. 질문마다 의도 · 기록에서 찾은 것 · 쓸 증빙 · 답변 초안.
 * 없는 사실은 만들지 않는다 — 초안을 만들 근거가 없으면 '대표 확인 필요'.
 * 모의 실사 결과는 점수가 아니라 5단계 + 강점 · 보완 · 실사 전 확인.
 */
import { readinessOf, type Check } from './readiness'
import type { CertificationClientContext, Readiness } from './types'

export interface InspectionQuestion {
  id: string
  question: string
  intent: string
  /** 기록에서 확인된 내용 */
  facts: (c: CertificationClientContext) => string[]
  /** 쓸 수 있는 증빙 id */
  evidence: string[]
  /** 답변 초안 — 근거가 없으면 null(대표 확인 필요) */
  draft: (c: CertificationClientContext) => string | null
  /** P2: 짧은 주제 이름(대표 확인 문장 · 요약에) */
  topic?: string
  /** P2: 중요도 1~3(3 = 거의 늘 묻는 핵심) */
  weight?: 1 | 2 | 3
  /** P2: 말하기 가이드 — 근거가 붙은 문장만. 없으면 대표 확인 */
  guide?: (k: import('./answerGuide').FactKit) => import('./answerGuide').GuideParts
  /** FV: 이 업체 사실 때문에 더 중요해지면 그 이유(한 줄) — 없으면 null */
  boost?: (k: import('./answerGuide').FactKit) => string | null
}

export type PrepState = 'ok' | 'edited' | 'confirm' | 'pending'

export const PREP_STATE_LABEL: Record<PrepState, string> = { ok: '이대로', edited: '고침', confirm: '대표 확인 필요', pending: '아직' }

export interface PreparedAnswer {
  state: PrepState
  /** 고친 답(edited 일 때) */
  text?: string
}

export interface InspectionCard {
  q: InspectionQuestion
  facts: string[]
  haveEvidence: string[]
  missingEvidence: string[]
  draft: string | null
  /** 초안 근거가 없어 대표 확인이 필요 */
  needsOwner: boolean
}

export function inspectionCards(qs: readonly InspectionQuestion[], c: CertificationClientContext, labelOf: (id: string) => string): InspectionCard[] {
  return qs.map((q) => {
    const have = q.evidence.filter((id) => c.evidence.some((d) => d.id === id && d.have && !d.stale))
    const draft = q.draft(c)
    return {
      q,
      facts: q.facts(c),
      haveEvidence: have.map(labelOf),
      missingEvidence: q.evidence.filter((id) => !have.includes(id)).map(labelOf),
      draft,
      needsOwner: draft === null,
    }
  })
}

export interface MockResult {
  readiness: Readiness
  strengths: string[]
  needs: string[]
  /** 실사 전 반드시 확인(대표 답) */
  ownerConfirm: string[]
  answered: number
  total: number
}

export function mockInspection(cards: readonly InspectionCard[], answers: Record<string, PreparedAnswer>): MockResult {
  const checks: Check[] = cards.map((k) => {
    const a = answers[k.q.id]?.state ?? 'pending'
    const ready = (a === 'ok' && !k.needsOwner) || a === 'edited'
    const state = a === 'confirm' || a === 'pending' || (a === 'ok' && k.needsOwner) ? 'unknown' : ready && k.missingEvidence.length === 0 ? 'ok' : 'warn'
    return { weight: 'core', state, text: k.q.question }
  })
  const answered = cards.filter((k) => (answers[k.q.id]?.state ?? 'pending') !== 'pending').length
  return {
    readiness: answered === 0 ? 'unknown' : readinessOf(checks),
    strengths: cards.filter((_k, i) => checks[i].state === 'ok').map((k) => k.q.question),
    needs: [...new Set(cards.flatMap((k) => k.missingEvidence))],
    ownerConfirm: cards.filter((_k, i) => checks[i].state === 'unknown').map((k) => k.q.question),
    answered,
    total: cards.length,
  }
}
