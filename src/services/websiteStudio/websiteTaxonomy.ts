import type {
  SectionScope,
  WebsitePageStatus,
  WebsitePageType,
  WebsiteSectionType,
  WebsiteType,
} from '../../types/websiteDesign'

/**
 * 규칙 기반 사이트 구조 청사진.
 * 홈페이지 유형마다 필요한 페이지·섹션을 보수적으로 정의한다.
 * 결정적: 동일 입력이면 항상 동일 청사진.
 */

export interface SectionBlueprint {
  sectionType: WebsiteSectionType
  scope: SectionScope
  /** 콘텐츠가 없으면 required로 올리지 않는 섹션(사례·후기·숫자 등) */
  contentDependent: boolean
}

export interface PageBlueprint {
  pageType: WebsitePageType
  name: string
  slug: string
  status: WebsitePageStatus
  purpose: string
  sections: SectionBlueprint[]
}

const HOME_SECTIONS: SectionBlueprint[] = [
  { sectionType: 'hero', scope: 'required', contentDependent: false },
  { sectionType: 'problem', scope: 'recommended', contentDependent: false },
  { sectionType: 'services', scope: 'required', contentDependent: false },
  { sectionType: 'differentiation', scope: 'recommended', contentDependent: false },
  { sectionType: 'process', scope: 'recommended', contentDependent: false },
  { sectionType: 'trust', scope: 'recommended', contentDependent: false },
  { sectionType: 'numbers', scope: 'later', contentDependent: true },
  { sectionType: 'cases', scope: 'later', contentDependent: true },
  { sectionType: 'faq', scope: 'later', contentDependent: false },
  { sectionType: 'conversion', scope: 'required', contentDependent: false },
  { sectionType: 'footer', scope: 'required', contentDependent: false },
]

const ABOUT_SECTIONS: SectionBlueprint[] = [
  { sectionType: 'hero', scope: 'required', contentDependent: false },
  { sectionType: 'content', scope: 'required', contentDependent: false },
  { sectionType: 'team', scope: 'recommended', contentDependent: true },
  { sectionType: 'trust', scope: 'recommended', contentDependent: false },
  { sectionType: 'conversion', scope: 'recommended', contentDependent: false },
  { sectionType: 'footer', scope: 'required', contentDependent: false },
]

const SERVICES_SECTIONS: SectionBlueprint[] = [
  { sectionType: 'hero', scope: 'required', contentDependent: false },
  { sectionType: 'services', scope: 'required', contentDependent: false },
  { sectionType: 'benefits', scope: 'recommended', contentDependent: false },
  { sectionType: 'process', scope: 'recommended', contentDependent: false },
  { sectionType: 'conversion', scope: 'required', contentDependent: false },
  { sectionType: 'footer', scope: 'required', contentDependent: false },
]

const PROCESS_SECTIONS: SectionBlueprint[] = [
  { sectionType: 'hero', scope: 'required', contentDependent: false },
  { sectionType: 'process', scope: 'required', contentDependent: false },
  { sectionType: 'faq', scope: 'recommended', contentDependent: false },
  { sectionType: 'conversion', scope: 'required', contentDependent: false },
  { sectionType: 'footer', scope: 'required', contentDependent: false },
]

const FAQ_SECTIONS: SectionBlueprint[] = [
  { sectionType: 'hero', scope: 'required', contentDependent: false },
  { sectionType: 'faq', scope: 'required', contentDependent: false },
  { sectionType: 'conversion', scope: 'recommended', contentDependent: false },
  { sectionType: 'footer', scope: 'required', contentDependent: false },
]

const CONTACT_SECTIONS: SectionBlueprint[] = [
  { sectionType: 'hero', scope: 'required', contentDependent: false },
  { sectionType: 'contact', scope: 'required', contentDependent: false },
  { sectionType: 'map', scope: 'recommended', contentDependent: false },
  { sectionType: 'footer', scope: 'required', contentDependent: false },
]

const PRIVACY_SECTIONS: SectionBlueprint[] = [
  { sectionType: 'content', scope: 'required', contentDependent: false },
  { sectionType: 'footer', scope: 'required', contentDependent: false },
]

const CASES_SECTIONS: SectionBlueprint[] = [
  { sectionType: 'hero', scope: 'required', contentDependent: false },
  { sectionType: 'cases', scope: 'required', contentDependent: true },
  { sectionType: 'conversion', scope: 'recommended', contentDependent: false },
  { sectionType: 'footer', scope: 'required', contentDependent: false },
]

const PRICING_SECTIONS: SectionBlueprint[] = [
  { sectionType: 'hero', scope: 'required', contentDependent: false },
  { sectionType: 'pricing', scope: 'required', contentDependent: true },
  { sectionType: 'faq', scope: 'recommended', contentDependent: false },
  { sectionType: 'conversion', scope: 'required', contentDependent: false },
  { sectionType: 'footer', scope: 'required', contentDependent: false },
]

