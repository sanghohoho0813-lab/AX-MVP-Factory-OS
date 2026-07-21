import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronDown, Lock, RefreshCw } from 'lucide-react'
import type {
  GateCriterionStatus,
  GateReview,
  ValidationGateNumber,
  ValidationGateStatus,
  ValidationTrackType,
  ValidationWorkspace,
} from '../../types/validation'
import {
  GATE_CRITERION_STATUSES,
  GATE_CRITERION_STATUS_META,
  GATE_META,
  GATE_NUMBERS,
  GATE_STATUS_META,
} from '../../lib/validationMeta'
import { Button } from '../../components/ui/Button'
import { HelpNote } from '../../components/ui/HelpNote'
import { useToast } from '../../components/ui/toastContext'
import { GateCriterionStatusBadge, GateStatusBadge } from '../../components/validation/badges'
import {
  refreshGateDrafts,
  setGateStatus,
  updateGateCriterion,
} from '../../services/validationService'
import { ReadOnlyNotice, TrackSectionFrame } from './validationShared'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none'
const labelCls = 'mb-1 block text-[0.9rem] font-semibold text-slate-500'
const GATE_STATUSES = Object.keys(GATE_STATUS_META) as ValidationGateStatus[]

function toastError(showToast: (m: string) => void, error: unknown) {
  showToast(error instanceof Error ? error.message : '처리에 실패했습니다.')
}

/* ------------------------------------------------------------------ */
/* Gate 카드                                                           */
/* ------------------------------------------------------------------ */

