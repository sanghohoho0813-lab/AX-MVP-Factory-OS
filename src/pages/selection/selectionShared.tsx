import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  ClipboardCheck,
  Filter,
  Grid2x2,
  LayoutDashboard,
  ListChecks,
  RefreshCw,
} from 'lucide-react'
import type { Project } from '../../types/domain'
import { PROJECT_STAGE_META } from '../../lib/statusMeta'
import type { ProjectSelectionContext } from '../../services/selectionService'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import { Button } from '../../components/ui/Button'
import { DetailHeader } from '../../components/ui/DetailHeader'
import { NotFoundState } from '../../components/ui/NotFoundState'

export function SelectionHeader({
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
      title="과제선별"
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

export function SelectionNav({ projectId }: { projectId: string }) {
  const base = `/selection/projects/${projectId}`
  const tabs = [
    { to: base, label: '개요', icon: LayoutDashboard, end: true },
    { to: `${base}/candidates`, label: '후보 과제', icon: ListChecks, end: false },
    { to: `${base}/matrix`, label: '우선순위 매트릭스', icon: Grid2x2, end: false },
    { to: `${base}/decision`, label: '핵심 과제 선정', icon: ClipboardCheck, end: false },
  ]
  return (
    <nav aria-label="과제선별 메뉴" className="flex gap-1 overflow-x-auto border-b border-slate-200">
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

export function SelectionProjectNotFound() {
  return (
    <NotFoundState
      title="프로젝트를 찾을 수 없습니다"
      description="주소가 잘못되었거나 이미 삭제·이동된 프로젝트입니다."
      backTo="/selection/results"
      backLabel="과제선정 결과로"
    />
  )
}

/** 진단 미확정·홈페이지 등 진입 차단 안내 */
export function SelectionGateNotice({
  context,
}: {
  context: ProjectSelectionContext
}) {
  const navigate = useNavigate()
  if (context.eligibility.websiteRedirect) {
    const readiness = context.eligibility.assessment?.websiteReadiness
    return (
      <div className="rounded-(--radius-panel) border border-slate-200 bg-white p-6 shadow-(--shadow-card)">
        <div className="flex items-start gap-3">
          <Filter aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">홈페이지 단독 프로젝트입니다</p>
            <p className="mt-1 text-[13px] break-keep text-slate-600">
              홈페이지 제작 프로젝트에는 AX 자동화 과제선별을 적용하지 않습니다. 홈페이지 제작 방향은
              웹사이트 스튜디오에서 설계합니다.
              {readiness ? ` 현재 제작 준비도는 ${readiness.overallScore}점입니다.` : ''}
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
          <p className="text-sm font-semibold text-slate-800">먼저 진단 결과가 필요합니다</p>
          <p className="mt-1 text-[13px] break-keep text-slate-600">
            과제선별은 확정된 진단 결과를 기준으로 실행됩니다. 진단 분석을 실행·확정한 뒤 다시 시도하세요.
          </p>
          <div className="mt-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/diagnosis/projects/${context.project.id}/analysis`)}
            >
              진단 분석으로 이동
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ReselectionBanner({ show, onRun }: { show: boolean; onRun: () => void }) {
  if (!show) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3">
      <RefreshCw aria-hidden="true" className="size-4 shrink-0 text-warning-600" />
      <p className="min-w-0 flex-1 text-[13px] break-keep text-warning-800">
        새로운 진단 결과 또는 후보 변경이 있어 재선별이 필요합니다.
      </p>
      <Button variant="secondary" size="sm" onClick={onRun}>
        <RefreshCw aria-hidden="true" className="size-3.5" />
        새 버전 선별
      </Button>
    </div>
  )
}
