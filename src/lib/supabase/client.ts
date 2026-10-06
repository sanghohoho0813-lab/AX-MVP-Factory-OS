import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getDataModeConfig } from '../../data/dataMode'
import { CLOUD_WRITE_EVENT } from '../deviceView'

/** 자료를 쓰는 요청이 끝나면 창에 알린다(D-164 보기 무대 — PC · 휴대폰 화면이 서로 새로 읽게). 요청 자체는 그대로. */
const notifyingFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init)
  try {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (res.ok && method !== 'GET' && method !== 'HEAD' && /\/(rest|storage)\/v1\//.test(url) && !url.includes('/rest/v1/rpc/') && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(CLOUD_WRITE_EVENT))
    }
  } catch {
    /* 알림이 안 돼도 저장은 그대로 */
  }
  return res
}

/**
 * Supabase 클라이언트 (지연 생성). 이 모듈은 supabase 모드에서만 동적 import되어
 * local 데모 모드의 entry 번들에 Supabase SDK가 포함되지 않게 한다.
 * UI 컴포넌트는 이 모듈을 직접 쓰지 않고 Repository·Service 계층을 통해 접근한다.
 */

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (client) return client
  const cfg = getDataModeConfig()
  if (cfg.mode !== 'supabase') {
    throw new Error('supabase 모드가 아닙니다.')
  }
  if (cfg.configError || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    throw new Error('Supabase 설정이 올바르지 않습니다.')
  }
  client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    global: { fetch: notifyingFetch },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}

/** 테스트·로그아웃 시 클라이언트 캐시 초기화 */
export function resetSupabaseClient(): void {
  client = null
}
