import type { Organization, Project } from '../types/domain'
import type { AssessmentResult } from '../types/assessment'
import type {
  AutomationCandidate,
  CandidateScoreDomain,
  CandidateSelectionReason,
  SelectedCandidateReference,
  SelectionDecision,
  SelectionHandoffSnapshot,
} from '../types/selection'
import {
  activityRepository,
  analysisIssueRepository,
  assessmentRepository,
  automationCandidateRepository,
  interviewQuestionRepository,
  organizationRepository,
  projectRepository,
  selectionDecisionRepository,
  selectionHandoffRepository,
} from '../repositories'
import { CURRENT_USER } from '../data/demo'
import { needsReanalysis } from './assessmentService'
import { gatherAnalysisDataset } from './assessment/analysisData'
import { CANDIDATE_DOMAIN_MAX, SELECTION_RULE_VERSION } from './selection/scoringConfig'
import { generateCandidates } from './selection/selectionOrchestrator'
import { computePriority } from './selection/candidateScoring'
import {
  buildSelectionSummary,
  isSelectable,
  recommendCandidates,
  suggestPrimaryKpis,
} from './selection/selectionRecommendation'
import { buildHandoffSnapshot } from './selection/selectionHandoffBuilder'

function nowIso(): string {
  return new Date().toISOString()
}

/* ------------------------------------------------------------------ */
/* 자격·라이프사이클                                                    */
/* ------------------------------------------------------------------ */

export type SelectionLifecycle =
  | 'website_only'
  | 'not_eligible'
  | 'ready_to_extract'
  | 'candidates_ready'
  | 'draft'
  | 'reviewed'
  | 'finalized'
  | 'needs_reselection'

export interface SelectionEligibility {
  canExtract: boolean
  canFinalize: boolean
  reasons: string[]
  websiteRedirect: boolean
  assessment: AssessmentResult | null
}

const DEFERRED_RECOMMENDATIONS = new Set([
  'build_deferred_data',
  'build_deferred_adoption',
  'expert_review_required',
])

export function getSelectionEligibility(project: Project): SelectionEligibility {
  const reasons: string[] = []
  if (project.projectType === 'website') {
    return { canExtract: false, canFinalize: false, reasons: ['홈페이지 단독 프로젝트입니다.'], websiteRedirect: true, assessment: null }
  }
  const assessment = assessmentRepository.getLatestByProjectId(project.id)
  if (!assessment) {
    return { canExtract: false, canFinalize: false, reasons: ['먼저 진단 분석을 실행하고 결과를 확정해야 합니다.'], websiteRedirect: false, assessment: null }
  }
  if (assessment.sourceResponseIds.length === 0) {
    return { canExtract: false, canFinalize: false, reasons: ['진단에 사용된 제출 응답이 없습니다.'], websiteRedirect: false, assessment }
  }
  // 추출(미리보기)은 가능. 확정 조건은 별도.
  const canExtract = true

  if (assessment.status !== 'finalized') {
    reasons.push('최신 설문 응답을 반영해 진단 결과를 확정해야 합니다.')
  }
  if (needsReanalysis(assessment)) {
    reasons.push('새로운 제출 응답이 있어 진단 결과를 다시 확정해야 합니다.')
  }
  if (assessment.confidence === 'insufficient') {
    reasons.push('진단 신뢰도가 데이터 미달이라 확정할 수 없습니다.')
  }
  if (DEFERRED_RECOMMENDATIONS.has(assessment.recommendation)) {
    reasons.push('현재 진단 판정이 구축 보류·전문가 검토 상태입니다. 판정을 재검토한 뒤 확정하세요.')
  }
  const criticalOpen = analysisIssueRepository
    .getByProjectId(project.id)
    .some((i) => i.severity === 'critical' && i.status === 'open' && (i.type === 'expert_review' || i.type === 'risk_signal'))
  if (criticalOpen) {
    reasons.push('전문가·위험 관련 중대 이슈를 먼저 확인해야 합니다.')
  }

  return { canExtract, canFinalize: reasons.length === 0, reasons, websiteRedirect: false, assessment }
}

