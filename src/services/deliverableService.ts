import type { Organization, Project } from '../types/domain'
import type {
  DeliverableAudience,
  DeliverableExportFormat,
  DeliverablePackage,
  DeliverablePackageType,
  DeliverablePrompt,
  DeliverableRedactionRule,
  DeliverableSection,
  DeliverableSectionStatus,
  DeliverableSectionVisibility,
  RoadmapPhase,
} from '../types/deliverables'
import {
  activityRepository,
  deliverableExportRepository,
  deliverablePackageRepository,
  deliverablePackageSnapshotRepository,
  organizationRepository,
  projectRepository,
} from '../repositories'
import { CURRENT_USER } from '../data/demo'
import { PACKAGE_TYPE_META } from '../lib/deliverableMeta'
import {
  buildPackageDraft,
  previewDraft,
  type BuildDraftOptions,
  type DraftPreview,
} from './deliverables/deliverableOrchestrator'
import {
  collectSources,
  computeSourceHash,
  evaluateEligibility,
  type DeliverableEligibility,
} from './deliverables/sourceCollector'
import { runDeliverableQuality, hasBlockingErrors } from './deliverables/qualityEngine'
import { buildPackageSummary, type DeliverableSummary } from './deliverables/packageSummaryBuilder'
import { buildPackageSnapshot } from './deliverables/packageSnapshotBuilder'
import { buildExportContent, contentHash } from './deliverables/exportBuilder'
import { buildRedactedView, type RedactedView } from './deliverables/redactionEngine'
import { blocksToText } from './deliverables/contentBlocks'
import { DELIVERABLE_RULE_VERSION } from './deliverables/contentBlocks'

function nowIso(): string {
  return new Date().toISOString()
}

export class DeliverableBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeliverableBlockedError'
  }
}
export class DeliverableEditError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeliverableEditError'
  }
}

/* ------------------------------------------------------------------ */
/* 자격·미리보기                                                        */
/* ------------------------------------------------------------------ */

export function getDeliverableEligibility(projectId: string): DeliverableEligibility | null {
  const sources = collectSources(projectId)
  if (!sources) return null
  return evaluateEligibility(sources)
}

export function getDraftPreview(projectId: string, type: DeliverablePackageType, name: string): DraftPreview | null {
  return previewDraft(projectId, type, name)
}

/* ------------------------------------------------------------------ */
/* 생성                                                                 */
/* ------------------------------------------------------------------ */

export function createPackage(
  projectId: string,
  type: DeliverablePackageType,
  name: string,
  opts: BuildDraftOptions = {},
): DeliverablePackage {
  const project = projectRepository.getById(projectId)
  if (!project) throw new DeliverableBlockedError('프로젝트를 찾을 수 없습니다.')
  const result = buildPackageDraft(projectId, type, name.trim() || PACKAGE_TYPE_META[type].label, CURRENT_USER.name, opts)
  if (!result) throw new DeliverableBlockedError('자료를 생성할 출처가 없습니다.')
  const created = deliverablePackageRepository.create(result.input)
  activityRepository.add({
    organizationId: created.organizationId,
    projectId,
    activityType: 'project_updated',
    title: `${PACKAGE_TYPE_META[type].label} 자료 패키지 초안이 생성되었습니다.`,
    description: `Section ${created.sections.length}개 · 프롬프트 ${created.prompts.length}개 · 규칙 v${DELIVERABLE_RULE_VERSION}`,
    actorName: CURRENT_USER.name,
  })
  return created
}

