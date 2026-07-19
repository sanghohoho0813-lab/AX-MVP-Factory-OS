import type {
  ActivityLog,
  Organization,
  OrganizationFilters,
  OrganizationInput,
  Project,
  ProjectFilters,
  ProjectInput,
} from '../types/domain'
import { normalizeQuery } from '../lib/format'
import { PROJECT_TYPE_META } from '../lib/domainMeta'
import {
  STORAGE_KEYS,
  generateId,
  notifyStoreChanged,
  readJson,
  writeJson,
} from '../storage/localStore'
import {
  EntityNotFoundError,
  type ActivityRepository,
  type OrganizationRepository,
  type ProjectRepository,
} from './types'

function nowIso(): string {
  return new Date().toISOString()
}

/** 배열 형태가 아니면 손상된 데이터로 보고 빈 배열을 사용한다 */
function readList<T>(key: string): T[] {
  const value = readJson<T[]>(key, [])
  return Array.isArray(value) ? value : []
}

/* ------------------------------------------------------------------ */
/* 고객사                                                               */
/* ------------------------------------------------------------------ */

export class LocalOrganizationRepository implements OrganizationRepository {
  private read(): Organization[] {
    return readList<Organization>(STORAGE_KEYS.organizations)
  }

  private write(list: Organization[]): void {
    writeJson(STORAGE_KEYS.organizations, list)
    notifyStoreChanged()
  }

  getAll(includeArchived = false): Organization[] {
    const list = this.read()
    return includeArchived ? list : list.filter((o) => o.archivedAt === null)
  }

  getById(id: string): Organization | null {
    return this.read().find((o) => o.id === id) ?? null
  }

  create(input: OrganizationInput): Organization {
    const timestamp = nowIso()
    const organization: Organization = {
      ...input,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    }
    this.write([...this.read(), organization])
    return organization
  }

  update(id: string, input: Partial<OrganizationInput>): Organization {
    const list = this.read()
    const index = list.findIndex((o) => o.id === id)
    if (index < 0) throw new EntityNotFoundError('고객사')
    const updated: Organization = {
      ...list[index],
      ...input,
      id,
      updatedAt: nowIso(),
    }
    list[index] = updated
    this.write(list)
    return updated
  }

  archive(id: string): Organization {
    const list = this.read()
    const index = list.findIndex((o) => o.id === id)
    if (index < 0) throw new EntityNotFoundError('고객사')
    const timestamp = nowIso()
    list[index] = {
      ...list[index],
      status: 'archived',
      archivedAt: timestamp,
      updatedAt: timestamp,
    }
    this.write(list)
    return list[index]
  }

  search(filters: OrganizationFilters): Organization[] {
    const query = normalizeQuery(filters.query ?? '')
    return this.getAll(filters.includeArchived).filter((org) => {
      if (filters.status && org.status !== filters.status) return false
      if (filters.health && org.healthStatus !== filters.health) return false
      if (filters.industry && org.industry !== filters.industry) return false
      if (query) {
        const haystack = [
          org.name,
          org.industry,
          org.subIndustry,
          org.primaryContact.name,
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }
}

/* ------------------------------------------------------------------ */
/* 프로젝트                                                             */
/* ------------------------------------------------------------------ */

export class LocalProjectRepository implements ProjectRepository {
  private read(): Project[] {
    return readList<Project>(STORAGE_KEYS.projects)
  }

  private write(list: Project[]): void {
    writeJson(STORAGE_KEYS.projects, list)
    notifyStoreChanged()
  }

  getAll(includeArchived = false): Project[] {
    const list = this.read()
    return includeArchived ? list : list.filter((p) => p.archivedAt === null)
  }

  getById(id: string): Project | null {
    return this.read().find((p) => p.id === id) ?? null
  }

  getByOrganizationId(organizationId: string, includeArchived = false): Project[] {
    return this.getAll(includeArchived).filter(
      (p) => p.organizationId === organizationId,
    )
  }

  /** 연도별 전체 일련번호 기준으로 중복 없는 프로젝트 코드를 생성한다 */
  private generateProjectCode(input: ProjectInput, existing: Project[]): string {
    const prefix = PROJECT_TYPE_META[input.projectType].codePrefix
    const year = new Date().getFullYear()
    const pattern = new RegExp(`^(?:AX|WEB|HYB)-${year}-(\\d{3,})$`)
    let maxSeq = 0
    for (const project of existing) {
      const match = pattern.exec(project.projectCode)
      if (match) maxSeq = Math.max(maxSeq, Number(match[1]))
    }
    let seq = maxSeq + 1
    let code = `${prefix}-${year}-${String(seq).padStart(3, '0')}`
    const codes = new Set(existing.map((p) => p.projectCode))
    while (codes.has(code)) {
      seq += 1
      code = `${prefix}-${year}-${String(seq).padStart(3, '0')}`
    }
    return code
  }

  create(input: ProjectInput): Project {
    const existing = this.read()
    const timestamp = nowIso()
    const project: Project = {
      ...input,
      id: generateId(),
      projectCode: this.generateProjectCode(input, existing),
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    }
    this.write([...existing, project])
    return project
  }

  update(id: string, input: Partial<ProjectInput>): Project {
    const list = this.read()
    const index = list.findIndex((p) => p.id === id)
    if (index < 0) throw new EntityNotFoundError('프로젝트')
    const updated: Project = {
      ...list[index],
      ...input,
      id,
      projectCode: list[index].projectCode,
      updatedAt: nowIso(),
    }
    list[index] = updated
    this.write(list)
    return updated
  }

  archive(id: string): Project {
    const list = this.read()
    const index = list.findIndex((p) => p.id === id)
    if (index < 0) throw new EntityNotFoundError('프로젝트')
    const timestamp = nowIso()
    list[index] = {
      ...list[index],
      status: 'archived',
      archivedAt: timestamp,
      updatedAt: timestamp,
    }
    this.write(list)
    return list[index]
  }

  search(filters: ProjectFilters): Project[] {
    const query = normalizeQuery(filters.query ?? '')
    return this.getAll(filters.includeArchived).filter((project) => {
      if (filters.organizationId && project.organizationId !== filters.organizationId) {
        return false
      }
      if (filters.stage && project.currentStage !== filters.stage) return false
      if (filters.status && project.status !== filters.status) return false
      if (filters.type && project.projectType !== filters.type) return false
      if (query) {
        const haystack = `${project.name} ${project.projectCode}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }
}

/* ------------------------------------------------------------------ */
/* 활동 이력                                                            */
/* ------------------------------------------------------------------ */

export class LocalActivityRepository implements ActivityRepository {
  private read(): ActivityLog[] {
    return readList<ActivityLog>(STORAGE_KEYS.activities)
  }

  getByOrganizationId(organizationId: string, limit = 10): ActivityLog[] {
    return this.read()
      .filter((a) => a.organizationId === organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
  }

  getByProjectId(projectId: string, limit = 10): ActivityLog[] {
    return this.read()
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
  }

  add(activity: Omit<ActivityLog, 'id' | 'createdAt'>): ActivityLog {
    const entry: ActivityLog = {
      ...activity,
      id: generateId(),
      createdAt: nowIso(),
    }
    writeJson(STORAGE_KEYS.activities, [...this.read(), entry])
    notifyStoreChanged()
    return entry
  }
}
