import type { Organization, Project } from '../../types/domain'
import type { WebsiteReadinessResult } from '../../types/assessment'
import type {
  BrandPersonality,
  DesignDirection,
  WebsiteAssetRequirement,
  WebsiteAudience,
  WebsiteContentItem,
  WebsiteConversionAction,
  WebsiteFormRequirement,
  WebsiteIntegrationRequirement,
  WebsitePage,
  WebsitePageSeo,
  WebsiteSection,
  WebsiteStrategy,
  WebsiteTechnicalScope,
} from '../../types/websiteDesign'
import { SITEMAP_BLUEPRINTS, inferWebsiteType, type SectionBlueprint } from './websiteTaxonomy'
import { SECTION_TYPE_META } from '../../lib/websiteDesignMeta'
import { DEFAULT_EXCLUDED_SCOPE, DEFAULT_PROHIBITED_STYLES } from './scoringConfig'

const ISO = '1970-01-01T00:00:00.000Z' // 결정성 유지용 고정 타임스탬프 (repo가 실제 시각 부여)

export interface GeneratedWebsiteDesign {
  strategy: WebsiteStrategy
  pages: WebsitePage[]
  contentItems: WebsiteContentItem[]
  assetRequirements: WebsiteAssetRequirement[]
  designDirection: DesignDirection
  technicalScope: WebsiteTechnicalScope
  forms: WebsiteFormRequirement[]
  integrations: WebsiteIntegrationRequirement[]
}

function slugify(base: string, used: Set<string>): string {
  let slug = base
  let n = 2
  while (used.has(slug)) {
    slug = `${base}-${n}`
    n += 1
  }
  used.add(slug)
  return slug
}

