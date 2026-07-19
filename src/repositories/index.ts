import {
  LocalActivityRepository,
  LocalOrganizationRepository,
  LocalProjectRepository,
} from './localRepositories'
import { ensureSeeded } from './seed'
import type {
  ActivityRepository,
  OrganizationRepository,
  ProjectRepository,
} from './types'

ensureSeeded()

/**
 * 앱 전역 저장소 싱글턴.
 * 향후 Supabase 연결 시 이 파일에서 구현체만 교체한다.
 */
export const organizationRepository: OrganizationRepository =
  new LocalOrganizationRepository()

export const projectRepository: ProjectRepository = new LocalProjectRepository()

export const activityRepository: ActivityRepository = new LocalActivityRepository()

export { EntityNotFoundError } from './types'
