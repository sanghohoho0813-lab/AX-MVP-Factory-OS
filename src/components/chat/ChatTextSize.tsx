/**
 * D-638 대화창 글자 크기 [가−] [가+] — 모델 고르기 옆 작은 단추 둘(다섯 단계). 모든 대화창이 같은 값(lib/chatSize).
 * 휴대폰에서도 누르기 쉽게 40px · PC 는 32px.
 */
import { CHAT_SIZES, setChatSizeStep, useChatSize } from '../../lib/chatSize'

export function ChatTextSize({ className = '', testId = 'chat-size' }: { className?: string; testId?: string }) {
  const step = useChatSize()
  const pct = Math.round(CHAT_SIZES[step] * 100)
  const btn =
    'tap t-meta inline-flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-default disabled:text-slate-300 disabled:hover:bg-transparent sm:size-8'
  return (
    <span className={`inline-flex shrink-0 items-center rounded-(--radius-control) border border-slate-200 bg-white ${className}`} data-testid={testId} data-step={step} title={`대화 글자 ${pct}%`}>
      <button type="button" onClick={() => setChatSizeStep(step - 1)} disabled={step === 0} aria-label={`대화 글자 작게 (지금 ${pct}%)`} className={btn} data-testid={`${testId}-down`}>
        가<span aria-hidden="true">−</span>
      </button>
      <span aria-hidden="true" className="h-4 w-px bg-slate-200" />
      <button type="button" onClick={() => setChatSizeStep(step + 1)} disabled={step === CHAT_SIZES.length - 1} aria-label={`대화 글자 크게 (지금 ${pct}%)`} className={btn} data-testid={`${testId}-up`}>
        가<span aria-hidden="true">+</span>
      </button>
    </span>
  )
}
