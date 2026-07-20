import type { GuardrailKey } from '../../types/mvpDesign'

/** MVP 설계 규칙 버전 — 결정적 산출물의 버전 표식 */
export const MVP_DESIGN_RULE_VERSION = '1.0.0'

/**
 * 1차 MVP 범위 가드레일 상한값.
 * 초과 시 품질 점검에서 오류로 확정을 막는다.
 */
export const GUARDRAIL_LIMITS: Record<GuardrailKey, number | null> = {
  single_core_task: 1,
  max_roles: 3,
  max_screens: 8,
  max_forms: 3,
  max_ai_features: 2,
  max_reports: 1,
  max_external_api: 1,
  no_native_app: null,
  no_full_erp: null,
  no_payment: null,
  no_multi_tenant: null,
  no_expert_replacement: null,
}

export const GUARDRAIL_LABEL: Record<GuardrailKey, string> = {
  single_core_task: '핵심 업무 1개 집중',
  max_roles: '사용자 역할 최대 3개',
  max_screens: '화면 최대 8개',
  max_forms: '핵심 입력 폼 최대 3개',
  max_ai_features: 'AI 기능 최대 2개',
  max_reports: '보고서·대시보드 최대 1종',
  max_external_api: '외부 API 연동 최대 1개',
  no_native_app: '네이티브 앱 제외(모바일 웹)',
  no_full_erp: 'ERP 전체 연동 제외',
  no_payment: '결제 기능 제외',
  no_multi_tenant: '복수 고객사 SaaS화 제외',
  no_expert_replacement: '전문가 최종판단 대체 금지',
}

/** 확정을 막는 품질 오류가 되는 가드레일(수치 초과형) */
export const BLOCKING_GUARDRAILS: GuardrailKey[] = [
  'max_roles',
  'max_screens',
  'max_forms',
  'max_ai_features',
  'max_reports',
  'max_external_api',
]

/** MVP 수준이 이 값을 넘으면 1차 범위 경고 */
export const MVP_LEVEL_WARNING_THRESHOLD = 3

/** 기본 제외 범위(모든 설계 공통 안내) */
export const DEFAULT_OUT_OF_SCOPE: string[] = [
  '네이티브 모바일 앱',
  'ERP·기간계 전체 연동',
  '결제·정산 기능',
  '복수 고객사 대상 SaaS 전환',
  '자체 AI 모델 학습',
  '다국어 지원',
]
