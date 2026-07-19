import type { RespondentRole } from '../types'
import type { Project } from '../types/domain'
import type { Organization } from '../types/domain'
import type {
  ProjectSurveyBlueprint,
  Question,
  SurveyModule,
} from '../types/survey'
import { resolveIndustryKey } from '../lib/surveyMeta'
import {
  activityRepository,
  projectSurveyBlueprintRepository,
  questionRepository,
  surveyModuleRepository,
  surveyTemplateRepository,
} from '../repositories'
import { CURRENT_USER } from '../data/demo'
import { RESPONDENT_ROLE_META } from '../lib/surveyMeta'
import {
  buildSnapshot,
  calculateSurveyQuality,
  computeCompositionSummary,
  resolveTemplateSections,
  summarizeQuality,
  type ResolvedPlacement,
  type ResolvedSection,
} from './surveyComposition'

/* ------------------------------------------------------------------ */
/* 모듈 추천                                                            */
/* ------------------------------------------------------------------ */

export interface ModuleRecommendation {
  module: SurveyModule
  reason: string
}

/**
 * 프로젝트 업종·유형·자금조달 연계 여부에 따라 모듈을 추천한다.
 */
export function getRecommendedModulesForProject(
  project: Project,
  organization: Organization | null,
): ModuleRecommendation[] {
  const modules = surveyModuleRepository.getAll()
  const recommendations: ModuleRecommendation[] = []

  const industryKey = organization
    ? resolveIndustryKey(organization.industry)
    : null

  // 업종 모듈 (AX 계열 프로젝트에만)
  if (project.projectType !== 'website' && industryKey) {
    for (const module of modules) {
      if (module.kind === 'industry' && module.keys.includes(industryKey)) {
        recommendations.push({
          module,
          reason: `고객사 업종(${organization?.industry ?? ''})에 맞는 업종 모듈입니다.`,
        })
      }
    }
  }

  // 홈페이지 목적 모듈
  if (project.projectType === 'website' || project.projectType === 'ax_website') {
    for (const module of modules) {
      if (module.kind === 'objective' && module.keys.includes('website')) {
        recommendations.push({
          module,
          reason: '홈페이지 제작이 포함된 프로젝트입니다.',
        })
      }
    }
  }

  // 자금조달 연계 모듈
  if (project.fundingRequired) {
    for (const module of modules) {
      if (module.kind === 'objective' && module.keys.includes('funding')) {
        recommendations.push({
          module,
          reason: '자금조달 연계가 필요한 프로젝트입니다.',
        })
      }
    }
  }

  return recommendations
}

/* ------------------------------------------------------------------ */
/* 프로젝트 설문 현황 요약                                               */
/* ------------------------------------------------------------------ */

export type SurveyDesignState = 'none' | 'draft' | 'ready'

export interface RoleSurveyStatus {
  respondentRole: RespondentRole
  state: SurveyDesignState
  blueprintId: string | null
  questionCount: number
  estimatedMinutes: number
  updatedAt: string | null
}

/** 프로젝트 유형에 따라 관리할 응답자 역할 목록 */
export function surveyRolesForProject(project: Project): RespondentRole[] {
  if (project.projectType === 'website') return ['mixed']
  return ['owner', 'manager', 'worker']
}

/** 프로젝트의 응답자별 설문 설계 상태를 요약한다 */
export function summarizeProjectSurveys(project: Project): RoleSurveyStatus[] {
  const blueprints = projectSurveyBlueprintRepository.getByProjectId(project.id)
  return surveyRolesForProject(project).map((role) => {
    const blueprint = blueprints.find((b) => b.respondentRole === role)
    if (!blueprint) {
      return {
        respondentRole: role,
        state: 'none',
        blueprintId: null,
        questionCount: 0,
        estimatedMinutes: 0,
        updatedAt: null,
      }
    }
    const questionCount = blueprint.sections.reduce(
      (n, s) => n + s.placements.length,
      0,
    )
    return {
      respondentRole: role,
      state: blueprint.status,
      blueprintId: blueprint.id,
      questionCount,
      estimatedMinutes: blueprint.estimatedMinutes,
      updatedAt: blueprint.updatedAt,
    }
  })
}

