import type { CollectedSources } from './sourceCollector'
import type { SectionSeed } from './sectionFactory'
import { PROJECT_TYPE_META, mvpLevelLabel } from '../../lib/domainMeta'
import { WEBSITE_TYPE_META } from '../../lib/websiteDesignMeta'
import { DECISION_META } from '../../lib/validationMeta'
import { BlockBuilder, NEEDS } from './contentBlocks'
import type { DeliverablePackageType } from '../../types/deliverables'

function refId(sources: CollectedSources, type: string): string[] {
  const id = sources.references.find((r) => r.sourceType === type && r.available)?.id
  return id ? [id] : []
}

/** 검증 상태 문구 (근거 없는 '검증 완료' 금지) */
function validationStatusText(sources: CollectedSources): string {
  const ax = sources.axValidationHandoff
  const web = sources.websiteValidationHandoff
  if (!ax && !web) return NEEDS.beforeTest
  const parts: string[] = []
  if (ax) parts.push(`AX: ${DECISION_META[ax.finalDecision.type ?? 'hold'].label}`)
  if (web) parts.push(`홈페이지: ${DECISION_META[web.finalDecision.type ?? 'hold'].label}`)
  return parts.join(' · ')
}

/** 표지 */
export function buildCoverSeed(sources: CollectedSources, packageType: DeliverablePackageType, packageName: string): SectionSeed {
  const org = sources.organization
  const b = new BlockBuilder('cover')
    .heading(packageName)
    .keyValue([
      { key: '고객사', value: org?.name ?? '미상' },
      { key: '프로젝트', value: sources.project.name },
      { key: '프로젝트 유형', value: PROJECT_TYPE_META[sources.project.projectType].label },
    ])
  if (packageType === 'institution_preparation') {
    b.warning('현재 자료는 기관 제출을 위한 내부 준비본이며 공식 신청서가 아닙니다. 기관 제출 전 실제 공고문·신청서식·제출 기준을 별도로 확인해야 합니다.', { title: '기관 제출 준비 고지' })
  }
  return { type: 'cover', track: 'overview', title: packageName, blocks: b.build(), visibility: 'shared', required: true }
}

/** 1페이지 요약 — 프로젝트 한눈에 보기 */
export function buildOnePageOverviewSeed(sources: CollectedSources): SectionSeed {
  const { project, organization, assessment, selectionHandoff, mvpHandoff, websiteHandoff } = sources
  const b = new BlockBuilder('onepage')

  b.keyValue([
    { key: '고객사', value: organization?.name ?? '미상' },
    { key: '업종', value: organization?.industry ?? '미상' },
    { key: '프로젝트명', value: project.name },
    { key: '프로젝트 유형', value: PROJECT_TYPE_META[project.projectType].label },
  ], { title: '기본 정보' })

  const problem = selectionHandoff?.problemDefinition || mvpHandoff?.problemStatement || project.objective || NEEDS.estimate
  const users = selectionHandoff?.targetUsers || mvpHandoff?.targetUsers || websiteHandoff?.strategy.audiences.map((a) => a.name).join(', ') || NEEDS.estimate
  b.paragraph(`현재 문제: ${problem}`, { sources: refId(sources, 'selection_handoff') })
  b.paragraph(`대상 사용자: ${users}`)

  if (assessment) {
    b.metric('진단 핵심 결과', `${assessment.recommendation ? '적합도 판정 있음' : ''} 신뢰도 ${assessment.confidence}`, { sources: refId(sources, 'assessment') })
  } else {
    b.paragraph('진단 핵심 결과: 진단 미확정')
  }

  if (selectionHandoff?.primaryCandidate) {
    b.paragraph(`선택한 핵심 과제: ${selectionHandoff.primaryCandidate.name}`, { sources: refId(sources, 'selection_handoff') })
  }
  if (mvpHandoff) {
    b.paragraph(`AX MVP 수준: ${mvpLevelLabel(mvpHandoff.selectedLevel, project.projectType)}`)
  }
  if (websiteHandoff) {
    b.paragraph(`홈페이지 유형: ${WEBSITE_TYPE_META[websiteHandoff.strategy.websiteType].label}`)
  }

  const scope: string[] = []
  if (mvpHandoff) scope.push(`AX 핵심 기능 ${mvpHandoff.mustFeatures.length}개`)
  if (websiteHandoff) scope.push(`홈페이지 페이지 ${websiteHandoff.pages.length}개`)
  if (scope.length) b.bullets(scope, { title: '주요 범위' })

  // 핵심 KPI — 숫자 없으면 임의 생성 금지
  const kpis: string[] = []
  if (mvpHandoff) mvpHandoff.kpiSummaries.slice(0, 3).forEach((k) => kpis.push(k))
  if (kpis.length) b.bullets(kpis, { title: '핵심 KPI' })
  else b.paragraph(`핵심 KPI: 기준값 ${NEEDS.measure}`)

  b.metric('현재 검증 상태', validationStatusText(sources))
  b.paragraph(`기관 제출 가능성: ${NEEDS.institutionReview}`)

  // 주요 위험
  const risks = [
    ...(selectionHandoff?.risks ?? []),
    ...(websiteHandoff?.risks ?? []),
  ].slice(0, 3)
  if (risks.length) b.bullets(risks, { title: '주요 위험' })

  b.paragraph(`다음 행동: ${project.nextAction || NEEDS.estimate}`)

  return {
    type: 'executive_summary',
    track: 'overview',
    title: '프로젝트 한눈에 보기',
    subtitle: '1페이지 요약',
    summary: '고객·개발자·기관 설명 시 첫 페이지로 사용하는 한 장 요약입니다.',
    blocks: b.build(),
    visibility: 'shared',
    required: true,
  }
}

