import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * 폼 이탈 보호: 변경 내용이 있으면 라우터 이동을 차단해 확인 모달을 띄우고,
 * 새로고침·창 닫기에는 브라우저 기본 확인을 요청한다.
 * 저장 성공 후에는 allowNavigation()을 호출한 뒤 이동한다.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const allowRef = useRef(false)

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (allowRef.current) return false
    return dirty && currentLocation.pathname !== nextLocation.pathname
  })

  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const allowNavigation = useCallback(() => {
    allowRef.current = true
  }, [])

  return { blocker, allowNavigation }
}