function GateCard({
  workspaceId,
  gate,
  review,
  readOnly,
  expanded,
  onToggle,
}: {
  workspaceId: string
  gate: ValidationGateNumber
  review: GateReview
  readOnly: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const { showToast } = useToast()
  const meta = GATE_META[gate]
  const gateLocked = review.status === 'locked'
  const editable = !readOnly && !gateLocked

  const [status, setStatus] = useState<ValidationGateStatus>(review.status)
  const [summary, setSummary] = useState(review.summary)
  const [conditions, setConditions] = useState(review.conditions)
  const [nextAction, setNextAction] = useState(review.nextAction)

  const changeCriterion = (criterionId: string, next: GateCriterionStatus) => {
    try {
      updateGateCriterion(workspaceId, gate, criterionId, next)
      showToast('기준 상태를 변경했습니다.')
    } catch (error) {
      toastError(showToast, error)
    }
  }

  const saveStatus = () => {
    try {
      setGateStatus(workspaceId, gate, status, { summary, conditions, nextAction })
      showToast('Gate 판정을 저장했습니다.')
    } catch (error) {
      // 서비스가 불가한 전환(예: critical 미해결 상태의 Gate 6 통과, 이전 Gate 실패)을 차단한다
      toastError(showToast, error)
    }
  }

  return (
    <section className={`rounded-(--radius-panel) border shadow-(--shadow-card) ${gateLocked ? 'border-slate-200 bg-slate-50/70' : 'border-slate-200 bg-white'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center gap-2 px-5 py-4 text-left"
      >
        {gateLocked && <Lock aria-hidden="true" className="size-4 text-slate-400" />}
        <span className="text-[15px] font-semibold text-slate-900">{meta.label}</span>
        <GateStatusBadge status={review.status} />
        <span className="inline-flex items-center gap-1 text-[0.9rem] text-slate-400">
          자동 초안 <GateStatusBadge status={review.autoDraftStatus} />
        </span>
        <ChevronDown aria-hidden="true" className={`ml-auto size-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="text-[0.95rem] break-keep text-slate-500">{meta.purpose}</p>
          <p className="mt-1 text-[0.9rem] break-keep text-slate-400">
            자동 초안은 규칙 기반 참고값입니다. 최종 상태는 담당자가 판정합니다.
          </p>
          {gateLocked && (
            <p className="mt-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-[0.9rem] break-keep text-slate-500">
              이 Gate는 잠금 상태입니다. 이전 Gate를 먼저 진행하세요.
            </p>
          )}

          {review.criteria.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {review.criteria.map((c) => (
                <li key={c.id} className="rounded-(--radius-card) border border-slate-200 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[0.95rem] font-medium text-slate-800">{c.title}</p>
                    {c.required && <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.82rem] text-slate-500">필수</span>}
                    <span className="ml-auto"><GateCriterionStatusBadge status={c.status} /></span>
                  </div>
                  {c.description && <p className="mt-1 text-[0.9rem] break-keep text-slate-500">{c.description}</p>}
                  <div className="mt-2">
                    <label className="sr-only" htmlFor={`crit-${c.id}`}>기준 상태</label>
                    <select
                      id={`crit-${c.id}`}
                      value={c.status}
                      disabled={!editable}
                      onChange={(e) => changeCriterion(c.id, e.target.value as GateCriterionStatus)}
                      className="rounded-(--radius-control) border border-slate-300 px-2.5 py-1.5 text-[0.95rem] text-slate-700 focus:border-brand-400 focus:outline-none disabled:opacity-50"
                    >
                      {GATE_CRITERION_STATUSES.map((s) => (
                        <option key={s} value={s}>{GATE_CRITERION_STATUS_META[s].label}</option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
            <div className="max-w-xs">
              <label htmlFor={`gate-st-${gate}`} className={labelCls}>Gate 판정</label>
              <select
                id={`gate-st-${gate}`}
                value={status}
                disabled={!editable}
                onChange={(e) => setStatus(e.target.value as ValidationGateStatus)}
                className={`${inputCls} disabled:opacity-50`}
              >
                {GATE_STATUSES.map((s) => (
                  <option key={s} value={s}>{GATE_STATUS_META[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`gate-sum-${gate}`} className={labelCls}>판정 요약</label>
              <textarea id={`gate-sum-${gate}`} value={summary} disabled={!editable} onChange={(e) => setSummary(e.target.value)} rows={2} className={`${inputCls} disabled:opacity-50`} />
            </div>
            <div>
              <label htmlFor={`gate-cond-${gate}`} className={labelCls}>조건 (조건부 통과 시)</label>
              <textarea id={`gate-cond-${gate}`} value={conditions} disabled={!editable} onChange={(e) => setConditions(e.target.value)} rows={2} className={`${inputCls} disabled:opacity-50`} />
            </div>
            <div>
              <label htmlFor={`gate-next-${gate}`} className={labelCls}>다음 조치</label>
              <textarea id={`gate-next-${gate}`} value={nextAction} disabled={!editable} onChange={(e) => setNextAction(e.target.value)} rows={2} className={`${inputCls} disabled:opacity-50`} />
            </div>
            {editable && (
              <div>
                <Button variant="primary" size="sm" onClick={saveStatus}>판정 저장</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 본문                                                                */
/* ------------------------------------------------------------------ */

function GatesBody({ w }: { w: ValidationWorkspace }) {
  const readOnly = w.status === 'finalized' || w.status === 'superseded'
  const { showToast } = useToast()
  const [expanded, setExpanded] = useState<ValidationGateNumber | null>(null)

  const refresh = () => {
    try {
      refreshGateDrafts(w.id)
      showToast('규칙 자동 초안을 새로고침했습니다.')
    } catch (error) {
      toastError(showToast, error)
    }
  }

  return (
    <>
      <ReadOnlyNotice workspace={w} />
      <HelpNote
        summary="8개 Gate를 순서대로 점검합니다. 규칙 기반 자동 초안은 참고용이며, 최종 상태는 담당자가 판정합니다."
        what="각 Gate의 기준을 확인하고 통과·조건부 통과·실패를 판정합니다."
        when="테스트 준비부터 결과 판정까지 단계별로 사용합니다."
        next="Gate 6 = 결과 판정, Gate 7 = 다음 단계 결정입니다. Gate 6 통과 후 검증을 확정합니다."
      />

      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={refresh} disabled={readOnly}>
          <RefreshCw aria-hidden="true" className="size-4" />
          규칙 자동 초안 새로고침
        </Button>
      </div>

      <div className="flex flex-col gap-2.5">
        {GATE_NUMBERS.map((gate) => {
          const review = w.gateReviews.find((g) => g.gate === gate)
          if (!review) return null
          return (
            <GateCard
              key={`${gate}-${review.version}-${review.status}`}
              workspaceId={w.id}
              gate={gate}
              review={review}
              readOnly={readOnly}
              expanded={expanded === gate}
              onToggle={() => setExpanded((prev) => (prev === gate ? null : gate))}
            />
          )
        })}
      </div>
    </>
  )
}

export function TrackGatesPage() {
  const { projectId = '', trackType = 'ax_mvp' } = useParams()
  return (
    <TrackSectionFrame
      projectId={projectId}
      trackType={trackType as ValidationTrackType}
      render={(w) => <GatesBody w={w} />}
    />
  )
}
