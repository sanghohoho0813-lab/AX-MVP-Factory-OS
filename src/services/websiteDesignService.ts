import type { Organization, Project } from '../types/domain'
import type { AssessmentResult, WebsiteReadinessResult } from '../types/assessment'
import type {
  BrandPersonality,
  DesignDirection,
  WebsiteConversionAction,
  WebsiteDesign,
  WebsitePage,
  WebsitePageStatus,
  WebsitePromptType,
  WebsiteSection,
  WebsiteStrategy,
  WebsiteType,
} from '../types/websiteDesign'
import {
  activityRepository,
  assessmentRepository,
  organizationRepository,
  projectRepository,
  surveyResponseRepository,
  websiteDesignHandoffRepository,
  websiteDesignRepository,
} from '../repositories'
import { CURRENT_USER } from '../data/demo'
import { WEBSITE_TYPE_META } from '../lib/websiteDesignMeta'
import {
  buildWebsiteDesignDraft,
  computeWebsiteHash,
  regenerateForType,
} from './websiteStudio/websiteOrchestrator'
import { evaluateGuardrails } from './websiteStudio/guardrailEngine'
import { runQualityChecks, hasBlockingErrors } from './websiteStudio/qualityEngine'
import { buildPromptContent } from './websiteStudio/promptBuilder'
import { buildWebsiteHandoff } from './websiteStudio/handoffBuilder'
import { WEBSITE_DESIGN_RULE_VERSION } from './websiteStudio/scoringConfig'

function nowIso(): string {
  return new Date().toISOString()
}

export class WebsiteDesignBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebsiteDesignBlockedError'
  }
}
export class WebsiteDesignEditError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebsiteDesignEditError'
  }
}

/* ------------------------------------------------------------------ */
/* 자격·라이프사이클                                                    */
/* ------------------------------------------------------------------ */

export type WebsiteLifecycle =
  | 'not_applicable'
  | 'ready_to_design'
  | 'draft'
  | 'reviewed'
  | 'finalized'
  | 'needs_redesign'

export interface WebsiteEligibility {
  canDesign: boolean
  axOnly: boolean
  reasons: string[]
  hasResponses: boolean
  hasReadiness: boolean
  assessment: AssessmentResult | null
  readiness: WebsiteReadinessResult | null
}

function websiteAssessment(projectId: string): AssessmentResult | null {
  const a = assessmentRepository.getLatestByProjectId(projectId)
  if (!a) return null
  return a.analysisKind === 'website' || a.analysisKind === 'ax_website' ? a : a
}

export function getWebsiteEligibility(project: Project): WebsiteEligibility {
  if (project.projectType === 'ax') {
    return {
      canDesign: false,
      axOnly: true,
      reasons: ['AX 전용 프로젝트입니다. 홈페이지 설계 대상이 아닙니다.'],
      hasResponses: false,
      hasReadiness: false,
      assessment: null,
      readiness: null,
    }
  }
  const responses = surveyResponseRepository.search({ projectId: project.id, status: 'submitted' })
  const hasResponses = responses.length > 0
  const assessment = websiteAssessment(project.id)
  const readiness = assessment?.websiteReadiness ?? null
  const reasons: string[] = []
  if (!readiness) {
    reasons.push('홈페이지 준비도 분석을 먼저 확정하면 더 정확해집니다.')
  }
  return {
    canDesign: true,
    axOnly: false,
    reasons,
    hasResponses,
    hasReadiness: Boolean(readiness),
    assessment,
    readiness,
  }
}

export function needsRedesign(design: WebsiteDesign): boolean {
  const assessment = websiteAssessment(design.projectId)
  if (design.ruleVersion !== WEBSITE_DESIGN_RULE_VERSION) return true
  const responses = surveyResponseRepository.search({ projectId: design.projectId, status: 'submitted' })
  return computeWebsiteHash(assessment, responses.map((r) => r.id)) !== design.sourceSnapshotHash
}

export function getWebsiteLifecycle(project: Project): WebsiteLifecycle {
  if (project.projectType === 'ax') return 'not_applicable'
  const design = websiteDesignRepository.getLatestByProjectId(project.id)
  if (design) {
    if (design.status === 'finalized') return needsRedesign(design) ? 'needs_redesign' : 'finalized'
    if (design.status === 'reviewed') return 'reviewed'
    if (design.status === 'draft') return 'draft'
  }
  return 'ready_to_design'
}

