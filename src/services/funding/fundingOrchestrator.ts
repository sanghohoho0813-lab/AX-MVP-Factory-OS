import type { FundingStrategyInput, InternalPerformance } from '../../types/funding'
import { institutionRepository, supportProgramRepository } from '../../repositories'
import {
  collectFundingSources,
  computeFundingSourceHash,
  type CollectedFundingSources,
} from './evidenceCollector'
import { FUNDING_RULE_VERSION } from './fundingTaxonomy'
import { buildMatches } from './matchRuleEngine'
import { buildGaps } from './gapEngine'
import { buildDocumentRequirements } from './documentRequirementBuilder'
import { buildOutreachPlans } from './outreachPlanBuilder'
import { runFundingQuality } from './qualityEngine'

const EMPTY_INTERNAL: InternalPerformance = {
  leadConsultant: '',
  internalMembers: [],
  startDate: '',
  endDate: '',
  totalHours: '',
  externalCost: '',
  clientFee: '',
  additionalContracts: '',
  referrals: '',
  renewals: '',
  notes: '',
}

export interface DraftBuildResult {
  input: FundingStrategyInput
  sources: CollectedFundingSources
}

/** 확정 스냅샷 근거로부터 연계 전략 초안을 결정적으로 생성한다. */
export function buildStrategyDraft(projectId: string, createdBy: string): DraftBuildResult | null {
  const sources = collectFundingSources(projectId)
  if (!sources) return null

  const institutions = institutionRepository.getAll()
  const programs = supportProgramRepository.getAll()
  const matches = buildMatches(sources, institutions, programs)
  const gaps = buildGaps(sources, matches)
  const documentRequirements = buildDocumentRequirements(sources, matches)
  const outreachPlans = buildOutreachPlans(sources, matches)

  const objective = sources.mvpHandoff
    ? `${sources.mvpHandoff.coreTaskName} 관련 기관·자금 연계`
    : sources.websiteHandoff
      ? '홈페이지 제작 관련 기관·자금 연계'
      : '기관·자금 연계 검토'
  const targetUse = sources.project.objective || sources.selectionHandoff?.problemDefinition || ''

  const base: Omit<FundingStrategyInput, 'qualityChecks'> = {
    projectId,
    organizationId: sources.project.organizationId,
    status: 'draft',
    objective,
    targetUse,
    preferredSupportTypes: [],
    sourceSnapshot: sources.references,
    sourceSnapshotHash: computeFundingSourceHash(sources),
    evidence: sources.evidence,
    matches,
    gaps,
    outreachPlans,
    outreachActivities: [],
    documentRequirements,
    applications: [],
    outcomes: [],
    metrics: [],
    internalPerformance: EMPTY_INTERNAL,
    strategySummary: '',
    analystNotes: '',
    officialConfirmationNotes: '',
    openQuestions: [],
    assumptions: [],
    risks: [],
    ruleVersion: FUNDING_RULE_VERSION,
    createdBy,
    reviewedBy: '',
    finalizedBy: '',
    reviewedAt: null,
    finalizedAt: null,
    supersededAt: null,
  }

  const qualityChecks = runFundingQuality(
    { ...base, id: '', version: 1, createdAt: '', updatedAt: '', qualityChecks: [] },
    { stale: false },
  )
  return { input: { ...base, qualityChecks }, sources }
}

export interface DraftPreview {
  matchCount: number
  primaryCount: number
  availableSources: string[]
  missingSources: string[]
  gapCount: number
  warnings: string[]
}

export function previewStrategyDraft(projectId: string): DraftPreview | null {
  const result = buildStrategyDraft(projectId, '미리보기')
  if (!result) return null
  const { input, sources } = result
  return {
    matchCount: input.matches.length,
    primaryCount: input.matches.filter((m) => m.priority === 'primary').length,
    availableSources: sources.references.filter((r) => r.available).map((r) => r.label),
    missingSources: sources.references.filter((r) => !r.available).map((r) => r.label),
    gapCount: input.gaps.length,
    warnings: input.qualityChecks.filter((c) => c.severity === 'warning' && !c.passed).map((c) => c.title),
  }
}
