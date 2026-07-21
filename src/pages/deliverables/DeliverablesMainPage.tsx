import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  FilePlus2,
  FileText,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import type { Project } from '../../types/domain'
import type { DeliverablePackage } from '../../types/deliverables'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { organizationRepository, projectRepository } from '../../repositories'
import {
  countDeliverablePending,
  getDeliverableEligibility,
  getProjectDeliverableContext,
} from '../../services/deliverableService'
import type { DeliverableEligibility } from '../../services/deliverables/sourceCollector'
import { Button } from '../../components/ui/Button'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { HelpNote } from '../../components/ui/HelpNote'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { SummaryStrip } from '../../components/ui/SummaryStrip'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import { PackageStatusBadge } from '../../components/deliverables/badges'

interface Row {
  project: Project
  orgName: string
  eligibility: DeliverableEligibility
  latest: DeliverablePackage | null
  latestStale: boolean
}

function eligibleSources(e: DeliverableEligibility): string[] {
  return [
    e.hasDiagnosis ? '진단' : null,
    e.hasSelection ? '과제선정' : null,
    e.hasAx ? 'AX설계' : null,
    e.hasWebsite ? '홈페이지설계' : null,
    e.hasValidation ? '테스트' : null,
  ].filter((v): v is string => v !== null)
}

