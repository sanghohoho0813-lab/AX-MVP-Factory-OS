/**
 * 프로젝트 진행상태 단일 기준 (Stage 12B-UX 5차).
 *
 * 모든 화면(홈·고객사 상세·프로젝트 목록·컨트롤 센터·컨텍스트 바)은
 * 이 서비스의 결과만 사용한다. 화면별 임의 계산·하드코딩 진행률 금지.
 *
 * 판정 원칙: 실제 Repository 데이터 존재 + 확정 상태 기준.
 *  - 진단 완료   = 제출 응답 존재 + AssessmentResult finalized
 *  - 업무 선택   = SelectionDecision finalized + SelectionHandoffSnapshot 존재
 *  - AX 설계     = MvpDesign finalized + 인계 스냅샷 존재
 *  - 홈페이지    = WebsiteDesign finalized + 인계 스냅샷 존재
 *  - 결과자료    = DeliverablePackage finalized 존재
 * 실제 사용 테스트·기관 연계·사례는 핵심 진행률에 포함하지 않는다(고급 운영).
 */

import type { Project } from '../types/domain'
import {
  assessmentRepository,
  automationCandidateRepository,
  deliverablePackageRepository,
  mvpDesignHandoffRepository,
  mvpDesignRepository,
  organizationRepository,
  selectionDecisionRepository,
  selectionHandoffRepository,
  surveyResponseRepository,
  websiteDesignHandoffRepository,
  websiteDesignRepository,
} from '../repositories'
import { hasReadyBlueprint } from './projectSurveyService'

/* ------------------------------------------------------------------ */
/* 타입                                                                 */
/* ------------------------------------------------------------------ */

export type CoreStepKey =
  | 'prepare'
  | 'diagnosis'
  | 'selection'
  | 'ax_design'
  | 'website_design'
  | 'deliverables'

/** 화면 공통 단계 상태 (§9) */
export type StepViewState =
  | 'completed'
  | 'in_progress'
  | 'ready'
  | 'blocked_by_prerequisite'

export const STEP_STATE_LABEL: Record<StepViewState, string> = {
  completed: '완료',
  in_progress: '진행 중',
  ready: '시작 가능',
  blocked_by_prerequisite: '이전 단계가 필요함',
}

export interface ProgressStep {
  key: CoreStepKey
  label: string
  state: StepViewState
  /** 왜 이 상태인지·무엇이 필요한지 (잠긴 경우 필수) */
  detail: string
  path: string
}

export interface ProjectNextAction {
  /** 지금 해야 할 일 (제목) */
  title: string
  /** 왜 필요한지 한 줄 */
  reason: string
  /** 행동 버튼 문구 */
  buttonLabel: string
  path: string
}

export interface ProjectProgress {
  steps: ProgressStep[]
  completedCount: number
  totalCount: number
  /** "n / N단계" */
  stepText: string
  /** 완료 단계 ÷ 전체 단계만 사용 (임의 퍼센트 금지) */
  percent: number
  /** 첫 미완료 단계 (모두 완료 시 마지막 단계) */
  currentStep: ProgressStep
  nextAction: ProjectNextAction
  allCompleted: boolean
  /** Guided Demo 샘플 프로젝트 여부 */
  isSample: boolean
}

/** 순수 계산 입력 — 리포지토리에서 수집한 실제 데이터 여부 */
export interface ProgressInputs {
  projectId: string
  projectType: 'ax' | 'website' | 'ax_website'
  /** 고객사·프로젝트·유형·목표 존재 */
  prepared: boolean
  submittedResponseCount: number
  blueprintReady: boolean
  assessmentExists: boolean
  assessmentFinalized: boolean
  selectionStarted: boolean
  selectionFinalized: boolean
  axDesignStarted: boolean
  axDesignFinalized: boolean
  websiteStarted: boolean
  websiteFinalized: boolean
  deliverableStarted: boolean
  deliverableFinalized: boolean
  isSample: boolean
}

/* ------------------------------------------------------------------ */
/* 순수 계산 (단위 테스트 대상)                                          */
/* ------------------------------------------------------------------ */

