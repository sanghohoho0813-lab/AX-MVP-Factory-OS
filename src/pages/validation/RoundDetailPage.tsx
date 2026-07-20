import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ClipboardCheck, FileWarning, Play } from 'lucide-react'
import type {
  ScenarioRun,
  ScenarioRunResult,
  ValidationRound,
  ValidationScenario,
  ValidationTrackType,
  ValidationWorkspace,
} from '../../types/validation'
import { RUN_RESULT_META, RUN_RESULTS } from '../../lib/validationMeta'
import { TONE_BADGE_CLASS } from '../../lib/statusMeta'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { Modal } from '../../components/ui/Modal'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { useToast } from '../../components/ui/toastContext'
import { RoundStatusBadge, RunResultBadge } from '../../components/validation/badges'
import {
  cancelRound,
  completeRound,
  recordScenarioRun,
  startRound,
} from '../../services/validationService'
import { TrackSectionFrame, ReadOnlyNotice } from './validationShared'

const labelClass = 'mb-1 block text-xs font-semibold text-slate-500'
const inputClass = 'w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[13px] focus:border-brand-400 focus:outline-none'

interface RunForm {
  participantId: string
  result: ScenarioRunResult
  observedBehavior: string
  actualResult: string
  timeSpentMinutes: string
  errorCount: string
  assistanceNeeded: boolean
  conditionRemaining: string
  notes: string
}

const EMPTY_RUN: RunForm = {
  participantId: '',
  result: 'passed',
  observedBehavior: '',
  actualResult: '',
  timeSpentMinutes: '',
  errorCount: '',
  assistanceNeeded: false,
  conditionRemaining: '',
  notes: '',
}

function toNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function latestRun(round: ValidationRound, scenarioId: string): ScenarioRun | undefined {
  const matches = round.scenarioRuns.filter((r) => r.scenarioId === scenarioId)
  return matches.length > 0 ? matches[matches.length - 1] : undefined
}