/* 섹션 콘텐츠 규칙 */
function sectionContent(bp: SectionBlueprint, orgName: string, ctaId: string | null): {
  keyMessage: string
  purpose: string
  supporting: string[]
  assets: string[]
  cta: string | null
  mobile: string
} {
  const t = bp.sectionType
  const map: Partial<Record<typeof t, { keyMessage: string; purpose: string; supporting: string[]; assets: string[]; cta: boolean; mobile: string }>> = {
    hero: { keyMessage: `${orgName}의 핵심 가치를 한 문장으로 전달`, purpose: '첫 화면에서 방문자의 신뢰와 관심을 확보', supporting: ['핵심 헤드라인', '한 줄 보조 설명', '핵심 CTA 버튼'], assets: ['대표 이미지 또는 로고'], cta: true, mobile: '헤드라인·CTA를 한 열로 크게 배치' },
    problem: { keyMessage: '방문 고객이 겪는 문제를 공감 있게 정리', purpose: '고객의 문제 인식을 명확히 해 해결 필요성을 부각', supporting: ['핵심 고객 문제 3가지'], assets: [], cta: false, mobile: '문제 목록을 세로 카드로' },
    services: { keyMessage: '제공하는 핵심 서비스와 혜택 요약', purpose: '무엇을 도와줄 수 있는지 즉시 이해시킴', supporting: ['서비스 3~6개', '각 서비스 한 줄 설명'], assets: ['서비스 아이콘 또는 사진'], cta: false, mobile: '서비스 카드 1열' },
    differentiation: { keyMessage: '경쟁 대비 차별점을 근거와 함께 제시', purpose: '선택 이유를 제공', supporting: ['차별점 2~3가지'], assets: [], cta: false, mobile: '차별점 세로 나열' },
    process: { keyMessage: '문의부터 완료까지의 진행 절차', purpose: '진행 방식의 불확실성을 해소', supporting: ['3~5단계 절차'], assets: ['단계 아이콘'], cta: false, mobile: '절차 세로 타임라인' },
    trust: { keyMessage: '신뢰를 주는 근거(자격·경력·인증)', purpose: '전문성·신뢰도 확보', supporting: ['자격·경력·인증 목록'], assets: ['인증서 이미지'], cta: false, mobile: '신뢰 배지 나열' },
    numbers: { keyMessage: '성과를 보여주는 핵심 수치', purpose: '객관적 신뢰 강화', supporting: ['핵심 수치 3개'], assets: [], cta: false, mobile: '수치 카드 2열' },
    cases: { keyMessage: '대표 고객 사례', purpose: '실제 성과로 신뢰 제공', supporting: ['사례 2~3건'], assets: ['사례 이미지'], cta: false, mobile: '사례 카드 1열' },
    testimonials: { keyMessage: '고객 후기', purpose: '제3자 신뢰 제공', supporting: ['후기 2~3개'], assets: [], cta: false, mobile: '후기 카드 1열' },
    team: { keyMessage: '대표·구성원 소개', purpose: '사람 중심 신뢰 전달', supporting: ['구성원 프로필'], assets: ['구성원 사진'], cta: false, mobile: '프로필 1열' },
    faq: { keyMessage: '자주 묻는 질문과 답변', purpose: '반복 질문 해소·문의 부담 감소', supporting: ['FAQ 5~8개'], assets: [], cta: false, mobile: '아코디언 형태' },
    benefits: { keyMessage: '고객이 얻는 이점', purpose: '가치 제안 강화', supporting: ['혜택 3가지'], assets: [], cta: false, mobile: '혜택 세로 나열' },
    pricing: { keyMessage: '비용·범위 안내', purpose: '가격 투명성 제공', supporting: ['요금 구성'], assets: [], cta: false, mobile: '요금표 세로 카드' },
    content: { keyMessage: '핵심 소개 본문', purpose: '상세 정보 제공', supporting: ['소개 본문'], assets: [], cta: false, mobile: '본문 한 열' },
    contact: { keyMessage: '문의 폼과 연락처', purpose: '전환 완결', supporting: ['문의 폼', '전화·이메일', '운영시간'], assets: [], cta: true, mobile: '폼 1열, 큰 입력 영역' },
    map: { keyMessage: '오시는 길', purpose: '방문 편의 제공', supporting: ['지도', '주소', '교통 안내'], assets: ['지도 이미지 또는 임베드'], cta: false, mobile: '지도 후 주소' },
    conversion: { keyMessage: '마지막 전환 유도 문구', purpose: '페이지 하단에서 행동을 다시 유도', supporting: ['전환 문구', 'CTA 버튼'], assets: [], cta: true, mobile: 'CTA 버튼 전체 폭' },
    footer: { keyMessage: '기본 정보와 법적 링크', purpose: '연락처·개인정보처리방침·저작권 제공', supporting: ['연락처', '개인정보처리방침 링크', '사업자 정보'], assets: [], cta: false, mobile: '세로 정렬' },
    gallery: { keyMessage: '이미지 갤러리', purpose: '시각적 정보 제공', supporting: ['이미지 모음'], assets: ['갤러리 이미지'], cta: false, mobile: '2열 그리드' },
    video: { keyMessage: '소개 영상', purpose: '핵심 메시지 영상 전달', supporting: ['소개 영상'], assets: ['영상'], cta: false, mobile: '16:9 반응형' },
    comparison: { keyMessage: '비교 표', purpose: '선택 근거 제공', supporting: ['비교 항목'], assets: [], cta: false, mobile: '가로 스크롤 대신 카드 전환' },
    solution: { keyMessage: '문제에 대한 해결 방법', purpose: '해결책 제시', supporting: ['해결 방법 설명'], assets: [], cta: false, mobile: '한 열' },
    custom: { keyMessage: '', purpose: '', supporting: [], assets: [], cta: false, mobile: '한 열 배치' },
  }
  const d = map[t] ?? { keyMessage: '', purpose: SECTION_TYPE_META[t].label, supporting: [], assets: [], cta: false, mobile: '한 열 배치' }
  return { keyMessage: d.keyMessage, purpose: d.purpose, supporting: d.supporting, assets: d.assets, cta: d.cta ? ctaId : null, mobile: d.mobile }
}

