import {
  Archive,
  Building2,
  Clock3,
  Eye,
  FolderKanban,
  FolderPlus,
  Pencil,
  Plus,
  ShieldAlert,
  UserRound,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Organization, OrganizationSortKey } from '../types/domain'
import type { ProjectStage } from '../types'
import { HEALTH_META, PROJECT_STAGE_META } from '../lib/statusMeta'
import { ORG_STATUS_META } from '../lib/domainMeta'
import { formatDate } from '../lib/format'
import { useStoreVersion } from '../lib/useStoreVersion'
import {
  archiveOrganization,
  listIndustries,
  searchOrganizationRows,
  type OrganizationRow,
} from '../services/organizationService'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { DataTable, type DataTableColumn } from '../components/ui/DataTable'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { EmptyState } from '../components/ui/EmptyState'
import { FilterBar } from '../components/ui/FilterBar'
import { PageHeader } from '../components/ui/PageHeader'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatusBadge } from '../components/ui/StatusBadge'
import { SummaryStrip } from '../components/ui/SummaryStrip'
import { useToast } from '../components/ui/toastContext'

const SORT_OPTIONS: { value: OrganizationSortKey; label: string }[] = [
  { value: 'updated', label: '최근 수정순' },
  { value: 'name', label: '고객사명순' },
  { value: 'progress', label: '진행률 높은 순' },
  { value: 'risk', label: '위험도 높은 순' },
]

const STAGE_OPTIONS = (
  Object.keys(PROJECT_STAGE_META) as ProjectStage[]
).map((stage) => ({ value: stage, label: PROJECT_STAGE_META[stage].label }))

