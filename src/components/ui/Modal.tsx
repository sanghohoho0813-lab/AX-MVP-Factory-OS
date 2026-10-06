import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useBackToClose } from '../../lib/backToClose'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** 넓은 폼용 최대 너비 */
  size?: 'md' | 'lg'
}

export function Modal({ open, title, onClose, children, footer, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // D-157: 어두운 바깥을 눌러도 닫지 않는다(적던 것 · 올리던 서류가 사라졌다 — 대표). 창을 살짝 흔들어 '닫기는 오른쪽 위' 를 알린다
  // key 로 다시 그리면 안의 적던 칸이 지워진다 — 클래스만 잠깐 붙였다 뗀다
  const [nudge, setNudge] = useState(false)
  useEffect(() => {
    if (!nudge) return
    const t = window.setTimeout(() => setNudge(false), 420)
    return () => window.clearTimeout(t)
  }, [nudge])
  // D-124: 휴대폰 뒤로가기는 창만 닫는다(앞 화면으로 넘어가지 않는다)
  useBackToClose(open, onClose)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={() => setNudge(true)} className="absolute inset-0 cursor-default bg-navy-950/40" data-testid="modal-backdrop" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex max-h-[90vh] w-full flex-col rounded-(--radius-panel) ${nudge ? 'ax-nudge' : ''} border border-slate-200 bg-white shadow-(--shadow-overlay) ${
          size === 'lg' ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-[1.1rem] font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 text-sm leading-relaxed text-slate-600">
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
