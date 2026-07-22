import {
  AlertTriangle,
  Ban,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Contact,
  FileText,
  FlaskConical,
  Image,
  Images,
  LayoutTemplate,
  type LucideIcon,
  MapPin,
  MessageSquare,
  MinusCircle,
  Newspaper,
  Phone,
  Quote,
  Rocket,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Target,
  Users,
} from 'lucide-react'
import type { StatusTone } from '../types'
import type {
  AssetStatus,
  BrandPersonality,
  ContentItemStatus,
  ConversionActionType,
  ConversionPriority,
  GuardrailStatus,
  QualitySeverity,
  SectionContentStatus,
  SectionScope,
  WebsiteAssetType,
  WebsiteContentItemType,
  WebsiteDesignStatus,
  WebsiteIntegrationType,
  WebsitePageStatus,
  WebsitePageType,
  WebsitePromptType,
  WebsiteSectionType,
  WebsiteType,
} from '../types/websiteDesign'

interface Meta {
  label: string
  description: string
  tone: StatusTone
  icon: LucideIcon
  order: number
}
type MetaMap<K extends string> = Record<K, Meta>
function keysByOrder<K extends string>(map: MetaMap<K>): K[] {
  return (Object.keys(map) as K[]).sort((a, b) => map[a].order - map[b].order)
}
interface SimpleMeta {
  label: string
  tone: StatusTone
  order: number
}

/* 설계 상태 */
export const WEBSITE_DESIGN_STATUS_META: MetaMap<WebsiteDesignStatus> = {
  draft: { label: '설계 초안', description: '자동 설계를 반영한 초안입니다.', tone: 'warning', icon: FlaskConical, order: 0 },
  reviewed: { label: '내부 검토', description: '담당자 검토를 마쳤습니다.', tone: 'info', icon: ClipboardCheck, order: 1 },
  finalized: { label: '설계 확정', description: '홈페이지 설계가 확정되었습니다.', tone: 'success', icon: CheckCircle2, order: 2 },
  superseded: { label: '이전 버전', description: '새 버전으로 대체된 이전 설계입니다.', tone: 'neutral', icon: MinusCircle, order: 3 },
}
export const WEBSITE_DESIGN_STATUSES = keysByOrder(WEBSITE_DESIGN_STATUS_META)

/* 홈페이지 유형 */
export const WEBSITE_TYPE_META: MetaMap<WebsiteType> = {
  lead_generation: { label: '상담·DB 수집형', description: '문의·상담 신청 전환에 집중하는 홈페이지입니다.', tone: 'success', icon: Send, order: 0 },
  corporate: { label: '회사소개형', description: '회사 신뢰도·연혁·사업영역을 소개합니다.', tone: 'info', icon: Building2, order: 1 },
  service: { label: '서비스소개형', description: '서비스별 상세와 혜택·절차를 설명합니다.', tone: 'info', icon: LayoutTemplate, order: 2 },
  landing_page: { label: '단일 랜딩페이지', description: '단일 상품·캠페인·단일 CTA에 집중합니다.', tone: 'accent', icon: Rocket, order: 3 },
  portfolio: { label: '포트폴리오형', description: '사례·이미지 중심으로 구성합니다.', tone: 'accent', icon: Images, order: 4 },
  recruitment: { label: '채용형', description: '인재 채용·조직 문화를 전달합니다.', tone: 'info', icon: Users, order: 5 },
  ecommerce_catalog: { label: '상품 카탈로그형', description: '상품을 소개하고 외부 구매로 연결합니다.', tone: 'warning', icon: Store, order: 6 },
  mixed: { label: '혼합형', description: '여러 목적을 함께 담는 구성입니다.', tone: 'neutral', icon: LayoutTemplate, order: 7 },
}
export const WEBSITE_TYPES = keysByOrder(WEBSITE_TYPE_META)

/* 전환 행동 유형 */
export const CONVERSION_ACTION_META: Record<ConversionActionType, { label: string; icon: LucideIcon }> = {
  inquiry: { label: '문의하기', icon: MessageSquare },
  diagnosis_request: { label: '진단 신청', icon: ClipboardCheck },
  consultation_request: { label: '상담 요청', icon: Contact },
  phone_call: { label: '전화 걸기', icon: Phone },
  message: { label: '메시지 보내기', icon: MessageSquare },
  booking: { label: '예약하기', icon: CalendarClock },
  quote_request: { label: '견적 요청', icon: FileText },
  download: { label: '자료 받기', icon: FileText },
  purchase_external: { label: '외부 구매', icon: Store },
  visit: { label: '방문·오시는 길', icon: MapPin },
  other: { label: '기타 행동', icon: Target },
}
export const CONVERSION_ACTION_TYPES = Object.keys(CONVERSION_ACTION_META) as ConversionActionType[]

