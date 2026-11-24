import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Info, X } from 'lucide-react'
import { ToastContext, nextToasts, type ToastAction, type ToastEntry } from './toastContext'

/** D-650 휴대폰에서 창(시트)이 열려 있으면 알림은 위쪽에 — 아래에 띄우면 창의 방금 나온 결과 · 저장 단추를 덮었다 */
function dialogOpen(): boolean {
  if (typeof document === 'undefined') return false
  return [...document.querySelectorAll('[role="dialog"]')].some((el) => el.getClientRects().length > 0)
}

/**
 * 알림이 떠 있는 시간 (D-122) — 글이 길수록 오래. 예전에는 3.2초로 고정이라, 천천히 읽는 분은
 * 다 읽기 전에 사라졌다. 되돌리기 단추가 있으면 누를 시간을 더 준다.
 */
function durationOf(message: string, action?: ToastAction): number {
  const base = Math.min(9000, Math.max(4500, message.length * 70))
  return action ? Math.max(base, 8000) : base
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const [overDialog, setOverDialog] = useState(false)
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, action?: ToastAction) => {
      const id = nextId.current++
      setOverDialog(dialogOpen())
      setToasts((prev) => nextToasts(prev, { id, message, action }))
      window.setTimeout(() => dismiss(id), durationOf(message, action))
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* 휴대폰에서는 하단 메뉴 위에 뜬다(예전엔 메뉴를 덮었다). 글 부분은 눌러도 아래로 지나간다 — 단추만 받는다.
          D-650 휴대폰에서 창이 열려 있을 때 뜬 알림은 위쪽에(창 아래쪽의 결과 · 저장 단추를 덮지 않게). PC 는 그대로 오른쪽 아래
          D-653 쌓임은 창(z-50) 위 · 큰 달력 · 처음 안내(z-70) 아래 — body 로 옮겨 그린 창이 열려 있어도 [되돌리기] 가 눌린다 */}
      <div
        aria-live="polite"
        data-testid="toast-stack"
        data-place={overDialog ? 'top' : 'bottom'}
        className={`no-print pointer-events-none fixed inset-x-3 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:items-end lg:right-[calc(var(--dock-float,0px)+var(--side-reserve,0px)+1.5rem)] lg:bottom-6 ${overDialog ? 'top-[calc(0.5rem+env(safe-area-inset-top,0px))]' : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]'}`}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="flex w-full max-w-md items-start gap-2.5 rounded-(--radius-card) border border-navy-700 bg-navy-900 py-3 pr-2 pl-4 text-[0.9375rem] text-white shadow-(--shadow-overlay) sm:w-auto"
          >
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-500" />
            <p className="min-w-0 flex-1 break-keep">{toast.message}</p>
            {toast.action && (
              <button
                type="button"
                data-testid="toast-action"
                onClick={() => {
                  toast.action?.onClick()
                  dismiss(toast.id)
                }}
                className="tap pointer-events-auto -my-1 shrink-0 rounded-(--radius-control) bg-white/10 px-3 py-1.5 font-bold text-brand-300 hover:bg-white/20"
              >
                {toast.action.label}
              </button>
            )}
            <button type="button" aria-label="알림 닫기" onClick={() => dismiss(toast.id)} className="tap pointer-events-auto -my-1 flex shrink-0 items-center justify-center rounded-(--radius-control) text-slate-300 hover:bg-white/10 hover:text-white">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
