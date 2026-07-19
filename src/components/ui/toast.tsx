import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { ToastContext } from './toastContext'

interface ToastEntry {
  id: number
  message: string
}

const TOAST_DURATION_MS = 3200

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string) => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_DURATION_MS)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex max-w-sm items-start gap-2.5 rounded-(--radius-card) border border-navy-700 bg-navy-900 px-4 py-3 text-sm text-white shadow-(--shadow-overlay)"
          >
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-500" />
            <p className="break-keep">{toast.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