function RoundDetailBody({
  workspace: w,
  round,
}: {
  workspace: ValidationWorkspace
  round: ValidationRound
}) {
  const { showToast } = useToast()
  const readOnly = w.status === 'finalized' || w.status === 'superseded'
  const roundClosed = round.status === 'completed' || round.status === 'cancelled'
  const canRecord = round.status === 'in_progress' && !readOnly

  const [completeOpen, setCompleteOpen] = useState(false)
  const [summary, setSummary] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const [runOpen, setRunOpen] = useState(false)
  const [runScenario, setRunScenario] = useState<ValidationScenario | null>(null)
  const [runForm, setRunForm] = useState<RunForm>(EMPTY_RUN)

  const build = w.buildArtifacts.find((b) => b.id === round.buildArtifactId)
  const scenarios = round.scenarioIds
    .map((id) => w.scenarios.find((s) => s.id === id))
    .filter((s): s is ValidationScenario => s !== undefined)
  const participants = round.participantIds
    .map((id) => w.participants.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)

  const handleStart = () => {
    try {
      startRound(w.id, round.id)
      showToast('회차를 시작했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리에 실패했습니다.')
    }
  }

  const handleComplete = () => {
    setBusy(true)
    try {
      completeRound(w.id, round.id, summary)
      setCompleteOpen(false)
      showToast('회차를 완료했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = () => {
    setBusy(true)
    try {
      cancelRound(w.id, round.id)
      setCancelOpen(false)
      showToast('회차를 취소했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const openRun = (s: ValidationScenario) => {
    const prev = latestRun(round, s.id)
    setRunScenario(s)
    setRunForm(
      prev
        ? {
            participantId: prev.participantId,
            result: prev.result,
            observedBehavior: prev.observedBehavior,
            actualResult: prev.actualResult,
            timeSpentMinutes: prev.timeSpentMinutes?.toString() ?? '',
            errorCount: prev.errorCount?.toString() ?? '',
            assistanceNeeded: prev.assistanceNeeded,
            conditionRemaining: prev.conditionRemaining,
            notes: prev.notes,
          }
        : { ...EMPTY_RUN, participantId: participants[0]?.id ?? '' },
    )
    setRunOpen(true)
  }

  const submitRun = () => {
    if (!runScenario) return
    if (!runForm.participantId) {
      showToast('참여자를 선택하세요.')
      return
    }
    try {
      recordScenarioRun(w.id, round.id, {
        scenarioId: runScenario.id,
        participantId: runForm.participantId,
        result: runForm.result,
        observedBehavior: runForm.observedBehavior,
        actualResult: runForm.actualResult,
        timeSpentMinutes: toNumber(runForm.timeSpentMinutes),
        errorCount: toNumber(runForm.errorCount),
        assistanceNeeded: runForm.assistanceNeeded,
        conditionRemaining: runForm.result === 'conditional' ? runForm.conditionRemaining : '',
        notes: runForm.notes,
      })
      setRunOpen(false)
      showToast('실행 결과를 기록했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리에 실패했습니다.')
    }
  }

  const resultCounts = RUN_RESULTS.map((result) => ({
    result,
    count: round.scenarioRuns.filter((r) => r.result === result).length,
  }))

  return (
    <>
      <ReadOnlyNotice workspace={w} />

      <Panel
        title={round.name}
        actions={
          <div className="flex items-center gap-2">
            {(round.status === 'planned' || round.status === 'ready') && !readOnly && (
              <Button variant="primary" size="sm" onClick={handleStart}>
                <Play aria-hidden="true" className="size-4" />
                회차 시작
              </Button>
            )}
            {round.status === 'in_progress' && !readOnly && (
              <>
                <Button variant="primary" size="sm" onClick={() => { setSummary(round.summary); setCompleteOpen(true) }}>
                  <ClipboardCheck aria-hidden="true" className="size-4" />
                  회차 완료
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setCancelOpen(true)}>취소</Button>
              </>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">#{round.roundNumber}</span>
            <RoundStatusBadge status={round.status} />
          </div>
          {round.objective && <p className="text-[13px] break-keep text-slate-600">{round.objective}</p>}
          <p className="text-xs text-slate-500">테스트 버전: {build ? `${build.name}${build.version ? ` (${build.version})` : ''}` : '미지정'}</p>
        </div>

        {roundClosed && (
          <p className="mt-3 flex items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] break-keep text-slate-600">
            <FileWarning aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
            완료된 회차의 결과는 보존되며 수정할 수 없습니다.
          </p>
        )}
      </Panel>

      <Panel title="결과 요약">
        <div className="flex flex-wrap gap-2">
          {resultCounts.map(({ result, count }) => (
            <span key={result} className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px] font-medium ${TONE_BADGE_CLASS[RUN_RESULT_META[result].tone]}`}>
              {RUN_RESULT_META[result].label}
              <span className="font-bold">{count}</span>
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">기록된 실행 {round.scenarioRuns.length}건 · 대상 시나리오 {scenarios.length}개</p>
      </Panel>

      <Panel title={`시나리오 (${scenarios.length})`}>
        {scenarios.length === 0 ? (
          <p className="text-[13px] text-slate-500">이 회차에 배정된 시나리오가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {scenarios.map((s) => {
              const run = latestRun(round, s.id)
              return (
                <li key={s.id} className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold break-keep text-slate-800">{s.title}</p>
                        {s.required && <span className="rounded border border-brand-200 bg-brand-50 px-1 text-[11px] font-semibold text-brand-700">필수</span>}
                        {run ? <RunResultBadge result={run.result} /> : <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">미기록</span>}
                      </div>
                      <p className="mt-1 text-xs break-keep text-slate-500">통과 기준: {s.passRule.trim() ? s.passRule : '미입력'}</p>
                      {run?.observedBehavior && <p className="mt-1 text-xs break-keep text-slate-500">관찰: {run.observedBehavior}</p>}
                    </div>
                    {canRecord && (
                      <Button variant="secondary" size="sm" onClick={() => openRun(s)}>결과 기록</Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Modal
        open={completeOpen}
        title="회차 완료"
        onClose={() => setCompleteOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleteOpen(false)} disabled={busy}>취소</Button>
            <Button variant="primary" onClick={handleComplete} disabled={busy}>{busy ? '처리 중…' : '완료'}</Button>
          </>
        }
      >
        <p className="mb-2 break-keep">완료하면 이 회차의 결과는 보존되며 더 이상 수정할 수 없습니다.</p>
        <label htmlFor="rd-summary" className={labelClass}>회차 요약</label>
        <textarea id="rd-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} className={inputClass} placeholder="이번 회차에서 확인한 핵심 결과를 요약하세요." />
      </Modal>

      <ConfirmModal
        open={cancelOpen}
        title="회차 취소"
        message="이 회차를 취소합니다. 취소된 회차는 수정할 수 없습니다."
        warning="취소하면 이후 결과 기록이 불가능합니다."
        confirmLabel="회차 취소"
        danger
        busy={busy}
        onConfirm={handleCancel}
        onCancel={() => setCancelOpen(false)}
      />

      <Modal
        open={runOpen}
        title={`결과 기록 · ${runScenario?.title ?? ''}`}
        onClose={() => setRunOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRunOpen(false)}>취소</Button>
            <Button variant="primary" onClick={submitRun}>기록</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="run-part" className={labelClass}>참여자</label>
              <select id="run-part" value={runForm.participantId} onChange={(e) => setRunForm({ ...runForm, participantId: e.target.value })} className={inputClass}>
                <option value="">선택하세요</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="run-result" className={labelClass}>결과</label>
              <select id="run-result" value={runForm.result} onChange={(e) => setRunForm({ ...runForm, result: e.target.value as ScenarioRunResult })} className={inputClass}>
                {RUN_RESULTS.map((r) => (
                  <option key={r} value={r}>{RUN_RESULT_META[r].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="run-observed" className={labelClass}>관찰된 행동</label>
            <textarea id="run-observed" rows={2} value={runForm.observedBehavior} onChange={(e) => setRunForm({ ...runForm, observedBehavior: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="run-actual" className={labelClass}>실제 결과</label>
            <textarea id="run-actual" rows={2} value={runForm.actualResult} onChange={(e) => setRunForm({ ...runForm, actualResult: e.target.value })} className={inputClass} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="run-time" className={labelClass}>소요 시간(분)</label>
              <input id="run-time" type="number" min={0} value={runForm.timeSpentMinutes} onChange={(e) => setRunForm({ ...runForm, timeSpentMinutes: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="run-errors" className={labelClass}>오류 횟수</label>
              <input id="run-errors" type="number" min={0} value={runForm.errorCount} onChange={(e) => setRunForm({ ...runForm, errorCount: e.target.value })} className={inputClass} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-slate-700">
            <input type="checkbox" checked={runForm.assistanceNeeded} onChange={(e) => setRunForm({ ...runForm, assistanceNeeded: e.target.checked })} className="size-4 rounded border-slate-300" />
            도움이 필요했음
          </label>
          {runForm.result === 'conditional' && (
            <div>
              <label htmlFor="run-cond" className={labelClass}>남은 조건</label>
              <input id="run-cond" value={runForm.conditionRemaining} onChange={(e) => setRunForm({ ...runForm, conditionRemaining: e.target.value })} className={inputClass} placeholder="조건부 통과 시 남은 조건" />
            </div>
          )}
          <div>
            <label htmlFor="run-notes" className={labelClass}>메모</label>
            <textarea id="run-notes" rows={2} value={runForm.notes} onChange={(e) => setRunForm({ ...runForm, notes: e.target.value })} className={inputClass} />
          </div>
        </div>
      </Modal>
    </>
  )
}

function RoundNotFound() {
  return (
    <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-6 py-10 shadow-(--shadow-card)">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-(--radius-card) border border-slate-200 bg-slate-50 text-slate-400">
          <FileWarning className="size-5" />
        </span>
        <p className="mt-3 text-sm font-semibold break-keep text-slate-800">회차를 찾을 수 없습니다</p>
        <p className="mt-1 text-[13px] break-keep text-slate-500">주소가 잘못되었거나 이미 삭제된 회차입니다. 회차 목록에서 다시 선택하세요.</p>
      </div>
    </div>
  )
}

export function RoundDetailPage() {
  const { projectId = '', trackType = 'ax_mvp', roundId = '' } = useParams()
  return (
    <TrackSectionFrame
      projectId={projectId}
      trackType={trackType as ValidationTrackType}
      render={(w) => {
        const round = w.rounds.find((r) => r.id === roundId)
        if (!round) return <RoundNotFound />
        return <RoundDetailBody workspace={w} round={round} />
      }}
    />
  )
}
