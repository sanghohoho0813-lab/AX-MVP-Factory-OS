import type {
  DeliverableAudience,
  DeliverablePackageInput,
  DeliverablePackageType,
  DeliverableRedactionRuleType,
  DeliverableSection,
  DeliverableSectionType,
  DeliverableTrackType,
} from '../../types/deliverables'
import { collectSources, computeSourceHash, type CollectedSources } from './sourceCollector'
import { DELIVERABLE_RULE_VERSION } from './contentBlocks'
import { makeSection, type SectionSeed } from './sectionFactory'
import { PACKAGE_PRESETS, buildDefaultRedactionRules } from './packagePresetEngine'
import { buildOverviewSeeds } from './overviewBuilders'
import { buildDiagnosisSeeds } from './diagnosisReportBuilder'
import { buildSelectionSeeds } from './selectionReportBuilder'
import { buildMvpSpecSeeds } from './mvpSpecificationBuilder'
import { buildWebsiteSeeds } from './websiteReportBuilder'
import { buildValidationSeeds } from './validationReportBuilder'
import { buildRoadmap } from './roadmapBuilder'
import { buildRisks, buildRiskSeed } from './riskBuilder'
import { buildEvidenceIndex } from './evidenceIndexBuilder'
import { buildPrompts, buildPromptSeed } from './promptPackageBuilder'
import { runDeliverableQuality } from './qualityEngine'

/** Section 유형의 표준 정렬 순서 (결정적 문서 흐름) */
const SECTION_TYPE_ORDER: DeliverableSectionType[] = [
  'cover', 'executive_summary', 'company_profile', 'project_overview',
  'diagnosis_summary', 'ax_suitability', 'website_readiness',
  'selected_task', 'priority_matrix', 'mvp_scope',
  'workflow', 'feature_specification', 'screen_specification', 'data_specification',
  'permission_specification', 'business_rules', 'ai_guardrails', 'integration_scope',
  'acceptance_criteria', 'test_scenarios',
  'website_strategy', 'sitemap', 'page_sections', 'content_assets',
  'validation_summary', 'stage_gate', 'kpi_results', 'issue_summary',
  'implementation_roadmap', 'budget_assumptions', 'risk_register',
  'developer_prompt', 'evidence_index', 'appendix', 'custom',
]

function orderRank(type: DeliverableSectionType): number {
  const i = SECTION_TYPE_ORDER.indexOf(type)
  return i < 0 ? SECTION_TYPE_ORDER.length : i
}

export interface BuildDraftOptions {
  audience?: DeliverableAudience
  /** null이면 preset 기본 Section 구성 사용 */
  sectionTypes?: DeliverableSectionType[] | null
  extraRedactionTypes?: DeliverableRedactionRuleType[]
  removePersonalInfo?: boolean
  removeInternalNotes?: boolean
}

export interface DraftBuildResult {
  input: DeliverablePackageInput
  sources: CollectedSources
}

function computeIncludedTracks(sources: CollectedSources): DeliverableTrackType[] {
  const tracks: DeliverableTrackType[] = ['overview']
  if (sources.mvpHandoff || sources.selectionHandoff) tracks.push('ax')
  if (sources.websiteHandoff) tracks.push('website')
  if (sources.axValidationHandoff || sources.websiteValidationHandoff) tracks.push('validation')
  tracks.push('roadmap', 'evidence')
  if (sources.mvpHandoff || sources.websiteHandoff) tracks.push('prompt')
  return tracks
}

/**
 * 확정 출처 스냅샷으로부터 제출자료 패키지 초안을 결정적으로 생성한다.
 * 같은 출처·같은 유형이면 같은 최초 자료 구조가 나온다.
 */
