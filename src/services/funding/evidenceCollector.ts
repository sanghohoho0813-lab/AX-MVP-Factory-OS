import type { Organization, Project } from '../../types/domain'
import type { AssessmentResult } from '../../types/assessment'
import type { SelectionHandoffSnapshot } from '../../types/selection'
import type { MvpDesignHandoffSnapshot } from '../../types/mvpDesign'
import type { WebsiteDesignHandoffSnapshot } from '../../types/websiteDesign'
import type { ValidationHandoffSnapshot } from '../../types/validation'
import type { DeliverablePackage } from '../../types/deliverables'
import type {
  EvidenceSourceType,
  FundingEvidence,
  FundingSourceReference,
} from '../../types/funding'
import {
  assessmentRepository,
  deliverablePackageRepository,
  mvpDesignHandoffRepository,
  mvpDesignRepository,
  organizationRepository,
  projectRepository,
  selectionDecisionRepository,
  selectionHandoffRepository,
  validationHandoffRepository,
  validationWorkspaceRepository,
  websiteDesignHandoffRepository,
  websiteDesignRepository,
} from '../../repositories'

const ISO = '1970-01-01T00:00:00.000Z'

export interface CollectedFundingSources {
  organization: Organization | null
  project: Project
  assessment: AssessmentResult | null
  selectionHandoff: SelectionHandoffSnapshot | null
  mvpHandoff: MvpDesignHandoffSnapshot | null
  websiteHandoff: WebsiteDesignHandoffSnapshot | null
  axValidationHandoff: ValidationHandoffSnapshot | null
  websiteValidationHandoff: ValidationHandoffSnapshot | null
  deliverablePackages: DeliverablePackage[]
  evidence: FundingEvidence[]
  references: FundingSourceReference[]
}

let seq = 0
function ev(
  sourceType: EvidenceSourceType,
  sourceId: string,
  label: string,
  value: string,
  unit: string,
  opts: { verified?: boolean; sensitive?: boolean; description?: string } = {},
): FundingEvidence {
  seq += 1
  return {
    id: `fev-${seq}`,
    sourceType,
    sourceId,
    label,
    description: opts.description ?? '',
    value,
    unit,
    evidenceDate: ISO,
    verified: opts.verified ?? false,
    verificationNote: '',
    sensitive: opts.sensitive ?? false,
    relatedMatchIds: [],
    createdAt: ISO,
    updatedAt: ISO,
  }
}

function ref(sourceType: EvidenceSourceType, sourceId: string, label: string, version: number, available: boolean): FundingSourceReference {
  return { sourceType, sourceId, label, version, available, capturedAt: ISO }
}

function finalizedMvp(projectId: string) {
  const d = mvpDesignRepository.getByProjectId(projectId).find((x) => x.status === 'finalized')
  return d ? { design: d, handoff: mvpDesignHandoffRepository.getByDesignId(d.id) } : null
}
function finalizedWebsite(projectId: string) {
  const d = websiteDesignRepository.getByProjectId(projectId).find((x) => x.status === 'finalized')
  return d ? { design: d, handoff: websiteDesignHandoffRepository.getByDesignId(d.id) } : null
}
function finalizedValidation(projectId: string, track: 'ax_mvp' | 'website') {
  const w = validationWorkspaceRepository.getByProjectAndTrack(projectId, track).find((x) => x.status === 'finalized')
  return w ? validationHandoffRepository.getByWorkspaceId(w.id) : null
}

/**
 * 프로젝트의 확정 스냅샷에서 자금 연계 근거를 수집한다.
 * 데이터가 없으면 근거를 만들지 않는다(빈 값을 불리한 0으로 계산하지 않음).
 * 다른 프로젝트의 근거를 섞지 않는다.
 */
