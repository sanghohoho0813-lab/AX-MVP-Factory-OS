import {
  AlignLeft,
  ArrowUpDown,
  Ban,
  Building2,
  Calendar,
  CheckSquare,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  Database,
  FileText,
  FileUp,
  Gauge,
  Hash,
  ListChecks,
  ListOrdered,
  Palette,
  Recycle,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Table2,
  Target,
  ToggleLeft,
  Type,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RespondentRole, StatusTone } from '../types'
import type {
  ConditionOperator,
  ExpertRiskGrade,
  ModuleKind,
  ModuleStatus,
  QuestionCategory,
  QuestionType,
  QuestionScope,
  RiskSignalLevel,
  ScoringDomain,
  SurveyPurpose,
  SurveyTemplateStatus,
} from '../types/survey'

/* ------------------------------------------------------------------ */
/* 질문 유형                                                            */
/* ------------------------------------------------------------------ */

interface QuestionTypeMeta {
  label: string
  icon: LucideIcon
  /** 자동 예상시간 계산용 기본값(분) */
  estimateMinutes: number
  /** 선택지가 필요한 유형 */
  needsOptions: boolean
  /** 반복 컬럼이 필요한 유형 */
  needsColumns: boolean
}

export const QUESTION_TYPE_META: Record<QuestionType, QuestionTypeMeta> = {
  single_choice: { label: '단일 선택', icon: ListChecks, estimateMinutes: 0.3, needsOptions: true, needsColumns: false },
  multiple_choice: { label: '복수 선택', icon: CheckSquare, estimateMinutes: 0.5, needsOptions: true, needsColumns: false },
  yes_no: { label: '예·아니오', icon: ToggleLeft, estimateMinutes: 0.25, needsOptions: true, needsColumns: false },
  scale_5: { label: '5점 척도', icon: Gauge, estimateMinutes: 0.3, needsOptions: true, needsColumns: false },
  number: { label: '숫자', icon: Hash, estimateMinutes: 0.4, needsOptions: false, needsColumns: false },
  currency: { label: '금액', icon: CircleDollarSign, estimateMinutes: 0.4, needsOptions: false, needsColumns: false },
  time: { label: '시간', icon: Clock, estimateMinutes: 0.4, needsOptions: false, needsColumns: false },
  date: { label: '날짜', icon: Calendar, estimateMinutes: 0.4, needsOptions: false, needsColumns: false },
  short_text: { label: '짧은 답변', icon: Type, estimateMinutes: 0.7, needsOptions: false, needsColumns: false },
  long_text: { label: '긴 답변', icon: AlignLeft, estimateMinutes: 1.4, needsOptions: false, needsColumns: false },
  file: { label: '파일 첨부', icon: FileUp, estimateMinutes: 1, needsOptions: false, needsColumns: false },
  repeat_table: { label: '표 반복 입력', icon: Table2, estimateMinutes: 2, needsOptions: false, needsColumns: true },
  ranking: { label: '순서 정렬', icon: ArrowUpDown, estimateMinutes: 1, needsOptions: true, needsColumns: false },
}

export const QUESTION_TYPES = Object.keys(QUESTION_TYPE_META) as QuestionType[]

/** 선택형(선택지 편집이 필요한) 유형 */
export function questionNeedsOptions(type: QuestionType): boolean {
  return QUESTION_TYPE_META[type].needsOptions
}

export function questionNeedsColumns(type: QuestionType): boolean {
  return QUESTION_TYPE_META[type].needsColumns
}

/** 표 반복 컬럼 필드 유형 라벨 */
export const REPEAT_COLUMN_TYPE_META: Record<string, string> = {
  short_text: '짧은 답변',
  number: '숫자',
  currency: '금액',
  time: '시간',
  date: '날짜',
  single_choice: '단일 선택',
}

/* ------------------------------------------------------------------ */
/* 질문 범주                                                            */
/* ------------------------------------------------------------------ */

export const QUESTION_CATEGORY_META: Record<
  QuestionCategory,
  { label: string; tone: StatusTone; icon: LucideIcon }
> = {
  company: { label: '기업 기본정보', tone: 'neutral', icon: Building2 },
  workflow: { label: '업무 흐름', tone: 'info', icon: ScrollText },
  waste: { label: '시간·비용 낭비', tone: 'warning', icon: Clock },
  data: { label: '데이터 현황', tone: 'info', icon: Database },
  systems: { label: '현재 시스템', tone: 'neutral', icon: FileText },
  ai_fit: { label: 'AI 적용 가능성', tone: 'accent', icon: Sparkles },
  adoption: { label: '도입 의지', tone: 'success', icon: Users },
  kpi: { label: '성과 측정', tone: 'info', icon: Target },
  compliance: { label: '개인정보·전문가 검토', tone: 'danger', icon: ShieldCheck },
  website: { label: '홈페이지·브랜드', tone: 'accent', icon: Palette },
}

