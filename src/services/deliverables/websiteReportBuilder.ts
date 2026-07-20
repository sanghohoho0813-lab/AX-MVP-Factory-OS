import type {
  DesignDirection,
  FrameworkPreference,
  WebsiteAudience,
  WebsiteFormRequirement,
  WebsiteHandoffPage,
  WebsiteIntegrationRequirement,
  WebsiteStrategy,
  WebsiteTechnicalScope,
} from '../../types/websiteDesign'
import {
  BRAND_PERSONALITY_META,
  INTEGRATION_TYPE_META,
  PAGE_STATUS_META,
  WEBSITE_TYPE_META,
} from '../../lib/websiteDesignMeta'
import { BlockBuilder } from './contentBlocks'
import type { CollectedSources } from './sourceCollector'
import type { SectionSeed } from './sectionFactory'

/* FrameworkPreference는 별도 라벨 맵이 없어 로컬로 정의(결정적) */
const FRAMEWORK_LABEL: Record<FrameworkPreference, string> = {
  unspecified: '미지정',
  react_vite: 'React + Vite',
  nextjs: 'Next.js',
  static_html: '정적 HTML',
  webflow: 'Webflow',
  wordpress: 'WordPress',
  other: '기타',
}

const yn = (v: boolean): string => (v ? '예' : '아니오')

function audienceLine(a: WebsiteAudience): string {
  const tag = a.priority === 'primary' ? '핵심' : '보조'
  const desc = a.description.trim()
  return desc ? `${a.name} (${tag}) — ${desc}` : `${a.name} (${tag})`
}

/** 전략 블록: 목적·유형·고객·CTA·메시지·차별점·신뢰 */
function strategyBlocks(prefix: string, strategy: WebsiteStrategy): BlockBuilder {
  const b = new BlockBuilder(prefix)
  b.heading('홈페이지 전략')

  const primaryCta = strategy.conversionActions.find((a) => a.id === strategy.primaryConversionActionId)
  const ctaLabel = primaryCta ? primaryCta.label : '핵심 전환 행동 미정'
  const typeLabel = WEBSITE_TYPE_META[strategy.websiteType].label

  b.keyValue(
    [
      { key: '홈페이지 목적', value: strategy.purpose },
      { key: '사업 목표', value: strategy.businessGoal },
      { key: '홈페이지 유형', value: typeLabel },
      { key: '핵심 CTA', value: ctaLabel },
      { key: '핵심 메시지', value: strategy.keyMessage },
      { key: '차별점', value: strategy.differentiation },
      { key: '신뢰 전략', value: strategy.trustStrategy },
      { key: '톤앤매너', value: strategy.toneOfVoice },
    ],
    { title: '전략 요약' },
  )

  b.bullets(
    strategy.audiences.map(audienceLine),
    { title: '핵심 고객' },
  )

  b.bullets(strategy.successMetrics, { title: '성공 지표(관점)' })

  return b
}

/** 디자인 방향 블록(HEX·경쟁사 정보 등은 생성하지 않음, 방향 텍스트만) */
function appendDesignDirection(b: BlockBuilder, dir: DesignDirection): void {
  b.heading('디자인 방향')
  b.bullets(
    dir.personalities.map((p) => BRAND_PERSONALITY_META[p].label),
    { title: '브랜드 성격' },
  )
  b.paragraph(dir.moodDescription)
  b.keyValue(
    [
      { key: '주요 색상 방향', value: dir.primaryColorDirection },
      { key: '보조 색상 방향', value: dir.secondaryColorDirection },
      { key: '강조 색상 방향', value: dir.accentColorDirection },
      { key: '배경 방향', value: dir.backgroundDirection },
    ],
    { title: '색상 방향' },
  )
  b.keyValue(
    [
      { key: '타이포그래피', value: dir.typographyDirection },
      { key: '제목 스타일', value: dir.headingStyle },
      { key: '본문 스타일', value: dir.bodyStyle },
      { key: '이미지 스타일', value: dir.imageStyle },
      { key: '아이콘 스타일', value: dir.iconStyle },
    ],
    { title: '타이포·비주얼' },
  )
  b.bullets(dir.layoutPrinciples, { title: '레이아웃 원칙' })
  b.bullets(dir.mobilePrinciples, { title: '모바일 원칙' })
  b.bullets(dir.accessibilityPrinciples, { title: '접근성 원칙' })
  b.bullets(dir.prohibitedStyles, { title: '금지 디자인' })
}

/** 기술 범위 블록 */
function appendTechnicalScope(b: BlockBuilder, tech: WebsiteTechnicalScope): void {
  b.heading('기술 범위')
  b.keyValue(
    [
      { key: '프레임워크 선호', value: FRAMEWORK_LABEL[tech.frameworkPreference] },
      { key: '반응형', value: yn(tech.responsive) },
      { key: '모바일 우선', value: yn(tech.mobileFirst) },
      { key: 'CMS 필요', value: yn(tech.cmsRequired) },
      { key: '관리자 필요', value: yn(tech.adminRequired) },
      { key: '폼 필요', value: yn(tech.forms) },
      { key: '외부 연동 필요', value: yn(tech.integrations) },
      { key: '방문 분석', value: yn(tech.analytics) },
      { key: 'SEO 기본', value: yn(tech.seoBasics) },
      { key: '접근성 수준', value: tech.accessibilityLevel },
      { key: '성능 목표', value: tech.performanceGoal },
      { key: '호스팅 선호', value: tech.hostingPreference },
    ],
    { title: '기술 사항' },
  )
  b.bullets(tech.excludedTechnicalScope, { title: '제외 기술 범위' })
}