export function DeliverablesMainPage() {
  const navigate = useNavigate()
  const version = useStoreVersion()

  const { rows, counts } = useMemo(() => {
    const orgById = new Map(organizationRepository.getAll(true).map((o) => [o.id, o]))
    const all = projectRepository.getAll().filter((p) => p.status !== 'archived')
    const built: Row[] = []
    for (const project of all) {
      const eligibility = getDeliverableEligibility(project.id)
      const context = getProjectDeliverableContext(project.id)
      if (!eligibility || !context) continue
      built.push({
        project,
        orgName: orgById.get(project.organizationId)?.name ?? '알 수 없음',
        eligibility,
        latest: context.latest,
        latestStale: context.latestStale,
      })
    }
    return { rows: built, counts: countDeliverablePending() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const creatable = rows.filter((r) => r.eligibility.canCreate)
  const inProgress = rows.filter((r) => r.latest && r.latest.status === 'draft')
  const stale = rows.filter((r) => r.latest && r.latestStale)
  const finalized = rows.filter((r) => r.latest && r.latest.status === 'finalized')

  const go = (r: Row) => navigate(`/deliverables/projects/${r.project.id}`)

  const columns: DataTableColumn<Row>[] = [
    { key: 'client', header: '고객사', cell: (r) => <span className="text-[0.9rem] font-medium text-slate-700">{r.orgName}</span> },
    {
      key: 'project', header: '프로젝트', className: 'min-w-[150px]',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{r.project.name}</p>
          <p className="text-[0.9rem] text-slate-400">{r.project.projectCode}</p>
        </div>
      ),
    },
    { key: 'type', header: '유형', cell: (r) => <ProjectTypeBadge type={r.project.projectType} compact /> },
    {
      key: 'sources', header: '사용 가능한 확정 결과', className: 'hidden lg:table-cell',
      cell: (r) => {
        const labels = eligibleSources(r.eligibility)
        if (labels.length === 0) return <span className="text-[0.9rem] text-slate-400">없음</span>
        return (
          <div className="flex flex-wrap gap-1">
            {labels.map((label) => (
              <span key={label} className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.82rem] font-medium text-slate-600">{label}</span>
            ))}
          </div>
        )
      },
    },
    {
      key: 'latest', header: '최신 자료 상태', className: 'hidden xl:table-cell',
      cell: (r) => (r.latest ? <PackageStatusBadge status={r.latest.status} /> : <span className="text-[0.9rem] text-slate-400">없음</span>),
    },
    {
      key: 'action', header: '', className: 'text-right',
      cell: (r) => (
        <span className="inline-flex items-center gap-1 text-[0.9rem] font-semibold text-brand-600">
          {r.latest ? '자료 보기' : '자료 만들기'}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="제출자료 만들기"
        description="확정된 진단·설계·테스트 결과를 보고서와 개발 지시문으로 정리합니다."
        actions={
          <Button variant="primary" onClick={() => navigate('/deliverables/results')}>
            자료 결과 보기
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        }
      />

      <HelpNote
        summary="① 확정된 결과 선택 → ② 자료 패키지 생성 → ③ 공개 범위 분리 → ④ 검토·확정 → ⑤ 인쇄·내보내기 순서로 제출자료를 만듭니다."
        what="진단·과제선정·AX 설계·홈페이지 설계·테스트의 확정 스냅샷을 보고서·개발명세·로드맵·개발 프롬프트로 정리합니다."
        when="각 단계 결과를 확정한 뒤 고객·개발자·기관에 전달할 자료가 필요할 때 사용합니다."
        next="자료를 확정하면 대상 독자별로 인쇄하거나 파일로 내보낼 수 있습니다. AX와 홈페이지 결과는 합산하지 않습니다."
      />

      <SummaryStrip
        ariaLabel="제출자료 요약"
        items={[
          { key: 'creatable', label: '자료 생성 가능', value: counts.creatable, unit: '건', tone: 'info', icon: FilePlus2 },
          { key: 'progress', label: '작성 중', value: counts.inProgress, unit: '건', tone: 'warning', icon: FileText },
          { key: 'review', label: '검토 필요', value: counts.needsReview, unit: '건', tone: 'accent', icon: ShieldAlert },
          { key: 'stale', label: '원본 변경', value: counts.stale, unit: '건', tone: 'warning', icon: RefreshCw },
          { key: 'errors', label: '품질 오류', value: counts.qualityErrors, unit: '건', tone: 'danger', icon: AlertTriangle },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => navigate('/deliverables/projects/proj-101')}>
          <Sparkles aria-hidden="true" className="size-4" />
          샘플 프로젝트 자료 보기
        </Button>
      </div>

      <Panel title="자료를 만들 수 있는 프로젝트" flush>
        {creatable.length === 0 ? (
          <EmptyState
            icon={FilePlus2}
            title="아직 자료를 만들 수 있는 프로젝트가 없습니다"
            description="제출자료는 확정된 진단 결과 또는 확정된 AX MVP·홈페이지 설계가 있어야 만들 수 있습니다. 먼저 진단·설계를 확정하세요."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" onClick={() => navigate('/diagnosis')}>진단으로 이동</Button>
                <Button variant="secondary" onClick={() => navigate('/mvp-design')}>AX 설계로 이동</Button>
              </div>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <DataTable columns={columns} rows={creatable} rowKey={(r) => r.project.id} rowAriaLabel={(r) => `${r.project.name} 제출자료`} onRowClick={go} />
            </div>
            <ul className="flex flex-col divide-y divide-slate-100 lg:hidden">
              {creatable.map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{r.orgName} · {r.project.name}</p>
                      <p className="text-[0.9rem] text-slate-400">{eligibleSources(r.eligibility).join(' · ') || '확정 결과 없음'}</p>
                    </div>
                    <span className="shrink-0 text-[0.9rem] font-semibold text-brand-600">{r.latest ? '자료 보기' : '자료 만들기'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="작성 중" flush>
          {inProgress.length === 0 ? (
            <div className="px-5 py-8 text-center text-[0.9rem] text-slate-400">작성 중인 자료가 없습니다.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {inProgress.map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-medium text-slate-800">{r.orgName} · {r.project.name}</p>
                      <p className="text-[0.9rem] text-slate-400">{r.latest?.name}</p>
                    </div>
                    {r.latest && <PackageStatusBadge status={r.latest.status} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="원본 변경 확인 필요" flush>
          {stale.length === 0 ? (
            <div className="px-5 py-8 text-center text-[0.9rem] text-slate-400">원본이 변경된 자료가 없습니다.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stale.map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-medium text-slate-800">{r.orgName} · {r.project.name}</p>
                      <p className="text-[0.9rem] text-warning-600">출처 원본이 변경됨 · 새 버전 검토 필요</p>
                    </div>
                    <RefreshCw aria-hidden="true" className="size-4 shrink-0 text-warning-500" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="최근 확정 자료" flush>
        {finalized.length === 0 ? (
          <div className="px-5 py-8 text-center text-[0.9rem] text-slate-400">확정된 자료가 없습니다.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {finalized.map((r) => (
              <li key={r.project.id}>
                <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-medium text-slate-800">{r.orgName} · {r.project.name}</p>
                    <p className="text-[0.9rem] text-slate-400">{r.latest?.name} · v{r.latest?.version}</p>
                  </div>
                  {r.latest && <PackageStatusBadge status={r.latest.status} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
