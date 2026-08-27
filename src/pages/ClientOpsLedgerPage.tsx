import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  ClipboardCopy,
  ClipboardList,
  FileText,
  Landmark,
  ListChecks,
  TimerReset,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { organizationRepository, projectRepository } from '../repositories'
import { useStoreVersion } from '../lib/useStoreVersion'
import {
  getClientOpsCheckMap,
  setClientOpsCheck,
  type ClientOpsCheckKey,
} from '../services/clientOpsChecklistService'
import {
  buildClientOpsLedger,
  type ClientOpsFilter,
  type ClientOpsLedgerRow,
} from '../services/clientOpsLedgerService'
import { DataTable, type DataTableColumn } from '../components/ui/DataTable'
import { FilterBar } from '../components/ui/FilterBar'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatusBadge } from '../components/ui/StatusBadge'
import { SummaryStrip } from '../components/ui/SummaryStrip'
import { useToast } from '../components/ui/toastContext'

const FILTER_OPTIONS: { value: ClientOpsFilter; label: string }[] = [
  { value: 'blocked', label: '병목 있음' },
  { value: 'funding', label: '정책자금' },
  { value: 'plan', label: '사업계획서 미완' },
  { value: 'due', label: '마감 임박' },
]

const VALID_FILTERS = new Set<ClientOpsFilter>(['all', 'blocked', 'funding', 'plan', 'due'])

const QUICK_CHECKS: { key: ClientOpsCheckKey; label: string }[] = [
  { key: 'clientReplySent', label: '회신 요청' },
  { key: 'fundingContacted', label: '기관 컨택' },
  { key: 'businessPlanDrafted', label: '계획서 초안' },
  { key: 'midCheckDone', label: '중간점검' },
]

function readFilter(value: string | null): ClientOpsFilter {
  return value && VALID_FILTERS.has(value as ClientOpsFilter) ? (value as ClientOpsFilter) : 'all'
}

function TrackGrid({ row }: { row: ClientOpsLedgerRow }) {
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-5">
      {row.tracks.map((track) => (
        <div key={track.key} className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[0.76rem] font-semibold whitespace-nowrap text-slate-500">{track.label}</dt>
            <span className="text-[0.76rem] font-semibold text-slate-500">{track.value}%</span>
          </div>
          <div className="mt-1">
            <ProgressBar value={track.value} tone={track.tone} label={`${row.clientName} ${track.label}`} />
          </div>
          <dd className="mt-1 truncate text-[0.75rem] text-slate-400">{track.detail}</dd>
        </div>
      ))}
    </dl>
  )
}

function QuickCheckPanel({
  row,
  onToggle,
}: {
  row: ClientOpsLedgerRow
  onToggle: (row: ClientOpsLedgerRow, key: ClientOpsCheckKey, checked: boolean) => void
}) {
  if (!row.projectId) {
    return <p className="text-[0.82rem] text-slate-400">프로젝트를 먼저 등록하면 운영 체크를 저장할 수 있습니다.</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_CHECKS.map((item) => (
        <label
          key={item.key}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-2.5 text-[0.8rem] font-medium text-slate-600 hover:bg-slate-50"
        >
          <input
            type="checkbox"
            checked={row.checks[item.key]}
            onChange={(event) => onToggle(row, item.key, event.target.checked)}
            className="size-3.5 accent-brand-600"
          />
          {item.label}
        </label>
      ))}
    </div>
  )
}

function MobileLedgerCard({
  row,
  onToggle,
}: {
  row: ClientOpsLedgerRow
  onToggle: (row: ClientOpsLedgerRow, key: ClientOpsCheckKey, checked: boolean) => void
}) {
  return (
    <li className="rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-4 shadow-(--shadow-card)">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={row.tone}>{row.statusLabel}</StatusBadge>
            <StatusBadge tone="neutral">{row.dueLabel}</StatusBadge>
          </div>
          <h2 className="mt-2 truncate text-[1rem] font-bold text-slate-900">{row.clientName}</h2>
          <p className="mt-0.5 truncate text-[0.875rem] text-slate-500">{row.projectName}</p>
        </div>
        <Link
          to={`/ops/clients/${row.organizationId}`}
          aria-label={`${row.clientName} 운영 파일 열기`}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-(--radius-control) border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 text-[0.8rem] font-medium text-slate-500">
          <span>{row.stageLabel}</span>
          <span>{row.progressPercent}%</span>
        </div>
        <div className="mt-1.5">
          <ProgressBar value={row.progressPercent} tone={row.tone} label={`${row.clientName} 진행률`} />
        </div>
      </div>

      <div className="mt-4 rounded-(--radius-card) border border-slate-200 bg-slate-50 px-3 py-3">
        <p className="text-[0.8rem] font-semibold text-slate-500">다음 운영 행동</p>
        <p className="mt-1 text-[0.88rem] leading-relaxed break-keep text-slate-700">{row.recommendedMove}</p>
      </div>

      <div className="mt-4">
        <TrackGrid row={row} />
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <QuickCheckPanel row={row} onToggle={onToggle} />
      </div>
    </li>
  )
}

