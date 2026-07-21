import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  Lock,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import type { Project } from '../../types/domain'
import type { ValidationTrackType, ValidationWorkspace } from '../../types/validation'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { organizationRepository, projectRepository } from '../../repositories'
import {
  getProjectValidationContext,
  getValidationEligibility,
  summarize,
} from '../../services/validationService'
import { Button } from '../../components/ui/Button'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { HelpNote } from '../../components/ui/HelpNote'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { SummaryStrip } from '../../components/ui/SummaryStrip'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import { TrackBadge, WorkspaceStatusBadge } from '../../components/validation/badges'
import { TRACK_META } from '../../lib/validationMeta'

interface TrackRow {
  trackType: ValidationTrackType
  workspace: ValidationWorkspace | null
  available: boolean
  reason: string
}

interface Row {
  project: Project
  orgName: string
  tracks: TrackRow[]
}

interface BlockedItem {
  project: Project
  orgName: string
  trackType: ValidationTrackType
  reason: string
}

export function ValidationMainPage() {
  const navigate = useNavigate()
  const version = useStoreVersion()

  const { rows, blocked, counts } = useMemo(() => {
    const orgById = new Map(organizationRepository.getAll(true).map((o) => [o.id, o]))
    const projects = projectRepository.getAll().filter((p) => p.status !== 'archived')

    const rowList: Row[] = []
    const blockedList: BlockedItem[] = []
    let preparing = 0
    let testing = 0
    let finalized = 0
    let criticalIssues = 0

    for (const project of projects) {
      const orgName = orgById.get(project.organizationId)?.name ?? '알 수 없음'
      const eligibilities = getValidationEligibility(project)
      const context = getProjectValidationContext(project.id)

      const tracks: TrackRow[] = eligibilities.map((el) => {
        const workspace =
          context?.tracks.find((t) => t.trackType === el.trackType)?.workspace ?? null
        return { trackType: el.trackType, workspace, available: el.available, reason: el.reason }
      })

      for (const el of eligibilities) {
        if (!el.available) {
          blockedList.push({ project, orgName, trackType: el.trackType, reason: el.reason })
        }
      }

      const availableTracks = tracks.filter((t) => t.available)
      if (availableTracks.length === 0) continue

      for (const t of availableTracks) {
        const w = t.workspace
        if (!w || w.status === 'draft' || w.status === 'ready') {
          preparing += 1
        } else if (w.status === 'testing' || w.status === 'evaluating') {
          testing += 1
        } else if (w.status === 'finalized') {
          finalized += 1
        }
        if (w && summarize(w).hasOpenCritical) criticalIssues += 1
      }

      rowList.push({ project, orgName, tracks })
    }

    return {
      rows: rowList,
      blocked: blockedList,
      counts: { preparing, testing, finalized, criticalIssues },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const go = (r: Row) => navigate(`/validation/projects/${r.project.id}`)

  const columns: DataTableColumn<Row>[] = [
    {
      key: 'client',
      header: '고객사',
      cell: (r) => <span className="text-[0.95rem] font-medium text-slate-700">{r.orgName}</span>,
    },
    {
      key: 'project',
      header: '프로젝트',
      className: 'min-w-[160px]',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{r.project.name}</p>
          <p className="text-[0.9rem] text-slate-400">{r.project.projectCode}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: '유형',
      cell: (r) => <ProjectTypeBadge type={r.project.projectType} compact />,
    },
    {
      key: 'tracks',
      header: '트랙별 상태',
      className: 'min-w-[240px]',
      cell: (r) => (
        <div className="flex flex-col gap-1.5">
          {r.tracks
            .filter((t) => t.available)
            .map((t) => (
              <div key={t.trackType} className="flex flex-wrap items-center gap-1.5">
                <TrackBadge track={t.trackType} />
                {t.workspace ? (
                  <WorkspaceStatusBadge status={t.workspace.status} />
                ) : (
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.9rem] font-medium text-slate-500">
                    준비 필요
                  </span>
                )}
              </div>
            ))}
        </div>
      ),
    },
    {
      key: 'action',
      header: '',
      className: 'text-right',
      cell: () => (
        <span className="inline-flex items-center gap-1 text-[0.95rem] font-semibold text-brand-600">
          트랙 보기
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="실제 사용 테스트"
        description="확정된 AX MVP·홈페이지 설계를 실제 사용 환경에서 테스트하고 Stage-Gate로 판정합니다."
        actions={
          <Button variant="primary" onClick={() => navigate('/validation/results')}>
            결과 보기
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        }
      />

      <HelpNote
        summary="트랙(AX MVP·홈페이지)별로 ① 계획 → ② 제작·참여자 → ③ 시나리오 → ④ 회차 실행 → ⑤ 피드백·이슈 → ⑥ KPI → ⑦ Gate 판정 → ⑧ 다음 결정 순으로 진행합니다."
        what="실제 사용자가 제작물을 사용해 보고, 근거(관찰·측정)를 기록해 통과 여부를 판정합니다."
        when="AX MVP 설계 또는 홈페이지 설계를 확정한 뒤 사용합니다."
        next="검증을 확정하면 다음 단계(유지·수정·확대·운영 전환) 결정으로 이어집니다."
      />

      <SummaryStrip
        ariaLabel="실제 사용 테스트 요약"
        items={[
          { key: 'preparing', label: '테스트 준비', value: counts.preparing, unit: '트랙', tone: 'info', icon: ClipboardCheck },
          { key: 'testing', label: '테스트 중', value: counts.testing, unit: '트랙', tone: 'warning', icon: FlaskConical },
          { key: 'finalized', label: '검증 확정', value: counts.finalized, unit: '트랙', tone: 'success', icon: CheckCircle2 },
          { key: 'critical', label: '중대 이슈', value: counts.criticalIssues, unit: '트랙', tone: 'danger', icon: ShieldAlert },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => navigate('/validation/projects/proj-101')}>
          <Sparkles aria-hidden="true" className="size-4" />
          대한정밀 샘플 보기
        </Button>
      </div>

      <p className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-[0.95rem] break-keep text-slate-500">
        AX MVP와 홈페이지는 서로 독립된 트랙입니다. 통과율·판정은 절대 합산하지 않고 트랙별로 따로 확정합니다.
      </p>

      <Panel title="테스트 대상 프로젝트" flush>
        {rows.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="테스트할 수 있는 프로젝트가 없습니다"
            description="AX MVP 설계 또는 홈페이지 설계를 확정하면 이곳에 표시됩니다."
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(r) => r.project.id}
                rowAriaLabel={(r) => `${r.project.name} 실제 사용 테스트`}
                onRowClick={go}
              />
            </div>
            <ul className="flex flex-col divide-y divide-slate-100 lg:hidden">
              {rows.map((r) => (
                <li key={r.project.id}>
                  <button
                    type="button"
                    onClick={() => go(r)}
                    className="flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {r.orgName} · {r.project.name}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {r.tracks
                          .filter((t) => t.available)
                          .map((t) => (
                            <span key={t.trackType} className="inline-flex items-center gap-1">
                              <TrackBadge track={t.trackType} />
                              {t.workspace ? (
                                <WorkspaceStatusBadge status={t.workspace.status} />
                              ) : (
                                <span className="text-[0.9rem] text-slate-400">준비 필요</span>
                              )}
                            </span>
                          ))}
                      </div>
                    </div>
                    <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-300" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      {blocked.length > 0 && (
        <Panel title="설계 확정이 필요한 트랙">
          <p className="mb-3 text-[0.95rem] break-keep text-slate-500">
            아래 트랙은 출처 설계가 확정(FINALIZED)되어야 실제 사용 테스트를 시작할 수 있습니다.
          </p>
          <ul className="flex flex-col gap-2">
            {blocked.map((b) => (
              <li key={`${b.project.id}-${b.trackType}`}>
                <button
                  type="button"
                  onClick={() => navigate(`/validation/projects/${b.project.id}`)}
                  className="flex w-full items-start gap-2.5 rounded-(--radius-control) border border-slate-200 px-3.5 py-2.5 text-left hover:bg-slate-50"
                >
                  <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[0.95rem] font-medium text-slate-700">
                        {b.orgName} · {b.project.name}
                      </span>
                      <TrackBadge track={b.trackType} />
                    </span>
                    <span className="mt-0.5 block text-[0.9rem] break-keep text-slate-500">
                      {b.reason || `${TRACK_META[b.trackType].label} 출처 설계를 먼저 확정하세요.`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
