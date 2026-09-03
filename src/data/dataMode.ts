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
    } else {
      configError = validateSupabaseUrl(supabaseUrl)
    }
  }

  return { mode, supabaseUrl, supabaseAnonKey, configError, missingKeys }
}

/**
 * VITE_SUPABASE_URL 검사.
 * 가장 흔한 실수는 대시보드 주소(https://supabase.com/dashboard/project/xxx)를 넣는 것이다.
 * 그 경우 무엇을 넣어야 하는지까지 알려준다.
 */
export function validateSupabaseUrl(url: string): string | null {
  const trimmed = url.trim().replace(/\/+$/, '')

  // 대시보드 주소를 넣은 경우 → 올바른 API 주소를 만들어 안내한다
  const dashboard = /^https?:\/\/(?:www\.)?supabase\.com\/dashboard\/project\/([a-z0-9]+)/i.exec(trimmed)
  if (dashboard) {
    return `VITE_SUPABASE_URL 에 대시보드 주소가 들어있습니다. 브라우저 주소창이 아니라 API 주소를 넣어야 합니다. 올바른 값: https://${dashboard[1]}.supabase.co`
  }

  if (!/^https:\/\//.test(trimmed)) {
    return 'VITE_SUPABASE_URL 은 https:// 로 시작해야 합니다.'
  }

  // 정상 형태: https://<project-ref>.supabase.co (자체 도메인도 허용)
  if (/\.supabase\.(co|in)$/i.test(trimmed)) return null
  if (/\/dashboard\//.test(trimmed) || /supabase\.com$/i.test(trimmed)) {
    return 'VITE_SUPABASE_URL 이 대시보드 주소로 보입니다. Project Settings > API 의 Project URL(https://... .supabase.co)을 넣어주세요.'
  }
  // 자체 도메인을 쓰는 경우는 통과시키되 경로가 붙어 있으면 막는다
  try {
    const parsed = new URL(trimmed)
    if (parsed.pathname !== '' && parsed.pathname !== '/') {
      return 'VITE_SUPABASE_URL 에는 경로 없이 주소만 넣어주세요. 예: https://abcdefgh.supabase.co'
    }
  } catch {
    return 'VITE_SUPABASE_URL 형식이 올바르지 않습니다.'
  }
  return null
}

/** 브라우저에 넣으면 안 되는 비밀 키인지 확인 (새 형식 sb_secret_...) */
export function looksLikeSecretApiKey(key: string): boolean {
  return key.trim().startsWith('sb_secret_')
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
  if (
    cfg.mode === 'supabase' &&
    cfg.supabaseAnonKey &&
    (looksLikeServiceRoleKey(cfg.supabaseAnonKey) || looksLikeSecretApiKey(cfg.supabaseAnonKey))
  ) {
    cached = {
      ...cfg,
      configError:
        'VITE_SUPABASE_ANON_KEY 자리에 비밀 키(service_role / sb_secret_)가 들어있습니다. 브라우저에는 공개용 키(anon 또는 sb_publishable_)만 사용하세요.',
    }
    return cached
  }
  cached = cfg
  return cached
}