export function buildPackageDraft(
  projectId: string,
  type: DeliverablePackageType,
  name: string,
  createdBy: string,
  opts: BuildDraftOptions = {},
): DraftBuildResult | null {
  const sources = collectSources(projectId)
  if (!sources) return null

  const preset = PACKAGE_PRESETS[type]
  const audience = opts.audience ?? preset.audience

  // 1. 모든 Section seed 수집 (데이터 없는 builder는 [] 반환)
  const seeds: SectionSeed[] = [
    ...buildOverviewSeeds(sources, type, name),
    ...buildDiagnosisSeeds(sources),
    ...buildSelectionSeeds(sources),
    ...buildMvpSpecSeeds(sources),
    ...buildWebsiteSeeds(sources),
    ...buildValidationSeeds(sources),
  ]

  // 2. 로드맵·위험·프롬프트
  const { phases, seed: roadmapSeed } = buildRoadmap(sources)
  const risks = buildRisks(sources)
  const prompts = preset.includePrompts ? buildPrompts(sources) : []
  seeds.push(roadmapSeed, buildRiskSeed(risks))
  if (preset.includePrompts) seeds.push(buildPromptSeed(prompts))

  // 3. preset 기준 Section 유형 필터 (custom·override 우선). 필수 유형은 항상 포함.
  const allowed = opts.sectionTypes !== undefined ? opts.sectionTypes : preset.sectionTypes
  const required = new Set<DeliverableSectionType>(['cover', 'executive_summary'])
  const filtered = seeds.filter((s) => allowed === null || required.has(s.type) || allowed.includes(s.type))

  // 4. preset의 유형별 공개 범위 override 적용
  const withVisibility = filtered.map((s) => ({
    ...s,
    visibility: preset.visibilityByType[s.type] ?? s.visibility,
  }))

  // 5. 정렬 후 Section 생성 (안정 정렬: 유형 순서 → 삽입 순서)
  const sorted = withVisibility
    .map((s, i) => ({ s, i }))
    .sort((a, b) => orderRank(a.s.type) - orderRank(b.s.type) || a.i - b.i)
    .map(({ s }) => s)
  let sections: DeliverableSection[] = sorted.map((seed, i) => makeSection(seed, i))

  // 6. 근거 인덱스 (완성된 Section을 참조)
  const { items: evidenceIndex, seed: evidenceSeed } = buildEvidenceIndex(
    sources,
    sections.map((s) => ({ id: s.id, type: s.type, track: s.track })),
  )
  if (allowed === null || allowed.includes('evidence_index')) {
    sections.push(makeSection(evidenceSeed, sections.length))
  }
  sections = sections.map((s, i) => ({ ...s, orderIndex: i }))

  // 7. 가림 규칙
  const redactionTypes = [...preset.redactionTypes, ...(opts.extraRedactionTypes ?? [])]
  if (opts.removePersonalInfo && !redactionTypes.includes('remove_personal_contact')) redactionTypes.push('remove_personal_contact')
  if (opts.removeInternalNotes && !redactionTypes.includes('remove_internal_note')) redactionTypes.push('remove_internal_note')
  const redactionRules = buildDefaultRedactionRules([...new Set(redactionTypes)])

  // 8. 가정·미확인 질문 취합
  const assumptions = [
    ...(sources.websiteHandoff?.assumptions ?? []),
  ]
  const openQuestions = [
    ...(sources.mvpHandoff?.outOfScope ? [] : []),
    ...(sources.websiteHandoff?.openQuestions ?? []),
    ...(sources.axValidationHandoff?.openQuestions ?? []),
    ...(sources.websiteValidationHandoff?.openQuestions ?? []),
  ]

  const includedTracks = computeIncludedTracks(sources)

  const base: Omit<DeliverablePackageInput, 'qualityChecks'> = {
    projectId,
    organizationId: sources.project.organizationId,
    status: 'draft',
    type,
    audience,
    name,
    description: '',
    sourceReferences: sources.references,
    sourceSnapshotHash: computeSourceHash(sources),
    includedTracks,
    sections,
    prompts,
    roadmap: phases,
    risks,
    evidenceIndex,
    redactionRules,
    finalSummary: '',
    reviewNotes: '',
    assumptions,
    openQuestions,
    ruleVersion: DELIVERABLE_RULE_VERSION,
    createdBy,
    reviewedBy: '',
    finalizedBy: '',
    reviewedAt: null,
    finalizedAt: null,
    supersededAt: null,
    archivedAt: null,
  }

  const qualityChecks = runDeliverableQuality(
    { ...base, id: '', version: 1, createdAt: '', updatedAt: '', qualityChecks: [] },
    { stale: false },
  )

  return { input: { ...base, qualityChecks }, sources }
}

/** 생성 전 예상 결과 (패키지 생성 화면 미리보기용) */
export interface DraftPreview {
  sectionCount: number
  availableSources: string[]
  missingSources: string[]
  promptCount: number
  warnings: string[]
}

export function previewDraft(projectId: string, type: DeliverablePackageType, name: string): DraftPreview | null {
  const result = buildPackageDraft(projectId, type, name, '미리보기')
  if (!result) return null
  const { input, sources } = result
  return {
    sectionCount: input.sections.length,
    availableSources: sources.references.filter((r) => r.available).map((r) => r.label),
    missingSources: sources.references.filter((r) => !r.available).map((r) => r.label),
    promptCount: input.prompts.length,
    warnings: input.qualityChecks.filter((c) => c.severity === 'warning' && !c.passed).map((c) => c.title),
  }
}
