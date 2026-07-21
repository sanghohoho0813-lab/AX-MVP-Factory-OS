import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import type { ValidationTrackType, ValidationWorkspace } from '../../types/validation'
import { TRACK_META } from '../../lib/validationMeta'
import type { ProjectValidationContext, TrackContext } from '../../services/validationService'
import { NotFoundState } from '../../components/ui/NotFoundState'
import {
  WorkspaceHeader,
  WorkspaceStepNav,
  type WorkspaceSaveState,
  type WorkspaceStep,
} from '../../components/workspace/WorkspaceShell'
import { useValidationData } from './useValidationData'

export const VALIDATION_MODULE_NAME = '실제 사용 테스트'
export const VALIDATION_MODULE_DESC =
  '설계한 기능이나 홈페이지를 실제 사용자가 시험하고 문제와 성과를 기록합니다.'

/** 검증 트랙 내부 단계 (실제 라우트 연결 — trackType 세그먼트 보존) */
export function validationSteps(projectId: string, trackType: ValidationTrackType): WorkspaceStep[] {
  const base = `/validation/projects/${projectId}/${trackType}`
  return [
    { key: 'overview', label: '개요', path: base },
    { key: 'plan', label: '테스트 계획', path: `${base}/plan` },
    { key: 'build', label: '테스트 버전', path: `${base}/build` },
    { key: 'scenarios', label: '확인할 시나리오', path: `${base}/scenarios` },
    { key: 'rounds', label: '참여자·회차', path: `${base}/rounds` },
    { key: 'feedback', label: '피드백·문제', path: `${base}/feedback` },
    { key: 'metrics', label: '성과 측정', path: `${base}/metrics` },
    { key: 'gates', label: '단계 판정', path: `${base}/gates` },
    { key: 'decision', label: '다음 결정', path: `${base}/decision` },
  ]
}

export function ValidationModuleHeader({ saveStatus }: { saveStatus?: WorkspaceSaveState }) {
  return (
    <WorkspaceHeader
      moduleName={VALIDATION_MODULE_NAME}
      moduleDescription={VALIDATION_MODULE_DESC}
      saveStatus={saveStatus}
    />
  )
}

export function ValidationNav({ projectId, trackType }: { projectId: string; trackType: ValidationTrackType }) {
  return <WorkspaceStepNav steps={validationSteps(projectId, trackType)} />
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
      <p className="text-[1.05rem] font-semibold break-keep text-slate-800">{TRACK_META[track.trackType].label}를 시작할 수 없습니다</p>
      <p className="mt-1 text-[0.95rem] break-keep text-slate-600">{track.eligibility.reason}</p>
    </div>
  )
}

/** 워크스페이스 미생성 안내 (개요에서 생성) */
export function NoWorkspaceNotice({ projectId, trackType }: { projectId: string; trackType: ValidationTrackType }) {
  return (
    <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3 text-[0.95rem] break-keep text-slate-500">
      아직 이 트랙의 검증 워크스페이스가 없습니다. 개요 화면에서{' '}
      <NavLink to={`/validation/projects/${projectId}/${trackType}`} className="font-medium text-brand-700 underline">
        검증 시작
      </NavLink>
      을 눌러 생성하세요.
    </div>
  )
}

/**
 * 트랙 하위 화면 공통 프레임. 헤더·단계 내비게이션·차단을 처리하고 워크스페이스를 전달한다.
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
      <ValidationModuleHeader saveStatus="local" />
      <ValidationNav projectId={projectId} trackType={trackType} />
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
    <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-[0.9rem] break-keep text-slate-500">
      {workspace.status === 'finalized' ? '확정된 검증입니다. 원본 보존을 위해 읽기 전용입니다.' : '이전 버전입니다. 읽기 전용입니다.'}
    </div>
  )
}
