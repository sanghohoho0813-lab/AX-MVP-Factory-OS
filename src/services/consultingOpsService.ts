import type { ProjectStage, StatusTone } from '../types'
import type { Organization, Project } from '../types/domain'
import { getDDay } from '../lib/format'
import { PROJECT_STAGE_META } from '../lib/statusMeta'
import { getProjectProgress } from './projectProgressService'

export interface ConsultingOpsItem {
  id: string
  projectId: string
  organizationId: string
  clientName: string
  projectName: string
  stageLabel: string
  progressLabel: string
  progressPercent: number
  nextAction: string
  dueLabel: string
  daysLeft: number | null
  tone: StatusTone
  reason: string
}

export interface ConsultingOpsBrief {
  activeCount: number
  monthlyCapacityTarget: number
  capacityLabel: string
  focusLabel: string
  waitingClientCount: number
  overdueCount: number
  fundingPipelineCount: number
  deliverablePipelineCount: number
  urgentItems: ConsultingOpsItem[]
  clientWaitingItems: ConsultingOpsItem[]
  fundingItems: ConsultingOpsItem[]
  stageLoads: ConsultingOpsStageLoad[]
  recommendations: ConsultingOpsRecommendation[]
}

const MONTHLY_CAPACITY_TARGET = 5

export interface ConsultingOpsStageLoad {
  stage: ProjectStage
  label: string
  count: number
  riskCount: number
  waitingCount: number
  percent: number
  tone: StatusTone
}

export interface ConsultingOpsRecommendation {
  id: string
  title: string
  detail: string
  tone: StatusTone
}

export type ConsultingActionLane =
  | 'recover'
  | 'client'
  | 'funding'
  | 'advance'
  | 'protect'

export interface ConsultingDailyAction {
  id: string
  projectId: string
  organizationId: string
  clientName: string
  projectName: string
  lane: ConsultingActionLane
  title: string
  detail: string
  stageLabel: string
  dueLabel: string
  estimatedMinutes: number
  priority: number
  tone: StatusTone
  path: string
  script: string
  checklist: string[]
  completed: boolean
}

export interface ConsultingTimeBlock {
  id: string
  label: string
  timeLabel: string
  intent: string
  actionIds: string[]
  totalMinutes: number
  tone: StatusTone
}

export interface ConsultingDailyPlan {
  dateLabel: string
  workModeLabel: string
  plannedMinutes: number
  completedMinutes: number
  completionPercent: number
  headline: string
  actions: ConsultingDailyAction[]
  timeBlocks: ConsultingTimeBlock[]
}

function orgNameById(organizations: Organization[], organizationId: string): string {
  return organizations.find((org) => org.id === organizationId)?.name ?? '알 수 없는 고객사'
}

function toneForProject(project: Project, daysLeft: number | null): StatusTone {
  if (project.healthStatus === 'risk') return 'danger'
  if (daysLeft !== null && daysLeft < 0) return 'danger'
  if (project.healthStatus === 'attention') return 'warning'
  if (daysLeft !== null && daysLeft <= 3) return 'warning'
  if (project.status === 'waiting_client') return 'warning'
  return 'info'
}

function reasonForProject(project: Project, daysLeft: number | null): string {
  if (project.status === 'waiting_client') return '고객 답변이 다음 단계 진행을 막고 있습니다'
  if (project.healthStatus === 'risk') return project.riskSummary || '위험 표시된 프로젝트라 직접 점검이 필요합니다'
  if (daysLeft !== null && daysLeft < 0) return '다음 행동 마감일이 지났습니다'
  if (daysLeft !== null && daysLeft <= 3) return '이번 주 안에 처리해야 할 다음 행동입니다'
  if (project.fundingRequired) return '정책자금 트랙이 함께 진행 중입니다'
  return '컨설팅 흐름을 계속 이어가야 합니다'
}

function toOpsItem(project: Project, organizations: Organization[]): ConsultingOpsItem {
  const progress = getProjectProgress(project)
  const dday = getDDay(project.nextActionDueDate)
  const daysLeft = dday?.daysLeft ?? null

  return {
    id: `${project.id}-ops`,
    projectId: project.id,
    organizationId: project.organizationId,
    clientName: orgNameById(organizations, project.organizationId),
    projectName: project.name,
    stageLabel: progress.currentStep.label,
    progressLabel: progress.stepText,
    progressPercent: progress.percent,
    nextAction: project.nextAction || progress.nextAction.title,
    dueLabel: dday?.label ?? '마감일 없음',
    daysLeft,
    tone: toneForProject(project, daysLeft),
    reason: reasonForProject(project, daysLeft),
  }
}

