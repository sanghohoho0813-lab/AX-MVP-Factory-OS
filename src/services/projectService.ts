import type { Project, ProjectInput } from '../types/domain'
import { PROJECT_STATUS_META } from '../lib/domainMeta'
import { PROJECT_STAGE_META } from '../lib/statusMeta'
import { activityRepository, projectRepository } from '../repositories'
import { CURRENT_USER } from '../data/demo'

export function createProject(input: ProjectInput): Project {
  const project = projectRepository.create(input)
  activityRepository.add({
    organizationId: project.organizationId,
    projectId: project.id,
    activityType: 'project_created',
    title: `${project.name} 프로젝트가 생성되었습니다.`,
    description: `코드 ${project.projectCode}`,
    actorName: CURRENT_USER.name,
  })
  return project
}

/** 수정 시 상태·단계 변경을 비교해 별도 활동으로 기록한다 */
export function updateProject(id: string, input: ProjectInput): Project {
  const before = projectRepository.getById(id)
  const project = projectRepository.update(id, input)

  if (before) {
    if (before.status !== project.status) {
      activityRepository.add({
        organizationId: project.organizationId,
        projectId: project.id,
        activityType: 'status_changed',
        title: `프로젝트 상태가 ${PROJECT_STATUS_META[project.status].label}(으)로 변경되었습니다.`,
        description: `${PROJECT_STATUS_META[before.status].label} → ${PROJECT_STATUS_META[project.status].label}`,
        actorName: CURRENT_USER.name,
      })
    }
    if (before.currentStage !== project.currentStage) {
      activityRepository.add({
        organizationId: project.organizationId,
        projectId: project.id,
        activityType: 'stage_changed',
        title: `프로젝트 단계가 ${PROJECT_STAGE_META[project.currentStage].label}(으)로 변경되었습니다.`,
        description: `${PROJECT_STAGE_META[before.currentStage].label} → ${PROJECT_STAGE_META[project.currentStage].label}`,
        actorName: CURRENT_USER.name,
      })
    }
    if (
      before.status === project.status &&
      before.currentStage === project.currentStage
    ) {
      activityRepository.add({
        organizationId: project.organizationId,
        projectId: project.id,
        activityType: 'project_updated',
        title: '프로젝트 정보가 수정되었습니다.',
        description: '',
        actorName: CURRENT_USER.name,
      })
    }
  }
  return project
}

export function archiveProject(id: string): Project {
  const project = projectRepository.archive(id)
  activityRepository.add({
    organizationId: project.organizationId,
    projectId: project.id,
    activityType: 'archived',
    title: `${project.name} 프로젝트가 보관 처리되었습니다.`,
    description: '기본 목록에서 숨겨지며 데이터는 삭제되지 않습니다.',
    actorName: CURRENT_USER.name,
  })
  return project
}
