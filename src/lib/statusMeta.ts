import type { HealthStatus, ProjectStage, StatusTone } from '../types'

/** 톤별 배지 색 클래스 — 상태 색은 이 매핑 한 곳에서만 관리한다 */
export const TONE_BADGE_CLASS: Record<StatusTone, string> = {
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  info: 'bg-brand-50 text-brand-700 border-brand-200',
  success: 'bg-success-50 text-success-700 border-success-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  danger: 'bg-danger-50 text-danger-700 border-danger-200',
  accent: 'bg-accent-50 text-accent-700 border-accent-200',
}

/** 톤별 작은 점(dot) 색 클래스 */
export const TONE_DOT_CLASS: Record<StatusTone, string> = {
  neutral: 'bg-slate-400',
  info: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  accent: 'bg-accent-600',
}

/** 톤별 프로그레스 바 색 클래스 */
export const TONE_BAR_CLASS: Record<StatusTone, string> = {
  neutral: 'bg-slate-400',
  info: 'bg-brand-600',
  success: 'bg-success-600',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  accent: 'bg-accent-600',
}

export const PROJECT_STAGE_META: Record<
  ProjectStage,
  { label: string; tone: StatusTone }
> = {
  intake: { label: '상담 접수', tone: 'neutral' },
  diagnosis: { label: '진단 진행', tone: 'info' },
  selection: { label: '과제선별', tone: 'warning' },
  mvp_design: { label: 'MVP 설계', tone: 'info' },
  website_design: { label: '웹사이트 설계', tone: 'accent' },
  validation: { label: '현장검증', tone: 'danger' },
  deliverables: { label: '자료 패키지', tone: 'accent' },
  completed: { label: '완료', tone: 'success' },
}

export const HEALTH_META: Record<
  HealthStatus,
  { label: string; tone: StatusTone }
> = {
  healthy: { label: '정상 운영', tone: 'success' },
  attention: { label: '주의 필요', tone: 'warning' },
  risk: { label: '리스크', tone: 'danger' },
}
