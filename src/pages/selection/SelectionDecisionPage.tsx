import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronDown, ClipboardCheck, RefreshCw, Rocket, Save, Trophy, Wand2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { AutomationCandidate } from '../../types/selection'
import { formatDateTime } from '../../lib/format'
import { mvpLevelLabel } from '../../lib/domainMeta'
import { MVP_TEMPLATE_META } from '../../lib/selectionMeta'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import { monthlySavingLabel } from '../../lib/selectionFormat'
import {
  checkCanFinalizeSelection,
  createNewSelectionVersion,
  ensureDraftDecision,
  finalizeSelection,
  markSelectionReviewed,
  setCandidateDecisionBucket,
  setPrimaryCandidate,
  toggleSecondaryCandidate,
  updateDecision,
  SelectionBlockedError,
} from '../../services/selectionService'
import {
  isPrimaryEligible,
  isSelectable,
} from '../../services/selection/selectionRecommendation'
import {
  CandidateConfidenceBadge,
  PriorityQuadrantBadge,
  SelectionStatusBadge,
} from '../../components/selection/badges'
import {
  SelectionGateNotice,
  SelectionHeader,
  SelectionNav,
  SelectionProjectNotFound,
  } from './selectionShared'
import { useSelectionData } from './useSelectionData'
import { ScreenGuide } from '../../components/onboarding/ScreenGuide'

const KPI_OPTIONS = ['월 처리시간', '월 처리 가능 건수', '오류·누락 건수', '사용 횟수·사용자 수', '고객 응답시간']

