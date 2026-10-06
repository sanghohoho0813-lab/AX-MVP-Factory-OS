/**
 * 인증·부트스트랩 컨텍스트.
 *
 * - local 모드: 로그인 없이 즉시 ready. Stage 1~11 동작에 아무 영향 없음.
 * - supabase 모드: 세션·워크스페이스를 확인해 부트스트랩 상태를 노출한다.
 *   조용히 local 로 fallback 하지 않으며, 설정·연결 오류를 명시적 상태로 표시한다.
 *
 * UI 는 이 컨텍스트만 사용하고 Supabase SDK 를 직접 호출하지 않는다.
 */

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { getDataModeConfig } from '../data/dataMode'
import {
  configurationErrorState,
  connectionErrorState,
  initializingState,
  localReadyState,
  noAccessState,
  noWorkspaceState,
  readyState,
  storageBlockedState,
  unauthenticatedState,
  type BootstrapState,
} from './bootstrap'
import { fetchMyAccess, fetchPilotViews, type OsAccess, type PilotView } from './osAccess'
import { vaultSignOut, vaultSwitchTo } from './storageVault'
import { getCurrentSession, onAuthStateChange, signOut as authSignOut } from './authService'
import { listMyWorkspaces, type WorkspaceMembership } from './workspaceService'
import { AuthContext, type AuthContextValue } from './authContext'

const WORKSPACE_STORAGE_KEY = 'axmvp.active_workspace'

