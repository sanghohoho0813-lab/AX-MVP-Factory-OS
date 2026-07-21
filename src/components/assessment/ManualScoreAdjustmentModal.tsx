import { useEffect, useState } from 'react'
import type { DomainScore } from '../../types/assessment'
import { ASSESSMENT_DOMAIN_META } from '../../lib/assessmentMeta'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

interface ManualScoreAdjustmentModalProps {
  open: boolean
  domainScore: DomainScore | null
  onClose: () => void
  onSubmit: (afterScore: number, reason: string) => void
}

export function ManualScoreAdjustmentModal({
  open,
  domainScore,
  onClose,
  onSubmit,
}: ManualScoreAdjustmentModalProps) {
  const [score, setScore] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && domainScore) {
      setScore(String(domainScore.rawScore))
      setReason('')
      setError('')
    }
  }, [open, domainScore])

  if (!domainScore) return null
  const meta = ASSESSMENT_DOMAIN_META[domainScore.domain]

  const handleSubmit = () => {
    const value = Number(score)
    if (!Number.isFinite(value) || value < 0 || value > domainScore.maxScore) {
      setError(`0 ~ ${domainScore.maxScore} 범위의 점수를 입력하세요.`)
      return
    }
    if (reason.trim() === '') {
      setError('보정 사유를 입력하세요.')
      return
    }
    onSubmit(value, reason.trim())
  }

  return (
    <Modal
      open={open}
      title={`${meta.label} 점수 보정`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            보정 저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] break-keep text-slate-600">
          자동 계산 점수는 <strong>{domainScore.rawScore}점</strong>입니다. 담당자 판단으로
          보정하면 자동 계산값과 보정 사유가 함께 보존됩니다.
        </p>
        <div>
          <label
            htmlFor="adjust-score"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            보정 점수 (0 ~ {domainScore.maxScore})
          </label>
          <input
            id="adjust-score"
            type="number"
            min={0}
            max={domainScore.maxScore}
            step={0.5}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            aria-describedby="adjust-score-help"
            aria-invalid={error !== '' && (Number(score) < 0 || Number(score) > domainScore.maxScore)}
            className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <p id="adjust-score-help" className="mt-1 text-[0.875rem] text-slate-400">
            영역 최대 배점 {domainScore.maxScore}점을 초과할 수 없습니다.
          </p>
        </div>
        <div>
          <label
            htmlFor="adjust-reason"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            보정 사유 <span className="text-danger-500">*</span>
          </label>
          <textarea
            id="adjust-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="예: 현장 인터뷰에서 실제 반복업무량이 응답보다 많음을 확인함."
            className="w-full resize-none rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {error && (
          <p role="alert" className="text-[13px] text-danger-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