export function SelectionDecisionPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { context } = useSelectionData(projectId)
  const [summary, setSummary] = useState('')
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [showSystem, setShowSystem] = useState(false)

  const decision = context?.decision ?? null
  useEffect(() => {
    setSummary(decision?.decisionSummary ?? '')
  }, [decision?.id, decision?.decisionSummary])

  const candidatesById = useMemo(
    () => new Map((context?.candidates ?? []).map((c) => [c.id, c])),
    [context?.candidates],
  )

  if (!context) return <SelectionProjectNotFound />
  const { project, organization, eligibility, candidates } = context

  if (!eligibility.canExtract) {
    return (
      <div className="flex flex-col gap-5">
        <SelectionHeader project={project} organizationName={organization?.name ?? ''} />
        <SelectionGateNotice context={context} />
      </div>
    )
  }

  const startDraft = () => {
    try {
      ensureDraftDecision(projectId)
      showToast('선정 초안을 생성했습니다.')
    } catch (error) {
      showToast(error instanceof SelectionBlockedError ? error.message : '초안 생성에 실패했습니다.')
    }
  }

  const header = (
    <SelectionHeader
      project={project}
      organizationName={organization?.name ?? ''}
      actions={
        decision && decision.status === 'finalized' ? (
          <Button variant="secondary" onClick={() => { createNewSelectionVersion(projectId); showToast('새 버전 선별을 시작했습니다.') }}>
            <RefreshCw aria-hidden="true" className="size-4" />
            새 버전 선별
          </Button>
        ) : undefined
      }
    />
  )

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex justify-end">
          <ScreenGuide screenKey="selection_decision" />
        </div>
        {header}
        <SelectionNav projectId={projectId} />
        <Panel title="핵심 과제 선정">
          <p className="text-[13px] text-slate-500">먼저 후보 과제를 추출해야 선정을 시작할 수 있습니다.</p>
          <Button variant="primary" size="sm" className="mt-3" onClick={() => navigate(`/selection/projects/${projectId}`)}>
            개요로 이동
          </Button>
        </Panel>
      </div>
    )
  }

  if (!decision || decision.status === 'superseded') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex justify-end">
          <ScreenGuide screenKey="selection_decision" />
        </div>
        {header}
        <SelectionNav projectId={projectId} />
        <Panel title="핵심 과제 선정">
          <p className="text-[13px] break-keep text-slate-600">
            첫 번째 MVP에서 해결할 핵심 업무와 후속 과제를 확정합니다. 규칙 엔진 추천을 반영한 초안을 생성하세요.
          </p>
          <Button variant="primary" className="mt-3" onClick={startDraft}>
            <Rocket aria-hidden="true" className="size-4" />
            선정 시작
          </Button>
        </Panel>
      </div>
    )
  }

  const finalized = decision.status === 'finalized'
  const editable = !finalized
  const primary = decision.primaryCandidateId ? candidatesById.get(decision.primaryCandidateId) ?? null : null
  const secondary = decision.secondaryCandidateIds.map((id) => candidatesById.get(id)).filter((c): c is AutomationCandidate => c !== undefined)
  const selectableCandidates = candidates.filter((c) => c.status !== 'archived' && c.status !== 'rejected')
  const check = checkCanFinalizeSelection(project, { ...decision, decisionSummary: summary })

  const saveSummary = () => {
    updateDecision(decision.id, { decisionSummary: summary })
    showToast('선정 요약을 저장했습니다.')
  }
  const useAuto = () => setSummary(decision.autoSummary)

  const toggleKpi = (kpi: string) => {
    const has = decision.expectedPrimaryKpis.includes(kpi)
    updateDecision(decision.id, {
      expectedPrimaryKpis: has ? decision.expectedPrimaryKpis.filter((k) => k !== kpi) : [...decision.expectedPrimaryKpis, kpi],
    })
  }

  const doSetPrimary = (id: string) => {
    try {
      setPrimaryCandidate(decision.id, id)
      showToast('핵심 과제로 지정했습니다.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '지정에 실패했습니다.')
    }
  }
  const doToggleSecondary = (id: string) => {
    try {
      toggleSecondaryCandidate(decision.id, id)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '지정에 실패했습니다.')
    }
  }

  const doFinalize = () => {
    try {
      updateDecision(decision.id, { decisionSummary: summary })
      finalizeSelection(decision.id)
      showToast('과제선정을 확정했습니다.')
      setFinalizeOpen(false)
    } catch (error) {
      setFinalizeOpen(false)
      showToast(error instanceof SelectionBlockedError ? error.message : '확정에 실패했습니다.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {header}
      <SelectionNav projectId={projectId} />

      {/* §7 핵심 업무 확정 결과 히어로 */}
      {finalized && primary && (
        <section className="rounded-(--radius-panel) border border-success-200 bg-success-50/50 p-6 sm:p-7">
          <p className="flex items-center gap-1.5 text-[0.95rem] font-semibold text-success-700">
            <Trophy aria-hidden="true" className="size-4.5" />핵심 업무 확정
          </p>
          <h1 className="mt-1.5 text-[1.5rem] leading-snug font-bold break-keep text-slate-900 sm:text-[1.65rem]">
            첫 번째로 만들 업무가 정해졌습니다
          </h1>
          <p className="mt-3 text-[1.15rem] font-bold break-keep text-slate-900">{primary.name}</p>
          <p className="mt-1.5 max-w-3xl text-[1.02rem] leading-relaxed break-keep text-slate-600">
            {summary.trim() || decision.autoSummary}
          </p>
          <Button variant="primary" className="mt-5 h-auto w-full py-2.5 text-[1.05rem] sm:w-auto" onClick={() => navigate(`/mvp-design/projects/${projectId}`)}>
            <span className="whitespace-normal">기능·화면 설계 시작하기</span><ArrowRight aria-hidden="true" className="size-5 shrink-0" />
          </Button>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SelectionStatusBadge status={decision.status} />
        {context.needsReselectionFlag && (
          <span className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-[0.875rem] font-medium text-warning-700">
            <RefreshCw aria-hidden="true" className="size-3" />
            재선별 필요
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          {/* 핵심 과제 */}
          <Panel title="핵심 과제 (1개)">
            {primary ? (
              <SelectedCandidateCard candidate={primary} onOpen={() => navigate(`/selection/projects/${projectId}/candidates/${primary.id}`)} highlight />
            ) : (
              <p className="text-[13px] text-warning-700">핵심 과제를 1개 선택하세요.</p>
            )}
            {editable && (
              <div className="mt-3">
                <p className="mb-1.5 text-[0.875rem] font-medium text-slate-500">후보 중 핵심 과제 선택</p>
                <ul className="flex flex-col gap-1.5">
                  {selectableCandidates.map((c) => {
                    const eligible = isPrimaryEligible(c) && isSelectable(c)
                    return (
                      <li key={c.id} className="flex items-center gap-2 rounded-(--radius-control) border border-slate-200 px-3 py-2">
                        <input
                          type="radio"
                          name="primary"
                          checked={decision.primaryCandidateId === c.id}
                          disabled={!eligible}
                          onChange={() => doSetPrimary(c.id)}
                          aria-label={`${c.name} 핵심 과제 지정`}
                        />
                        <span className={`min-w-0 flex-1 truncate text-[13px] ${eligible ? 'text-slate-700' : 'text-slate-400'}`}>{c.name}</span>
                        <span className="shrink-0 text-sm font-bold text-slate-700">{c.priorityScore}</span>
                        {!eligible && <span className="shrink-0 text-[0.8125rem] text-slate-400">지정 불가</span>}
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-1 text-[0.875rem] text-slate-400">very_high 복잡도·중대 위험·자료정리 우선·신뢰도 미달 후보는 핵심 과제로 지정할 수 없습니다.</p>
              </div>
            )}
          </Panel>

          {/* 보조 과제 */}
          <Panel title={`보조 과제 (최대 2개, 현재 ${secondary.length})`}>
            {secondary.length > 0 && (
              <ul className="mb-3 flex flex-col gap-2">
                {secondary.map((c) => (
                  <li key={c.id}>
                    <SelectedCandidateCard candidate={c} onOpen={() => navigate(`/selection/projects/${projectId}/candidates/${c.id}`)} />
                  </li>
                ))}
              </ul>
            )}
            {editable && (
              <ul className="flex flex-col gap-1.5">
                {selectableCandidates
                  .filter((c) => c.id !== decision.primaryCandidateId)
                  .map((c) => {
                    const isSec = decision.secondaryCandidateIds.includes(c.id)
                    const disabled = !isSec && (decision.secondaryCandidateIds.length >= 2 || !isSelectable(c))
                    return (
                      <li key={c.id} className="flex items-center gap-2 rounded-(--radius-control) border border-slate-200 px-3 py-2">
                        <input type="checkbox" checked={isSec} disabled={disabled} onChange={() => doToggleSecondary(c.id)} aria-label={`${c.name} 보조 과제 지정`} />
                        <span className={`min-w-0 flex-1 truncate text-[13px] ${disabled ? 'text-slate-400' : 'text-slate-700'}`}>{c.name}</span>
                        <span className="shrink-0 text-sm font-bold text-slate-700">{c.priorityScore}</span>
                      </li>
                    )
                  })}
              </ul>
            )}
          </Panel>

          {/* 보류·제외 */}
          {editable && (
            <Panel title="보류·제외 처리">
              <ul className="flex flex-col gap-1.5">
                {selectableCandidates
                  .filter((c) => c.id !== decision.primaryCandidateId && !decision.secondaryCandidateIds.includes(c.id))
                  .map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-slate-200 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700">{c.name}</span>
                      <button type="button" onClick={() => setCandidateDecisionBucket(decision.id, c.id, 'deferred')} className="cursor-pointer text-[0.875rem] font-medium text-warning-700 hover:underline">보류</button>
                      <button type="button" onClick={() => setCandidateDecisionBucket(decision.id, c.id, 'rejected')} className="cursor-pointer text-[0.875rem] font-medium text-danger-600 hover:underline">제외</button>
                    </li>
                  ))}
              </ul>
              {decision.deferredCandidateIds.length + decision.rejectedCandidateIds.length > 0 && (
                <p className="mt-2 text-[0.875rem] text-slate-400">
                  보류 {decision.deferredCandidateIds.length}건 · 제외 {decision.rejectedCandidateIds.length}건
                </p>
              )}
            </Panel>
          )}

          {/* 선정 요약 */}
          <Panel title="선정 요약">
            <div className="flex flex-col gap-2">
              <p className="rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] break-keep text-slate-600">
                {decision.autoSummary}
              </p>
              <label htmlFor="decision-summary" className="text-[0.875rem] font-medium text-slate-400">담당자 최종 의견</label>
              <textarea
                id="decision-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                disabled={!editable}
                rows={4}
                className="w-full resize-none rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm break-keep focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
              />
              {editable && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={saveSummary}>
                    <Save aria-hidden="true" className="size-3.5" />
                    저장
                  </Button>
                  <Button variant="secondary" size="sm" onClick={useAuto}>
                    <Wand2 aria-hidden="true" className="size-3.5" />
                    자동 요약 사용
                  </Button>
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {/* KPI */}
          <Panel title="핵심 KPI (1개 이상)">
            <div className="flex flex-wrap gap-1.5">
              {[...new Set([...KPI_OPTIONS, ...decision.expectedPrimaryKpis])].map((kpi) => {
                const on = decision.expectedPrimaryKpis.includes(kpi)
                return (
                  <button
                    key={kpi}
                    type="button"
                    disabled={!editable}
                    onClick={() => toggleKpi(kpi)}
                    className={`rounded-full border px-3 py-1 text-[0.875rem] font-medium ${on ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'} ${editable ? 'cursor-pointer' : ''}`}
                  >
                    {kpi}
                  </button>
                )
              })}
            </div>
          </Panel>

          {/* 위험·선행 */}
          <Panel title="주요 위험">
            {decision.decisionRisks.length === 0 ? (
              <p className="text-[13px] text-slate-500">등록된 주요 위험이 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-1">{decision.decisionRisks.slice(0, 6).map((r) => <li key={r} className="text-[13px] break-keep text-slate-600">• {r}</li>)}</ul>
            )}
          </Panel>
          <Panel title="선행 준비사항">
            {decision.prerequisiteActions.length === 0 ? (
              <p className="text-[13px] text-slate-500">필수 선행조건이 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-1">{decision.prerequisiteActions.map((r) => <li key={r} className="text-[13px] break-keep text-slate-600">• {r}</li>)}</ul>
            )}
          </Panel>

          {/* Stage 7 전달 범위 */}
          {primary && (
            <Panel title="Stage 7 전달 범위">
              <div className="flex flex-col gap-2 text-[13px] text-slate-600">
                <p>권장 MVP 수준: <span className="font-medium text-slate-800">{mvpLevelLabel(decision.recommendedMvpLevel, 'ax')}</span></p>
                <div>
                  <p className="mb-1 text-[0.875rem] font-medium text-slate-400">템플릿 조합</p>
                  <ul className="flex flex-col gap-0.5">
                    {(decision.recommendedTemplateMix.length > 0 ? decision.recommendedTemplateMix : primary.templateMix).map((t) => (
                      <li key={t.template} className="text-[13px]">{MVP_TEMPLATE_META[t.template].label} {t.percentage}%</li>
                    ))}
                  </ul>
                </div>
                <p className="text-[0.875rem] text-slate-400">확정 시 Stage 7 인계 스냅샷이 생성되어 이후 후보 변경과 무관하게 보존됩니다.</p>
              </div>
            </Panel>
          )}

          {/* 상태 액션 */}
          {editable && (
            <Panel title="결과 상태">
              {!check.ok && (
                <ul className="mb-3 flex flex-col gap-1 rounded-(--radius-control) border border-warning-200 bg-warning-50/60 px-3 py-2">
                  {check.reasons.map((r) => <li key={r} className="text-[0.875rem] break-keep text-warning-800">• {r}</li>)}
                </ul>
              )}
              <div className="flex flex-col gap-2">
                <Button variant="secondary" onClick={() => { updateDecision(decision.id, { decisionSummary: summary }); markSelectionReviewed(decision.id); showToast('내부 검토를 완료했습니다.') }}>
                  내부 검토 완료
                </Button>
                <Button variant="primary" onClick={() => setFinalizeOpen(true)} disabled={!check.ok}>
                  <ClipboardCheck aria-hidden="true" className="size-4" />
                  과제선정 확정
                </Button>
              </div>
            </Panel>
          )}

          {finalized && context.handoff && (
            <Panel title="확정 완료">
              <p className="text-[13px] break-keep text-slate-600">
                핵심 과제 '{primary?.name}'이(가) 확정되어 기능·화면 설계로 전달할 인계 스냅샷이 생성되었습니다.
              </p>
              <p className="mt-1 text-[0.875rem] text-slate-400">생성 {formatDateTime(context.handoff.generatedAt)}</p>
            </Panel>
          )}
        </div>
      </div>

      {/* §7 시스템 정보 (버전·스냅샷·규칙 — 접힘) */}
      <div className="rounded-(--radius-panel) border border-slate-200 bg-white">
        <button type="button" onClick={() => setShowSystem((v) => !v)} aria-expanded={showSystem}
          className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left text-[0.95rem] font-semibold text-slate-600">
          시스템 정보 (버전·스냅샷·규칙)
          <ChevronDown aria-hidden="true" className={`size-5 transition-transform ${showSystem ? 'rotate-180' : ''}`} />
        </button>
        {showSystem && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-3">
            <SysItem label="선정 버전" value={`v${decision.version}`} />
            <SysItem label="진단 버전" value={`v${decision.assessmentVersion}`} />
            <SysItem label="규칙 버전" value={`v${decision.ruleVersion}`} />
            {decision.finalizedAt && <SysItem label="확정 시각" value={formatDateTime(decision.finalizedAt)} />}
            {context.handoff && <SysItem label="인계 스냅샷 ID" value={context.handoff.id} />}
            {context.handoff && <SysItem label="스냅샷 생성" value={formatDateTime(context.handoff.generatedAt)} />}
          </dl>
        )}
      </div>

      <ConfirmModal
        open={finalizeOpen}
        title="과제선정 확정"
        message={`핵심 과제 '${primary?.name ?? ''}'로 1차 MVP 과제를 확정합니다. 확정 후에는 수정할 수 없으며, 재선별 시 새 버전으로 저장됩니다.`}
        confirmLabel="확정"
        onConfirm={doFinalize}
        onCancel={() => setFinalizeOpen(false)}
      />
    </div>
  )
}

function SysItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.8rem] text-slate-400">{label}</dt>
      <dd className="truncate text-[0.9rem] font-medium text-slate-700">{value}</dd>
    </div>
  )
}

function SelectedCandidateCard({ candidate, onOpen, highlight }: { candidate: AutomationCandidate; onOpen: () => void; highlight?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full flex-col gap-2 rounded-(--radius-card) border px-4 py-3 text-left hover:bg-slate-50 ${highlight ? 'border-success-200 bg-success-50/30' : 'border-slate-200'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{candidate.name}</span>
        <span className="text-lg font-bold text-slate-900">{candidate.priorityScore}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityQuadrantBadge quadrant={candidate.quadrant} />
        <CandidateConfidenceBadge confidence={candidate.confidence} />
        <span className="text-[0.875rem] text-slate-400">{monthlySavingLabel(candidate)} 절감</span>
      </div>
    </button>
  )
}
