import { useEffect, useState, type ReactNode } from 'react'
import type {
  AutomationCandidate,
  CandidateDomainScore,
} from '../../types/selection'
import { CANDIDATE_SCORE_DOMAIN_META } from '../../lib/selectionMeta'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

/* 점수 보정 */
export function CandidateScoreAdjustModal({
  open,
  domainScore,
  onClose,
  onSubmit,
}: {
  open: boolean
  domainScore: CandidateDomainScore | null
  onClose: () => void
  onSubmit: (afterScore: number, reason: string) => void
}) {
  const [score, setScore] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (open && domainScore) {
      setScore(String(domainScore.adjustedScore ?? domainScore.rawScore))
      setReason('')
      setError('')
    }
  }, [open, domainScore])
  if (!domainScore) return null
  const meta = CANDIDATE_SCORE_DOMAIN_META[domainScore.domain]
  const submit = () => {
    const v = Number(score)
    if (!Number.isFinite(v) || v < 0 || v > domainScore.maxScore) {
      setError(`0 ~ ${domainScore.maxScore} 범위의 점수를 입력하세요.`)
      return
    }
    if (reason.trim() === '') {
      setError('보정 사유를 입력하세요.')
      return
    }
    onSubmit(v, reason.trim())
  }
  return (
    <Modal
      open={open}
      title={`${meta.label} 점수 보정`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit}>보정 저장</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] break-keep text-slate-600">
          자동 계산 점수는 <strong>{domainScore.autoScore}점</strong>입니다. 보정 시 자동 계산값과 사유가 함께 보존됩니다.
        </p>
        <div>
          <label htmlFor="cand-adjust-score" className="mb-1.5 block text-sm font-medium text-slate-700">
            보정 점수 (0 ~ {domainScore.maxScore})
          </label>
          <input
            id="cand-adjust-score"
            type="number"
            min={0}
            max={domainScore.maxScore}
            step={0.5}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            aria-describedby="cand-adjust-help"
            className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <p id="cand-adjust-help" className="mt-1 text-xs text-slate-400">영역 최대 {domainScore.maxScore}점을 초과할 수 없습니다.</p>
        </div>
        <div>
          <label htmlFor="cand-adjust-reason" className="mb-1.5 block text-sm font-medium text-slate-700">
            보정 사유 <span className="text-danger-500">*</span>
          </label>
          <textarea
            id="cand-adjust-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {error && <p role="alert" className="text-[13px] text-danger-600">{error}</p>}
      </div>
    </Modal>
  )
}

/* 후보 병합 — 목록에서 2개 이상 선택 후 대상 지정 */
export function CandidateMergeModal({
  open,
  candidates,
  onClose,
  onSubmit,
}: {
  open: boolean
  candidates: AutomationCandidate[]
  onClose: () => void
  onSubmit: (targetId: string, sourceIds: string[], name: string, problem: string) => void
}) {
  const [checked, setChecked] = useState<string[]>([])
  const [targetId, setTargetId] = useState('')
  const [name, setName] = useState('')
  const [problem, setProblem] = useState('')
  useEffect(() => {
    if (open) {
      setChecked([])
      setTargetId('')
      setName('')
      setProblem('')
    }
  }, [open])

  const toggle = (c: AutomationCandidate) => {
    setChecked((prev) => {
      const next = prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
      if (!next.includes(targetId)) {
        const first = candidates.find((x) => x.id === next[0])
        setTargetId(first?.id ?? '')
        setName(first?.name ?? '')
        setProblem(first?.problemStatement ?? '')
      }
      return next
    })
  }

  const canMerge = checked.length >= 2 && targetId !== ''

  return (
    <Modal
      open={open}
      title="후보 병합"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button
            variant="primary"
            onClick={() => onSubmit(targetId, checked.filter((id) => id !== targetId), name, problem)}
            disabled={!canMerge}
          >
            병합
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] break-keep text-slate-500">
          동일한 업무를 가리키는 후보를 2개 이상 선택하고, 유지할 대상을 지정하세요. 서로 다른 업무는 병합하지 마세요.
        </p>
        <div className="flex flex-col gap-1.5">
          {candidates.map((c) => {
            const isChecked = checked.includes(c.id)
            return (
              <div key={c.id} className="flex items-center gap-2 rounded-(--radius-control) border border-slate-200 px-3 py-2 text-[13px]">
                <input type="checkbox" checked={isChecked} onChange={() => toggle(c)} aria-label={`${c.name} 병합 선택`} />
                <span className="min-w-0 flex-1 truncate text-slate-700">{c.name}</span>
                {isChecked && (
                  <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                    <input type="radio" name="merge-target" checked={targetId === c.id} onChange={() => { setTargetId(c.id); setName(c.name); setProblem(c.problemStatement) }} />
                    유지
                  </label>
                )}
              </div>
            )
          })}
        </div>
        {canMerge && (
          <>
            <div>
              <label htmlFor="merge-name" className="mb-1.5 block text-sm font-medium text-slate-700">통합 후보명</label>
              <input id="merge-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="merge-problem" className="mb-1.5 block text-sm font-medium text-slate-700">통합 문제 설명</label>
              <textarea id="merge-problem" value={problem} onChange={(e) => setProblem(e.target.value)} rows={2} className={inputCls} />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/* 수동 후보 추가 */
export interface ManualCandidateInput {
  name: string
  problemStatement: string
  currentProcess: string
  users: string
  monthlyVolume: number | null
  minutesPerCase: number | null
  expectedEffect: string
  reason: string
}

export function ManualCandidateModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (input: ManualCandidateInput) => void
}) {
  const [form, setForm] = useState<ManualCandidateInput>({
    name: '',
    problemStatement: '',
    currentProcess: '',
    users: '',
    monthlyVolume: null,
    minutesPerCase: null,
    expectedEffect: '',
    reason: '',
  })
  useEffect(() => {
    if (open) {
      setForm({ name: '', problemStatement: '', currentProcess: '', users: '', monthlyVolume: null, minutesPerCase: null, expectedEffect: '', reason: '' })
    }
  }, [open])

  const set = (patch: Partial<ManualCandidateInput>) => setForm((f) => ({ ...f, ...patch }))
  const num = (v: string): number | null => (v.trim() === '' ? null : Number(v))

  return (
    <Modal
      open={open}
      title="수동 후보 추가"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={() => onSubmit(form)} disabled={form.name.trim() === ''}>추가</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="후보명" required>
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} />
        </Field>
        <Field label="문제">
          <textarea value={form.problemStatement} onChange={(e) => set({ problemStatement: e.target.value })} rows={2} className={inputCls} />
        </Field>
        <Field label="현재 업무 흐름">
          <textarea value={form.currentProcess} onChange={(e) => set({ currentProcess: e.target.value })} rows={2} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="담당자">
            <input value={form.users} onChange={(e) => set({ users: e.target.value })} className={inputCls} />
          </Field>
          <Field label="월 처리건수">
            <input type="number" onChange={(e) => set({ monthlyVolume: num(e.target.value) })} className={inputCls} />
          </Field>
          <Field label="건당 소요시간(분)">
            <input type="number" onChange={(e) => set({ minutesPerCase: num(e.target.value) })} className={inputCls} />
          </Field>
          <Field label="예상 효과">
            <input value={form.expectedEffect} onChange={(e) => set({ expectedEffect: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field label="추가 이유">
          <input value={form.reason} onChange={(e) => set({ reason: e.target.value })} className={inputCls} />
        </Field>
      </div>
    </Modal>
  )
}

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-danger-500"> *</span>}
      </label>
      {children}
    </div>
  )
}
