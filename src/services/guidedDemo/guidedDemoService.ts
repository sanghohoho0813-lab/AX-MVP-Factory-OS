import type { Question, SnapshotSection } from '../../types/survey'
import type { SurveyAnswer, SurveyDistribution } from '../../types/surveyRuntime'
import {
  assessmentRepository,
  automationCandidateRepository,
  caseStudyRepository,
  deliverablePackageRepository,
  fundingStrategyRepository,
  guidedDemoRepository,
  mvpDesignRepository,
  organizationRepository,
  projectRepository,
  questionRepository,
  selectionDecisionRepository,
  selectionHandoffRepository,
  surveyDistributionRepository,
  surveyResponseRepository,
} from '../../repositories'
import { ensureWorkspace } from '../validationService'
import { createPackage } from '../deliverableService'
import { createStrategy, recordOutcome } from '../fundingService'
import { createCaseFromStrategy, updateCase } from '../caseStudyService'
import { ensureWebsiteDraft, generatePrompt } from '../websiteDesignService'
import { buildSnapshot, type ResolvedSection } from '../surveyComposition'
import {
  createOrResumeSurveyResponse,
  issueSurveyDistribution,
  submitSurveyResponse,
} from '../surveyRuntimeService'
import {
  acknowledgeIssue,
  finalizeAssessment,
  runOrRefreshAnalysis,
  updateManualSummary,
} from '../assessmentService'
import { analysisIssueRepository } from '../../repositories'
import {
  ensureDraftDecision,
  finalizeSelection,
  runOrRefreshCandidates,
  updateDecision,
} from '../selectionService'
import {
  ensureDesignDraft,
  finalizeDesign,
  updateDesignNotes,
} from '../mvpDesignService'
import {
  DEMO_ORG_ID,
  DEMO_PROJECT_ID,
  DEMO_RESPONDENTS,
  DEMO_SURVEY_TITLE,
  DEMO_TOKEN_PREFIX,
  type DemoRespondent,
} from './demoDataset'

export class GuidedDemoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GuidedDemoError'
  }
}

export interface GuidedDemoStatus {
  /** 시연 대상 고객사·프로젝트가 존재하는지 */
  baseReady: boolean
  hasResponses: boolean
  hasAnalysis: boolean
  hasSelection: boolean
  hasDesign: boolean
  /** 전체 흐름을 둘러볼 수 있는 완성 상태인지 */
  ready: boolean
  projectId: string
}

function tokenFor(role: string): string {
  return `${DEMO_TOKEN_PREFIX}${DEMO_PROJECT_ID}-${role}`
}

/* ------------------------------------------------------------------ */
/* 상태 조회                                                            */
/* ------------------------------------------------------------------ */

export function getGuidedDemoStatus(): GuidedDemoStatus {
  const org = organizationRepository.getById(DEMO_ORG_ID)
  const project = projectRepository.getById(DEMO_PROJECT_ID)
  const baseReady = Boolean(org && project)

  const submittedDemoResponses = surveyDistributionRepository
    .getByProjectId(DEMO_PROJECT_ID)
    .filter((d) => d.accessToken.startsWith(DEMO_TOKEN_PREFIX) && d.status === 'submitted').length
  const hasResponses = submittedDemoResponses >= DEMO_RESPONDENTS.length

  const assessment = assessmentRepository.getLatestByProjectId(DEMO_PROJECT_ID)
  const hasAnalysis = assessment?.status === 'finalized'

  const decision = selectionDecisionRepository.getLatestByProjectId(DEMO_PROJECT_ID)
  const handoff = decision ? selectionHandoffRepository.getBySelectionDecisionId(decision.id) : null
  const hasSelection = decision?.status === 'finalized' && Boolean(handoff)

  const design = mvpDesignRepository.getLatestByProjectId(DEMO_PROJECT_ID)
  const hasDesign = Boolean(design)

  return {
    baseReady,
    hasResponses,
    hasAnalysis: Boolean(hasAnalysis),
    hasSelection: Boolean(hasSelection),
    hasDesign,
    ready: baseReady && hasResponses && Boolean(hasAnalysis) && Boolean(hasSelection) && hasDesign,
    projectId: DEMO_PROJECT_ID,
  }
}