export const CONVERSION_PRIORITY_META: Record<ConversionPriority, SimpleMeta> = {
  primary: { label: '핵심', tone: 'success', order: 0 },
  secondary: { label: '보조', tone: 'info', order: 1 },
  optional: { label: '선택', tone: 'neutral', order: 2 },
}

/* 페이지 유형 */
export const PAGE_TYPE_META: Record<WebsitePageType, { label: string; icon: LucideIcon }> = {
  home: { label: '홈', icon: Star },
  about: { label: '회사·사무소 소개', icon: Building2 },
  service: { label: '주요 업무·서비스', icon: LayoutTemplate },
  service_detail: { label: '업무·서비스 상세', icon: FileText },
  case_studies: { label: '사례', icon: Images },
  case_detail: { label: '사례 상세', icon: Image },
  process: { label: '진행절차', icon: Route },
  pricing: { label: '가격·비용 안내', icon: FileText },
  faq: { label: '자주 묻는 질문', icon: MessageSquare },
  resources: { label: '자료실', icon: Newspaper },
  contact: { label: '문의·오시는 길', icon: Contact },
  diagnosis: { label: '진단·상담 신청', icon: ClipboardCheck },
  landing: { label: '랜딩페이지', icon: Rocket },
  recruitment: { label: '채용', icon: Users },
  privacy: { label: '개인정보처리방침', icon: ShieldCheck },
  terms: { label: '이용약관', icon: FileText },
  custom: { label: '직접 추가', icon: LayoutTemplate },
}
export const PAGE_TYPES = Object.keys(PAGE_TYPE_META) as WebsitePageType[]

/* 페이지 상태 */
export const PAGE_STATUS_META: MetaMap<WebsitePageStatus> = {
  required: { label: '필수', description: '1차 홈페이지에 반드시 포함합니다.', tone: 'success', icon: BadgeCheck, order: 0 },
  recommended: { label: '권장', description: '여유가 되면 포함합니다.', tone: 'info', icon: Star, order: 1 },
  later: { label: '나중에', description: '이후 확장에서 검토합니다.', tone: 'warning', icon: MinusCircle, order: 2 },
  excluded: { label: '제외', description: '이번 범위에서 제외합니다.', tone: 'danger', icon: Ban, order: 3 },
}
export const PAGE_STATUSES = keysByOrder(PAGE_STATUS_META)

/* 섹션 유형 */
export const SECTION_TYPE_META: Record<WebsiteSectionType, { label: string }> = {
  hero: { label: '히어로(첫 화면)' },
  problem: { label: '고객 문제' },
  solution: { label: '해결 방법' },
  services: { label: '핵심 서비스' },
  benefits: { label: '혜택' },
  differentiation: { label: '차별점' },
  process: { label: '진행절차' },
  numbers: { label: '숫자·실적' },
  trust: { label: '신뢰요소' },
  cases: { label: '사례' },
  testimonials: { label: '고객 후기' },
  team: { label: '팀·구성원' },
  faq: { label: '자주 묻는 질문' },
  pricing: { label: '가격' },
  comparison: { label: '비교' },
  content: { label: '본문 콘텐츠' },
  gallery: { label: '갤러리' },
  video: { label: '영상' },
  map: { label: '지도' },
  contact: { label: '문의' },
  conversion: { label: '전환(CTA)' },
  footer: { label: '푸터' },
  custom: { label: '직접 추가' },
}
export const SECTION_TYPES = Object.keys(SECTION_TYPE_META) as WebsiteSectionType[]

/* 섹션/콘텐츠 준비 상태 */
export const SECTION_CONTENT_STATUS_META: Record<SectionContentStatus, SimpleMeta> = {
  ready: { label: '준비 완료', tone: 'success', order: 0 },
  partial: { label: '일부 있음', tone: 'warning', order: 1 },
  missing: { label: '부족', tone: 'danger', order: 2 },
  not_required: { label: '불필요', tone: 'neutral', order: 3 },
}

export const SECTION_SCOPE_META: MetaMap<SectionScope> = PAGE_STATUS_META as unknown as MetaMap<SectionScope>

/* 콘텐츠 항목 유형 */
export const CONTENT_ITEM_TYPE_META: Record<WebsiteContentItemType, { label: string }> = {
  headline: { label: '헤드라인' },
  paragraph: { label: '본문 문단' },
  bullet: { label: '요점 목록' },
  service_description: { label: '서비스 설명' },
  company_introduction: { label: '회사·사무소 소개' },
  number: { label: '수치·실적' },
  case_study: { label: '고객 사례' },
  testimonial: { label: '고객 후기' },
  faq: { label: '자주 묻는 질문' },
  pricing: { label: '가격 정보' },
  team_profile: { label: '구성원 소개' },
  contact_info: { label: '연락처' },
  legal: { label: '법적 고지' },
  other: { label: '기타' },
}

