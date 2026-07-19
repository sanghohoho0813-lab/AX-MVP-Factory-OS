import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  FlaskConical,
  PencilRuler,
  RefreshCw,
} from 'lucide-react'
import type { Project } from '../../types/domain'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { memberName } from '../../data/members'
import {
  mvpDesignRepository,
  organizationRepository,
  projectRepository,
} from '../../repositories'
import {
  getDesignEligibility,
  getProjectDesignLifecycle,
  type DesignLifecycle,
} from '../../services/mvpDesignService'
import { Button } from '../../components/ui/Button'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { SummaryStrip } from '../../components/ui/SummaryStrip'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import { DesignStatusBadge } from '../../components/mvpDesign/badges'
import type { MvpDesignStatus } from '../../types/mvpDesign'

interface Row {
  project: Project
  orgName: string
  lifecycle: DesignLifecycle
  coreTask: string | null
  status: MvpDesignStatus | null
  mustCount: number
}

const LIFECYCLE_ACTION: Record<DesignLifecycle, string> = {
  website_only: '웹사이트 스튜디오',
  not_eligible: '과제선별',
  ready_to_design: '설계 시작',
  draft: '설계 계속',
  reviewed: '설계 검토',
  finalized: '설계 보기',
  needs_redesign: '재설계',
}

export function MvpDesignMainPage() {
  const navigate = useNavigate()
  const version = useStoreVersion()

  const rows = useMemo<Row[]>(() => {
    const orgById = new Map(organizationRepository.getAll(true).map((o) => [o.id, o]))
    return projectRepository
      .getAll()
      .filter((p) => p.projectType !== 'website' && p.status !== 'archived')
      .map((project) => {
        const eligibility = getDesignEligibility(project)
        if (!eligibility.canDesign && !mvpDesignRepository.getLatestByProjectId(project.id)) return null
        const design = mvpDesignRepository.getLatestByProjectId(project.id)
        return {
          project,
          orgName: orgById.get(project.organizationId)?.name ?? '알 수 없음',
          lifecycle: getProjectDesignLifecycle(project),
          coreTask: design?.coreTaskName ?? eligibility.handoff?.primaryCandidate?.name ?? null,
          status: design?.status ?? null,
          mustCount: design?.features.filter((f) => f.scope === 'must').length ?? 0,
        }
      })
      .filter((r): r is Row => r !== null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const toDesign = rows.filter((r) => r.lifecycle === 'ready_to_design' || r.lifecycle === 'needs_redesign')
  const inProgress = rows.filter((r) => r.lifecycle === 'draft' || r.lifecycle === 'reviewed')
  const finalized = rows.filter((r) => r.lifecycle === 'finalized')

  const go = (r: Row) => navigate(`/mvp-design/projects/${r.project.id}`)

  const columns: DataTableColumn<Row>[] = [
    { key: 'client', header: '고객사', cell: (r) => <span className="text-[13px] font-medium text-slate-700">{r.orgName}</span> },
    {
      key: 'project', header: '프로젝트', className: 'min-w-[150px]',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{r.project.name}</p>
          <p className="text-xs text-slate-400">{r.project.projectCode}</p>
        </div>
      ),
    },
    { key: 'type', header: '유형', cell: (r) => <ProjectTypeBadge type={r.project.projectType} compact /> },
    { key: 'core', header: '핵심 과제', className: 'hidden lg:table-cell', cell: (r) => <span className="text-[13px] text-slate-600">{r.coreTask ?? '-'}</span> },
    {
      key: 'action', header: '', className: 'text-right',
      cell: (r) => (
        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-600">
          {LIFECYCLE_ACTION[r.lifecycle]}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="MVP 설계 워크벤치"
        description="확정된 핵심 과제를 실제 개발 가능한 기능·화면·데이터·권한·검증 기준으로 설계합니다. 1차 MVP는 하나의 핵심 업무에 집중합니다."
        actions={
          <Button variant="primary" onClick={() => navigate('/mvp-design/results')}>
            설계 결과 보기
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        }
      />

      <SummaryStrip
        ariaLabel="MVP 설계 요약"
        items={[
          { key: 'todesign', label: '설계 대기', value: toDesign.length, unit: '건', tone: 'info', icon: PencilRuler },
          { key: 'progress', label: '설계 진행 중', value: inProgress.length, unit: '건', tone: 'warning', icon: FlaskConical },
          { key: 'finalized', label: '설계 확정', value: finalized.length, unit: '건', tone: 'success', icon: CheckCircle2 },
          { key: 'redesign', label: '재설계 필요', value: rows.filter((r) => r.lifecycle === 'needs_redesign').length, unit: '건', tone: 'warning', icon: RefreshCw },
        ]}
      />

      <Panel title="설계가 필요한 프로젝트" flush>
        {toDesign.length === 0 ? (
          <EmptyState
            icon={BadgeCheck}
            title="설계가 필요한 프로젝트가 없습니다"
            description="과제선별에서 핵심 과제가 확정된 AX 프로젝트가 생기면 이곳에 표시됩니다."
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <DataTable columns={columns} rows={toDesign} rowKey={(r) => r.project.id} rowAriaLabel={(r) => `${r.project.name} MVP 설계`} onRowClick={go} />
            </div>
            <ul className="flex flex-col divide-y divide-slate-100 lg:hidden">
              {toDesign.map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{r.orgName} · {r.project.name}</p>
                      <p className="text-xs text-slate-400">{r.coreTask ?? '핵심 과제 확정됨'}</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold text-brand-600">{LIFECYCLE_ACTION[r.lifecycle]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="진행 중인 설계" flush>
          {inProgress.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-slate-400">진행 중인 설계가 없습니다.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {inProgress.map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-medium text-slate-800">{r.orgName} · {r.coreTask ?? r.project.name}</p>
                      <p className="text-xs text-slate-400">필수 기능 {r.mustCount}건</p>
                    </div>
                    {r.status && <DesignStatusBadge status={r.status} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="최근 확정 설계" flush>
          {finalized.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-slate-400">확정된 설계가 없습니다.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {finalized.map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-medium text-slate-800">{r.coreTask ?? r.project.name}</p>
                      <p className="text-xs text-slate-400">{r.orgName} · {memberName(r.project.ownerId)}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-slate-800">{r.mustCount} Must</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="text-xs text-slate-400">
        설계 산출물은 확정 핵심 과제와 사전 정의된 설계 규칙으로 생성됩니다. 원본 과제가 바뀌어도 확정된 설계는 보존됩니다.
      </p>
    </div>
  )
}
