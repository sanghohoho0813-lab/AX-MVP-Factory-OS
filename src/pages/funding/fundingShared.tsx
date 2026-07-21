import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  ListChecks,
  Phone,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import type { Project } from '../../types/domain'
import type { FundingStrategy } from '../../types/funding'
import { DetailHeader } from '../../components/ui/DetailHeader'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import { StrategyStatusBadge } from '../../components/funding/badges'
import { useFundingData, useStrategy } from './useFundingData'

export function FundingHeader({
  project,
  organizationName,
  strategy,
  actions,
}: {
  project: Project
  organizationName: string
  strategy: FundingStrategy | null
  actions?: ReactNode
}) {
  return (
    <DetailHeader
      backTo="/funding"
      backLabel="기관·자금 연계"
      title="기관·자금 연계"
      badges={
        <>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500">
            {project.projectCode}
          </span>
          <ProjectTypeBadge type={project.projectType} compact />
          {strategy && <StrategyStatusBadge status={strategy.status} />}
          {strategy && <span className="text-xs text-slate-400">v{strategy.version}</span>}
        </>
      }
      meta={
        <>
          <span>{organizationName}</span>
          <span>{project.name}</span>
        </>
      }
      actions={actions}
    />
  )
}

export function FundingNav({ projectId }: { projectId: string }) {
  const base = `/funding/projects/${projectId}`
  const tabs = [
    { to: base, label: '개요', icon: LayoutDashboard, end: true },
    { to: `${base}/matches`, label: '기관 후보', icon: Building2, end: false },
    { to: `${base}/gaps`, label: '근거·부족조건', icon: ClipboardList, end: false },
    { to: `${base}/outreach`, label: '접촉 계획', icon: Phone, end: false },
    { to: `${base}/checklist`, label: '준비자료', icon: ListChecks, end: false },
    { to: `${base}/pipeline`, label: '신청·심사', icon: Target, end: false },
    { to: `${base}/outcome`, label: '결과·성과', icon: TrendingUp, end: false },
    { to: `${base}/case`, label: '사례', icon: FileText, end: false },
    { to: `${base}/review`, label: '검토·확정', icon: ClipboardCheck, end: false },
  ]
  return (
    <nav aria-label="기관·자금 연계 메뉴" className="flex min-w-0 gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
              isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`
          }
        >
          <tab.icon aria-hidden="true" className="size-4" />
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function FundingNotFound() {
  return (
    <NotFoundState
      title="연계 전략을 찾을 수 없습니다"
      description="주소가 잘못되었거나 이미 삭제·이동된 자료입니다."
      backTo="/funding"
      backLabel="기관·자금 연계로"
    />
  )
}

export function StaleBanner({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="flex items-start gap-2 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3">
      <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-600" />
      <p className="text-[13px] break-keep text-warning-800">
        출처 원본이 변경되었습니다. 확정된 전략은 그대로 보존되며, 최신 결과를 반영하려면 새 버전을 만드세요.
      </p>
    </div>
  )
}

export function ReadOnlyNotice({ strategy }: { strategy: FundingStrategy }) {
  if (strategy.status !== 'finalized' && strategy.status !== 'superseded') return null
  return (
    <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-[13px] text-slate-500">
      {strategy.status === 'finalized' ? '확정된 전략입니다. 원본 보존을 위해 읽기 전용입니다. 수정하려면 새 버전을 만드세요.' : '이전 버전입니다. 읽기 전용입니다.'}
    </div>
  )
}

/**
 * 전략 하위 화면 공통 프레임. projectId의 최신 전략을 로드해 전달한다.
 */
export function FundingStrategyFrame({
  projectId,
  render,
}: {
  projectId: string
  render: (strategy: FundingStrategy, project: Project, organizationName: string) => ReactNode
}) {
  const { context } = useFundingData(projectId)
  const strategyId = context?.latest?.id ?? ''
  const { strategy, stale } = useStrategy(strategyId)
  if (!context) return <FundingNotFound />
  const organizationName = context.organization?.name ?? ''
  if (!strategy) {
    return (
      <div className="flex flex-col gap-5">
        <FundingHeader project={context.project} organizationName={organizationName} strategy={null} />
        <FundingNav projectId={projectId} />
        <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3 text-[13px] text-slate-500">
          아직 연계 전략이 없습니다. 개요 화면에서{' '}
          <NavLink to={`/funding/projects/${projectId}`} className="font-medium text-brand-700 underline">연계 시작</NavLink>
          을 눌러 생성하세요.
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-5">
      <FundingHeader project={context.project} organizationName={organizationName} strategy={strategy} />
      <FundingNav projectId={projectId} />
      <StaleBanner show={stale} />
      {render(strategy, context.project, organizationName)}
    </div>
  )
}
