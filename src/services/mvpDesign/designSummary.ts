import type { Organization } from '../../types/domain'
import type { SelectionHandoffSnapshot } from '../../types/selection'
import type { GeneratedDesign } from './designGenerator'

/** 자동 설계 요약문 (담당자 최종 의견과 별도) */
export function buildDesignAutoSummary(
  handoff: SelectionHandoffSnapshot,
  organization: Organization | null,
  design: GeneratedDesign,
): string {
  const org = organization?.name ?? '고객사'
  const core = handoff.primaryCandidate?.name ?? '핵심 과제'
  const must = design.features.filter((f) => f.scope === 'must')
  const mustNames = must.map((f) => f.name).slice(0, 4).join(', ')
  const aiNote = design.aiFeatures.length > 0
    ? `AI는 ${design.aiFeatures.length}개 기능에 보조로만 사용하며 결과는 사람이 확정합니다.`
    : 'AI 없이 규칙 기반으로 구성했습니다.'
  const expertNote = design.features.some((f) => f.expertJudgmentBoundary)
    ? ' 전문가 최종판단 영역은 자동화하지 않고 확인 대상으로만 표시합니다.'
    : ''
  return (
    `${org}의 '${core}'를 1차 MVP로 설계했습니다. ` +
    `필수 기능 ${must.length}개(${mustNames})를 중심으로 화면 ${design.screens.length}개, ` +
    `데이터 ${design.entities.length}종, 역할 ${design.roles.length}개로 구성했습니다. ` +
    `${aiNote}${expertNote}`
  )
}