export function AuthProvider({ children }: { children: ReactNode }) {
  const cfg = getDataModeConfig()
  const isLocal = cfg.mode === 'local'

  const [bootstrap, setBootstrap] = useState<BootstrapState>(() =>
    isLocal ? localReadyState() : initializingState('supabase'),
  )
  const [session, setSession] = useState<Session | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[]>([])
  const [access, setAccess] = useState<OsAccess | null>(null)
  const [pilotViews, setPilotViews] = useState<PilotView[]>([])
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
    } catch {
      return null
    }
  })
  const mounted = useRef(true)
  /** D-162: 지금 로그인한 사람 — 다른 창에서 사람이 바뀌면 새로 연다 */
  const userRef = useRef<string | null>(null)

  const resolveForSession = useCallback(
    async (nextSession: Session | null) => {
      if (!nextSession) {
        if (mounted.current) {
          setAccess(null)
          setBootstrap(unauthenticatedState('supabase'))
        }
        return
      }
      try {
        // D-162: 이 계정이 내부 OS 를 쓸 수 있는가(서버가 정한다) — 이메일로 비교하지 않는다
        const tier = await fetchMyAccess()
        if (!mounted.current) return
        setAccess(tier)
        if (tier === 'none') {
          setBootstrap(noAccessState('supabase'))
          return
        }
        // D-162: 이 브라우저의 사람별 값(도구 입력 · 작성 중인 글 · 쉬는 날 …)을 이 사람 것으로 바꿔 끼운다 — 지우지 않고 옮긴다
        const vault = vaultSwitchTo(nextSession.user.id, tier === 'pilot' ? 'pilot' : 'full')
        if (vault.blocked) {
          // 앞사람 값을 다 옮기지 못했다 — 누구에게도 앱을 열지 않고(새로 열기를 되풀이하지도 않고) 저장 공간을 비우라고 알린다
          setBootstrap(storageBlockedState('supabase'))
          return
        }
        if (vault.changed) {
          // 화면 모듈이 앞사람 값을 기억하지 않게 — 한 번 새로 연다(다음에는 바꿀 것이 없어 그대로 지나간다)
          window.location.reload()
          return
        }
        // 같은 작업공간의 다른 구성원 줄도 읽히므로 내 줄만(대표가 팀장 작업공간에 들어가 있어도 역할이 섞이지 않게)
        const memberships = (await listMyWorkspaces()).filter((m) => m.userId === nextSession.user.id)
        // D-164: 대표면 바로 볼 수 있는 팀장 화면 목록(0020 전이면 빈 목록)
        const views = tier === 'full' ? await fetchPilotViews() : []
        if (!mounted.current) return
        setWorkspaces(memberships)
        setPilotViews(views)
        if (memberships.length === 0) {
          // 0019 전(legacy)에는 새 작업공간을 만들지 않는다 — 공개 사이트 가입자가 내부 OS 를 여는 길을 막는다
          setBootstrap(tier === 'legacy' ? noAccessState('supabase') : noWorkspaceState('supabase'))
          return
        }
        // 저장된 선택이 유효하면 유지, 아니면 내가 주인인 가장 오래된 작업공간(목록 순서는 서버마다 다르다)
        const stored = safeReadWorkspace()
        const valid = memberships.find((m) => m.workspaceId === stored)
        const owned = memberships
          .filter((m) => m.workspace?.ownerId === nextSession.user.id)
          .sort((a, b) => (a.workspace?.createdAt ?? '').localeCompare(b.workspace?.createdAt ?? ''))
        const chosen = valid?.workspaceId ?? owned[0]?.workspaceId ?? memberships[0].workspaceId
        setCurrentWorkspaceId(chosen)
        safeWriteWorkspace(chosen)
        setBootstrap(readyState('supabase'))
      } catch {
        if (mounted.current) {
          setBootstrap(connectionErrorState('supabase', '작업공간 정보를 불러오지 못했습니다.'))
        }
      }
    },
    [],
  )

  useEffect(() => {
    mounted.current = true
    if (isLocal) return () => { mounted.current = false }

    // 설정 오류(anon 자리 service_role 등)는 연결 시도 전에 차단
    if (cfg.configError) {
      setBootstrap(configurationErrorState('supabase', cfg.configError, cfg.missingKeys))
      return () => { mounted.current = false }
    }

    let unsub: (() => void) | undefined
    ;(async () => {
      try {
        const current = await getCurrentSession()
        if (!mounted.current) return
        userRef.current = current?.user.id ?? null
        setSession(current)
        await resolveForSession(current)
        unsub = onAuthStateChange((next) => {
          // D-162: 다른 창에서 로그아웃 · 로그인이 바뀜 — 사람별 값을 넣어 두고 새로 연다(앞사람 값이 화면에 남지 않게)
          const prevUser = userRef.current
          userRef.current = next?.user.id ?? null
          if (prevUser && (!next || next.user.id !== prevUser)) {
            vaultSignOut(window.localStorage, window.sessionStorage, prevUser)
            window.location.replace('/login')
            return
          }
          setSession(next)
          void resolveForSession(next)
        })
      } catch {
        if (mounted.current) {
          setBootstrap(connectionErrorState('supabase', 'Supabase 에 연결하지 못했습니다.'))
        }
      }
    })()

    return () => {
      mounted.current = false
      unsub?.()
    }
    // cfg 는 앱 실행 중 불변(1회 계산 캐시)
  }, [isLocal, cfg, resolveForSession])

  const selectWorkspace = useCallback((workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId)
    safeWriteWorkspace(workspaceId)
  }, [])

  const refreshWorkspaces = useCallback(async () => {
    await resolveForSession(session)
  }, [resolveForSession, session])

  const signOut = useCallback(async () => {
    safeWriteWorkspace(null)
    // D-162: 사람별 값을 이 사람 금고로 넣고(지우지 않음) 로그아웃 — 그다음 화면을 새로 연다(메모리에 남은 앞사람 값까지 비운다)
    vaultSignOut(window.localStorage, window.sessionStorage, userRef.current)
    userRef.current = null
    await authSignOut()
    setSession(null)
    setWorkspaces([])
    setCurrentWorkspaceId(null)
    setAccess(null)
    setBootstrap(unauthenticatedState('supabase'))
    window.location.replace('/login')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      bootstrap,
      session,
      workspaces,
      currentWorkspaceId,
      access,
      pilotViews,
      selectWorkspace,
      refreshWorkspaces,
      signOut,
    }),
    [bootstrap, session, workspaces, currentWorkspaceId, access, pilotViews, selectWorkspace, refreshWorkspaces, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 는 AuthProvider 안에서만 사용할 수 있습니다.')
  return ctx
}

function safeReadWorkspace(): string | null {
  try {
    return window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
  } catch {
    return null
  }
}

function safeWriteWorkspace(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(WORKSPACE_STORAGE_KEY, id)
    else window.localStorage.removeItem(WORKSPACE_STORAGE_KEY)
  } catch {
    // 무시 (세션 내 상태는 유지)
  }
}
