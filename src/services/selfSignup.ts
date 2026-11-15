/**
 * L-7 · D-610 가입하면 바로 쓰기 — 서버 0028(signup_open · self_signup_*).
 *
 *  - 문은 DB 가 지킨다(기본 꺼짐 · 대표만 켬 · 이메일 확인 · 자리 수 · 이미 등급 있는 계정 막기) — 이 파일은 부르고 모양을 맞출 뿐이다.
 *  - 0028 전(함수 없음) · 되돌린 뒤(실행 권한 없음) · 로컬 모드 → 'missing' — 화면은 지금과 똑같다(승인 전 화면 · 대표 설정 칸 없음).
 *  - 로그인 화면 첫 조각과 같이 받는 작은 파일이다(승인 전 화면 · 가입 화면이 쓴다) — 다른 서비스를 끌어오지 않는다.
 */
import { getDataModeConfig } from '../data/dataMode'
import { getSupabaseClient } from '../lib/supabase/client'

/** 로그인한 새 가입자의 상태 — open 이면 [바로 시작하기] */
export type SelfSignupState = 'open' | 'closed' | 'has_access' | 'unconfirmed' | 'not_eligible' | 'missing'
/** [바로 시작하기] 결과 */
export type SelfSignupStart = 'ok' | 'closed' | 'has_access' | 'unconfirmed' | 'not_eligible' | 'busy' | 'missing'

export interface SelfSignupPolicy {
  open: boolean
  seatLimit: number
  trialDays: number
  monthlyUnits: number
  marketing: boolean
  updatedAt: string
}
export interface SelfSignupAdmin {
  policy: SelfSignupPolicy
  used: number
  seatsLeft: number
}
export interface SelfSignupAccount {
  email: string
  personName: string
  workspaceName: string
  joinedAt: string
  aiUntil: string
  active: boolean
}
export type SelfSignupAdminLoad = { status: 'ready'; admin: SelfSignupAdmin } | { status: 'none' } | { status: 'missing' } | { status: 'off' }

/** 대표가 고르는 값의 범위 — 서버(0028)와 같다 */
export const SELF_SIGNUP_LIMITS = {
  seatLimit: { min: 0, max: 1000 },
  trialDays: { min: 1, max: 365 },
  monthlyUnits: { min: 0, max: 100000 },
} as const

// ---------------------------------------------------------------- 규칙(순수)

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

const STATES: readonly SelfSignupState[] = ['open', 'closed', 'has_access', 'unconfirmed', 'not_eligible']
const STARTS: readonly SelfSignupStart[] = ['ok', 'closed', 'has_access', 'unconfirmed', 'not_eligible', 'busy']

export function parseSelfSignupState(raw: unknown): SelfSignupState {
  return (STATES as readonly string[]).includes(String(raw)) ? (raw as SelfSignupState) : 'closed'
}

export function parseSelfSignupStart(raw: unknown): SelfSignupStart {
  const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).status : undefined
  return (STARTS as readonly string[]).includes(String(s)) ? (s as SelfSignupStart) : 'closed'
}

export function parseSelfSignupAdmin(raw: unknown): SelfSignupAdminLoad {
  if (!raw || typeof raw !== 'object') return { status: 'none' }
  const o = raw as Record<string, unknown>
  if (o.role !== 'owner' || !o.policy || typeof o.policy !== 'object') return { status: 'none' }
  const p = o.policy as Record<string, unknown>
  return {
    status: 'ready',
    admin: {
      policy: {
        open: p.open === true,
        seatLimit: num(p.seatLimit, 3),
        trialDays: num(p.trialDays, 14),
        monthlyUnits: num(p.monthlyUnits, 100),
        marketing: p.marketing !== false,
        updatedAt: str(p.updatedAt),
      },
      used: num(o.used),
      seatsLeft: num(o.seatsLeft),
    },
  }
}

export function parseSelfSignupAccounts(raw: unknown): SelfSignupAccount[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({
      email: str(r.email),
      personName: str(r.person_name),
      workspaceName: str(r.workspace_name),
      joinedAt: str(r.joined_at),
      aiUntil: str(r.ai_until),
      active: r.active === true,
    }))
}

/** 대표 화면 맨 위 한 줄 — 지금 어떤 상태인지 */
export function selfSignupSummary(a: SelfSignupAdmin): string {
  if (!a.policy.open) return '꺼짐 — 스스로 가입한 사람은 "아직 사용 승인 전" 화면에서 기다려요. 계정은 지금처럼 대표님이 열어요.'
  if (a.seatsLeft <= 0) return `켜짐 · 자리 다 참(${a.used}명) — 새로 가입한 사람은 다시 "승인 전" 화면에서 기다려요.`
  return `켜짐 — 이메일 확인을 마친 새 가입자가 스스로 계정을 열어요. 남은 자리 ${a.seatsLeft}명(지금까지 ${a.used}명).`
}