export function collectFundingSources(projectId: string): CollectedFundingSources | null {
  const project = projectRepository.getById(projectId)
  if (!project) return null
  seq = 0
  const organization = organizationRepository.getById(project.organizationId)
  const assessmentLatest = assessmentRepository.getLatestByProjectId(projectId)
  const assessment = assessmentLatest && assessmentLatest.status === 'finalized' ? assessmentLatest : null
  const decision = selectionDecisionRepository.getLatestByProjectId(projectId)
  const selectionHandoff = decision && decision.status === 'finalized' ? selectionHandoffRepository.getBySelectionDecisionId(decision.id) : null
  const mvp = finalizedMvp(projectId)
  const web = finalizedWebsite(projectId)
  const axVal = finalizedValidation(projectId, 'ax_mvp')
  const webVal = finalizedValidation(projectId, 'website')
  const deliverablePackages = deliverablePackageRepository.getByProjectId(projectId).filter((p) => p.status === 'finalized')

  const evidence: FundingEvidence[] = []

  // 기업 기본 근거
  if (organization) {
    if (organization.industry) evidence.push(ev('organization', organization.id, '업종', organization.industry, '', { verified: true }))
    if (organization.region) evidence.push(ev('organization', organization.id, '지역', organization.region, '', { verified: true }))
    if (organization.foundedAt) evidence.push(ev('organization', organization.id, '설립일', organization.foundedAt, '', { verified: true }))
    if (organization.employeeCount !== null) evidence.push(ev('organization', organization.id, '직원 수', String(organization.employeeCount), '명', { verified: true }))
    if (organization.annualRevenue !== null) evidence.push(ev('organization', organization.id, '연매출', String(organization.annualRevenue), '원', { verified: true, sensitive: true }))
    if (organization.businessRegistrationNumber) evidence.push(ev('organization', organization.id, '사업자등록', '보유', '', { verified: true, sensitive: true }))
  }

  // 프로젝트 근거
  evidence.push(ev('project', project.id, '자금 용도(프로젝트 목적)', project.objective || '미입력', ''))

  // 진단 근거
  if (assessment) {
    evidence.push(ev('assessment', assessment.id, 'AX 적합성 진단', `종합 ${assessment.finalScore}점 · ${assessment.confidence}`, '', { verified: true, description: '프로젝트 AX 적합성 (후보 점수와 다름)' }))
    if (assessment.websiteReadiness) {
      evidence.push(ev('assessment', assessment.id, '홈페이지 준비도', `${assessment.websiteReadiness.overallScore}점`, '', { verified: true }))
    }
  }

  // 과제선정 근거
  if (selectionHandoff) {
    if (selectionHandoff.primaryCandidate) evidence.push(ev('selection', selectionHandoff.id, '핵심 자동화 과제', selectionHandoff.primaryCandidate.name, ''))
    selectionHandoff.expectedKpis.forEach((k) => evidence.push(ev('selection', selectionHandoff.id, '기대 KPI', k, '')))
  }

  // MVP 설계 근거 (기술성·혁신성)
  if (mvp?.handoff) {
    const h = mvp.handoff
    evidence.push(ev('mvp_design', h.id, 'AX MVP 설계', `${h.coreTaskName} · 수준 ${h.selectedLevel}`, ''))
    if (h.aiFeatureNames.length > 0) evidence.push(ev('mvp_design', h.id, 'AI 활용 기능', h.aiFeatureNames.join(', '), '', { description: '기술성·혁신성 근거' }))
    if (h.integrationNames.length > 0) evidence.push(ev('mvp_design', h.id, '외부 연동', h.integrationNames.join(', '), ''))
    h.kpiSummaries.slice(0, 3).forEach((k) => evidence.push(ev('mvp_design', h.id, '개선 KPI', k, '')))
  }

  // 홈페이지 설계 근거
  if (web?.handoff) {
    evidence.push(ev('website_design', web.handoff.id, '홈페이지 설계', web.handoff.strategy.purpose || '홈페이지 제작', ''))
  }

  // 검증 근거 (실증 상태)
  if (axVal) evidence.push(ev('validation', axVal.id, 'AX 실제 사용 테스트', axVal.finalDecision.type ?? '진행', '', { verified: true }))
  if (webVal) evidence.push(ev('validation', webVal.id, '홈페이지 테스트', webVal.finalDecision.type ?? '진행', '', { verified: true }))

  // 제출자료 근거
  deliverablePackages.forEach((p) => evidence.push(ev('deliverable', p.id, '제출자료', p.name, '', { verified: true, description: '연결 가능한 확정 자료' })))

  const references: FundingSourceReference[] = [
    ref('organization', organization?.id ?? '', `고객사 · ${organization?.name ?? '미상'}`, 0, organization !== null),
    ref('project', project.id, `프로젝트 · ${project.name}`, 0, true),
    ref('assessment', assessment?.id ?? '', assessment ? `진단 v${assessment.version}` : '진단 (미확정)', assessment?.version ?? 0, assessment !== null),
    ref('selection', selectionHandoff?.id ?? '', selectionHandoff ? '과제선정 인계' : '과제선정 (없음)', selectionHandoff?.selectionVersion ?? 0, selectionHandoff !== null),
    ref('mvp_design', mvp?.handoff?.id ?? '', mvp?.handoff ? `AX MVP 설계 v${mvp.design.version}` : 'AX MVP 설계 (없음)', mvp?.design.version ?? 0, Boolean(mvp?.handoff)),
    ref('website_design', web?.handoff?.id ?? '', web?.handoff ? `홈페이지 설계 v${web.design.version}` : '홈페이지 설계 (없음)', web?.design.version ?? 0, Boolean(web?.handoff)),
    ref('validation', axVal?.id ?? webVal?.id ?? '', axVal || webVal ? '실제 사용 테스트' : '테스트 (없음)', axVal?.version ?? webVal?.version ?? 0, Boolean(axVal || webVal)),
    ref('deliverable', deliverablePackages[0]?.id ?? '', deliverablePackages.length > 0 ? `제출자료 ${deliverablePackages.length}건` : '제출자료 (없음)', 0, deliverablePackages.length > 0),
  ]

  return {
    organization,
    project,
    assessment,
    selectionHandoff,
    mvpHandoff: mvp?.handoff ?? null,
    websiteHandoff: web?.handoff ?? null,
    axValidationHandoff: axVal,
    websiteValidationHandoff: webVal,
    deliverablePackages,
    evidence,
    references,
  }
}

