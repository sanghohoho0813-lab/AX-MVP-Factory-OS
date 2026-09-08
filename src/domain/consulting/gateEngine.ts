/**
 * 게이트 엔진 — 단계를 완료로 넘길 수 있는가.
 *
 * 규칙만 있고 점수는 없다. 막는 이유를 사람이 읽을 수 있는 문장으로 돌려준다.
 *   Completion  필요 사실 · 필요 산출물 · 건너뛰기 이유
 *   Freshness   S7 / S14 — 30일 이내 최신 공식 기준 확인 기록 (K9)
 *   Gate        S1 — 결정이 있어야 한다
 *   Integrity   S8~S13 — LIVE/DEMO/FUTURE, 출원≠등록, Rule≠AI (coreThread 의 p0)
 *   Evidence    S12 — 10슬롯 비어 있음 · 출처 없음
 *   QA          S13 — P0 12개 확인 · Judge 점수
 */

import type { ConsultingArtifact, ConsultingEvidence, ConsultingProject, StageKey } from '../../types/consulting'
import { stageDef } from './workflowDefinition'
import { factDef, missingFacts } from './factsheetSchema'
import { coreThreadWarnings } from './coreThread'
import { EVIDENCE_SLOTS, GATE_ITEMS, RED_FLAGS, judgeTotal } from './qaRules'
import { kipoSelectionIssues } from './kipoReferences'

export const FRESHNESS_DAYS = 30

export interface GateResult {
  ok: boolean
  /** 막는 이유 — 비어 있으면 통과 */
  blockers: string[]
  /** 막지는 않지만 알려 줄 것 */
  notes: string[]
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso.slice(0, 10)).getTime()
  const b = new Date(bIso.slice(0, 10)).getTime()
  return Math.floor((b - a) / 86_400_000)
}

export function freshnessOk(p: ConsultingProject, scope: 'patent_filing' | 'venture_application', today: string): boolean {
  return p.freshness.some((f) => f.scope === scope && daysBetween(f.checkedAt, today) <= FRESHNESS_DAYS)
}

export function gateCheckedCount(p: ConsultingProject): number {
  return GATE_ITEMS.filter((g) => p.gate.items[g.key] === true).length
}

export function evidenceIssues(evidence: ConsultingEvidence[]): { emptySlots: number[]; noSource: number; notReady: number } {
  const bySlot = new Map<number, ConsultingEvidence[]>()
  for (const e of evidence) bySlot.set(e.slot, [...(bySlot.get(e.slot) ?? []), e])
  const emptySlots = EVIDENCE_SLOTS.map((s) => s.slot).filter((s) => (bySlot.get(s) ?? []).length === 0)
  const noSource = evidence.filter((e) => e.claim.trim() !== '' && e.source.trim() === '').length
  const notReady = evidence.filter((e) => !e.ready).length
  return { emptySlots, noSource, notReady }
}

export function redFlagsRemaining(p: ConsultingProject): number[] {
  return RED_FLAGS.filter((f) => p.venture.redFlagsCleared[f.no] !== true).map((f) => f.no)
}

/**
 * 단계 완료 가능 여부.
 * artifacts / evidence 는 프로젝트 것만 넘긴다.
 */