/** 프로젝트에 ready 상태 설문 초안이 하나라도 있는지 */
export function hasReadyBlueprint(projectId: string): boolean {
  return projectSurveyBlueprintRepository
    .getByProjectId(projectId)
    .some((b) => b.status === 'ready')
}

/* ------------------------------------------------------------------ */
/* 설문 조합                                                            */
/* ------------------------------------------------------------------ */

export interface ComposeInput {
  templateId: string | null
  respondentRole: RespondentRole
  selectedModuleIds: string[]
  additionalQuestionIds: string[]
  excludedQuestionIds: string[]
  /** 질문별 필수 여부 재정의 (프로젝트 수준) */
  requiredOverrides?: Record<string, boolean>
}

function placementFrom(
  question: Question,
  required: boolean,
  orderIndex: number,
): ResolvedPlacement {
  return {
    placementId: `pl-${question.id}`,
    questionId: question.id,
    question,
    required,
    condition: null,
    sourceScope: question.scope,
    orderIndex,
  }
}

/**
 * 템플릿 + 선택 모듈 + 맞춤 질문을 결합해 해석된 설문 구조를 만든다.
 * 동일 questionId는 한 번만 포함한다 (템플릿 > 모듈 > 맞춤 우선순위).
 */
export function composeProjectSurvey(input: ComposeInput): ResolvedSection[] {
  const questionById = new Map(
    questionRepository.getAll(true).map((q) => [q.id, q]),
  )
  const excluded = new Set(input.excludedQuestionIds)
  const overrides = input.requiredOverrides ?? {}
  const seen = new Set<string>()
  const sections: ResolvedSection[] = []
  const applyRequired = (questionId: string, fallback: boolean) =>
    questionId in overrides ? overrides[questionId] : fallback

  // 1) 템플릿 섹션
  const template = input.templateId
    ? surveyTemplateRepository.getById(input.templateId)
    : null
  if (template) {
    const resolved = resolveTemplateSections(template.sections, questionById)
    for (const section of resolved) {
      const placements = section.placements.filter((p) => {
        if (excluded.has(p.questionId)) return false
        if (seen.has(p.questionId)) return false
        if (!p.question || p.question.archivedAt !== null || !p.question.active) {
          return false
        }
        seen.add(p.questionId)
        return true
      })
      if (placements.length > 0) {
        sections.push({
          ...section,
          placements: placements.map((p) => ({
            ...p,
            required: applyRequired(p.questionId, p.required),
          })),
        })
      }
    }
  }

  // 2) 선택 모듈 섹션
  for (const moduleId of input.selectedModuleIds) {
    const module = surveyModuleRepository.getById(moduleId)
    if (!module) continue
    const placements: ResolvedPlacement[] = []
    module.questionIds.forEach((qId) => {
      if (excluded.has(qId) || seen.has(qId)) return
      const question = questionById.get(qId)
      if (!question || question.archivedAt !== null || !question.active) return
      seen.add(qId)
      placements.push(
        placementFrom(
          question,
          applyRequired(qId, question.requiredDefault),
          placements.length,
        ),
      )
    })
    if (placements.length > 0) {
      sections.push({
        id: `sec-mod-${module.id}`,
        title: module.name,
        description: module.description,
        orderIndex: sections.length,
        placements,
      })
    }
  }

  // 3) 프로젝트 맞춤 질문 섹션
  const customPlacements: ResolvedPlacement[] = []
  input.additionalQuestionIds.forEach((qId) => {
    if (excluded.has(qId) || seen.has(qId)) return
    const question = questionById.get(qId)
    if (!question || question.archivedAt !== null || !question.active) return
    seen.add(qId)
    customPlacements.push(
      placementFrom(question, question.requiredDefault, customPlacements.length),
    )
  })
  if (customPlacements.length > 0) {
    sections.push({
      id: 'sec-custom',
      title: '프로젝트 맞춤 질문',
      description: '이 프로젝트에만 추가한 질문입니다.',
      orderIndex: sections.length,
      placements: customPlacements,
    })
  }

  return sections
}