/** 콘텐츠 의존 섹션은 콘텐츠가 없으면 missing으로 표시 (없는 콘텐츠를 있는 척 하지 않음) */
function sectionContentStatus(bp: SectionBlueprint): WebsiteSection['contentStatus'] {
  if (bp.sectionType === 'footer' || bp.sectionType === 'map') return 'partial'
  if (bp.contentDependent) return 'missing'
  return 'partial'
}

function buildDesignDirection(industry: string, subIndustry: string): DesignDirection {
  const text = `${industry} ${subIndustry}`
  const professional = /세무|회계|법무|노무|의료|병원|컨설팅|전문서비스|금융/.test(text)
  const personalities: BrandPersonality[] = professional
    ? ['professional', 'trustworthy', 'calm', 'minimal']
    : ['professional', 'modern', 'trustworthy', 'friendly']
  return {
    personalities,
    moodDescription: professional
      ? '차분하고 신뢰감 있는 전문가 분위기. 절제된 색과 넉넉한 여백으로 안정감을 준다.'
      : '현대적이고 신뢰감 있는 분위기. 명확한 위계와 적절한 여백을 유지한다.',
    primaryColorDirection: professional ? '딥 네이비 중심(신뢰·전문성)' : '차분한 블루 중심',
    secondaryColorDirection: '화이트·라이트 그레이 배경',
    accentColorDirection: professional ? '골드 또는 딥 블루 포인트를 제한적으로 사용' : '채도 낮은 포인트 컬러 제한 사용',
    backgroundDirection: '밝은 배경 기본, 섹션 구분은 라이트 그레이 톤',
    typographyDirection: '가독성 높은 산세리프, 제목/본문 위계를 명확히',
    headingStyle: '굵고 명확한 제목, 과도한 장식 없음',
    bodyStyle: '본문 최소 16px, 줄간격 넉넉히',
    spacingDensity: 'balanced',
    cornerStyle: 'subtle',
    shadowStyle: '아주 옅은 그림자로 카드 구분(과한 그림자 금지)',
    imageStyle: '실제 사무실·구성원·서비스 사진 우선, 과한 보정 지양',
    iconStyle: '단순한 라인 아이콘',
    motionStyle: 'subtle',
    layoutPrinciples: ['명확한 위계', '넉넉한 여백', '섹션별 하나의 메시지', '스캔 가능한 구조'],
    mobilePrinciples: ['한 열 배치', '큰 터치 영역', '고정 CTA 버튼 고려', '긴 표 대신 카드 전환'],
    accessibilityPrinciples: ['충분한 명도 대비', '본문 14px 이상', '이미지 대체 텍스트', '키보드 접근'],
    prohibitedStyles: [...DEFAULT_PROHIBITED_STYLES],
    referenceNotes: '근거 없는 브랜드 색상은 확정하지 않는다. 실제 로고·브랜드 컬러가 확인되면 반영한다.',
  }
}

