import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Lightbulb } from 'lucide-react'
import type { TestMethod, ValidationTrackType, ValidationWorkspace } from '../../types/validation'
import { TEST_METHODS, TEST_METHOD_META } from '../../lib/validationMeta'
import { updateBasics, updatePlan } from '../../services/validationService'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import { ReadOnlyNotice, TrackSectionFrame } from './validationShared'

const HYPOTHESIS_PRIORITY_LABEL: Record<string, string> = {
  critical: '매우 중요',
  high: '중요',
  medium: '보통',
  low: '낮음',
}

const inputClass = 'w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[14px] focus:border-brand-400 focus:outline-none'
const labelClass = 'mb-1 block text-xs font-semibold text-slate-500'

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  )
}

function PlanBody({ w, readOnly }: { w: ValidationWorkspace; readOnly: boolean }) {
  const { showToast } = useToast()
  const [objective, setObjective] = useState(w.objective)
  const [targetUsers, setTargetUsers] = useState(w.targetUsers)
  const [scope, setScope] = useState(w.plan.scope)
  const [outOfScope, setOutOfScope] = useState(w.plan.outOfScope)
  const [environment, setEnvironment] = useState(w.plan.environment)
  const [testMethod, setTestMethod] = useState<TestMethod>(w.plan.testMethod)
  const [startDate, setStartDate] = useState(w.plan.startDate)
  const [targetEndDate, setTargetEndDate] = useState(w.plan.targetEndDate)
  const [participantTarget, setParticipantTarget] = useState(String(w.plan.participantTarget))
  const [requiredRounds, setRequiredRounds] = useState(String(w.plan.requiredRounds))
  const [entryCriteria, setEntryCriteria] = useState(w.plan.entryCriteria.join('\n'))
  const [exitCriteria, setExitCriteria] = useState(w.plan.exitCriteria.join('\n'))
  const [privacyNotes, setPrivacyNotes] = useState(w.plan.privacyNotes)
  const [securityNotes, setSecurityNotes] = useState(w.plan.securityNotes)
  const [fallbackPlan, setFallbackPlan] = useState(w.plan.fallbackPlan)
  const [notes, setNotes] = useState(w.plan.notes)

  const toLines = (value: string): string[] =>
    value
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

  const save = () => {
    try {
      updateBasics(w.id, { objective, targetUsers })
      updatePlan(w.id, {
        scope,
        outOfScope,
        environment,
        testMethod,
        startDate,
        targetEndDate,
        participantTarget: Number(participantTarget) || 0,
        requiredRounds: Number(requiredRounds) || 0,
        entryCriteria: toLines(entryCriteria),
        exitCriteria: toLines(exitCriteria),
        privacyNotes,
        securityNotes,
        fallbackPlan,
        notes,
      })
      showToast('테스트 계획을 저장했습니다.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '처리에 실패했습니다.')
    }
  }

  return (
    <Panel title="테스트 계획">
      <div className="flex max-w-[1000px] flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="테스트 목적" htmlFor="p-objective">
            <textarea id="p-objective" value={objective} onChange={(e) => setObjective(e.target.value)} rows={2} disabled={readOnly} className={inputClass} />
          </Field>
          <Field label="대상 사용자" htmlFor="p-target-users">
            <textarea id="p-target-users" value={targetUsers} onChange={(e) => setTargetUsers(e.target.value)} rows={2} disabled={readOnly} className={inputClass} />
          </Field>
          <Field label="테스트 범위" htmlFor="p-scope">
            <textarea id="p-scope" value={scope} onChange={(e) => setScope(e.target.value)} rows={2} disabled={readOnly} className={inputClass} />
          </Field>
          <Field label="제외 범위" htmlFor="p-out-scope">
            <textarea id="p-out-scope" value={outOfScope} onChange={(e) => setOutOfScope(e.target.value)} rows={2} disabled={readOnly} className={inputClass} />
          </Field>
          <Field label="테스트 환경" htmlFor="p-env">
            <input id="p-env" value={environment} onChange={(e) => setEnvironment(e.target.value)} disabled={readOnly} className={inputClass} />
          </Field>
          <Field label="테스트 방식" htmlFor="p-method">
            <select id="p-method" value={testMethod} onChange={(e) => setTestMethod(e.target.value as TestMethod)} disabled={readOnly} className={inputClass}>
              {TEST_METHODS.map((m) => (
                <option key={m} value={m}>
                  {TEST_METHOD_META[m].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="시작일" htmlFor="p-start">
            <input id="p-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={readOnly} className={inputClass} />
          </Field>
          <Field label="목표 종료일" htmlFor="p-end">
            <input id="p-end" type="date" value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} disabled={readOnly} className={inputClass} />
          </Field>
          <Field label="목표 참여자 수" htmlFor="p-participants">
            <input id="p-participants" type="number" min={0} value={participantTarget} onChange={(e) => setParticipantTarget(e.target.value)} disabled={readOnly} className={inputClass} />
          </Field>
          <Field label="필요 회차 수" htmlFor="p-rounds">
            <input id="p-rounds" type="number" min={0} value={requiredRounds} onChange={(e) => setRequiredRounds(e.target.value)} disabled={readOnly} className={inputClass} />
          </Field>
          <Field label="진입 조건 (한 줄에 하나)" htmlFor="p-entry">
            <textarea id="p-entry" value={entryCriteria} onChange={(e) => setEntryCriteria(e.target.value)} rows={3} disabled={readOnly} className={inputClass} placeholder="예: 테스트 버전 준비 완료" />
          </Field>
          <Field label="종료 조건 (한 줄에 하나)" htmlFor="p-exit">
            <textarea id="p-exit" value={exitCriteria} onChange={(e) => setExitCriteria(e.target.value)} rows={3} disabled={readOnly} className={inputClass} placeholder="예: 필수 시나리오 통과율 80% 이상" />
          </Field>
          <Field label="개인정보 유의사항" htmlFor="p-privacy">
            <textarea id="p-privacy" value={privacyNotes} onChange={(e) => setPrivacyNotes(e.target.value)} rows={2} disabled={readOnly} className={inputClass} />
          </Field>
          <Field label="보안 유의사항" htmlFor="p-security">
            <textarea id="p-security" value={securityNotes} onChange={(e) => setSecurityNotes(e.target.value)} rows={2} disabled={readOnly} className={inputClass} />
          </Field>
          <Field label="대안 계획" htmlFor="p-fallback">
            <textarea id="p-fallback" value={fallbackPlan} onChange={(e) => setFallbackPlan(e.target.value)} rows={2} disabled={readOnly} className={inputClass} />
          </Field>
          <Field label="기타 메모" htmlFor="p-notes">
            <textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} disabled={readOnly} className={inputClass} />
          </Field>
        </div>
        {!readOnly && (
          <div>
            <Button variant="secondary" size="sm" onClick={save}>
              저장
            </Button>
          </div>
        )}
      </div>
    </Panel>
  )
}

function HypothesesPanel({ w }: { w: ValidationWorkspace }) {
  return (
    <Panel title="가설">
      {w.hypotheses.length === 0 ? (
        <p className="text-[13px] break-keep text-slate-500">등록된 가설이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {w.hypotheses.map((h) => (
            <li key={h.id} className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
              <div className="flex items-start gap-2">
                <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <p className="min-w-0 text-sm font-semibold break-keep text-slate-800">{h.statement}</p>
                <span className="ml-auto shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500">
                  {HYPOTHESIS_PRIORITY_LABEL[h.priority] ?? h.priority}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-slate-500">성공 조건</dt>
                  <dd className="text-[13px] break-keep text-slate-600">{h.successCondition || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-500">실패 조건</dt>
                  <dd className="text-[13px] break-keep text-slate-600">{h.failureCondition || '-'}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function TrackPlanPage() {
  const { projectId = '', trackType = 'ax_mvp' } = useParams()
  return (
    <TrackSectionFrame
      projectId={projectId}
      trackType={trackType as ValidationTrackType}
      render={(w) => {
        const readOnly = w.status === 'finalized' || w.status === 'superseded'
        return (
          <div className="flex flex-col gap-5">
            <ReadOnlyNotice workspace={w} />
            <PlanBody w={w} readOnly={readOnly} />
            <HypothesesPanel w={w} />
          </div>
        )
      }}
    />
  )
}