/** 선정이 확정보다 오래되어 재선별이 필요한지 */
export function needsReselection(decision: SelectionDecision): boolean {
  const assessment = assessmentRepository.getLatestByProjectId(decision.projectId)
  if (!assessment) return false
  if (assessment.version !== decision.assessmentVersion) return true
  if (assessment.status === 'finalized' && needsReanalysis(assessment)) return true
  const primary = decision.primaryCandidateId
    ? automationCandidateRepository.getById(decision.primaryCandidateId)
    : null
  if (decision.primaryCandidateId && (!primary || primary.status === 'archived')) return true
  return false
}

export function getProjectSelectionLifecycle(project: Project): SelectionLifecycle {
  if (project.projectType === 'website') return 'website_only'
  const eligibility = getSelectionEligibility(project)
  if (!eligibility.assessment) return 'not_eligible'
  const decision = selectionDecisionRepository.getLatestByProjectId(project.id)
  if (decision) {
    if (decision.status === 'finalized') {
      return needsReselection(decision) ? 'needs_reselection' : 'finalized'
    }
    if (decision.status === 'reviewed') return 'reviewed'
    if (decision.status === 'draft') return 'draft'
  }
  const candidates = automationCandidateRepository.getByProjectId(project.id)
  return candidates.length > 0 ? 'candidates_ready' : 'ready_to_extract'
}

/** 대시보드 KPI: 선별 대기(확정 진단 있음·선정 미확정·website 제외) */
export function countSelectionPending(): number {
  return projectRepository.getAll().filter((p) => {
    if (p.projectType === 'website') return false
    const assessment = assessmentRepository.getLatestByProjectId(p.id)
    if (!assessment || assessment.status !== 'finalized') return false
    const decision = selectionDecisionRepository.getLatestByProjectId(p.id)
    return !decision || decision.status !== 'finalized' || needsReselection(decision)
  }).length
}

/* ------------------------------------------------------------------ */
/* 후보 추출/재추출                                                      */
/* ------------------------------------------------------------------ */

export class SelectionBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SelectionBlockedError'
  }
}

export function runOrRefreshCandidates(projectId: string): AutomationCandidate[] {
  const project = projectRepository.getById(projectId)
  if (!project) throw new SelectionBlockedError('프로젝트를 찾을 수 없습니다.')
  const eligibility = getSelectionEligibility(project)
  if (!eligibility.canExtract || !eligibility.assessment) {
    throw new SelectionBlockedError(eligibility.reasons[0] ?? '후보를 추출할 수 없습니다.')
  }
  const dataset = gatherAnalysisDataset(projectId)
  if (!dataset || dataset.respondents.length === 0) {
    throw new SelectionBlockedError('분석에 사용할 제출 응답이 없습니다.')
  }
  const issues = analysisIssueRepository.getByProjectId(projectId)
  const interviews = interviewQuestionRepository.getByProjectId(projectId)
  const { candidates } = generateCandidates(dataset, eligibility.assessment, issues, interviews)

  const saved = automationCandidateRepository.replaceAutoGenerated(
    projectId,
    eligibility.assessment.id,
    candidates,
  )

  activityRepository.add({
    organizationId: project.organizationId,
    projectId,
    activityType: 'project_updated',
    title: '자동화 후보 과제가 추출되었습니다.',
    description: `후보 ${candidates.length}건 (규칙 v${SELECTION_RULE_VERSION})`,
    actorName: CURRENT_USER.name,
  })
  return saved
}

/* ------------------------------------------------------------------ */
/* 후보 편집 / 병합 / 상태                                               */
/* ------------------------------------------------------------------ */

function recomputeCandidateTotals(candidate: AutomationCandidate): AutomationCandidate {
  const { subtotalScore, deductionTotal, priorityScore } = computePriority(
    candidate.domainScores,
    candidate.deductions,
  )
  return { ...candidate, subtotalScore, deductionTotal, priorityScore }
}

export class CandidateEditError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CandidateEditError'
  }
}

export function updateCandidate(
  id: string,
  patch: Partial<AutomationCandidate>,
): AutomationCandidate {
  return automationCandidateRepository.update(id, patch)
}

export function setCandidateStatus(
  id: string,
  status: AutomationCandidate['status'],
): AutomationCandidate {
  return automationCandidateRepository.update(id, { status })
}

export function archiveCandidate(id: string): AutomationCandidate {
  return automationCandidateRepository.archive(id)
}