export function ClientOpsLedgerPage() {
  const version = useStoreVersion()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const filter = readFilter(searchParams.get('filter'))

  const ledger = useMemo(() => {
    void version
    return buildClientOpsLedger(
      organizationRepository.getAll(),
      projectRepository.getAll(),
      query,
      filter,
      getClientOpsCheckMap(),
    )
  }, [filter, query, version])

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

  const hasActiveFilters = query !== '' || filter !== 'all'

  const copyBriefing = async () => {
    try {
      if (!navigator.clipboard || !ledger.briefingScript) throw new Error('No briefing')
      await navigator.clipboard.writeText(ledger.briefingScript)
      showToast('고객 운영 브리핑을 복사했습니다.')
    } catch {
      showToast('복사할 고객 운영 브리핑이 없습니다.')
    }
  }

  const toggleQuickCheck = (row: ClientOpsLedgerRow, key: ClientOpsCheckKey, checked: boolean) => {
    if (!row.projectId) {
      showToast('프로젝트가 없는 고객사는 운영 체크를 저장할 수 없습니다.')
      return
    }
    setClientOpsCheck(row.projectId, key, checked)
    showToast(checked ? '운영 체크를 완료로 표시했습니다.' : '운영 체크를 해제했습니다.')
  }

  const columns: DataTableColumn<ClientOpsLedgerRow>[] = [
    {
      key: 'client',
      header: '고객사',
      cell: (row) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="max-w-56 truncate text-[0.98rem] font-bold text-slate-900">{row.clientName}</p>
            <StatusBadge tone={row.tone}>{row.statusLabel}</StatusBadge>
          </div>
          <p className="mt-0.5 truncate text-[0.85rem] text-slate-500">{row.primaryContact}</p>
        </div>
      ),
    },
    {
      key: 'project',
      header: '프로젝트·단계',
      cell: (row) => (
        <div className="min-w-0">
          <p className="max-w-72 truncate text-[0.9rem] font-medium text-slate-700">{row.projectName}</p>
          <div className="mt-1 flex items-center gap-2">
            <ProgressBar value={row.progressPercent} tone={row.tone} label={`${row.clientName} 진행률`} />
            <span className="shrink-0 text-[0.78rem] font-semibold text-slate-500">{row.progressPercent}%</span>
          </div>
          <p className="mt-1 text-[0.78rem] text-slate-400">{row.stageLabel}</p>
        </div>
      ),
    },
    {
      key: 'bottleneck',
      header: '병목',
      cell: (row) => (
        <div className="min-w-0">
          <p className="max-w-52 truncate text-[0.9rem] font-semibold text-slate-700">{row.bottleneck}</p>
          <p className="mt-0.5 text-[0.8rem] text-slate-400">{row.dueLabel}</p>
        </div>
      ),
    },
    {
      key: 'tracks',
      header: '운영 트랙',
      cell: (row) => <TrackGrid row={row} />,
    },
    {
      key: 'next',
      header: '다음 행동',
      cell: (row) => (
        <div className="min-w-0">
          <p className="max-w-72 truncate text-[0.9rem] font-medium text-brand-700">{row.nextAction}</p>
          <p className="mt-0.5 text-[0.8rem] text-slate-400">예상 {row.estimatedMinutes}분</p>
        </div>
      ),
    },
    {
      key: 'checks',
      header: '체크',
      cell: (row) => <QuickCheckPanel row={row} onToggle={toggleQuickCheck} />,
    },
    {
      key: 'open',
      header: '',
      className: 'w-24 text-right',
      cell: (row) => (
        <Link
          to={`/ops/clients/${row.organizationId}`}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 text-[0.8rem] font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50 hover:text-slate-900"
        >
          운영 파일
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="고객 운영 레저"
        description="고객사별 회신, 정책자금, 사업계획서, 중간점검, 결과자료 상태를 한 화면에서 점검합니다."
        actions={
          <>
            <button
              type="button"
              onClick={copyBriefing}
              disabled={!ledger.briefingScript}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-(--radius-control) border border-slate-300 bg-white px-4 text-[1rem] font-medium whitespace-nowrap text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ClipboardCopy aria-hidden="true" className="size-4" />
              브리핑 복사
            </button>
            <Link
              to="/today"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-(--radius-control) border border-slate-300 bg-white px-4 text-[1rem] font-medium whitespace-nowrap text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <TimerReset aria-hidden="true" className="size-4" />
              오늘 실행계획
            </Link>
          </>
        }
      />

      <SummaryStrip
        ariaLabel="고객 운영 레저 요약"
        items={[
          {
            key: 'clients',
            label: '관리 고객사',
            value: ledger.summary.clientCount,
            unit: '곳',
            tone: 'info',
            icon: Building2,
          },
          {
            key: 'blocked',
            label: '병목·주의',
            value: ledger.summary.blockedCount,
            unit: '건',
            tone: ledger.summary.blockedCount > 0 ? 'danger' : 'success',
            icon: AlertTriangle,
          },
          {
            key: 'funding',
            label: '정책자금 대상',
            value: ledger.summary.fundingCount,
            unit: '건',
            tone: 'accent',
            icon: Landmark,
          },
          {
            key: 'plan',
            label: '사업계획서 보강',
            value: ledger.summary.businessPlanCount,
            unit: '건',
            tone: ledger.summary.businessPlanCount > 0 ? 'warning' : 'success',
            icon: FileText,
          },
        ]}
      />

      <Panel
        title="이번 운영 초점"
        actions={<StatusBadge tone={ledger.summary.focusTone}>{ledger.summary.focusLabel}</StatusBadge>}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-(--radius-control) border border-brand-200 bg-brand-50 text-brand-700">
              <CalendarClock aria-hidden="true" className="size-4.5" />
            </span>
            <div>
              <p className="text-[0.8rem] font-medium text-slate-500">마감 임박</p>
              <p className="mt-0.5 text-xl font-bold text-slate-900">{ledger.summary.dueSoonCount}건</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-(--radius-control) border border-warning-200 bg-warning-50 text-warning-700">
              <ClipboardList aria-hidden="true" className="size-4.5" />
            </span>
            <div>
              <p className="text-[0.8rem] font-medium text-slate-500">현재 필터 작업량</p>
              <p className="mt-0.5 text-xl font-bold text-slate-900">{ledger.summary.estimatedMinutes}분</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-(--radius-control) border border-success-200 bg-success-50 text-success-700">
              <ListChecks aria-hidden="true" className="size-4.5" />
            </span>
            <div>
              <p className="text-[0.8rem] font-medium text-slate-500">운영 판단</p>
              <p className="mt-0.5 text-[0.95rem] font-semibold break-keep text-slate-800">
                {ledger.summary.focusLabel}으로 큐를 정렬했습니다.
              </p>
            </div>
          </div>
        </div>
      </Panel>

      <FilterBar
        searchValue={query}
        searchPlaceholder="고객사, 담당자, 다음 행동, 병목 검색"
        onSearchChange={(value) => setParam('q', value)}
        hasActiveFilters={hasActiveFilters}
        resultCount={ledger.rows.length}
        resultUnit="곳"
        onReset={() => setSearchParams({}, { replace: true })}
        selects={[
          {
            key: 'filter',
            ariaLabel: '운영 필터',
            value: filter === 'all' ? '' : filter,
            placeholder: '전체 운영 상태',
            options: FILTER_OPTIONS,
            onChange: (value) => setParam('filter', value),
          },
        ]}
      />

      {ledger.rows.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card) xl:block">
            <DataTable
              columns={columns}
              rows={ledger.rows}
              rowKey={(row) => row.id}
              rowAriaLabel={(row) => `${row.clientName} 운영 상태 열기`}
            />
          </div>
          <ul className="flex flex-col gap-3 xl:hidden">
            {ledger.rows.map((row) => (
              <MobileLedgerCard key={row.id} row={row} onToggle={toggleQuickCheck} />
            ))}
          </ul>
        </>
      ) : (
        <Panel title="고객 운영 레저">
          <p className="text-[0.9rem] break-keep text-slate-500">
            조건에 맞는 고객 운영 항목이 없습니다. 검색어 또는 필터를 조정하세요.
          </p>
        </Panel>
      )}
    </div>
  )
}