function sortByOperationalRisk(a: ConsultingOpsItem, b: ConsultingOpsItem): number {
  const aDays = a.daysLeft ?? 999
  const bDays = b.daysLeft ?? 999
  const toneRank: Record<StatusTone, number> = {
    danger: 0,
    warning: 1,
    accent: 2,
    info: 3,
    success: 4,
    neutral: 5,
  }
  return toneRank[a.tone] - toneRank[b.tone] || aDays - bDays
}

function actionLaneFor(project: Project, item: ConsultingOpsItem): ConsultingActionLane {
  if (item.daysLeft !== null && item.daysLeft < 0) return 'recover'
  if (project.healthStatus === 'risk') return 'recover'
  if (project.status === 'waiting_client') return 'client'
  if (project.fundingRequired) return 'funding'
  if (item.daysLeft !== null && item.daysLeft <= 3) return 'advance'
  return 'protect'
}

function laneTone(lane: ConsultingActionLane, fallback: StatusTone): StatusTone {
  if (lane === 'recover') return 'danger'
  if (lane === 'client') return 'warning'
  if (lane === 'funding') return 'accent'
  if (lane === 'advance') return 'info'
  return fallback
}

function laneEstimate(lane: ConsultingActionLane): number {
  if (lane === 'recover') return 45
  if (lane === 'client') return 20
  if (lane === 'funding') return 35
  if (lane === 'advance') return 30
  return 25
}

function actionTitle(item: ConsultingOpsItem, lane: ConsultingActionLane): string {
  if (lane === 'recover') return item.nextAction || '막힌 다음 행동 정리'
  if (lane === 'client') return `${item.clientName} 회신 리마인드`
  if (lane === 'funding') return `${item.clientName} 정책자금 자료 상태 점검`
  if (lane === 'advance') return item.nextAction || `${item.stageLabel} 단계 전환`
  return `${item.clientName} 진행 상태 업데이트`
}

function actionDetail(project: Project, item: ConsultingOpsItem, lane: ConsultingActionLane): string {
  if (lane === 'recover') return project.riskSummary || item.reason
  if (lane === 'client') return '고객에게 필요한 자료와 답변 기한을 한 번에 정리해서 보냅니다.'
  if (lane === 'funding') return '대상 기관, 예상 금액, 부족 자료를 확인해 제출자료 단계로 넘길 준비를 합니다.'
  if (lane === 'advance') return `${item.stageLabel} 단계의 다음 전환 조건을 닫습니다.`
  return '진행률, 다음 행동, 마감일이 실제 상황과 맞는지 점검합니다.'
}

function actionScript(project: Project, item: ConsultingOpsItem, lane: ConsultingActionLane): string {
  if (lane === 'client') {
    return `${item.clientName} 담당자님, 안녕하세요. ${project.name} 진행을 위해 ${item.nextAction} 확인이 필요합니다. 가능하시면 오늘 중 회신 부탁드립니다. 회신 주시면 바로 다음 단계로 이어가겠습니다.`
  }
  if (lane === 'funding') {
    return `${item.clientName} 정책자금 검토 메모: 대상 기관은 ${project.targetInstitutions.join(', ') || '미정'}이고, 목표 금액은 ${project.targetFundingAmount ? project.targetFundingAmount.toLocaleString('ko-KR') + '원' : '미정'}입니다. 부족 자료와 제출 가능 일정을 확인합니다.`
  }
  if (lane === 'recover') {
    return `${item.clientName} 병목 해소 메모: 현재 이슈는 "${item.reason}"입니다. 오늘 안에 다음 행동 "${item.nextAction}"을 닫고 새 마감일을 지정합니다.`
  }
  return `${item.clientName} 진행 메모: ${project.name}의 현재 단계는 ${item.stageLabel}입니다. 다음 행동은 "${item.nextAction}"입니다.`
}

