import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import type {
  ApplicationStage,
  FundingOutcome,
  FundingStrategy,
} from '../../types/funding'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { formatDate } from '../../lib/format'
import { institutionRepository, organizationRepository, projectRepository } from '../../repositories'
import { getAllStrategies, summarizeStrategy } from '../../services/fundingService'
import type { FundingSummary } from '../../services/funding/fundingSummaryBuilder'
import {
  APPLICATION_STAGE_META,
  APPLICATION_STAGES,
  OUTCOME_TYPE_META,
  OUTCOME_TYPES,
  STRATEGY_STATUS_META,
  STRATEGY_STATUSES,
} from '../../lib/fundingMeta'
import { Button } from '../../components/ui/Button'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { FilterBar } from '../../components/ui/FilterBar'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import {
  ApplicationStageBadge,
  OutcomeTypeBadge,
  StrategyStatusBadge,
  SupportTypeBadge,
} from '../../components/funding/badges'

interface Row {
  strategy: FundingStrategy
  orgName: string
  projectName: string
  summary: FundingSummary
  primaryInstitutionName: string | null
  bestStage: ApplicationStage | null
  requested: string
  approved: string
  latestOutcome: FundingOutcome | null
  lastContact: string | null
}

function mostAdvancedStage(strategy: FundingStrategy): ApplicationStage | null {
  let best: ApplicationStage | null = null
  let order = -1
  for (const app of strategy.applications) {
    const o = APPLICATION_STAGE_META[app.applicationStage].order
    if (o > order) {
      order = o
      best = app.applicationStage
    }
  }
  return best
}

/** 사용자가 실제 입력한(비어 있지 않은) 금액만 반환 */
function enteredAmount(strategy: FundingStrategy, key: 'requestedAmount' | 'approvedAmount'): string {
  for (const outcome of strategy.outcomes) {
    if (outcome[key].trim()) return outcome[key].trim()
  }
  for (const app of strategy.applications) {
    if (app[key].trim()) return app[key].trim()
  }
  return ''
}