/** 대시보드 KPI: 홈페이지 설계 대기 (website/ax_website · 설계 미확정) */
export function countWebsitePending(): number {
  return projectRepository.getAll().filter((p) => {
    if (p.projectType === 'ax' || p.status === 'archived') return false
    const design = websiteDesignRepository.getLatestByProjectId(p.id)
    return !design || design.status !== 'finalized' || needsRedesign(design)
  }).length
}

/* ------------------------------------------------------------------ */
/* 생성/재생성                                                          */
/* ------------------------------------------------------------------ */

function collectResponseIds(projectId: string): string[] {
  return surveyResponseRepository.search({ projectId, status: 'submitted' }).map((r) => r.id)
}

export function ensureWebsiteDraft(projectId: string): WebsiteDesign {
  const project = projectRepository.getById(projectId)
  if (!project) throw new WebsiteDesignBlockedError('프로젝트를 찾을 수 없습니다.')
  const eligibility = getWebsiteEligibility(project)
  if (!eligibility.canDesign) {
    throw new WebsiteDesignBlockedError(eligibility.reasons[0] ?? '홈페이지 설계를 시작할 수 없습니다.')
  }
  const existing = websiteDesignRepository.getLatestByProjectId(projectId)
  if (existing && existing.status !== 'finalized' && existing.status !== 'superseded') {
    return existing
  }
  const organization = organizationRepository.getById(project.organizationId)
  const draft = buildWebsiteDesignDraft(
    project,
    organization,
    eligibility.assessment,
    eligibility.readiness,
    collectResponseIds(projectId),
    CURRENT_USER.name,
  )
  const created = websiteDesignRepository.create(draft)
  activityRepository.add({
    organizationId: project.organizationId,
    projectId,
    activityType: 'project_updated',
    title: '홈페이지 설계 초안이 생성되었습니다.',
    description: `유형: ${WEBSITE_TYPE_META[created.strategy.websiteType].label} · 규칙 v${WEBSITE_DESIGN_RULE_VERSION}`,
    actorName: CURRENT_USER.name,
  })
  return created
}

export function createNewWebsiteVersion(projectId: string): WebsiteDesign {
  const project = projectRepository.getById(projectId)
  if (!project) throw new WebsiteDesignBlockedError('프로젝트를 찾을 수 없습니다.')
  const eligibility = getWebsiteEligibility(project)
  if (!eligibility.canDesign) throw new WebsiteDesignBlockedError(eligibility.reasons[0] ?? '설계를 시작할 수 없습니다.')
  const organization = organizationRepository.getById(project.organizationId)
  const draft = buildWebsiteDesignDraft(
    project,
    organization,
    eligibility.assessment,
    eligibility.readiness,
    collectResponseIds(projectId),
    CURRENT_USER.name,
  )
  return websiteDesignRepository.create(draft)
}

/* ------------------------------------------------------------------ */
/* 편집 공통 — 파생값 재계산                                            */
/* ------------------------------------------------------------------ */

function assertEditable(design: WebsiteDesign): void {
  if (design.status === 'finalized' || design.status === 'superseded') {
    throw new WebsiteDesignEditError('확정된 설계는 수정할 수 없습니다. 새 버전을 만드세요.')
  }
}

function recompute(design: WebsiteDesign): Pick<WebsiteDesign, 'scopeGuardrails' | 'qualityChecks'> {
  const scopeGuardrails = evaluateGuardrails(design)
  const qualityChecks = runQualityChecks(design, scopeGuardrails)
  return { scopeGuardrails, qualityChecks }
}

function saveWith(design: WebsiteDesign, patch: Partial<WebsiteDesign>): WebsiteDesign {
  const next = { ...design, ...patch }
  const derived = recompute(next)
  return websiteDesignRepository.update(design.id, { ...patch, ...derived })
}

function load(designId: string): WebsiteDesign {
  const design = websiteDesignRepository.getById(designId)
  if (!design) throw new WebsiteDesignEditError('홈페이지 설계를 찾을 수 없습니다.')
  return design
}

