import type { LucideIcon } from 'lucide-react'

/** 프로젝트가 현재 위치한 파이프라인 단계 */
export type ProjectStage =
  | 'intake'
  | 'diagnosis'
  | 'selection'
  | 'mvp_design'
  | 'website_design'
  | 'validation'
  | 'deliverables'
  | 'completed'

/** 고객사 포트폴리오 건강 상태 */
export type HealthStatus = 'healthy' | 'attention' | 'risk'

/** 설문 응답자 역할 (진단 스튜디오 공용) */
export type RespondentRole = 'owner' | 'manager' | 'worker' | 'mixed'

/** 배지·상태 표시에 쓰는 절제된 색 톤 */
export type StatusTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'accent'

/** 사이드바 내비게이션 항목 */
export interface NavigationItem {
  key: string
  label: string
  path: string
  icon: LucideIcon
  /** AX 제작 흐름에서의 단계 번호 (1~5). 흐름 외 메뉴는 미지정 */
  step?: number
  /** 기존 전문 용어 등 보조 설명 (툴팁) */
  hint?: string
}

export interface NavigationGroup {
  key: string
  /** 그룹 제목 (표시용). 없으면 구분선만 */
  title?: string
  items: NavigationItem[]
}

/** KPI 요약 지표 */
export interface MetricSummary {
  key: string
  label: string
  value: number
  unit: string
  /** 전주 대비 변화량. 0이면 변동 없음 */
  weeklyDelta: number
  tone: StatusTone
  icon: LucideIcon
}

/** 주간 타임라인 트랙(행) */
export interface TimelineTrack {
  key: string
  label: string
  tone: StatusTone
}

/** 주간 타임라인 일정 항목 */
export interface TimelineItem {
  id: string
  trackKey: string
  title: string
  owner: string
  /** 주 시작(월요일)을 0으로 하는 시작 요일 인덱스 */
  startDay: number
  /** 시작일 포함 지속 일수 */
  durationDays: number
}

/** 오늘의 우선순위 작업 */
export interface PriorityTask {
  id: string
  rank: number
  client: string
  title: string
  nextAction: string
  owner: string
  /** D-day 표기 (예: "D-1") */
  dueLabel: string
  tone: StatusTone
  action: PriorityAction
}

export type PriorityAction =
  | { type: 'navigate'; label: string; to: string }
  | { type: 'notify'; label: string; message: string }

/** 고객사 포트폴리오 프로젝트 */
export interface PortfolioProject {
  id: string
  client: string
  industry: string
  stage: ProjectStage
  /** 0–100 진행률 */
  progress: number
  health: HealthStatus
}

/** 빈 상태(준비 중) 모듈 페이지 정의 */
export interface ModulePageConfig {
  key: string
  path: string
  title: string
  description: string
  upcomingFeatures: [string, string, string]
  icon: LucideIcon
}