/** [바로 시작하기] 결과 → 사람 말(ok 는 '') */
export function selfSignupStartText(r: SelfSignupStart): string {
  switch (r) {
    case 'ok':
    case 'has_access':
      return ''
    case 'busy':
      return '잠깐 사이에 시작한 분이 많아요. 잠시 뒤 다시 눌러 주세요.'
    case 'unconfirmed':
      return '가입할 때 받은 메일의 확인 링크를 먼저 눌러 주세요. 누른 뒤 다시 눌러 주세요.'
    case 'closed':
      return '방금 받을 자리가 다 찼어요. 안내받은 담당자에게 아래 이메일을 알려 주세요.'
    default:
      return '이 계정은 바로 시작할 수 없어요. 안내받은 담당자에게 아래 이메일을 알려 주세요.'
  }
}

/** 작업공간 이름 처음 값 — '<이름> 작업공간'(서버와 같은 모양) · 이름이 없으면 '내 작업공간' */
export function defaultWorkspaceName(displayName: string): string {
  const n = displayName.replace(/\s+/g, ' ').trim().slice(0, 34)
  return n ? `${n} 작업공간` : '내 작업공간'
}

/** 대표가 고른 값을 서버 범위 안 정수로 */
export function clampPolicyNumber(key: keyof typeof SELF_SIGNUP_LIMITS, v: unknown): number {
  const { min, max } = SELF_SIGNUP_LIMITS[key]
  const n = Math.round(num(v, min))
  return Math.min(max, Math.max(min, n))
}

/** 함수가 없거나(0028 전) 실행 권한이 없으면(되돌림) 'missing' 으로 본다 */
export function isSelfSignupMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  const code = String(error.code ?? '')
  return (
    code === '42883' || code === 'PGRST202' || code === '42501' ||
    /could not find the function|does not exist|schema cache|permission denied for function/i.test(String(error.message ?? ''))
  )
}

// ---------------------------------------------------------------- 서버

const cloud = (): boolean => getDataModeConfig().mode === 'supabase'

/** 가입 화면 — 지금 가입하면 바로 쓸 수 있나(로그인 없이). 모르면 false(지금 문구 그대로) */
export async function loadSignupOpen(): Promise<boolean> {
  if (!cloud()) return false
  try {
    const { data, error } = await getSupabaseClient().rpc('signup_open')
    return !error && data === true
  } catch {
    return false
  }
}

/** 승인 전 화면 — 나는 바로 시작할 수 있나 */
export async function loadSelfSignupState(): Promise<SelfSignupState> {
  if (!cloud()) return 'missing'
  try {
    const { data, error } = await getSupabaseClient().rpc('self_signup_state')
    if (error) return isSelfSignupMissing(error) ? 'missing' : 'closed'
    return parseSelfSignupState(data)
  } catch {
    return 'closed'
  }
}

/** [바로 시작하기] — 실패(연결)는 던진다 */
export async function startSelfSignup(workspaceName: string): Promise<SelfSignupStart> {
  const { data, error } = await getSupabaseClient().rpc('self_signup_start', { p_name: workspaceName.trim() })
  if (error) {
    if (isSelfSignupMissing(error)) return 'missing'
    throw error
  }
  return parseSelfSignupStart(data)
}

/** 대표 — 설정 읽기(대표가 아니면 none · 0028 전이면 missing) */
export async function loadSelfSignupAdmin(): Promise<SelfSignupAdminLoad> {
  if (!cloud()) return { status: 'missing' }
  try {
    const { data, error } = await getSupabaseClient().rpc('self_signup_admin')
    if (error) return isSelfSignupMissing(error) ? { status: 'missing' } : { status: 'off' }
    return parseSelfSignupAdmin(data)
  } catch {
    return { status: 'off' }
  }
}

/** 대표 — 설정 바꾸기(실패는 던진다) */
export async function saveSelfSignupAdmin(p: Pick<SelfSignupPolicy, 'open' | 'seatLimit' | 'trialDays' | 'monthlyUnits' | 'marketing'>): Promise<SelfSignupAdminLoad> {
  const { data, error } = await getSupabaseClient().rpc('self_signup_admin_save', {
    p_open: p.open,
    p_seat_limit: clampPolicyNumber('seatLimit', p.seatLimit),
    p_trial_days: clampPolicyNumber('trialDays', p.trialDays),
    p_monthly_units: clampPolicyNumber('monthlyUnits', p.monthlyUnits),
    p_marketing: p.marketing,
  })
  if (error) throw error
  return parseSelfSignupAdmin(data)
}

/** 대표 — 이 길로 열린 계정(최근 것부터) */
export async function loadSelfSignupAccounts(): Promise<SelfSignupAccount[]> {
  try {
    const { data, error } = await getSupabaseClient().rpc('self_signup_admin_list', { p_limit: 100 })
    return error ? [] : parseSelfSignupAccounts(data)
  } catch {
    return []
  }
}