const STEP_LABEL: Record<CoreStepKey, string> = {
  prepare: '프로젝트 준비',
  diagnosis: '기업 진단',
  selection: '만들 업무 선택',
  ax_design: 'AX 기능·화면 설계',
  website_design: '홈페이지 설계',
  deliverables: '결과자료',
}

function stepKeysFor(projectType: ProgressInputs['projectType']): CoreStepKey[] {
  if (projectType === 'website') return ['prepare', 'website_design', 'deliverables']
  if (projectType === 'ax_website')
    return ['prepare', 'diagnosis', 'selection', 'ax_design', 'website_design', 'deliverables']
  return ['prepare', 'diagnosis', 'selection', 'ax_design', 'deliverables']
}

export function deriveProjectProgress(i: ProgressInputs): ProjectProgress {
  const id = i.projectId
  const keys = stepKeysFor(i.projectType)

  const completedOf: Record<CoreStepKey, boolean> = {
    prepare: i.prepared,
    diagnosis: i.submittedResponseCount > 0 && i.assessmentFinalized,
    selection: i.selectionFinalized,
    ax_design: i.axDesignFinalized,
    website_design: i.websiteFinalized,
    deliverables: i.deliverableFinalized,
  }
  const startedOf: Record<CoreStepKey, boolean> = {
    prepare: true,
    diagnosis: i.blueprintReady || i.submittedResponseCount > 0 || i.assessmentExists,
    selection: i.selectionStarted,
    ax_design: i.axDesignStarted,
    website_design: i.websiteStarted,
    deliverables: i.deliverableStarted,
  }
  // 각 단계 잠금 조건 (선행 단계 확정 기준)
  const anyDesignDone =
    i.projectType === 'website'
      ? i.websiteFinalized
      : i.projectType === 'ax_website'
        ? i.axDesignFinalized || i.websiteFinalized
        : i.axDesignFinalized
  const unlockedOf: Record<CoreStepKey, boolean> = {
    prepare: true,
    diagnosis: i.prepared,
    selection: i.assessmentFinalized,
    ax_design: i.selectionFinalized,
    // 홈페이지 설계: 홈페이지 단독은 준비 후 바로, AX+홈페이지는 업무 선택 후
    website_design: i.projectType === 'website' ? i.prepared : i.selectionFinalized,
    // 결과자료: 확정된 진단 또는 설계 결과가 있어야 의미 있음
    deliverables: i.assessmentFinalized || anyDesignDone,
  }
  const blockedDetail: Record<CoreStepKey, string> = {
    prepare: '',
    diagnosis: '고객사·프로젝트 정보를 먼저 완성하세요.',
    selection: '확정된 진단 결과가 있어야 업무를 비교·선택할 수 있습니다.',
    ax_design: '먼저 만들 업무가 아직 확정되지 않았습니다. 만들 업무를 선택하면 설계를 시작할 수 있습니다.',
    website_design:
      i.projectType === 'website'
        ? '프로젝트 정보를 먼저 완성하세요.'
        : '먼저 만들 업무를 확정하면 홈페이지 설계도 함께 진행할 수 있습니다.',
    deliverables: '결과자료에 담을 확정 결과가 아직 없습니다. 진단 또는 설계 결과를 확정하면 자료를 만들 수 있습니다.',
  }
  const pathOf: Record<CoreStepKey, string> = {
    prepare: `/projects/${id}`,
    diagnosis: `/diagnosis/projects/${id}/setup`,
    selection: `/selection/projects/${id}`,
    ax_design: `/mvp-design/projects/${id}`,
    website_design: `/website-studio/projects/${id}`,
    deliverables: `/deliverables/projects/${id}`,
  }

  const steps: ProgressStep[] = keys.map((key) => {
    let state: StepViewState
    let detail = ''
    if (completedOf[key]) {
      state = 'completed'
      detail = '완료되었습니다.'
    } else if (!unlockedOf[key]) {
      state = 'blocked_by_prerequisite'
      detail = blockedDetail[key]
    } else if (startedOf[key]) {
      state = 'in_progress'
      detail = inProgressDetail(key, i)
    } else {
      state = 'ready'
      detail = readyDetail(key, i)
    }
    return { key, label: STEP_LABEL[key], state, detail, path: pathOf[key] }
  })

  const completedCount = steps.filter((s) => s.state === 'completed').length
  const totalCount = steps.length
  const allCompleted = completedCount === totalCount
  const currentStep = steps.find((s) => s.state !== 'completed') ?? steps[steps.length - 1]
  const percent = Math.round((completedCount / totalCount) * 100)

  return {
    steps,
    completedCount,
    totalCount,
    stepText: `${completedCount} / ${totalCount}단계`,
    percent,
    currentStep,
    nextAction: buildNextAction(currentStep, allCompleted, i),
    allCompleted,
    isSample: i.isSample,
  }
}