export const QUESTION_CATEGORIES = Object.keys(
  QUESTION_CATEGORY_META,
) as QuestionCategory[]

/* ------------------------------------------------------------------ */
/* 응답자 역할                                                          */
/* ------------------------------------------------------------------ */

export const RESPONDENT_ROLE_META: Record<
  RespondentRole,
  { label: string; shortLabel: string; tone: StatusTone; icon: LucideIcon }
> = {
  owner: { label: '대표자', shortLabel: '대표자', tone: 'accent', icon: Building2 },
  manager: { label: '관리자·부서장', shortLabel: '관리자', tone: 'info', icon: ClipboardCheck },
  worker: { label: '현장 담당자', shortLabel: '현장', tone: 'success', icon: Users },
  mixed: { label: '공통', shortLabel: '공통', tone: 'neutral', icon: Users },
}

export const RESPONDENT_ROLES = Object.keys(
  RESPONDENT_ROLE_META,
) as RespondentRole[]

/** 응답자별 권장 예상시간 상한(분) — 품질검사에서 사용 */
export const ROLE_RECOMMENDED_MINUTES: Record<RespondentRole, number> = {
  owner: 20,
  manager: 22,
  worker: 25,
  mixed: 22,
}

/** 응답자별 권장 문항 수 (정보성 안내용) */
export const ROLE_RECOMMENDED_QUESTIONS: Record<
  RespondentRole,
  { min: number; max: number }
> = {
  owner: { min: 25, max: 35 },
  manager: { min: 25, max: 38 },
  worker: { min: 30, max: 40 },
  mixed: { min: 20, max: 35 },
}

/* ------------------------------------------------------------------ */
/* 질문 범위                                                            */
/* ------------------------------------------------------------------ */

export const QUESTION_SCOPE_META: Record<
  QuestionScope,
  { label: string; tone: StatusTone }
> = {
  common: { label: '공통', tone: 'neutral' },
  industry: { label: '업종 특화', tone: 'info' },
  objective: { label: '목적 특화', tone: 'accent' },
  custom: { label: '프로젝트 맞춤', tone: 'warning' },
}

export const QUESTION_SCOPES = Object.keys(QUESTION_SCOPE_META) as QuestionScope[]

/* ------------------------------------------------------------------ */
/* 점수 영역                                                            */
/* ------------------------------------------------------------------ */

export const SCORING_DOMAIN_META: Record<ScoringDomain, { label: string }> = {
  none: { label: '점수 없음' },
  repetition: { label: '반복성' },
  economic: { label: '경제성' },
  data_readiness: { label: '데이터 준비도' },
  process_clarity: { label: '업무 규칙성' },
  adoption: { label: '도입 의지' },
  execution: { label: '실행 가능성' },
  funding_connection: { label: '자금조달 연계' },
}

export const SCORING_DOMAINS = Object.keys(SCORING_DOMAIN_META) as ScoringDomain[]

/* ------------------------------------------------------------------ */
/* 전문가 위험등급 · 위험 신호                                           */
/* ------------------------------------------------------------------ */

export const EXPERT_RISK_META: Record<
  ExpertRiskGrade,
  { label: string; tone: StatusTone; icon: LucideIcon }
> = {
  green: { label: '자동 처리 가능', tone: 'success', icon: ShieldCheck },
  yellow: { label: '참고 안내', tone: 'warning', icon: ShieldCheck },
  red: { label: '전문가 최종 확인', tone: 'danger', icon: ShieldCheck },
}

export const EXPERT_RISK_GRADES = Object.keys(EXPERT_RISK_META) as ExpertRiskGrade[]

export const RISK_SIGNAL_META: Record<
  RiskSignalLevel,
  { label: string; tone: StatusTone }
> = {
  none: { label: '없음', tone: 'neutral' },
  info: { label: '정보', tone: 'info' },
  warning: { label: '주의', tone: 'warning' },
  critical: { label: '심각', tone: 'danger' },
}

export const RISK_SIGNAL_LEVELS = Object.keys(
  RISK_SIGNAL_META,
) as RiskSignalLevel[]

/* ------------------------------------------------------------------ */
/* 모듈                                                                 */
/* ------------------------------------------------------------------ */

