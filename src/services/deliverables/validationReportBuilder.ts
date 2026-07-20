import type { ValidationHandoffSnapshot, ValidationTrackType } from '../../types/validation'
import { DECISION_META, GATE_META, GATE_STATUS_META, TRACK_META } from '../../lib/validationMeta'
import { BlockBuilder, NEEDS } from './contentBlocks'
import type { CollectedSources } from './sourceCollector'
import type { SectionSeed } from './sectionFactory'

/** 트랙 인계 스냅샷 → 4개 시드(요약·KPI·Gate·이슈). 모든 시드는 'validation' 트랙. */
function seedsFromHandoff(
  track: ValidationTrackType,
  handoff: ValidationHandoffSnapshot,
  refs: string[],
): SectionSeed[] {
  const trackLabel = TRACK_META[track].label
  const seeds: SectionSeed[] = []

  /* 1. validation_summary */
  const sum = new BlockBuilder(`val-${track}-summary`)
  sum.heading(`${trackLabel} · 검증 요약`)
  sum.keyValue(
    [
      { key: '트랙', value: trackLabel },
      { key: '테스트 목적', value: handoff.objective },
      { key: '테스트 버전', value: handoff.testedBuild || '미기재' },
      { key: '참여자', value: `${handoff.participants}명` },
      { key: '시나리오', value: `${handoff.scenarios}개` },
    ],
    { title: '개요' },
  )
  if (handoff.roundSummaries.length > 0) {
    sum.table(
      ['회차', '시나리오', '통과', '조건부', '실패', '차단'],
      handoff.roundSummaries.map((r) => ({
        cells: [
          `${r.roundNumber}회차`,
          `${r.totalScenarios}`,
          `${r.passed}`,
          `${r.conditional}`,
          `${r.failed}`,
          `${r.blocked}`,
        ],
      })),
      { title: '회차별 결과' },
    )
  }
  sum.bullets(handoff.passedCriteria, { title: '통과한 필수 기준' })
  if (handoff.failedCriteria.length > 0) {
    sum.bullets(handoff.failedCriteria, { title: '미통과 기준' })
  }
  seeds.push({
    type: 'validation_summary',
    track: 'validation',
    title: `${trackLabel} · 검증 요약`,
    subtitle: handoff.objective,
    blocks: sum.build(),
    sourceReferences: refs,
    visibility: 'client_visible',
    required: true,
  })

  /* 2. kpi_results — 측정된 값만, 임의 생성 금지 */
  const kpi = new BlockBuilder(`val-${track}-kpi`)
  kpi.heading(`${trackLabel} · KPI 결과`)
  if (handoff.metricResults.length > 0) {
    kpi.bullets(handoff.metricResults, { title: 'KPI 측정 결과' })
  } else {
    kpi.callout(NEEDS.measure, { title: 'KPI', tone: 'warning' })
  }
  seeds.push({
    type: 'kpi_results',
    track: 'validation',
    title: `${trackLabel} · KPI 결과`,
    blocks: kpi.build(),
    sourceReferences: refs,
    visibility: 'shared',
  })

  /* 3. stage_gate — Gate 판정 + 최종 결정 */
  const gate = new BlockBuilder(`val-${track}-gate`)
  gate.heading(`${trackLabel} · Stage-Gate 판정`)
  if (handoff.gateResults.length > 0) {
    gate.table(
      ['Gate', '판정'],
      handoff.gateResults.map((g) => ({
        cells: [GATE_META[g.gate].label, GATE_STATUS_META[g.status].label],
      })),
      { title: 'Gate 결과' },
    )
  }
  const dec = handoff.finalDecision
  const decLabel = dec.type ? DECISION_META[dec.type].label : '다음 단계 결정 전'
  gate.keyValue(
    [
      { key: '최종 결정', value: decLabel },
      { key: '요약', value: dec.summary },
      { key: '판단 근거', value: dec.rationale },
    ],
    { title: '최종 결정' },
  )
  gate.bullets(dec.requiredActions, { title: '필수 후속조치' })
  seeds.push({
    type: 'stage_gate',
    track: 'validation',
    title: `${trackLabel} · Stage-Gate 판정`,
    blocks: gate.build(),
    sourceReferences: refs,
    visibility: 'shared',
  })

  /* 4. issue_summary — 미해결 이슈·질문·리스크(내부용) */
  const iss = new BlockBuilder(`val-${track}-issues`)
  iss.heading(`${trackLabel} · 미해결 이슈`)
  if (handoff.unresolvedIssues.length > 0) {
    iss.warning(`미해결 이슈 ${handoff.unresolvedIssues.length}건 — 출시·확대 전 반드시 확인해야 합니다.`, {
      title: '주의',
    })
    iss.bullets(handoff.unresolvedIssues, { title: '미해결 이슈' })
  } else {
    iss.paragraph('보고된 미해결 이슈가 없습니다.')
  }
  iss.bullets(handoff.openQuestions, { title: '확인 필요 질문' })
  iss.bullets(handoff.risks, { title: '리스크' })
  seeds.push({
    type: 'issue_summary',
    track: 'validation',
    title: `${trackLabel} · 이슈·리스크`,
    blocks: iss.build(),
    sourceReferences: refs,
    visibility: 'internal_only',
  })

  return seeds
}

