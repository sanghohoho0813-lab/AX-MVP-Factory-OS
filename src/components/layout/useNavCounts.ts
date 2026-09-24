import { useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { AuthContext } from '../../auth/authContext'
import { getDataModeConfig } from '../../data/dataMode'
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

const EMPTY: NavCounts = { clients: null, requests: null, firstMeetings: null }

/**
 * 메뉴 숫자는 한 곳에서만 센다 (D-105).
 *
 * D-104 에서는 사이드바 · 휴대폰 서랍 · 하단 탭이 각자, 화면을 옮길 때마다 업체 전체와 상담신청 전체를 새로 읽었다.
 * 클라우드에서는 화면 한 번 옮길 때 서버 요청이 둘~넷 더 나갔다. 이제
 *  - 같은 순간의 요청은 하나로 합친다(동시에 세 곳이 불러도 한 번),
 *  - 화면을 옮긴 것만으로는 15초 안에 다시 세지 않는다(클라우드),
 *  - 저장했을 때 · 창으로 돌아왔을 때 · 작업실을 바꿨을 때는 바로 센다.
 * 로컬 모드는 읽기가 싸서 화면을 옮길 때마다 센다(같은 순간 합치기만).
 */
const REFRESH_GAP_MS = 15_000
let current: NavCounts = EMPTY
let currentKey: string | null = null
let lastAt = 0
let inflight: Promise<void> | null = null
let inflightKey: string | null = null
let pendingForce = false
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((l) => l())
}

async function load(workspaceId: string | null): Promise<NavCounts> {
  const [c, e, f] = await Promise.allSettled([listClients(workspaceId), listEvents(workspaceId), countPendingFirstMeetings(workspaceId)])
  return {
    clients: c.status === 'fulfilled' ? c.value.filter((r) => r.archivedAt === null).length : null,
    requests: e.status === 'fulfilled' ? e.value.filter(isOpenEvent).length : null,
    firstMeetings: f.status === 'fulfilled' ? f.value : null,
  }
}

/** 숫자를 다시 센다. force 가 아니면 같은 작업실을 최근에 셌을 때 건너뛴다(클라우드). */
export function refreshNavCounts(workspaceId: string | null, force: boolean): void {
  const key = workspaceId ?? 'local'
  const cloud = getDataModeConfig().mode === 'supabase'
  if (inflight && inflightKey === key) {
    // 도는 중에 저장이 있었으면 끝난 뒤 한 번 더
    if (force) pendingForce = true
    return
  }
  if (!force && cloud && currentKey === key && Date.now() - lastAt < REFRESH_GAP_MS) return
  if (currentKey !== key) {
    current = EMPTY
    currentKey = key
    emit()
  }
  inflightKey = key
  inflight = load(workspaceId)
    .then((next) => {
      if (currentKey !== key) return
      current = next
      lastAt = Date.now()
      emit()
    })
    .finally(() => {
      inflight = null
      inflightKey = null
      if (pendingForce) {
        pendingForce = false
        refreshNavCounts(workspaceId, true)
      }
    })
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** 시험용 — 모듈 상태를 비운다 */
export function resetNavCountsForTest(): void {
  current = EMPTY
  currentKey = null
  lastAt = 0
  inflight = null
  inflightKey = null
  pendingForce = false
}

/**
 * 사이드바 · 하단 탭 숫자 (D-104 · D-105).
 * 못 읽으면 숫자만 빼고 메뉴는 그대로 둔다(숫자 때문에 메뉴가 깨지지 않게).
 */
export function useNavCounts(): NavCounts {
  const auth = useContext(AuthContext)
  const workspaceId = auth?.currentWorkspaceId ?? null
  const signedOut = auth !== null && !auth.session
  const version = useStoreVersion()
  const { pathname } = useLocation()
  const seenVersion = useRef(version)

  // 저장했을 때(로컬 알림) · 작업실이 바뀌었을 때는 바로
  useEffect(() => {
    if (signedOut) return
    const force = seenVersion.current !== version
    seenVersion.current = version
    refreshNavCounts(workspaceId, force)
  }, [workspaceId, signedOut, version])

  // 화면을 옮겼을 때 — 클라우드는 15초 안이면 건너뜀
  useEffect(() => {
    if (signedOut) return
    refreshNavCounts(workspaceId, false)
  }, [pathname, workspaceId, signedOut])

  // 창으로 돌아왔을 때 — 다른 기기에서 늘어난 것
  useEffect(() => {
    if (signedOut) return
    const back = () => { if (document.visibilityState === 'visible') refreshNavCounts(workspaceId, true) }
    window.addEventListener('focus', back)
    document.addEventListener('visibilitychange', back)
    return () => {
      window.removeEventListener('focus', back)
      document.removeEventListener('visibilitychange', back)
    }
  }, [workspaceId, signedOut])

  const counts = useSyncExternalStore(subscribe, () => current, () => current)
  return signedOut ? EMPTY : counts
}