function actionChecklist(lane: ConsultingActionLane): string[] {
  if (lane === 'client') return ['필요 답변 1문장으로 정리', '자료 요청 항목 번호 붙이기', '회신 기한 지정']
  if (lane === 'funding') return ['대상 기관 확인', '부족 증빙 표시', '사업계획서 반영 항목 정리']
  if (lane === 'recover') return ['막힌 원인 확인', '오늘 닫을 행동 하나 선택', '새 마감일 또는 담당자 지정']
  if (lane === 'advance') return ['현재 단계 완료 조건 확인', '다음 화면 또는 자료 열기', '완료 여부 기록']
  return ['진행률 확인', '다음 행동 최신화', '위험 메모 정리']
}

function actionPath(project: Project): string {
  if (project.status === 'waiting_client') return `/projects/${project.id}`
  if (project.fundingRequired) return `/funding/projects/${project.id}`
  if (project.currentStage === 'diagnosis') return `/diagnosis/projects/${project.id}/setup`
  if (project.currentStage === 'selection') return `/selection/projects/${project.id}`
  if (project.currentStage === 'mvp_design') return `/mvp-design/projects/${project.id}`
  if (project.currentStage === 'website_design') return `/website-studio/projects/${project.id}`
  if (project.currentStage === 'validation') return `/validation/projects/${project.id}`
  if (project.currentStage === 'deliverables') return `/deliverables/projects/${project.id}`
  return `/projects/${project.id}`
}

function buildDailyActions(
  projects: Project[],
  organizations: Organization[],
  completedActionIds: Set<string>,
): ConsultingDailyAction[] {
  const activeProjects = projects.filter(
    (project) => project.status !== 'completed' && project.status !== 'archived',
  )
  return activeProjects
    .map((project) => {
      const item = toOpsItem(project, organizations)
      const lane = actionLaneFor(project, item)
      const priorityBase =
        lane === 'recover'
          ? 0
          : lane === 'client'
            ? 10
            : lane === 'funding'
              ? 20
              : lane === 'advance'
                ? 30
                : 40
      const dayRank = item.daysLeft ?? 99
      const id = `daily-${project.id}-${lane}`
      return {
        id,
        projectId: project.id,
        organizationId: project.organizationId,
        clientName: item.clientName,
        projectName: project.name,
        lane,
        title: actionTitle(item, lane),
        detail: actionDetail(project, item, lane),
        stageLabel: item.stageLabel,
        dueLabel: item.dueLabel,
        estimatedMinutes: laneEstimate(lane),
        priority: priorityBase + Math.max(dayRank, -10),
        tone: laneTone(lane, item.tone),
        path: actionPath(project),
        script: actionScript(project, item, lane),
        checklist: actionChecklist(lane),
        completed: completedActionIds.has(id),
      } satisfies ConsultingDailyAction
    })
    .sort((a, b) => Number(a.completed) - Number(b.completed) || a.priority - b.priority)
    .slice(0, 8)
}

function buildTimeBlocks(actions: ConsultingDailyAction[]): ConsultingTimeBlock[] {
  const recoveryIds = actions
    .filter((action) => action.lane === 'recover' || action.lane === 'client')
    .slice(0, 3)
    .map((action) => action.id)
  const progressIds = actions
    .filter((action) => action.lane === 'advance' || action.lane === 'funding')
    .slice(0, 3)
    .map((action) => action.id)
  const protectIds = actions
    .filter((action) => !recoveryIds.includes(action.id) && !progressIds.includes(action.id))
    .slice(0, 2)
    .map((action) => action.id)

  const minutesFor = (ids: string[]) =>
    actions
      .filter((action) => ids.includes(action.id))
      .reduce((sum, action) => sum + action.estimatedMinutes, 0)

  return [
    {
      id: 'morning-recovery',
      label: '오전 회복 블록',
      timeLabel: '09:30-11:30',
      intent: '마감 초과, 고객 답변 대기, 위험 프로젝트를 먼저 닫습니다.',
      actionIds: recoveryIds,
      totalMinutes: minutesFor(recoveryIds),
      tone: recoveryIds.length > 0 ? 'warning' : 'neutral',
    },
    {
      id: 'afternoon-progress',
      label: '오후 전환 블록',
      timeLabel: '13:30-15:30',
      intent: '정책자금, 설계, 검증처럼 산출물 전환이 필요한 일을 처리합니다.',
      actionIds: progressIds,
      totalMinutes: minutesFor(progressIds),
      tone: progressIds.length > 0 ? 'info' : 'neutral',
    },
    {
      id: 'closing-protect',
      label: '마감 전 보호 블록',
      timeLabel: '16:30-17:30',
      intent: '진행률과 다음 행동을 업데이트해 내일의 누락을 줄입니다.',
      actionIds: protectIds,
      totalMinutes: minutesFor(protectIds),
      tone: protectIds.length > 0 ? 'success' : 'neutral',
    },
  ]
}

