import type {
  CandidateTaskFamily,
  RecommendedMvpTemplate,
} from '../../types/selection'

/** 업무명 정규화 — 공백 정리, 소문자 비교용 키 */
export function normalizeTaskName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

export function taskNameKey(raw: string): string {
  return normalizeTaskName(raw).toLowerCase().replace(/[·,()[\]]/g, '')
}

interface FamilyKeyword {
  family: CandidateTaskFamily
  keywords: string[]
}

/** 업무명 키워드 → 업무군 (규칙 기반, 의미 유사도 사용 안 함) */
const FAMILY_KEYWORDS: FamilyKeyword[] = [
  { family: 'schedule_progress', keywords: ['생산계획', '작업지시', '일정', '배차', '배정', '스케줄', '진행'] },
  { family: 'quotation_cost_profit', keywords: ['견적', '원가', '마진', '단가', '정산'] },
  { family: 'inventory_asset', keywords: ['재고', '입고', '출고', '자재', '자산', '장비'] },
  { family: 'document_generation', keywords: ['보고서', '문서', '작업일보', '일지', '제안서', '초안', '양식'] },
  { family: 'data_validation', keywords: ['검수', '검사', '오류', '누락', '확인', '검증'] },
  { family: 'data_collection', keywords: ['수집', '입력', '기록', '자료', '접수'] },
  { family: 'approval_workflow', keywords: ['승인', '결재', '반려', '요청'] },
  { family: 'customer_response', keywords: ['고객', '상담', '문의', '응대', '민원'] },
  { family: 'customer_sales', keywords: ['영업', '수주', '매출', '거래처'] },
  { family: 'field_operation', keywords: ['현장', '사진', '운행', '수거', '차량'] },
  { family: 'reporting_dashboard', keywords: ['대시보드', '지표', 'kpi', '통계', '집계'] },
  { family: 'diagnosis_decision', keywords: ['판정', '진단', '분류', '평가'] },
]

export function inferTaskFamily(
  name: string,
  fallback: CandidateTaskFamily = 'other',
): CandidateTaskFamily {
  const key = taskNameKey(name)
  for (const entry of FAMILY_KEYWORDS) {
    if (entry.keywords.some((k) => key.includes(k))) return entry.family
  }
  return fallback
}

/** 업무군 → 기본 추천 MVP 템플릿 */
export const FAMILY_TO_TEMPLATE: Record<CandidateTaskFamily, RecommendedMvpTemplate> = {
  data_collection: 'data_collection_validation',
  data_validation: 'data_collection_validation',
  document_generation: 'document_report',
  diagnosis_decision: 'diagnosis_decision',
  schedule_progress: 'schedule_progress',
  approval_workflow: 'approval_workflow',
  quotation_cost_profit: 'quotation_cost_profit',
  inventory_asset: 'inventory_asset_field',
  field_operation: 'inventory_asset_field',
  customer_sales: 'customer_sales',
  customer_response: 'customer_sales',
  reporting_dashboard: 'document_report',
  system_integration: 'data_collection_validation',
  website_content: 'document_report',
  other: 'data_collection_validation',
}

/**
 * 규칙 기반 후보명 생성. LLM·의미 유사도 사용 금지.
 * 실제 업무명이 있으면 그대로 다듬어 사용하고, 없으면 확인 필요 임시명으로 표시한다.
 */
export function buildCandidateName(
  rawName: string,
  hint: string,
): { name: string; needsReview: boolean } {
  const cleaned = normalizeTaskName(rawName)
  if (cleaned.length >= 2) {
    // 너무 짧거나 일반적인 단어면 힌트를 결합
    return { name: cleaned, needsReview: false }
  }
  return { name: `업무명 확인 필요 — ${hint}`, needsReview: true }
}
