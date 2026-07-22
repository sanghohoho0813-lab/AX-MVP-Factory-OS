import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  RefreshCw,
  ScanSearch,
  TrendingDown,
} from 'lucide-react'
import type { Organization, Project } from '../../types/domain'
import type { AutomationCandidate, SelectionDecision } from '../../types/selection'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { formatDate, normalizeQuery } from '../../lib/format'
import { memberName } from '../../data/members'
import { mvpLevelLabel } from '../../lib/domainMeta'
import {
  automationCandidateRepository,
  organizationRepository,
  projectRepository,
  selectionDecisionRepository,
} from '../../repositories'
import { needsReselection } from '../../services/selectionService'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { GuidedEmptyState } from '../../components/ui/GuidedEmptyState'
import { useDemoTour } from '../../components/demo/demoTour'
import { FilterBar } from '../../components/ui/FilterBar'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { SummaryStrip } from '../../components/ui/SummaryStrip'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import {
  AutomationApproachBadge,
  CandidateConfidenceBadge,
  PriorityQuadrantBadge,
  SelectionStatusBadge,
} from '../../components/selection/badges'

interface Row {
  decision: SelectionDecision
  project: Project
  organization: Organization | null
  primary: AutomationCandidate | null
  reselection: boolean
}

export function SelectionResultsPage() {
  const navigate = useNavigate()
  const demo = useDemoTour()
  const version = useStoreVersion()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('recent')

  const rows = useMemo<Row[]>(() => {
    const orgById = new Map(organizationRepository.getAll(true).map((o) => [o.id, o]))
    const byProject = new Map<string, SelectionDecision>()
    for (const d of selectionDecisionRepository.getAll()) {
      const cur = byProject.get(d.projectId)
      if (!cur) { byProject.set(d.projectId, d); continue }
      const curActive = cur.status !== 'superseded'
      const dActive = d.status !== 'superseded'
      if ((dActive && !curActive) || (dActive === curActive && d.version > cur.version)) byProject.set(d.projectId, d)
    }
    return [...byProject.values()]
      .map((decision) => {
        const project = projectRepository.getById(decision.projectId)
        if (!project) return null
        return {
          decision,
          project,
          organization: orgById.get(project.organizationId) ?? null,
          primary: decision.primaryCandidateId ? automationCandidateRepository.getById(decision.primaryCandidateId) : null,
          reselection: needsReselection(decision),
        }
      })
      .filter((r): r is Row => r !== null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const filtered = useMemo(() => {
    const q = normalizeQuery(query)
    const result = rows.filter((r) => {
      if (status && r.decision.status !== status) return false
      if (q) {
        const haystack = `${r.organization?.name ?? ''} ${r.project.name} ${r.primary?.name ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    result.sort((a, b) => {
      switch (sort) {
        case 'score_desc':
          return (b.primary?.priorityScore ?? 0) - (a.primary?.priorityScore ?? 0)
        case 'client_name':
          return (a.organization?.name ?? '').localeCompare(b.organization?.name ?? '')
        default:
          return b.decision.updatedAt.localeCompare(a.decision.updatedAt)
      }
    })
    return result
  }, [rows, query, status, sort])

  const counts = {
    draft: rows.filter((r) => r.decision.status === 'draft').length,
    reviewed: rows.filter((r) => r.decision.status === 'reviewed').length,
    finalized: rows.filter((r) => r.decision.status === 'finalized').length,
    reselection: rows.filter((r) => r.reselection).length,
    noPrimary: rows.filter((r) => !r.primary).length,
  }

  const go = (r: Row) => navigate(`/selection/projects/${r.project.id}/decision`)

  const columns: DataTableColumn<Row>[] = [
    { key: 'client', header: '고객사', cell: (r) => <span className="text-[13px] font-medium text-slate-700">{r.organization?.name ?? '-'}</span> },
    {
      key: 'project', header: '프로젝트', className: 'min-w-[140px]',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{r.project.name}</p>
          <p className="text-[0.875rem] text-slate-400">{r.project.projectCode}</p>
        </div>
      ),
    },
    {
      key: 'primary', header: '핵심 과제', className: 'min-w-[150px]',
      cell: (r) => <span className="text-[13px] text-slate-700">{r.primary?.name ?? <span className="text-slate-400">미선정</span>}</span>,
    },
    { key: 'score', header: '점수', cell: (r) => <span className="text-sm font-bold text-slate-800">{r.primary?.priorityScore ?? '-'}</span> },
    { key: 'quadrant', header: '사분면', className: 'hidden lg:table-cell', cell: (r) => (r.primary ? <PriorityQuadrantBadge quadrant={r.primary.quadrant} /> : <span className="text-slate-300">-</span>) },
    { key: 'approach', header: '자동화', className: 'hidden xl:table-cell', cell: (r) => (r.primary ? <AutomationApproachBadge approach={r.primary.automationApproach} /> : <span className="text-slate-300">-</span>) },
    { key: 'mvp', header: 'MVP 수준', className: 'hidden xl:table-cell', cell: (r) => <span className="text-[13px] text-slate-600">{mvpLevelLabel(r.decision.recommendedMvpLevel, 'ax')}</span> },
    {
      key: 'status', header: '상태',
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <SelectionStatusBadge status={r.decision.status} />
          {r.reselection && (
            <span className="inline-flex items-center gap-0.5 rounded-md border border-warning-200 bg-warning-50 px-1.5 py-0.5 text-[0.8125rem] font-medium text-warning-700">
              <RefreshCw aria-hidden="true" className="size-3" />
              재선별
            </span>
          )}
        </div>
      ),
    },
    { key: 'version', header: '버전', className: 'hidden xl:table-cell', cell: (r) => <span className="text-[0.875rem] text-slate-400">v{r.decision.version}</span> },
    { key: 'updated', header: '확정일', className: 'hidden lg:table-cell', cell: (r) => <span className="text-[13px] text-slate-500">{formatDate(r.decision.finalizedAt ?? r.decision.updatedAt)}</span> },
    { key: 'owner', header: '담당자', className: 'hidden xl:table-cell', cell: (r) => <span className="text-[13px] text-slate-600">{memberName(r.project.ownerId)}</span> },
  ]

  const hasActive = query !== '' || status !== '' || sort !== 'recent'

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="과제선정 결과"
        description="프로젝트별 핵심 MVP 과제와 후속 과제 선정 결과를 관리합니다."
      />

      <SummaryStrip
        ariaLabel="과제선정 결과 요약"
        items={[
          { key: 'draft', label: '선정 초안', value: counts.draft, unit: '건', tone: 'warning', icon: FlaskConical },
          { key: 'reviewed', label: '검토 중', value: counts.reviewed, unit: '건', tone: 'info', icon: ScanSearch },
          { key: 'finalized', label: '확정', value: counts.finalized, unit: '건', tone: 'success', icon: CheckCircle2 },
          { key: 'reselection', label: '재선별 필요', value: counts.reselection, unit: '건', tone: 'warning', icon: RefreshCw },
          { key: 'noprimary', label: '핵심 미선정', value: counts.noPrimary, unit: '건', tone: 'danger', icon: TrendingDown },
        ]}
      />

      <FilterBar
        searchValue={query}
        searchPlaceholder="고객사·프로젝트·핵심 과제 검색"
        onSearchChange={setQuery}
        selects={[
          {
            key: 'status', ariaLabel: '상태 필터', value: status, placeholder: '전체 상태',
            options: [
              { value: 'draft', label: '선정 초안' },
              { value: 'reviewed', label: '검토 중' },
              { value: 'finalized', label: '확정' },
            ],
            onChange: setStatus,
          },
          {
            key: 'sort', ariaLabel: '정렬', value: sort === 'recent' ? '' : sort, placeholder: '최근 확정순',
            options: [
              { value: 'score_desc', label: '점수 높은 순' },
              { value: 'client_name', label: '고객사명순' },
            ],
            onChange: (v) => setSort(v === '' ? 'recent' : v),
          },
        ]}
        onReset={() => { setQuery(''); setStatus(''); setSort('recent') }}
        resultCount={filtered.length}
        hasActiveFilters={hasActive}
      />

      <Panel title={`과제선정 결과 (${filtered.length})`} flush>
        {filtered.length === 0 ? (
          hasActive ? (
            <EmptyState
              icon={ClipboardCheck}
              title="조건에 맞는 결과가 없습니다"
              description="필터를 조정해 다시 확인해 보세요."
            />
          ) : (
            <GuidedEmptyState
              icon={ClipboardCheck}
              title="아직 확정한 핵심 업무가 없습니다"
              reason="진단 결과를 확정한 뒤 만들 업무를 고르면 이곳에 정리됩니다."
              flowPosition="2단계 · 핵심 업무 선택"
              prereqs={[
                { label: '진단 결과 확정', done: false },
                { label: '자동화 후보 검토', done: false },
                { label: '핵심 업무 1개 선정', done: false },
              ]}
              primaryLabel="만들 업무 선택으로 이동"
              onPrimary={() => navigate('/selection')}
              sampleLabel="샘플 결과 보기"
              onSample={() => demo.start()}
            />
          )
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <DataTable columns={columns} rows={filtered} rowKey={(r) => r.decision.id} rowAriaLabel={(r) => `${r.project.name} 선정 결과`} onRowClick={go} />
            </div>
            <ul className="flex flex-col divide-y divide-slate-100 lg:hidden">
              {filtered.map((r) => (
                <li key={r.decision.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full flex-col gap-1.5 px-5 py-3.5 text-left hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold text-slate-800">{r.organization?.name} · {r.project.name}</p>
                      {r.primary && <span className="shrink-0 text-sm font-bold text-slate-800">{r.primary.priorityScore}점</span>}
                    </div>
                    <p className="truncate text-[13px] text-slate-600">{r.primary?.name ?? '핵심 미선정'}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ProjectTypeBadge type={r.project.projectType} compact />
                      <SelectionStatusBadge status={r.decision.status} />
                      {r.primary && <CandidateConfidenceBadge confidence={r.primary.confidence} />}
                      {r.reselection && (
                        <span className="inline-flex items-center gap-0.5 rounded-md border border-warning-200 bg-warning-50 px-1.5 py-0.5 text-[0.8125rem] font-medium text-warning-700">
                          <RefreshCw aria-hidden="true" className="size-3" />
                          재선별
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  )
}