function todayLabel(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())
}

export function buildConsultingDailyPlan(
  projects: Project[],
  organizations: Organization[],
  completedActionIds: string[] = [],
): ConsultingDailyPlan {
  const completed = new Set(completedActionIds)
  const actions = buildDailyActions(projects, organizations, completed)
  const plannedMinutes = actions.reduce((sum, action) => sum + action.estimatedMinutes, 0)
  const completedMinutes = actions
    .filter((action) => action.completed)
    .reduce((sum, action) => sum + action.estimatedMinutes, 0)
  const criticalCount = actions.filter((action) => !action.completed && action.tone === 'danger').length
  const clientCount = actions.filter((action) => !action.completed && action.lane === 'client').length
  const completionPercent = plannedMinutes > 0 ? Math.round((completedMinutes / plannedMinutes) * 100) : 0
  const headline =
    criticalCount > 0
      ? `오늘은 위험 ${criticalCount}건부터 닫으세요`
      : clientCount > 0
        ? `고객 회신 ${clientCount}건을 먼저 회수하세요`
        : '오늘은 전환 작업에 집중해도 좋습니다'

  return {
    dateLabel: todayLabel(),
    workModeLabel: plannedMinutes > 240 ? '집중 운영일' : plannedMinutes > 120 ? '표준 운영일' : '가벼운 점검일',
    plannedMinutes,
    completedMinutes,
    completionPercent,
    headline,
    actions,
    timeBlocks: buildTimeBlocks(actions),
  }
}

function buildStageLoads(activeProjects: Project[]): ConsultingOpsStageLoad[] {
  const total = Math.max(activeProjects.length, 1)
  const stages = new Map<ProjectStage, Project[]>()
  for (const project of activeProjects) {
    const group = stages.get(project.currentStage) ?? []
    group.push(project)
    stages.set(project.currentStage, group)
  }

  return Array.from(stages.entries())
    .map(([stage, stageProjects]) => {
      const riskCount = stageProjects.filter((project) => project.healthStatus === 'risk').length
      const waitingCount = stageProjects.filter((project) => project.status === 'waiting_client').length
      return {
        stage,
        label: PROJECT_STAGE_META[stage].label,
        count: stageProjects.length,
        riskCount,
        waitingCount,
        percent: Math.round((stageProjects.length / total) * 100),
        tone: riskCount > 0 ? 'danger' : waitingCount > 0 ? 'warning' : PROJECT_STAGE_META[stage].tone,
      }
    })
    .sort((a, b) => b.count - a.count || b.riskCount - a.riskCount)
}

