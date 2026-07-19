import type { Question, SurveyTemplate } from '../types/survey'
import { questionRepository, surveyTemplateRepository } from '../repositories'
import {
  calculateSurveyQuality,
  computeCompositionSummary,
  resolveTemplateSections,
  summarizeQuality,
  type ResolvedSection,
} from './surveyComposition'

/** 질문 맵 (id → Question), 보관 포함 — 스냅샷·참조 무결성 확인용 */
export function buildQuestionMap(): Map<string, Question> {
  return new Map(questionRepository.getAll(true).map((q) => [q.id, q]))
}

/** 템플릿을 해석된 섹션 구조로 변환 */
export function resolveTemplate(template: SurveyTemplate): ResolvedSection[] {
  return resolveTemplateSections(template.sections, buildQuestionMap())
}

/** 템플릿 예상 소요시간(분) */
export function calculateTemplateEstimatedMinutes(
  template: SurveyTemplate,
): number {
  return computeCompositionSummary(resolveTemplate(template)).estimatedMinutes
}

/** 템플릿 품질검사 (게시 가능 여부 판단) */
export function calculateTemplateQuality(template: SurveyTemplate) {
  const resolved = resolveTemplate(template)
  const checks = calculateSurveyQuality(resolved, {
    respondentRole: template.respondentRole,
  })
  return { checks, ...summarizeQuality(checks) }
}

/** 게시 가능 여부: 품질 오류가 없어야 한다 */
export function canPublishTemplate(template: SurveyTemplate): boolean {
  return calculateTemplateQuality(template).verdict !== 'error'
}

export class TemplatePublishBlockedError extends Error {
  constructor() {
    super('품질 오류를 먼저 해결해야 템플릿을 게시할 수 있습니다.')
    this.name = 'TemplatePublishBlockedError'
  }
}

export function publishTemplate(id: string): SurveyTemplate {
  const template = surveyTemplateRepository.getById(id)
  if (!template) throw new Error('템플릿을 찾을 수 없습니다.')
  if (!canPublishTemplate(template)) throw new TemplatePublishBlockedError()
  return surveyTemplateRepository.publish(id)
}
