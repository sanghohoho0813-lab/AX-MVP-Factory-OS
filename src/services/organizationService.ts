import type {
  Organization,
  OrganizationFilters,
  OrganizationInput,
  OrganizationSortKey,
  Project,
} from '../types/domain'
import type { ProjectStage } from '../types'
import { normalizeQuery } from '../lib/format'
import {
  activityRepository,
  organizationRepository,
  projectRepository,
} from '../repositories'
import { CURRENT_USER } from '../data/demo'
import { getProjectProgress } from './projectProgressService'

const HEALTH_RISK_ORDER = { risk: 0, attention: 1, healthy: 2 } as const

export function createOrganization(input: OrganizationInput): Organization {
  const organization = organizationRepository.create(input)
  activityRepository.add({
    organizationId: organization.id,
    projectId: null,
    activityType: 'organization_created',
    title: '고객사가 등록되었습니다.',
    description: `${organization.name} · ${organization.industry}`,
    actorName: CURRENT_USER.name,
  })
  return organization
}

export function updateOrganization(
  id: string,
  input: OrganizationInput,
): Organization {
  const before = organizationRepository.getById(id)
  const organization = organizationRepository.update(id, input)
  activityRepository.add({
    organizationId: id,
    projectId: null,
    activityType: 'organization_updated',
    title: '고객사 정보가 수정되었습니다.',
    description:
      before && before.primaryContact.phone !== input.primaryContact.phone
        ? '고객사 연락처가 수정되었습니다.'
        : '',
    actorName: CURRENT_USER.name,
  })
  return organization
}

export function archiveOrganization(id: string): Organization {
  const organization = organizationRepository.archive(id)
  activityRepository.add({
    organizationId: id,
    projectId: null,
    activityType: 'archived',
    title: '고객사가 보관 처리되었습니다.',
    description: '기본 목록에서 숨겨지며 데이터는 삭제되지 않습니다.',
    actorName: CURRENT_USER.name,
  })
  return organization
}

/* ------------------------------------------------------------------ */
/* 목록 조회용 결합 데이터                                               */
/* ------------------------------------------------------------------ */

/** 목록 표시용 — 대표 프로젝트의 실제 진행상태 요약 (projectProgressService 단일 기준) */
export interface PrimaryProjectProgressSummary {
  /** "n / N단계" */
  stepText: string
  /** 완료 단계 ÷ 전체 단계 (파생값) */
  percent: number
  /** 현재 단계 라벨 (예: "기업 진단") */
  currentStepLabel: string
  /** 지금 해야 할 일 한 줄 */
  nextActionLabel: string
  isSample: boolean
}

export interface OrganizationRow {
  organization: Organization
  projects: Project[]
  /** 다음 행동 기준 대표 프로젝트 */
  primaryProject: Project | null
  /** 대표 프로젝트의 실제 데이터 기반 진행상태 (없으면 null) */
  primaryProgress: PrimaryProjectProgressSummary | null
  activeCount: number
}

const OPEN_STATUSES = new Set(['planned', 'active', 'waiting_client', 'on_hold'])

/** 다음 행동 예정일이 가장 가까운 진행 프로젝트를 대표로 고른다 */
export function pickPrimaryProject(projects: Project[]): Project | null {
  const open = projects.filter((p) => OPEN_STATUSES.has(p.status))
  const pool = open.length > 0 ? open : projects
  if (pool.length === 0) return null
  return [...pool].sort((a, b) => {
    const aDue = a.nextActionDueDate ?? '9999-12-31'
    const bDue = b.nextActionDueDate ?? '9999-12-31'
    if (aDue !== bDue) return aDue.localeCompare(bDue)
    return b.updatedAt.localeCompare(a.updatedAt)
  })[0]
}

export interface OrganizationListFilters extends OrganizationFilters {
  stage?: ProjectStage
  sort?: OrganizationSortKey
}

/**
 * 고객사 목록 검색·필터·정렬.
 * 검색어는 고객사명·업종·세부 업종·담당자·연결 프로젝트명을 대상으로 하며,
 * 필터는 AND 조건으로 결합된다.
 */
export function searchOrganizationRows(
  filters: OrganizationListFilters,
): OrganizationRow[] {
  const query = normalizeQuery(filters.query ?? '')
  const organizations = organizationRepository.getAll(filters.includeArchived)
  const allProjects = projectRepository.getAll()

  const rows = organizations
    .map<OrganizationRow>((organization) => {
      const projects = allProjects.filter(
        (p) => p.organizationId === organization.id,
      )
      const primaryProject = pickPrimaryProject(projects)
      const progress = primaryProject ? getProjectProgress(primaryProject) : null
      return {
        organization,
        projects,
        primaryProject,
        primaryProgress: progress
          ? {
              stepText: progress.stepText,
              percent: progress.percent,
              currentStepLabel: progress.currentStep.label,
              nextActionLabel: progress.nextAction.title,
              isSample: progress.isSample,
            }
          : null,
        activeCount: projects.filter((p) => OPEN_STATUSES.has(p.status)).length,
      }
    })
    .filter(({ organization, projects }) => {
      if (filters.status && organization.status !== filters.status) return false
      if (filters.health && organization.healthStatus !== filters.health) {
        return false
      }
      if (filters.industry && organization.industry !== filters.industry) {
        return false
      }
      if (
        filters.stage &&
        !projects.some((p) => p.currentStage === filters.stage)
      ) {
        return false
      }
      if (query) {
        const haystack = [
          organization.name,
          organization.industry,
          organization.subIndustry,
          organization.primaryContact.name,
          ...projects.map((p) => p.name),
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })

  const sort = filters.sort ?? 'updated'
  return rows.sort((a, b) => {
    switch (sort) {
      case 'name':
        return a.organization.name.localeCompare(b.organization.name, 'ko')
      case 'progress':
        return (
          (b.primaryProgress?.percent ?? -1) - (a.primaryProgress?.percent ?? -1)
        )
      case 'risk':
        return (
          HEALTH_RISK_ORDER[a.organization.healthStatus] -
          HEALTH_RISK_ORDER[b.organization.healthStatus]
        )
      case 'updated':
      default:
        return b.organization.updatedAt.localeCompare(a.organization.updatedAt)
    }
  })
}

/** 목록에 존재하는 업종 목록(필터 옵션용) */
export function listIndustries(): string[] {
  const set = new Set(
    organizationRepository.getAll().map((o) => o.industry).filter(Boolean),
  )
  return [...set].sort((a, b) => a.localeCompare(b, 'ko'))
}
