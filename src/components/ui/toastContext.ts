import { createContext, useContext } from 'react'

/** 알림 옆 단추 하나 — 예: '되돌리기' (D-122) */
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastContextValue {
  showToast: (message: string, action?: ToastAction) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
