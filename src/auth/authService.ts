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
  /** D-635 대표가 승인할 때 볼 소속 · 한 줄 소개(전화 · 주민번호는 받지 않는다) */
  extra?: { company?: string; intro?: string },
): Promise<AuthResult> {
  try {
    // D-106: 내부 OS 직원 가입 표시 — 고객 플랫폼 회원가입 알림(잠재고객 상담신청)에서 빠지게 한다
    const meta: Record<string, string> = { signup_app: 'internal_os' }
    if (displayName) meta.display_name = displayName
    if (extra?.company) meta.company = extra.company
    if (extra?.intro) meta.intro = extra.intro
    const { data, error } = await getSupabaseClient().auth.signUp({ email, password, options: { data: meta } })
    if (error) return fail(error)
    return ok(data.session)
  } catch (err) {
    return fail(err)
  }
}

/** D-635 가입 확인 메일 다시 보내기(로그인 화면 '메일 인증이 아직' 일 때) */
export async function resendSignupEmail(email: string): Promise<{ ok: boolean; errorMessage?: string }> {
  try {
    const { error } = await getSupabaseClient().auth.resend({ type: 'signup', email })
    if (error) return { ok: false, errorMessage: toFriendlyAuthError(error).message }
    return { ok: true }
  } catch (err) {
    return { ok: false, errorMessage: toFriendlyAuthError(err).message }
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

/** D-163: 내 이름 · 직함 — 화면 사용자 칸 · 고객에게 가는 글 서명에 쓴다(로그인 계정 정보에 저장) */
export async function updateMyName(name: string, title: string): Promise<{ ok: boolean; errorMessage?: string }> {
  try {
    const { error } = await getSupabaseClient().auth.updateUser({ data: { display_name: name.trim().slice(0, 30), title: title.trim().slice(0, 20) } })
    if (error) return { ok: false, errorMessage: toFriendlyAuthError(error).message }
    return { ok: true }
  } catch (err) {
    return { ok: false, errorMessage: toFriendlyAuthError(err).message }
  }
}

/** D-185: 안내 영상 '앞으로 보지 않기' — 로그인 계정 정보에 남겨 다른 기기에서도 저절로 뜨지 않게 */
export async function setTutorialHidden(hidden: boolean): Promise<{ ok: boolean }> {
  try {
    const { error } = await getSupabaseClient().auth.updateUser({ data: { tutorial_hidden: hidden } })
    return { ok: !error }
  } catch {
    return { ok: false }
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
