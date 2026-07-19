import type { RespondentRole } from '../types'
import type {
  SnapshotPlacement,
  SnapshotSection,
} from '../types/survey'
import type {
  RespondentProfile,
  ResponseValidationIssue,
  SurveyAnswer,
  SurveyAnswerValue,
  SurveyDistribution,
  SurveyDistributionInput,
  SurveyProgressSummary,
  SurveyResponse,
} from '../types/surveyRuntime'
import { questionEstimateMinutes } from '../lib/surveyEstimate'
import {
  activityRepository,
  organizationRepository,
  projectRepository,
  surveyDistributionRepository,
  surveyResponseRepository,
} from '../repositories'
import { CURRENT_USER } from '../data/demo'
import { RESPONDENT_ROLE_META } from '../lib/surveyMeta'
import { evaluateCondition } from '../components/diagnosis/renderers/types'
import { isValueAnswered, valueToAnswer } from './surveyAnswerBridge'

const MAX_QUESTIONS_PER_PAGE = 5

/* ------------------------------------------------------------------ */
/* 공용 헬퍼                                                            */
/* ------------------------------------------------------------------ */

export function answersToMap(
  answers: SurveyAnswer[],
): Map<string, SurveyAnswerValue> {
  return new Map(answers.map((a) => [a.questionId, a.value]))
}

function flattenSnapshot(sections: SnapshotSection[]): SnapshotPlacement[] {
  return sections.flatMap((s) =>
    [...s.placements].sort((a, b) => a.orderIndex - b.orderIndex),
  )
}

function placementById(
  sections: SnapshotSection[],
): Map<string, SnapshotPlacement> {
  return new Map(flattenSnapshot(sections).map((p) => [p.questionId, p]))
}

/** 조건 source 답변을 렌더러 SurveyAnswer로 변환 */
function sourceAnswerFor(
  placement: SnapshotPlacement,
  byId: Map<string, SnapshotPlacement>,
  answers: Map<string, SurveyAnswerValue>,
) {
  if (!placement.condition) return undefined
  const source = byId.get(placement.condition.sourceQuestionId)
  if (!source) return undefined
  const fallbackOrder = [...source.options]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((o) => o.value)
  return valueToAnswer(
    answers.get(source.id) ?? null,
    source.type,
    fallbackOrder,
  )
}

/**
 * 조건을 적용해 현재 보이는 질문만 반환한다.
 * source가 없거나 손상되면 해당 조건 질문은 숨긴다(공개 설문 중단 방지).
 */
export function evaluateVisibleSnapshotQuestions(
  sections: SnapshotSection[],
  answers: Map<string, SurveyAnswerValue>,
): SnapshotPlacement[] {
  const byId = placementById(sections)
  return flattenSnapshot(sections).filter((placement) => {
    if (!placement.condition) return true
    const source = byId.get(placement.condition.sourceQuestionId)
    if (!source) return false // 손상된 조건 → 숨김
    try {
      return evaluateCondition(
        placement.condition,
        sourceAnswerFor(placement, byId, answers),
      )
    } catch {
      return false
    }
  })
}

/** 조건 source가 없어 경고가 필요한 질문 (내부 관리자용) */
export function findBrokenConditionQuestions(
  sections: SnapshotSection[],
): SnapshotPlacement[] {
  const byId = placementById(sections)
  return flattenSnapshot(sections).filter(
    (p) => p.condition && !byId.get(p.condition.sourceQuestionId),
  )
}

/* ------------------------------------------------------------------ */
/* 진행률                                                               */
/* ------------------------------------------------------------------ */