/* ------------------------------------------------------------------ */
/* 전략 편집                                                            */
/* ------------------------------------------------------------------ */

export function updateStrategy(
  designId: string,
  patch: Partial<Pick<WebsiteStrategy, 'purpose' | 'businessGoal' | 'keyMessage' | 'differentiation' | 'trustStrategy' | 'toneOfVoice'>>,
): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  return saveWith(design, { strategy: { ...design.strategy, ...patch } })
}

export function setWebsiteType(designId: string, type: WebsiteType, reason: string): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  if (type !== design.strategy.websiteType && reason.trim() === '') {
    throw new WebsiteDesignEditError('추천과 다른 유형을 선택하려면 변경 사유가 필요합니다.')
  }
  const project = projectRepository.getById(design.projectId)
  if (!project) throw new WebsiteDesignEditError('프로젝트를 찾을 수 없습니다.')
  const organization = organizationRepository.getById(design.organizationId)
  const regenerated = regenerateForType(project, organization, design.websiteReadinessSnapshot, type, reason.trim())
  const pages = regenerated.pages.map((p) => ({ ...p, designId: design.id }))
  return saveWith(design, {
    strategy: { ...regenerated.strategy, websiteTypeOverrideReason: type !== design.strategy.websiteType ? reason.trim() : '' },
    pages,
    contentItems: regenerated.contentItems,
    assetRequirements: regenerated.assetRequirements,
    forms: regenerated.forms,
    integrations: regenerated.integrations,
  })
}

export function updateConversionAction(
  designId: string,
  actionId: string,
  patch: Partial<Pick<WebsiteConversionAction, 'label' | 'buttonText' | 'type' | 'priority' | 'destination'>>,
): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  const conversionActions = design.strategy.conversionActions.map((c) => (c.id === actionId ? { ...c, ...patch } : c))
  return saveWith(design, { strategy: { ...design.strategy, conversionActions } })
}

/* ------------------------------------------------------------------ */
/* 페이지 편집                                                          */
/* ------------------------------------------------------------------ */

function reindex<T extends { orderIndex: number }>(list: T[]): T[] {
  return list.map((item, i) => ({ ...item, orderIndex: i }))
}

function uniqueSlug(pages: WebsitePage[], base: string, excludeId: string): string {
  const used = new Set(pages.filter((p) => p.id !== excludeId).map((p) => p.slug))
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

let pageSeq = 0
export function addPage(designId: string, name: string): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  pageSeq += 1
  const id = `pg-manual-${Date.now()}-${pageSeq}`
  const slugBase = `/${(name.trim() || 'page').replace(/\s+/g, '-')}`
  const page: WebsitePage = {
    id,
    designId: design.id,
    name: name.trim() || '새 페이지',
    slug: uniqueSlug(design.pages, slugBase, id),
    pageType: 'custom',
    purpose: '',
    targetAudienceIds: [],
    primaryMessage: '',
    primaryConversionActionId: null,
    sections: [],
    seo: { titleDirection: '', descriptionDirection: '', primaryTopic: '', supportingTopics: [], headingStructure: [], internalLinks: [], schemaTypeSuggestions: [], indexable: true, notes: '' },
    navigation: true,
    status: 'recommended',
    orderIndex: design.pages.length,
    autoGenerated: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    archivedAt: null,
  }
  return saveWith(design, { pages: reindex([...design.pages, page]) })
}

export function updatePage(
  designId: string,
  pageId: string,
  patch: Partial<Pick<WebsitePage, 'name' | 'slug' | 'purpose' | 'primaryMessage' | 'status' | 'navigation'>>,
): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  const pages = design.pages.map((p) => {
    if (p.id !== pageId) return p
    const next = { ...p, ...patch }
    if (patch.slug !== undefined) next.slug = uniqueSlug(design.pages, patch.slug.trim() || p.slug, pageId)
    return next
  })
  return saveWith(design, { pages })
}

export function setPageStatus(designId: string, pageId: string, status: WebsitePageStatus): WebsiteDesign {
  return updatePage(designId, pageId, { status })
}