function buildRecommendations(
  activeCount: number,
  waitingClientCount: number,
  overdueCount: number,
  fundingPipelineCount: number,
  deliverablePipelineCount: number,
  stageLoads: ConsultingOpsStageLoad[],
): ConsultingOpsRecommendation[] {
  const recommendations: ConsultingOpsRecommendation[] = []
  const biggestLoad = stageLoads[0]

  if (overdueCount > 0) {
    recommendations.push({
      id: 'clear-overdue',
      title: '오늘은 마감 초과부터 정리',
      detail: `${overdueCount}건이 기한을 넘겼습니다. 신규 상담보다 기존 프로젝트의 다음 행동을 먼저 닫는 편이 안전합니다.`,
      tone: 'danger',
    })
  }

  if (waitingClientCount > 0) {
    recommendations.push({
      id: 'client-reminder',
      title: '고객 회신 리마인드 묶음 처리',
      detail: `${waitingClientCount}건이 고객 답변 대기입니다. 오전에 한 번에 리마인드하면 오후 작업 슬롯을 되찾을 수 있습니다.`,
      tone: 'warning',
    })
  }

  if (activeCount >= MONTHLY_CAPACITY_TARGET) {
    recommendations.push({
      id: 'capacity-full',
      title: '이번 달 신규 수임은 보수적으로',
      detail: `현재 ${activeCount}건이 열려 있습니다. 5건 이상부터는 병목 해소 없이는 품질 저하 위험이 커집니다.`,
      tone: 'warning',
    })
  } else {
    recommendations.push({
      id: 'capacity-open',
      title: '신규 상담 여지 있음',
      detail: `현재 ${activeCount}건 진행 중입니다. 병목 큐를 정리하면 이번 달 ${MONTHLY_CAPACITY_TARGET - activeCount}건까지 추가 여지가 있습니다.`,
      tone: 'info',
    })
  }

  if (fundingPipelineCount > 0 && deliverablePipelineCount === 0) {
    recommendations.push({
      id: 'funding-materials',
      title: '정책자금 자료화 선행 필요',
      detail: '정책자금 트랙은 열려 있지만 결과자료 단계 프로젝트가 없습니다. 진단/설계 산출물을 제출자료로 묶는 흐름을 앞당기세요.',
      tone: 'accent',
    })
  }

  if (biggestLoad && biggestLoad.count >= 2) {
    recommendations.push({
      id: 'stage-bottleneck',
      title: `${biggestLoad.label} 단계에 작업 쏠림`,
      detail: `${biggestLoad.count}건이 같은 단계에 있습니다. 같은 유형의 회의, 검토, 자료 요청을 묶어서 처리하면 전환 속도가 빨라집니다.`,
      tone: biggestLoad.tone,
    })
  }

  return recommendations.slice(0, 3)
}

export function buildConsultingOpsBrief(
  projects: Project[],
  organizations: Organization[],
): ConsultingOpsBrief {
  const activeProjects = projects.filter(
    (project) => project.status !== 'completed' && project.status !== 'archived',
  )
  const items = activeProjects.map((project) => toOpsItem(project, organizations))
  const urgentItems = items
    .filter((item) => item.tone === 'danger' || item.tone === 'warning')
    .sort(sortByOperationalRisk)
    .slice(0, 5)
  const clientWaitingItems = items
    .filter((item) => activeProjects.find((p) => p.id === item.projectId)?.status === 'waiting_client')
    .sort(sortByOperationalRisk)
    .slice(0, 4)
  const fundingItems = items
    .filter((item) => Boolean(activeProjects.find((p) => p.id === item.projectId)?.fundingRequired))
    .sort(sortByOperationalRisk)
    .slice(0, 4)
  const overdueCount = items.filter((item) => item.daysLeft !== null && item.daysLeft < 0).length
  const waitingClientCount = activeProjects.filter((project) => project.status === 'waiting_client').length
  const fundingPipelineCount = activeProjects.filter((project) => project.fundingRequired).length
  const deliverablePipelineCount = activeProjects.filter(
    (project) => project.currentStage === 'deliverables',
  ).length
  const stageLoads = buildStageLoads(activeProjects)
  const remainingCapacity = Math.max(MONTHLY_CAPACITY_TARGET - activeProjects.length, 0)
  const focusLabel =
    overdueCount > 0
      ? '마감 초과 해소'
      : waitingClientCount > 0
        ? '고객 답변 회수'
        : fundingPipelineCount > 0
          ? '정책자금 자료화'
          : '신규 상담 가능'

  return {
    activeCount: activeProjects.length,
    monthlyCapacityTarget: MONTHLY_CAPACITY_TARGET,
    capacityLabel:
      remainingCapacity > 0
        ? `이번 달 ${remainingCapacity}건 추가 가능`
        : '처리 용량 가득 참. 병목부터 해소',
    focusLabel,
    waitingClientCount,
    overdueCount,
    fundingPipelineCount,
    deliverablePipelineCount,
    urgentItems,
    clientWaitingItems,
    fundingItems,
    stageLoads,
    recommendations: buildRecommendations(
      activeProjects.length,
      waitingClientCount,
      overdueCount,
      fundingPipelineCount,
      deliverablePipelineCount,
      stageLoads,
    ),
  }
}