function inProgressDetail(key: CoreStepKey, i: ProgressInputs): string {
  switch (key) {
    case 'diagnosis':
      if (i.submittedResponseCount === 0) return '설문이 준비되었습니다. 응답이 제출되면 진단 결과를 만들 수 있습니다.'
      if (!i.assessmentExists) return `제출 응답 ${i.submittedResponseCount}건 — 진단 결과를 만들 수 있습니다.`
      return '진단 결과 초안이 있습니다. 검토 후 확정하세요.'
    case 'selection':
      return '후보 업무가 있습니다. 첫 번째로 만들 업무를 확정하세요.'
    case 'ax_design':
      return '설계 초안이 있습니다. 검토 후 확정하세요.'
    case 'website_design':
      return '홈페이지 설계 초안이 있습니다. 검토 후 확정하세요.'
    case 'deliverables':
      return '자료 초안이 있습니다. 검토 후 확정하세요.'
    default:
      return '진행 중입니다.'
  }
}

function readyDetail(key: CoreStepKey, i: ProgressInputs): string {
  switch (key) {
    case 'prepare':
      return '고객사·프로젝트 정보를 완성하세요.'
    case 'diagnosis':
      return '진단 설문을 구성하고 대표자·현장 담당자의 응답을 받으세요.'
    case 'selection':
      return '진단 결과에서 먼저 만들 업무를 비교·선택하세요.'
    case 'ax_design':
      return '확정한 핵심 업무로 기능·화면 설계를 시작하세요.'
    case 'website_design':
      return i.projectType === 'website'
        ? '홈페이지 목표·구조·디자인 방향을 설계하세요.'
        : '핵심 업무와 함께 홈페이지 설계를 진행할 수 있습니다.'
    case 'deliverables':
      return '확정 결과로 고객·개발자·기관용 자료를 만들 수 있습니다.'
    default:
      return ''
  }
}