export function duplicatePage(designId: string, pageId: string): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  const src = design.pages.find((p) => p.id === pageId)
  if (!src) throw new WebsiteDesignEditError('페이지를 찾을 수 없습니다.')
  pageSeq += 1
  const id = `pg-copy-${Date.now()}-${pageSeq}`
  const copy: WebsitePage = {
    ...src,
    id,
    name: `${src.name} 사본`,
    slug: uniqueSlug(design.pages, `${src.slug}-copy`, id),
    autoGenerated: false,
    sections: src.sections.map((s, i) => ({ ...s, id: `${id}-sec-${i}`, pageId: id })),
    orderIndex: design.pages.length,
  }
  return saveWith(design, { pages: reindex([...design.pages, copy]) })
}

export function deletePage(designId: string, pageId: string): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  const pages = reindex(design.pages.filter((p) => p.id !== pageId))
  return saveWith(design, { pages })
}

export function movePage(designId: string, pageId: string, direction: 'up' | 'down'): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  const sorted = [...design.pages].sort((a, b) => a.orderIndex - b.orderIndex)
  const idx = sorted.findIndex((p) => p.id === pageId)
  if (idx < 0) return design
  const swap = direction === 'up' ? idx - 1 : idx + 1
  if (swap < 0 || swap >= sorted.length) return design
  ;[sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]]
  return saveWith(design, { pages: reindex(sorted) })
}

/* ------------------------------------------------------------------ */
/* 섹션 편집                                                            */
/* ------------------------------------------------------------------ */

function withPage(design: WebsiteDesign, pageId: string, fn: (sections: WebsiteSection[]) => WebsiteSection[]): WebsitePage[] {
  return design.pages.map((p) => (p.id === pageId ? { ...p, sections: reindex(fn(p.sections)) } : p))
}

let secSeq = 0
export function addSection(designId: string, pageId: string, sectionType: WebsiteSection['sectionType']): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  secSeq += 1
  const section: WebsiteSection = {
    id: `sec-manual-${Date.now()}-${secSeq}`,
    pageId,
    sectionType,
    title: '',
    purpose: '',
    keyMessage: '',
    supportingContent: [],
    contentItems: [],
    visualDirection: '',
    ctaActionId: null,
    requiredAssets: [],
    contentStatus: 'not_required',
    mobileBehavior: '한 열 배치',
    scope: 'recommended',
    notes: '',
    orderIndex: 0,
    autoGenerated: false,
  }
  return saveWith(design, { pages: withPage(design, pageId, (s) => [...s, section]) })
}

export function updateSection(
  designId: string,
  pageId: string,
  sectionId: string,
  patch: Partial<Pick<WebsiteSection, 'title' | 'purpose' | 'keyMessage' | 'visualDirection' | 'mobileBehavior' | 'scope' | 'contentStatus' | 'notes'>>,
): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  return saveWith(design, { pages: withPage(design, pageId, (s) => s.map((sec) => (sec.id === sectionId ? { ...sec, ...patch } : sec))) })
}

export function duplicateSection(designId: string, pageId: string, sectionId: string): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  return saveWith(design, {
    pages: withPage(design, pageId, (s) => {
      const src = s.find((x) => x.id === sectionId)
      if (!src) return s
      secSeq += 1
      return [...s, { ...src, id: `sec-copy-${Date.now()}-${secSeq}`, title: `${src.title || ''} 사본`.trim(), autoGenerated: false }]
    }),
  })
}

export function deleteSection(designId: string, pageId: string, sectionId: string): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  return saveWith(design, { pages: withPage(design, pageId, (s) => s.filter((x) => x.id !== sectionId)) })
}

export function moveSection(designId: string, pageId: string, sectionId: string, direction: 'up' | 'down'): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  return saveWith(design, {
    pages: withPage(design, pageId, (s) => {
      const sorted = [...s].sort((a, b) => a.orderIndex - b.orderIndex)
      const idx = sorted.findIndex((x) => x.id === sectionId)
      if (idx < 0) return s
      const swap = direction === 'up' ? idx - 1 : idx + 1
      if (swap < 0 || swap >= sorted.length) return s
      ;[sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]]
      return sorted
    }),
  })
}

