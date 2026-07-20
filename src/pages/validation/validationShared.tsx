import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  ClipboardList,
  Cpu,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  ShieldCheck,
  Target,
} from 'lucide-react'
import type { Project } from '../../types/domain'
import type { ValidationTrackType, ValidationWorkspace } from '../../types/validation'
import { PROJECT_STAGE_META } from '../../lib/statusMeta'
import { TRACK_META } from '../../lib/validationMeta'
import type { ProjectValidationContext, TrackContext } from '../../services/validationService'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import { DetailHeader } from '../../components/ui/DetailHeader'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { useValidationData } from './useValidationData'

export function ValidationHeader({
  project,
  organizationName,
  trackType,
  actions,
}: {
  project: Project
  organizationName: string
  trackType?: ValidationTrackType
  actions?: ReactNode
}) {
  return (
    <DetailHeader
      backTo={trackType ? `/validation/projects/${project.id}` : '/validation'}
      backLabel={trackType ? '트랙 선택' : '실제 사용 테스트'}
      title={trackType ? `실제 사용 테스트 · ${TRACK_META[trackType].label}` : '실제 사용 테스트'}
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

export function TrackNav({ projectId, trackType }: { projectId: string; trackType: ValidationTrackType }) {
  const base = `/validation/projects/${projectId}/${trackType}`
  const tabs = [
    { to: base, label: '개요', icon: LayoutDashboard, end: true },
    { to: `${base}/plan`, label: '테스트 계획', icon: ClipboardList, end: false },
    { to: `${base}/build`, label: '제작·참여자', icon: Cpu, end: false },
    { to: `${base}/scenarios`, label: '시나리오', icon: ListChecks, end: false },
    { to: `${base}/rounds`, label: '회차', icon: FlaskConical, end: false },
    { to: `${base}/feedback`, label: '피드백·이슈', icon: MessageSquare, end: false },
    { to: `${base}/metrics`, label: 'KPI', icon: Gauge, end: false },
    { to: `${base}/gates`, label: 'Gate', icon: ShieldCheck, end: false },
    { to: `${base}/decision`, label: '결정', icon: Target, end: false },
  ]
  return (
    <nav aria-label="검증 트랙 메뉴" className="flex gap-1 overflow-x-auto border-b border-slate-200">
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

export function ValidationProjectNotFound() {
  return (
    <NotFoundState
      title="프로젝트를 찾을 수 없습니다"
      description="주소가 잘못되었거나 이미 삭제·이동된 프로젝트입니다."
      backTo="/validation"
      backLabel="실제 사용 테스트로"
    />
  )
}

/** 확정 설계가 없어 검증을 시작할 수 없을 때 안내 */
export function TrackGateNotice({ track }: { track: TrackContext }) {
  return (
    <div className="rounded-(--radius-panel) border border-warning-200 bg-warning-50/50 p-6">
      <p className="text-sm font-semibold text-slate-800">{TRACK_META[track.trackType].label}를 시작할 수 없습니다</p>
      <p className="mt-1 text-[13px] break-keep text-slate-600">{track.eligibility.reason}</p>
    </div>
  )
}

/** 워크스페이스 미생성 안내 (개요에서 생성) */
export function NoWorkspaceNotice({ projectId, trackType }: { projectId: string; trackType: ValidationTrackType }) {
  return (
    <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3 text-[13px] text-slate-500">
      아직 이 트랙의 검증 워크스페이스가 없습니다. 개요 화면에서{' '}
      <NavLink to={`/validation/projects/${projectId}/${trackType}`} className="font-medium text-brand-700 underline">
        검증 시작
      </NavLink>
      을 눌러 생성하세요.
    </div>
  )
}

/**
 * 트랙 하위 화면 공통 프레임. 헤더·탭·차단을 처리하고 워크스페이스를 전달한다.
 * 확정된 워크스페이스도 읽기 전용으로 렌더한다.
 */
export function TrackSectionFrame({
  projectId,
  trackType,
  render,
}: {
  projectId: string
  trackType: ValidationTrackType
  render: (workspace: ValidationWorkspace, context: ProjectValidationContext, track: TrackContext) => ReactNode
}) {
  const { context } = useValidationData(projectId)
  if (!context) return <ValidationProjectNotFound />
  const track = context.tracks.find((t) => t.trackType === trackType)
  if (!track) return <ValidationProjectNotFound />
  return (
    <div className="flex flex-col gap-5">
      <ValidationHeader
        project={context.project}
        organizationName={context.organization?.name ?? ''}
        trackType={trackType}
      />
      <TrackNav projectId={projectId} trackType={trackType} />
      {!track.eligibility.available ? (
        <TrackGateNotice track={track} />
      ) : !track.workspace ? (
        <NoWorkspaceNotice projectId={projectId} trackType={trackType} />
      ) : (
        render(track.workspace, context, track)
      )}
    </div>
  )
}

/** 확정된 워크스페이스 읽기 전용 안내 */
export function ReadOnlyNotice({ workspace }: { workspace: ValidationWorkspace }) {
  if (workspace.status !== 'finalized' && workspace.status !== 'superseded') return null
  return (
    <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-[13px] text-slate-500">
      {workspace.status === 'finalized' ? '확정된 검증입니다. 원본 보존을 위해 읽기 전용입니다.' : '이전 버전입니다. 읽기 전용입니다.'}
    </div>
  )
}
