/**
 * 머리줄 '글자 크기' 단추 (D-120) — 설정 깊숙이 있던 글자 크기를 한 번 눌러 바꾼다.
 * 누를 때마다 기본 → 크게 → 매우 크게 → 기본. 지금 크기를 글로 보여 준다(50~60대도 무엇인지 알게).
 */
import { useTextScale } from './textScale'
import { TEXT_SCALES, TEXT_SCALE_META } from '../../lib/uiTextScale'

export function TextScaleQuickButton() {
  const { scale, setScale } = useTextScale()
  const next = TEXT_SCALES[(TEXT_SCALES.indexOf(scale) + 1) % TEXT_SCALES.length]
  const label = TEXT_SCALE_META[scale].label
  return (
    <button
      type="button"
      data-testid="text-scale-quick"
      data-scale={scale}
      onClick={() => setScale(next)}
      aria-label={`글자 크기 ${label} — 누르면 ${TEXT_SCALE_META[next].label}`}
      title={`글자 크기: ${label} (누르면 ${TEXT_SCALE_META[next].label})`}
      className="flex h-10 shrink-0 items-center gap-1 rounded-(--radius-control) border border-slate-200 bg-white px-2.5 text-slate-700 hover:border-brand-300 hover:text-brand-700"
    >
      <span aria-hidden="true" className="font-bold leading-none">
        <span className="text-[0.8rem]">가</span>
        <span className="text-[1.1rem]">가</span>
      </span>
      <span className="hidden text-[0.9rem] font-medium sm:inline">글자 {label}</span>
    </button>
  )
}
