/* ------------------------------------------------------------------ */
/* 제출자료 만들기 (Stage 10)                                            */
/*                                                                     */
/* 확정된 진단·과제선정·AX MVP 설계·홈페이지 설계·실제 사용 테스트       */
/* 스냅샷을 보고서·개발명세·로드맵·Claude Code 프롬프트 패키지로 변환한다. */
/* 실제 AX MVP·홈페이지를 코딩하지 않으며, 확정 스냅샷을 우선 사용한다.   */
/* AX와 홈페이지 결과는 하나의 점수로 합산하지 않는다.                   */
/* ------------------------------------------------------------------ */

/* A. 패키지 상태 */
export type DeliverablePackageStatus =
  | 'draft'
  | 'reviewed'
  | 'finalized'
  | 'superseded'
  | 'archived'

/* B. 패키지 유형 */
export type DeliverablePackageType =
  | 'internal_master'
  | 'client_proposal'
  | 'development_handoff'
  | 'validation_report'
  | 'institution_preparation'
  | 'custom'

/* C. 대상 독자 */
export type DeliverableAudience =
  | 'internal'
  | 'client'
  | 'developer'
  | 'institution'
  | 'mixed'

/* D. 트랙 (AX와 홈페이지는 별도 트랙, 합산 금지) */
export type DeliverableTrackType =
  | 'overview'
  | 'ax'
  | 'website'
  | 'validation'
  | 'roadmap'
  | 'evidence'
  | 'prompt'

/* E. 출처 유형 */
export type DeliverableSourceType =
  | 'organization'
  | 'project'
  | 'survey_response'
  | 'assessment'
  | 'selection_decision'
  | 'selection_handoff'
  | 'mvp_design'
  | 'mvp_design_handoff'
  | 'website_design'
  | 'website_design_handoff'
  | 'validation_workspace'
  | 'validation_handoff'
  | 'activity_log'
  | 'manual'

/* F. 출처 참조 */
export interface DeliverableSourceReference {
  id: string
  sourceType: DeliverableSourceType
  sourceId: string
  sourceVersion: number
  label: string
  capturedAt: string
  snapshotHash: string
  track: DeliverableTrackType
  available: boolean
  stale: boolean
  notes: string
}

/* G. Section 유형 */
export type DeliverableSectionType =
  | 'cover'
  | 'executive_summary'
  | 'company_profile'
  | 'project_overview'
  | 'diagnosis_summary'
  | 'ax_suitability'
  | 'website_readiness'
  | 'selected_task'
  | 'priority_matrix'
  | 'mvp_scope'
  | 'website_strategy'
  | 'sitemap'
  | 'page_sections'
  | 'content_assets'
  | 'workflow'
  | 'feature_specification'
  | 'screen_specification'
  | 'data_specification'
  | 'permission_specification'
  | 'business_rules'
  | 'ai_guardrails'
  | 'integration_scope'
  | 'acceptance_criteria'
  | 'test_scenarios'
  | 'validation_summary'
  | 'stage_gate'
  | 'kpi_results'
  | 'issue_summary'
  | 'implementation_roadmap'
  | 'budget_assumptions'
  | 'risk_register'
  | 'evidence_index'
  | 'developer_prompt'
  | 'appendix'
  | 'custom'

/* H. Section 공개 범위 */
export type DeliverableSectionVisibility =
  | 'internal_only'
  | 'client_visible'
  | 'developer_visible'
  | 'institution_visible'
  | 'shared'

/* I. Section 상태 */
export type DeliverableSectionStatus =
  | 'auto_generated'
  | 'needs_review'
  | 'approved'
  | 'excluded'
  | 'blocked'

/* K. 콘텐츠 블록 유형 */
export type DeliverableContentBlockType =
  | 'heading'
  | 'paragraph'
  | 'bullet_list'
  | 'numbered_list'
  | 'key_value'
  | 'metric'
  | 'table'
  | 'callout'
  | 'warning'
  | 'checklist'
  | 'timeline'
  | 'code'
  | 'prompt'
  | 'divider'

export type DeliverableBlockTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface DeliverableKeyValue {
  key: string
  value: string
}

export interface DeliverableTableRow {
  cells: string[]
}

/* L. 콘텐츠 블록 */
export interface DeliverableContentBlock {
  id: string
  type: DeliverableContentBlockType
  title: string
  text: string
  items: string[]
  rows: DeliverableTableRow[]
  tableHeaders: string[]
  keyValues: DeliverableKeyValue[]
  tone: DeliverableBlockTone
  sourceReferenceIds: string[]
  internalOnly: boolean
  orderIndex: number
}

/* U. 품질 심각도 */
export type DeliverableQualitySeverity = 'info' | 'warning' | 'error'

/* V. 품질검사 */
export interface DeliverableQualityCheck {
  id: string
  severity: DeliverableQualitySeverity
  title: string
  description: string
  passed: boolean
  relatedSectionIds: string[]
  relatedSourceIds: string[]
}

/* J. Section */
export interface DeliverableSection {
  id: string
  packageId: string
  type: DeliverableSectionType
  track: DeliverableTrackType
  title: string
  subtitle: string
  summary: string
  body: string
  structuredContent: DeliverableContentBlock[]
  sourceReferences: string[]
  visibility: DeliverableSectionVisibility
  status: DeliverableSectionStatus
  required: boolean
  manuallyEdited: boolean
  originalBody: string
  originalStructuredContent: DeliverableContentBlock[]
  editNotes: string
  editedBy: string
  editedAt: string | null
  qualityChecks: DeliverableQualityCheck[]
  orderIndex: number
  createdAt: string
  updatedAt: string
}

