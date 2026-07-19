import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * 항상 최신 클로저를 참조하는 안정적인 콜백을 반환한다.
 * 자동 저장처럼 이벤트 리스너·타이머에서 최신 상태를 읽어야 할 때 사용한다.
 */
export function useCallbackRef<Args extends unknown[], R>(
  callback: (...args: Args) => R,
): (...args: Args) => R {
  const ref = useRef(callback)
  useLayoutEffect(() => {
    ref.current = callback
  })
  return useCallback((...args: Args) => ref.current(...args), [])
}