export function canCompleteStage(
  p: ConsultingProject,
  key: StageKey,
  ctx: { artifacts: ConsultingArtifact[]; evidence: ConsultingEvidence[]; today: string },
): GateResult {
  const def = stageDef(key)
  const blockers: string[] = []
  const notes: string[] = []

  // Completion — 사실
  const missing = missingFacts(p.factsheet, def.requiredFacts)
  if (missing.length > 0) blockers.push(`사실표에 비어 있는 항목: ${missing.map((k) => factDef(k).label).join(', ')}`)

  // Completion — 산출물
  const have = new Set(ctx.artifacts.filter((a) => a.projectId === p.id && a.status !== 'superseded').map((a) => a.type))
  const lackArtifacts = def.requiredArtifacts.filter((t) => !have.has(t))
  if (lackArtifacts.length > 0) blockers.push(`아직 없는 산출물: ${lackArtifacts.length}종 (${lackArtifacts.join(', ')})`)

  // Gate — S1
  if (key === 'S1') {
    if (p.gate.decision === null) blockers.push('GO / HOLD / NO-GO 를 아직 정하지 않았습니다.')
    else if (p.gate.reason.trim() === '') blockers.push('결정 이유를 적어 주세요.')
    if (p.gate.decision === 'no_go') notes.push('NO-GO 입니다. 억지로 다음 단계로 가지 않습니다.')
    if (p.gate.decision === 'hold') notes.push('HOLD 는 탈락이 아닙니다 — 약한 항목을 보강하고 GO 로 바꿉니다.')
  }

  // KIPO — S5
  if (key === 'S5') {
    for (const issue of kipoSelectionIssues(p.kipo)) blockers.push(issue)
  }

  // Patent filing — S7
  if (key === 'S7') {
    if (p.patent.filingStatus === 'none') blockers.push('출원 상태가 "미출원" 입니다.')
    if (p.patent.applicationNumber.trim() === '' || p.patent.filedAt.trim() === '') blockers.push('출원번호와 출원일을 기록해 주세요.')
    if (!freshnessOk(p, 'patent_filing', ctx.today)) blockers.push(`출원 직전 최신 공식 기준(특허로) 확인 기록이 ${FRESHNESS_DAYS}일 안에 없습니다 (Master K9).`)
  }

  // Integrity — S8~S13
  const idx = Number(key.slice(1))
  if (idx >= 8 && idx <= 13) {
    const p0 = coreThreadWarnings(p).filter((w) => w.severity === 'p0')
    for (const w of p0) blockers.push(w.message)
    if (key === 'S8') {
      if (p.mvp.live.trim() === '' || p.mvp.future.trim() === '') blockers.push('LIVE / FUTURE 를 구분해 적어 주세요 (DEMO 는 없으면 비워 둡니다).')
      if (p.mvp.axMode === '') blockers.push('AX 기능 방식(rule / scoring / ml / llm / demo …)을 골라 주세요 — AI 라 부를 수 있는지의 근거입니다.')
      if (p.mvp.notBuilding.trim() === '') notes.push('"안 만들 것" 이 비어 있습니다. 범위가 커지는 것을 막는 칸입니다.')
    }
  }

  // Evidence — S12
  if (key === 'S12') {
    const ev = evidenceIssues(ctx.evidence.filter((e) => e.projectId === p.id))
    if (ev.emptySlots.length > 0) blockers.push(`비어 있는 첨부 슬롯: ${ev.emptySlots.join(', ')}`)
    if (ev.noSource > 0) blockers.push(`출처가 없는 주장 ${ev.noSource}건 — 증빙을 붙이거나 표현을 약하게 하거나 향후계획으로 옮기거나 지웁니다 (Master §36-1).`)
    if (ev.notReady > 0) notes.push(`아직 준비 안 된 첨부 ${ev.notReady}건`)
  }

  // QA — S13
  if (key === 'S13') {
    const remaining = redFlagsRemaining(p)
    if (remaining.length > 0) blockers.push(`P0 Red Flag 미확인 ${remaining.length}개 (#${remaining.join(', #')}) — 하나라도 남으면 완료 선언을 하지 않습니다.`)
    if (judgeTotal(p.venture.judgeScores) === null) blockers.push('Judge 10항목 점수를 아직 다 매기지 않았습니다.')
    const p1 = coreThreadWarnings(p).filter((w) => w.severity === 'p1')
    if (p1.length > 0) notes.push(`핵심 줄기 P1 경고 ${p1.length}건이 남아 있습니다.`)
  }

  // Submission — S14
  if (key === 'S14') {
    if (!freshnessOk(p, 'venture_application', ctx.today)) blockers.push(`신청 직전 최신 공식 기준(벤처확인종합관리시스템) 확인 기록이 ${FRESHNESS_DAYS}일 안에 없습니다 (Master K9).`)
    if (p.venture.submittedAt.trim() === '') blockers.push('신청일을 기록해 주세요.')
    const docsMissing = Object.values(p.venture.documents).filter((v) => !v).length
    if (docsMissing > 0) notes.push(`기본 제출서류 미확인 ${docsMissing}종`)
  }

  // Field review — S15
  if (key === 'S15') {
    if (p.fieldReview.qa.length < 10) blockers.push(`예상질문이 ${p.fieldReview.qa.length}개입니다 — 10~15개를 준비합니다.`)
    if (p.fieldReview.numbersToMemorize.length < 8) notes.push(`대표가 외울 숫자 ${p.fieldReview.numbersToMemorize.length}개 — 8~12개가 적당합니다.`)
    if (!p.fieldReview.mockReviewDone) blockers.push('실사 전 Mock Review 를 1회 하고 표시해 주세요.')
  }

  return { ok: blockers.length === 0, blockers, notes }
}

/** 건너뛰기 가능 여부 */
export function canSkipStage(key: StageKey, reason: string): GateResult {
  const def = stageDef(key)
  if (!def.skippable) return { ok: false, blockers: [`${def.label} 단계는 건너뛸 수 없습니다.`], notes: [] }
  if (reason.trim().length < 4) return { ok: false, blockers: ['건너뛰는 이유를 적어 주세요 (예: 이미 등록된 특허 보유).'], notes: [] }
  return { ok: true, blockers: [], notes: [] }
}
