import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  FilePlus2,
  Layers,
  Sparkles,
} from 'lucide-react'
import type { DeliverablePackage } from '../../types/deliverables'
import type { DeliverableEligibility } from '../../services/deliverables/sourceCollector'
import { needsRefresh, summarizePackage } from '../../services/deliverableService'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { EmptyState } from '../../components/ui/EmptyState'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import { AudienceBadge, PackageStatusBadge, PackageTypeBadge } from '../../components/deliverables/badges'
import { DeliverableNotFound } from './deliverableShared'
import { useDeliverableData } from './useDeliverableData'

interface ReadinessRow {
  key: string
  label: string
  ready: boolean
}

function readinessRows(e: DeliverableEligibility): ReadinessRow[] {
  return [
    { key: 'diagnosis', label: '진단 결과', ready: e.hasDiagnosis },
    { key: 'selection', label: '과제선정', ready: e.hasSelection },
    { key: 'ax', label: 'AX MVP 설계', ready: e.hasAx },
    { key: 'website', label: '홈페이지 설계', ready: e.hasWebsite },
    { key: 'validation', label: '검증(실제 사용 테스트) 결과', ready: e.hasValidation },
  ]
}

interface NextStep {
  headline: string
  detail: string
  label: string
  to: string
}

function computeNextStep(projectId: string, latest: DeliverablePackage | null, latestStale: boolean): NextStep {
  if (!latest) {
    return {
      headline: '자료 패키지 유형을 선택하세요',
      detail: '확정된 결과를 바탕으로 어떤 제출자료를 만들지 유형을 정하고 초안을 생성합니다.',
      label: '새 자료 패키지 만들기',
      to: `/deliverables/projects/${projectId}/create`,
    }
  }
  const base = `/deliverables/projects/${projectId}/packages/${latest.id}`
  if (latestStale) {
    return {
      headline: '출처 원본이 변경되었습니다',
      detail: '확정된 자료는 그대로 보존됩니다. 최신 결과를 반영하려면 검토 화면에서 새 버전을 만드세요.',
      label: '검토 화면으로 이동',
      to: `${base}/review`,
    }
  }
  if (latest.status === 'draft' || latest.status === 'reviewed') {
    return {
      headline: '작성 중인 자료를 검토·확정하세요',
      detail: '공개 범위를 정리하고 품질 검사를 통과하면 자료를 확정할 수 있습니다.',
      label: '검토·확정하기',
      to: `${base}/review`,
    }
  }
  return {
    headline: '확정된 자료를 전달하세요',
    detail: '대상 독자별로 미리보고 인쇄하거나 파일로 내보낼 수 있습니다.',
    label: '미리보기·내보내기',
    to: `${base}/preview`,
  }
}

export function ProjectDeliverablesPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { context } = useDeliverableData(projectId)

  if (!context) return <DeliverableNotFound />

  const { project, organization, eligibility, packages, latest, latestStale } = context
  const orgName = organization?.name ?? '고객사 미상'
  const nextStep = computeNextStep(projectId, latest, latestStale)
  const canCreate = eligibility.canCreate

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => navigate('/deliverables')}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        제출자료 만들기
      </button>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold break-keep text-slate-900 lg:text-2xl">{project.name}</h1>
            <ProjectTypeBadge type={project.projectType} />
          </div>
          <p className="mt-1.5 text-sm text-slate-500">{orgName} · {project.projectCode}</p>
        </div>
        <Button
          variant="primary"
          disabled={!canCreate}
          onClick={() => navigate(`/deliverables/projects/${projectId}/create`)}
        >
          <FilePlus2 aria-hidden="true" className="size-4" />
          새 자료 패키지 만들기
        </Button>
      </div>

      {!canCreate && eligibility.reasons.length > 0 && (
        <div className="rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3">
          <p className="text-[13px] font-semibold text-warning-800">자료를 만들려면 선행 작업이 필요합니다</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] break-keep text-warning-700">
            {eligibility.reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-(--radius-panel) border border-brand-200 bg-brand-50/50 px-5 py-4">
        <p className="text-xs font-semibold tracking-wide text-brand-600">지금 해야 할 일</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[15px] font-bold break-keep text-slate-900">{nextStep.headline}</p>
            <p className="mt-0.5 text-[13px] break-keep text-slate-600">{nextStep.detail}</p>
          </div>
          <Button
            variant="primary"
            disabled={!latest && !canCreate}
            onClick={() => navigate(nextStep.to)}
          >
            {nextStep.label}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </section>

      {project.projectType === 'ax_website' && (
        <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3 text-[13px] break-keep text-slate-600">
          AX와 홈페이지는 별도 트랙으로 관리되며 결과를 하나의 점수로 합산하지 않습니다. 각 트랙의 결과는 자료에서 구분되어 표시됩니다.
        </div>
      )}

      <Panel title="확정 결과 준비 상태">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {readinessRows(eligibility).map((row) => (
            <li key={row.key} className="flex items-center gap-2.5 rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5">
              {row.ready ? (
                <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success-500" />
              ) : (
                <CircleDashed aria-hidden="true" className="size-4 shrink-0 text-slate-300" />
              )}
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">{row.label}</span>
              <span className={`shrink-0 text-xs font-medium ${row.ready ? 'text-success-600' : 'text-slate-400'}`}>
                {row.ready ? '사용 가능' : '선행 작업 필요'}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={`자료 패키지 (${packages.length})`} flush>
        {packages.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="아직 만든 자료 패키지가 없습니다"
            description={canCreate ? '위의 새 자료 패키지 만들기로 첫 초안을 생성하세요.' : '진단 또는 설계를 먼저 확정하면 자료를 만들 수 있습니다.'}
            action={canCreate ? <Button variant="primary" onClick={() => navigate(`/deliverables/projects/${projectId}/create`)}>새 자료 패키지 만들기</Button> : undefined}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            {packages.map((pkg) => {
              const summary = summarizePackage(pkg)
              const stale = needsRefresh(pkg)
              return (
                <li key={pkg.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/deliverables/projects/${projectId}/packages/${pkg.id}`)}
                    className="flex h-full w-full flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 text-left hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{pkg.name}</p>
                        <p className="mt-0.5 text-xs text-slate-400">v{pkg.version}</p>
                      </div>
                      <PackageStatusBadge status={pkg.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <PackageTypeBadge type={pkg.type} />
                      <AudienceBadge audience={pkg.audience} />
                    </div>
                    <p className="text-[13px] break-keep text-slate-600">{summary.headline}</p>
                    {stale && (
                      <span className="w-fit rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700">
                        출처 원본 변경됨 · 새 버전 검토 필요
                      </span>
                    )}
                    <span className="mt-auto inline-flex items-center gap-1 text-[13px] font-semibold text-brand-600">
                      열기
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/deliverables/results')}>
          <Sparkles aria-hidden="true" className="size-4" />
          전체 자료 결과 보기
        </Button>
      </div>
    </div>
  )
}
