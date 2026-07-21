import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Palette,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import type { Project } from '../../types/domain'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { memberName } from '../../data/members'
import {
  organizationRepository,
  projectRepository,
  websiteDesignRepository,
} from '../../repositories'
import {
  getWebsiteEligibility,
  getWebsiteLifecycle,
  type WebsiteLifecycle,
} from '../../services/websiteDesignService'
import { Button } from '../../components/ui/Button'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { HelpNote } from '../../components/ui/HelpNote'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { SummaryStrip } from '../../components/ui/SummaryStrip'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import { WebsiteStatusBadge, WebsiteTypeBadge } from '../../components/websiteStudio/badges'
import type { WebsiteDesignStatus, WebsiteType } from '../../types/websiteDesign'

interface Row {
  project: Project
  orgName: string
  lifecycle: WebsiteLifecycle
  readiness: number | null
  websiteType: WebsiteType | null
  status: WebsiteDesignStatus | null
  missingContent: number
  missingAssets: number
}

const LIFECYCLE_ACTION: Record<WebsiteLifecycle, string> = {
  not_applicable: 'AX 설계',
  ready_to_design: '설계 시작',
  draft: '설계 계속',
  reviewed: '설계 검토',
  finalized: '설계 보기',
  needs_redesign: '재설계',
}

