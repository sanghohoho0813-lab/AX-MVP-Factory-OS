/**
 * 인증 서비스 — Supabase Auth 를 감싼 얇은 래퍼.
 * UI 는 Supabase SDK 를 직접 호출하지 않고 이 서비스만 사용한다.
 * supabase 모드에서만 의미가 있으며, anon key + RLS 로 동작한다(service_role 미사용).
 */

import type { Session, User } from '@supabase/supabase-js'
import { getSupabaseClient } from '../lib/supabase/client'
import { toFriendlyAuthError, type FriendlyAuthError } from './authErrors'

export interface AuthResult {
  ok: boolean
  user: User | null
  session: Session | null
  errorMessage?: string
  /** 화면에서 다음 행동을 안내하기 위한 원인 분류 */
  errorKind?: FriendlyAuthError['kind']
}

function ok(session: Session | null): AuthResult {
  return { ok: true, user: session?.user ?? null, session }
}

function fail(error: unknown): AuthResult {
  const friendly = toFriendlyAuthError(error)
  return { ok: false, user: null, session: null, errorMessage: friendly.message, errorKind: friendly.kind }
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password })
    if (error) return fail(error)
    return ok(data.session)
  } catch (err) {
    return fail(err)
  }
}

export async function signUpWithPassword(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResult> {
  try {
    const { data, error } = await getSupabaseClient().auth.signUp({
      email,
      password,
      options: { data: displayName ? { display_name: displayName } : undefined },
    })
    if (error) return fail(error)
    return ok(data.session)
  } catch (err) {
    return fail(err)
  }
}

export async function sendPasswordReset(email: string, redirectTo?: string): Promise<{ ok: boolean; errorMessage?: string }> {
  try {
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, { redirectTo })
    if (error) return { ok: false, errorMessage: toFriendlyAuthError(error).message }
    return { ok: true }
  } catch (err) {
    return { ok: false, errorMessage: toFriendlyAuthError(err).message }
  }
}

export async function updatePassword(newPassword: string): Promise<{ ok: boolean; errorMessage?: string }> {
  try {
    const { error } = await getSupabaseClient().auth.updateUser({ password: newPassword })
    if (error) return { ok: false, errorMessage: toFriendlyAuthError(error).message }
    return { ok: true }
  } catch (err) {
    return { ok: false, errorMessage: toFriendlyAuthError(err).message }
  }
}

export async function signOut(): Promise<void> {
  try {
    await getSupabaseClient().auth.signOut()
  } catch {
    // 로그아웃 실패는 조용히 무시하고 세션 캐시만 비운다(상위에서 처리)
  }
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await getSupabaseClient().auth.getSession()
  return data.session ?? null
}

/** 세션 변화 구독. 반환 함수로 구독 해제. */
export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const { data } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => data.subscription.unsubscribe()
}