/** 확정 핵심 과제(readiness) 기반으로 홈페이지 설계 초안을 결정적으로 생성한다. */
export function generateWebsiteDesign(
  project: Project,
  organization: Organization | null,
  readiness: WebsiteReadinessResult | null,
  overrideType: WebsiteStrategy['websiteType'] | null,
  overrideReason: string,
): GeneratedWebsiteDesign {
  const orgName = organization?.name ?? '고객사'
  const industry = organization?.industry ?? ''
  const subIndustry = organization?.subIndustry ?? ''
  const inferred = inferWebsiteType(project.objective, industry, subIndustry)
  const websiteType = overrideType ?? inferred.type

  /* 전환 행동 */
  const primaryCta: WebsiteConversionAction = {
    id: 'cta-0',
    type: websiteType === 'lead_generation' ? 'consultation_request' : 'inquiry',
    label: websiteType === 'lead_generation' ? '상담 요청' : '문의하기',
    description: '방문자가 상담·문의를 남기는 핵심 전환 행동',
    priority: 'primary',
    targetPageId: null,
    buttonText: websiteType === 'lead_generation' ? '상담 요청하기' : '문의하기',
    destination: '문의 페이지 폼',
    trackingRequired: true,
  }
  const secondaryCta: WebsiteConversionAction = {
    id: 'cta-1',
    type: 'phone_call',
    label: '전화 문의',
    description: '즉시 상담을 원하는 방문자를 위한 전화 연결',
    priority: 'secondary',
    targetPageId: null,
    buttonText: '전화 상담',
    destination: `tel:${organization?.primaryContact.phone ?? ''}`,
    trackingRequired: false,
  }

  /* 핵심 고객 */
  const audience: WebsiteAudience = {
    id: 'aud-0',
    name: readiness ? '홈페이지 방문 잠재 고객' : `${orgName} 잠재 고객`,
    description: project.objective,
    problems: readiness?.missingContent.slice(0, 0) ?? [],
    desiredOutcomes: ['신뢰할 수 있는 전문가를 찾는다', '문의·상담을 쉽게 남긴다'],
    objections: ['믿을 수 있는 곳인지 확신이 없다', '비용·절차가 불투명하다'],
    trustNeeds: ['전문 자격·경력', '실제 사례·후기', '명확한 절차'],
    priority: 'primary',
    sourceEvidenceIds: [],
  }

  const strategy: WebsiteStrategy = {
    purpose: project.objective,
    businessGoal: `${orgName}의 문의·상담 전환을 높인다.`,
    websiteType,
    websiteTypeReason: inferred.reason,
    websiteTypeOverrideReason: overrideType && overrideType !== inferred.type ? overrideReason : '',
    primaryAudienceId: audience.id,
    audiences: [audience],
    primaryConversionActionId: primaryCta.id,
    conversionActions: [primaryCta, secondaryCta],
    keyMessage: `${orgName} — 믿고 맡길 수 있는 전문 서비스`,
    differentiation: '전문성과 실제 사례, 명확한 절차로 신뢰를 제공합니다.',
    trustStrategy: '자격·경력·인증·사례를 초반에 노출해 신뢰를 확보합니다.',
    toneOfVoice: '전문적이되 이해하기 쉬운, 신뢰감 있는 어조',
    successMetrics: ['문의·상담 신청 수', '전화 연결 수', '주요 페이지 도달률'],
    assumptions: readiness ? [] : ['홈페이지 준비도 분석이 아직 확정되지 않아 기본 가정으로 초안을 생성했습니다.'],
    openQuestions: ['대표 서비스 우선순위 확정 필요', '실제 사례·후기 확보 가능 여부'],
  }

  /* 페이지·섹션 */
  const usedSlugs = new Set<string>()
  const blueprint = SITEMAP_BLUEPRINTS[websiteType]()
  const pages: WebsitePage[] = blueprint.map((pb, pi) => {
    const pageId = `pg-${pi}`
    const slug = slugify(pb.slug, usedSlugs)
    const sections: WebsiteSection[] = pb.sections.map((sb, si) => {
      const sc = sectionContent(sb, orgName, sb.sectionType === 'hero' || sb.sectionType === 'conversion' || sb.sectionType === 'contact' ? primaryCta.id : null)
      return {
        id: `sec-${pi}-${si}`,
        pageId,
        sectionType: sb.sectionType,
        title: SECTION_TYPE_META[sb.sectionType].label,
        purpose: sc.purpose,
        keyMessage: sc.keyMessage,
        supportingContent: sc.supporting,
        contentItems: [],
        visualDirection: '',
        ctaActionId: sc.cta,
        requiredAssets: sc.assets,
        contentStatus: sectionContentStatus(sb),
        mobileBehavior: sc.mobile,
        scope: sb.scope,
        notes: '',
        orderIndex: si,
        autoGenerated: true,
      }
    })
    return {
      id: pageId,
      designId: '',
      name: pb.name,
      slug,
      pageType: pb.pageType,
      purpose: pb.purpose,
      targetAudienceIds: [audience.id],
      primaryMessage: '',
      primaryConversionActionId: pb.pageType === 'contact' || pb.pageType === 'home' ? primaryCta.id : null,
      sections,
      seo: buildSeo(pb.name, orgName, pb.pageType),
      navigation: pb.pageType !== 'privacy' && pb.pageType !== 'terms',
      status: pb.status,
      orderIndex: pi,
      autoGenerated: true,
      createdAt: ISO,
      updatedAt: ISO,
      archivedAt: null,
    }
  })
  // home CTA targetPage 연결
  const homePage = pages.find((p) => p.pageType === 'home')
  const contactPage = pages.find((p) => p.pageType === 'contact')
  if (contactPage) {
    strategy.conversionActions[0].targetPageId = contactPage.id
  }
  if (homePage) audience.sourceEvidenceIds = []

  const contentItems = buildContentItems(pages, readiness)
  const assetRequirements = buildAssets(pages, readiness)
  const designDirection = buildDesignDirection(industry, subIndustry)
  const technicalScope = buildTechnicalScope()
  const forms = buildForms(contactPage?.id ?? null)
  const integrations = buildIntegrations()

  return { strategy, pages, contentItems, assetRequirements, designDirection, technicalScope, forms, integrations }
}

