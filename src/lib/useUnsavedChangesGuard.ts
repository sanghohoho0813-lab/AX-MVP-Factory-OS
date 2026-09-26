import { useCallback, useEffect, useRef } from 'react'
import { useBlocker, type Blocker } from 'react-router-dom'
import { closeTopLayer, hasOpenLayer } from './backToClose'

/**
 * 폼 이탈 보호: 변경 내용이 있으면 라우터 이동을 차단해 확인 모달을 띄우고,
 * 새로고침·창 닫기에는 브라우저 기본 확인을 요청한다.
 * 저장 성공 후에는 allowNavigation()을 호출한 뒤 이동한다.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const allowRef = useRef(false)
  /** D-124: 이번 막기가 '열린 창 닫기' 때문인가 — 라우터는 막기를 하나만 따르므로 여기서 BackToCloseGuard 몫까지 한다 */
  const layerRef = useRef(false)

  const blocker = useBlocker(({ currentLocation, nextLocation, historyAction }) => {
    layerRef.current = historyAction === 'POP' && hasOpenLayer()
    if (layerRef.current) return true
    if (allowRef.current) return false
    return dirty && currentLocation.pathname !== nextLocation.pathname
  })

  useEffect(() => {
    if (blocker.state !== 'blocked' || !layerRef.current) return
    layerRef.current = false
    blocker.reset()
    closeTopLayer()
  }, [blocker])

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

  // 창 닫기로 막은 것은 화면에 '나갈까요?' 를 띄우지 않는다
  const shown: Blocker =
    blocker.state === 'blocked' && layerRef.current ? { state: 'unblocked', proceed: undefined, reset: undefined, location: undefined } : blocker
  return { blocker: shown, allowNavigation }
}
