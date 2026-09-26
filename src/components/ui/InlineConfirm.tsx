/**
 * 그 자리에서 한 번 더 묻는 삭제 단추 (D-122).
 *
 * 한 번 누르면 지워지던 곳(수금 항목 · 지원사업 · 서류 칸 …)에 쓴다. 창을 띄우지 않고 그 줄에서
 * "지울까요? [지우기] [취소]" 로 바뀐다 — 휴대폰에서 잘못 스친 손가락 한 번으로는 지워지지 않는다.
 * 아이콘만 두지 않고 '삭제' 글자를 함께 둔다(50~60대는 휴지통 모양을 읽지 않는다).
 */
import { useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'

export function InlineConfirm({
  label = '삭제',
  question = '지울까요?',
  confirmLabel = '지우기',
  onConfirm,
  className = '',
  testId,
  icon,
}: {
  /** 단추 앞 그림 — 없으면 휴지통. null 이면 그림 없이 */
  icon?: ReactNode | null
  label?: string
  question?: string
  confirmLabel?: string
  onConfirm: () => void
  className?: string
  testId?: string
}) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button
        type="button"
        data-testid={testId}
        onClick={() => setAsking(true)}
        className={`tap inline-flex h-10 shrink-0 items-center gap-1 rounded-(--radius-control) px-2.5 text-[0.9rem] font-medium text-slate-500 hover:bg-danger-50 hover:text-danger-700 ${className}`}
      >
        {icon === undefined ? <Trash2 aria-hidden="true" className="size-4" /> : icon}
        {label}
      </button>
    )
  }
  return (
    <span role="alertdialog" aria-label={question} className={`inline-flex shrink-0 flex-wrap items-center gap-1.5 rounded-(--radius-control) border border-danger-200 bg-danger-50 px-2 py-1 ${className}`}>
      <span className="t-sub font-semibold text-danger-800">{question}</span>
      <button
        type="button"
        data-testid={testId ? `${testId}-yes` : undefined}
        onClick={() => {
          setAsking(false)
          onConfirm()
        }}
        className="tap inline-flex h-9 items-center rounded-(--radius-control) bg-danger-600 px-3 text-[0.9rem] font-semibold text-white hover:bg-danger-700"
      >
        {confirmLabel}
      </button>
      <button type="button" onClick={() => setAsking(false)} className="tap inline-flex h-9 items-center rounded-(--radius-control) border border-slate-300 bg-white px-3 text-[0.9rem] text-slate-700 hover:bg-slate-50">
        취소
      </button>
    </span>
  )
}