function buildSeo(pageName: string, orgName: string, pageType: WebsitePage['pageType']): WebsitePageSeo {
  return {
    titleDirection: `${pageName} | ${orgName}`,
    descriptionDirection: `${orgName}의 ${pageName} 안내. 핵심 메시지와 문의 경로를 포함.`,
    primaryTopic: pageName,
    supportingTopics: [orgName, pageName],
    headingStructure: [`H1: ${pageName}`, 'H2: 핵심 섹션 제목'],
    internalLinks: ['홈', '문의'],
    schemaTypeSuggestions: pageType === 'home' ? ['Organization', 'LocalBusiness'] : pageType === 'faq' ? ['FAQPage'] : [],
    indexable: pageType !== 'privacy' && pageType !== 'terms',
    notes: '실제 검색량·순위는 계산하지 않으며 방향만 제시합니다.',
  }
}

function buildContentItems(pages: WebsitePage[], readiness: WebsiteReadinessResult | null): WebsiteContentItem[] {
  const items: WebsiteContentItem[] = []
  const missingSet = new Set((readiness?.missingContent ?? []).map((s) => s.trim()))
  const add = (
    type: WebsiteContentItem['type'],
    title: string,
    required: boolean,
    relatedPageIds: string[],
  ) => {
    items.push({
      id: `content-${items.length}`,
      type,
      title,
      description: '',
      // 확보되지 않은 필수 콘텐츠는 부족으로 정직하게 표시한다 (있는 척하지 않음)
      status: required ? 'missing' : missingSet.size > 0 ? 'missing' : 'needs_review',
      source: 'unknown',
      owner: '',
      dueDate: '',
      relatedPageIds,
      relatedSectionIds: [],
      required,
      notes: '',
    })
  }
  const byType = (t: WebsitePage['pageType']) => pages.filter((p) => p.pageType === t).map((p) => p.id)
  add('company_introduction', '회사·사무소 소개 문구', true, byType('about').concat(byType('home')))
  add('service_description', '서비스별 설명 문구', true, byType('service').concat(byType('home')))
  add('paragraph', '진행절차 단계별 설명', true, byType('process'))
  add('faq', 'FAQ 질문·답변', false, byType('faq'))
  add('contact_info', '연락처·운영시간·주소', true, byType('contact'))
  add('legal', '개인정보처리방침 문구', true, byType('privacy'))
  add('case_study', '고객 사례', false, [])
  add('testimonial', '고객 후기', false, [])
  add('number', '핵심 수치·실적', false, [])
  return items
}

