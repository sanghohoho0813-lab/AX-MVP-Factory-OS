import type {
  CandidateDependency,
  HandoffCandidateSummary,
  ScopeBucket,
  ScopeItem,
  SelectionHandoffSnapshot,
} from '../../types/selection'
import { CONFIDENCE_META } from '../../lib/assessmentMeta'
import { QUADRANT_META } from '../../lib/selectionMeta'
import { mvpLevelLabel } from '../../lib/domainMeta'
import { BlockBuilder, NEEDS } from './contentBlocks'
import type { CollectedSources } from './sourceCollector'
import type { SectionSeed } from './sectionFactory'

/* ------------------------------------------------------------------ */
/* Stage 10 · 과제선정 섹션 빌더 (결정적 · 순수 데이터)                   */
/*                                                                     */
/* sources.selectionHandoff(SelectionHandoffSnapshot, 동결 스냅샷 우선)   */
/* 와 sources.selectionDecision을 보고서 섹션 씨앗으로 변환한다.          */
/* 근거 없는 수치는 만들지 않으며, 후보 점수와 AX 적합성 점수를 구분한다. */
/* ------------------------------------------------------------------ */

const SCOPE_BUCKET_LABEL: Record<ScopeBucket, string> = {
  mvp_first: 'MVP 1차 포함',
  phase_two: '2차 확장',
  maintenance: '유지·운영',
  separate_quote: '별도 견적',
  excluded: '제외',
}

function quadrantLabel(candidate: HandoffCandidateSummary): string {
  return QUADRANT_META[candidate.quadrant]?.label ?? candidate.quadrant
}

function confidenceLabel(candidate: HandoffCandidateSummary): string {
  return CONFIDENCE_META[candidate.confidence].label
}

/** KPI 문자열에 수치 기준이 없으면 현장 측정 필요를 덧붙인다 */
function kpiLine(kpi: string): string {
  return /\d/.test(kpi) ? kpi : `${kpi} (${NEEDS.measure})`
}

/* ------------------------------------------------------------------ */
/* selected_task                                                        */
/* ------------------------------------------------------------------ */

function selectedTaskSeed(
  handoff: SelectionHandoffSnapshot,
  sources: CollectedSources,
  refs: string[],
): SectionSeed {
  const projectType = sources.project.projectType
  const b = new BlockBuilder('sel-task')
    .heading('선정 핵심 과제')
    .callout(
      '아래 “후보 점수”는 과제 간 우선순위 비교용 지표이며, 진단 단계의 “프로젝트 AX 적합성 점수”와는 다른 지표입니다. 두 점수를 합산하거나 동일하게 비교하지 않습니다.',
      { title: '지표 안내', tone: 'info' },
    )

  const primary = handoff.primaryCandidate
  if (primary) {
    b.keyValue(
      [
        { key: '과제명', value: primary.name },
        { key: '해결할 문제', value: primary.problemStatement },
        { key: '후보 점수', value: `${primary.priorityScore}점` },
        { key: '우선순위 분류', value: quadrantLabel(primary) },
        { key: '신뢰도', value: confidenceLabel(primary) },
        { key: '권장 MVP 수준', value: mvpLevelLabel(primary.recommendedMvpLevel, projectType) },
      ],
      { title: '핵심 과제 (Primary)', sources: refs },
    )
    b.bullets(primary.keyEffects, { title: '기대 효과', sources: refs })
    b.bullets(primary.keyMetrics, { title: '핵심 지표', sources: refs })
  } else {
    b.paragraph('확정된 핵심 과제(Primary)가 지정되지 않았습니다.')
  }

  const secondaryLines = handoff.secondaryCandidates.map(
    (c) => `${c.name} · ${quadrantLabel(c)} · 후보 점수 ${c.priorityScore}점 · 신뢰도 ${confidenceLabel(c)}`,
  )
  b.bullets(secondaryLines, { title: '후속 과제 (Secondary)', sources: refs })

  const decision = sources.selectionDecision
  if (decision && decision.decisionSummary.trim()) {
    b.paragraph(decision.decisionSummary, { sources: refs })
  }

  b.bullets(handoff.excludedItems, { title: '제외·보류 항목', sources: refs })

  const prereq = handoff.dependencies
    .filter((d) => d.requiredBeforeMvp)
    .map((d: CandidateDependency) => `${d.title}: ${d.description}`)
  b.bullets(prereq, { title: '선행조건 (MVP 착수 전 해결 필요)', sources: refs })

  b.metric('권장 MVP 수준', mvpLevelLabel(handoff.recommendedMvpLevel, projectType))

  return {
    type: 'selected_task',
    track: 'ax',
    title: '선정 핵심 과제',
    subtitle: primary ? primary.name : '핵심 과제 미지정',
    summary: primary
      ? `핵심 과제 “${primary.name}” · ${quadrantLabel(primary)} · 후보 점수 ${primary.priorityScore}점.`
      : '확정된 핵심 과제가 지정되지 않았습니다.',
    blocks: b.build(),
    sourceReferences: refs,
    visibility: 'shared',
    required: true,
  }
}

