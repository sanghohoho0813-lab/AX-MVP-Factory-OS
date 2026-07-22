import type {
  WebsiteDesign,
  WebsiteDesignHandoffInput,
  WebsiteHandoffPage,
} from '../../types/websiteDesign'
import { SECTION_TYPE_META } from '../../lib/websiteDesignMeta'

/**
 * 확정 설계에서 인계 스냅샷을 만든다.
 * 확정 시점 내용을 동결해 이후 원본 변경과 무관하게 보존한다.
 */
export function buildWebsiteHandoff(
  design: WebsiteDesign,
  sourceAssessmentVersion: number,
  generatedAt: string,
): WebsiteDesignHandoffInput {
  const active = design.pages
    .filter((p) => p.status === 'required' || p.status === 'recommended')
    .sort((a, b) => a.orderIndex - b.orderIndex)

  const pages: WebsiteHandoffPage[] = active.map((p) => ({
    name: p.name,
    slug: p.slug,
    pageType: p.pageType,
    status: p.status,
    purpose: p.purpose,
    sectionTitles: p.sections
      .filter((s) => s.scope === 'required' || s.scope === 'recommended')
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((s) => s.title || SECTION_TYPE_META[s.sectionType].label),
  }))

  const selectedPrompt = design.generatedPrompts.find((p) => p.type === 'claude_code') ?? null

  return {
    projectId: design.projectId,
    organizationId: design.organizationId,
    websiteDesignId: design.id,
    version: design.version,
    strategy: design.strategy,
    sitemap: active.map((p) => p.name),
    pages,
    contentRequirements: design.contentItems
      .filter((c) => c.status === 'missing' || c.status === 'needs_review')
      .map((c) => c.title),
    assetRequirements: design.assetRequirements
      .filter((a) => a.status === 'missing' || a.status === 'partial')
      .map((a) => a.title),
    designDirection: design.designDirection,
    technicalScope: design.technicalScope,
    forms: design.forms,
    integrations: design.integrations,
    qualityChecks: design.qualityChecks,
    selectedPrompt,
    assumptions: design.assumptions,
    openQuestions: design.openQuestions,
    risks: design.risks,
    sourceAssessmentVersion,
    generatedAt,
  }
}