/** 폼 요구사항(개인정보 동의 포함) */
function appendForms(b: BlockBuilder, forms: WebsiteFormRequirement[]): void {
  if (forms.length === 0) return
  b.heading('폼 요구사항')
  b.table(
    ['폼', '목적', '입력 항목', '수신', '개인정보 동의'],
    forms.map((f) => ({
      cells: [
        f.name,
        f.purpose,
        f.fields.join(', '),
        f.destination,
        yn(f.privacyConsentRequired),
      ],
    })),
    { title: '폼 목록' },
  )
}

/** 외부 연동 */
function appendIntegrations(b: BlockBuilder, integrations: WebsiteIntegrationRequirement[]): void {
  if (integrations.length === 0) return
  b.heading('외부 연동')
  b.table(
    ['연동', '유형', '목적', '출시 필수', '담당'],
    integrations.map((i) => ({
      cells: [
        i.name,
        INTEGRATION_TYPE_META[i.type].label,
        i.purpose,
        yn(i.requiredForLaunch),
        i.setupOwner,
      ],
    })),
    { title: '연동 목록' },
  )
}

/** 페이지별 목적/상태 표 (WebsiteHandoffPage) */
function pageRows(pages: WebsiteHandoffPage[]) {
  return pages.map((p) => ({
    cells: [p.name, PAGE_STATUS_META[p.status].label, p.purpose],
  }))
}

/**
 * 홈페이지 설계 인계 스냅샷 → 제출자료 섹션 시드.
 * websiteHandoff가 없으면 [] 반환. 모든 시드는 'website' 트랙.
 */
export function buildWebsiteSeeds(sources: CollectedSources): SectionSeed[] {
  const handoff = sources.websiteHandoff
  if (!handoff) return []

  const refId = sources.references.find(
    (r) => r.sourceType === 'website_design_handoff' && r.available,
  )?.id
  const refs = refId ? [refId] : []

  const seeds: SectionSeed[] = []

  /* 1. website_strategy — 전략 + 디자인 방향 + 기술 범위 + 폼 + 연동 + 가정/질문/리스크 */
  const strat = strategyBlocks('website-strategy', handoff.strategy)
  strat.divider()
  appendDesignDirection(strat, handoff.designDirection)
  strat.divider()
  appendTechnicalScope(strat, handoff.technicalScope)
  appendForms(strat, handoff.forms)
  appendIntegrations(strat, handoff.integrations)
  strat.bullets(handoff.assumptions, { title: '설계 가정' })
  strat.bullets(handoff.openQuestions, { title: '확인 필요 질문' })
  strat.bullets(handoff.risks, { title: '리스크(내부용)', internalOnly: true })
  seeds.push({
    type: 'website_strategy',
    track: 'website',
    title: '홈페이지 전략·디자인 방향',
    subtitle: WEBSITE_TYPE_META[handoff.strategy.websiteType].label,
    summary: handoff.strategy.purpose,
    blocks: strat.build(),
    sourceReferences: refs,
    visibility: 'client_visible',
    required: true,
  })

  /* 2. sitemap — 사이트맵 목록 + 페이지 목적 표 */
  const site = new BlockBuilder('website-sitemap')
  site.heading('사이트 구조')
  site.bullets(handoff.sitemap, { title: '사이트맵' })
  site.table(['페이지', '상태', '목적'], pageRows(handoff.pages), { title: '페이지별 목적' })
  seeds.push({
    type: 'sitemap',
    track: 'website',
    title: '사이트맵',
    blocks: site.build(),
    sourceReferences: refs,
    visibility: 'developer_visible',
  })

  /* 3. page_sections — 페이지별 섹션 구성 */
  const ps = new BlockBuilder('website-page-sections')
  ps.heading('페이지별 섹션 구성')
  for (const page of handoff.pages) {
    ps.heading(`${page.name} · ${PAGE_STATUS_META[page.status].label}`)
    ps.paragraph(`목적: ${page.purpose}`)
    if (page.sectionTitles.length > 0) {
      ps.bullets(page.sectionTitles, { title: '섹션 구성' })
    } else {
      ps.paragraph('섹션 상세는 설계 스냅샷에 포함되어 있지 않습니다. 페이지 목적 기준으로 구성합니다.')
    }
  }
  seeds.push({
    type: 'page_sections',
    track: 'website',
    title: '페이지 섹션 구성',
    blocks: ps.build(),
    sourceReferences: refs,
    visibility: 'developer_visible',
  })

  /* 4. content_assets — 콘텐츠·자산 준비 요구사항(체크리스트) */
  const ca = new BlockBuilder('website-content-assets')
  ca.heading('콘텐츠·자산 준비')
  ca.checklist(handoff.contentRequirements, { title: '준비할 콘텐츠' })
  ca.checklist(handoff.assetRequirements, { title: '준비할 자산' })
  const failedChecks = handoff.qualityChecks.filter((q) => !q.passed)
  if (failedChecks.length > 0) {
    ca.bullets(
      failedChecks.map((q) => `${q.title}: ${q.description}`),
      { title: '설계 품질 점검(미통과)', internalOnly: true },
    )
  }
  ca.callout('콘텐츠 원문은 고객·담당자가 작성합니다. 본 자료는 준비 목록만 제시하며 문구를 임의 생성하지 않습니다.', {
    title: '안내',
    tone: 'info',
  })
  seeds.push({
    type: 'content_assets',
    track: 'website',
    title: '콘텐츠·자산 준비 목록',
    blocks: ca.build(),
    sourceReferences: refs,
    visibility: 'shared',
  })

  return seeds
}
