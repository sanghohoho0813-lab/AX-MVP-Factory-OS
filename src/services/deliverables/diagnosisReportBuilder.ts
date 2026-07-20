import type { RespondentRole } from '../../types'
import type {
  AssessmentResult,
  DomainScore,
  WebsiteReadinessResult,
  WebsiteReadinessScore,
} from '../../types/assessment'
import {
  ASSESSMENT_DOMAIN_META,
  CONFIDENCE_META,
  RECOMMENDATION_META,
  SCORE_CONFIDENCE_META,
  WEBSITE_DOMAIN_META,
  WEBSITE_RECOMMENDATION_META,
} from '../../lib/assessmentMeta'
import { RESPONDENT_ROLE_META, RESPONDENT_ROLES } from '../../lib/surveyMeta'
import { BlockBuilder } from './contentBlocks'
import type { CollectedSources } from './sourceCollector'
import type { SectionSeed } from './sectionFactory'

/* ------------------------------------------------------------------ */
/* Stage 10 · 진단 요약 섹션 빌더 (결정적 · 순수 데이터)                  */
/*                                                                     */
/* sources.assessment(AssessmentResult)를 보고서 섹션 씨앗으로 변환한다. */
/* 근거 없는 수치는 만들지 않으며, 미측정 영역을 0으로 표기하지 않는다.   */
/* AX 적합성과 홈페이지 준비도는 하나의 점수로 합산하지 않는다.          */
/* ------------------------------------------------------------------ */

function domainLabel(domain: DomainScore['domain']): string {
  return ASSESSMENT_DOMAIN_META[domain]?.label ?? domain
}

/** 결과 영역을 메타 정의 순서로 정렬해 결정적 순서를 보장한다 */
function orderedDomains(domains: DomainScore[]): DomainScore[] {
  const order = (d: DomainScore): number => ASSESSMENT_DOMAIN_META[d.domain]?.order ?? 99
  return [...domains].sort((a, b) => order(a) - order(b))
}

/** 미측정(measured=false) 영역은 절대 0으로 표기하지 않는다 */
function scoreCell(d: DomainScore): string {
  return d.measured ? `${d.normalizedScore}점` : '미측정'
}

/** 응답 근거에서 응답자(응답 단위) 역할 분포를 도출한다 */
function respondentRoleDistribution(assessment: AssessmentResult): string[] {
  const roleByResponse = new Map<string, RespondentRole>()
  for (const e of assessment.evidence) {
    if (e.responseId && !roleByResponse.has(e.responseId)) {
      roleByResponse.set(e.responseId, e.respondentRole)
    }
  }
  if (roleByResponse.size === 0) return []
  const counts = new Map<RespondentRole, number>()
  for (const role of roleByResponse.values()) {
    counts.set(role, (counts.get(role) ?? 0) + 1)
  }
  const lines: string[] = []
  for (const role of RESPONDENT_ROLES) {
    const n = counts.get(role) ?? 0
    if (n > 0) lines.push(`${RESPONDENT_ROLE_META[role].label} ${n}명`)
  }
  return lines
}

function domainScoreRows(domains: DomainScore[]): { cells: string[] }[] {
  return orderedDomains(domains).map((d) => ({
    cells: [
      domainLabel(d.domain),
      scoreCell(d),
      d.measured ? '측정됨' : '미측정',
      SCORE_CONFIDENCE_META[d.confidence].label,
    ],
  }))
}

function orderedWebsiteDomains(domains: WebsiteReadinessScore[]): WebsiteReadinessScore[] {
  const order = (d: WebsiteReadinessScore): number => WEBSITE_DOMAIN_META[d.domain]?.order ?? 99
  return [...domains].sort((a, b) => order(a) - order(b))
}

/* ------------------------------------------------------------------ */
/* 진단 미확정 (assessment 없음)                                         */
/* ------------------------------------------------------------------ */

