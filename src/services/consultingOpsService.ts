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
