import { useState } from 'react'
import {
  ArrowRight,
  ClipboardCheck,
  Grid2x2,
  ListChecks,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { RECOMMENDATION_META } from '../../lib/assessmentMeta'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import { monthlySavingLabel, topRiskText } from '../../lib/selectionFormat'
import {
  runOrRefreshCandidates,
  SelectionBlockedError,
} from '../../services/selectionService'
import { recommendCandidates } from '../../services/selection/selectionRecommendation'
import {
  CandidateConfidenceBadge,
  PriorityQuadrantBadge,
  SelectionStatusBadge,
} from '../../components/selection/badges'
import {
  ReselectionBanner,
  SelectionGateNotice,
  SelectionHeader,
  SelectionNav,
  SelectionProjectNotFound,
  } from './selectionShared'
import { useSelectionData } from './useSelectionData'

const STEPS = [
  '진단 결과 확인',
  '후보 과제 추출',
  '후보 검토',
  '우선순위 비교',
  '핵심 과제 선정',
  '결과 확정',
]

export function SelectionProjectPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { context } = useSelectionData(projectId)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!context) return <SelectionProjectNotFound />
  const { project, organization, eligibility, candidates, decision } = context

  const doExtract = () => {
    try {
      const result = runOrRefreshCandidates(projectId)
      showToast(`후보 ${result.length}건을 추출했습니다.`)
      setConfirmOpen(false)
    } catch (error) {
      setConfirmOpen(false)
      showToast(error instanceof SelectionBlockedError ? error.message : '후보 추출에 실패했습니다.')
    }
  }

  const header = (
    <SelectionHeader
      project={project}
      organizationName={organization?.name ?? ''}
      actions={
        eligibility.canExtract && candidates.length > 0 ? (
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              <RefreshCw aria-hidden="true" className="size-4" />
              후보 재추출
            </Button>
            <Button variant="primary" onClick={() => navigate(`/selection/projects/${projectId}/decision`)}>
              선정 결과 검토
            </Button>
          </>
        ) : undefined
      }
    />
  )

  if (!eligibility.canExtract) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <SelectionGateNotice context={context} />
      </div>
    )
  }

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <SelectionNav projectId={projectId} />
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={Search}
            title="자동화 후보를 추출할 수 있습니다"
            description="확정된 진단 결과에서 반복·낭비 업무를 후보로 추출합니다."
            action={
              <Button variant="primary" onClick={doExtract}>
                <Search aria-hidden="true" className="size-4" />
                후보 과제 추출
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  const rec = recommendCandidates(candidates)
  const assessment = eligibility.assessment
  const counts = {
    total: candidates.length,
    discovered: candidates.filter((c) => c.status === 'discovered').length,
    reviewing: candidates.filter((c) => c.status === 'reviewing' || c.status === 'shortlisted').length,
    deferred: candidates.filter((c) => c.status === 'deferred').length,
    rejected: candidates.filter((c) => c.status === 'rejected').length,
  }
  const prerequisites = [
    ...new Set(candidates.flatMap((c) => c.dependencies.filter((d) => d.requiredBeforeMvp).map((d) => d.title))),
  ].slice(0, 6)

  const stepStates = [
    'done',
    'done',
    counts.reviewing > 0 || counts.deferred > 0 || counts.rejected > 0 ? 'done' : 'todo',
    'todo',
    decision?.primaryCandidateId ? 'done' : 'todo',
    decision?.status === 'finalized' ? 'done' : 'todo',
  ]

  return (
    <div className="flex flex-col gap-5">
      {header}
      <SelectionNav projectId={projectId} />
      <ReselectionBanner show={context.needsReselectionFlag} onRun={() => setConfirmOpen(true)} />

      <div className="flex flex-wrap items-center gap-2">
        {decision && <SelectionStatusBadge status={decision.status} />}
        <span className="text-[0.875rem] text-slate-400">후보 {counts.total}건</span>
        {assessment && (
          <span className="text-[0.875rem] text-slate-400">
            진단 v{assessment.version} · {RECOMMENDATION_META[assessment.recommendation].label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          {/* 추천 핵심 후보 */}
          <Panel title="추천 핵심 후보 (상위 3)">
            {rec.top.length === 0 ? (
              <p className="text-[13px] text-slate-500">추천할 후보가 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {rec.top.map((c) => {
                  const risk = topRiskText(c)
                  const isPrimary = rec.primary?.id === c.id
                  return (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center gap-3 rounded-(--radius-card) border border-slate-200 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-800">{c.name}</p>
                          {isPrimary && (
                            <span className="rounded-md border border-success-200 bg-success-50 px-1.5 py-0.5 text-[0.8125rem] font-medium text-success-700">
                              추천 핵심
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[0.875rem] text-slate-400">
                          {monthlySavingLabel(c)} · {risk ? `위험: ${risk}` : '주요 위험 없음'}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-slate-900">{c.priorityScore}</span>
                      <PriorityQuadrantBadge quadrant={c.quadrant} />
                      <CandidateConfidenceBadge confidence={c.confidence} />
                      <button
                        type="button"
                        onClick={() => navigate(`/selection/projects/${projectId}/candidates/${c.id}`)}
                        className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-brand-600"
                      >
                        상세
                        <ArrowRight aria-hidden="true" className="size-3.5" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          {/* 진단 요약 */}
          {assessment && (
            <Panel title="진단 요약">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SummaryBlock title="강점" items={assessment.keyStrengths} empty="확인된 강점 없음" />
                <SummaryBlock title="약점" items={assessment.keyWeaknesses} empty="확인된 약점 없음" />
                <SummaryBlock title="주요 위험" items={assessment.keyRisks} empty="확인된 위험 없음" />
                <SummaryBlock title="추천 다음 행동" items={assessment.suggestedNextActions} empty="-" />
              </div>
            </Panel>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="진행 순서">
            <ol className="flex flex-col gap-2">
              {STEPS.map((label, i) => (
                <li key={label} className="flex items-center gap-2 text-[13px]">
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[0.8125rem] font-semibold ${
                      stepStates[i] === 'done' ? 'bg-success-100 text-success-700' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={stepStates[i] === 'done' ? 'text-slate-700' : 'text-slate-400'}>{label}</span>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="후보 현황">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {[
                ['전체', counts.total],
                ['자동 발견', counts.discovered],
                ['검토·후보', counts.reviewing],
                ['보류', counts.deferred],
                ['제외', counts.rejected],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-[0.875rem] text-slate-400">{label}</dt>
                  <dd className="text-lg font-bold text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {prerequisites.length > 0 && (
            <Panel title="선행 준비사항">
              <ul className="flex flex-col gap-1.5">
                {prerequisites.map((p) => (
                  <li key={p} className="text-[13px] break-keep text-slate-600">• {p}</li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="빠른 이동">
            <div className="flex flex-col gap-2">
              {[
                { to: `/selection/projects/${projectId}/candidates`, label: '후보 보드', icon: ListChecks },
                { to: `/selection/projects/${projectId}/matrix`, label: '우선순위 매트릭스', icon: Grid2x2 },
                { to: `/selection/projects/${projectId}/decision`, label: '핵심 과제 선정', icon: ClipboardCheck },
              ].map((item) => (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="flex items-center gap-2.5 rounded-(--radius-control) border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  <item.icon aria-hidden="true" className="size-4 text-slate-400" />
                  {item.label}
                  <ArrowRight aria-hidden="true" className="ml-auto size-4 text-slate-300" />
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="후보 재추출"
        message="진단 결과를 기준으로 자동 발견 후보를 다시 계산합니다. 수동 추가 후보와 확정된 과제 이력은 유지됩니다."
        confirmLabel="재추출"
        onConfirm={doExtract}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

function SummaryBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <p className="mb-1 text-[0.875rem] font-semibold text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="text-[0.875rem] text-slate-400">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.slice(0, 3).map((item) => (
            <li key={item} className="text-[13px] break-keep text-slate-600">• {item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
