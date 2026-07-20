import { useId } from 'react'
import { HelpCircle } from 'lucide-react'

/**
 * 전문 용어에 쉬운 설명을 붙인다.
 * 마우스 hover와 키보드 focus 모두에서 설명이 보이며, 색상만으로 구분하지 않고
 * 도움말 아이콘과 밑줄로도 표시한다.
 */
export function Term({ label, description }: { label: string; description: string }) {
  const id = useId()
  return (
    <span className="group relative inline-flex items-center">
      <button
        type="button"
        aria-describedby={id}
        className="inline-flex cursor-help items-center gap-0.5 border-b border-dotted border-slate-400 text-inherit focus:outline-none focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        {label}
        <HelpCircle aria-hidden="true" className="size-3 text-slate-400" />
      </button>
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-56 -translate-x-1/2 rounded-(--radius-control) bg-navy-900 px-3 py-2 text-xs leading-relaxed break-keep text-white opacity-0 shadow-(--shadow-overlay) transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {description}
      </span>
    </span>
  )
}
