/**
 * AI 자리 단추 (D-142) — 나중에 GPT · Claude 를 붙일 곳을 미리 보라색으로 표시한다.
 *
 * 지금은 **아무것도 밖으로 보내지 않는다**(LLM 호출 0). 누르면 무엇을 해 줄 단추인지 한 줄 알려 줄 뿐.
 * 규칙 계산(매칭 · 판정 · 수금 상태)에는 이 단추를 쓰지 않는다 — 'AI' 라는 말은 실제 LLM 이 붙을 자리에만.
 */
import { Sparkles } from 'lucide-react'
import { useToast } from './toastContext'

export function AiSoonButton({ label, what, size = 'md', className = '' }: { label: string; what: string; size?: 'sm' | 'md'; className?: string }) {
  const { showToast } = useToast()
  return (
    <button
      type="button"
      data-testid="ai-soon"
      data-ai-what={what}
      onClick={() => showToast(`AI 연결 준비 중 — 연결하면 ${what}. 지금은 아무 내용도 밖으로 보내지 않습니다.`)}
      className={`inline-flex max-w-full min-w-0 cursor-pointer flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-(--radius-control) border border-violet-500 bg-gradient-to-r from-violet-600 to-fuchsia-600 py-1.5 text-center font-semibold break-keep text-white shadow-sm hover:from-violet-700 hover:to-fuchsia-700 ${size === 'sm' ? 'tap min-h-10 px-3 t-sub' : 'min-h-11 px-4 t-body sm:min-h-10'} ${className}`}
    >
      {/* D-142: 큰 글자 · 좁은 휴대폰에서는 줄을 바꾼다(화면 밖으로 밀리지 않게) */}
      <Sparkles aria-hidden="true" className="size-4 shrink-0" />
      {label}
      <span className="t-meta shrink-0 rounded-full bg-white/25 px-1.5 py-px font-semibold whitespace-nowrap">준비 중</span>
    </button>
  )
}
