import { Box, FileText, Filter, FolderKanban } from 'lucide-react'
import type { MetricSummary, PortfolioProject } from '../types'
import type { Organization, Project } from '../types/domain'
import { pickPrimaryProject } from './organizationService'

const HEALTH_ORDER = { healthy: 0, attention: 1, risk: 2 } as const

/**
 * 대시보드 KPI — Repository 데이터 기준으로 계산 (전주 대비는 데모 값 유지).
 * selectionPending은 과제선별 서비스에서 계산한 값을 주입한다(확정 진단·선정 미확정).
 */
export function buildDashboardMetrics(
  projects: Project[],
  selectionPending?: number,
  designInProgress?: number,
): MetricSummary[] {
  const open = projects.filter(
    (p) => p.status !== 'completed' && p.status !== 'archived',
  )
  return [
    {
      key: 'active-projects',
      label: '진행 중 프로젝트',
      value: projects.filter((p) => p.status === 'active').length,
      unit: '건',
      weeklyDelta: 2,
      tone: 'info',
      icon: FolderKanban,
    },
    {
      key: 'selection-pending',
      label: '선별 대기 과제',
      value:
        selectionPending ?? open.filter((p) => p.currentStage === 'selection').length,
      unit: '건',
      weeklyDelta: 1,
      tone: 'warning',
      icon: Filter,
    },
    {
      key: 'mvp-building',
      label: '제작 중 MVP',
      value:
        designInProgress ??
        open.filter(
          (p) =>
            p.currentStage === 'mvp_design' || p.currentStage === 'website_design',
        ).length,
      unit: '건',
      weeklyDelta: 0,
      tone: 'success',
      icon: Box,
    },
    {
      key: 'deliverables-preparing',
      label: '제출자료 준비',
      value: open.filter((p) => p.currentStage === 'deliverables').length,
      unit: '건',
      weeklyDelta: -1,
      tone: 'danger',
      icon: FileText,
    },
  ]
}

/** 포트폴리오 건강도 — 고객사 + 대표 프로젝트 기준 */
export function buildPortfolioItems(
  organizations: Organization[],
  projects: Project[],
): PortfolioProject[] {
  return organizations
    .map<PortfolioProject>((org) => {
      const primary = pickPrimaryProject(
        projects.filter((p) => p.organizationId === org.id),
      )
      return {
        id: org.id,
        client: org.name,
        industry: org.industry,
        stage: primary?.currentStage ?? 'intake',
        progress: primary?.progress ?? 0,
        health: org.healthStatus,
      }
    })
    .sort((a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health])
}