/** 새 버전 생성 (기존 수동 수정본을 선택적으로 복사) */
export function createNewVersion(projectId: string, sourcePackageId: string, copyManualEdits: boolean): DeliverablePackage {
  const prior = deliverablePackageRepository.getById(sourcePackageId)
  if (!prior) throw new DeliverableBlockedError('기준 패키지를 찾을 수 없습니다.')
  const result = buildPackageDraft(projectId, prior.type, prior.name, CURRENT_USER.name, { audience: prior.audience })
  if (!result) throw new DeliverableBlockedError('자료를 생성할 출처가 없습니다.')
  let input = result.input
  if (copyManualEdits) {
    // 같은 유형의 Section에 이전 수동 수정본을 이식한다 (원본은 새로 생성된 것 유지)
    const editedByType = new Map(prior.sections.filter((s) => s.manuallyEdited).map((s) => [`${s.type}:${s.track}`, s]))
    input = {
      ...input,
      sections: input.sections.map((s) => {
        const prev = editedByType.get(`${s.type}:${s.track}`)
        if (!prev) return s
        return { ...s, body: prev.body, structuredContent: prev.structuredContent, manuallyEdited: true, editNotes: prev.editNotes, editedBy: prev.editedBy, editedAt: prev.editedAt }
      }),
    }
  }
  return deliverablePackageRepository.create(input)
}

/* ------------------------------------------------------------------ */
/* 편집 공통                                                            */
/* ------------------------------------------------------------------ */

function load(packageId: string): DeliverablePackage {
  const pkg = deliverablePackageRepository.getById(packageId)
  if (!pkg) throw new DeliverableEditError('제출자료 패키지를 찾을 수 없습니다.')
  return pkg
}

function assertEditable(pkg: DeliverablePackage): void {
  if (pkg.status === 'finalized' || pkg.status === 'superseded' || pkg.status === 'archived') {
    throw new DeliverableEditError('확정된 자료는 수정할 수 없습니다. 새 버전을 만드세요.')
  }
}

/** 최신 출처와 스냅샷 해시가 다른지 (원본 변경 감지) */
export function needsRefresh(pkg: DeliverablePackage): boolean {
  if (pkg.ruleVersion !== DELIVERABLE_RULE_VERSION) return true
  const sources = collectSources(pkg.projectId)
  if (!sources) return false
  return computeSourceHash(sources) !== pkg.sourceSnapshotHash
}

function saveWith(pkg: DeliverablePackage, patch: Partial<DeliverablePackage>): DeliverablePackage {
  const merged = { ...pkg, ...patch }
  const qualityChecks = runDeliverableQuality(merged, { stale: needsRefresh(merged) })
  return deliverablePackageRepository.update(pkg.id, { ...patch, qualityChecks })
}

/* ------------------------------------------------------------------ */
/* Section 편집                                                         */
/* ------------------------------------------------------------------ */

function withSection(pkg: DeliverablePackage, sectionId: string, fn: (s: DeliverableSection) => DeliverableSection): DeliverableSection[] {
  return pkg.sections.map((s) => (s.id === sectionId ? fn(s) : s))
}

/** 본문 텍스트 수동 수정 (자동 원본은 originalBody에 보존) */
export function editSectionBody(packageId: string, sectionId: string, body: string, editNotes: string): DeliverablePackage {
  const pkg = load(packageId)
  assertEditable(pkg)
  return saveWith(pkg, {
    sections: withSection(pkg, sectionId, (s) => ({
      ...s,
      body,
      manuallyEdited: true,
      editNotes,
      editedBy: CURRENT_USER.name,
      editedAt: nowIso(),
      status: s.status === 'auto_generated' ? 'needs_review' : s.status,
      updatedAt: nowIso(),
    })),
  })
}

export function updateSectionMeta(
  packageId: string,
  sectionId: string,
  patch: Partial<Pick<DeliverableSection, 'title' | 'subtitle' | 'summary' | 'visibility' | 'status'>>,
): DeliverablePackage {
  const pkg = load(packageId)
  assertEditable(pkg)
  return saveWith(pkg, { sections: withSection(pkg, sectionId, (s) => ({ ...s, ...patch, updatedAt: nowIso() })) })
}

export function setSectionVisibility(packageId: string, sectionId: string, visibility: DeliverableSectionVisibility): DeliverablePackage {
  return updateSectionMeta(packageId, sectionId, { visibility })
}

