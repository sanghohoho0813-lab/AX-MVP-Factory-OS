import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  BadgeCheck,
  Boxes,
  ClipboardCheck,
  GitBranch,
  LayoutDashboard,
  LayoutList,
  PencilRuler,
  RefreshCw,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import type { Project } from '../../types/domain'
import type { MvpDesign } from '../../types/mvpDesign'
import { PROJECT_STAGE_META } from '../../lib/statusMeta'
import type { ProjectDesignContext } from '../../services/mvpDesignService'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import { Button } from '../../components/ui/Button'
import { DetailHeader } from '../../components/ui/DetailHeader'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { useDesignData } from './useDesignData'

export function DesignHeader({
  project,
  organizationName,
  actions,
}: {
  project: Project
  organizationName: string
  actions?: ReactNode
}) {
  return (
    <DetailHeader
      backTo={`/projects/${project.id}`}
      backLabel={`${project.name} 상세`}
      title="MVP 설계 워크벤치"
      badges={
        <>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500">
            {project.projectCode}
          </span>
          <ProjectTypeBadge type={project.projectType} compact />
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
            {PROJECT_STAGE_META[project.currentStage].label}
          </span>
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

export function DesignNav({ projectId }: { projectId: string }) {
  const base = `/mvp-design/projects/${projectId}`
  const tabs = [
    { to: base, label: '개요', icon: LayoutDashboard, end: true },
    { to: `${base}/workflow`, label: '업무 흐름', icon: Workflow, end: false },
    { to: `${base}/features`, label: '기능·범위', icon: BadgeCheck, end: false },
    { to: `${base}/screens`, label: '화면', icon: LayoutList, end: false },
    { to: `${base}/data`, label: '데이터', icon: Boxes, end: false },
    { to: `${base}/permissions`, label: '역할·권한', icon: ShieldCheck, end: false },
    { to: `${base}/rules`, label: '규칙·AI', icon: GitBranch, end: false },
    { to: `${base}/validation`, label: '검증', icon: ClipboardCheck, end: false },
    { to: `${base}/review`, label: '설계 확정', icon: PencilRuler, end: false },
  ]
  return (
    <nav aria-label="MVP 설계 메뉴" className="flex gap-1 overflow-x-auto border-b border-slate-200">
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

export function DesignProjectNotFound() {
  return (
    <NotFoundState
      title="프로젝트를 찾을 수 없습니다"
      description="주소가 잘못되었거나 이미 삭제·이동된 프로젝트입니다."
      backTo="/mvp-design/results"
      backLabel="설계 결과로"
    />
  )
}

/** 선정 미확정·홈페이지 등 진입 차단 안내 */
export function DesignGateNotice({ context }: { context: ProjectDesignContext }) {
  const navigate = useNavigate()
  if (context.eligibility.websiteRedirect) {
    return (
      <div className="rounded-(--radius-panel) border border-slate-200 bg-white p-6 shadow-(--shadow-card)">
        <div className="flex items-start gap-3">
          <PencilRuler aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">홈페이지 단독 프로젝트입니다</p>
            <p className="mt-1 text-[13px] break-keep text-slate-600">
              홈페이지 제작 프로젝트에는 AX MVP 설계를 적용하지 않습니다. 제작 방향은 웹사이트 스튜디오에서 설계합니다.
            </p>
            <div className="mt-3">
              <Button variant="primary" size="sm" onClick={() => navigate('/website-studio')}>
                웹사이트 스튜디오로 이동
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-(--radius-panel) border border-slate-200 bg-white p-6 shadow-(--shadow-card)">
      <div className="flex items-start gap-3">
        <ClipboardCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-400" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">먼저 핵심 과제 확정이 필요합니다</p>
          <p className="mt-1 text-[13px] break-keep text-slate-600">
            MVP 설계는 과제선별에서 확정된 핵심 과제를 기준으로 시작됩니다. 과제선별을 먼저 확정하세요.
          </p>
          <div className="mt-3">
            <Button variant="primary" size="sm" onClick={() => navigate(`/selection/projects/${context.project.id}/decision`)}>
              과제선별로 이동
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function RedesignBanner({ show, onRun }: { show: boolean; onRun: () => void }) {
  if (!show) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3">
      <RefreshCw aria-hidden="true" className="size-4 shrink-0 text-warning-600" />
      <p className="min-w-0 flex-1 text-[13px] break-keep text-warning-800">
        확정된 핵심 과제가 변경되어 재설계가 필요합니다. 확정된 설계는 그대로 보존됩니다.
      </p>
      <Button variant="secondary" size="sm" onClick={onRun}>
        <RefreshCw aria-hidden="true" className="size-3.5" />
        새 버전 설계
      </Button>
    </div>
  )
}

/** 설계가 아직 없을 때의 안내(초안 없음) */
export function DesignEmptyNotice({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3 text-[13px] text-slate-500">
      <span className="min-w-0 flex-1">아직 설계 초안이 없습니다. 개요 화면에서 설계를 생성하세요.</span>
      <Button variant="secondary" size="sm" onClick={() => navigate(`/mvp-design/projects/${projectId}`)}>
        개요로 이동
      </Button>
    </div>
  )
}

/** 설계 하위 화면 공통 프레임 — 헤더·탭·차단 처리 후 설계를 전달한다 */
export function DesignSectionFrame({
  projectId,
  render,
}: {
  projectId: string
  render: (design: MvpDesign, context: ProjectDesignContext) => ReactNode
}) {
  const { context } = useDesignData(projectId)
  if (!context) return <DesignProjectNotFound />
  const { project, organization, eligibility, design } = context
  return (
    <div className="flex flex-col gap-5">
      <DesignHeader project={project} organizationName={organization?.name ?? ''} />
      {eligibility.canDesign && <DesignNav projectId={projectId} />}
      {!eligibility.canDesign ? (
        <DesignGateNotice context={context} />
      ) : !design ? (
        <DesignEmptyNotice projectId={projectId} />
      ) : (
        render(design, context)
      )}
    </div>
  )
}
