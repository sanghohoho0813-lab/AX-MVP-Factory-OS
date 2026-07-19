import type { RespondentRole } from '../../types'
import type {
  AssessmentDomain,
  AssessmentRecommendation,
} from '../../types/assessment'

/**
 * 진단 규칙 버전. AssessmentResult.ruleVersion에 저장한다.
 * 규칙(배점·가중치·감점·판정)이 바뀌면 이 값을 올린다.
 */
export const ASSESSMENT_RULE_VERSION = '1.0.0'

/** AX 적합성 총점(100점) 영역별 최대 배점 */
export const DOMAIN_MAX_SCORE: Record<AssessmentDomain, number> = {
  repetition: 20,
  economic: 20,
  data_readiness: 15,
  process_clarity: 15,
  adoption: 15,
  execution: 10,
  funding_connection: 5,
}

/**
 * 영역별 응답자 역할 가중치.
 * 응답이 없는 역할은 존재하는 역할끼리 다시 정규화한다(런타임 처리).
 * mixed(공통) 역할은 모든 영역에서 중립 가중치를 갖는다.
 */
export const DOMAIN_ROLE_WEIGHT: Record<
  AssessmentDomain,
  Record<RespondentRole, number>
> = {
  repetition: { owner: 0.2, manager: 0.3, worker: 0.5, mixed: 0.34 },
  economic: { owner: 0.4, manager: 0.35, worker: 0.25, mixed: 0.34 },
  data_readiness: { owner: 0.2, manager: 0.35, worker: 0.45, mixed: 0.34 },
  process_clarity: { owner: 0.15, manager: 0.35, worker: 0.5, mixed: 0.34 },
  adoption: { owner: 0.5, manager: 0.3, worker: 0.2, mixed: 0.34 },
  execution: { owner: 0.25, manager: 0.35, worker: 0.4, mixed: 0.34 },
  funding_connection: { owner: 0.6, manager: 0.3, worker: 0.1, mixed: 0.34 },
}

/** 자동 감점 총합 상한 */
export const MAX_AUTO_DEDUCTION = 30

/**
 * 숫자·금액·시간 문항의 명시적 점수화 규칙 (analysisTag 기준).
 * 여기에 없는 숫자 문항은 점수화하지 않고 근거(calculated_metric)로만 사용한다.
 * bands: 값 >= threshold 이면 score(0~100). 내림차순으로 평가한다.
 */
export interface NumericBand {
  threshold: number
  score: number
}

export const NUMERIC_SCORING_RULES: Record<string, NumericBand[]> = {
  // 월 총 업무시간 — 많을수록 절감 여지 큼
  baseline_time: [
    { threshold: 160, score: 100 },
    { threshold: 80, score: 80 },
    { threshold: 40, score: 60 },
    { threshold: 16, score: 40 },
    { threshold: 1, score: 20 },
    { threshold: 0, score: 5 },
  ],
  // 월 오류·재작업 건수 — 많을수록 개선 여지 큼
  baseline_error: [
    { threshold: 30, score: 100 },
    { threshold: 12, score: 80 },
    { threshold: 4, score: 55 },
    { threshold: 1, score: 35 },
    { threshold: 0, score: 10 },
  ],
  // 외주 월 비용 — 클수록 비용 절감 여지 큼
  outsourcing_cost: [
    { threshold: 3_000_000, score: 100 },
    { threshold: 1_000_000, score: 75 },
    { threshold: 300_000, score: 50 },
    { threshold: 1, score: 25 },
    { threshold: 0, score: 5 },
  ],
}

/** repeat_table 행 수 → 정규화 점수 (구조화 반복업무 존재) */
export function repeatTableRowScore(rowCount: number): number {
  if (rowCount >= 3) return 100
  if (rowCount === 2) return 70
  if (rowCount === 1) return 45
  return 0
}

/**
 * 주관식(서술형) 문항 정규화 규칙.
 * 의미를 해석하지 않고 응답 여부·구체성(숫자 포함·길이)만 반영한다.
 * 낮은 신뢰도로 표시한다.
 */
export function textAnswerScore(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const hasNumber = /\d/.test(trimmed)
  if (hasNumber && trimmed.length >= 20) return 75
  if (trimmed.length >= 40) return 60
  if (hasNumber) return 55
  if (trimmed.length >= 12) return 45
  return 35
}

/** 판정 구간 (기본 점수 기반, 예외 판정 적용 전) */
export interface ScoreBand {
  min: number
  recommendation: AssessmentRecommendation
}

export const SCORE_BANDS: ScoreBand[] = [
  { min: 80, recommendation: 'ax_strongly_recommended' },
  { min: 65, recommendation: 'simple_automation_recommended' },
  { min: 50, recommendation: 'diagnosis_document_first' },
  { min: 35, recommendation: 'funding_consulting_first' },
  { min: 0, recommendation: 'build_deferred_data' },
]

/** 점수 → 기본 판정 */
export function recommendationForScore(
  score: number,
): AssessmentRecommendation {
  for (const band of SCORE_BANDS) {
    if (score >= band.min) return band.recommendation
  }
  return 'build_deferred_data'
}

/* ------------------------------------------------------------------ */
/* analysisTag 상수 (규칙 엔진 공용)                                     */
/* ------------------------------------------------------------------ */

export const TAG = {
  ownerWill: 'owner_will',
  workerWill: 'worker_will',
  changeWill: 'change_will',
  testOwner: 'test_owner',
  dataProvision: 'data_provision',
  feedbackCadence: 'feedback_cadence',
  baselineTime: 'baseline_time',
  baselineError: 'baseline_error',
  measurableKpi: 'measurable_kpi',
  taskInventory: 'task_inventory',
  frequency: 'frequency',
  dataFormat: 'data_format',
  exportApi: 'export_api',
  privacy: 'privacy',
  humanReview: 'human_review',
  keyPersonRisk: 'key_person_risk',
  resistance: 'resistance',
  primaryGoal: 'primary_goal',
  improvementGoal: 'improvement_goal',
} as const

/** 웹사이트 준비도 배점 */
export const WEBSITE_DOMAIN_MAX_SCORE = {
  purpose_clarity: 20,
  customer_clarity: 15,
  content_readiness: 20,
  brand_direction: 15,
  asset_readiness: 15,
  operation_readiness: 15,
} as const