/** 검증 인계는 없지만 설계가 확정된 트랙 → 검증 전 설계안 안내(결과 생성 금지) */
function preTestSeed(track: ValidationTrackType): SectionSeed {
  const trackLabel = TRACK_META[track].label
  const b = new BlockBuilder(`val-${track}-pretest`)
  b.heading(`${trackLabel} · 검증 전 설계안`)
  b.callout('실제 사용 테스트 전 · 검증 전 설계안입니다.', { title: trackLabel, tone: 'warning' })
  b.paragraph(
    '아직 실제 사용 테스트를 진행하지 않았습니다. 통과율·KPI·Gate 판정 등 검증 결과는 실제 테스트를 마친 뒤 확정됩니다.',
  )
  return {
    type: 'validation_summary',
    track: 'validation',
    title: `${trackLabel} · 검증 전 설계안`,
    subtitle: '검증 전',
    blocks: b.build(),
    visibility: 'client_visible',
  }
}

/** 트랙별 검증 인계 스냅샷 ref id 조회(트랙은 sourceId로 구분) */
function validationRefs(sources: CollectedSources, handoff: ValidationHandoffSnapshot | null): string[] {
  if (!handoff) return []
  const id = sources.references.find(
    (r) => r.sourceType === 'validation_handoff' && r.available && r.sourceId === handoff.id,
  )?.id
  return id ? [id] : []
}

/** 한 트랙(AX/홈페이지) 처리: 인계 있으면 4시드, 설계만 있으면 검증 전 안내, 둘 다 없으면 없음 */
function buildTrack(
  sources: CollectedSources,
  track: ValidationTrackType,
  handoff: ValidationHandoffSnapshot | null,
  hasDesign: boolean,
): SectionSeed[] {
  if (handoff) return seedsFromHandoff(track, handoff, validationRefs(sources, handoff))
  if (hasDesign) return [preTestSeed(track)]
  return []
}

/**
 * AX·홈페이지 검증 인계 스냅샷 → 제출자료 섹션 시드.
 * AX와 홈페이지는 절대 합산하지 않고 별도 시드로 유지한다.
 */
export function buildValidationSeeds(sources: CollectedSources): SectionSeed[] {
  return [
    ...buildTrack(sources, 'ax_mvp', sources.axValidationHandoff, sources.mvpHandoff !== null),
    ...buildTrack(sources, 'website', sources.websiteValidationHandoff, sources.websiteHandoff !== null),
  ]
}
