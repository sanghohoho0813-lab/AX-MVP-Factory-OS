/**
 * 휴대폰 폭(640px 미만)인가 (D-166) — 휴대폰에서만 목록을 짧게 보여 줄 때 쓴다(PC 는 그대로).
 * 화면을 돌리거나 창 폭이 바뀌면 따라간다.
 */
import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 639px)'

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(QUERY)
  mq.addEventListener?.('change', cb)
  return () => mq.removeEventListener?.('change', cb)
}

const snapshot = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches

export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
