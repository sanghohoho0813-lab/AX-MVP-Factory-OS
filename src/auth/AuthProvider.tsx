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
  createContext,
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
  noWorkspaceState,
  readyState,
  unauthenticatedState,
  type BootstrapState,
} from './bootstrap'
import { getCurrentSession, onAuthStateChange, signOut as authSignOut } from './authService'
import { listMyWorkspaces, type WorkspaceMembership } from './workspaceService'

interface AuthContextValue {
  bootstrap: BootstrapState
  session: Session | null
  workspaces: WorkspaceMembership[]
  currentWorkspaceId: string | null
  selectWorkspace: (workspaceId: string) => void
  refreshWorkspaces: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const WORKSPACE_STORAGE_KEY = 'axmvp.active_workspace'

export function AuthProvider({ children }: { children: ReactNode }) {
  const cfg = getDataModeConfig()
  const isLocal = cfg.mode === 'local'

  const [bootstrap, setBootstrap] = useState<BootstrapState>(() =>
    isLocal ? localReadyState() : initializingState('supabase'),
  )
  const [session, setSession] = useState<Session | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[]>([])
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
    } catch {
      return null
    }
  })
  const mounted = useRef(true)

  const resolveForSession = useCallback(
    async (nextSession: Session | null) => {
      if (!nextSession) {
        if (mounted.current) setBootstrap(unauthenticatedState('supabase'))
        return
      }
      try {
        const memberships = await listMyWorkspaces()
        if (!mounted.current) return
        setWorkspaces(memberships)
        if (memberships.length === 0) {
          setBootstrap(noWorkspaceState('supabase'))
          return
        }
        // 저장된 선택이 유효하면 유지, 아니면 첫 워크스페이스
        const stored = safeReadWorkspace()
        const valid = memberships.find((m) => m.workspaceId === stored)
        const chosen = valid?.workspaceId ?? memberships[0].workspaceId
        setCurrentWorkspaceId(chosen)
        safeWriteWorkspace(chosen)
        setBootstrap(readyState('supabase'))
      } catch {
        if (mounted.current) {
          setBootstrap(connectionErrorState('supabase', '워크스페이스 정보를 불러오지 못했습니다.'))
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
        setSession(current)
        await resolveForSession(current)
        unsub = onAuthStateChange((next) => {
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
    await authSignOut()
    setSession(null)
    setWorkspaces([])
    setCurrentWorkspaceId(null)
    safeWriteWorkspace(null)
    setBootstrap(unauthenticatedState('supabase'))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      bootstrap,
      session,
      workspaces,
      currentWorkspaceId,
      selectWorkspace,
      refreshWorkspaces,
      signOut,
    }),
    [bootstrap, session, workspaces, currentWorkspaceId, selectWorkspace, refreshWorkspaces, signOut],
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
