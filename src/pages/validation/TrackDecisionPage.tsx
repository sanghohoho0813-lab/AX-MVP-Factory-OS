import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type {
  ValidationDecisionType,
  ValidationTrackType,
  ValidationWorkspace,
} from '../../types/validation'
import { DECISION_META, DECISION_TYPES } from '../../lib/validationMeta'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { HelpNote } from '../../components/ui/HelpNote'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import { DecisionBadge } from '../../components/validation/badges'
import {
  checkCanFinalize,
  finalizeWorkspace,
  markEvaluating,
  summarize,
  updateFinalDecision,
} from '../../services/validationService'
import { ReadOnlyNotice, TrackSectionFrame } from './validationShared'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none'
const labelCls = 'mb-1 block text-[0.9rem] font-semibold text-slate-500'

function toastError(showToast: (m: string) => void, error: unknown) {
  showToast(error instanceof Error ? error.message : '처리에 실패했습니다.')
}

/* ------------------------------------------------------------------ */
/* 확정 후 읽기 전용 표시                                               */
/* ------------------------------------------------------------------ */

function FinalizedView({ w }: { w: ValidationWorkspace }) {
  const d = w.finalDecision
  return (
    <Panel title="확정된 최종 결정">
      <div className="flex flex-wrap items-center gap-2">
        {d.type ? <DecisionBadge type={d.type} /> : <span className="text-sm text-slate-500">결정 미기록</span>}
        {d.decidedAt && <span className="text-[0.9rem] text-slate-400">{new Date(d.decidedAt).toLocaleDateString('ko-KR')}</span>}
      </div>
      {d.summary && <p className="mt-3 text-sm break-keep text-slate-700">{d.summary}</p>}
      {d.rationale && (
        <div className="mt-3"><p className={labelCls}>근거</p><p className="text-[0.95rem] break-keep whitespace-pre-wrap text-slate-600">{d.rationale}</p></div>
      )}
      {d.requiredActions.length > 0 && (
        <div className="mt-3">
          <p className={labelCls}>필요 조치</p>
          <ul className="list-disc pl-5 text-[0.95rem] break-keep text-slate-600">
            {d.requiredActions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* 편집 본문                                                            */
/* ------------------------------------------------------------------ */

function DecisionForm({ w }: { w: ValidationWorkspace }) {
  const { showToast } = useToast()
  const d = w.finalDecision
  const [type, setType] = useState<ValidationDecisionType | ''>(d.type ?? '')
  const [summary, setSummary] = useState(d.summary)
  const [rationale, setRationale] = useState(d.rationale)
  const [requiredActions, setRequiredActions] = useState(d.requiredActions.join('\n'))
  const [ownerId, setOwnerId] = useState(d.ownerId)
  const [targetDate, setTargetDate] = useState(d.targetDate)

  const save = () => {
    if (!type) {
      showToast('최종 결정 유형을 선택하세요.')
      return
    }
    if (!rationale.trim()) {
      showToast('결정 근거는 필수입니다.')
      return
    }
    try {
      updateFinalDecision(w.id, {
        type,
        summary,
        rationale: rationale.trim(),
        requiredActions: requiredActions.split('\n').map((s) => s.trim()).filter(Boolean),
        ownerId,
        targetDate,
      })
      showToast('최종 결정을 저장했습니다.')
    } catch (error) {
      // 범위 확대·운영 전환은 Gate 6 통과·critical 0·통과율 80%↑·KPI 측정이 없으면 차단된다
      toastError(showToast, error)
    }
  }

  return (
    <Panel title="최종 결정">
      <p className="mb-3 rounded-(--radius-control) border border-brand-100 bg-brand-50/60 px-3 py-2 text-[0.95rem] break-keep text-slate-600">
        범위 확대·운영 전환은 Gate 6 통과·미해결 critical 0·필수 통과율 80% 이상·KPI 측정 증거가 있어야 선택할 수 있습니다.
      </p>
      <div className="flex flex-col gap-3">
        <div className="max-w-sm">
          <label htmlFor="dec-type" className={labelCls}>결정 유형</label>
          <select id="dec-type" value={type} onChange={(e) => setType(e.target.value as ValidationDecisionType | '')} className={inputCls}>
            <option value="">미정</option>
            {DECISION_TYPES.map((t) => (
              <option key={t} value={t}>{DECISION_META[t].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dec-sum" className={labelCls}>요약</label>
          <textarea id="dec-sum" value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className={inputCls} />
        </div>
        <div>
          <label htmlFor="dec-rat" className={labelCls}>근거 (필수)</label>
          <textarea id="dec-rat" value={rationale} onChange={(e) => setRationale(e.target.value)} rows={3} className={inputCls} placeholder="테스트 결과·통과율·KPI·이슈 등 근거" />
        </div>
        <div>
          <label htmlFor="dec-act" className={labelCls}>필요 조치 (한 줄에 하나)</label>
          <textarea id="dec-act" value={requiredActions} onChange={(e) => setRequiredActions(e.target.value)} rows={3} className={inputCls} placeholder={'예: 저장 오류 수정\n예: 재시험 회차 진행'} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="dec-owner" className={labelCls}>담당자</label>
            <input id="dec-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="dec-date" className={labelCls}>목표일</label>
            <input id="dec-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <Button variant="primary" size="sm" onClick={save}>최종 결정 저장</Button>
        </div>
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* 본문                                                                */
/* ------------------------------------------------------------------ */

function DecisionBody({ w }: { w: ValidationWorkspace }) {
  const readOnly = w.status === 'finalized' || w.status === 'superseded'
  const { showToast } = useToast()
  const summary = summarize(w)
  const finalizeCheck = checkCanFinalize(w)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const toEvaluating = () => {
    try {
      markEvaluating(w.id)
      showToast('결과 검토 단계로 이동했습니다.')
    } catch (error) {
      toastError(showToast, error)
    }
  }

  const finalize = () => {
    setBusy(true)
    try {
      finalizeWorkspace(w.id)
      showToast('검증을 확정했습니다.')
      setConfirmOpen(false)
    } catch (error) {
      toastError(showToast, error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ReadOnlyNotice workspace={w} />
      <HelpNote
        summary="테스트 결과를 근거로 다음 단계를 결정하고, 준비가 되면 검증을 확정합니다. 근거 없는 성공 판정은 허용되지 않습니다."
        what="최종 결정을 기록하고, 품질검사를 통과하면 검증을 확정합니다."
        when="Gate 6 결과 판정을 마친 뒤 사용합니다."
        next="확정하면 워크스페이스가 읽기 전용으로 고정되고 인계 스냅샷이 생성됩니다."
      />

      <Panel title="현재 상태 요약">
        <p className="text-sm font-semibold text-slate-800">{summary.headline}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-[0.95rem] sm:grid-cols-4">
          <div><span className="text-[0.9rem] text-slate-400">필수 통과율</span><p className="font-semibold text-slate-800">{summary.requiredMeasured ? `${summary.requiredPassRate}%` : '측정 필요'}</p></div>
          <div><span className="text-[0.9rem] text-slate-400">미실행 필수</span><p className="font-semibold text-slate-800">{summary.requiredNotRun}건</p></div>
          <div><span className="text-[0.9rem] text-slate-400">미해결 이슈</span><p className="font-semibold text-slate-800">{summary.openIssues}건</p></div>
          <div><span className="text-[0.9rem] text-slate-400">KPI 측정</span><p className="font-semibold text-slate-800">{summary.metricsMeasured}/{summary.metricsDefined}</p></div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[0.95rem]">
          {summary.finalizeReady ? (
            <><CheckCircle2 aria-hidden="true" className="size-4 text-success-600" /><span className="font-medium text-success-700">확정 준비 완료</span></>
          ) : (
            <><AlertTriangle aria-hidden="true" className="size-4 text-warning-600" /><span className="font-medium text-warning-700">확정 차단 요인이 있습니다</span></>
          )}
        </div>
        {summary.hasOpenCritical && (
          <p className="mt-2 rounded-(--radius-control) border border-danger-200 bg-danger-50 px-3 py-2 text-[0.95rem] font-medium break-keep text-danger-700">
            미해결 critical 이슈가 있어 검증을 확정할 수 없습니다.
          </p>
        )}
        {summary.blockingReasons.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-[0.95rem] break-keep text-slate-600">
            {summary.blockingReasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
        {!readOnly && (w.status === 'testing' || w.status === 'ready') && (
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={toEvaluating}>결과 검토 단계로</Button>
          </div>
        )}
      </Panel>

      {readOnly ? (
        <FinalizedView w={w} />
      ) : (
        <>
          <DecisionForm w={w} />

          <Panel title="검증 확정">
            <p className="text-[0.95rem] break-keep text-slate-600">
              확정하면 이 검증은 읽기 전용으로 고정되고, 인계 스냅샷이 생성됩니다. 확정 전 아래 차단 요인이 모두 해소되어야 합니다.
            </p>
            {!finalizeCheck.ok && (
              <ul className="mt-3 list-disc pl-5 text-[0.95rem] break-keep text-danger-700">
                {finalizeCheck.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
            <div className="mt-4">
              <Button variant="primary" onClick={() => setConfirmOpen(true)} disabled={!finalizeCheck.ok || readOnly}>
                <CheckCircle2 aria-hidden="true" className="size-4" />
                검증 확정
              </Button>
            </div>
          </Panel>
        </>
      )}

      <ConfirmModal
        open={confirmOpen}
        title="검증 확정"
        message="이 검증을 확정할까요?"
        warning="확정하면 워크스페이스가 읽기 전용으로 고정되고 인계 스냅샷이 생성됩니다. 이후 수정하려면 새 버전을 만들어야 합니다."
        confirmLabel="확정"
        busy={busy}
        onConfirm={finalize}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

export function TrackDecisionPage() {
  const { projectId = '', trackType = 'ax_mvp' } = useParams()
  return (
    <TrackSectionFrame
      projectId={projectId}
      trackType={trackType as ValidationTrackType}
      render={(w) => <DecisionBody w={w} />}
    />
  )
}