export function adjustCandidateDomainScore(
  candidateId: string,
  domain: CandidateScoreDomain,
  afterScore: number,
  reason: string,
): AutomationCandidate {
  const candidate = automationCandidateRepository.getById(candidateId)
  if (!candidate) throw new CandidateEditError('후보를 찾을 수 없습니다.')
  if (reason.trim() === '') throw new CandidateEditError('보정 사유를 입력해야 합니다.')
  const max = CANDIDATE_DOMAIN_MAX[domain]
  if (afterScore < 0 || afterScore > max) {
    throw new CandidateEditError(`보정 점수는 0 ~ ${max} 범위여야 합니다.`)
  }
  const rounded = Math.round(afterScore * 10) / 10
  const domainScores = candidate.domainScores.map((d) =>
    d.domain === domain
      ? {
          ...d,
          adjustedScore: rounded,
          normalizedScore: d.maxScore > 0 ? Math.round((rounded / d.maxScore) * 100) : 0,
          adjustmentReason: reason.trim(),
        }
      : d,
  )
  const updated = recomputeCandidateTotals({ ...candidate, domainScores })
  return automationCandidateRepository.update(candidateId, {
    domainScores: updated.domainScores,
    subtotalScore: updated.subtotalScore,
    deductionTotal: updated.deductionTotal,
    priorityScore: updated.priorityScore,
  })
}

export function toggleCandidateDeduction(
  candidateId: string,
  deductionId: string,
  excluded: boolean,
  exclusionReason: string,
): AutomationCandidate {
  const candidate = automationCandidateRepository.getById(candidateId)
  if (!candidate) throw new CandidateEditError('후보를 찾을 수 없습니다.')
  if (excluded && exclusionReason.trim() === '') {
    throw new CandidateEditError('감점 제외 사유를 입력해야 합니다.')
  }
  const deductions = candidate.deductions.map((d) =>
    d.id === deductionId ? { ...d, excluded, exclusionReason: excluded ? exclusionReason.trim() : '' } : d,
  )
  const updated = recomputeCandidateTotals({ ...candidate, deductions })
  return automationCandidateRepository.update(candidateId, {
    deductions: updated.deductions,
    subtotalScore: updated.subtotalScore,
    deductionTotal: updated.deductionTotal,
    priorityScore: updated.priorityScore,
  })
}

export function mergeCandidates(
  _projectId: string,
  sourceIds: string[],
  targetId: string,
  mergedName: string,
  mergedProblem: string,
): AutomationCandidate {
  const target = automationCandidateRepository.getById(targetId)
  if (!target) throw new CandidateEditError('병합 대상 후보를 찾을 수 없습니다.')
  const sources = sourceIds
    .filter((id) => id !== targetId)
    .map((id) => automationCandidateRepository.getById(id))
    .filter((c): c is AutomationCandidate => c !== null)

  const mergedTarget: AutomationCandidate = {
    ...target,
    name: mergedName.trim() || target.name,
    problemStatement: mergedProblem.trim() || target.problemStatement,
    sourceEvidenceIds: [...new Set([...target.sourceEvidenceIds, ...sources.flatMap((s) => s.sourceEvidenceIds)])],
    sourceQuestionCodes: [...new Set([...target.sourceQuestionCodes, ...sources.flatMap((s) => s.sourceQuestionCodes)])],
    sourceTypes: [...new Set([...target.sourceTypes, ...sources.flatMap((s) => s.sourceTypes)])],
    mergedFromIds: [...new Set([...target.mergedFromIds, ...sources.map((s) => s.id)])],
    status: target.status === 'discovered' ? 'reviewing' : target.status,
  }
  return automationCandidateRepository.merge([targetId, ...sourceIds], mergedTarget)
}

