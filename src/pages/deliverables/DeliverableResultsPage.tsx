import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import type { DeliverablePackage } from '../../types/deliverables'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { organizationRepository, projectRepository } from '../../repositories'
import { getAllPackages } from '../../services/deliverableService'
import {
  AUDIENCE_META,
  AUDIENCES,
  PACKAGE_STATUS_META,
  PACKAGE_STATUSES,
  PACKAGE_TYPE_META,
  PACKAGE_TYPES,
} from '../../lib/deliverableMeta'
import { EmptyState } from '../../components/ui/EmptyState'
import { FilterBar } from '../../components/ui/FilterBar'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import {
  AudienceBadge,
  DeliverableTrackBadge,
  PackageStatusBadge,
  PackageTypeBadge,
} from '../../components/deliverables/badges'

interface Row {
  pkg: DeliverablePackage
  orgName: string
  projectName: string
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function DeliverableResultsPage() {
  const navigate = useNavigate()
  const version = useStoreVersion()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [audience, setAudience] = useState('')
  const [includesAx, setIncludesAx] = useState('')
  const [includesWebsite, setIncludesWebsite] = useState('')
  const [includesValidation, setIncludesValidation] = useState('')

  const rows = useMemo<Row[]>(() => {
    const orgById = new Map(organizationRepository.getAll(true).map((o) => [o.id, o]))
    const projById = new Map(projectRepository.getAll(true).map((p) => [p.id, p]))
    return getAllPackages()
      .slice()
      .sort((a, b) => (b.finalizedAt ?? b.updatedAt).localeCompare(a.finalizedAt ?? a.updatedAt))
      .map((pkg) => ({
        pkg,
        orgName: orgById.get(pkg.organizationId)?.name ?? '알 수 없음',
        projectName: projById.get(pkg.projectId)?.name ?? '알 수 없음',
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const filtered = rows.filter((r) => {
    if (status && r.pkg.status !== status) return false
    if (type && r.pkg.type !== type) return false
    if (audience && r.pkg.audience !== audience) return false
    if (includesAx && !r.pkg.includedTracks.includes('ax')) return false
    if (includesWebsite && !r.pkg.includedTracks.includes('website')) return false
    if (includesValidation && !r.pkg.includedTracks.includes('validation')) return false
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      const hay = `${r.orgName} ${r.projectName} ${r.pkg.name}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const hasActiveFilters = Boolean(query || status || type || audience || includesAx || includesWebsite || includesValidation)
  const reset = () => {
    setQuery('')
    setStatus('')
    setType('')
    setAudience('')
    setIncludesAx('')
    setIncludesWebsite('')
    setIncludesValidation('')
  }

  const open = (r: Row) => navigate(`/deliverables/projects/${r.pkg.projectId}/packages/${r.pkg.id}`)
  const validationLabel = (pkg: DeliverablePackage) => (pkg.includedTracks.includes('validation') ? '테스트 포함' : '검증 전')

  const columns: DataTableColumn<Row>[] = [
    { key: 'client', header: '고객사', cell: (r) => <span className="text-[13px] font-medium text-slate-700">{r.orgName}</span> },
    {
      key: 'package', header: '패키지', className: 'min-w-[180px]',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{r.pkg.name}</p>
          <p className="truncate text-xs text-slate-400">{r.projectName} · v{r.pkg.version}</p>
        </div>
      ),
    },
    { key: 'type', header: '유형', cell: (r) => <PackageTypeBadge type={r.pkg.type} /> },
    { key: 'audience', header: '대상', cell: (r) => <AudienceBadge audience={r.pkg.audience} /> },
    { key: 'status', header: '상태', cell: (r) => <PackageStatusBadge status={r.pkg.status} /> },
    {
      key: 'tracks', header: '포함 트랙', className: 'hidden xl:table-cell',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.pkg.includedTracks.map((track) => (
            <DeliverableTrackBadge key={track} track={track} />
          ))}
        </div>
      ),
    },
    {
      key: 'counts', header: '구성', className: 'hidden lg:table-cell',
      cell: (r) => <span className="text-[13px] text-slate-600">Section {r.pkg.sections.length} · 프롬프트 {r.pkg.prompts.length}</span>,
    },
    {
      key: 'validation', header: '검증', className: 'hidden lg:table-cell',
      cell: (r) => (
        <span className={`text-[13px] font-medium ${r.pkg.includedTracks.includes('validation') ? 'text-success-600' : 'text-slate-400'}`}>
          {validationLabel(r.pkg)}
        </span>
      ),
    },
    { key: 'finalized', header: '확정일', className: 'hidden xl:table-cell', cell: (r) => <span className="text-[13px] text-slate-500">{formatDate(r.pkg.finalizedAt)}</span> },
  ]

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
      <PageHeader title="제출자료 결과" description="지금까지 만든 모든 자료 패키지를 상태·유형·대상별로 모아 봅니다. AX와 홈페이지 결과는 트랙별로 구분되며 합산하지 않습니다." />

      <FilterBar
        searchValue={query}
        searchPlaceholder="고객사·프로젝트·패키지명 검색"
        onSearchChange={setQuery}
        selects={[
          { key: 'status', ariaLabel: '상태 필터', value: status, placeholder: '모든 상태', onChange: setStatus, options: PACKAGE_STATUSES.map((s) => ({ value: s, label: PACKAGE_STATUS_META[s].label })) },
          { key: 'type', ariaLabel: '유형 필터', value: type, placeholder: '모든 유형', onChange: setType, options: PACKAGE_TYPES.map((t) => ({ value: t, label: PACKAGE_TYPE_META[t].label })) },
          { key: 'audience', ariaLabel: '대상 독자 필터', value: audience, placeholder: '모든 대상', onChange: setAudience, options: AUDIENCES.map((a) => ({ value: a, label: AUDIENCE_META[a].label })) },
          { key: 'ax', ariaLabel: 'AX 포함 필터', value: includesAx, placeholder: 'AX 포함 여부', onChange: setIncludesAx, options: [{ value: 'yes', label: 'AX 포함' }] },
          { key: 'website', ariaLabel: '홈페이지 포함 필터', value: includesWebsite, placeholder: '홈페이지 포함 여부', onChange: setIncludesWebsite, options: [{ value: 'yes', label: '홈페이지 포함' }] },
          { key: 'validation', ariaLabel: '테스트 포함 필터', value: includesValidation, placeholder: '테스트 포함 여부', onChange: setIncludesValidation, options: [{ value: 'yes', label: '테스트 포함' }] },
        ]}
        onReset={reset}
        resultCount={filtered.length}
        hasActiveFilters={hasActiveFilters}
      />

      {filtered.length === 0 ? (
        <Panel title="자료 패키지" flush>
          <EmptyState
            icon={FileText}
            title={hasActiveFilters ? '조건에 맞는 자료가 없습니다' : '아직 만든 자료가 없습니다'}
            description={hasActiveFilters ? '필터를 초기화하면 전체 자료를 볼 수 있습니다.' : '확정된 진단·설계 결과가 있는 프로젝트에서 자료 패키지를 만들면 이곳에 정리됩니다.'}
          />
        </Panel>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card) lg:block">
            <DataTable columns={columns} rows={filtered} rowKey={(r) => r.pkg.id} rowAriaLabel={(r) => `${r.pkg.name} 자료 패키지`} onRowClick={open} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:hidden">
            {filtered.map((r) => (
              <button
                key={r.pkg.id}
                type="button"
                onClick={() => open(r)}
                className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-5 text-left shadow-(--shadow-card) hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{r.pkg.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{r.orgName} · {r.projectName} · v{r.pkg.version}</p>
                  </div>
                  <PackageStatusBadge status={r.pkg.status} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PackageTypeBadge type={r.pkg.type} />
                  <AudienceBadge audience={r.pkg.audience} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.pkg.includedTracks.map((track) => (
                    <DeliverableTrackBadge key={track} track={track} />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>Section {r.pkg.sections.length}개</span>
                  <span>프롬프트 {r.pkg.prompts.length}종</span>
                  <span className={r.pkg.includedTracks.includes('validation') ? 'font-medium text-success-600' : ''}>{validationLabel(r.pkg)}</span>
                  <span>확정 {formatDate(r.pkg.finalizedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
