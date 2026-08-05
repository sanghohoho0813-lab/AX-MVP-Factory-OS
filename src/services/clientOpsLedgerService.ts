import type { ProjectStage, StatusTone } from '../types'
import type { Organization, Project } from '../types/domain'
import { getDDay } from '../lib/format'
import { PROJECT_STAGE_META } from '../lib/statusMeta'
import {
  EMPTY_CLIENT_OPS_CHECKS,
  type ClientOpsCheckFlags,
  type ClientOpsCheckMap,
} from './clientOpsChecklistService'
import { getProjectProgress } from './projectProgressService'

export type ClientOpsTrackKey =
  | 'client_reply'
  | 'funding'
  | 'business_plan'
  | 'mid_check'
  | 'deliverables'

export type ClientOpsFilter = 'all' | 'blocked' | 'funding' | 'plan' | 'due'

export interface ClientOpsTrack {
  key: ClientOpsTrackKey
  label: string
  value: number
  detail: string
  tone: StatusTone
}

export interface ClientOpsLedgerRow {
  id: string
  organizationId: string
  projectId: string | null
  clientName: string
  projectName: string
  stageLabel: string
  stage: ProjectStage | null
  progressPercent: number
  statusLabel: string
  dueLabel: string
  daysLeft: number | null
  ownerLabel: string
  primaryContact: string
  nextAction: string
  riskSummary: string
  bottleneck: string
  recommendedMove: string
  estimatedMinutes: number
  tone: StatusTone
  path: string
  checks: ClientOpsCheckFlags
  tracks: ClientOpsTrack[]
}

export interface ClientOpsLedgerSummary {
  clientCount: number
  blockedCount: number
  dueSoonCount: number
  fundingCount: number
  businessPlanCount: number
  estimatedMinutes: number
  focusLabel: string
  focusTone: StatusTone
}

export interface ClientOpsLedger {
  summary: ClientOpsLedgerSummary
  briefingScript: string
  rows: ClientOpsLedgerRow[]
}

const ACTIVE_PROJECT_STATUSES = new Set<Project['status']>([
  'planned',
  'active',
  'waiting_client',
  'on_hold',
])

function isActiveProject(project: Project): boolean {
  return project.archivedAt === null && ACTIVE_PROJECT_STATUSES.has(project.status)
}

function daysLeftFor(project: Project): number | null {
  return getDDay(project.nextActionDueDate)?.daysLeft ?? null
}

function projectUrgencyScore(project: Project): number {
  const daysLeft = daysLeftFor(project)
  const stageRank: Record<ProjectStage, number> = {
    intake: 9,
    diagnosis: 8,
    selection: 7,
    mvp_design: 6,
    website_design: 5,
    validation: 4,
    deliverables: 3,
    completed: 99,
  }
  const healthRank = project.healthStatus === 'risk' ? 0 : project.healthStatus === 'attention' ? 10 : 20
  const statusRank = project.status === 'waiting_client' ? 0 : project.status === 'on_hold' ? 5 : 10
  return healthRank + statusRank + Math.max(daysLeft ?? 30, -10) + stageRank[project.currentStage]
}

function pickPrimaryProject(projects: Project[]): Project | null {
  const active = projects.filter(isActiveProject)
  if (active.length === 0) return null
  return [...active].sort((a, b) => projectUrgencyScore(a) - projectUrgencyScore(b))[0]
}

function toneFor(project: Project | null, daysLeft: number | null): StatusTone {
  if (!project) return 'neutral'
  if (project.healthStatus === 'risk') return 'danger'
  if (daysLeft !== null && daysLeft < 0) return 'danger'
  if (project.status === 'waiting_client' || project.status === 'on_hold') return 'warning'
  if (daysLeft !== null && daysLeft <= 3) return 'warning'
  if (project.fundingRequired) return 'accent'
  return 'info'
}

function bottleneckFor(project: Project | null, daysLeft: number | null): string {
  if (!project) return '진행 중인 프로젝트 없음'
  if (project.status === 'waiting_client') return '고객 회신 대기'
  if (project.status === 'on_hold') return '보류 상태'
  if (project.healthStatus === 'risk') return project.riskSummary || '리스크 확인 필요'
  if (daysLeft !== null && daysLeft < 0) return '마감 초과'
  if (project.fundingRequired && project.currentStage !== 'deliverables') return '정책자금 자료 선행 필요'
  if (project.currentStage === 'deliverables') return '제출자료 확정 필요'
  return '정상 진행'
}

