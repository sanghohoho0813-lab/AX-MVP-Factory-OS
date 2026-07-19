import type { HealthStatus, ProjectStage } from './index'

/* ------------------------------------------------------------------ */
/* 고객사 (Organization)                                               */
/* ------------------------------------------------------------------ */

export type OrganizationStatus = 'active' | 'prospect' | 'paused' | 'archived'

export type BusinessType =
  | 'corporation'
  | 'sole_proprietor'
  | 'medical'
  | 'nonprofit'
  | 'other'

export interface PrimaryContact {
  name: string
  position: string
  phone: string
  email: string
}

export interface Organization {
  id: string
  name: string
  /** 000-00-00000 형식 문자열 */
  businessRegistrationNumber: string
  industry: string
  subIndustry: string
  businessType: BusinessType
  /** ISO 날짜 문자열(YYYY-MM-DD), 미입력 시 null */
  foundedAt: string | null
  employeeCount: number | null
  /** 연매출(원) */
  annualRevenue: number | null
  region: string
  address: string
  website: string
  primaryContact: PrimaryContact
  status: OrganizationStatus
  healthStatus: HealthStatus
  notes: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export type OrganizationInput = Omit<
  Organization,
  'id' | 'createdAt' | 'updatedAt' | 'archivedAt'
>

/* ------------------------------------------------------------------ */
/* 프로젝트 (Project)                                                  */
/* ------------------------------------------------------------------ */

export type ProjectType = 'ax' | 'ax_website' | 'website'

export type ProjectStatus =
  | 'planned'
  | 'active'
  | 'waiting_client'
  | 'on_hold'
  | 'completed'
  | 'archived'

/** MVP 수준 (홈페이지 단독 프로젝트는 제작 수준 라벨로 번역 표시) */
export type MvpLevel = 0 | 1 | 2 | 3 | 4 | 5

export interface Project {
  id: string
  /** 자동 생성 코드 (예: AX-2026-001) */
  projectCode: string
  organizationId: string
  name: string
  projectType: ProjectType
  objective: string
  currentStage: ProjectStage
  currentMvpLevel: MvpLevel
  targetMvpLevel: MvpLevel
  status: ProjectStatus
  healthStatus: HealthStatus
  /** 0–100 */
  progress: number
  ownerId: string
  fundingRequired: boolean
  targetInstitutions: string[]
  targetFundingAmount: number | null
  startDate: string | null
  dueDate: string | null
  nextAction: string
  nextActionDueDate: string | null
  riskSummary: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export type ProjectInput = Omit<
  Project,
  'id' | 'projectCode' | 'createdAt' | 'updatedAt' | 'archivedAt'
>

/* ------------------------------------------------------------------ */
/* 내부 담당자 (InternalMember)                                        */
/* ------------------------------------------------------------------ */

export interface InternalMember {
  id: string
  name: string
  role: string
  email: string
  avatarInitial: string
}

/* ------------------------------------------------------------------ */
/* 활동 이력 (ActivityLog)                                             */
/* ------------------------------------------------------------------ */

export type ActivityType =
  | 'organization_created'
  | 'organization_updated'
  | 'project_created'
  | 'project_updated'
  | 'status_changed'
  | 'stage_changed'
  | 'archived'

export interface ActivityLog {
  id: string
  organizationId: string
  projectId: string | null
  activityType: ActivityType
  title: string
  description: string
  actorName: string
  createdAt: string
}

/* ------------------------------------------------------------------ */
/* 검색·필터                                                            */
/* ------------------------------------------------------------------ */

export interface OrganizationFilters {
  /** 고객사명·업종·담당자 대상 (프로젝트명 검색은 서비스 계층에서 결합) */
  query?: string
  status?: OrganizationStatus
  health?: HealthStatus
  industry?: string
  includeArchived?: boolean
}

export interface ProjectFilters {
  query?: string
  organizationId?: string
  stage?: ProjectStage
  status?: ProjectStatus
  type?: ProjectType
  includeArchived?: boolean
}

export type OrganizationSortKey = 'updated' | 'name' | 'progress' | 'risk'
