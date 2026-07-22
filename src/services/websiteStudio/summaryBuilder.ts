import type { Organization } from '../../types/domain'
import type { WebsiteDesign } from '../../types/websiteDesign'
import { WEBSITE_TYPE_META } from '../../lib/websiteDesignMeta'

/** 자동 설계 요약문 (담당자 최종 의견과 별도) */
export function buildWebsiteAutoSummary(
  design: Pick<WebsiteDesign, 'strategy' | 'pages' | 'contentItems' | 'assetRequirements'>,
  organization: Organization | null,
): string {
  const org = organization?.name ?? '고객사'
  const type = WEBSITE_TYPE_META[design.strategy.websiteType].label
  const activePages = design.pages.filter((p) => p.status === 'required' || p.status === 'recommended')
  const pageNames = activePages.map((p) => p.name).slice(0, 6).join(', ')
  const missingContent = design.contentItems.filter((c) => c.required && c.status === 'missing').length
  const missingAssets = design.assetRequirements.filter((a) => a.required && a.status === 'missing').length
  return (
    `${org}의 홈페이지를 '${type}'으로 설계했습니다. ` +
    `핵심 페이지 ${activePages.length}개(${pageNames})를 중심으로, ` +
    `핵심 전환 행동은 문의·상담 접수입니다. ` +
    `제작 전 확보가 필요한 필수 콘텐츠 ${missingContent}건, 자산 ${missingAssets}건이 있습니다. ` +
    `근거 없는 브랜드 색상은 확정하지 않고 방향만 제시했습니다.`
  )
}
