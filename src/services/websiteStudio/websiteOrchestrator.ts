import type { Organization, Project } from '../../types/domain'
import type { AssessmentResult, WebsiteReadinessResult } from '../../types/assessment'
import type { WebsiteDesignInput, WebsiteStrategy } from '../../types/websiteDesign'
import { generateWebsiteDesign } from './designGenerator'
import { evaluateGuardrails } from './guardrailEngine'
import { runQualityChecks } from './qualityEngine'
import { WEBSITE_DESIGN_RULE_VERSION } from './scoringConfig'

/** 홈페이지 진단·응답 상태를 결정적으로 해싱해 재설계 필요 여부를 판단한다 */
export function computeWebsiteHash(
  assessment: AssessmentResult | null,
  responseIds: string[],
): string {
  const version = assessment?.version ?? 0
  const readiness = assessment?.websiteReadiness?.overallScore ?? -1
  const ids = [...responseIds].sort().join('|')
  return `${version}::${readiness}::${ids}`
}

/**
 * 홈페이지 진단 결과로부터 설계 초안을 생성한다. (순수·결정적)
 * random·현재시간이 설계 내용에 영향을 주지 않는다.
 */
export function buildWebsiteDesignDraft(
  project: Project,
  organization: Organization | null,
  assessment: AssessmentResult | null,
  readiness: WebsiteReadinessResult | null,
  responseIds: string[],
  createdBy: string,
): WebsiteDesignInput {
  const generated = generateWebsiteDesign(project, organization, readiness, null, '')
  const guardrails = evaluateGuardrails({
    pages: generated.pages,
    strategy: generated.strategy,
    forms: generated.forms,
    integrations: generated.integrations,
  })
  const base: Omit<WebsiteDesignInput, 'qualityChecks'> = {
    projectId: project.id,
    organizationId: project.organizationId,
    assessmentId: assessment?.id ?? '',
    status: 'draft',
    name: `${organization?.name ?? project.name} 홈페이지 설계`,
    websiteReadinessSnapshot: readiness,
    sourceResponseIds: responseIds,
    sourceEvidenceIds: [],
    strategy: generated.strategy,
    pages: generated.pages,
    contentItems: generated.contentItems,
    assetRequirements: generated.assetRequirements,
    designDirection: generated.designDirection,
    technicalScope: generated.technicalScope,
    forms: generated.forms,
    integrations: generated.integrations,
    scopeGuardrails: guardrails,
    generatedPrompts: [],
    designSummary: '',
    finalNotes: '',
    assumptions: generated.strategy.assumptions,
    openQuestions: generated.strategy.openQuestions,
    risks: readiness?.designRisks ?? [],
    ruleVersion: WEBSITE_DESIGN_RULE_VERSION,
    sourceSnapshotHash: computeWebsiteHash(assessment, responseIds),
    createdBy,
    reviewedBy: '',
    finalizedBy: '',
    reviewedAt: null,
    finalizedAt: null,
    supersededAt: null,
  }

  const qualityChecks = runQualityChecks(
    {
      strategy: base.strategy,
      pages: base.pages,
      contentItems: base.contentItems,
      assetRequirements: base.assetRequirements,
      designDirection: base.designDirection,
      forms: base.forms,
      integrations: base.integrations,
      generatedPrompts: base.generatedPrompts,
      designSummary: base.designSummary,
    },
    guardrails,
  )

  return { ...base, qualityChecks }
}

/** 유형 변경 시 페이지·섹션을 다시 생성한다 (사유 기록). */
export function regenerateForType(
  project: Project,
  organization: Organization | null,
  readiness: WebsiteReadinessResult | null,
  overrideType: WebsiteStrategy['websiteType'],
  overrideReason: string,
) {
  return generateWebsiteDesign(project, organization, readiness, overrideType, overrideReason)
}