/* ------------------------------------------------------------------ */
/* priority_matrix                                                      */
/* ------------------------------------------------------------------ */

function priorityMatrixSeed(handoff: SelectionHandoffSnapshot, refs: string[]): SectionSeed {
  const all: HandoffCandidateSummary[] = [
    ...(handoff.primaryCandidate ? [handoff.primaryCandidate] : []),
    ...handoff.secondaryCandidates,
  ]

  const b = new BlockBuilder('sel-matrix').heading('우선순위 매트릭스')

  const rows = all.map((c, idx) => ({
    cells: [
      c === handoff.primaryCandidate ? `${idx + 1} (핵심)` : `${idx + 1}`,
      c.name,
      quadrantLabel(c),
      `${c.priorityScore}점`,
      confidenceLabel(c),
    ],
  }))

  if (rows.length > 0) {
    b.table(['순번', '과제', '우선순위 분류', '후보 점수', '신뢰도'], rows, {
      title: '우선순위 후보 (데이터에 있는 값만 표기)',
      sources: refs,
    })
    b.callout(
      '분류·점수는 과제선정 단계에서 산정된 값이며, 임의로 새 점수를 생성하지 않았습니다.',
      { title: '근거', tone: 'info' },
    )
  } else {
    b.paragraph('우선순위를 산정할 후보가 없습니다.')
  }

  return {
    type: 'priority_matrix',
    track: 'ax',
    title: '우선순위 매트릭스',
    subtitle: `후보 ${all.length}건`,
    summary: `우선순위 후보 ${all.length}건의 분류·점수 정리.`,
    blocks: b.build(),
    sourceReferences: refs,
    visibility: 'shared',
    required: false,
  }
}

/* ------------------------------------------------------------------ */
/* mvp_scope                                                            */
/* ------------------------------------------------------------------ */

function mvpScopeSeed(handoff: SelectionHandoffSnapshot, refs: string[]): SectionSeed {
  const b = new BlockBuilder('sel-scope')
    .heading('MVP 범위 정의')
    .keyValue(
      [
        { key: '문제 정의', value: handoff.problemDefinition },
        { key: '대상 사용자', value: handoff.targetUsers },
        { key: '현재 업무 흐름', value: handoff.currentWorkflow },
        { key: '목표 업무 흐름', value: handoff.desiredWorkflow },
        { key: '입력 데이터', value: handoff.inputData },
        { key: '출력 결과', value: handoff.outputResults },
      ],
      { title: '과제 정의', sources: refs },
    )

  const includedRows = handoff.scopeItems
    .filter((s: ScopeItem) => s.bucket === 'mvp_first')
    .map((s) => ({ cells: [s.label, SCOPE_BUCKET_LABEL[s.bucket]] }))
  b.table(['포함 항목', '구분'], includedRows, { title: '포함 범위 (MVP 1차)', sources: refs })

  const otherRows = handoff.scopeItems
    .filter((s: ScopeItem) => s.bucket !== 'mvp_first')
    .map((s) => ({ cells: [s.label, SCOPE_BUCKET_LABEL[s.bucket]] }))
  b.table(['항목', '구분'], otherRows, { title: '단계·별도 처리 항목', sources: refs })

  b.bullets(handoff.excludedItems, { title: '제외 항목', sources: refs })
  b.bullets(handoff.scopeGuardrails, { title: '범위 가드레일', sources: refs })
  b.bullets(handoff.expectedKpis.map(kpiLine), { title: '기대 KPI (수치 기준 없으면 현장 측정 필요)', sources: refs })
  b.bullets(handoff.risks, { title: '위험 요인', sources: refs })

  return {
    type: 'mvp_scope',
    track: 'ax',
    title: 'MVP 범위 정의',
    subtitle: '문제 · 사용자 · 범위 · KPI',
    summary: '핵심 과제의 문제 정의, 업무 흐름, 포함·제외 범위, 기대 KPI를 정리했습니다.',
    blocks: b.build(),
    sourceReferences: refs,
    visibility: 'shared',
    required: true,
  }
}

/* ------------------------------------------------------------------ */
/* export                                                               */
/* ------------------------------------------------------------------ */

export function buildSelectionSeeds(sources: CollectedSources): SectionSeed[] {
  if (sources.project.projectType === 'website') return []

  const handoff = sources.selectionHandoff
  if (!handoff) return []

  const refs = [
    sources.references.find((r) => r.sourceType === 'selection_handoff' && r.available)?.id,
  ].filter((id): id is string => Boolean(id))

  return [
    selectedTaskSeed(handoff, sources, refs),
    priorityMatrixSeed(handoff, refs),
    mvpScopeSeed(handoff, refs),
  ]
}
