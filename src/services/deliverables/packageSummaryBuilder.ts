import type { DeliverablePackage } from '../../types/deliverables'
import { runDeliverableQuality, hasBlockingErrors } from './qualityEngine'

export interface DeliverableSummary {
  sectionCount: number
  activeSectionCount: number
  promptCount: number
  roadmapPhaseCount: number
  evidenceCount: number
  manualEditedCount: number
  clientVisibleCount: number
  includesAx: boolean
  includesWebsite: boolean
  includesValidation: boolean
  stale: boolean
  blockingErrorCount: number
  warningCount: number
  finalizeReady: boolean
  headline: string
}

/** 패키지 상태를 결정적으로 요약한다. */
export function buildPackageSummary(pkg: DeliverablePackage, stale: boolean): DeliverableSummary {
  const active = pkg.sections.filter((s) => s.status !== 'excluded')
  const checks = runDeliverableQuality(pkg, { stale })
  const blocking = checks.filter((c) => c.severity === 'error' && !c.passed)
  const warnings = checks.filter((c) => c.severity === 'warning' && !c.passed)
  const includesValidation = pkg.includedTracks.includes('validation')

  let headline: string
  if (pkg.status === 'finalized') headline = '자료 확정 완료'
  else if (stale) headline = '출처 원본 변경됨 — 새 버전 검토 필요'
  else if (blocking.length > 0) headline = `확정 전 해결할 오류 ${blocking.length}건`
  else if (!includesValidation) headline = '검증 전 설계안 · 확정 가능'
  else headline = '확정 가능'

  return {
    sectionCount: pkg.sections.length,
    activeSectionCount: active.length,
    promptCount: pkg.prompts.length,
    roadmapPhaseCount: pkg.roadmap.length,
    evidenceCount: pkg.evidenceIndex.length,
    manualEditedCount: active.filter((s) => s.manuallyEdited).length,
    clientVisibleCount: active.filter((s) => s.visibility === 'client_visible' || s.visibility === 'shared').length,
    includesAx: pkg.includedTracks.includes('ax'),
    includesWebsite: pkg.includedTracks.includes('website'),
    includesValidation,
    stale,
    blockingErrorCount: blocking.length,
    warningCount: warnings.length,
    finalizeReady: !hasBlockingErrors(checks),
    headline,
  }
}
