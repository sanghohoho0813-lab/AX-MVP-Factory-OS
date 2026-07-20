import type { Organization, Project } from '../../types/domain'
import type { MvpDesignHandoffSnapshot } from '../../types/mvpDesign'
import type { WebsiteDesignHandoffSnapshot } from '../../types/websiteDesign'
import type {
  SourceDesignType,
  ValidationTrackType,
  ValidationWorkspaceInput,
} from '../../types/validation'
import { TRACK_META } from '../../lib/validationMeta'
import { VALIDATION_RULE_VERSION, emptyPlan } from './gateConfig'
import { buildGateReviews } from './gateEngine'
import { importFromMvpDesign, importFromWebsiteDesign } from './importer'
import { runValidationQuality } from './qualityEngine'

/** 출처 설계 스냅샷 해시 — 재검증 필요 판정용 */
export function computeValidationHash(designId: string, designVersion: number): string {
  return `${designId}::${designVersion}`
}

interface BuildArgs {
  project: Project
  organization: Organization | null
  trackType: ValidationTrackType
  sourceDesignType: SourceDesignType
  sourceDesignId: string
  sourceDesignVersion: number
  mvpHandoff: MvpDesignHandoffSnapshot | null
  websiteHandoff: WebsiteDesignHandoffSnapshot | null
  createdBy: string
}

/** 확정 설계 인계로부터 검증 워크스페이스 초안을 결정적으로 생성한다. */
export function buildWorkspaceDraft(args: BuildArgs): ValidationWorkspaceInput {
  const { project, organization, trackType, mvpHandoff, websiteHandoff } = args
  const imported = trackType === 'ax_mvp' && mvpHandoff
    ? importFromMvpDesign(mvpHandoff)
    : websiteHandoff
      ? importFromWebsiteDesign(websiteHandoff)
      : { objective: '', targetUsers: '', hypotheses: [], scenarios: [], metrics: [], risks: [], openQuestions: [] }

  const plan = emptyPlan()
  plan.purpose = imported.objective

  const base: Omit<ValidationWorkspaceInput, 'qualityChecks'> = {
    projectId: project.id,
    organizationId: project.organizationId,
    trackType,
    status: 'draft',
    sourceDesignType: args.sourceDesignType,
    sourceDesignId: args.sourceDesignId,
    sourceDesignVersion: args.sourceDesignVersion,
    sourceHandoffSnapshot: (mvpHandoff ?? websiteHandoff) ?? null,
    sourceSnapshotHash: computeValidationHash(args.sourceDesignId, args.sourceDesignVersion),
    title: `${organization?.name ?? project.name} ${TRACK_META[trackType].label}`,
    objective: imported.objective,
    targetUsers: imported.targetUsers,
    hypotheses: imported.hypotheses,
    plan,
    buildArtifacts: [],
    participants: [],
    scenarios: imported.scenarios,
    rounds: [],
    feedbackItems: [],
    issues: [],
    evidenceArtifacts: [],
    metricDefinitions: imported.metrics,
    metricMeasurements: [],
    gateReviews: buildGateReviews(),
    finalDecision: { type: null, summary: '', rationale: '', requiredActions: [], ownerId: '', targetDate: '', approvedBy: '', decidedAt: null },
    openQuestions: imported.openQuestions,
    assumptions: [],
    risks: imported.risks,
    ruleVersion: VALIDATION_RULE_VERSION,
    createdBy: args.createdBy,
    reviewedBy: '',
    finalizedBy: '',
    reviewedAt: null,
    finalizedAt: null,
    supersededAt: null,
  }

  // qualityChecks 계산을 위해 임시 워크스페이스 형태로 평가
  const qualityChecks = runValidationQuality({ ...base, id: '', version: 1, createdAt: '', updatedAt: '', qualityChecks: [] })
  return { ...base, qualityChecks }
}