export function setSectionIncluded(packageId: string, sectionId: string, included: boolean): DeliverablePackage {
  const pkg = load(packageId)
  assertEditable(pkg)
  return saveWith(pkg, { sections: withSection(pkg, sectionId, (s) => ({ ...s, status: included ? (s.manuallyEdited ? 'needs_review' : 'auto_generated') : 'excluded', updatedAt: nowIso() })) })
}

export function setSectionStatus(packageId: string, sectionId: string, status: DeliverableSectionStatus): DeliverablePackage {
  return updateSectionMeta(packageId, sectionId, { status })
}

/** 자동 생성 원본으로 복구 (수동 수정 취소) */
export function restoreSectionOriginal(packageId: string, sectionId: string): DeliverablePackage {
  const pkg = load(packageId)
  assertEditable(pkg)
  return saveWith(pkg, {
    sections: withSection(pkg, sectionId, (s) => ({
      ...s,
      body: s.originalBody,
      structuredContent: s.originalStructuredContent,
      manuallyEdited: false,
      editNotes: '',
      editedBy: '',
      editedAt: null,
      status: 'auto_generated',
      updatedAt: nowIso(),
    })),
  })
}

export function moveSection(packageId: string, sectionId: string, direction: 'up' | 'down'): DeliverablePackage {
  const pkg = load(packageId)
  assertEditable(pkg)
  const sorted = [...pkg.sections].sort((a, b) => a.orderIndex - b.orderIndex)
  const idx = sorted.findIndex((s) => s.id === sectionId)
  if (idx < 0) return pkg
  const swap = direction === 'up' ? idx - 1 : idx + 1
  if (swap < 0 || swap >= sorted.length) return pkg
  ;[sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]]
  return saveWith(pkg, { sections: sorted.map((s, i) => ({ ...s, orderIndex: i })) })
}

/**
 * 자동 원본 재생성 — 수동 수정본을 즉시 덮어쓰지 않고 새 원본을 준비한다.
 * 반환된 새 원본 본문을 사용자가 검토 후 적용(applyRegenerated)하거나 유지한다.
 */
export function regenerateSectionOriginal(packageId: string, sectionId: string): { newOriginalBody: string } | null {
  const pkg = load(packageId)
  const section = pkg.sections.find((s) => s.id === sectionId)
  if (!section) return null
  const result = buildPackageDraft(pkg.projectId, pkg.type, pkg.name, CURRENT_USER.name, { audience: pkg.audience })
  if (!result) return null
  const fresh = result.input.sections.find((s) => s.type === section.type && s.track === section.track)
  if (!fresh) return null
  return { newOriginalBody: blocksToText(fresh.structuredContent) }
}

/** 재생성한 원본을 실제 적용 (수동 수정 해제) */
export function applyRegeneratedOriginal(packageId: string, sectionId: string): DeliverablePackage {
  const pkg = load(packageId)
  assertEditable(pkg)
  const section = pkg.sections.find((s) => s.id === sectionId)
  if (!section) throw new DeliverableEditError('Section을 찾을 수 없습니다.')
  const result = buildPackageDraft(pkg.projectId, pkg.type, pkg.name, CURRENT_USER.name, { audience: pkg.audience })
  const fresh = result?.input.sections.find((s) => s.type === section.type && s.track === section.track)
  if (!fresh) throw new DeliverableEditError('원본을 재생성할 수 없습니다.')
  return saveWith(pkg, {
    sections: withSection(pkg, sectionId, (s) => ({
      ...s,
      body: fresh.body,
      structuredContent: fresh.structuredContent,
      originalBody: fresh.originalBody,
      originalStructuredContent: fresh.originalStructuredContent,
      manuallyEdited: false,
      editNotes: '',
      status: 'auto_generated',
      updatedAt: nowIso(),
    })),
  })
}

/* ------------------------------------------------------------------ */
/* 가림 규칙·프롬프트·로드맵·요약                                        */
/* ------------------------------------------------------------------ */