let manualSeq = 0
export function addManualCandidate(
  projectId: string,
  input: {
    name: string
    problemStatement: string
    currentProcess: string
    users: string
    monthlyVolume: number | null
    minutesPerCase: number | null
    expectedEffect: string
    reason: string
  },
): AutomationCandidate {
  const project = projectRepository.getById(projectId)
  if (!project) throw new CandidateEditError('프로젝트를 찾을 수 없습니다.')
  const assessment = assessmentRepository.getLatestByProjectId(projectId)
  manualSeq += 1
  const key = `manual|${Date.now()}-${manualSeq}`
  const metrics = []
  if (input.monthlyVolume !== null) {
    metrics.push({ id: `m-${key}-volume`, type: 'monthly_volume' as const, label: '월 처리건수', value: input.monthlyVolume, unit: '건', sourceEvidenceIds: [], confidence: 'medium' as const, manuallyEdited: true, editReason: '수동 입력' })
  }
  if (input.minutesPerCase !== null) {
    metrics.push({ id: `m-${key}-time`, type: 'time_per_case_minutes' as const, label: '건당 소요시간', value: input.minutesPerCase, unit: '분', sourceEvidenceIds: [], confidence: 'medium' as const, manuallyEdited: true, editReason: '수동 입력' })
  }
  if (input.monthlyVolume !== null && input.minutesPerCase !== null) {
    metrics.push({ id: `m-${key}-hours`, type: 'monthly_hours' as const, label: '월 총 업무시간', value: Math.round((input.monthlyVolume * input.minutesPerCase) / 60 * 10) / 10, unit: '시간', sourceEvidenceIds: [], confidence: 'medium' as const, manuallyEdited: true, editReason: '자동 계산' })
  }
  return automationCandidateRepository.create({
    projectId,
    organizationId: project.organizationId,
    assessmentId: assessment?.id ?? '',
    assessmentVersion: assessment?.version ?? 0,
    name: input.name.trim() || '수동 후보',
    nameNeedsReview: false,
    problemStatement: input.problemStatement.trim(),
    currentProcess: input.currentProcess.trim(),
    trigger: '',
    users: input.users.trim(),
    ownerRole: 'unknown',
    inputData: '',
    outputResult: '',
    startCondition: '',
    endCondition: '',
    desiredProcess: '',
    excludedScope: '',
    taskFamily: 'other',
    sourceTypes: ['manual'],
    sourceEvidenceIds: [],
    sourceQuestionCodes: [],
    sourceIssueIds: [],
    sourceInterviewQuestionIds: [],
    metrics,
    expectedEffects: input.expectedEffect.trim()
      ? [{ id: `e-${key}-manual`, type: 'other', title: input.expectedEffect.trim(), currentValue: null, expectedValue: null, unit: '', calculationMethod: '', assumption: '담당자 입력', confidence: 'medium', evidenceIds: [], manuallyEdited: true, notEstimable: false, qualitative: true }]
      : [],
    automationRatioAssumption: 0.35,
    automationApproach: 'workflow_automation',
    automationApproachReason: '수동 추가 후보 — 담당자 검토 필요',
    aiNecessity: 'optional',
    aiReason: '담당자 판단 필요',
    humanReviewRequired: false,
    expertRiskGrade: 'green',
    privacyRisk: false,
    complexity: 'medium',
    dependencies: [],
    templateMix: [{ template: 'data_collection_validation', percentage: 100, reason: '수동 후보 기본 템플릿' }],
    recommendedMvpLevel: 2,
    domainScores: [],
    subtotalScore: 0,
    deductions: [],
    deductionTotal: 0,
    priorityScore: 0,
    confidence: 'low',
    confidenceReason: `담당자가 추가한 후보입니다. 추가 이유: ${input.reason.trim() || '미기재'}`,
    quadrant: 'strategic_bet',
    quadrantExceptionReason: '',
    status: 'reviewing',
    generationKey: key,
    autoGenerated: false,
    mergedFromIds: [],
    manualNotes: input.reason.trim(),
  })
}

/* ------------------------------------------------------------------ */
/* 선정 결과                                                            */
/* ------------------------------------------------------------------ */

export function computeSelectionHash(candidateIds: string[], assessmentVersion: number): string {
  return `${assessmentVersion}::${[...candidateIds].sort().join('|')}`
}

