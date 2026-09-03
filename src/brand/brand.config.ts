import type { UiThemeKey } from '../types/ui'

/**
 * 브랜드 설정 — 사용자에게 보이는 이름·로고·링크를 한곳에서 정한다.
 *
 * 이 파일 밖의 컴포넌트는 "미래AI랩" 같은 문자열을 직접 쓰지 않는다.
 * 나중에 같은 소스를 다른 컨설팅 SaaS로 옮길 때 이 파일(과 serviceCatalog·moduleRegistry)만
 * 바꾸면 되게 하려는 것이다. GitHub 저장소명·Vercel 프로젝트명 같은 기술 인프라 이름은
 * 여기서 다루지 않는다(그건 바꾸지 않는다).
 */
export interface BrandConfig {
  /** 영문 브랜드명 — 로고 옆·문서 제목 */
  brandName: string
  /** 한국어 브랜드명 */
  brandNameKo: string
  /** 이 앱(내부 OS)의 제품명 */
  productName: string
  /** 제품명 한국어 */
  productNameKo: string
  /** 제품 부제 — 로그인 화면·설정 시스템 정보 */
  productSubtitle: string
  /** 밝은 배경용 로고 경로 (투명 배경) */
  logoLight: string
  /** 어두운 배경용 로고 경로 (글자 흰색) */
  logoDark: string
  /** 로고 원본 크기 — 레이아웃 시프트 방지 */
  logoSize: { width: number; height: number }
  /** 로고 대체 텍스트 */
  logoAlt: string
  /** 운영 회사명 */
  companyName: string
  /** 고객 플랫폼(공개 사이트) 주소 */
  customerPlatformUrl: string
  /** 고객 플랫폼 표시명 */
  customerPlatformLabel: string
  /** 고객 로그인 영역 표시명 */
  customerPortalLabel: string
  /** 고객 플랫폼의 프로젝트 화면 경로 (미리보기 링크에 사용) */
  customerProjectsPath: string
  /** 문의 이메일 */
  supportEmail: string
  /** 기본 화면 테마 — 9종 Canonical Theme 중 하나 */
  defaultThemeId: UiThemeKey
}

export const brand: BrandConfig = {
  brandName: 'MIRAE AI LAB',
  brandNameKo: '미래AI랩',
  productName: 'MIRAE AI LAB OS',
  productNameKo: '미래AI랩 OS',
  productSubtitle: 'Consulting Operations & AX Studio',
  logoLight: '/brand/mirae-ai-lab-logo-transparent.png',
  logoDark: '/brand/mirae-ai-lab-logo-light.png',
  logoSize: { width: 828, height: 250 },
  logoAlt: '미래에이아이랩',
  companyName: '미래경영지원센터',
  customerPlatformUrl: 'https://miraeailab.com',
  customerPlatformLabel: '고객 플랫폼',
  customerPortalLabel: 'My MIRAE',
  customerProjectsPath: '/my-projects',
  supportEmail: 'sanghohoho0813@gmail.com',
  // 로고의 짙은 청록 M 과 공개 사이트의 웜 액센트에 가장 가까운 팔레트
  defaultThemeId: 'deep-teal',
}

/** 브라우저 탭 제목 — "화면 이름 | 제품명" 형식으로 통일한다 */
export function documentTitle(screen?: string): string {
  return screen ? `${screen} | ${brand.productName}` : brand.productName
}