export function copySectionToPage(designId: string, fromPageId: string, sectionId: string, toPageId: string): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  const src = design.pages.find((p) => p.id === fromPageId)?.sections.find((s) => s.id === sectionId)
  if (!src) throw new WebsiteDesignEditError('섹션을 찾을 수 없습니다.')
  secSeq += 1
  const copy: WebsiteSection = { ...src, id: `sec-copy-${Date.now()}-${secSeq}`, pageId: toPageId, autoGenerated: false }
  return saveWith(design, { pages: withPage(design, toPageId, (s) => [...s, copy]) })
}

/* ------------------------------------------------------------------ */
/* 콘텐츠·자산·디자인 편집                                              */
/* ------------------------------------------------------------------ */

export function updateContentItem(
  designId: string,
  itemId: string,
  patch: Partial<Pick<WebsiteDesign['contentItems'][number], 'status' | 'owner' | 'dueDate' | 'notes' | 'source'>>,
): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  const contentItems = design.contentItems.map((c) => (c.id === itemId ? { ...c, ...patch } : c))
  return saveWith(design, { contentItems })
}

export function updateAssetRequirement(
  designId: string,
  assetId: string,
  patch: Partial<Pick<WebsiteDesign['assetRequirements'][number], 'status' | 'source' | 'notes'>>,
): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  const assetRequirements = design.assetRequirements.map((a) => (a.id === assetId ? { ...a, ...patch } : a))
  return saveWith(design, { assetRequirements })
}

export function updateDesignDirection(designId: string, patch: Partial<DesignDirection>): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  return saveWith(design, { designDirection: { ...design.designDirection, ...patch } })
}

export function togglePersonality(designId: string, personality: BrandPersonality): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  const has = design.designDirection.personalities.includes(personality)
  if (!has && design.designDirection.personalities.length >= 4) {
    throw new WebsiteDesignEditError('브랜드 성격은 최대 4개까지 선택할 수 있습니다.')
  }
  const personalities = has
    ? design.designDirection.personalities.filter((p) => p !== personality)
    : [...design.designDirection.personalities, personality]
  return saveWith(design, { designDirection: { ...design.designDirection, personalities } })
}

export function updateProhibitedStyles(designId: string, styles: string[]): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  return saveWith(design, { designDirection: { ...design.designDirection, prohibitedStyles: styles } })
}

/* ------------------------------------------------------------------ */
/* 개발 지시문(프롬프트)                                                */
/* ------------------------------------------------------------------ */

let promptSeq = 0
export function generatePrompt(designId: string, type: WebsitePromptType): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  const project = projectRepository.getById(design.projectId)
  const organization = organizationRepository.getById(design.organizationId)
  if (!project) throw new WebsiteDesignEditError('프로젝트를 찾을 수 없습니다.')
  const content = buildPromptContent(type, design, project, organization)
  promptSeq += 1
  const existing = design.generatedPrompts.find((p) => p.type === type)
  const prompt = {
    id: existing?.id ?? `prompt-${type}-${promptSeq}`,
    type,
    title: '',
    content,
    generatedFromVersion: design.version,
    generatedAt: nowIso(),
    manuallyEdited: false,
    editNotes: '',
  }
  const generatedPrompts = existing
    ? design.generatedPrompts.map((p) => (p.type === type ? prompt : p))
    : [...design.generatedPrompts, prompt]
  return saveWith(design, { generatedPrompts })
}

export function updatePromptContent(designId: string, promptId: string, content: string): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  const generatedPrompts = design.generatedPrompts.map((p) =>
    p.id === promptId ? { ...p, content, manuallyEdited: true } : p,
  )
  return saveWith(design, { generatedPrompts })
}

/** 원본 재생성 — 수정본이 있으면 editNotes에 보존한다 (수정본 유실 방지). */
export function regeneratePrompt(designId: string, type: WebsitePromptType): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  const project = projectRepository.getById(design.projectId)
  const organization = organizationRepository.getById(design.organizationId)
  if (!project) throw new WebsiteDesignEditError('프로젝트를 찾을 수 없습니다.')
  const content = buildPromptContent(type, design, project, organization)
  const generatedPrompts = design.generatedPrompts.map((p) => {
    if (p.type !== type) return p
    return {
      ...p,
      content,
      manuallyEdited: false,
      generatedFromVersion: design.version,
      generatedAt: nowIso(),
      editNotes: p.manuallyEdited ? `이전 수정본 보관:\n${p.content}` : p.editNotes,
    }
  })
  return saveWith(design, { generatedPrompts })
}