function recommendedMoveFor(project: Project | null, daysLeft: number | null): string {
  if (!project) return '새 프로젝트 등록 또는 상담 상태를 업데이트하세요.'
  if (project.status === 'waiting_client') return '필요 답변과 자료 요청을 한 메시지로 묶어 회신 기한을 지정하세요.'
  if (project.status === 'on_hold') return '보류 사유와 재개 조건을 한 줄로 정리하고 다음 점검일을 잡으세요.'
  if (project.healthStatus === 'risk') return '위험 메모를 기준으로 오늘 닫을 행동 하나와 새 마감일을 지정하세요.'
  if (daysLeft !== null && daysLeft < 0) return '지연된 다음 행동을 닫고 실제 가능한 새 일정을 다시 배정하세요.'
  if (project.fundingRequired) return '대상 기관, 부족 증빙, 사업계획서 반영 항목을 먼저 정리하세요.'
  if (project.currentStage === 'deliverables') return '고객용·개발자용·기관용 자료 범위를 나눠 확정하세요.'
  return project.nextAction || '다음 행동을 최신 상태로 업데이트하세요.'
}

function estimateMinutes(project: Project | null, daysLeft: number | null): number {
  if (!project) return 15
  if (project.healthStatus === 'risk' || (daysLeft !== null && daysLeft < 0)) return 45
  if (project.status === 'waiting_client') return 20
  if (project.fundingRequired) return 35
  if (project.currentStage === 'deliverables') return 40
  return 25
}

function actionPath(project: Project | null, organizationId: string): string {
  if (!project) return `/clients/${organizationId}`
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

function percentForProjectStage(project: Project | null, target: ClientOpsTrackKey): number {
  if (!project) return 0
  const stageOrder: ProjectStage[] = [
    'intake',
    'diagnosis',
    'selection',
    'mvp_design',
    'website_design',
    'validation',
    'deliverables',
    'completed',
  ]
  const index = stageOrder.indexOf(project.currentStage)
  const stagePercent = Math.max(0, Math.min(100, Math.round((index / (stageOrder.length - 1)) * 100)))
  if (target === 'business_plan') {
    if (!project.fundingRequired) return project.currentStage === 'deliverables' ? 80 : 50
    return project.currentStage === 'deliverables' || project.currentStage === 'completed'
      ? 75
      : Math.max(20, Math.min(65, stagePercent))
  }
  if (target === 'mid_check') {
    if (project.healthStatus === 'risk') return 20
    if (project.status === 'waiting_client' || project.status === 'on_hold') return 35
    return Math.max(45, Math.min(90, project.progress || stagePercent))
  }
  if (target === 'deliverables') {
    if (project.currentStage === 'deliverables') return 70
    if (project.currentStage === 'completed') return 100
    return Math.max(10, Math.min(60, stagePercent))
  }
  return stagePercent
}

function trackTone(value: number, blocked: boolean): StatusTone {
  if (blocked) return 'warning'
  if (value >= 75) return 'success'
  if (value >= 45) return 'info'
  return 'neutral'
}

function buildTracks(project: Project | null, checks: ClientOpsCheckFlags): ClientOpsTrack[] {
  const waiting = project?.status === 'waiting_client'
  const funding = Boolean(project?.fundingRequired)
  const clientReplyValue = project ? (checks.clientReplySent ? 70 : waiting ? 25 : 85) : 0
  const fundingValue = project
    ? funding
      ? Math.max(percentForProjectStage(project, 'business_plan'), checks.fundingContacted ? 60 : 0)
      : 100
    : 0
  const businessPlanValue = Math.max(percentForProjectStage(project, 'business_plan'), checks.businessPlanDrafted ? 70 : 0)
  const midCheckValue = Math.max(percentForProjectStage(project, 'mid_check'), checks.midCheckDone ? 80 : 0)
  const deliverableValue = percentForProjectStage(project, 'deliverables')

  return [
    {
      key: 'client_reply',
      label: '고객 회신',
      value: clientReplyValue,
      detail: checks.clientReplySent ? '요청 발송' : waiting ? '답변 회수 필요' : '진행 가능',
      tone: trackTone(clientReplyValue, waiting && !checks.clientReplySent),
    },
    {
      key: 'funding',
      label: '정책자금',
      value: fundingValue,
      detail: funding ? (checks.fundingContacted ? '기관 컨택' : '기관·증빙 확인') : '필수 아님',
      tone: funding ? 'accent' : 'neutral',
    },
    {
      key: 'business_plan',
      label: '사업계획서',
      value: businessPlanValue,
      detail: checks.businessPlanDrafted ? '초안 작성' : funding ? '자금자료 반영' : '기본 초안',
      tone: trackTone(businessPlanValue, false),
    },
    {
      key: 'mid_check',
      label: '중간점검',
      value: midCheckValue,
      detail: checks.midCheckDone ? '점검 완료' : project?.healthStatus === 'risk' ? '즉시 점검' : '진행 확인',
      tone: trackTone(midCheckValue, project?.healthStatus === 'risk' && !checks.midCheckDone),
    },
    {
      key: 'deliverables',
      label: '결과자료',
      value: deliverableValue,
      detail: project?.currentStage === 'deliverables' ? '확정 필요' : '준비 중',
      tone: trackTone(deliverableValue, false),
    },
  ]
}

function statusLabelFor(project: Project | null): string {
  if (!project) return '프로젝트 없음'
  if (project.status === 'waiting_client') return '고객 응답 대기'
  if (project.status === 'on_hold') return '보류'
  if (project.healthStatus === 'risk') return '리스크'
  if (project.healthStatus === 'attention') return '주의 필요'
  return '진행 중'
}

function rowMatchesFilter(row: ClientOpsLedgerRow, filter: ClientOpsFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'blocked') return row.tone === 'danger' || row.bottleneck !== '정상 진행'
  if (filter === 'funding') return row.tracks.some((track) => track.key === 'funding' && track.detail !== '필수 아님')
  if (filter === 'plan') return row.tracks.some((track) => track.key === 'business_plan' && track.value < 75)
  if (filter === 'due') return row.daysLeft !== null && row.daysLeft <= 3
  return true
}