export function computeFundingSourceHash(sources: CollectedFundingSources): string {
  return sources.references.filter((r) => r.available).map((r) => `${r.sourceType}:${r.version}`).join('|')
}

export interface FundingEligibility {
  canCreate: boolean
  hasDiagnosis: boolean
  hasSelection: boolean
  hasMvp: boolean
  hasWebsite: boolean
  hasDeliverable: boolean
  reasons: string[]
}

export function evaluateFundingEligibility(sources: CollectedFundingSources): FundingEligibility {
  const hasDiagnosis = sources.assessment !== null
  const hasSelection = sources.selectionHandoff !== null
  const hasMvp = sources.mvpHandoff !== null
  const hasWebsite = sources.websiteHandoff !== null
  const hasDeliverable = sources.deliverablePackages.length > 0
  const reasons: string[] = []
  if (!hasDiagnosis) reasons.push('확정된 진단 결과가 있으면 연계 근거가 풍부해집니다.')
  if (!hasMvp && !hasWebsite) reasons.push('AX MVP 설계 또는 홈페이지 설계가 확정되면 기술·사업 근거를 연결할 수 있습니다.')
  const canCreate = hasDiagnosis || hasMvp || hasWebsite || hasDeliverable
  return { canCreate, hasDiagnosis, hasSelection, hasMvp, hasWebsite, hasDeliverable, reasons }
}