function buildAssets(pages: WebsitePage[], readiness: WebsiteReadinessResult | null): WebsiteAssetRequirement[] {
  const items: WebsiteAssetRequirement[] = []
  const missing = new Set((readiness?.missingAssets ?? []).map((s) => s.trim()))
  const add = (type: WebsiteAssetRequirement['type'], title: string, required: boolean, quantity: number, ratio: string) => {
    items.push({
      id: `asset-${items.length}`,
      type,
      title,
      description: '',
      status: required ? 'missing' : missing.size > 0 ? 'missing' : 'replacement_possible',
      required,
      quantity,
      preferredRatio: ratio,
      preferredResolution: '',
      source: '',
      relatedPageIds: [],
      relatedSectionIds: [],
      notes: '',
    })
  }
  add('logo', '로고(고해상도)', true, 1, '가로형 우선')
  add('company_photo', '사무실·회사 사진', true, 3, '16:9')
  add('team_photo', '대표·구성원 사진', false, 2, '3:4')
  add('service_photo', '서비스 관련 사진', false, 3, '16:9')
  add('certificate', '자격·인증서 이미지', false, 2, '자유')
  if (pages.some((p) => p.pageType === 'case_studies')) add('case_image', '사례 이미지', false, 3, '16:9')
  return items
}

function buildTechnicalScope(): WebsiteTechnicalScope {
  return {
    frameworkPreference: 'react_vite',
    responsive: true,
    mobileFirst: true,
    cmsRequired: false,
    adminRequired: false,
    forms: true,
    integrations: true,
    analytics: true,
    seoBasics: true,
    accessibilityLevel: 'WCAG AA 지향(명도 대비·대체 텍스트·키보드)',
    performanceGoal: '모바일 로딩 3초 이내, 이미지 최적화',
    hostingPreference: '정적 호스팅(Vercel 등)',
    excludedTechnicalScope: [...DEFAULT_EXCLUDED_SCOPE],
    notes: '실제 배포·도메인 연결은 이번 설계 범위에 포함하지 않습니다.',
  }
}

function buildForms(contactPageId: string | null): WebsiteFormRequirement[] {
  return [
    {
      id: 'form-0',
      name: '상담·문의 폼',
      purpose: '방문자의 상담·문의 접수',
      fields: ['이름', '연락처', '문의 유형', '문의 내용', '개인정보 수집·이용 동의'],
      required: true,
      destination: '담당자 이메일 또는 폼 백엔드',
      confirmationBehavior: '접수 완료 안내 메시지 표시 및 확인 연락 안내',
      privacyConsentRequired: true,
      spamProtectionRequired: true,
      relatedPageIds: contactPageId ? [contactPageId] : [],
    },
  ]
}

function buildIntegrations(): WebsiteIntegrationRequirement[] {
  const add = (
    i: number,
    type: WebsiteIntegrationRequirement['type'],
    name: string,
    purpose: string,
    requiredForLaunch: boolean,
    fallback: string,
  ): WebsiteIntegrationRequirement => ({
    id: `intg-${i}`,
    type,
    name,
    purpose,
    requiredForLaunch,
    setupOwner: '',
    dependency: '',
    fallback,
    notes: '',
  })
  return [
    add(0, 'analytics', '방문 분석', '방문·전환 측정', false, '초기에는 폼 접수 수로 대체 측정'),
    add(1, 'map', '지도', '오시는 길 안내', false, '주소·약도 이미지로 대체'),
    add(2, 'phone', '전화 연결', '즉시 상담 연결', true, '전화번호 텍스트 노출'),
  ]
}