const P = {
  home: (): PageBlueprint => ({ pageType: 'home', name: '홈', slug: '/', status: 'required', purpose: '핵심 메시지와 전환 행동으로 방문자를 안내합니다.', sections: HOME_SECTIONS }),
  about: (label = '회사 소개'): PageBlueprint => ({ pageType: 'about', name: label, slug: '/about', status: 'required', purpose: '신뢰도·전문성·연혁을 전달합니다.', sections: ABOUT_SECTIONS }),
  services: (label = '주요 서비스'): PageBlueprint => ({ pageType: 'service', name: label, slug: '/services', status: 'required', purpose: '제공 서비스와 혜택을 설명합니다.', sections: SERVICES_SECTIONS }),
  process: (): PageBlueprint => ({ pageType: 'process', name: '진행절차', slug: '/process', status: 'required', purpose: '문의부터 진행까지의 절차를 안내합니다.', sections: PROCESS_SECTIONS }),
  faq: (): PageBlueprint => ({ pageType: 'faq', name: '자주 묻는 질문', slug: '/faq', status: 'recommended', purpose: '반복 질문을 미리 해소해 문의 부담을 줄입니다.', sections: FAQ_SECTIONS }),
  contact: (label = '문의·오시는 길'): PageBlueprint => ({ pageType: 'contact', name: label, slug: '/contact', status: 'required', purpose: '문의 폼·연락처·위치로 전환을 완결합니다.', sections: CONTACT_SECTIONS }),
  privacy: (): PageBlueprint => ({ pageType: 'privacy', name: '개인정보처리방침', slug: '/privacy', status: 'required', purpose: '문의 폼 수집에 필요한 법적 고지를 제공합니다.', sections: PRIVACY_SECTIONS }),
  cases: (): PageBlueprint => ({ pageType: 'case_studies', name: '사례', slug: '/cases', status: 'recommended', purpose: '실제 사례로 신뢰를 강화합니다.', sections: CASES_SECTIONS }),
  pricing: (): PageBlueprint => ({ pageType: 'pricing', name: '비용 안내', slug: '/pricing', status: 'recommended', purpose: '비용·범위를 투명하게 안내합니다.', sections: PRICING_SECTIONS }),
  serviceDetail: (): PageBlueprint => ({ pageType: 'service_detail', name: '업무별 상세', slug: '/services/detail', status: 'recommended', purpose: '핵심 업무를 문제·해결 중심으로 상세 설명합니다.', sections: SERVICES_SECTIONS }),
}

/** 홈페이지 유형별 기본 사이트 구조 (보수적 · 8개 이하) */
export const SITEMAP_BLUEPRINTS: Record<WebsiteType, () => PageBlueprint[]> = {
  lead_generation: () => [P.home(), P.about('사무소 소개'), P.services('주요 업무'), P.serviceDetail(), P.process(), P.faq(), P.contact(), P.privacy()],
  corporate: () => [P.home(), P.about('회사 소개'), P.services('사업영역'), P.process(), P.contact(), P.privacy()],
  service: () => [P.home(), P.services('서비스'), P.serviceDetail(), P.process(), P.faq(), P.contact(), P.privacy()],
  landing_page: () => [P.home(), P.privacy()],
  portfolio: () => [P.home(), P.about('소개'), P.cases(), P.contact(), P.privacy()],
  recruitment: () => [P.home(), P.about('회사 소개'), P.services('직무 소개'), P.process(), P.contact(), P.privacy()],
  ecommerce_catalog: () => [P.home(), P.services('상품 소개'), P.pricing(), P.faq(), P.contact(), P.privacy()],
  mixed: () => [P.home(), P.about('회사 소개'), P.services('서비스'), P.process(), P.faq(), P.contact(), P.privacy()],
}

/**
 * 조직 업종·프로젝트 목표로 홈페이지 유형을 추론한다 (근거 기반·결정적).
 */
export function inferWebsiteType(objective: string, industry: string, subIndustry: string): {
  type: WebsiteType
  reason: string
} {
  const text = `${objective} ${industry} ${subIndustry}`
  const professional = /세무|회계|법무|노무|변리|의료|병원|한의원|컨설팅|상담|전문서비스/.test(text)
  const wantsInquiry = /상담|문의|전환|신청|접수|예약|견적/.test(objective)

  if (wantsInquiry && (professional || /서비스|용역/.test(text))) {
    return { type: 'lead_generation', reason: '상담·문의 전환이 핵심 목표이고 전문 서비스 업종이라 상담·DB 수집형이 적합합니다.' }
  }
  if (/포트폴리오|사례|작품|시공|디자인 사례/.test(objective)) {
    return { type: 'portfolio', reason: '사례·이미지 노출이 핵심이라 포트폴리오형이 적합합니다.' }
  }
  if (/채용|인재|입사/.test(objective)) {
    return { type: 'recruitment', reason: '인재 채용이 목적이라 채용형이 적합합니다.' }
  }
  if (/상품|제품 소개|카탈로그/.test(objective)) {
    return { type: 'ecommerce_catalog', reason: '상품 소개 중심이라 상품 카탈로그형이 적합합니다.' }
  }
  if (/서비스 소개|용역|서비스별/.test(objective)) {
    return { type: 'service', reason: '서비스별 상세 설명이 필요해 서비스소개형이 적합합니다.' }
  }
  if (/광고|캠페인|단일 상품|랜딩/.test(objective)) {
    return { type: 'landing_page', reason: '단일 캠페인·상품 전환 중심이라 단일 랜딩페이지가 적합합니다.' }
  }
  if (wantsInquiry) {
    return { type: 'lead_generation', reason: '문의·상담 전환이 목표라 상담·DB 수집형이 적합합니다.' }
  }
  return { type: 'corporate', reason: '회사 신뢰도·소개 중심이라 회사소개형을 기본으로 추천합니다.' }
}
