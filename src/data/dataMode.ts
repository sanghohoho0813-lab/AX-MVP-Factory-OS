/**
 * 데이터 모드 — local(브라우저 로컬 데모) vs supabase(클라우드 저장).
 * 환경변수만으로 결정하며, 컴포넌트마다 mode를 검사하지 않도록 이 모듈에서 한 번만 계산한다.
 * 환경변수가 불완전하면 조용히 local로 바꾸지 않고 설정 오류로 보고한다.
 */

export type DataMode = 'local' | 'supabase'

export interface DataModeConfig {
  mode: DataMode
  supabaseUrl: string
  supabaseAnonKey: string
  /** 설정 오류 사유(있으면 앱은 설정 오류 화면을 표시) */
  configError: string | null
  /** 누락된 환경변수 키 이름 목록 (값은 노출하지 않음) */
  missingKeys: string[]
}

function readEnv(key: string): string {
  const raw = (import.meta.env as Record<string, string | undefined>)[key]
  return typeof raw === 'string' ? raw.trim() : ''
}

/** 앱 시작 시 1회 계산되는 데이터 모드 설정 */
export function resolveDataModeConfig(): DataModeConfig {
  const rawMode = readEnv('VITE_DATA_MODE').toLowerCase()
  const supabaseUrl = readEnv('VITE_SUPABASE_URL')
  const supabaseAnonKey = readEnv('VITE_SUPABASE_ANON_KEY')

  // 기본값은 local (로그인 없이 시연 가능). supabase는 명시적으로 선택해야 한다.
  const mode: DataMode = rawMode === 'supabase' ? 'supabase' : 'local'

  const missingKeys: string[] = []
  let configError: string | null = null

  if (rawMode && rawMode !== 'local' && rawMode !== 'supabase') {
    configError = 'VITE_DATA_MODE 값이 올바르지 않습니다. local 또는 supabase 여야 합니다.'
  }

  if (mode === 'supabase') {
    if (!supabaseUrl) missingKeys.push('VITE_SUPABASE_URL')
    if (!supabaseAnonKey) missingKeys.push('VITE_SUPABASE_ANON_KEY')
    if (missingKeys.length > 0) {
      configError =
        '클라우드 저장 모드(supabase)에 필요한 설정이 없습니다. 아래 환경변수를 설정한 뒤 다시 시작하세요.'
    } else if (!/^https:\/\/.+\.supabase\.co/.test(supabaseUrl) && !supabaseUrl.startsWith('http')) {
      configError = 'VITE_SUPABASE_URL 형식이 올바르지 않습니다.'
    }
  }

  return { mode, supabaseUrl, supabaseAnonKey, configError, missingKeys }
}

/** anon key인지(브라우저 사용 가능) 매우 러프하게 확인 — service_role 유출 방지 보조 점검. */
export function looksLikeServiceRoleKey(key: string): boolean {
  // Supabase anon/service JWT는 'role' 클레임으로 구분된다. base64 payload를 안전하게만 확인한다.
  try {
    const parts = key.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload?.role === 'service_role'
  } catch {
    return false
  }
}

let cached: DataModeConfig | null = null
/** 앱 전역에서 공유하는 데이터 모드 설정 (1회 계산 후 캐시) */
export function getDataModeConfig(): DataModeConfig {
  if (cached) return cached
  const cfg = resolveDataModeConfig()
  // anon key 자리에 service_role 키가 들어오면 명확히 차단한다 (브라우저 유출 위험).
  if (cfg.mode === 'supabase' && cfg.supabaseAnonKey && looksLikeServiceRoleKey(cfg.supabaseAnonKey)) {
    cached = { ...cfg, configError: 'VITE_SUPABASE_ANON_KEY 자리에 service_role 키가 들어있습니다. 브라우저에는 anon 키만 사용하세요.' }
    return cached
  }
  cached = cfg
  return cached
}