function unresolvedSeed(refs: string[]): SectionSeed {
  const blocks = new BlockBuilder('diagnosis')
    .heading('진단 요약')
    .warning(
      '확정된 진단 결과가 없습니다. 아래 내용은 초안이며, 진단을 확정하기 전에는 점수·판정을 확정된 사실로 제시하지 않습니다.',
      { title: '초안 · 미확정' },
    )
    .paragraph(
      '진단이 확정되면 조사 대상, 영역별 결과, 강점·약점·위험, 신뢰도 및 추가 확인 사항이 이 섹션에 자동으로 채워집니다. 임의의 점수나 수치는 표기하지 않습니다.',
    )
    .build()

  return {
    type: 'diagnosis_summary',
    track: 'overview',
    title: '진단 요약',
    subtitle: '진단 미확정',
    summary: '확정된 진단 결과가 없어 진단 미확정 상태입니다.',
    blocks,
    sourceReferences: refs,
    visibility: 'shared',
    required: true,
  }
}

/* ------------------------------------------------------------------ */
/* diagnosis_summary                                                    */
/* ------------------------------------------------------------------ */

function summarySeed(assessment: AssessmentResult, sources: CollectedSources, refs: string[]): SectionSeed {
  const b = new BlockBuilder('diagnosis').heading('진단 요약')

  if (assessment.status !== 'finalized') {
    b.warning(
      '이 진단은 아직 확정 전 상태입니다. 점수와 판정은 검토 중이며 변경될 수 있습니다.',
      { title: '초안' },
    )
  }

  b.keyValue(
    [
      { key: '조사 대상(응답자 수)', value: `${sources.submittedResponseIds.length}명` },
      { key: '분석 신뢰도', value: CONFIDENCE_META[assessment.confidence].label },
      { key: '데이터 충분도', value: `${assessment.dataCompleteness}%` },
      { key: '응답자 커버리지', value: `${assessment.respondentCoverage}%` },
      { key: '점수화 커버리지', value: `${assessment.scoreCoverage}%` },
    ],
    { title: '조사 개요', sources: refs },
  )

  const roleDist = respondentRoleDistribution(assessment)
  b.bullets(roleDist, { title: '응답자 역할 분포', sources: refs })

  b.table(
    ['영역', '정규화 점수', '측정 여부', '영역 신뢰도'],
    domainScoreRows(assessment.domainScores),
    { title: '영역별 결과 (미측정 영역은 0점이 아닌 “미측정”으로 표기)', sources: refs },
  )

  b.bullets(assessment.keyStrengths, { title: '핵심 강점', sources: refs })
  b.bullets(assessment.keyWeaknesses, { title: '핵심 약점', sources: refs })
  b.bullets(assessment.keyRisks, { title: '핵심 위험', sources: refs })
  b.bullets(assessment.missingDataSummary, { title: '누락·확인 필요 데이터', sources: refs })
  b.bullets(assessment.conflictSummary, { title: '응답 일치·불일치', sources: refs })
  b.numbered(assessment.suggestedNextActions, { title: '추가 질문·확인 필요' })

  b.callout(
    `본 요약은 확정 규칙(v${assessment.ruleVersion})으로 계산된 진단 결과 v${assessment.version}에 근거합니다. 자유 서술 응답은 해석하지 않고 계산된 값과 근거만 제시합니다.`,
    { title: '근거', tone: 'info' },
  )

  return {
    type: 'diagnosis_summary',
    track: 'overview',
    title: '진단 요약',
    subtitle: '조사 대상 · 영역별 결과 · 신뢰도',
    summary: `응답자 ${sources.submittedResponseIds.length}명 기준 진단 결과 요약 (신뢰도 ${CONFIDENCE_META[assessment.confidence].label}).`,
    blocks: b.build(),
    sourceReferences: refs,
    visibility: 'shared',
    required: true,
  }
}

/* ------------------------------------------------------------------ */
/* ax_suitability (AX 트랙 전용)                                         */
/* ------------------------------------------------------------------ */