export function toggleRedactionRule(packageId: string, ruleId: string, enabled: boolean): DeliverablePackage {
  const pkg = load(packageId)
  assertEditable(pkg)
  const redactionRules: DeliverableRedactionRule[] = pkg.redactionRules.map((r) => (r.id === ruleId ? { ...r, enabled } : r))
  return saveWith(pkg, { redactionRules })
}

export function editPromptContent(packageId: string, promptId: string, content: string, editNotes: string): DeliverablePackage {
  const pkg = load(packageId)
  assertEditable(pkg)
  const prompts: DeliverablePrompt[] = pkg.prompts.map((p) => (p.id === promptId ? { ...p, content, manuallyEdited: true, editNotes } : p))
  return saveWith(pkg, { prompts })
}

export function restorePromptOriginal(packageId: string, promptId: string): DeliverablePackage {
  const pkg = load(packageId)
  assertEditable(pkg)
  const prompts: DeliverablePrompt[] = pkg.prompts.map((p) => (p.id === promptId ? { ...p, content: p.originalContent, manuallyEdited: false, editNotes: '' } : p))
  return saveWith(pkg, { prompts })
}

export function updateRoadmapPhase(
  packageId: string,
  phaseId: string,
  patch: Partial<Pick<RoadmapPhase, 'owner' | 'estimatedDurationText' | 'status' | 'objective' | 'scope'>>,
): DeliverablePackage {
  const pkg = load(packageId)
  assertEditable(pkg)
  const roadmap = pkg.roadmap.map((ph) => (ph.id === phaseId ? { ...ph, ...patch } : ph))
  return saveWith(pkg, { roadmap })
}

export function updatePackageMeta(
  packageId: string,
  patch: Partial<Pick<DeliverablePackage, 'name' | 'description' | 'finalSummary' | 'reviewNotes' | 'assumptions' | 'openQuestions'>>,
): DeliverablePackage {
  const pkg = load(packageId)
  assertEditable(pkg)
  return saveWith(pkg, patch)
}

/* ------------------------------------------------------------------ */
/* 라이프사이클                                                         */
/* ------------------------------------------------------------------ */

export function markReviewed(packageId: string): DeliverablePackage {
  const pkg = load(packageId)
  assertEditable(pkg)
  return deliverablePackageRepository.markReviewed(packageId, CURRENT_USER.name)
}

export interface FinalizeCheck {
  ok: boolean
  reasons: string[]
}

export function checkCanFinalize(pkg: DeliverablePackage): FinalizeCheck {
  const checks = runDeliverableQuality(pkg, { stale: needsRefresh(pkg) })
  const reasons = checks.filter((c) => c.severity === 'error' && !c.passed).map((c) => `${c.title}: ${c.description}`)
  return { ok: reasons.length === 0, reasons }
}

export function finalizePackage(packageId: string): DeliverablePackage {
  const pkg = load(packageId)
  if (pkg.status === 'finalized') return pkg
  const checks = runDeliverableQuality(pkg, { stale: needsRefresh(pkg) })
  if (hasBlockingErrors(checks)) {
    throw new DeliverableBlockedError(checks.filter((c) => c.severity === 'error' && !c.passed).map((c) => c.title).join(', '))
  }
  deliverablePackageRepository.update(pkg.id, { qualityChecks: checks })
  const finalized = deliverablePackageRepository.finalize(pkg.id, CURRENT_USER.name)
  deliverablePackageSnapshotRepository.replaceForPackage(finalized.id, buildPackageSnapshot(finalized, nowIso()))
  activityRepository.add({
    organizationId: finalized.organizationId,
    projectId: finalized.projectId,
    activityType: 'status_changed',
    title: `${organizationRepository.getById(finalized.organizationId)?.name ?? '고객사'} ${PACKAGE_TYPE_META[finalized.type].label} v${finalized.version}이 확정되었습니다.`,
    description: `Section ${finalized.sections.filter((s) => s.status !== 'excluded').length}개 · 대상 ${finalized.audience}`,
    actorName: CURRENT_USER.name,
  })
  return finalized
}

