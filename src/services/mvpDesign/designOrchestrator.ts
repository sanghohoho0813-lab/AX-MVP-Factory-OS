import type { Organization, Project } from '../../types/domain'
import type { SelectionHandoffSnapshot } from '../../types/selection'
import type { MvpDesignInput } from '../../types/mvpDesign'
import { generateDesign } from './designGenerator'
import { evaluateGuardrails } from './guardrailEngine'
import { runQualityChecks } from './qualityEngine'
import { buildDesignAutoSummary } from './designSummary'
import { DEFAULT_OUT_OF_SCOPE, MVP_DESIGN_RULE_VERSION } from './scoringConfig'

/** 선정 인계 스냅샷을 결정적으로 해싱해 재설계 필요 여부를 판단한다 */
export function computeDesignHash(handoff: SelectionHandoffSnapshot): string {
  const primary = handoff.primaryCandidate?.candidateId ?? 'none'
  const templates = [...handoff.templateMix]
    .map((m) => `${m.template}:${m.percentage}`)
    .sort()
    .join('|')
  return `${handoff.selectionVersion}::${primary}::${handoff.recommendedMvpLevel}::${templates}`
}

/**
 * 확정 핵심 과제(인계 스냅샷)로부터 MVP 설계 초안을 생성한다. (순수·결정적)
 * random·현재시간이 설계 결과에 영향을 주지 않는다.
 */
export function buildDesignDraft(
  handoff: SelectionHandoffSnapshot,
  project: Project,
  organization: Organization | null,
  createdBy: string,
  _createdAt: string,
): MvpDesignInput {
  const generated = generateDesign(handoff, project)
  const guardrailChecks = evaluateGuardrails(generated)
  const levelDecision = {
    recommendedLevel: handoff.recommendedMvpLevel,
    selectedLevel: handoff.recommendedMvpLevel,
    overrideReason: '',
    rationale: `과제선별에서 권장한 MVP 수준(Level ${handoff.recommendedMvpLevel})을 기본값으로 사용합니다.`,
  }
  const autoSummary = buildDesignAutoSummary(handoff, organization, generated)
  const outOfScope = [...new Set([...handoff.excludedItems, ...DEFAULT_OUT_OF_SCOPE])]

  const partial = {
    projectId: project.id,
    organizationId: project.organizationId,
    selectionDecisionId: handoff.selectionDecisionId,
    selectionVersion: handoff.selectionVersion,
    handoffSnapshotId: handoff.id,
    status: 'draft' as const,
    coreTaskName: handoff.primaryCandidate?.name ?? (handoff.problemDefinition.slice(0, 40) || '핵심 과제'),
    problemStatement: handoff.problemDefinition,
    targetUsers: handoff.targetUsers,
    goalStatement: handoff.desiredWorkflow || handoff.expectedKpis.join(', '),
    levelDecision,
    ...generated,
    guardrailChecks,
    designSummary: '',
    autoSummary,
    scopeNotes: '',
    outOfScope,
    hasWebsiteTrack: handoff.hasWebsiteTrack,
    websiteStudioRecommended: handoff.websiteStudioRecommended,
    sourceSnapshotHash: computeDesignHash(handoff),
    ruleVersion: MVP_DESIGN_RULE_VERSION,
    createdBy,
    reviewedBy: '',
    finalizedBy: '',
    reviewedAt: null,
    finalizedAt: null,
    supersededAt: null,
  }

  const qualityChecks = runQualityChecks(
    {
      features: partial.features,
      screens: partial.screens,
      roles: partial.roles,
      aiFeatures: partial.aiFeatures,
      integrations: partial.integrations,
      businessRules: partial.businessRules,
      acceptanceCriteria: partial.acceptanceCriteria,
      kpis: partial.kpis,
      levelDecision: partial.levelDecision,
      hasWebsiteTrack: partial.hasWebsiteTrack,
      websiteStudioRecommended: partial.websiteStudioRecommended,
    },
    guardrailChecks,
  )

  return { ...partial, qualityChecks }
}
