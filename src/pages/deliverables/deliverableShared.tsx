import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  ClipboardCheck,
  Code2,
  Eye,
  FileText,
  LayoutDashboard,
  ListChecks,
  Route,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { DeliverablePackage } from '../../types/deliverables'
import type { Project } from '../../types/domain'
import { DetailHeader } from '../../components/ui/DetailHeader'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import { PackageStatusBadge, PackageTypeBadge, AudienceBadge } from '../../components/deliverables/badges'
import { useDeliverableData, usePackage } from './useDeliverableData'

export function PackageHeader({
  project,
  organizationName,
  pkg,
  actions,
}: {
  project: Project
  organizationName: string
  pkg: DeliverablePackage
  actions?: ReactNode
}) {
  return (
    <DetailHeader
      backTo={`/deliverables/projects/${project.id}`}
      backLabel="자료 패키지 목록"
      title={pkg.name}
      badges={
        <>
          <PackageTypeBadge type={pkg.type} />
          <AudienceBadge audience={pkg.audience} />
          <PackageStatusBadge status={pkg.status} />
          <span className="text-xs text-slate-400">v{pkg.version}</span>
        </>
      }
      meta={
        <>
          <span>{organizationName}</span>
          <span>{project.name}</span>
          <ProjectTypeBadge type={project.projectType} compact />
        </>
      }
      actions={actions}
    />
  )
}

export function PackageNav({ projectId, packageId }: { projectId: string; packageId: string }) {
  const base = `/deliverables/projects/${projectId}/packages/${packageId}`
  const tabs = [
    { to: base, label: '개요', icon: LayoutDashboard, end: true },
    { to: `${base}/contents`, label: '포함 자료', icon: ListChecks, end: false },
    { to: `${base}/reports`, label: '보고서', icon: FileText, end: false },
    { to: `${base}/specification`, label: '개발명세', icon: Code2, end: false },
    { to: `${base}/roadmap`, label: '실행 로드맵', icon: Route, end: false },
    { to: `${base}/prompts`, label: '개발 프롬프트', icon: Sparkles, end: false },
    { to: `${base}/evidence`, label: '근거', icon: ClipboardCheck, end: false },
    { to: `${base}/preview`, label: '미리보기', icon: Eye, end: false },
    { to: `${base}/review`, label: '검토·확정', icon: ShieldCheck, end: false },
  ]
  return (
    <nav aria-label="자료 패키지 메뉴" className="flex gap-1 overflow-x-auto border-b border-slate-200">
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

export function DeliverableNotFound() {
  return (
    <NotFoundState
      title="자료 패키지를 찾을 수 없습니다"
      description="주소가 잘못되었거나 이미 삭제·이동된 자료입니다."
      backTo="/deliverables"
      backLabel="제출자료 만들기로"
    />
  )
}

export function StaleBanner({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="flex items-start gap-2 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3">
      <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-600" />
      <p className="text-[13px] break-keep text-warning-800">
        자료 원본이 변경되었습니다. 확정된 자료는 그대로 보존되며, 최신 결과를 반영하려면 새 버전을 만드세요.
      </p>
    </div>
  )
}

export function ReadOnlyNotice({ pkg }: { pkg: DeliverablePackage }) {
  if (pkg.status !== 'finalized' && pkg.status !== 'superseded' && pkg.status !== 'archived') return null
  return (
    <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-[13px] text-slate-500">
      {pkg.status === 'finalized' ? '확정된 자료입니다. 원본 보존을 위해 읽기 전용입니다. 수정하려면 새 버전을 만드세요.' : '이전 버전입니다. 읽기 전용입니다.'}
    </div>
  )
}

/**
 * 패키지 하위 화면 공통 프레임. 헤더·탭·상태를 처리하고 패키지를 전달한다.
 */
export function PackageSectionFrame({
  projectId,
  packageId,
  render,
}: {
  projectId: string
  packageId: string
  render: (pkg: DeliverablePackage, project: Project, organizationName: string) => ReactNode
}) {
  const { pkg, stale } = usePackage(packageId)
  const { context } = useDeliverableData(projectId)
  if (!pkg || pkg.projectId !== projectId || !context) return <DeliverableNotFound />
  const organizationName = context.organization?.name ?? ''
  return (
    <div className="flex flex-col gap-5">
      <PackageHeader project={context.project} organizationName={organizationName} pkg={pkg} />
      <PackageNav projectId={projectId} packageId={packageId} />
      <StaleBanner show={stale} />
      {render(pkg, context.project, organizationName)}
    </div>
  )
}