export const MODULE_KIND_META: Record<
  ModuleKind,
  { label: string; tone: StatusTone; icon: LucideIcon }
> = {
  industry: { label: '업종 모듈', tone: 'info', icon: Building2 },
  objective: { label: '목적 모듈', tone: 'accent', icon: Target },
}

export const MODULE_STATUS_META: Record<
  ModuleStatus,
  { label: string; tone: StatusTone }
> = {
  draft: { label: '초안', tone: 'neutral' },
  active: { label: '활성', tone: 'success' },
  archived: { label: '보관됨', tone: 'neutral' },
}

/* ------------------------------------------------------------------ */
/* 템플릿 상태 · 목적                                                    */
/* ------------------------------------------------------------------ */

export const TEMPLATE_STATUS_META: Record<
  SurveyTemplateStatus,
  { label: string; tone: StatusTone }
> = {
  draft: { label: '초안', tone: 'neutral' },
  published: { label: '게시', tone: 'success' },
  archived: { label: '보관됨', tone: 'neutral' },
}

export const SURVEY_PURPOSE_META: Record<SurveyPurpose, { label: string }> = {
  ax_diagnosis: { label: 'AX 현장진단' },
  website_readiness: { label: '홈페이지 제작 사전진단' },
  funding: { label: '자금조달 연계 확인' },
}

/* ------------------------------------------------------------------ */
/* 조건 연산자                                                          */
/* ------------------------------------------------------------------ */

export const CONDITION_OPERATOR_META: Record<
  ConditionOperator,
  { label: string; needsValue: boolean }
> = {
  equals: { label: '답변이 다음과 같을 때', needsValue: true },
  not_equals: { label: '답변이 다음과 다를 때', needsValue: true },
  includes: { label: '답변에 다음이 포함될 때', needsValue: true },
  greater_than: { label: '답변이 다음보다 클 때', needsValue: true },
  less_than: { label: '답변이 다음보다 작을 때', needsValue: true },
  is_answered: { label: '답변이 있을 때', needsValue: false },
  is_not_answered: { label: '답변이 없을 때', needsValue: false },
}

/* ------------------------------------------------------------------ */
/* 업종·목적 키 (질문/모듈 연결용)                                       */
/* ------------------------------------------------------------------ */

/** 업종 키 → 라벨. 고객사 업종 문자열을 이 키로 매핑해 모듈을 추천한다 */
export const INDUSTRY_KEY_META: Record<string, { label: string; icon: LucideIcon }> = {
  manufacturing: { label: '제조업', icon: Building2 },
  logistics_env: { label: '물류·환경·폐기물', icon: Recycle },
  professional: { label: '전문서비스·컨설팅', icon: ClipboardCheck },
  medical: { label: '병원·의료지원', icon: ShieldCheck },
}

export const INDUSTRY_KEYS = Object.keys(INDUSTRY_KEY_META)

export const OBJECTIVE_KEY_META: Record<string, { label: string; icon: LucideIcon }> = {
  website: { label: '기업 홈페이지 제작', icon: Palette },
  funding: { label: '자금조달 연계', icon: CircleDollarSign },
}

export const OBJECTIVE_KEYS = Object.keys(OBJECTIVE_KEY_META)

export function industryKeyLabel(key: string): string {
  return INDUSTRY_KEY_META[key]?.label ?? key
}

export function objectiveKeyLabel(key: string): string {
  return OBJECTIVE_KEY_META[key]?.label ?? key
}

/**
 * 고객사 업종 문자열 → 업종 키 매핑.
 * 시드 고객사(정밀가공 제조업, 물류·운송, 환경·폐기물, 전문서비스, 병원·의료지원 등)를 커버한다.
 */
export function resolveIndustryKey(industry: string): string | null {
  const value = industry.toLowerCase()
  if (value.includes('제조') || value.includes('가공')) return 'manufacturing'
  if (
    value.includes('물류') ||
    value.includes('운송') ||
    value.includes('환경') ||
    value.includes('폐기물')
  ) {
    return 'logistics_env'
  }
  if (
    value.includes('전문') ||
    value.includes('컨설팅') ||
    value.includes('세무') ||
    value.includes('회계') ||
    value.includes('서비스')
  ) {
    return 'professional'
  }
  if (value.includes('병원') || value.includes('의료')) return 'medical'
  return null
}

/** 아이콘 없이 쓰는 곳을 위한 헬퍼 (금지 아이콘 등) */
export const RISK_NONE_ICON = Ban
export const ORDER_ICON = ListOrdered