export const CONTENT_ITEM_STATUS_META: Record<ContentItemStatus, SimpleMeta> = {
  ready: { label: '준비 완료', tone: 'success', order: 0 },
  draft: { label: '초안 있음', tone: 'info', order: 1 },
  missing: { label: '부족', tone: 'danger', order: 2 },
  needs_review: { label: '검토 필요', tone: 'warning', order: 3 },
}

/* 자산 유형 */
export const ASSET_TYPE_META: Record<WebsiteAssetType, { label: string; icon: LucideIcon }> = {
  logo: { label: '로고', icon: Sparkles },
  brand_guide: { label: '브랜드 가이드', icon: FileText },
  company_photo: { label: '회사·사무소 사진', icon: Image },
  team_photo: { label: '구성원 사진', icon: Users },
  service_photo: { label: '서비스 사진', icon: Image },
  product_photo: { label: '상품 사진', icon: Image },
  case_image: { label: '사례 이미지', icon: Images },
  icon: { label: '아이콘', icon: Star },
  video: { label: '영상', icon: Image },
  illustration: { label: '일러스트', icon: Image },
  certificate: { label: '인증서', icon: BadgeCheck },
  map: { label: '지도', icon: MapPin },
  other: { label: '기타', icon: Image },
}

export const ASSET_STATUS_META: Record<AssetStatus, SimpleMeta> = {
  ready: { label: '준비 완료', tone: 'success', order: 0 },
  partial: { label: '일부 있음', tone: 'warning', order: 1 },
  missing: { label: '부족', tone: 'danger', order: 2 },
  replacement_possible: { label: '대체 가능', tone: 'info', order: 3 },
}

/* 브랜드 성격 */
export const BRAND_PERSONALITY_META: Record<BrandPersonality, { label: string }> = {
  professional: { label: '전문적인' },
  trustworthy: { label: '신뢰가는' },
  modern: { label: '현대적인' },
  premium: { label: '고급스러운' },
  friendly: { label: '친근한' },
  energetic: { label: '활기찬' },
  calm: { label: '차분한' },
  technical: { label: '기술적인' },
  minimal: { label: '미니멀한' },
  bold: { label: '강렬한' },
  warm: { label: '따뜻한' },
  traditional: { label: '전통적인' },
}
export const BRAND_PERSONALITIES = Object.keys(BRAND_PERSONALITY_META) as BrandPersonality[]

/* 외부 연동 유형 */
export const INTEGRATION_TYPE_META: Record<WebsiteIntegrationType, { label: string }> = {
  analytics: { label: '방문 분석(GA 등)' },
  search_console: { label: '검색 등록(서치 콘솔)' },
  map: { label: '지도' },
  phone: { label: '전화 연결' },
  email: { label: '이메일' },
  messaging: { label: '메시지·채널톡' },
  booking: { label: '예약' },
  crm: { label: '고객관리(CRM)' },
  payment_external: { label: '외부 결제' },
  social: { label: '소셜 채널' },
  video: { label: '영상 임베드' },
  form_backend: { label: '폼 수신 백엔드' },
  other: { label: '기타' },
}
export const INTEGRATION_TYPES = Object.keys(INTEGRATION_TYPE_META) as WebsiteIntegrationType[]

/* 가드레일/품질/프롬프트 */
export const GUARDRAIL_STATUS_META: Record<GuardrailStatus, SimpleMeta> = {
  pass: { label: '적정', tone: 'success', order: 0 },
  warning: { label: '주의', tone: 'warning', order: 1 },
  exceeded: { label: '초과', tone: 'danger', order: 2 },
}

export const QUALITY_SEVERITY_META: Record<QualitySeverity, { label: string; tone: StatusTone; icon: LucideIcon }> = {
  error: { label: '오류', tone: 'danger', icon: Ban },
  warning: { label: '경고', tone: 'warning', icon: AlertTriangle },
  info: { label: '안내', tone: 'info', icon: ClipboardList },
}

export const PROMPT_TYPE_META: Record<WebsitePromptType, { label: string; description: string; icon: LucideIcon }> = {
  claude_code: { label: 'Claude Code 개발 지시문', description: '전체 홈페이지 개발 지시문(구조·디자인·기술·완료 기준 포함).', icon: Rocket },
  generic_builder: { label: '범용 제작도구 프롬프트', description: '기술 세부를 줄이고 구조·디자인·콘텐츠 중심.', icon: LayoutTemplate },
  design_only: { label: '디자인 전용 프롬프트', description: '색상·레이아웃·타이포·분위기·금지 스타일 중심.', icon: Sparkles },
  content_only: { label: '콘텐츠 작성 프롬프트', description: '페이지별 카피·CTA·FAQ·신뢰 문구 작성 지시.', icon: Quote },
}
export const PROMPT_TYPES = Object.keys(PROMPT_TYPE_META) as WebsitePromptType[]