/* M. 가림(redaction) 규칙 유형 */
export type DeliverableRedactionRuleType =
  | 'remove_personal_contact'
  | 'remove_internal_note'
  | 'remove_internal_risk'
  | 'remove_cost_detail'
  | 'remove_unverified_claim'
  | 'anonymize_participant'
  | 'hide_source_id'
  | 'custom'

/* N. 가림 규칙 */
export interface DeliverableRedactionRule {
  id: string
  type: DeliverableRedactionRuleType
  enabled: boolean
  description: string
  replacementText: string
  relatedSectionIds: string[]
}

/* O. 프롬프트 유형 */
export type DeliverablePromptType =
  | 'ax_full_build'
  | 'ax_staged_build'
  | 'ax_design_revision'
  | 'website_full_build'
  | 'website_staged_build'
  | 'validation_fix'
  | 'generic_handoff'
  | 'custom'

/* P. 개발 프롬프트 */
export interface DeliverablePrompt {
  id: string
  packageId: string
  track: DeliverableTrackType
  type: DeliverablePromptType
  title: string
  purpose: string
  content: string
  sourceSectionIds: string[]
  generatedFromVersion: number
  generatedAt: string
  manuallyEdited: boolean
  originalContent: string
  editNotes: string
  sequenceNumber: number
  prerequisites: string[]
  expectedOutput: string
  completionChecks: string[]
}

/* Q. 로드맵 단계 상태 */
export type RoadmapPhaseStatus =
  | 'planned'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'deferred'

/* R. 로드맵 단계 */
export interface RoadmapPhase {
  id: string
  track: DeliverableTrackType
  name: string
  objective: string
  scope: string
  deliverables: string[]
  dependencies: string[]
  owner: string
  /** 근거 없는 기간 숫자 금지 — 없으면 '담당 개발자 산정 필요' */
  estimatedDurationText: string
  successCriteria: string[]
  risks: string[]
  status: RoadmapPhaseStatus
  orderIndex: number
}

/* S. 리스크 항목 */
export interface DeliverableRiskItem {
  id: string
  track: DeliverableTrackType
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  mitigation: string
  owner: string
  status: 'open' | 'mitigating' | 'accepted' | 'resolved'
  clientVisible: boolean
}

/* T. 증거 인덱스 항목 */
export type DeliverableEvidenceType =
  | 'survey'
  | 'assessment'
  | 'selection'
  | 'design'
  | 'validation'
  | 'metric'
  | 'document'
  | 'link'
  | 'manual'

export interface DeliverableEvidenceIndexItem {
  id: string
  sourceType: DeliverableSourceType
  sourceId: string
  title: string
  description: string
  relatedSectionIds: string[]
  evidenceType: DeliverableEvidenceType
  capturedAt: string
  verified: boolean
  externalUrl: string
  internalOnly: boolean
}

/* W. 내보내기 형식 */
export type DeliverableExportFormat = 'print' | 'markdown' | 'text' | 'json'

/* X. 내보내기 기록 (메타데이터만 저장, Blob·base64 금지) */
export interface DeliverableExportRecord {
  id: string
  packageId: string
  format: DeliverableExportFormat
  audience: DeliverableAudience
  generatedAt: string
  sectionIds: string[]
  fileName: string
  contentHash: string
}

/* Y. 패키지 (aggregate root) */
export interface DeliverablePackage {
  id: string
  projectId: string
  organizationId: string
  version: number
  status: DeliverablePackageStatus
  type: DeliverablePackageType
  audience: DeliverableAudience
  name: string
  description: string
  sourceReferences: DeliverableSourceReference[]
  sourceSnapshotHash: string
  includedTracks: DeliverableTrackType[]
  sections: DeliverableSection[]
  prompts: DeliverablePrompt[]
  roadmap: RoadmapPhase[]
  risks: DeliverableRiskItem[]
  evidenceIndex: DeliverableEvidenceIndexItem[]
  redactionRules: DeliverableRedactionRule[]
  qualityChecks: DeliverableQualityCheck[]
  finalSummary: string
  reviewNotes: string
  assumptions: string[]
  openQuestions: string[]
  ruleVersion: string
  createdBy: string
  reviewedBy: string
  finalizedBy: string
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
  finalizedAt: string | null
  supersededAt: string | null
  archivedAt: string | null
}

export type DeliverablePackageInput = Omit<
  DeliverablePackage,
  'id' | 'version' | 'createdAt' | 'updatedAt'
>

/* Z. 확정 스냅샷 (확정 시 동결, 원본·패키지 수정과 무관하게 보존) */
export interface DeliverablePackageSnapshot {
  id: string
  packageId: string
  projectId: string
  organizationId: string
  version: number
  type: DeliverablePackageType
  audience: DeliverableAudience
  sourceReferences: DeliverableSourceReference[]
  sections: DeliverableSection[]
  prompts: DeliverablePrompt[]
  roadmap: RoadmapPhase[]
  risks: DeliverableRiskItem[]
  evidenceIndex: DeliverableEvidenceIndexItem[]
  redactionRules: DeliverableRedactionRule[]
  finalSummary: string
  assumptions: string[]
  openQuestions: string[]
  generatedAt: string
}

export type DeliverablePackageSnapshotInput = Omit<DeliverablePackageSnapshot, 'id'>
export type DeliverableExportRecordInput = Omit<DeliverableExportRecord, 'id'>

export interface DeliverableFilters {
  query?: string
  status?: DeliverablePackageStatus
  type?: DeliverablePackageType
  audience?: DeliverableAudience
  includesAx?: boolean
  includesWebsite?: boolean
  includesValidation?: boolean
}