/* ------------------------------------------------------------------ */
/* 내보내기 (메타데이터만 기록, Blob·base64 저장 금지)                   */
/* ------------------------------------------------------------------ */

export interface ExportResult {
  content: string
  fileName: string
}

function fileNameFor(pkg: DeliverablePackage, format: DeliverableExportFormat, audience: DeliverableAudience): string {
  const ext = format === 'markdown' ? 'md' : format === 'json' ? 'json' : 'txt'
  const safe = pkg.name.replace(/\s+/g, '_')
  return `${safe}_${audience}_v${pkg.version}.${ext}`
}

/** 내보내기 콘텐츠를 만들고 메타데이터 기록을 남긴다 (실제 파일은 브라우저에서 생성). */
export function exportPackage(packageId: string, format: DeliverableExportFormat, audience: DeliverableAudience): ExportResult {
  const pkg = load(packageId)
  const content = buildExportContent(pkg, format, audience)
  const fileName = fileNameFor(pkg, format, audience)
  deliverableExportRepository.create({
    packageId: pkg.id,
    format,
    audience,
    generatedAt: nowIso(),
    sectionIds: pkg.sections.filter((s) => s.status !== 'excluded').map((s) => s.id),
    fileName,
    contentHash: contentHash(content),
  })
  return { content, fileName }
}

export function getRedactedView(pkg: DeliverablePackage, audience: DeliverableAudience): RedactedView {
  return buildRedactedView(pkg, audience)
}

/* ------------------------------------------------------------------ */
/* 조회 컨텍스트·대시보드                                                */
/* ------------------------------------------------------------------ */

export function getPackage(id: string): DeliverablePackage | null {
  return deliverablePackageRepository.getById(id)
}

export function summarizePackage(pkg: DeliverablePackage): DeliverableSummary {
  return buildPackageSummary(pkg, needsRefresh(pkg))
}

export interface ProjectDeliverableContext {
  project: Project
  organization: Organization | null
  eligibility: DeliverableEligibility
  packages: DeliverablePackage[]
  latest: DeliverablePackage | null
  latestStale: boolean
}

export function getProjectDeliverableContext(projectId: string): ProjectDeliverableContext | null {
  const project = projectRepository.getById(projectId)
  if (!project) return null
  const eligibility = getDeliverableEligibility(projectId)
  if (!eligibility) return null
  const packages = deliverablePackageRepository.getByProjectId(projectId)
  const latest = deliverablePackageRepository.getLatestByProjectId(projectId)
  return {
    project,
    organization: organizationRepository.getById(project.organizationId),
    eligibility,
    packages,
    latest,
    latestStale: latest ? needsRefresh(latest) : false,
  }
}

export interface DeliverablePendingCounts {
  creatable: number
  inProgress: number
  needsReview: number
  stale: number
  qualityErrors: number
}

/** 대시보드 KPI: 제출자료 상태 요약 */
export function countDeliverablePending(): DeliverablePendingCounts {
  let creatable = 0
  let inProgress = 0
  let needsReview = 0
  let stale = 0
  let qualityErrors = 0
  for (const project of projectRepository.getAll()) {
    if (project.status === 'archived') continue
    const eligibility = getDeliverableEligibility(project.id)
    if (!eligibility?.canCreate) continue
    const latest = deliverablePackageRepository.getLatestByProjectId(project.id)
    if (!latest) {
      creatable += 1
      continue
    }
    if (latest.status === 'draft') inProgress += 1
    else if (latest.status === 'reviewed') needsReview += 1
    if (needsRefresh(latest)) stale += 1
    if (latest.qualityChecks.some((c) => c.severity === 'error' && !c.passed)) qualityErrors += 1
  }
  return { creatable, inProgress, needsReview, stale, qualityErrors }
}

/** 확정 자료 결과 목록 */
export function getAllPackages(): DeliverablePackage[] {
  return deliverablePackageRepository.getAll()
}
