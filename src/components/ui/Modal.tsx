import { useEffect, useRef, type ReactNode } from 'react'
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
      <button
        type="button"
        aria-label="모달 닫기"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-navy-950/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex max-h-[90vh] w-full flex-col rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-overlay) ${
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
