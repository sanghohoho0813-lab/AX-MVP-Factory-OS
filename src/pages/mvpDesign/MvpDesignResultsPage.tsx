import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, PencilRuler } from 'lucide-react'
import type { MvpDesign } from '../../types/mvpDesign'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { mvpLevelLabel } from '../../lib/domainMeta'
import {
  mvpDesignRepository,
  organizationRepository,
  projectRepository,
} from '../../repositories'
import { GuidedEmptyState } from '../../components/ui/GuidedEmptyState'
import { useDemoTour } from '../../components/demo/demoTour'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { DesignStatusBadge } from '../../components/mvpDesign/badges'
import { needsRedesign } from '../../services/mvpDesignService'
import type { ProjectType } from '../../types/domain'

interface Row {
  design: MvpDesign
  orgName: string
  projectName: string
  projectType: ProjectType
  stale: boolean
}

export function MvpDesignResultsPage() {
  const navigate = useNavigate()
  const demo = useDemoTour()
  const version = useStoreVersion()

  const rows = useMemo<Row[]>(() => {
    const orgById = new Map(organizationRepository.getAll(true).map((o) => [o.id, o]))
    const projById = new Map(projectRepository.getAll(true).map((p) => [p.id, p]))
    return mvpDesignRepository
      .getAll()
      .filter((d) => d.status === 'finalized')
      .sort((a, b) => (b.finalizedAt ?? '').localeCompare(a.finalizedAt ?? ''))
      .map((design) => {
        const project = projById.get(design.projectId)
        return {
          design,
          orgName: orgById.get(design.organizationId)?.name ?? '알 수 없음',
          projectName: project?.name ?? '알 수 없음',
          projectType: project?.projectType ?? 'ax',
          stale: needsRedesign(design),
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => navigate('/mvp-design')}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        MVP 설계 워크벤치
      </button>
      <PageHeader
        title="MVP 설계 결과"
        description="확정된 MVP 설계를 모아 봅니다. 각 설계는 확정 시점의 핵심 과제 기준으로 동결되어 보존됩니다."
      />

      {rows.length === 0 ? (
        <Panel title="확정 설계" flush>
          <GuidedEmptyState
            icon={PencilRuler}
            title="아직 확정한 설계가 없습니다"
            reason="핵심 업무를 선정한 뒤 기능·화면 설계를 확정하면 이곳에 정리됩니다."
            flowPosition="3단계 · 기능·화면 설계"
            prereqs={[
              { label: '진단 결과 확정', done: false },
              { label: '만들 업무 1개 선택', done: false },
              { label: '기능·화면 설계 확정', done: false },
            ]}
            primaryLabel="기능·화면 설계로 이동"
            onPrimary={() => navigate('/mvp-design')}
            sampleLabel="샘플 설계 보기"
            onSample={() => demo.start()}
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((r) => {
            const must = r.design.features.filter((f) => f.scope === 'must').length
            const should = r.design.features.filter((f) => f.scope === 'should').length
            return (
              <button
                key={r.design.id}
                type="button"
                onClick={() => navigate(`/mvp-design/projects/${r.design.projectId}/review`)}
                className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-5 text-left shadow-(--shadow-card) hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{r.design.coreTaskName}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{r.orgName} · {r.projectName} · v{r.design.version}</p>
                  </div>
                  <DesignStatusBadge status={r.design.status} />
                </div>
                <p className="line-clamp-2 text-[13px] break-keep text-slate-600">{r.design.designSummary || r.design.autoSummary}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><BadgeCheck aria-hidden="true" className="size-3.5 text-success-500" />Must {must} · Should {should}</span>
                  <span>화면 {r.design.screens.filter((s) => s.scope !== 'excluded').length}개</span>
                  <span>{mvpLevelLabel(r.design.levelDecision.selectedLevel, r.projectType)}</span>
                </div>
                {r.stale && (
                  <span className="w-fit rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700">
                    핵심 과제 변경됨 · 재설계 권장
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
