import type { RespondentRole } from './index'
import type { SnapshotSection } from './survey'

/* ------------------------------------------------------------------ */
/* 설문 발급 (SurveyDistribution)                                       */
/* ------------------------------------------------------------------ */

export type SurveyDistributionStatus =
  | 'draft'
  | 'issued'
  | 'opened'
  | 'in_progress'
  | 'submitted'
  | 'expired'
  | 'revoked'

export interface SurveyDistribution {
  id: string
  projectId: string
  organizationId: string
  blueprintId: string
  /** 발급 시점의 설문 구조 스냅샷 (원본 변경과 무관하게 보존) */
  blueprintSnapshot: SnapshotSection[]
  respondentRole: RespondentRole
  surveyTitle: string
  recipientName: string
  recipientPosition: string
  recipientEmail: string
  recipientPhone: string
  /** URL-safe 고엔트로피 토큰 */
  accessToken: string
  status: SurveyDistributionStatus
  introMessage: string
  privacyNotice: string
  consentRequired: boolean
  /** 만료 일시 ISO, null이면 만료 없음 */
  expiresAt: string | null
  issuedAt: string
  firstOpenedAt: string | null
  lastOpenedAt: string | null
  submittedAt: string | null
  revokedAt: string | null
  createdAt: string
  updatedAt: string
}

export type SurveyDistributionInput = Omit<
  SurveyDistribution,
  | 'id'
  | 'accessToken'
  | 'status'
  | 'issuedAt'
  | 'firstOpenedAt'
  | 'lastOpenedAt'
  | 'submittedAt'
  | 'revokedAt'
  | 'createdAt'
  | 'updatedAt'
>

export interface DistributionFilters {
  query?: string
  status?: SurveyDistributionStatus
  respondentRole?: RespondentRole
  projectId?: string
  /** true면 만료된 것만, false면 만료 제외 */
  expiredOnly?: boolean
  submittedOnly?: boolean
}

/* ------------------------------------------------------------------ */
/* 응답 (SurveyResponse)                                               */
/* ------------------------------------------------------------------ */

export type SurveyResponseStatus = 'not_started' | 'in_progress' | 'submitted'

export interface RespondentProfile {
  name: string
  position: string
  department: string
  email: string
  phone: string
}

/** 파일은 원본을 저장하지 않고 메타데이터만 보존한다 */
export interface SurveyFileMetadata {
  name: string
  size: number
  type: string
  lastModified: number
  /** 항상 true — 로컬 테스트 모드 */
  localOnly: true
  selectedAt: string
}

/** repeat_table 한 행: 컬럼 id → 문자열 값 */
export type RepeatTableAnswer = Record<string, string>

export type SurveyAnswerValue =
  | string
  | number
  | boolean
  | string[]
  | SurveyFileMetadata
  | RepeatTableAnswer[]
  | null

export interface SurveyAnswer {
  questionId: string
  questionCode: string
  value: SurveyAnswerValue
  answeredAt: string
  updatedAt: string
}

export interface SurveyResponse {
  id: string
  distributionId: string
  projectId: string
  organizationId: string
  respondentRole: RespondentRole
  respondentProfile: RespondentProfile
  consented: boolean
  consentedAt: string | null
  answers: SurveyAnswer[]
  currentSectionId: string | null
  currentPageIndex: number
  progressPercent: number
  answeredVisibleCount: number
  requiredVisibleCount: number
  requiredAnsweredCount: number
  status: SurveyResponseStatus
  startedAt: string | null
  lastSavedAt: string | null
  submittedAt: string | null
  createdAt: string
  updatedAt: string
}

export type SurveyResponseInput = Omit<
  SurveyResponse,
  'id' | 'createdAt' | 'updatedAt'
>

export interface ResponseFilters {
  distributionId?: string
  projectId?: string
  status?: SurveyResponseStatus
}

/* ------------------------------------------------------------------ */
/* 검증 · 진행률                                                        */
/* ------------------------------------------------------------------ */

export type ValidationIssueType =
  | 'required'
  | 'invalid_format'
  | 'unsupported_file'
  | 'missing_consent'

export interface ResponseValidationIssue {
  questionId: string
  sectionId: string
  type: ValidationIssueType
  message: string
}

export interface SurveyProgressSummary {
  totalVisibleQuestions: number
  answeredVisibleQuestions: number
  totalRequiredQuestions: number
  answeredRequiredQuestions: number
  progressPercent: number
  estimatedRemainingMinutes: number
}
