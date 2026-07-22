import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import type { DeliverablePackage } from '../../types/deliverables'
import type { Project } from '../../types/domain'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { PackageStatusBadge, PackageTypeBadge, AudienceBadge } from '../../components/deliverables/badges'
import {
  WorkspaceHeader,
  WorkspaceStepNav,
  type WorkspaceStep,
} from '../../components/workspace/WorkspaceShell'
import { useDeliverableData, usePackage } from './useDeliverableData'

export const DELIVERABLE_MODULE_NAME = '제출자료 만들기'
export const DELIVERABLE_MODULE_DESC =
  '진단·설계·테스트 결과를 고객·개발자·기관에 전달할 자료로 정리합니다.'

/**
 * 제출자료 내부 단계 (실제 라우트 연결).
 * 자료 묶음(패키지) 단위로 화면이 나뉘므로 projectId·packageId가 모두 필요하다.
 * 경로는 기존 라우트를 그대로 보존하고 표현만 쉬운 말로 바꾼다.
 */
export function deliverableSteps(projectId: string, packageId: string): WorkspaceStep[] {
  const base = `/deliverables/projects/${projectId}/packages/${packageId}`
  return [
    { key: 'overview', label: '개요', path: base },
    { key: 'contents', label: '포함할 내용', path: `${base}/contents` },
    { key: 'reports', label: '보고서', path: `${base}/reports` },
    { key: 'specification', label: '개발자 전달자료', path: `${base}/specification` },
    { key: 'roadmap', label: '실행 로드맵', path: `${base}/roadmap` },
    { key: 'prompts', label: '개발 프롬프트', path: `${base}/prompts` },
    { key: 'evidence', label: '근거', path: `${base}/evidence` },
    { key: 'preview', label: '미리보기', path: `${base}/preview` },
    { key: 'review', label: '자료 확정', path: `${base}/review` },
  ]
}

/** 자료 묶음 식별 줄 — 이름·유형·대상·상태 (쉬운 말 배지) */
function PackageIdentity({ pkg }: { pkg: DeliverablePackage }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3">
      <h2 className="min-w-0 text-[1.05rem] font-bold break-keep text-slate-900">{pkg.name}</h2>
      <PackageTypeBadge type={pkg.type} />
      <AudienceBadge audience={pkg.audience} />
      <PackageStatusBadge status={pkg.status} />
      <span className="text-[0.82rem] text-slate-400">v{pkg.version} (확정 당시 내용)</span>
    </div>
  )
}

export function DeliverableNotFound() {
  return (
    <NotFoundState
      title="자료 묶음을 찾을 수 없습니다"
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
      <p className="text-[0.9rem] break-keep text-warning-800">
        자료 원본이 변경되었습니다. 확정된 자료는 그대로 보존되며, 최신 결과를 반영하려면 새 버전을 만드세요.
      </p>
    </div>
  )
}

export function ReadOnlyNotice({ pkg }: { pkg: DeliverablePackage }) {
  if (pkg.status !== 'finalized' && pkg.status !== 'superseded' && pkg.status !== 'archived') return null
  return (
    <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-[0.9rem] text-slate-500">
      {pkg.status === 'finalized' ? '확정된 자료입니다. 원본 보존을 위해 읽기 전용입니다. 수정하려면 새 버전을 만드세요.' : '이전 버전입니다. 읽기 전용입니다.'}
    </div>
  )
}

/**
 * 패키지 하위 화면 공통 프레임. 헤더·단계·상태를 처리하고 패키지를 전달한다.
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
      <WorkspaceHeader
        moduleName={DELIVERABLE_MODULE_NAME}
        moduleDescription={DELIVERABLE_MODULE_DESC}
        saveStatus="local"
      />
      <WorkspaceStepNav steps={deliverableSteps(projectId, packageId)} />
      <PackageIdentity pkg={pkg} />
      <StaleBanner show={stale} />
      {render(pkg, context.project, organizationName)}
    </div>
  )
}
