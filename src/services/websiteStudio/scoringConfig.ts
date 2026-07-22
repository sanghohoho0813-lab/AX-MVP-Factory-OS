/** 홈페이지 설계 규칙 버전 — 결정적 산출물의 버전 표식 */
export const WEBSITE_DESIGN_RULE_VERSION = '1.0.0'

/** 홈페이지 범위 가드레일 상한값 */
export const WEBSITE_GUARDRAIL_LIMITS = {
  max_pages: 8,
  max_service_detail: 3,
  max_primary_cta: 2,
  max_forms: 2,
  max_integrations: 3,
} as const

export type GuardrailKey =
  | 'max_pages'
  | 'max_service_detail'
  | 'max_primary_cta'
  | 'max_forms'
  | 'max_integrations'
  | 'no_admin'
  | 'no_membership'
  | 'no_payment'
  | 'no_multilang'
  | 'no_complex_booking'
  | 'mobile_web'

export const GUARDRAIL_LABEL: Record<GuardrailKey, string> = {
  max_pages: '총 페이지 최대 8개',
  max_service_detail: '핵심 서비스 상세 최대 3개',
  max_primary_cta: '핵심 CTA 최대 2개',
  max_forms: '문의 폼 최대 2개',
  max_integrations: '외부 연동 최대 3개',
  no_admin: '관리자 기능 기본 제외',
  no_membership: '회원가입 기본 제외',
  no_payment: '결제 기본 제외',
  no_multilang: '다국어 기본 제외',
  no_complex_booking: '복잡한 예약 시스템 기본 제외',
  mobile_web: '모바일 웹 필수',
}

/** 초과 시 확정을 막는 수치형 가드레일 */
export const BLOCKING_GUARDRAILS: GuardrailKey[] = [
  'max_pages',
  'max_primary_cta',
  'max_forms',
  'max_integrations',
]

/** 1차 홈페이지 기본 제외 범위 */
export const DEFAULT_EXCLUDED_SCOPE: string[] = [
  '관리자 페이지·백오피스',
  '회원가입·로그인',
  '온라인 결제·정산',
  '다국어(영문 등) 지원',
  '복잡한 예약·좌석 시스템',
  '실시간 채팅 상담 서버',
]

/** 공통 금지 디자인 */
export const DEFAULT_PROHIBITED_STYLES: string[] = [
  '과도한 그라데이션',
  '카드 남발(모든 콘텐츠를 카드로)',
  '너무 작은 본문 글씨',
  '의미 없는 3D 오브젝트',
  '모든 섹션 중앙정렬',
  '과도하게 둥근 모서리',
  '애니메이션 과다',
  '모바일에서 좌우로 넘치는 긴 표',
  '낮은 명도 대비',
  '템플릿 티가 강한 뻔한 구성',
]
