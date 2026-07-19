import { useMemo, useState } from 'react'
import {
  GitMerge,
  Grid2x2,
  LayoutGrid,
  ListChecks,
  Plus,
  Search,
  Table2,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { AutomationCandidate, CandidateStatus } from '../../types/selection'
import { normalizeQuery } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { FilterBar } from '../../components/ui/FilterBar'
import { Panel } from '../../components/ui/Panel'
import { SummaryStrip } from '../../components/ui/SummaryStrip'
import { useToast } from '../../components/ui/toastContext'
import {
  TASK_FAMILIES,
  TASK_FAMILY_META,
} from '../../lib/selectionMeta'
import {
  addManualCandidate,
  mergeCandidates,
  runOrRefreshCandidates,
  setCandidateStatus,
  SelectionBlockedError,
} from '../../services/selectionService'
import {
  CandidateBoard,
  CandidateCard,
  CandidateTable,
} from '../../components/selection/CandidateViews'
import {
  CandidateMergeModal,
  ManualCandidateModal,
  type ManualCandidateInput,
} from '../../components/selection/candidateModals'
import {
  MinusCircle,
  Star,
} from 'lucide-react'
import {
  SelectionGateNotice,
  SelectionHeader,
  SelectionNav,
  SelectionProjectNotFound,
  } from './selectionShared'
import { useSelectionData } from './useSelectionData'

export function CandidateBoardPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { context } = useSelectionData(projectId)
  const [view, setView] = useState<'board' | 'table'>('board')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [family, setFamily] = useState('')
  const [sort, setSort] = useState('score_desc')
  const [mergeOpen, setMergeOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)

  const candidates = context?.candidates ?? []
  const filtered = useMemo(() => {
    const q = normalizeQuery(query)
    const result = candidates.filter((c) => {
      if (status && c.status !== status) return false
      if (family && c.taskFamily !== family) return false
      if (q) {
        const haystack = `${c.name} ${c.problemStatement} ${c.users} ${c.sourceQuestionCodes.join(' ')}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    result.sort((a, b) => {
      switch (sort) {
        case 'effect_desc':
          return b.subtotalScore - a.subtotalScore
        case 'feasible_desc': {
          const f = (c: AutomationCandidate) => c.domainScores.find((d) => d.domain === 'implementation_feasibility')?.normalizedScore ?? 0
          return f(b) - f(a)
        }
        case 'confidence_desc': {
          const order = { high: 0, medium: 1, low: 2, insufficient: 3 }
          return order[a.confidence] - order[b.confidence]
        }
        case 'recent':
          return b.updatedAt.localeCompare(a.updatedAt)
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return b.priorityScore - a.priorityScore
      }
    })
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, query, status, family, sort])

  if (!context) return <SelectionProjectNotFound />
  const { project, organization, eligibility } = context

  if (!eligibility.canExtract) {
    return (
      <div className="flex flex-col gap-5">
        <SelectionHeader project={project} organizationName={organization?.name ?? ''} />
        <SelectionGateNotice context={context} />
      </div>
    )
  }

  const onStatusChange = (c: AutomationCandidate, next: CandidateStatus) => {
    setCandidateStatus(c.id, next)
    showToast('후보 상태를 변경했습니다.')
  }
  const onOpen = (c: AutomationCandidate) => navigate(`/selection/projects/${projectId}/candidates/${c.id}`)

  const onExtract = () => {
    try {
      const r = runOrRefreshCandidates(projectId)
      showToast(`후보 ${r.length}건을 추출했습니다.`)
    } catch (error) {
      showToast(error instanceof SelectionBlockedError ? error.message : '추출에 실패했습니다.')
    }
  }

  const onMerge = (targetId: string, sourceIds: string[], name: string, problem: string) => {
    try {
      mergeCandidates(projectId, sourceIds, targetId, name, problem)
      showToast('후보를 병합했습니다.')
      setMergeOpen(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '병합에 실패했습니다.')
    }
  }

  const onManual = (input: ManualCandidateInput) => {
    addManualCandidate(projectId, {
      name: input.name,
      problemStatement: input.problemStatement,
      currentProcess: input.currentProcess,
      users: input.users,
      monthlyVolume: input.monthlyVolume,
      minutesPerCase: input.minutesPerCase,
      expectedEffect: input.expectedEffect,
      reason: input.reason,
    })
    showToast('수동 후보를 추가했습니다.')
    setManualOpen(false)
  }

  const counts = {
    total: candidates.length,
    review: candidates.filter((c) => c.status === 'discovered' || c.status === 'reviewing').length,
    shortlisted: candidates.filter((c) => c.status === 'shortlisted' || c.status === 'selected_primary' || c.status === 'selected_secondary').length,
    deferred: candidates.filter((c) => c.status === 'deferred').length,
    rejected: candidates.filter((c) => c.status === 'rejected').length,
  }
  const hasActive = query !== '' || status !== '' || family !== '' || sort !== 'score_desc'
  const activeCandidates = candidates.filter((c) => c.status !== 'archived' && c.status !== 'rejected')

  return (
    <div className="flex flex-col gap-5">
      <SelectionHeader
        project={project}
        organizationName={organization?.name ?? ''}
        actions={
          <>
            <Button variant="secondary" onClick={() => setManualOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              수동 후보
            </Button>
            <Button variant="secondary" onClick={() => setMergeOpen(true)}>
              <GitMerge aria-hidden="true" className="size-4" />
              후보 병합
            </Button>
            <Button variant="primary" onClick={() => navigate(`/selection/projects/${projectId}/matrix`)}>
              <Grid2x2 aria-hidden="true" className="size-4" />
              매트릭스
            </Button>
          </>
        }
      />
      <SelectionNav projectId={projectId} />

      <p className="text-sm break-keep text-slate-500">
        진단 응답에서 발견된 업무를 검토하고 중복·범위·효과·위험을 정리합니다.
      </p>

      <SummaryStrip
        ariaLabel="후보 요약"
        items={[
          { key: 'total', label: '전체 후보', value: counts.total, unit: '건', tone: 'neutral', icon: ListChecks },
          { key: 'review', label: '검토 필요', value: counts.review, unit: '건', tone: 'info', icon: Search },
          { key: 'short', label: '우선 후보', value: counts.shortlisted, unit: '건', tone: 'success', icon: Star },
          { key: 'deferred', label: '보류', value: counts.deferred, unit: '건', tone: 'warning', icon: MinusCircle },
          { key: 'rejected', label: '제외', value: counts.rejected, unit: '건', tone: 'danger', icon: MinusCircle },
        ]}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-(--radius-control) border border-slate-200 p-0.5">
          <button
            type="button"
            onClick={() => setView('board')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium ${view === 'board' ? 'bg-slate-100 text-slate-800' : 'text-slate-500'}`}
          >
            <LayoutGrid aria-hidden="true" className="size-4" />
            보드
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium ${view === 'table' ? 'bg-slate-100 text-slate-800' : 'text-slate-500'}`}
          >
            <Table2 aria-hidden="true" className="size-4" />
            표
          </button>
        </div>
      </div>

      <FilterBar
        searchValue={query}
        searchPlaceholder="후보명·문제·담당자·태그 검색"
        onSearchChange={setQuery}
        selects={[
          {
            key: 'status',
            ariaLabel: '상태 필터',
            value: status,
            placeholder: '전체 상태',
            options: [
              { value: 'discovered', label: '자동 발견' },
              { value: 'reviewing', label: '검토 중' },
              { value: 'shortlisted', label: '후보 선정' },
              { value: 'deferred', label: '보류' },
              { value: 'rejected', label: '제외' },
            ],
            onChange: setStatus,
          },
          {
            key: 'family',
            ariaLabel: '업무군 필터',
            value: family,
            placeholder: '전체 업무군',
            options: TASK_FAMILIES.map((f) => ({ value: f, label: TASK_FAMILY_META[f].label })),
            onChange: setFamily,
          },
          {
            key: 'sort',
            ariaLabel: '정렬',
            value: sort === 'score_desc' ? '' : sort,
            placeholder: '점수 높은 순',
            options: [
              { value: 'effect_desc', label: '효과 높은 순' },
              { value: 'feasible_desc', label: '구현 쉬운 순' },
              { value: 'confidence_desc', label: '신뢰도 높은 순' },
              { value: 'recent', label: '최근 수정순' },
              { value: 'name', label: '후보명순' },
            ],
            onChange: (v) => setSort(v === '' ? 'score_desc' : v),
          },
        ]}
        onReset={() => {
          setQuery('')
          setStatus('')
          setFamily('')
          setSort('score_desc')
        }}
        resultCount={filtered.length}
        hasActiveFilters={hasActive}
      />

      {candidates.length === 0 ? (
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={Search}
            title="후보가 없습니다"
            description="진단 결과에서 자동화 후보를 추출하세요."
            action={<Button variant="primary" onClick={onExtract}>후보 과제 추출</Button>}
          />
        </div>
      ) : filtered.length === 0 ? (
        <Panel title="후보">
          <p className="text-[13px] text-slate-500">조건에 맞는 후보가 없습니다.</p>
        </Panel>
      ) : view === 'board' ? (
        <>
          <div className="hidden lg:block">
            <CandidateBoard candidates={filtered} onOpen={onOpen} onStatusChange={onStatusChange} />
          </div>
          <div className="flex flex-col gap-2.5 lg:hidden">
            {filtered.map((c) => (
              <CandidateCard key={c.id} candidate={c} onOpen={onOpen} onStatusChange={onStatusChange} />
            ))}
          </div>
        </>
      ) : (
        <Panel title={`후보 (${filtered.length})`} flush>
          <CandidateTable candidates={filtered} onOpen={onOpen} />
        </Panel>
      )}

      <CandidateMergeModal open={mergeOpen} candidates={activeCandidates} onClose={() => setMergeOpen(false)} onSubmit={onMerge} />
      <ManualCandidateModal open={manualOpen} onClose={() => setManualOpen(false)} onSubmit={onManual} />
    </div>
  )
}