export function WebsiteStudioMainPage() {
  const navigate = useNavigate()
  const version = useStoreVersion()

  const { rows, axProjects } = useMemo(() => {
    const orgById = new Map(organizationRepository.getAll(true).map((o) => [o.id, o]))
    const all = projectRepository.getAll().filter((p) => p.status !== 'archived')
    const targetRows: Row[] = all
      .filter((p) => p.projectType === 'website' || p.projectType === 'ax_website')
      .map((project) => {
        const eligibility = getWebsiteEligibility(project)
        const design = websiteDesignRepository.getLatestByProjectId(project.id)
        return {
          project,
          orgName: orgById.get(project.organizationId)?.name ?? '알 수 없음',
          lifecycle: getWebsiteLifecycle(project),
          readiness: eligibility.readiness?.overallScore ?? null,
          websiteType: design?.strategy.websiteType ?? null,
          status: design?.status ?? null,
          missingContent: design?.contentItems.filter((c) => c.required && c.status === 'missing').length ?? 0,
          missingAssets: design?.assetRequirements.filter((a) => a.required && a.status === 'missing').length ?? 0,
        }
      })
    return { rows: targetRows, axProjects: all.filter((p) => p.projectType === 'ax') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const toDesign = rows.filter((r) => r.lifecycle === 'ready_to_design' || r.lifecycle === 'needs_redesign')
  const inProgress = rows.filter((r) => r.lifecycle === 'draft' || r.lifecycle === 'reviewed')
  const finalized = rows.filter((r) => r.lifecycle === 'finalized')

  const go = (r: Row) => navigate(`/website-studio/projects/${r.project.id}`)
  const startSample = () => navigate('/website-studio/projects/proj-106')

  const columns: DataTableColumn<Row>[] = [
    { key: 'client', header: '고객사', cell: (r) => <span className="text-[0.9rem] font-medium text-slate-700">{r.orgName}</span> },
    {
      key: 'project', header: '프로젝트', className: 'min-w-[150px]',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{r.project.name}</p>
          <p className="text-[0.85rem] text-slate-400">{r.project.projectCode}</p>
        </div>
      ),
    },
    { key: 'type', header: '유형', cell: (r) => <ProjectTypeBadge type={r.project.projectType} compact /> },
    { key: 'readiness', header: '준비도', className: 'hidden lg:table-cell', cell: (r) => <span className="text-[0.9rem] text-slate-600">{r.readiness !== null ? `${r.readiness}점` : '미확정'}</span> },
    { key: 'missing', header: '부족 자료', className: 'hidden xl:table-cell', cell: (r) => <span className="text-[0.9rem] text-slate-600">콘텐츠 {r.missingContent} · 자산 {r.missingAssets}</span> },
    {
      key: 'action', header: '', className: 'text-right',
      cell: (r) => (
        <span className="inline-flex items-center gap-1 text-[0.9rem] font-semibold text-brand-600">
          {LIFECYCLE_ACTION[r.lifecycle]}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="홈페이지 설계"
        description="홈페이지 진단 결과를 사이트 구조·콘텐츠·디자인 방향과 개발 지시문으로 정리합니다."
        actions={
          <Button variant="primary" onClick={() => navigate('/website-studio/results')}>
            설계 결과 보기
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        }
      />

      <HelpNote
        summary="홈페이지는 ① 목표·고객 → ② 사이트 구조 → ③ 페이지·섹션 → ④ 콘텐츠·자료 → ⑤ 디자인 → ⑥ 개발 지시문 순서로 설계합니다."
        what="진단 결과를 바탕으로 사이트 구조와 필요한 콘텐츠·자산, 디자인 방향, 개발 지시문을 만듭니다."
        when="홈페이지 제작(website·ax_website) 프로젝트에서 사용합니다. 실제 코딩·배포는 하지 않습니다."
        next="설계를 확정하면 개발 지시문을 Claude Code 등에 전달할 수 있습니다."
      />

      <SummaryStrip
        ariaLabel="홈페이지 설계 요약"
        items={[
          { key: 'todesign', label: '설계 대기', value: toDesign.length, unit: '건', tone: 'info', icon: Palette },
          { key: 'progress', label: '설계 중', value: inProgress.length, unit: '건', tone: 'warning', icon: FlaskConical },
          { key: 'finalized', label: '설계 확정', value: finalized.length, unit: '건', tone: 'success', icon: CheckCircle2 },
          { key: 'redesign', label: '재설계 필요', value: rows.filter((r) => r.lifecycle === 'needs_redesign').length, unit: '건', tone: 'warning', icon: RefreshCw },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={startSample}>
          <Sparkles aria-hidden="true" className="size-4" />
          한빛세무사무소 샘플 보기
        </Button>
      </div>

      <Panel title="설계가 필요한 홈페이지 프로젝트" flush>
        {toDesign.length === 0 ? (
          <EmptyState icon={Palette} title="설계가 필요한 프로젝트가 없습니다" description="홈페이지 제작 프로젝트가 생기면 이곳에 표시됩니다." />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <DataTable columns={columns} rows={toDesign} rowKey={(r) => r.project.id} rowAriaLabel={(r) => `${r.project.name} 홈페이지 설계`} onRowClick={go} />
            </div>
            <ul className="flex flex-col divide-y divide-slate-100 lg:hidden">
              {toDesign.map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{r.orgName} · {r.project.name}</p>
                      <p className="text-[0.85rem] text-slate-400">준비도 {r.readiness !== null ? `${r.readiness}점` : '미확정'}</p>
                    </div>
                    <span className="shrink-0 text-[0.9rem] font-semibold text-brand-600">{LIFECYCLE_ACTION[r.lifecycle]}</span>
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
            <div className="px-5 py-8 text-center text-[0.9rem] text-slate-400">진행 중인 설계가 없습니다.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {inProgress.map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-medium text-slate-800">{r.orgName} · {r.project.name}</p>
                      <p className="text-[0.85rem] text-slate-400">부족 콘텐츠 {r.missingContent} · 자산 {r.missingAssets}</p>
                    </div>
                    {r.status && <WebsiteStatusBadge status={r.status} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="최근 확정 설계" flush>
          {finalized.length === 0 ? (
            <div className="px-5 py-8 text-center text-[0.9rem] text-slate-400">확정된 설계가 없습니다.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {finalized.map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-medium text-slate-800">{r.orgName} · {r.project.name}</p>
                      <p className="text-[0.85rem] text-slate-400">{memberName(r.project.ownerId)}</p>
                    </div>
                    {r.websiteType && <WebsiteTypeBadge type={r.websiteType} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {axProjects.length > 0 && (
        <Panel title="AX 전용 프로젝트 (홈페이지 설계 대상 아님)">
          <p className="mb-2 text-[0.9rem] break-keep text-slate-500">
            아래 프로젝트는 홈페이지 트랙이 없어 홈페이지 설계 대상이 아닙니다. AX 설계에서 진행하세요.
          </p>
          <ul className="flex flex-wrap gap-2">
            {axProjects.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => navigate(`/mvp-design/projects/${p.id}`)} className="rounded-(--radius-control) border border-slate-200 px-3 py-1.5 text-[0.9rem] text-slate-600 hover:bg-slate-50">
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
