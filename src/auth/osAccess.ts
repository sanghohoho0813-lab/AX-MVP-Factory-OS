/**
 * 내부 OS 접근 등급 (D-162 · 1인 Pilot) — 서버(0019 os_access)가 정한다. 이메일로 비교하지 않는다.
 *
 *   full   대표 · 기존 구성원 — 지금까지와 똑같이 모든 메뉴
 *   pilot  1인 Pilot — 자기 작업공간 하나 · 간단한 메뉴(관리 · 내부 기능 없음)
 *   none   목록에 없는 계정(공개 사이트 가입자 등) — 내부 OS 를 열지 않는다
 *   legacy 서버에 0019 가 아직 없다 — 예전처럼(이미 작업공간이 있는 사람만 연다)
 */
import { useContext } from 'react'
import { getSupabaseClient } from '../lib/supabase/client'
import { AuthContext } from './authContext'

export type OsAccess = 'full' | 'pilot' | 'none' | 'legacy'

export async function fetchMyAccess(): Promise<OsAccess> {
  const { data, error } = await getSupabaseClient().rpc('my_os_access')
  if (error) {
    // 함수가 아직 없음(0019 전) — PostgREST 'PGRST202' · Postgres '42883'
    const code = (error as { code?: string }).code ?? ''
    if (code === 'PGRST202' || code === '42883' || /could not find the function|does not exist/i.test(error.message ?? '')) return 'legacy'
    throw new Error('접근 권한을 확인하지 못했습니다.')
  }
  return data === 'full' || data === 'pilot' ? data : 'none'
}

/** 지금 계정이 Pilot 인가 — 로컬 모드 · 로그인 전은 아니다 */
export function useIsPilot(): boolean {
  const auth = useContext(AuthContext)
  return auth?.access === 'pilot'
}