export function calculateSurveyProgress(
  sections: SnapshotSection[],
  answers: Map<string, SurveyAnswerValue>,
): SurveyProgressSummary {
  const visible = evaluateVisibleSnapshotQuestions(sections, answers)
  const totalVisible = visible.length
  const answeredVisible = visible.filter((p) =>
    isValueAnswered(answers.get(p.questionId), p.type),
  ).length
  const requiredVisible = visible.filter((p) => p.required)
  const requiredAnswered = requiredVisible.filter((p) =>
    isValueAnswered(answers.get(p.questionId), p.type),
  ).length

  const progressPercent =
    totalVisible === 0
      ? 0
      : Math.min(100, Math.round((answeredVisible / totalVisible) * 100))

  const remaining = visible.filter(
    (p) => !isValueAnswered(answers.get(p.questionId), p.type),
  )
  const estimatedRemainingMinutes =
    Math.round(
      remaining.reduce((sum, p) => sum + questionEstimateMinutes(p.type), 0) * 10,
    ) / 10

  return {
    totalVisibleQuestions: totalVisible,
    answeredVisibleQuestions: answeredVisible,
    totalRequiredQuestions: requiredVisible.length,
    answeredRequiredQuestions: requiredAnswered,
    progressPercent,
    estimatedRemainingMinutes,
  }
}

export function calculateEstimatedRemainingMinutes(
  sections: SnapshotSection[],
  answers: Map<string, SurveyAnswerValue>,
): number {
  return calculateSurveyProgress(sections, answers).estimatedRemainingMinutes
}

/* ------------------------------------------------------------------ */
/* 페이지 구성                                                          */
/* ------------------------------------------------------------------ */

export interface PublicSurveyPage {
  sectionId: string
  sectionTitle: string
  sectionDescription: string
  /** 해당 섹션 내 페이지 순번(1부터) */
  pageInSection: number
  totalPagesInSection: number
  placements: SnapshotPlacement[]
}

/**
 * 조건을 적용한 가시 질문을 섹션별로 최대 5개씩 페이지로 나눈다.
 * 조건 변경으로 가시 문항 수가 바뀌면 다시 호출해 재계산한다.
 */
export function groupSnapshotQuestionsForPublicPages(
  sections: SnapshotSection[],
  answers: Map<string, SurveyAnswerValue>,
): PublicSurveyPage[] {
  const visibleIds = new Set(
    evaluateVisibleSnapshotQuestions(sections, answers).map((p) => p.questionId),
  )
  const pages: PublicSurveyPage[] = []

  for (const section of [...sections].sort((a, b) => a.orderIndex - b.orderIndex)) {
    const visible = [...section.placements]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .filter((p) => visibleIds.has(p.questionId))
    if (visible.length === 0) continue
    const chunks: SnapshotPlacement[][] = []
    for (let i = 0; i < visible.length; i += MAX_QUESTIONS_PER_PAGE) {
      chunks.push(visible.slice(i, i + MAX_QUESTIONS_PER_PAGE))
    }
    chunks.forEach((chunk, index) => {
      pages.push({
        sectionId: section.id,
        sectionTitle: section.title,
        sectionDescription: section.description,
        pageInSection: index + 1,
        totalPagesInSection: chunks.length,
        placements: chunk,
      })
    })
  }
  return pages
}

/* ------------------------------------------------------------------ */
/* 검증                                                                 */
/* ------------------------------------------------------------------ */

export function validateCurrentSurveyPage(
  pagePlacements: SnapshotPlacement[],
  sectionId: string,
  answers: Map<string, SurveyAnswerValue>,
): ResponseValidationIssue[] {
  const issues: ResponseValidationIssue[] = []
  for (const p of pagePlacements) {
    if (p.required && !isValueAnswered(answers.get(p.questionId), p.type)) {
      issues.push({
        questionId: p.questionId,
        sectionId,
        type: 'required',
        message: '필수 응답 문항입니다.',
      })
    }
  }
  return issues
}

export function validateFinalSubmission(
  sections: SnapshotSection[],
  answers: Map<string, SurveyAnswerValue>,
  consented: boolean,
  consentRequired: boolean,
): ResponseValidationIssue[] {
  const issues: ResponseValidationIssue[] = []
  if (consentRequired && !consented) {
    issues.push({
      questionId: '',
      sectionId: '',
      type: 'missing_consent',
      message: '개인정보 수집에 동의해야 제출할 수 있습니다.',
    })
  }
  const visible = evaluateVisibleSnapshotQuestions(sections, answers)
  const sectionOf = new Map<string, string>()
  sections.forEach((s) =>
    s.placements.forEach((p) => sectionOf.set(p.questionId, s.id)),
  )
  for (const p of visible) {
    if (p.required && !isValueAnswered(answers.get(p.questionId), p.type)) {
      issues.push({
        questionId: p.questionId,
        sectionId: sectionOf.get(p.questionId) ?? '',
        type: 'required',
        message: '필수 응답 문항입니다.',
      })
    }
  }
  return issues
}

