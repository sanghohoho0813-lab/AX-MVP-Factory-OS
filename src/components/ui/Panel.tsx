import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { useFold } from './fold'

interface PanelProps {
  title?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** 내부 여백 없이 표 등을 직접 배치할 때 */
  flush?: boolean
  /**
   * D-627 글자 수 한도 — 접는 판. 처음엔 제목 줄 + 지금 값(summary) 한 줄만, 누르면 펼친다(이 기기에 기억 · [모두 펼치기] 따름).
   * id 는 기억 열쇠(D-315 — 바꾸지 않는다).
   */
  fold?: { id: string; summary?: ReactNode }
}

/** 1px 테두리 + 약한 그림자의 공통 콘텐츠 패널 */
export function Panel(props: PanelProps) {
  if (props.fold) return <FoldPanel {...props} fold={props.fold} />
  const { title, actions, children, flush = false, className = '' } = props
  return (
    <section className={`rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card) ${className}`}>
      {(title || actions) && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        {title && <h2 className="text-[0.9375rem] font-semibold text-slate-900">{title}</h2>}
        {actions}
      </div>}
      <div className={flush ? '' : 'px-5 py-5'}>{children}</div>
    </section>
  )
}

function FoldPanel({ title, actions, children, flush = false, className = '', fold }: PanelProps & { fold: NonNullable<PanelProps['fold']> }) {
  const [open, setOpen] = useFold(fold.id, false)
  return (
    <section className={`rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card) ${className}`} data-fold-panel={fold.id}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        data-testid={`panel-fold-${fold.id}`}
        className={`tap flex w-full min-h-11 items-center gap-3 rounded-(--radius-panel) px-5 py-4 text-left hover:bg-slate-50 ${open ? 'rounded-b-none border-b border-slate-100' : ''}`}
      >
        <h2 className="min-w-0 flex-1 text-[0.9375rem] font-semibold break-keep text-slate-900">{title}</h2>
        {!open && fold.summary != null && <span className="min-w-0 truncate text-[0.875rem] text-slate-500">{fold.summary}</span>}
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          {actions && <div className="flex flex-wrap items-center justify-end gap-2 px-5 pt-3">{actions}</div>}
          <div className={flush ? '' : 'px-5 py-5'}>{children}</div>
        </>
      )}
    </section>
  )
}
