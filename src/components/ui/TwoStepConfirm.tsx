/**
 * D-271 되살릴 수 없는 삭제 — 두 번 확인. 대표: "완벽하게 지우려면 두 번 확인 · 회사 이름을 그대로 넣게까지 빡세게 할 필요는 없고".
 * [영구 삭제] → "되살릴 수 없어요" [한 번 더 확인] → "정말 지울까요?" [영구 삭제] — 어느 때나 [취소].
 */
import { useState } from 'react'
import { Trash2 } from 'lucide-react'

export function TwoStepConfirm({
  label = '영구 삭제',
  first = '지우면 되살릴 수 없어요. 지울까요?',
  second = '마지막 확인 — 정말 영구 삭제할까요?',
  onConfirm,
  testId,
  className = '',
}: {
  label?: string
  first?: string
  second?: string
  onConfirm: () => void
  testId?: string
  className?: string
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  if (step === 0) {
    return (
      <button type="button" data-testid={testId} onClick={() => setStep(1)} className={`tap inline-flex h-10 shrink-0 items-center gap-1 rounded-(--radius-control) px-2.5 text-[0.9rem] font-medium text-slate-500 hover:bg-danger-50 hover:text-danger-700 ${className}`}>
        <Trash2 aria-hidden="true" className="size-4" />
        {label}
      </button>
    )
  }
  const question = step === 1 ? first : second
  return (
    <span role="alertdialog" aria-label={question} className={`inline-flex max-w-full min-w-0 flex-wrap items-center gap-1.5 rounded-(--radius-control) border border-danger-300 bg-danger-50 px-2 py-1 ${className}`} data-testid={testId ? `${testId}-ask` : undefined} data-step={step}>
      <span className="t-sub min-w-0 font-semibold break-keep [overflow-wrap:anywhere] text-danger-800">{question}</span>
      <button
        type="button"
        data-testid={testId ? `${testId}-${step === 1 ? 'next' : 'yes'}` : undefined}
        onClick={() => {
          if (step === 1) {
            setStep(2)
            return
          }
          setStep(0)
          onConfirm()
        }}
        className={`tap inline-flex h-9 items-center rounded-(--radius-control) px-3 text-[0.9rem] font-semibold ${step === 1 ? 'border border-danger-300 bg-white text-danger-800 hover:bg-danger-100' : 'bg-danger-600 text-white hover:bg-danger-700'}`}
      >
        {step === 1 ? '한 번 더 확인' : label}
      </button>
      <button type="button" onClick={() => setStep(0)} className="tap inline-flex h-9 items-center rounded-(--radius-control) border border-slate-300 bg-white px-3 text-[0.9rem] text-slate-700 hover:bg-slate-50">
        취소
      </button>
    </span>
  )
}