function rowMatchesQuery(row: ClientOpsLedgerRow, query: string): boolean {
  if (!query) return true
  const normalized = query.trim().toLowerCase()
  return [
    row.clientName,
    row.projectName,
    row.primaryContact,
    row.nextAction,
    row.bottleneck,
    row.stageLabel,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalized)
}

function buildBriefingScript(rows: ClientOpsLedgerRow[], summary: ClientOpsLedgerSummary): string {
  if (rows.length === 0) return ''
  const header = [
    `[고객 운영 브리핑]`,
    `초점: ${summary.focusLabel}`,
    `관리 고객사 ${summary.clientCount}곳 / 병목·주의 ${summary.blockedCount}건 / 정책자금 ${summary.fundingCount}건 / 사업계획서 보강 ${summary.businessPlanCount}건`,
  ].join('\n')
  const body = rows
    .slice(0, 8)
    .map((row, index) =>
      [
        `${index + 1}. ${row.clientName} · ${row.projectName}`,
        `- 상태: ${row.statusLabel} / 병목: ${row.bottleneck} / 마감: ${row.dueLabel}`,
        `- 다음 행동: ${row.recommendedMove}`,
        `- 트랙: ${row.tracks.map((track) => `${track.label} ${track.value}%`).join(', ')}`,
      ].join('\n'),
    )
    .join('\n\n')
  return `${header}\n\n${body}`
}