/* ------------------------------------------------------------------ */
/* 품질검사 컨텍스트                                                    */
/* ------------------------------------------------------------------ */

export function buildQualityContext(
  project: Project,
  organization: Organization | null,
  respondentRole: RespondentRole,
) {
  const industryKey = organization
    ? resolveIndustryKey(organization.industry)
    : null
  return {
    respondentRole,
    needsIndustry: project.projectType !== 'website' && industryKey !== null,
    isWebsiteProject:
      project.projectType === 'website' || project.projectType === 'ax_website',
  }
}

export function calculateBlueprintQuality(
  sections: ResolvedSection[],
  project: Project,
  organization: Organization | null,
  respondentRole: RespondentRole,
) {
  const context = buildQualityContext(project, organization, respondentRole)
  const checks = calculateSurveyQuality(sections, context)
  return { checks, ...summarizeQuality(checks) }
}

/* ------------------------------------------------------------------ */
/* 초안 저장 / 준비 완료                                                */
/* ------------------------------------------------------------------ */

export class BlueprintNotReadyError extends Error {
  constructor() {
    super('품질 오류를 먼저 해결해야 설문을 준비 완료할 수 있습니다.')
    this.name = 'BlueprintNotReadyError'
  }
}

export interface SaveBlueprintInput extends ComposeInput {
  projectId: string
  markReady: boolean
}

/**
 * 프로젝트 설문 초안을 저장한다.
 * 저장 시점의 설문 구조를 스냅샷으로 고정해 이후 원본 변경과 무관하게 보존한다.
 */
export function saveProjectSurveyBlueprint(
  input: SaveBlueprintInput,
  project: Project,
  organization: Organization | null,
): ProjectSurveyBlueprint {
  const sections = composeProjectSurvey(input)
  const quality = calculateBlueprintQuality(
    sections,
    project,
    organization,
    input.respondentRole,
  )

  if (input.markReady && quality.verdict === 'error') {
    throw new BlueprintNotReadyError()
  }

  const snapshot = buildSnapshot(sections)
  const summary = computeCompositionSummary(sections)
  const status: ProjectSurveyBlueprint['status'] = input.markReady
    ? 'ready'
    : 'draft'

  // 같은 프로젝트+응답자 조합의 기존 초안이 있으면 갱신, 없으면 생성
  const existing = projectSurveyBlueprintRepository
    .getByProjectId(input.projectId)
    .find((b) => b.respondentRole === input.respondentRole)

  const payload = {
    projectId: input.projectId,
    templateId: input.templateId,
    respondentRole: input.respondentRole,
    selectedModuleIds: input.selectedModuleIds,
    additionalQuestionIds: input.additionalQuestionIds,
    excludedQuestionIds: input.excludedQuestionIds,
    sections: snapshot,
    status,
    qualityChecks: quality.checks,
    estimatedMinutes: summary.estimatedMinutes,
  }

  const saved = existing
    ? projectSurveyBlueprintRepository.update(existing.id, payload)
    : projectSurveyBlueprintRepository.create(payload)

  if (input.markReady) {
    activityRepository.add({
      organizationId: project.organizationId,
      projectId: project.id,
      activityType: 'project_updated',
      title: `${RESPONDENT_ROLE_META[input.respondentRole].label}용 현장진단 설문 구성이 완료되었습니다.`,
      description: `문항 ${summary.totalQuestions}개 · 예상 ${summary.estimatedMinutes}분`,
      actorName: CURRENT_USER.name,
    })
  }

  return saved
}