/** 고객사 정보 (연락처는 개인정보이므로 내부 전용 블록) */
export function buildCompanyProfileSeed(sources: CollectedSources): SectionSeed {
  const org = sources.organization
  const b = new BlockBuilder('company')
  b.keyValue([
    { key: '고객사명', value: org?.name ?? '미상' },
    { key: '업종', value: org?.industry ?? '미상' },
    { key: '세부 업종', value: org?.subIndustry ?? '' },
    { key: '지역', value: org?.region ?? '' },
    { key: '직원 규모', value: org?.employeeCount ? `${org.employeeCount}명` : '미상' },
  ], { title: '기업 개요' })
  if (org?.primaryContact?.name) {
    b.keyValue([
      { key: '담당자', value: org.primaryContact.name },
      { key: '직위', value: org.primaryContact.position },
      { key: '연락처', value: org.primaryContact.phone },
      { key: '이메일', value: org.primaryContact.email },
    ], { title: '담당자 정보 (내부 전용)', internalOnly: true })
  }
  return { type: 'company_profile', track: 'overview', title: '고객사 정보', blocks: b.build(), sourceReferences: refId(sources, 'organization'), visibility: 'shared' }
}

/** 프로젝트 개요 */
export function buildProjectOverviewSeed(sources: CollectedSources): SectionSeed {
  const p = sources.project
  const b = new BlockBuilder('project')
    .keyValue([
      { key: '프로젝트명', value: p.name },
      { key: '유형', value: PROJECT_TYPE_META[p.projectType].label },
      { key: '현재 단계', value: p.currentStage },
    ], { title: '프로젝트 정보' })
    .paragraph(`프로젝트 목표: ${p.objective || NEEDS.estimate}`)
  if (p.riskSummary) b.callout(p.riskSummary, { title: '리스크 요약 (내부)', tone: 'warning', internalOnly: true })
  return { type: 'project_overview', track: 'overview', title: '프로젝트 개요', blocks: b.build(), sourceReferences: refId(sources, 'project'), visibility: 'shared' }
}

/** 개요 트랙 seed 모음 */
export function buildOverviewSeeds(sources: CollectedSources, packageType: DeliverablePackageType, packageName: string): SectionSeed[] {
  return [
    buildCoverSeed(sources, packageType, packageName),
    buildOnePageOverviewSeed(sources),
    buildCompanyProfileSeed(sources),
    buildProjectOverviewSeed(sources),
  ]
}