export function buildClientOpsLedger(
  organizations: Organization[],
  projects: Project[],
  query = '',
  filter: ClientOpsFilter = 'all',
  checkMap: ClientOpsCheckMap = {},
): ClientOpsLedger {
  const rows = organizations
    .filter((organization) => organization.archivedAt === null)
    .map((organization) => {
      const organizationProjects = projects.filter((project) => project.organizationId === organization.id)
      const primaryProject = pickPrimaryProject(organizationProjects)
      const progress = primaryProject ? getProjectProgress(primaryProject) : null
      const dday = primaryProject ? getDDay(primaryProject.nextActionDueDate) : null
      const daysLeft = dday?.daysLeft ?? null
      const tone = toneFor(primaryProject, daysLeft)
      const checks = primaryProject ? (checkMap[primaryProject.id]?.checks ?? EMPTY_CLIENT_OPS_CHECKS) : EMPTY_CLIENT_OPS_CHECKS
      return {
        id: `${organization.id}-${primaryProject?.id ?? 'none'}`,
        organizationId: organization.id,
        projectId: primaryProject?.id ?? null,
        clientName: organization.name,
        projectName: primaryProject?.name ?? '프로젝트 없음',
        stageLabel: primaryProject ? PROJECT_STAGE_META[primaryProject.currentStage].label : '미등록',
        stage: primaryProject?.currentStage ?? null,
        progressPercent: progress?.percent ?? 0,
        statusLabel: statusLabelFor(primaryProject),
        dueLabel: dday?.label ?? '마감일 없음',
        daysLeft,
        ownerLabel: primaryProject?.ownerId ?? '담당자 미정',
        primaryContact: organization.primaryContact.name || '담당자 미정',
        nextAction: primaryProject?.nextAction || progress?.nextAction.title || '다음 행동 등록 필요',
        riskSummary: primaryProject?.riskSummary ?? '',
        bottleneck: bottleneckFor(primaryProject, daysLeft),
        recommendedMove: recommendedMoveFor(primaryProject, daysLeft),
        estimatedMinutes: estimateMinutes(primaryProject, daysLeft),
        tone,
        path: actionPath(primaryProject, organization.id),
        checks,
        tracks: buildTracks(primaryProject, checks),
      } satisfies ClientOpsLedgerRow
    })
    .filter((row) => rowMatchesQuery(row, query))
    .filter((row) => rowMatchesFilter(row, filter))
    .sort((a, b) => {
      const toneRank: Record<StatusTone, number> = {
        danger: 0,
        warning: 1,
        accent: 2,
        info: 3,
        success: 4,
        neutral: 5,
      }
      return toneRank[a.tone] - toneRank[b.tone] || (a.daysLeft ?? 999) - (b.daysLeft ?? 999)
    })

  const allRows = organizations
    .filter((organization) => organization.archivedAt === null)
    .map((organization) => {
      const organizationProjects = projects.filter((project) => project.organizationId === organization.id)
      const primaryProject = pickPrimaryProject(organizationProjects)
      const dday = primaryProject ? getDDay(primaryProject.nextActionDueDate) : null
      const daysLeft = dday?.daysLeft ?? null
      const tone = toneFor(primaryProject, daysLeft)
      const checks = primaryProject ? (checkMap[primaryProject.id]?.checks ?? EMPTY_CLIENT_OPS_CHECKS) : EMPTY_CLIENT_OPS_CHECKS
      const tracks = buildTracks(primaryProject, checks)
      return {
        tone,
        daysLeft,
        estimatedMinutes: estimateMinutes(primaryProject, daysLeft),
        funding: tracks.some((track) => track.key === 'funding' && track.detail !== '필수 아님'),
        businessPlanOpen: tracks.some((track) => track.key === 'business_plan' && track.value < 75),
      }
    })

  const blockedCount = allRows.filter((row) => row.tone === 'danger' || row.tone === 'warning').length
  const dueSoonCount = allRows.filter((row) => row.daysLeft !== null && row.daysLeft <= 3).length
  const fundingCount = allRows.filter((row) => row.funding).length
  const businessPlanCount = allRows.filter((row) => row.businessPlanOpen).length
  const estimatedMinutes = rows.reduce((sum, row) => sum + row.estimatedMinutes, 0)
  const focusTone: StatusTone = blockedCount > 0 ? 'danger' : dueSoonCount > 0 ? 'warning' : fundingCount > 0 ? 'accent' : 'info'
  const focusLabel =
    blockedCount > 0
      ? '병목 회복 우선'
      : dueSoonCount > 0
        ? '마감 전 선처리'
        : fundingCount > 0
          ? '정책자금 자료화'
          : '신규 상담 여지'

  return {
    summary: {
      clientCount: allRows.length,
      blockedCount,
      dueSoonCount,
      fundingCount,
      businessPlanCount,
      estimatedMinutes,
      focusLabel,
      focusTone,
    },
    briefingScript: buildBriefingScript(rows, {
      clientCount: allRows.length,
      blockedCount,
      dueSoonCount,
      fundingCount,
      businessPlanCount,
      estimatedMinutes,
      focusLabel,
      focusTone,
    }),
    rows,
  }
}
