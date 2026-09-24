import { useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AuthContext } from '../../auth/authContext'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { listClients } from '../../services/clientOpsService'
import { isOpenEvent, listEvents } from '../../services/customerBridgeService'
import { countPendingFirstMeetings } from '../../services/firstMeetingService'

export interface NavCounts {
  /** 등록된 고객사(보관 안 한 것) — 아직 못 읽었으면 null */
  clients: number | null
  /** 처리 안 한 상담신청(새로 · 연결됨 · 진행 중) */
  requests: number | null
  /** 아직 끝내지 않은 1차 미팅 */
  firstMeetings: number | null
}

/**
 * 사이드바 · 하단 탭 숫자 (D-104).
 *
 * 늘 지금 숫자를 보인다 — 업체를 더하거나 지우면(로컬 저장 알림) 바로, 클라우드에서는
 * 화면을 옮기거나 창으로 돌아올 때(다른 기기에서 늘어난 것) 다시 센다.
 * 못 읽으면 숫자를 빼고 메뉴는 그대로 둔다(숫자 때문에 메뉴가 깨지지 않게).
 */
export function useNavCounts(): NavCounts {
  const auth = useContext(AuthContext)
  const workspaceId = auth?.currentWorkspaceId ?? null
  const signedOut = auth !== null && !auth.session
  const version = useStoreVersion()
  const { pathname } = useLocation()
  const [focusTick, setFocusTick] = useState(0)
  const [counts, setCounts] = useState<NavCounts>({ clients: null, requests: null, firstMeetings: null })

  useEffect(() => {
    const bump = () => { if (document.visibilityState === 'visible') setFocusTick((t) => t + 1) }
    window.addEventListener('focus', bump)
    document.addEventListener('visibilitychange', bump)
    return () => {
      window.removeEventListener('focus', bump)
      document.removeEventListener('visibilitychange', bump)
    }
  }, [])

  useEffect(() => {
    if (signedOut) return
    let alive = true
    void (async () => {
      const [c, e, f] = await Promise.allSettled([listClients(workspaceId), listEvents(workspaceId), countPendingFirstMeetings(workspaceId)])
      if (!alive) return
      setCounts({
        clients: c.status === 'fulfilled' ? c.value.filter((r) => r.archivedAt === null).length : null,
        requests: e.status === 'fulfilled' ? e.value.filter(isOpenEvent).length : null,
        firstMeetings: f.status === 'fulfilled' ? f.value : null,
      })
    })()
    return () => { alive = false }
  }, [workspaceId, signedOut, version, pathname, focusTick])

  return counts
}
