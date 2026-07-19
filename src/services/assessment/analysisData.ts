import type { RespondentRole } from '../../types'
import type { Organization, Project } from '../../types/domain'
import type { SnapshotPlacement, SnapshotSection } from '../../types/survey'
import type {
  SurveyAnswerValue,
  SurveyDistribution,
  SurveyResponse,
  SurveyResponseStatus,
} from '../../types/surveyRuntime'
import {
  organizationRepository,
  projectRepository,
  questionRepository,
  surveyDistributionRepository,
  surveyResponseRepository,
} from '../../repositories'
import {
  answersToMap,
  evaluateVisibleSnapshotQuestions,
} from '../surveyRuntimeService'
import {
  normalizeAnswerValue,
  type NormalizedAnswer,
} from './answerNormalization'

export interface RespondentDataset {
  responseId: string
  distributionId: string
  role: RespondentRole
  respondentName: string
  status: SurveyResponseStatus
  snapshot: SnapshotSection[]
  /** 조건을 적용해 실제로 보이는 문항만 */
  visiblePlacements: SnapshotPlacement[]
  placementById: Map<string, SnapshotPlacement>
  valueById: Map<string, SurveyAnswerValue>
  normalizedById: Map<string, NormalizedAnswer>
  /** analysisTag → 정규화 답변 목록 */
  byTag: Map<string, NormalizedAnswer[]>
}

export interface QuestionMeta {
  scoringWeight: number
  analysisTags: string[]
}

export interface AnalysisDataset {
  project: Project
  organization: Organization | null
  /** 정식 분석 대상 (submitted) */
  respondents: RespondentDataset[]
  /** 참고용 (in_progress) */
  inProgress: RespondentDataset[]
  submittedResponseIds: string[]
  submittedDistributionIds: string[]
  rolesPresent: RespondentRole[]
  /** 질문 원본 가중치·태그 조회 */
  questionMeta: (questionId: string) => QuestionMeta
}

/** 질문 원본에서 가중치·태그를 조회 (스냅샷에 없는 정보) */
function buildQuestionMetaLookup(): (questionId: string) => QuestionMeta {
  const byId = new Map(
    questionRepository.getAll(true).map((q) => [q.id, q]),
  )
  return (questionId: string) => {
    const q = byId.get(questionId)
    return {
      scoringWeight: q ? Math.max(1, q.scoringWeight) : 2,
      analysisTags: q?.analysisTags ?? [],
    }
  }
}

function buildRespondentDataset(
  response: SurveyResponse,
  distribution: SurveyDistribution,
  metaLookup: (questionId: string) => QuestionMeta,
): RespondentDataset {
  const snapshot = distribution.blueprintSnapshot
  const valueById = answersToMap(response.answers)
  const placementById = new Map<string, SnapshotPlacement>()
  snapshot.forEach((s) =>
    s.placements.forEach((p) => placementById.set(p.questionId, p)),
  )

  const visiblePlacements = evaluateVisibleSnapshotQuestions(snapshot, valueById)

  const normalizedById = new Map<string, NormalizedAnswer>()
  const byTag = new Map<string, NormalizedAnswer[]>()

  for (const placement of visiblePlacements) {
    const meta = metaLookup(placement.questionId)
    const normalized = normalizeAnswerValue(
      placement,
      valueById.get(placement.questionId),
      meta.analysisTags,
    )
    normalizedById.set(placement.questionId, normalized)
    for (const tag of meta.analysisTags) {
      const list = byTag.get(tag) ?? []
      list.push(normalized)
      byTag.set(tag, list)
    }
  }

  return {
    responseId: response.id,
    distributionId: distribution.id,
    role: distribution.respondentRole,
    respondentName:
      response.respondentProfile.name || distribution.recipientName || '응답자',
    status: response.status,
    snapshot,
    visiblePlacements,
    placementById,
    valueById,
    normalizedById,
    byTag,
  }
}

/**
 * 프로젝트의 제출 응답을 모아 분석용 데이터셋을 만든다.
 * - submitted 응답만 정식 분석 대상
 * - in_progress 응답은 참고용으로 분리 보관
 * - 손상된 응답(스냅샷 없음)은 건너뛴다
 */
export function gatherAnalysisDataset(
  projectId: string,
): AnalysisDataset | null {
  const project = projectRepository.getById(projectId)
  if (!project) return null
  const organization = organizationRepository.getById(project.organizationId)
  const metaLookup = buildQuestionMetaLookup()

  const distributions = surveyDistributionRepository.getByProjectId(projectId)
  const distById = new Map(distributions.map((d) => [d.id, d]))
  const responses = surveyResponseRepository.search({ projectId })

  const respondents: RespondentDataset[] = []
  const inProgress: RespondentDataset[] = []

  for (const response of responses) {
    const distribution = distById.get(response.distributionId)
    if (!distribution) continue
    if (
      !Array.isArray(distribution.blueprintSnapshot) ||
      distribution.blueprintSnapshot.length === 0
    ) {
      continue
    }
    const dataset = buildRespondentDataset(response, distribution, metaLookup)
    // 제출 여부는 응답 또는 발급 상태 어느 쪽으로든 판단
    const isSubmitted =
      response.status === 'submitted' || distribution.status === 'submitted'
    if (isSubmitted) respondents.push(dataset)
    else if (response.status === 'in_progress') inProgress.push(dataset)
  }

  const rolesPresent = [...new Set(respondents.map((r) => r.role))]

  return {
    project,
    organization,
    respondents,
    inProgress,
    submittedResponseIds: respondents.map((r) => r.responseId),
    submittedDistributionIds: respondents.map((r) => r.distributionId),
    rolesPresent,
    questionMeta: metaLookup,
  }
}

/** 특정 태그에 해당하는 (응답자, 정규화답변) 쌍을 모은다 */
export function answersForTag(
  dataset: AnalysisDataset,
  tag: string,
): Array<{ respondent: RespondentDataset; normalized: NormalizedAnswer }> {
  const out: Array<{
    respondent: RespondentDataset
    normalized: NormalizedAnswer
  }> = []
  for (const respondent of dataset.respondents) {
    const list = respondent.byTag.get(tag)
    if (!list) continue
    for (const normalized of list) {
      if (normalized.answered) out.push({ respondent, normalized })
    }
  }
  return out
}

/** 특정 역할의 특정 태그 첫 응답 */
export function answerForRoleTag(
  dataset: AnalysisDataset,
  role: RespondentRole,
  tag: string,
): NormalizedAnswer | null {
  for (const respondent of dataset.respondents) {
    if (respondent.role !== role) continue
    const list = respondent.byTag.get(tag)
    const found = list?.find((n) => n.answered)
    if (found) return found
  }
  return null
}