function buildNextAction(step: ProgressStep, allCompleted: boolean, i: ProgressInputs): ProjectNextAction {
  const id = i.projectId
  if (allCompleted) {
    return {
      title: '핵심 단계를 모두 완료했습니다.',
      reason: '결과자료를 전달하거나, 고급 운영 기능(실제 사용 테스트·기관 연계)을 사용할 수 있습니다.',
      buttonLabel: '결과자료 확인하기',
      path: `/deliverables/projects/${id}`,
    }
  }
  switch (step.key) {
    case 'prepare':
      return {
        title: '고객사·프로젝트 정보를 완성합니다.',
        reason: '프로젝트 유형과 목표가 있어야 다음 단계를 안내할 수 있습니다.',
        buttonLabel: '프로젝트 정보 완성하기',
        path: step.path,
      }
    case 'diagnosis':
      if (i.submittedResponseCount === 0 && !i.blueprintReady) {
        return {
          title: '대표자·현장 담당자에게 보낼 진단 설문을 구성합니다.',
          reason: '설문 링크를 만들고 응답을 받아야 진단 결과를 만들 수 있습니다.',
          buttonLabel: '설문 구성하기',
          path: `/diagnosis/projects/${id}/setup`,
        }
      }
      if (i.submittedResponseCount === 0) {
        return {
          title: '발급한 설문의 응답 제출을 확인합니다.',
          reason: '응답이 제출되어야 진단 결과를 만들 수 있습니다.',
          buttonLabel: '응답 확인하기',
          path: `/diagnosis/projects/${id}/surveys`,
        }
      }
      return {
        title: '제출된 응답으로 진단 결과를 만들고 확정합니다.',
        reason: '역할별 답변을 비교해 AX 적합성과 핵심 문제를 계산합니다.',
        buttonLabel: '진단 결과 만들기',
        path: `/diagnosis/projects/${id}/analysis`,
      }
    case 'selection':
      return {
        title: '진단 결과에서 먼저 만들 업무를 확정합니다.',
        reason: '1차 MVP는 하나의 핵심 업무에 집중합니다.',
        buttonLabel: '만들 업무 선택하기',
        path: step.path,
      }
    case 'ax_design':
      return {
        title: '확정한 핵심 업무를 기능·화면으로 설계합니다.',
        reason: '개발 가능한 기능·화면·데이터 구조를 정의합니다.',
        buttonLabel: 'AX 설계 시작하기',
        path: step.path,
      }
    case 'website_design':
      return {
        title: '홈페이지 구조·콘텐츠·디자인 방향을 설계합니다.',
        reason: '홈페이지 목적과 고객 행동을 기준으로 설계안을 만듭니다.',
        buttonLabel: '홈페이지 설계하기',
        path: step.path,
      }
    case 'deliverables':
      return {
        title: '확정 결과를 전달용 자료로 정리합니다.',
        reason: '고객·개발자·기관에 보낼 자료와 개발 지시문을 만듭니다.',
        buttonLabel: '결과자료 만들기',
        path: step.path,
      }
    default:
      return { title: '', reason: '', buttonLabel: '', path: step.path }
  }
}

/* ------------------------------------------------------------------ */
/* 실제 데이터 수집                                                      */
/* ------------------------------------------------------------------ */

/** Guided Demo가 사용하는 샘플 프로젝트 (proj-101: AX, proj-102: 홈페이지) */
const SAMPLE_PROJECT_IDS = new Set(['proj-101', 'proj-102'])

export function isSampleProject(projectId: string): boolean {
  return SAMPLE_PROJECT_IDS.has(projectId)
}

export function collectProgressInputs(project: Project): ProgressInputs {
  const id = project.id
  const org = organizationRepository.getById(project.organizationId)
  const submitted = surveyResponseRepository.search({ projectId: id, status: 'submitted' })
  const assessment = assessmentRepository.getLatestByProjectId(id)
  const decision = selectionDecisionRepository.getLatestByProjectId(id)
  const decisionHandoff = decision ? selectionHandoffRepository.getBySelectionDecisionId(decision.id) : null
  const candidates = automationCandidateRepository.getByProjectId(id)
  const design = mvpDesignRepository.getLatestByProjectId(id)
  const designHandoff = design ? mvpDesignHandoffRepository.getByDesignId(design.id) : null
  const website = websiteDesignRepository.getLatestByProjectId(id)
  const websiteHandoff = website ? websiteDesignHandoffRepository.getByDesignId(website.id) : null
  const packages = deliverablePackageRepository.getByProjectId(id)

  return {
    projectId: id,
    projectType: project.projectType,
    prepared: Boolean(org && project.projectType && project.objective.trim() !== ''),
    submittedResponseCount: submitted.length,
    blueprintReady: hasReadyBlueprint(id),
    assessmentExists: assessment !== null,
    assessmentFinalized: assessment?.status === 'finalized',
    selectionStarted: candidates.length > 0 || decision !== null,
    selectionFinalized: decision?.status === 'finalized' && decisionHandoff !== null,
    axDesignStarted: design !== null,
    axDesignFinalized: design?.status === 'finalized' && designHandoff !== null,
    websiteStarted: website !== null,
    websiteFinalized: website?.status === 'finalized' && websiteHandoff !== null,
    deliverableStarted: packages.length > 0,
    deliverableFinalized: packages.some((p) => p.status === 'finalized'),
    isSample: isSampleProject(id),
  }
}

/** 프로젝트의 실제 진행상태 — 모든 화면 공통 기준 */
export function getProjectProgress(project: Project): ProjectProgress {
  return deriveProjectProgress(collectProgressInputs(project))
}