/* ------------------------------------------------------------------ */
/* 요약·확정                                                            */
/* ------------------------------------------------------------------ */

export function updateDesignNotes(
  designId: string,
  patch: Partial<Pick<WebsiteDesign, 'designSummary' | 'finalNotes'>>,
): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  return saveWith(design, patch)
}

export interface WebsiteFinalizeCheck {
  ok: boolean
  reasons: string[]
}

export function checkCanFinalize(design: WebsiteDesign): WebsiteFinalizeCheck {
  const reasons: string[] = []
  if (hasBlockingErrors(design.qualityChecks)) reasons.push('해결해야 할 설계 오류가 있습니다.')
  if (design.scopeGuardrails.some((g) => g.status === 'exceeded')) reasons.push('범위 가드레일을 초과했습니다.')
  if (design.strategy.purpose.trim() === '') reasons.push('홈페이지 목적이 필요합니다.')
  if (!design.strategy.primaryConversionActionId) reasons.push('핵심 CTA가 필요합니다.')
  if (!design.pages.some((p) => p.pageType === 'home' && p.status !== 'excluded')) reasons.push('홈 페이지가 필요합니다.')
  if (!design.generatedPrompts.some((p) => p.type === 'claude_code')) reasons.push('Claude Code용 개발 지시문을 생성해야 합니다.')
  if (design.designSummary.trim() === '') reasons.push('최종 설계 요약을 작성해야 합니다.')
  return { ok: reasons.length === 0, reasons }
}

export function markWebsiteReviewed(designId: string): WebsiteDesign {
  const design = load(designId)
  assertEditable(design)
  return websiteDesignRepository.markReviewed(designId, CURRENT_USER.name)
}

export function finalizeWebsiteDesign(designId: string): WebsiteDesign {
  const design = load(designId)
  if (design.status === 'finalized') return design
  const check = checkCanFinalize(design)
  if (!check.ok) throw new WebsiteDesignBlockedError(check.reasons.join(' '))
  const finalized = websiteDesignRepository.finalize(designId, CURRENT_USER.name)
  const assessment = websiteAssessment(finalized.projectId)
  const snapshot = buildWebsiteHandoff(finalized, assessment?.version ?? 0, nowIso())
  websiteDesignHandoffRepository.replaceForDesign(finalized.id, snapshot)
  activityRepository.add({
    organizationId: finalized.organizationId,
    projectId: finalized.projectId,
    activityType: 'status_changed',
    title: `${organizationRepository.getById(finalized.organizationId)?.name ?? '고객사'} 홈페이지 설계안이 '${WEBSITE_TYPE_META[finalized.strategy.websiteType].label}'으로 확정되었습니다.`,
    description: `페이지 ${finalized.pages.filter((p) => p.status !== 'excluded').length}개 · 규칙 v${WEBSITE_DESIGN_RULE_VERSION}`,
    actorName: CURRENT_USER.name,
  })
  return finalized
}

/* ------------------------------------------------------------------ */
/* 조회 컨텍스트                                                        */
/* ------------------------------------------------------------------ */

export interface ProjectWebsiteContext {
  project: Project
  organization: Organization | null
  eligibility: WebsiteEligibility
  lifecycle: WebsiteLifecycle
  design: WebsiteDesign | null
  needsRedesignFlag: boolean
}

export function getProjectWebsiteContext(projectId: string): ProjectWebsiteContext | null {
  const project = projectRepository.getById(projectId)
  if (!project) return null
  const design = websiteDesignRepository.getLatestByProjectId(projectId)
  return {
    project,
    organization: organizationRepository.getById(project.organizationId),
    eligibility: getWebsiteEligibility(project),
    lifecycle: getWebsiteLifecycle(project),
    design,
    needsRedesignFlag: design ? needsRedesign(design) : false,
  }
}
