import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import type { Project } from '../../types/domain'
import type { FundingStrategy } from '../../types/funding'
import { NotFoundState } from '../../components/ui/NotFoundState'
import {
  WorkspaceHeader,
  WorkspaceStepNav,
  type WorkspaceSaveState,
  type WorkspaceStep,
} from '../../components/workspace/WorkspaceShell'
import { useFundingData, useStrategy } from './useFundingData'

export const FUNDING_MODULE_NAME = '기관·자금 연계'
export const FUNDING_MODULE_DESC =
  '프로젝트 근거를 확인하고 검토할 기관·준비자료·진행결과를 관리합니다.'

/** 기관·자금 연계 내부 단계 (실제 라우트 연결 — 경로 보존) */
export function fundingSteps(projectId: string): WorkspaceStep[] {
  const base = `/funding/projects/${projectId}`
  return [
    { key: 'overview', label: '개요', path: base },
    { key: 'evidence', label: '근거 확인', path: `${base}/gaps` },
    { key: 'matches', label: '기관 후보', path: `${base}/matches` },
    { key: 'gaps', label: '부족조건', path: `${base}/gaps` },
    { key: 'outreach', label: '접촉 계획', path: `${base}/outreach` },
    { key: 'checklist', label: '준비자료', path: `${base}/checklist` },
    { key: 'pipeline', label: '신청·심사', path: `${base}/pipeline` },
    { key: 'outcome', label: '결과·사례', path: `${base}/outcome` },
  ]
}

export function FundingHeader({ saveStatus }: { saveStatus?: WorkspaceSaveState }) {
  return (
    <WorkspaceHeader moduleName={FUNDING_MODULE_NAME} moduleDescription={FUNDING_MODULE_DESC} saveStatus={saveStatus} />
  )
}

export function FundingNav({ projectId }: { projectId: string }) {
  return <WorkspaceStepNav steps={fundingSteps(projectId)} />
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
      <p className="text-[0.9rem] break-keep text-warning-800">
        출처 원본이 변경되었습니다. 확정된 전략은 그대로 보존되며, 최신 결과를 반영하려면 새 버전을 만드세요.
      </p>
    </div>
  )
}

export function ReadOnlyNotice({ strategy }: { strategy: FundingStrategy }) {
  if (strategy.status !== 'finalized' && strategy.status !== 'superseded') return null
  return (
    <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-[0.9rem] break-keep text-slate-500">
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
        <FundingHeader />
        <FundingNav projectId={projectId} />
        <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3 text-[0.9rem] break-keep text-slate-500">
          아직 연계 전략이 없습니다. 개요 화면에서{' '}
          <NavLink to={`/funding/projects/${projectId}`} className="font-medium text-brand-700 underline">연계 시작</NavLink>
          을 눌러 생성하세요.
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-5">
      <FundingHeader />
      <FundingNav projectId={projectId} />
      <StaleBanner show={stale} />
      {render(strategy, context.project, organizationName)}
    </div>
  )
}