/** 현재 후보 + 추천을 반영한 draft SelectionDecision을 확보한다 */
export function ensureDraftDecision(projectId: string): SelectionDecision {
  const project = projectRepository.getById(projectId)
  if (!project) throw new SelectionBlockedError('프로젝트를 찾을 수 없습니다.')
  const assessment = assessmentRepository.getLatestByProjectId(projectId)
  if (!assessment) throw new SelectionBlockedError('확정된 진단 결과가 필요합니다.')
  const organization = organizationRepository.getById(project.organizationId)
  const candidates = automationCandidateRepository.getByProjectId(projectId)
  const rec = recommendCandidates(candidates)

  const existing = selectionDecisionRepository.getLatestByProjectId(projectId)
  if (existing && existing.status !== 'finalized' && existing.status !== 'superseded') {
    return existing
  }

  const autoSummary = buildSelectionSummary(project, organization, rec.primary, rec.secondary)
  const selectedCandidates: SelectedCandidateReference[] = []
  if (rec.primary) {
    selectedCandidates.push({ candidateId: rec.primary.id, selectionType: 'primary', rank: 1, reasons: rec.reasonsById[rec.primary.id] ?? ['manual_decision'], decisionNote: '' })
  }
  rec.secondary.forEach((c, i) =>
    selectedCandidates.push({ candidateId: c.id, selectionType: 'secondary', rank: i + 1, reasons: rec.reasonsById[c.id] ?? ['strategic_value'], decisionNote: '' }),
  )

  return selectionDecisionRepository.create({
    projectId,
    organizationId: project.organizationId,
    assessmentId: assessment.id,
    assessmentVersion: assessment.version,
    status: 'draft',
    candidateIds: candidates.map((c) => c.id),
    primaryCandidateId: rec.primary?.id ?? null,
    secondaryCandidateIds: rec.secondary.map((c) => c.id),
    selectedCandidates,
    deferredCandidateIds: [],
    rejectedCandidateIds: [],
    decisionSummary: '',
    autoSummary,
    decisionRisks: rec.primary ? rec.primary.deductions.filter((d) => !d.excluded).map((d) => d.reason) : [],
    prerequisiteActions: rec.primary ? rec.primary.dependencies.filter((d) => d.requiredBeforeMvp).map((d) => d.title) : [],
    expectedPrimaryKpis: suggestPrimaryKpis(rec.primary),
    recommendedTemplateMix: rec.primary?.templateMix ?? [],
    recommendedMvpLevel: rec.primary?.recommendedMvpLevel ?? 1,
    sourceSnapshotHash: computeSelectionHash(candidates.map((c) => c.id), assessment.version),
    ruleVersion: SELECTION_RULE_VERSION,
    createdBy: CURRENT_USER.name,
    reviewedBy: '',
    finalizedBy: '',
    reviewedAt: null,
    finalizedAt: null,
    supersededAt: null,
  })
}

export function updateDecision(id: string, patch: Partial<SelectionDecision>): SelectionDecision {
  return selectionDecisionRepository.update(id, patch)
}

/** primary 지정 (검증 + 후보 상태 반영) */
export function setPrimaryCandidate(decisionId: string, candidateId: string): SelectionDecision {
  const decision = selectionDecisionRepository.getById(decisionId)
  if (!decision) throw new SelectionBlockedError('선정 결과를 찾을 수 없습니다.')
  const candidate = automationCandidateRepository.getById(candidateId)
  if (!candidate) throw new SelectionBlockedError('후보를 찾을 수 없습니다.')
  if (!isSelectable(candidate)) {
    throw new SelectionBlockedError('이 후보는 중대 위험 또는 신뢰도 미달로 핵심 과제로 지정할 수 없습니다.')
  }
  if (decision.secondaryCandidateIds.includes(candidateId)) {
    throw new SelectionBlockedError('보조 과제로 지정된 후보는 핵심 과제로 동시에 지정할 수 없습니다.')
  }
  // 이전 primary 후보 상태 원복
  if (decision.primaryCandidateId && decision.primaryCandidateId !== candidateId) {
    const prev = automationCandidateRepository.getById(decision.primaryCandidateId)
    if (prev && prev.status === 'selected_primary') automationCandidateRepository.update(prev.id, { status: 'shortlisted' })
  }
  automationCandidateRepository.update(candidateId, { status: 'selected_primary' })
  const selected = decision.selectedCandidates.filter((s) => s.candidateId !== candidateId && s.selectionType !== 'primary')
  selected.unshift({ candidateId, selectionType: 'primary', rank: 1, reasons: ['manual_decision'], decisionNote: '' })
  return selectionDecisionRepository.update(decisionId, {
    primaryCandidateId: candidateId,
    selectedCandidates: selected,
    recommendedTemplateMix: candidate.templateMix,
    recommendedMvpLevel: candidate.recommendedMvpLevel,
  })
}

