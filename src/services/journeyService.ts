import type { Project } from '../types/domain'
import { organizationRepository, projectRepository } from '../repositories'
import {
  getProjectProgress,
  type CoreStepKey,
  type ProjectProgress,
} from './projectProgressService'

/**
 * 프로젝트 여정 — 진행상태 단일 기준(projectProgressService)을 화면 표현으로 감싼다.
 * 화면별 임의 계산·하드코딩 진행률을 금지하고 이 결과만 사용한다.
 */

/** AX 제작 전체 흐름 (쉬운 명칭) */
export type FlowStepKey =
  | 'prepare'
  | 'diagnosis'
  | 'selection'
  | 'design'
  | 'validation'
  | 'deliverables'
  | 'done'

export interface FlowStepMeta {
  key: FlowStepKey
  label: string
  desc: string
}

export const FLOW_STEPS: FlowStepMeta[] = [
  { key: 'prepare', label: '프로젝트 준비', desc: '고객사와 프로젝트를 등록합니다.' },
  { key: 'diagnosis', label: '기업 진단', desc: '설문으로 업무·데이터 상태를 확인합니다.' },
  { key: 'selection', label: '만들 업무 선택', desc: '먼저 만들 업무 1개를 고릅니다.' },
  { key: 'design', label: '기능·화면 설계', desc: '개발 가능한 기능·화면을 설계합니다.' },
  { key: 'validation', label: '실제 사용 테스트', desc: '현장에서 직접 써보며 검증합니다. (고급 운영)' },
  { key: 'deliverables', label: '결과자료', desc: '결과를 전달용 자료로 정리합니다.' },
  { key: 'done', label: '완료', desc: '프로젝트를 마무리합니다.' },
]

export function flowStepIndex(key: FlowStepKey): number {
  return FLOW_STEPS.findIndex((s) => s.key === key)
}

export function flowStepLabel(key: FlowStepKey): string {
  return FLOW_STEPS.find((s) => s.key === key)?.label ?? key
}

function toFlowStepKey(key: CoreStepKey, allCompleted: boolean): FlowStepKey {
  if (allCompleted) return 'done'
  switch (key) {
    case 'ax_design':
    case 'website_design':
      return 'design'
    default:
      return key
  }
}

export interface ProjectJourney {
  project: Project
  orgName: string
  currentStepKey: FlowStepKey
  /** 실제 데이터 기반 진행상태 (단일 기준) */
  progress: ProjectProgress
  /** 지금 해야 하는 일 */
  actionText: string
  /** 왜 필요한지 한 줄 */
  reason: string
  /** 구체적 행동 버튼명 */
  actionLabel: string
  actionPath: string
  isWebsite: boolean
  /** 현재 단계가 사용자 행동이 필요한 상태인지 (완료 아님) */
  needsAction: boolean
}

/** 프로젝트의 현재 흐름 단계와 다음 행동을 계산한다 (진행상태 단일 기준 사용) */
export function computeProjectJourney(project: Project): ProjectJourney {
  const orgName = organizationRepository.getById(project.organizationId)?.name ?? '고객사'
  const progress = getProjectProgress(project)
  const next = progress.nextAction
  return {
    project,
    orgName,
    currentStepKey: toFlowStepKey(progress.currentStep.key, progress.allCompleted),
    progress,
    actionText: next.title,
    reason: next.reason,
    actionLabel: next.buttonLabel,
    actionPath: next.path,
    isWebsite: project.projectType === 'website',
    needsAction: !progress.allCompleted,
  }
}

/** 홈: 지금 해야 할 일 (행동이 필요한 프로젝트 상위 N개) */
export function getTopNextActions(limit = 3): ProjectJourney[] {
  return projectRepository
    .getAll()
    .filter((p) => p.status === 'active')
    .map(computeProjectJourney)
    .filter((j) => j.needsAction)
    .sort((a, b) => flowStepIndex(a.currentStepKey) - flowStepIndex(b.currentStepKey))
    .slice(0, limit)
}

/** 홈: 가장 최근 작업 프로젝트 (진행 중인 프로젝트 계속) */
export function getMostRecentProject(): Project | null {
  const active = projectRepository
    .getAll()
    .filter((p) => p.status !== 'archived')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return active[0] ?? null
}
