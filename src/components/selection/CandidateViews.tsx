import { AlertTriangle, ArrowRight, Wrench } from 'lucide-react'
import type { AutomationCandidate, CandidateStatus } from '../../types/selection'
import { CANDIDATE_STATUS_META } from '../../lib/selectionMeta'
import { monthlySavingLabel, topRiskText } from '../../lib/selectionFormat'
import { DataTable, type DataTableColumn } from '../ui/DataTable'
import { DropdownMenu } from '../ui/DropdownMenu'
import {
  AiNecessityBadge,
  AutomationApproachBadge,
  CandidateConfidenceBadge,
  CandidateStatusBadge,
  PriorityQuadrantBadge,
  TaskFamilyBadge,
} from './badges'

const STATUS_ACTIONS: CandidateStatus[] = [
  'reviewing',
  'shortlisted',
  'deferred',
  'rejected',
  'archived',
]

interface CandidateCardProps {
  candidate: AutomationCandidate
  onOpen: (c: AutomationCandidate) => void
  onStatusChange: (c: AutomationCandidate, status: CandidateStatus) => void
}

export function CandidateCard({ candidate, onOpen, onStatusChange }: CandidateCardProps) {
  const risk = topRiskText(candidate)
  return (
    <div className="rounded-(--radius-card) border border-slate-200 bg-white p-3.5 shadow-(--shadow-card)">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpen(candidate)}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <p className="truncate text-sm font-semibold text-slate-800">
            {candidate.nameNeedsReview && (
              <Wrench aria-hidden="true" className="mr-1 inline size-3.5 text-warning-500" />
            )}
            {candidate.name}
          </p>
        </button>
        <DropdownMenu
          ariaLabel={`${candidate.name} 작업`}
          items={STATUS_ACTIONS.filter((s) => s !== candidate.status).map((s) => ({
            key: s,
            label: `${CANDIDATE_STATUS_META[s].label}(으)로`,
            danger: s === 'rejected' || s === 'archived',
            onSelect: () => onStatusChange(candidate, s),
          }))}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <TaskFamilyBadge family={candidate.taskFamily} />
        <PriorityQuadrantBadge quadrant={candidate.quadrant} />
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-slate-900">{candidate.priorityScore}</span>
          <span className="text-[0.875rem] text-slate-400">/ 100</span>
        </div>
        <CandidateConfidenceBadge confidence={candidate.confidence} />
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.875rem]">
        <div className="flex justify-between">
          <dt className="text-slate-400">월 절감</dt>
          <dd className="font-medium text-slate-700">{monthlySavingLabel(candidate)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">출처</dt>
          <dd className="font-medium text-slate-700">{candidate.sourceTypes.length}종</dd>
        </div>
      </dl>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <AutomationApproachBadge approach={candidate.automationApproach} />
        <AiNecessityBadge necessity={candidate.aiNecessity} />
      </div>

      {risk && (
        <p className="mt-2 flex items-center gap-1 text-[0.875rem] text-danger-600">
          <AlertTriangle aria-hidden="true" className="size-3" />
          {risk}
        </p>
      )}

      <div className="mt-2.5 flex items-center justify-between">
        <CandidateStatusBadge status={candidate.status} />
        <button
          type="button"
          onClick={() => onOpen(candidate)}
          className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-brand-600 hover:text-brand-700"
        >
          상세
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

/* 보드 (상태 열) */
const BOARD_COLUMNS: { key: CandidateStatus; group: CandidateStatus[] }[] = [
  { key: 'discovered', group: ['discovered'] },
  { key: 'reviewing', group: ['reviewing'] },
  { key: 'shortlisted', group: ['shortlisted', 'selected_primary', 'selected_secondary'] },
  { key: 'deferred', group: ['deferred'] },
  { key: 'rejected', group: ['rejected'] },
]

export function CandidateBoard({
  candidates,
  onOpen,
  onStatusChange,
}: {
  candidates: AutomationCandidate[]
  onOpen: (c: AutomationCandidate) => void
  onStatusChange: (c: AutomationCandidate, status: CandidateStatus) => void
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3" style={{ minWidth: 'min-content' }}>
        {BOARD_COLUMNS.map((col) => {
          const items = candidates.filter((c) => col.group.includes(c.status))
          return (
            <section key={col.key} className="flex w-72 shrink-0 flex-col gap-2.5">
              <header className="flex items-center justify-between rounded-(--radius-control) bg-slate-100 px-3 py-1.5">
                <span className="text-[13px] font-semibold text-slate-600">
                  {CANDIDATE_STATUS_META[col.key].label}
                </span>
                <span className="text-[0.875rem] text-slate-400">{items.length}</span>
              </header>
              {items.length === 0 ? (
                <p className="rounded-(--radius-card) border border-dashed border-slate-200 px-3 py-4 text-center text-[0.875rem] text-slate-300">
                  없음
                </p>
              ) : (
                items.map((c) => (
                  <CandidateCard key={c.id} candidate={c} onOpen={onOpen} onStatusChange={onStatusChange} />
                ))
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

/* 표 */
export function CandidateTable({
  candidates,
  onOpen,
}: {
  candidates: AutomationCandidate[]
  onOpen: (c: AutomationCandidate) => void
}) {
  const columns: DataTableColumn<AutomationCandidate>[] = [
    {
      key: 'name',
      header: '후보명',
      className: 'min-w-[180px]',
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{c.name}</p>
          <p className="text-[0.875rem] text-slate-400">{c.sourceQuestionCodes.slice(0, 2).join(', ')}</p>
        </div>
      ),
    },
    { key: 'family', header: '업무군', cell: (c) => <TaskFamilyBadge family={c.taskFamily} /> },
    { key: 'score', header: '점수', cell: (c) => <span className="text-sm font-bold text-slate-800">{c.priorityScore}</span> },
    { key: 'quadrant', header: '사분면', cell: (c) => <PriorityQuadrantBadge quadrant={c.quadrant} /> },
    { key: 'confidence', header: '신뢰도', className: 'hidden lg:table-cell', cell: (c) => <CandidateConfidenceBadge confidence={c.confidence} /> },
    { key: 'approach', header: '자동화', className: 'hidden xl:table-cell', cell: (c) => <AutomationApproachBadge approach={c.automationApproach} /> },
    { key: 'saving', header: '월 절감', className: 'hidden lg:table-cell', cell: (c) => <span className="text-[13px] text-slate-600">{monthlySavingLabel(c)}</span> },
    { key: 'status', header: '상태', cell: (c) => <CandidateStatusBadge status={c.status} /> },
  ]
  return (
    <div className="overflow-x-auto">
      <DataTable
        columns={columns}
        rows={candidates}
        rowKey={(c) => c.id}
        rowAriaLabel={(c) => `${c.name} 상세`}
        onRowClick={onOpen}
      />
    </div>
  )
}