export function toggleSecondaryCandidate(decisionId: string, candidateId: string): SelectionDecision {
  const decision = selectionDecisionRepository.getById(decisionId)
  if (!decision) throw new SelectionBlockedError('선정 결과를 찾을 수 없습니다.')
  const isSecondary = decision.secondaryCandidateIds.includes(candidateId)
  if (!isSecondary) {
    if (candidateId === decision.primaryCandidateId) {
      throw new SelectionBlockedError('핵심 과제는 보조 과제로 동시에 지정할 수 없습니다.')
    }
    if (decision.secondaryCandidateIds.length >= 2) {
      throw new SelectionBlockedError('보조 과제는 최대 2개까지 지정할 수 있습니다.')
    }
    const candidate = automationCandidateRepository.getById(candidateId)
    if (!candidate || !isSelectable(candidate)) {
      throw new SelectionBlockedError('이 후보는 보조 과제로 지정할 수 없습니다.')
    }
    automationCandidateRepository.update(candidateId, { status: 'selected_secondary' })
    const secondary = [...decision.secondaryCandidateIds, candidateId]
    const selected = [
      ...decision.selectedCandidates.filter((s) => s.candidateId !== candidateId),
      { candidateId, selectionType: 'secondary' as const, rank: secondary.length, reasons: ['strategic_value' as CandidateSelectionReason], decisionNote: '' },
    ]
    return selectionDecisionRepository.update(decisionId, { secondaryCandidateIds: secondary, selectedCandidates: selected })
  }
  const candidate = automationCandidateRepository.getById(candidateId)
  if (candidate && candidate.status === 'selected_secondary') automationCandidateRepository.update(candidateId, { status: 'shortlisted' })
  return selectionDecisionRepository.update(decisionId, {
    secondaryCandidateIds: decision.secondaryCandidateIds.filter((id) => id !== candidateId),
    selectedCandidates: decision.selectedCandidates.filter((s) => s.candidateId !== candidateId),
  })
}

export function setCandidateDecisionBucket(
  decisionId: string,
  candidateId: string,
  bucket: 'deferred' | 'rejected' | 'none',
): SelectionDecision {
  const decision = selectionDecisionRepository.getById(decisionId)
  if (!decision) throw new SelectionBlockedError('선정 결과를 찾을 수 없습니다.')
  const deferred = decision.deferredCandidateIds.filter((id) => id !== candidateId)
  const rejected = decision.rejectedCandidateIds.filter((id) => id !== candidateId)
  if (bucket === 'deferred') {
    deferred.push(candidateId)
    automationCandidateRepository.update(candidateId, { status: 'deferred' })
  } else if (bucket === 'rejected') {
    rejected.push(candidateId)
    automationCandidateRepository.update(candidateId, { status: 'rejected' })
  } else {
    automationCandidateRepository.update(candidateId, { status: 'reviewing' })
  }
  return selectionDecisionRepository.update(decisionId, { deferredCandidateIds: deferred, rejectedCandidateIds: rejected })
}

/* ------------------------------------------------------------------ */
/* 검토 / 확정                                                          */
/* ------------------------------------------------------------------ */

export interface SelectionFinalizeCheck {
  ok: boolean
  reasons: string[]
}

export function checkCanFinalizeSelection(
  project: Project,
  decision: SelectionDecision,
): SelectionFinalizeCheck {
  const reasons: string[] = []
  const eligibility = getSelectionEligibility(project)
  if (!eligibility.canFinalize) reasons.push(...eligibility.reasons)
  if (!decision.primaryCandidateId) reasons.push('핵심 과제를 정확히 1개 선택해야 합니다.')
  if (decision.secondaryCandidateIds.length > 2) reasons.push('보조 과제는 최대 2개까지만 지정할 수 있습니다.')
  if (decision.primaryCandidateId && decision.secondaryCandidateIds.includes(decision.primaryCandidateId)) {
    reasons.push('핵심 과제와 보조 과제가 중복됩니다.')
  }
  const primary = decision.primaryCandidateId ? automationCandidateRepository.getById(decision.primaryCandidateId) : null
  if (primary) {
    if (primary.confidence === 'insufficient') reasons.push('핵심 과제의 신뢰도가 데이터 미달입니다.')
    if (!isSelectable(primary)) reasons.push('핵심 과제에 미해결 중대 위험이 있습니다.')
    const mixTotal = primary.templateMix.reduce((s, m) => s + m.percentage, 0)
    if (decision.recommendedTemplateMix.length > 0) {
      const t = decision.recommendedTemplateMix.reduce((s, m) => s + m.percentage, 0)
      if (t !== 100) reasons.push('추천 MVP 템플릿 비율의 합이 100%가 아닙니다.')
    } else if (mixTotal !== 100) {
      reasons.push('추천 MVP 템플릿 비율의 합이 100%가 아닙니다.')
    }
  }
  if (decision.decisionSummary.trim() === '') reasons.push('선정 요약(최종 의견)을 작성해야 합니다.')
  if (decision.expectedPrimaryKpis.length === 0) reasons.push('핵심 KPI를 최소 1개 선택해야 합니다.')
  return { ok: reasons.length === 0, reasons }
}

