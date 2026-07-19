// 인증 컨텍스트 — owner 로그인 (S1). staff 는 role 구조만 예약.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Profile } from './types'
import { configured, DEV_MOCK, getSessionProfile, signIn as repoSignIn, signOut as repoSignOut, supabase } from './repo'

type AuthState = {
  loading: boolean
  profile: Profile | null
  configured: boolean
  devMock: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)

  const refresh = useCallback(async () => {
    try {
      setProfile(await getSessionProfile())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    if (!supabase) return
    const { data: sub } = supabase.auth.onAuthStateChange(() => { void refresh() })
    return () => sub.subscription.unsubscribe()
  }, [refresh])

  const signIn = useCallback(async (email: string, password: string) => {
    await repoSignIn(email, password)
    await refresh()
  }, [refresh])

  const signOut = useCallback(async () => {
    await repoSignOut()
    setProfile(null)
  }, [])

  return (
    <AuthContext.Provider value={{ loading, profile, configured, devMock: DEV_MOCK, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider 밖에서 useAuth 를 호출했습니다.')
  return ctx
}