/** 숨겨진 질문 답변을 제거해 제출 데이터를 정리한다 */
export function sanitizeAnswersForSubmission(
  sections: SnapshotSection[],
  answers: SurveyAnswer[],
): SurveyAnswer[] {
  const map = answersToMap(answers)
  const visibleIds = new Set(
    evaluateVisibleSnapshotQuestions(sections, map).map((p) => p.questionId),
  )
  return answers.filter((a) => visibleIds.has(a.questionId))
}

/* ------------------------------------------------------------------ */
/* 발급                                                                 */
/* ------------------------------------------------------------------ */

export function logDistributionActivity(
  distribution: SurveyDistribution,
  title: string,
): void {
  activityRepository.add({
    organizationId: distribution.organizationId,
    projectId: distribution.projectId,
    activityType: 'project_updated',
    title,
    description: `${RESPONDENT_ROLE_META[distribution.respondentRole].label}용 · ${distribution.surveyTitle}`,
    actorName: CURRENT_USER.name,
  })
}

export function issueSurveyDistribution(
  input: SurveyDistributionInput,
  accessToken: string,
): SurveyDistribution {
  const distribution = surveyDistributionRepository.create(input, accessToken)
  logDistributionActivity(
    distribution,
    `${RESPONDENT_ROLE_META[distribution.respondentRole].label}용 진단 설문 테스트 링크가 생성되었습니다.`,
  )
  return distribution
}

/* ------------------------------------------------------------------ */
/* 공개 설문 해석                                                        */
/* ------------------------------------------------------------------ */

/** 공개 화면에 노출해도 되는 최소 정보 (내부 식별자·메모 제외) */
export interface PublicSurveyView {
  distributionId: string
  organizationName: string
  projectPurpose: string
  surveyTitle: string
  respondentRole: RespondentRole
  recipientName: string
  recipientPosition: string
  recipientDepartment: string
  recipientEmail: string
  recipientPhone: string
  sections: SnapshotSection[]
  introMessage: string
  privacyNotice: string
  consentRequired: boolean
  expiresAt: string | null
  totalSections: number
}

export type PublicSurveyResolution =
  | { kind: 'ok'; view: PublicSurveyView; distribution: SurveyDistribution }
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'revoked' }
  | {
      kind: 'submitted'
      organizationName: string
      surveyTitle: string
      recipientName: string
      submittedAt: string | null
      answeredCount: number
      requiredAnswered: boolean
    }

export function resolvePublicSurveyByToken(
  accessToken: string,
): PublicSurveyResolution {
  const distribution = surveyDistributionRepository.getByToken(accessToken)
  if (!distribution) return { kind: 'not_found' }
  if (distribution.status === 'revoked') return { kind: 'revoked' }
  if (distribution.status === 'expired') return { kind: 'expired' }

  const organization = organizationRepository.getById(
    distribution.organizationId,
  )
  const project = projectRepository.getById(distribution.projectId)

  if (distribution.status === 'submitted') {
    const response = surveyResponseRepository.getByDistributionId(distribution.id)
    return {
      kind: 'submitted',
      organizationName: organization?.name ?? '',
      surveyTitle: distribution.surveyTitle,
      recipientName: distribution.recipientName,
      submittedAt: distribution.submittedAt,
      answeredCount: response?.answeredVisibleCount ?? 0,
      requiredAnswered: response
        ? response.requiredAnsweredCount >= response.requiredVisibleCount
        : true,
    }
  }

  const view: PublicSurveyView = {
    distributionId: distribution.id,
    organizationName: organization?.name ?? '',
    projectPurpose: project?.objective ?? '',
    surveyTitle: distribution.surveyTitle,
    respondentRole: distribution.respondentRole,
    recipientName: distribution.recipientName,
    recipientPosition: distribution.recipientPosition,
    recipientDepartment: '',
    recipientEmail: distribution.recipientEmail,
    recipientPhone: distribution.recipientPhone,
    sections: distribution.blueprintSnapshot,
    introMessage: distribution.introMessage,
    privacyNotice: distribution.privacyNotice,
    consentRequired: distribution.consentRequired,
    expiresAt: distribution.expiresAt,
    totalSections: distribution.blueprintSnapshot.length,
  }
  return { kind: 'ok', view, distribution }
}

