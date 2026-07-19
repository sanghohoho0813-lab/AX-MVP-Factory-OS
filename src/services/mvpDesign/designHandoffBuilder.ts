import type {
  DesignHandoffFeature,
  MvpDesign,
  MvpDesignHandoffInput,
  MvpFeature,
} from '../../types/mvpDesign'
import { MVP_DESIGN_RULE_VERSION } from './scoringConfig'

function toHandoffFeature(f: MvpFeature, acceptanceCount: number): DesignHandoffFeature {
  return {
    name: f.name,
    scope: f.scope,
    type: f.type,
    automationMode: f.automationMode,
    input: f.input,
    processing: f.processing,
    output: f.output,
    usesAi: f.usesAi,
    humanReviewRequired: f.humanReviewRequired,
    expertJudgmentBoundary: f.expertJudgmentBoundary,
    acceptanceCount,
  }
}

/**
 * 확정 설계에서 Stage 8 인계 스냅샷을 만든다.
 * 확정 시점 내용을 동결해 이후 원본 변경과 무관하게 보존한다.
 */
export function buildDesignHandoffSnapshot(
  design: MvpDesign,
  generatedAt: string,
): MvpDesignHandoffInput {
  const acceptanceByFeature = new Map<string, number>()
  design.acceptanceCriteria.forEach((a) => {
    if (a.featureId) acceptanceByFeature.set(a.featureId, (acceptanceByFeature.get(a.featureId) ?? 0) + 1)
  })

  const must = design.features.filter((f) => f.scope === 'must')
  const should = design.features.filter((f) => f.scope === 'should')
  const later = design.features.filter((f) => f.scope === 'later')
  const excluded = design.features.filter((f) => f.scope === 'excluded')
  const activeScreens = design.screens.filter((s) => s.scope !== 'excluded')

  return {
    projectId: design.projectId,
    organizationId: design.organizationId,
    mvpDesignId: design.id,
    designVersion: design.version,
    coreTaskName: design.coreTaskName,
    problemStatement: design.problemStatement,
    targetUsers: design.targetUsers,
    goalStatement: design.goalStatement,
    selectedLevel: design.levelDecision.selectedLevel,
    mustFeatures: must.map((f) => toHandoffFeature(f, acceptanceByFeature.get(f.id) ?? 0)),
    shouldFeatures: should.map((f) => toHandoffFeature(f, acceptanceByFeature.get(f.id) ?? 0)),
    laterFeatures: later.map((f) => f.name),
    excludedFeatures: excluded.map((f) => f.name),
    screenNames: activeScreens.map((s) => s.name),
    entityNames: design.entities.map((e) => e.label),
    roleNames: design.roles.map((r) => r.name),
    aiFeatureNames: design.aiFeatures.map((a) => a.name),
    integrationNames: design.integrations.map((i) => i.name),
    kpiSummaries: design.kpis.map((k) => k.name),
    keyBusinessRules: design.businessRules.filter((r) => r.type !== 'permission').map((r) => r.name).slice(0, 8),
    outOfScope: design.outOfScope,
    hasWebsiteTrack: design.hasWebsiteTrack,
    websiteStudioRecommended: design.websiteStudioRecommended,
    sourceSelectionVersion: design.selectionVersion,
    ruleVersion: MVP_DESIGN_RULE_VERSION,
    generatedAt,
  }
}