export function markSelectionReviewed(decisionId: string): SelectionDecision {
  return selectionDecisionRepository.markReviewed(decisionId, CURRENT_USER.name)
}

export function finalizeSelection(decisionId: string): SelectionDecision {
  const decision = selectionDecisionRepository.getById(decisionId)
  if (!decision) throw new SelectionBlockedError('선정 결과를 찾을 수 없습니다.')
  const project = projectRepository.getById(decision.projectId)
  if (!project) throw new SelectionBlockedError('프로젝트를 찾을 수 없습니다.')
  const check = checkCanFinalizeSelection(project, decision)
  if (!check.ok) throw new SelectionBlockedError(check.reasons.join(' '))

  const finalized = selectionDecisionRepository.finalize(decisionId, CURRENT_USER.name)

  // 인계 스냅샷 생성(확정 시점 동결)
  const assessment = assessmentRepository.getById(decision.assessmentId) ?? assessmentRepository.getLatestByProjectId(decision.projectId)
  if (assessment) {
    const candidatesById = new Map(
      automationCandidateRepository.getByProjectId(decision.projectId, true).map((c) => [c.id, c]),
    )
    const snapshot = buildHandoffSnapshot(finalized, candidatesById, assessment, project, nowIso())
    selectionHandoffRepository.replaceForDecision(finalized.id, snapshot)
  }

  const primary = decision.primaryCandidateId ? automationCandidateRepository.getById(decision.primaryCandidateId) : null
  activityRepository.add({
    organizationId: decision.organizationId,
    projectId: decision.projectId,
    activityType: 'status_changed',
    title: `1차 MVP 핵심 과제가 '${primary?.name ?? '미정'}'으로 확정되었습니다.`,
    description: `우선순위 ${primary?.priorityScore ?? 0}점 · 규칙 v${SELECTION_RULE_VERSION}`,
    actorName: CURRENT_USER.name,
  })
  return finalized
}

export function createNewSelectionVersion(projectId: string): SelectionDecision {
  // 최신 후보를 재추출한 뒤 새 draft 생성
  runOrRefreshCandidates(projectId)
  return ensureDraftDecision(projectId)
}

/* ------------------------------------------------------------------ */
/* 조회 컨텍스트                                                        */
/* ------------------------------------------------------------------ */

export interface ProjectSelectionContext {
  project: Project
  organization: Organization | null
  eligibility: SelectionEligibility
  lifecycle: SelectionLifecycle
  candidates: AutomationCandidate[]
  decision: SelectionDecision | null
  handoff: SelectionHandoffSnapshot | null
  needsReselectionFlag: boolean
}

export function getProjectSelectionContext(projectId: string): ProjectSelectionContext | null {
  const project = projectRepository.getById(projectId)
  if (!project) return null
  const decision = selectionDecisionRepository.getLatestByProjectId(projectId)
  return {
    project,
    organization: organizationRepository.getById(project.organizationId),
    eligibility: getSelectionEligibility(project),
    lifecycle: getProjectSelectionLifecycle(project),
    candidates: automationCandidateRepository.getByProjectId(projectId),
    decision,
    handoff: decision ? selectionHandoffRepository.getBySelectionDecisionId(decision.id) : null,
    needsReselectionFlag: decision ? needsReselection(decision) : false,
  }
}