/* ------------------------------------------------------------------ */
/* 응답 생성·재개                                                        */
/* ------------------------------------------------------------------ */

export function createOrResumeSurveyResponse(
  distribution: SurveyDistribution,
): SurveyResponse {
  const existing = surveyResponseRepository.getByDistributionId(distribution.id)
  if (existing) return existing

  const profile: RespondentProfile = {
    name: distribution.recipientName,
    position: distribution.recipientPosition,
    department: '',
    email: distribution.recipientEmail,
    phone: distribution.recipientPhone,
  }
  return surveyResponseRepository.create({
    distributionId: distribution.id,
    projectId: distribution.projectId,
    organizationId: distribution.organizationId,
    respondentRole: distribution.respondentRole,
    respondentProfile: profile,
    consented: false,
    consentedAt: null,
    answers: [],
    currentSectionId: null,
    currentPageIndex: 0,
    progressPercent: 0,
    answeredVisibleCount: 0,
    requiredVisibleCount: 0,
    requiredAnsweredCount: 0,
    status: 'not_started',
    startedAt: null,
    lastSavedAt: null,
    submittedAt: null,
  })
}

/* ------------------------------------------------------------------ */
/* 제출                                                                 */
/* ------------------------------------------------------------------ */

export function submitSurveyResponse(
  response: SurveyResponse,
  distribution: SurveyDistribution,
): SurveyResponse {
  const sanitized = sanitizeAnswersForSubmission(
    distribution.blueprintSnapshot,
    response.answers,
  )
  const map = answersToMap(sanitized)
  const progress = calculateSurveyProgress(distribution.blueprintSnapshot, map)
  const timestamp = new Date().toISOString()

  const updated = surveyResponseRepository.update(response.id, {
    answers: sanitized,
    status: 'submitted',
    submittedAt: timestamp,
    lastSavedAt: timestamp,
    progressPercent: progress.progressPercent,
    answeredVisibleCount: progress.answeredVisibleQuestions,
    requiredVisibleCount: progress.totalRequiredQuestions,
    requiredAnsweredCount: progress.answeredRequiredQuestions,
  })

  surveyDistributionRepository.update(distribution.id, {
    status: 'submitted',
    submittedAt: timestamp,
  })
  logDistributionActivity(distribution, '진단 설문 응답이 제출되었습니다.')
  return updated
}

/* ------------------------------------------------------------------ */
/* 프로젝트 응답 요약                                                    */
/* ------------------------------------------------------------------ */

export interface ProjectSurveyResponseSummary {
  issued: number
  notStarted: number
  inProgress: number
  submitted: number
  averageProgress: number
}

export function getProjectSurveyResponseSummary(
  projectId: string,
): ProjectSurveyResponseSummary {
  const distributions = surveyDistributionRepository
    .getByProjectId(projectId)
    .filter((d) => d.status !== 'revoked')
  const responses = surveyResponseRepository.search({ projectId })

  let notStarted = 0
  let inProgress = 0
  let submitted = 0
  let progressSum = 0
  for (const dist of distributions) {
    const response = responses.find((r) => r.distributionId === dist.id)
    if (dist.status === 'submitted' || response?.status === 'submitted') {
      submitted += 1
      progressSum += 100
    } else if (response && response.status === 'in_progress') {
      inProgress += 1
      progressSum += response.progressPercent
    } else {
      notStarted += 1
    }
  }
  const issued = distributions.length
  return {
    issued,
    notStarted,
    inProgress,
    submitted,
    averageProgress: issued === 0 ? 0 : Math.round(progressSum / issued),
  }
}