export function FundingResultsPage() {
  const navigate = useNavigate()
  const version = useStoreVersion()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [stage, setStage] = useState('')
  const [outcomeType, setOutcomeType] = useState('')
  const [caseOnly, setCaseOnly] = useState('')

  const rows = useMemo<Row[]>(() => {
    const orgById = new Map(organizationRepository.getAll(true).map((o) => [o.id, o]))
    const projById = new Map(projectRepository.getAll(true).map((p) => [p.id, p]))
    return getAllStrategies()
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map<Row>((strategy) => {
        const primary = strategy.matches.find((m) => m.priority === 'primary') ?? null
        const primaryInstitutionName = primary
          ? institutionRepository.getById(primary.institutionId)?.name ?? null
          : null
        const activities = strategy.outreachActivities
        const lastContact = activities.length > 0
          ? activities.reduce((latest, a) => (a.occurredAt > latest ? a.occurredAt : latest), activities[0].occurredAt)
          : null
        const latestOutcome = strategy.outcomes.length > 0 ? strategy.outcomes[strategy.outcomes.length - 1] : null
        return {
          strategy,
          orgName: orgById.get(strategy.organizationId)?.name ?? '알 수 없음',
          projectName: projById.get(strategy.projectId)?.name ?? '알 수 없음',
          summary: summarizeStrategy(strategy),
          primaryInstitutionName,
          bestStage: mostAdvancedStage(strategy),
          requested: enteredAmount(strategy, 'requestedAmount'),
          approved: enteredAmount(strategy, 'approvedAmount'),
          latestOutcome,
          lastContact,
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const filtered = rows.filter((r) => {
    if (status && r.strategy.status !== status) return false
    if (stage && !r.strategy.applications.some((a) => a.applicationStage === stage)) return false
    if (outcomeType && !r.strategy.outcomes.some((o) => o.type === outcomeType)) return false
    if (caseOnly && !r.summary.caseCandidate) return false
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      const hay = `${r.orgName} ${r.projectName} ${r.strategy.objective} ${r.strategy.targetUse}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const hasActiveFilters = Boolean(query || status || stage || outcomeType || caseOnly)
  const reset = () => {
    setQuery('')
    setStatus('')
    setStage('')
    setOutcomeType('')
    setCaseOnly('')
  }

  const open = (r: Row) => navigate(`/funding/projects/${r.strategy.projectId}/review`)

  const columns: DataTableColumn<Row>[] = [
    { key: 'client', header: '고객사', cell: (r) => <span className="text-[13px] font-medium text-slate-700">{r.orgName}</span> },
    {
      key: 'project', header: '프로젝트 · 우선 기관', className: 'min-w-[180px]',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{r.projectName}</p>
          <p className="truncate text-[0.875rem] text-slate-400">{r.primaryInstitutionName ?? '우선 기관 미선정'} · v{r.strategy.version}</p>
        </div>
      ),
    },
    {
      key: 'support', header: '지원 유형', className: 'hidden xl:table-cell',
      cell: (r) => (
        r.strategy.preferredSupportTypes.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {r.strategy.preferredSupportTypes.map((t) => <SupportTypeBadge key={t} type={t} />)}
          </div>
        ) : <span className="text-[13px] text-slate-400">-</span>
      ),
    },
    {
      key: 'stage', header: '진행 단계',
      cell: (r) => (r.bestStage ? <ApplicationStageBadge stage={r.bestStage} /> : <span className="text-[13px] text-slate-400">신청 전</span>),
    },
    {
      key: 'amounts', header: '요청·승인액', className: 'hidden lg:table-cell',
      cell: (r) => (
        <div className="text-[13px] text-slate-600">
          <p>요청 {r.requested || '-'}</p>
          <p>승인 {r.approved || '-'}</p>
        </div>
      ),
    },
    {
      key: 'progress', header: '부족조건 · 준비율', className: 'hidden lg:table-cell',
      cell: (r) => (
        <div className="text-[13px] text-slate-600">
          <p>미해결 {r.summary.openGapCount}건</p>
          <p>준비 {r.summary.docReadyRate}%</p>
        </div>
      ),
    },
    {
      key: 'contact', header: '최근 접촉', className: 'hidden xl:table-cell',
      cell: (r) => <span className="text-[13px] text-slate-500">{r.lastContact ? formatDate(r.lastContact) : '-'}</span>,
    },
    {
      key: 'outcome', header: '결과 · 상태',
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {r.latestOutcome ? <OutcomeTypeBadge type={r.latestOutcome.type} /> : <span className="text-[13px] text-slate-400">결과 없음</span>}
          {r.summary.caseCandidate && <span className="rounded-md border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[0.8125rem] font-medium text-brand-700">사례 후보</span>}
          <StrategyStatusBadge status={r.strategy.status} />
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => navigate('/funding')}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        기관·자금 연계
      </button>
      <PageHeader
        title="진행 결과"
        description="기관·자금 연계 전략의 진행 단계와 결과를 한눈에 봅니다. 금액은 실제 입력된 경우에만 표시되며, 승인 가능성·예상 금액은 제시하지 않습니다."
      />

      <FilterBar
        searchValue={query}
        searchPlaceholder="고객사·프로젝트·용도 검색"
        onSearchChange={setQuery}
        selects={[
          { key: 'status', ariaLabel: '전략 상태 필터', value: status, placeholder: '모든 전략 상태', onChange: setStatus, options: STRATEGY_STATUSES.map((s) => ({ value: s, label: STRATEGY_STATUS_META[s].label })) },
          { key: 'stage', ariaLabel: '신청 단계 필터', value: stage, placeholder: '모든 신청 단계', onChange: setStage, options: APPLICATION_STAGES.map((s) => ({ value: s, label: APPLICATION_STAGE_META[s].label })) },
          { key: 'outcome', ariaLabel: '결과 유형 필터', value: outcomeType, placeholder: '모든 결과', onChange: setOutcomeType, options: OUTCOME_TYPES.map((o) => ({ value: o, label: OUTCOME_TYPE_META[o].label })) },
          { key: 'case', ariaLabel: '사례 후보 필터', value: caseOnly, placeholder: '사례 후보 여부', onChange: setCaseOnly, options: [{ value: 'yes', label: '사례 후보만' }] },
        ]}
        onReset={reset}
        resultCount={filtered.length}
        hasActiveFilters={hasActiveFilters}
      />

      {filtered.length === 0 ? (
        <Panel title="진행 결과" flush>
          <EmptyState
            icon={TrendingUp}
            title={hasActiveFilters ? '조건에 맞는 결과가 없습니다' : '아직 진행 중인 연계가 없습니다'}
            description={hasActiveFilters ? '필터를 초기화하면 전체 결과를 볼 수 있습니다.' : '프로젝트에서 기관·자금 연계를 시작하면 진행 단계와 결과가 이곳에 모입니다.'}
            action={hasActiveFilters ? undefined : <Button variant="secondary" onClick={() => navigate('/funding')}>연계 시작하기</Button>}
          />
        </Panel>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card) lg:block">
            <DataTable columns={columns} rows={filtered} rowKey={(r) => r.strategy.id} rowAriaLabel={(r) => `${r.projectName} 연계 결과`} onRowClick={open} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:hidden">
            {filtered.map((r) => (
              <button
                key={r.strategy.id}
                type="button"
                onClick={() => open(r)}
                className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-5 text-left shadow-(--shadow-card) hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{r.projectName}</p>
                    <p className="mt-0.5 truncate text-[0.875rem] text-slate-400">{r.orgName} · {r.primaryInstitutionName ?? '우선 기관 미선정'} · v{r.strategy.version}</p>
                  </div>
                  <StrategyStatusBadge status={r.strategy.status} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {r.bestStage ? <ApplicationStageBadge stage={r.bestStage} /> : <span className="text-[13px] text-slate-400">신청 전</span>}
                  {r.latestOutcome && <OutcomeTypeBadge type={r.latestOutcome.type} />}
                  {r.summary.caseCandidate && <span className="rounded-md border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[0.8125rem] font-medium text-brand-700">사례 후보</span>}
                </div>
                {r.strategy.preferredSupportTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.strategy.preferredSupportTypes.map((t) => <SupportTypeBadge key={t} type={t} />)}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.875rem] text-slate-500">
                  <span>요청 {r.requested || '-'}</span>
                  <span>승인 {r.approved || '-'}</span>
                  <span>미해결 {r.summary.openGapCount}건</span>
                  <span>준비 {r.summary.docReadyRate}%</span>
                  <span>최근 접촉 {r.lastContact ? formatDate(r.lastContact) : '-'}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