export function isGuidedDemoProject(projectId: string): boolean {
  return projectId === DEMO_PROJECT_ID
}

/* ------------------------------------------------------------------ */
/* 설문 스냅샷 구성 (질문 은행 기반)                                      */
/* ------------------------------------------------------------------ */

function buildDemoSnapshot(codes: string[], sectionId: string): SnapshotSection[] {
  const questionByCode = new Map<string, Question>()
  questionRepository.getAll(true).forEach((q) => questionByCode.set(q.code, q))
  const resolved: ResolvedSection = {
    id: sectionId,
    title: '생산계획 현황 진단',
    description: '',
    orderIndex: 0,
    placements: codes
      .map((code, i) => {
        const question = questionByCode.get(code) ?? null
        if (!question) return null
        return {
          placementId: `${sectionId}-pl-${code}`,
          questionId: question.id,
          question,
          required: false,
          condition: null,
          sourceScope: question.scope,
          orderIndex: i,
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null),
  }
  return buildSnapshot([resolved])
}

/* ------------------------------------------------------------------ */
/* 1. 제출 응답 준비 (idempotent)                                        */
/* ------------------------------------------------------------------ */

function ensureSubmittedResponse(respondent: DemoRespondent): void {
  const token = tokenFor(respondent.role)
  const existing = surveyDistributionRepository.getByToken(token)
  if (existing) {
    const response = surveyResponseRepository.getByDistributionId(existing.id)
    if (response?.status === 'submitted') return
    submitDemoAnswers(existing, respondent)
    return
  }

  const codes = respondent.answers.map((a) => a.code)
  const snapshot = buildDemoSnapshot(codes, `${token}-sec`)
  if (snapshot[0]?.placements.length === 0) {
    throw new GuidedDemoError('시연용 진단 질문을 찾을 수 없습니다.')
  }
  const distribution = issueSurveyDistribution(
    {
      projectId: DEMO_PROJECT_ID,
      organizationId: DEMO_ORG_ID,
      blueprintId: 'guided-demo-blueprint',
      blueprintSnapshot: snapshot,
      respondentRole: respondent.role,
      surveyTitle: DEMO_SURVEY_TITLE,
      recipientName: respondent.name,
      recipientPosition: respondent.position,
      recipientEmail: '',
      recipientPhone: '',
      introMessage: '',
      privacyNotice: '',
      consentRequired: true,
      expiresAt: null,
    },
    token,
  )
  submitDemoAnswers(distribution, respondent)
}

function submitDemoAnswers(distribution: SurveyDistribution, respondent: DemoRespondent): void {
  const response = createOrResumeSurveyResponse(distribution)
  const now = new Date().toISOString()
  const answers: SurveyAnswer[] = respondent.answers.map((a) => {
    const placement = distribution.blueprintSnapshot
      .flatMap((s) => s.placements)
      .find((p) => p.questionCode === a.code)
    return {
      questionId: placement?.questionId ?? a.code,
      questionCode: a.code,
      value: a.value,
      answeredAt: now,
      updatedAt: now,
    }
  })
  surveyResponseRepository.update(response.id, { consented: true, consentedAt: now })
  submitSurveyResponse({ ...response, answers, consented: true, consentedAt: now }, distribution)
}

/* ------------------------------------------------------------------ */
/* 2~4. 진단 · 선별 · 설계 확정 (idempotent)                             */
/* ------------------------------------------------------------------ */

function ensureFinalizedAnalysis(): void {
  const existing = assessmentRepository.getLatestByProjectId(DEMO_PROJECT_ID)
  if (existing?.status === 'finalized') return
  const assessment = runOrRefreshAnalysis(DEMO_PROJECT_ID)
  // 중대 이슈 확인 처리 (확인만 하면 확정 가능)
  analysisIssueRepository
    .getByProjectId(DEMO_PROJECT_ID)
    .filter((i) => i.severity === 'critical' && i.status === 'open')
    .forEach((i) => acknowledgeIssue(i.id))
  if (assessment.manualSummary.trim() === '') {
    updateManualSummary(
      assessment.id,
      '반복성과 효과가 큰 핵심 업무를 1차 MVP로 먼저 검증하는 것을 권장합니다.',
    )
  }
  finalizeAssessment(assessment.id)
}

function ensureFinalizedSelection(): void {
  const existing = selectionDecisionRepository.getLatestByProjectId(DEMO_PROJECT_ID)
  if (existing?.status === 'finalized') {
    const handoff = selectionHandoffRepository.getBySelectionDecisionId(existing.id)
    if (handoff) return
  }
  runOrRefreshCandidates(DEMO_PROJECT_ID)
  const decision = ensureDraftDecision(DEMO_PROJECT_ID)
  // 실제 확정된 핵심 후보명을 근거로 요약을 구성한다(하드코딩 금지).
  const primaryId = decision.primaryCandidateId
  const primaryCandidate = primaryId
    ? automationCandidateRepository.getById(primaryId)
    : automationCandidateRepository
        .getByProjectId(DEMO_PROJECT_ID)
        .sort((a, b) => b.priorityScore - a.priorityScore)[0]
  if (!primaryCandidate) throw new GuidedDemoError('시연용 자동화 후보를 만들지 못했습니다.')
  if (decision.decisionSummary.trim() === '') {
    updateDecision(decision.id, {
      decisionSummary: `반복성과 효과가 큰 '${primaryCandidate.name}'을(를) 1차 핵심 과제로 선정합니다.`,
    })
  }
  finalizeSelection(decision.id)
}

function ensureFinalizedDesign(): void {
  const existing = mvpDesignRepository.getLatestByProjectId(DEMO_PROJECT_ID)
  if (existing?.status === 'finalized') return
  const design = existing && existing.status !== 'superseded' ? existing : ensureDesignDraft(DEMO_PROJECT_ID)
  if (design.status === 'draft' || design.status === 'reviewed') {
    if (design.designSummary.trim() === '') {
      updateDesignNotes(design.id, {
        designSummary:
          '생산계획 등록·현황 보드를 1차 MVP로 확정합니다. 현장 검증 후 알림 기능을 확대합니다.',
      })
    }
    finalizeDesign(design.id)
  }
}

/* ------------------------------------------------------------------ */
/* 공개 API                                                            */
/* ------------------------------------------------------------------ */

/** 홈페이지 설계 시연용 홈페이지 유형 샘플 프로젝트 */
const DEMO_WEBSITE_PROJECT_ID = 'proj-102'

/**
 * 확정된 설계 이후 후속 작업공간(실제 사용 테스트·제출자료·기관연계·사례·홈페이지)의
 * 초안을 실제 서비스로 만든다. 선행 근거가 부족한 단계는 조용히 건너뛴다.
 * 각 단계는 존재 여부를 확인해 중복 생성하지 않는다(idempotent).
 */
function ensureModuleDrafts(): void {
  // 실제 사용 테스트 초안 (ensureWorkspace는 미확정 워크스페이스가 있으면 그대로 반환)
  try {
    ensureWorkspace(DEMO_PROJECT_ID, 'ax_mvp')
  } catch {
    /* 선행 조건 부족 시 건너뜀 */
  }
  // 제출자료 초안 (고객 설명자료)
  try {
    if (deliverablePackageRepository.getByProjectId(DEMO_PROJECT_ID).length === 0) {
      createPackage(DEMO_PROJECT_ID, 'client_proposal', '')
    }
  } catch {
    /* 출처 부족 시 건너뜀 */
  }
  // 기관·자금 연계 초안 + 샘플 결과(보류) 기록 → 내부 학습 사례 초안
  try {
    if (!fundingStrategyRepository.getLatestByProjectId(DEMO_PROJECT_ID)) {
      createStrategy(DEMO_PROJECT_ID)
    }
    const strategy = fundingStrategyRepository.getLatestByProjectId(DEMO_PROJECT_ID)
    if (strategy) {
      // 실제 기관 결과가 없으므로, 사례를 만들 수 있도록 샘플 '보류' 결과를
      // 기록한다. 금액은 비워 두고, 문구에 샘플임을 명시한다.
      if (strategy.outcomes.length === 0) {
        recordOutcome(strategy.id, {
          applicationId: strategy.applications[0]?.id ?? '',
          type: 'on_hold',
          summary:
            '[샘플 데이터] 추가 자료 보강 요청으로 심사가 보류되었습니다. 실제 기관·실제 결과가 아닙니다.',
          rejectionReasons: ['재무 자료 보강 필요', '사업 계획 구체화 필요'],
          lessonsLearned:
            '초기 근거 자료를 더 촘촘히 준비하면 심사 진행이 원활해집니다.',
          followUpActions: ['재무 자료 재정리', '기관 담당자 재확인'],
        })
      }
      const refreshed = fundingStrategyRepository.getLatestByProjectId(DEMO_PROJECT_ID)
      if (
        refreshed &&
        refreshed.outcomes.length > 0 &&
        caseStudyRepository.getByProjectId(DEMO_PROJECT_ID).length === 0
      ) {
        // 내부 전용·동의 미요청(공개 차단 상태)으로 생성된다.
        const created = createCaseFromStrategy(refreshed.id)
        // 샘플임을 제목에 명시하고, 보류(내부 학습) 결과 요약을 채운다.
        updateCase(created.id, {
          title: `[샘플] ${created.title}`,
          outcomeSummary:
            '[샘플 데이터] 추가 자료 보강 요청으로 심사가 보류되었습니다. 실제 기관·실제 결과가 아니며, 내부 학습용으로 정리한 사례입니다.',
        })
      }
    }
  } catch {
    /* 연계 근거·결과 부족 시 건너뜀 */
  }
  // 홈페이지 설계 초안 + 개발 지시문(복사·다운로드 확인용) 생성
  try {
    const website = ensureWebsiteDraft(DEMO_WEBSITE_PROJECT_ID)
    if (!website.generatedPrompts.some((p) => p.type === 'claude_code')) {
      generatePrompt(website.id, 'claude_code')
    }
  } catch {
    /* 홈페이지 대상 프로젝트가 없으면 건너뜀 */
  }
}

/** 시연 데이터를 준비한다. 여러 번 실행해도 중복이 쌓이지 않는다(idempotent). */
export function prepareGuidedDemo(): GuidedDemoStatus {
  const org = organizationRepository.getById(DEMO_ORG_ID)
  const project = projectRepository.getById(DEMO_PROJECT_ID)
  if (!org || !project) {
    throw new GuidedDemoError('시연용 고객사·프로젝트를 찾을 수 없습니다.')
  }
  DEMO_RESPONDENTS.forEach(ensureSubmittedResponse)
  ensureFinalizedAnalysis()
  ensureFinalizedSelection()
  ensureFinalizedDesign()
  ensureModuleDrafts()
  return getGuidedDemoStatus()
}

/** 손상·부분 생성된 시연 데이터를 보수한다 (부족한 단계만 다시 채운다). */
export function repairGuidedDemo(): GuidedDemoStatus {
  return prepareGuidedDemo()
}

/** 시연 데이터만 초기화한다. 일반 고객사·프로젝트 데이터는 보존한다. */
export function resetGuidedDemo(): void {
  guidedDemoRepository.clearAll(DEMO_PROJECT_ID, DEMO_TOKEN_PREFIX)
}
