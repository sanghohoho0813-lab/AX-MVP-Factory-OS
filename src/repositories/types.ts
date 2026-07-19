import type {
  ActivityLog,
  Organization,
  OrganizationFilters,
  OrganizationInput,
  Project,
  ProjectFilters,
  ProjectInput,
} from '../types/domain'

/**
 * 저장소 계층 인터페이스.
 * 현재는 localStorage 구현을 사용하며, 향후 Supabase Repository로 교체한다.
 * UI는 이 인터페이스(또는 서비스 계층)만 사용해야 한다.
 */

export interface OrganizationRepository {
  getAll(includeArchived?: boolean): Organization[]
  getById(id: string): Organization | null
  create(input: OrganizationInput): Organization
  update(id: string, input: Partial<OrganizationInput>): Organization
  archive(id: string): Organization
  search(filters: OrganizationFilters): Organization[]
}

export interface ProjectRepository {
  getAll(includeArchived?: boolean): Project[]
  getById(id: string): Project | null
  getByOrganizationId(organizationId: string, includeArchived?: boolean): Project[]
  create(input: ProjectInput): Project
  update(id: string, input: Partial<ProjectInput>): Project
  archive(id: string): Project
  search(filters: ProjectFilters): Project[]
}

export interface ActivityRepository {
  getByOrganizationId(organizationId: string, limit?: number): ActivityLog[]
  getByProjectId(projectId: string, limit?: number): ActivityLog[]
  add(activity: Omit<ActivityLog, 'id' | 'createdAt'>): ActivityLog
}

export class EntityNotFoundError extends Error {
  constructor(entity: '고객사' | '프로젝트') {
    super(`${entity}를 찾을 수 없습니다.`)
    this.name = 'EntityNotFoundError'
  }
}
