import { Archive, Layers, Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ModuleFilters, SurveyModule } from '../../types/survey'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { formatDate } from '../../lib/format'
import {
  MODULE_KIND_META,
  MODULE_STATUS_META,
  RESPONDENT_ROLES,
  RESPONDENT_ROLE_META,
  industryKeyLabel,
  objectiveKeyLabel,
} from '../../lib/surveyMeta'
import { surveyModuleRepository } from '../../repositories'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { DiagnosisStudioNav } from '../../components/diagnosis/DiagnosisStudioNav'
import { DropdownMenu } from '../../components/ui/DropdownMenu'
import { EmptyState } from '../../components/ui/EmptyState'
import { FilterBar } from '../../components/ui/FilterBar'
import { PageHeader } from '../../components/ui/PageHeader'
import {
  ModuleKindBadge,
  ModuleStatusBadge,
  RespondentRoleBadge,
} from '../../components/diagnosis/badges'
import { useToast } from '../../components/ui/toastContext'

export function ModulesPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const version = useStoreVersion()
  const [filters, setFilters] = useState<{
    query: string
    kind: string
    status: string
    role: string
  }>({ query: '', kind: '', status: '', role: '' })
  const [archiveTarget, setArchiveTarget] = useState<SurveyModule | null>(null)

  const rows = useMemo(
    () =>
      surveyModuleRepository.search({
        query: filters.query,
        kind: (filters.kind || undefined) as ModuleFilters['kind'],
        status: (filters.status || undefined) as ModuleFilters['status'],
        respondentRole: (filters.role || undefined) as ModuleFilters['respondentRole'],
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, version],
  )

  const hasActiveFilters =
    filters.query !== '' ||
    filters.kind !== '' ||
    filters.status !== '' ||
    filters.role !== ''

  const handleArchive = () => {
    if (!archiveTarget) return
    try {
      surveyModuleRepository.archive(archiveTarget.id)
      showToast(`${archiveTarget.name} 모듈을 보관했습니다.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '보관에 실패했습니다.')
    }
    setArchiveTarget(null)
  }

  const rowMenu = (module: SurveyModule) => (
    <DropdownMenu
      ariaLabel={`${module.name} 더보기 메뉴`}
      items={[
        {
          key: 'edit',
          label: '수정',
          icon: Pencil,
          onSelect: () => navigate(`/diagnosis/modules/${module.id}/edit`),
        },
        {
          key: 'archive',
          label: '보관',
          icon: Archive,
          danger: true,
          onSelect: () => setArchiveTarget(module),
        },
      ]}
    />
  )

  const columns: DataTableColumn<SurveyModule>[] = [
    {
      key: 'name',
      header: '모듈명',
      className: 'min-w-[200px]',
      cell: (m) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{m.name}</p>
          <p className="mt-0.5 line-clamp-1 text-[0.875rem] text-slate-400">{m.description}</p>
        </div>
      ),
    },
    { key: 'kind', header: '종류', cell: (m) => <ModuleKindBadge kind={m.kind} /> },
    {
      key: 'keys',
      header: '관련 키',
      className: 'hidden xl:table-cell',
      cell: (m) => (
        <span className="text-[13px] text-slate-600">
          {m.keys
            .map((k) => (m.kind === 'industry' ? industryKeyLabel(k) : objectiveKeyLabel(k)))
            .join(', ')}
        </span>
      ),
    },
    {
      key: 'roles',
      header: '권장 응답자',
      className: 'hidden lg:table-cell',
      cell: (m) => (
        <div className="flex flex-wrap gap-1">
          {m.recommendedRespondentRoles.map((r) => (
            <RespondentRoleBadge key={r} role={r} />
          ))}
        </div>
      ),
    },
    {
      key: 'count',
      header: '질문 수',
      className: 'text-center',
      cell: (m) => <span className="text-[13px] text-slate-600">{m.questionIds.length}</span>,
    },
    {
      key: 'version',
      header: '버전',
      className: 'hidden 2xl:table-cell text-center',
      cell: (m) => <span className="text-[13px] text-slate-500">v{m.version}</span>,
    },
    { key: 'status', header: '상태', cell: (m) => <ModuleStatusBadge status={m.status} /> },
    {
      key: 'updated',
      header: '최근 수정',
      className: 'hidden lg:table-cell',
      cell: (m) => (
        <span className="text-[13px] whitespace-nowrap text-slate-500">
          {formatDate(m.updatedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12 text-right',
      cell: (m) => rowMenu(m),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="업종·목적 모듈"
        description="공통 질문은행에서 특정 업종과 프로젝트 목적에 맞는 질문 묶음을 구성합니다."
        actions={
          <Button variant="primary" onClick={() => navigate('/diagnosis/modules/new')}>
            <Plus aria-hidden="true" className="size-4" />
            모듈 등록
          </Button>
        }
      />
      <DiagnosisStudioNav />

      <FilterBar
        searchValue={filters.query}
        searchPlaceholder="모듈명, 설명, 키 검색"
        onSearchChange={(v) => setFilters((p) => ({ ...p, query: v }))}
        hasActiveFilters={hasActiveFilters}
        resultCount={rows.length}
        resultUnit="개"
        onReset={() => setFilters({ query: '', kind: '', status: '', role: '' })}
        selects={[
          {
            key: 'kind',
            ariaLabel: '모듈 종류 필터',
            value: filters.kind,
            placeholder: '모듈 종류',
            options: [
              { value: 'industry', label: MODULE_KIND_META.industry.label },
              { value: 'objective', label: MODULE_KIND_META.objective.label },
            ],
            onChange: (v) => setFilters((p) => ({ ...p, kind: v })),
          },
          {
            key: 'status',
            ariaLabel: '상태 필터',
            value: filters.status,
            placeholder: '상태',
            options: (['draft', 'active'] as const).map((s) => ({
              value: s,
              label: MODULE_STATUS_META[s].label,
            })),
            onChange: (v) => setFilters((p) => ({ ...p, status: v })),
          },
          {
            key: 'role',
            ariaLabel: '응답자 필터',
            value: filters.role,
            placeholder: '권장 응답자',
            options: RESPONDENT_ROLES.map((r) => ({
              value: r,
              label: RESPONDENT_ROLE_META[r].label,
            })),
            onChange: (v) => setFilters((p) => ({ ...p, role: v })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={Layers}
            title="조건에 맞는 모듈이 없습니다"
            description="새 모듈을 만들거나 필터를 조정하세요."
            action={
              <Button variant="primary" onClick={() => navigate('/diagnosis/modules/new')}>
                <Plus aria-hidden="true" className="size-4" />
                모듈 등록
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card) lg:block">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(m) => m.id}
              rowAriaLabel={(m) => `${m.name} 모듈 수정`}
              onRowClick={(m) => navigate(`/diagnosis/modules/${m.id}/edit`)}
            />
          </div>
          <ul className="flex flex-col gap-3 lg:hidden">
            {rows.map((m) => (
              <li
                key={m.id}
                className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/diagnosis/modules/${m.id}/edit`)}
                    className="min-w-0 cursor-pointer text-left"
                  >
                    <p className="truncate text-sm font-semibold text-slate-800">{m.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-[0.875rem] text-slate-400">{m.description}</p>
                  </button>
                  {rowMenu(m)}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <ModuleKindBadge kind={m.kind} />
                  <ModuleStatusBadge status={m.status} />
                  <span className="text-[0.875rem] text-slate-400">질문 {m.questionIds.length}개</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmModal
        open={archiveTarget !== null}
        title="모듈 보관"
        message={`${archiveTarget?.name ?? ''} 모듈을 보관할까요? 보관된 모듈은 새 설문 조합에서 제외됩니다.`}
        confirmLabel="보관"
        danger
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  )
}