function axSuitabilitySeed(assessment: AssessmentResult, refs: string[]): SectionSeed {
  const rec = RECOMMENDATION_META[assessment.recommendation]
  const b = new BlockBuilder('ax-suit')
    .heading('AX 적합성')
    .callout(
      '이 점수는 “프로젝트의 AX 적합성”을 나타내며, 과제선정 단계의 개별 후보 점수와는 다른 지표입니다. 두 점수를 합산하거나 동일 지표로 비교하지 않습니다.',
      { title: '지표 안내', tone: 'info' },
    )
    .metric('프로젝트 AX 적합성 점수', `${assessment.finalScore}점`)
    .keyValue(
      [
        { key: '최종 판정', value: rec.label },
        { key: '판정 설명', value: rec.description },
        { key: '분석 신뢰도', value: CONFIDENCE_META[assessment.confidence].label },
      ],
      { title: '판정', sources: refs },
    )

  if (assessment.recommendationExceptionReason) {
    b.callout(assessment.recommendationExceptionReason, { title: '예외 판정 사유', tone: 'warning' })
  }

  b.table(
    ['영역', '정규화 점수', '측정 여부', '영역 신뢰도'],
    domainScoreRows(assessment.domainScores),
    { title: '영역별 적합성 (미측정 영역은 “미측정”)', sources: refs },
  )

  return {
    type: 'ax_suitability',
    track: 'ax',
    title: 'AX 적합성',
    subtitle: '프로젝트 AX 적합성 점수 · 판정',
    summary: `AX 적합성 ${assessment.finalScore}점 · ${rec.label}.`,
    blocks: b.build(),
    sourceReferences: refs,
    visibility: 'shared',
    required: false,
  }
}

/* ------------------------------------------------------------------ */
/* website_readiness (홈페이지 트랙 전용)                                 */
/* ------------------------------------------------------------------ */

function websiteReadinessSeed(readiness: WebsiteReadinessResult, refs: string[]): SectionSeed {
  const rec = WEBSITE_RECOMMENDATION_META[readiness.recommendation]
  const rows = orderedWebsiteDomains(readiness.domains).map((d) => ({
    cells: [
      WEBSITE_DOMAIN_META[d.domain]?.label ?? d.domain,
      `${d.score}/${d.maxScore}`,
      SCORE_CONFIDENCE_META[d.confidence].label,
    ],
  }))

  const b = new BlockBuilder('web-ready')
    .heading('홈페이지 제작 준비도')
    .callout(
      '홈페이지 준비도는 AX 적합성과 별도 지표이며, 하나의 점수로 합산하지 않습니다.',
      { title: '지표 안내', tone: 'info' },
    )
    .metric('홈페이지 준비도 총점', `${readiness.overallScore}점`)
    .keyValue(
      [
        { key: '판정', value: rec.label },
        { key: '판정 설명', value: rec.description },
        { key: '분석 신뢰도', value: CONFIDENCE_META[readiness.confidence].label },
      ],
      { title: '판정', sources: refs },
    )
    .table(['영역', '점수', '영역 신뢰도'], rows, { title: '영역별 준비도', sources: refs })
    .bullets(readiness.missingContent, { title: '보완 필요 콘텐츠', sources: refs })
    .bullets(readiness.missingAssets, { title: '보완 필요 자산', sources: refs })
    .bullets(readiness.designRisks, { title: '디자인 위험', sources: refs })
    .numbered(readiness.nextActions, { title: '다음 단계' })

  return {
    type: 'website_readiness',
    track: 'website',
    title: '홈페이지 제작 준비도',
    subtitle: '준비도 총점 · 영역별 결과',
    summary: `홈페이지 준비도 ${readiness.overallScore}점 · ${rec.label}.`,
    blocks: b.build(),
    sourceReferences: refs,
    visibility: 'shared',
    required: false,
  }
}

/* ------------------------------------------------------------------ */
/* export                                                               */
/* ------------------------------------------------------------------ */

export function buildDiagnosisSeeds(sources: CollectedSources): SectionSeed[] {
  const refs = [sources.references.find((r) => r.sourceType === 'assessment' && r.available)?.id].filter(
    (id): id is string => Boolean(id),
  )

  const assessment = sources.assessment
  if (!assessment) {
    return [unresolvedSeed(refs)]
  }

  const seeds: SectionSeed[] = [summarySeed(assessment, sources, refs)]

  const projectType = sources.project.projectType
  const isAx = projectType === 'ax' || projectType === 'ax_website'
  const isWebsite = projectType === 'website' || projectType === 'ax_website'

  if (isAx) {
    seeds.push(axSuitabilitySeed(assessment, refs))
  }
  if (isWebsite && assessment.websiteReadiness) {
    seeds.push(websiteReadinessSeed(assessment.websiteReadiness, refs))
  }

  return seeds
}
