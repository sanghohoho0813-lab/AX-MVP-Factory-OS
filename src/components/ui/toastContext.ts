import { createContext, useContext } from 'react'

/** 알림 옆 단추 하나 — 예: '되돌리기' (D-122) */
export interface ToastAction {
  label: string
  onClick: () => void
}

/** 떠 있는 알림 한 장 */
export interface ToastEntry {
  id: number
  message: string
  action?: ToastAction
}

/**
 * D-650 같은 단추(예: '되돌리기')가 달린 알림은 마지막 한 장만 — 영업 단계를 세 번 바꾸면 '되돌리기' 알림 셋이
 * 화면 오른쪽 아래를 덮었다. 새 알림이 같은 이름의 단추를 달고 오면 예전 것은 내린다(되돌리기는 가장 최근 것이 쓰임).
 * 단추가 없는 알림 · 다른 이름의 단추 알림은 그대로 두고, 한 번에 셋까지(쌓이면 화면을 덮는다).
 */
export function nextToasts(prev: readonly ToastEntry[], entry: ToastEntry): ToastEntry[] {
  const kept = entry.action ? prev.filter((t) => t.action?.label !== entry.action?.label) : prev
  return [...kept.slice(-2), entry]
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
