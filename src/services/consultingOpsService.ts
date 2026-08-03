import type { StatusTone } from '../types'
import type { Organization, Project } from '../types/domain'
import { getDDay } from '../lib/format'
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
  waitingClientCount: number
  overdueCount: number
  fundingPipelineCount: number
  deliverablePipelineCount: number
  urgentItems: ConsultingOpsItem[]
  clientWaitingItems: ConsultingOpsItem[]
  fundingItems: ConsultingOpsItem[]
}

const MONTHLY_CAPACITY_TARGET = 5

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
  const remainingCapacity = Math.max(MONTHLY_CAPACITY_TARGET - activeProjects.length, 0)

  return {
    activeCount: activeProjects.length,
    monthlyCapacityTarget: MONTHLY_CAPACITY_TARGET,
    capacityLabel:
      remainingCapacity > 0
        ? `이번 달 ${remainingCapacity}건 추가 가능`
        : '처리 용량 가득 참. 병목부터 해소',
    waitingClientCount,
    overdueCount,
    fundingPipelineCount,
    deliverablePipelineCount,
    urgentItems,
    clientWaitingItems,
    fundingItems,
  }
}
