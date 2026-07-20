import type { Project } from '../types/domain'
import { organizationRepository, projectRepository } from '../repositories'
import { getProjectAnalysisLifecycle } from './assessmentService'
import { hasReadyBlueprint } from './projectSurveyService'
import { getProjectSelectionLifecycle } from './selectionService'
import { getProjectDesignLifecycle } from './mvpDesignService'

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
  { key: 'selection', label: '핵심 업무 선택', desc: '먼저 만들 업무 1개를 고릅니다.' },
  { key: 'design', label: '기능·화면 설계', desc: '개발 가능한 기능·화면을 설계합니다.' },
  { key: 'validation', label: '실제 사용 테스트', desc: '현장에서 직접 써보며 검증합니다.' },
  { key: 'deliverables', label: '제출자료 정리', desc: '결과를 제출자료로 정리합니다.' },
  { key: 'done', label: '완료', desc: '프로젝트를 마무리합니다.' },
]

export function flowStepIndex(key: FlowStepKey): number {
  return FLOW_STEPS.findIndex((s) => s.key === key)
}

export interface ProjectJourney {
  project: Project
  orgName: string
  currentStepKey: FlowStepKey
  /** 지금 해야 하는 일 */
  actionText: string
  /** 왜 필요한지 한 줄 */
  reason: string
  /** 구체적 행동 버튼명 */
  actionLabel: string
  actionPath: string
  isWebsite: boolean
  /** 현재 단계가 사용자 행동이 필요한 상태인지 (완료·대기 아님) */
  needsAction: boolean
}

/** 프로젝트의 현재 흐름 단계와 다음 행동을 계산한다 */
export function computeProjectJourney(project: Project): ProjectJourney {
  const orgName = organizationRepository.getById(project.organizationId)?.name ?? '고객사'
  const base = { project, orgName, isWebsite: false as boolean }

  if (project.projectType === 'website') {
    return {
      ...base,
      isWebsite: true,
      currentStepKey: 'design',
      actionText: '홈페이지 제작 방향을 설계합니다.',
      reason: '기업·브랜드 정보를 입력하면 디자인 방향을 만들 수 있습니다.',
      actionLabel: '홈페이지 설계하기',
      actionPath: '/website-studio',
      needsAction: true,
    }
  }

  const id = project.id
  const analysisLc = getProjectAnalysisLifecycle(project)

  if (analysisLc === 'no_response') {
    if (!hasReadyBlueprint(id)) {
      return {
        ...base,
        currentStepKey: 'diagnosis',
        actionText: '대표자·현장 담당자에게 보낼 진단 설문을 구성합니다.',
        reason: '설문이 준비되어야 진단을 시작할 수 있습니다.',
        actionLabel: '설문 구성하기',
        actionPath: `/diagnosis/projects/${id}/setup`,
        needsAction: true,
      }
    }
    return {
      ...base,
      currentStepKey: 'diagnosis',
      actionText: '발급한 설문의 제출 응답을 확인합니다.',
      reason: '응답이 제출되어야 진단 결과를 만들 수 있습니다.',
      actionLabel: '응답 확인하기',
      actionPath: `/diagnosis/projects/${id}/surveys`,
      needsAction: true,
    }
  }

  if (analysisLc !== 'finalized') {
    return {
      ...base,
      currentStepKey: 'diagnosis',
      actionText: '제출된 응답으로 진단 결과를 만듭니다.',
      reason: '대표자와 현장 답변을 비교해 AX 적합성을 계산합니다.',
      actionLabel: '진단 결과 만들기',
      actionPath: `/diagnosis/projects/${id}/analysis`,
      needsAction: true,
    }
  }

  const selectionLc = getProjectSelectionLifecycle(project)
  if (selectionLc !== 'finalized') {
    return {
      ...base,
      currentStepKey: 'selection',
      actionText: '진단 결과에서 먼저 만들 핵심 업무를 고릅니다.',
      reason: '1차 MVP는 하나의 핵심 업무에 집중합니다.',
      actionLabel: '핵심 업무 선택하기',
      actionPath: `/selection/projects/${id}`,
      needsAction: true,
    }
  }

  const designLc = getProjectDesignLifecycle(project)
  if (designLc !== 'finalized') {
    return {
      ...base,
      currentStepKey: 'design',
      actionText: '핵심 업무를 개발 가능한 기능·화면으로 설계합니다.',
      reason: '입력·처리·출력과 검증 기준을 정의합니다.',
      actionLabel: '기능 설계 시작하기',
      actionPath: `/mvp-design/projects/${id}`,
      needsAction: true,
    }
  }

  return {
    ...base,
    currentStepKey: 'validation',
    actionText: '확정된 설계를 현장에서 직접 써보며 검증합니다.',
    reason: '실제 사용 테스트로 효과를 확인합니다.',
    actionLabel: '설계 결과 확인하기',
    actionPath: `/mvp-design/projects/${id}/review`,
    needsAction: false,
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