export function ClientsListPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const version = useStoreVersion()
  const [searchParams, setSearchParams] = useSearchParams()
  const [archiveTarget, setArchiveTarget] = useState<OrganizationRow | null>(null)

  const query = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? ''
  const health = searchParams.get('health') ?? ''
  const industry = searchParams.get('industry') ?? ''
  const stage = searchParams.get('stage') ?? ''
  const sort = (searchParams.get('sort') ?? 'updated') as OrganizationSortKey

  const setParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  const hasActiveFilters =
    query !== '' || status !== '' || health !== '' || industry !== '' || stage !== ''

  const rows = useMemo(
    () =>
      searchOrganizationRows({
        query,
        status: (status || undefined) as OrganizationRow['organization']['status'] | undefined,
        health: (health || undefined) as Organization['healthStatus'] | undefined,
        industry: industry || undefined,
        stage: (stage || undefined) as ProjectStage | undefined,
        sort,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, status, health, industry, stage, sort, version],
  )

  const summary = useMemo(() => {
    const all = searchOrganizationRows({})
    const allProjects = all.flatMap((r) => r.projects)
    return {
      total: all.length,
      activeProjects: allProjects.filter((p) => p.status === 'active').length,
      waiting: allProjects.filter((p) => p.status === 'waiting_client').length,
      atRisk: all.filter((r) => r.organization.healthStatus !== 'healthy').length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const industries = useMemo(
    () => listIndustries(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )

  const handleArchive = () => {
    if (!archiveTarget) return
    try {
      archiveOrganization(archiveTarget.organization.id)
      showToast(`${archiveTarget.organization.name} 고객사를 보관 처리했습니다.`)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '보관 처리에 실패했습니다.',
      )
    }
    setArchiveTarget(null)
  }

  const rowMenu = (row: OrganizationRow) => (
    <DropdownMenu
      ariaLabel={`${row.organization.name} 더보기 메뉴`}
      items={[
        {
          key: 'view',
          label: '상세 보기',
          icon: Eye,
          onSelect: () => navigate(`/clients/${row.organization.id}`),
        },
        {
          key: 'edit',
          label: '수정',
          icon: Pencil,
          onSelect: () => navigate(`/clients/${row.organization.id}/edit`),
        },
        {
          key: 'new-project',
          label: '새 프로젝트 등록',
          icon: FolderPlus,
          onSelect: () =>
            navigate(`/projects/new?organizationId=${row.organization.id}`),
        },
        {
          key: 'archive',
          label: '보관',
          icon: Archive,
          danger: true,
          onSelect: () => setArchiveTarget(row),
        },
      ]}
    />
  )

  const columns: DataTableColumn<OrganizationRow>[] = [
    {
      key: 'name',
      header: '고객사',
      cell: (row) => (
        <div className="min-w-0">
          <p className="max-w-48 truncate text-sm font-semibold text-slate-800">
            {row.organization.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {ORG_STATUS_META[row.organization.status].label}
          </p>
        </div>
      ),
    },
    {
      key: 'industry',
      header: '업종',
      cell: (row) => (
        <span className="text-[13px] whitespace-nowrap text-slate-600">
          {row.organization.industry}
        </span>
      ),
    },
    {
      key: 'projects',
      header: '진행 프로젝트',
      cell: (row) =>
        row.primaryProject ? (
          <div className="min-w-0">
            <p className="max-w-52 truncate text-[13px] font-medium text-slate-700">
              {row.primaryProject.name}
            </p>
            {row.projects.length > 1 && (
              <p className="mt-0.5 text-xs text-slate-400">
                외 {row.projects.length - 1}건
              </p>
            )}
          </div>
        ) : (
          <span className="text-[13px] text-slate-400">프로젝트 없음</span>
        ),
    },
    {
      key: 'stage',
      header: '현재 단계',
      cell: (row) =>
        row.primaryProject ? (
          <StatusBadge tone={PROJECT_STAGE_META[row.primaryProject.currentStage].tone}>
            {PROJECT_STAGE_META[row.primaryProject.currentStage].label}
          </StatusBadge>
        ) : (
          <span className="text-[13px] text-slate-400">-</span>
        ),
    },
    {
      key: 'contact',
      header: '담당자',
      cell: (row) => (
        <span className="text-[13px] whitespace-nowrap text-slate-600">
          {row.organization.primaryContact.name}
        </span>
      ),
    },
    {
      key: 'progress',
      header: '진행률',
      className: 'w-36',
      cell: (row) =>
        row.primaryProject ? (
          <div className="flex items-center gap-2">
            <ProgressBar
              value={row.primaryProject.progress}
              tone={HEALTH_META[row.organization.healthStatus].tone}
              label={`${row.organization.name} 진행률`}
            />
            <span className="w-9 shrink-0 text-right text-xs font-semibold text-slate-600">
              {row.primaryProject.progress}%
            </span>
          </div>
        ) : (
          <span className="text-[13px] text-slate-400">-</span>
        ),
    },
    {
      key: 'health',
      header: '건강 상태',
      cell: (row) => (
        <StatusBadge tone={HEALTH_META[row.organization.healthStatus].tone} withDot>
          {HEALTH_META[row.organization.healthStatus].label}
        </StatusBadge>
      ),
    },
    {
      key: 'next-action',
      header: '다음 행동',
      className: 'hidden 2xl:table-cell',
      cell: (row) => (
        <span className="block max-w-56 truncate text-[13px] text-slate-600">
          {row.primaryProject?.nextAction || '-'}
        </span>
      ),
    },
    {
      key: 'updated',
      header: '최근 수정일',
      className: 'hidden xl:table-cell',
      cell: (row) => (
        <span className="text-[13px] whitespace-nowrap text-slate-500">
          {formatDate(row.organization.updatedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12 text-right',
      cell: (row) => rowMenu(row),
    },
  ]

  const totalEmpty = summary.total === 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="고객사"
        description="AX 진단, MVP 제작, 홈페이지 및 자금조달 프로젝트를 고객사별로 관리합니다."
        actions={
          <Button variant="primary" onClick={() => navigate('/clients/new')}>
            <Plus aria-hidden="true" className="size-4" />
            고객사 등록
          </Button>
        }
      />

      <SummaryStrip
        ariaLabel="고객사 운영 요약"
        items={[
          {
            key: 'total',
            label: '전체 고객사',
            value: summary.total,
            unit: '곳',
            tone: 'info',
            icon: Building2,
          },
          {
            key: 'active',
            label: '진행 중 프로젝트',
            value: summary.activeProjects,
            unit: '건',
            tone: 'success',
            icon: FolderKanban,
          },
          {
            key: 'waiting',
            label: '고객 응답 대기',
            value: summary.waiting,
            unit: '건',
            tone: 'warning',
            icon: Clock3,
          },
          {
            key: 'risk',
            label: '주의·리스크 고객사',
            value: summary.atRisk,
            unit: '곳',
            tone: 'danger',
            icon: ShieldAlert,
          },
        ]}
      />

      <FilterBar
        searchValue={query}
        searchPlaceholder="고객사명, 업종, 담당자, 프로젝트명 검색"
        onSearchChange={(value) => setParam('q', value)}
        hasActiveFilters={hasActiveFilters}
        resultCount={rows.length}
        resultUnit="곳"
        onReset={() =>
          setSearchParams(sort !== 'updated' ? { sort } : {}, { replace: true })
        }
        selects={[
          {
            key: 'status',
            ariaLabel: '고객사 상태 필터',
            value: status,
            placeholder: '고객사 상태',
            options: (['active', 'prospect', 'paused'] as const).map((s) => ({
              value: s,
              label: ORG_STATUS_META[s].label,
            })),
            onChange: (value) => setParam('status', value),
          },
          {
            key: 'health',
            ariaLabel: '건강 상태 필터',
            value: health,
            placeholder: '건강 상태',
            options: (['healthy', 'attention', 'risk'] as const).map((h) => ({
              value: h,
              label: HEALTH_META[h].label,
            })),
            onChange: (value) => setParam('health', value),
          },
          {
            key: 'industry',
            ariaLabel: '업종 필터',
            value: industry,
            placeholder: '업종',
            options: industries.map((i) => ({ value: i, label: i })),
            onChange: (value) => setParam('industry', value),
          },
          {
            key: 'stage',
            ariaLabel: '현재 프로젝트 단계 필터',
            value: stage,
            placeholder: '프로젝트 단계',
            options: STAGE_OPTIONS,
            onChange: (value) => setParam('stage', value),
          },
          {
            key: 'sort',
            ariaLabel: '정렬',
            value: sort,
            placeholder: '최근 수정순',
            options: SORT_OPTIONS.filter((o) => o.value !== 'updated'),
            onChange: (value) => setParam('sort', value),
          },
        ]}
      />

      {rows.length === 0 ? (
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          {totalEmpty ? (
            <EmptyState
              icon={Building2}
              title="등록된 고객사가 없습니다"
              description="첫 고객사를 등록하고 AX 진단부터 자료 패키지까지 흐름을 시작하세요."
              action={
                <Button variant="primary" onClick={() => navigate('/clients/new')}>
                  <Plus aria-hidden="true" className="size-4" />첫 고객사 등록
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Building2}
              title="조건에 맞는 고객사가 없습니다"
              description="검색어 또는 필터를 조정해 보세요."
              action={
                <Button
                  variant="secondary"
                  onClick={() => setSearchParams({}, { replace: true })}
                >
                  필터 초기화
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <>
          {/* 데스크톱 표 */}
          <div className="hidden overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card) lg:block">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.organization.id}
              rowAriaLabel={(row) => `${row.organization.name} 상세 보기`}
              onRowClick={(row) => navigate(`/clients/${row.organization.id}`)}
            />
          </div>

          {/* 모바일/태블릿 카드 목록 */}
          <ul className="flex flex-col gap-3 lg:hidden">
            {rows.map((row) => (
              <li
                key={row.organization.id}
                className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)"
              >
                <div className="flex items-start justify-between gap-2 px-4 pt-4">
                  <button
                    type="button"
                    onClick={() => navigate(`/clients/${row.organization.id}`)}
                    className="min-w-0 cursor-pointer text-left"
                  >
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {row.organization.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {row.organization.industry} ·{' '}
                      {row.organization.primaryContact.name}
                    </p>
                  </button>
                  {rowMenu(row)}
                </div>
                <div className="flex flex-wrap items-center gap-2 px-4 pt-2.5">
                  <StatusBadge tone={HEALTH_META[row.organization.healthStatus].tone} withDot>
                    {HEALTH_META[row.organization.healthStatus].label}
                  </StatusBadge>
                  {row.primaryProject && (
                    <StatusBadge
                      tone={PROJECT_STAGE_META[row.primaryProject.currentStage].tone}
                    >
                      {PROJECT_STAGE_META[row.primaryProject.currentStage].label}
                    </StatusBadge>
                  )}
                </div>
                <div className="px-4 pt-3 pb-4">
                  {row.primaryProject ? (
                    <>
                      <p className="truncate text-[13px] font-medium text-slate-700">
                        {row.primaryProject.name}
                        {row.projects.length > 1 && (
                          <span className="ml-1 text-xs font-normal text-slate-400">
                            외 {row.projects.length - 1}건
                          </span>
                        )}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <ProgressBar
                          value={row.primaryProject.progress}
                          tone={HEALTH_META[row.organization.healthStatus].tone}
                          label={`${row.organization.name} 진행률`}
                        />
                        <span className="shrink-0 text-xs font-semibold text-slate-600">
                          {row.primaryProject.progress}%
                        </span>
                      </div>
                      {row.primaryProject.nextAction && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                          <UserRound aria-hidden="true" className="size-3 shrink-0" />
                          <span className="truncate">
                            다음 행동: {row.primaryProject.nextAction}
                          </span>
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-[13px] text-slate-400">
                      연결된 프로젝트가 없습니다.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmModal
        open={archiveTarget !== null}
        title="고객사 보관"
        message={`${archiveTarget?.organization.name ?? ''} 고객사를 보관할까요? 보관된 고객사는 기본 목록에서 숨겨집니다.`}
        warning={
          archiveTarget && archiveTarget.activeCount > 0
            ? '진행 중인 프로젝트가 있습니다. 고객사를 보관해도 프로젝트 데이터는 삭제되지 않지만 기본 목록에서 숨겨집니다.'
            : undefined
        }
        confirmLabel="보관 처리"
        danger
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  )
}
