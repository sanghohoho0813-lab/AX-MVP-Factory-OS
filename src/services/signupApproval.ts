/**
 * D-635 가입 신청 → 대표가 앱에서 승인 · 거절 — 서버 0029(my_signup_status · signup_requests* · signup_approve · signup_reject).
 *
 *  - 문은 DB 가 지킨다(대표만 목록 · 승인 · 거절 · 이메일 확인 전 승인 막힘 · 이미 등급 있는 계정 · 팀장 초대 · 홈페이지 회원은 목록에 없음).
 *    이 파일은 부르고 모양을 맞출 뿐이다.
 *  - 0029 전(함수 없음) · 되돌린 뒤(실행 권한 없음) · 로컬 모드 → 'missing' — 화면은 지금과 똑같다(예전 '승인 전' 화면 · 대표 칸 없음).
 *  - 로그인 화면 첫 조각과 같이 받는 작은 파일이다(승인 전 화면이 쓴다) — 다른 서비스를 끌어오지 않는다.
 */
import { getDataModeConfig } from '../data/dataMode'
import { getSupabaseClient } from '../lib/supabase/client'
import { isSelfSignupMissing } from './selfSignup'

/** 로그인한 사람의 가입 신청 상태 */
export type MySignupStatus = 'pending' | 'unconfirmed' | 'rejected' | 'has_access' | 'outside' | 'not_eligible' | 'missing'
/** 대표 [승인] · [거절] 결과 */
export type SignupDecisionResult = 'ok' | 'has_access' | 'unconfirmed' | 'not_eligible' | 'outside' | 'not_found' | 'missing'

export interface SignupRequest {
  userId: string
  email: string
  personName: string
  company: string
  intro: string
  signedUpAt: string
  emailConfirmed: boolean
  status: 'pending' | 'rejected'
  decidedAt: string
  note: string
}

/** 승인 · 거절 뒤 종 · 메뉴 숫자가 다시 세도록 알리는 창 이벤트 이름 */
export const SIGNUP_REQUESTS_CHANGED = 'signup-requests-changed'

/** 가입 화면에서 받는 칸의 길이(서버 목록이 같은 길이로 자른다) */
export const SIGNUP_FIELD_MAX = { name: 40, company: 60, intro: 120 } as const

// ---------------------------------------------------------------- 규칙(순수)

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const MY: readonly MySignupStatus[] = ['pending', 'unconfirmed', 'rejected', 'has_access', 'outside', 'not_eligible']
const DECISION: readonly SignupDecisionResult[] = ['ok', 'has_access', 'unconfirmed', 'not_eligible', 'outside', 'not_found']

export function parseMySignupStatus(raw: unknown): MySignupStatus {
  const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).status : undefined
  return (MY as readonly string[]).includes(String(s)) ? (s as MySignupStatus) : 'outside'
}

export function parseSignupDecision(raw: unknown): SignupDecisionResult {
  const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).status : undefined
  return (DECISION as readonly string[]).includes(String(s)) ? (s as SignupDecisionResult) : 'not_found'
}

export function parseSignupRequests(raw: unknown): SignupRequest[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && typeof r.user_id === 'string')
    .map((r) => ({
      userId: str(r.user_id),
      email: str(r.email),
      personName: str(r.person_name),
      company: str(r.company),
      intro: str(r.intro),
      signedUpAt: str(r.signed_up_at),
      emailConfirmed: r.email_confirmed === true,
      status: r.status === 'rejected' ? 'rejected' : 'pending',
      decidedAt: str(r.decided_at),
      note: str(r.note),
    }))
}

/** 가입 화면 칸 정리 — 빈칸 하나로 · 길이 한도. 이름 · 소속은 꼭 · 소개는 골라서 */
export function cleanSignupFields(f: { name: string; company: string; intro: string }): { name: string; company: string; intro: string } {
  const one = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max)
  return { name: one(f.name, SIGNUP_FIELD_MAX.name), company: one(f.company, SIGNUP_FIELD_MAX.company), intro: one(f.intro, SIGNUP_FIELD_MAX.intro) }
}

/** 가입 화면 — 보내기 전 확인. 문제가 없으면 '' */
export function signupFormProblem(f: { name: string; company: string; email: string; password: string; confirm: string }): string {
  if (!f.name.trim()) return '이름을 적어 주세요.'
  if (!f.company.trim()) return '소속(회사 이름)을 적어 주세요. 없으면 "개인" 이라고 적어 주세요.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return '이메일 주소를 다시 확인해 주세요.'
  if (f.password.length < 6) return '비밀번호는 6자 이상으로 정해 주세요.'
  if (f.password !== f.confirm) return '비밀번호 확인이 위와 달라요. 같은 비밀번호를 한 번 더 적어 주세요.'
  return ''
}

/** 대표 목록 한 줄의 이름 — 이름 · 소속 · (없으면 이메일 앞부분) */
export function requestWho(r: Pick<SignupRequest, 'personName' | 'company' | 'email'>): string {
  const who = [r.personName, r.company].filter(Boolean).join(' · ')
  return who || r.email.split('@')[0] || '이름 없음'
}

/** 승인하면 열릴 작업공간 이름 처음 값 — 서버와 같은 순서(소속 → '<이름> 작업공간' → '내 작업공간') */
export function approveWorkspaceName(r: Pick<SignupRequest, 'personName' | 'company'>): string {
  const one = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max)
  const company = one(r.company, 40)
  if (company) return company
  const name = one(r.personName, 34)
  return name ? `${name} 작업공간` : '내 작업공간'
}

/** [승인] · [거절] 결과 → 대표가 볼 한 줄 */
export function decisionText(kind: 'approve' | 'reject', r: SignupDecisionResult, who: string): string {
  switch (r) {
    case 'ok':
      return kind === 'approve' ? `${who} 님 계정을 열었어요. 그분이 [다시 확인] 을 누르거나 다시 들어오면 바로 쓸 수 있어요.` : `${who} 님 가입을 거절했어요. 지운 것은 없어요 — 나중에 승인할 수도 있어요.`
    case 'has_access':
      return `${who} 님은 이미 쓸 수 있는 계정이에요.`
    case 'unconfirmed':
      return `${who} 님이 아직 가입 메일의 확인 링크를 누르지 않았어요. 확인한 뒤 승인할 수 있어요.`
    case 'not_eligible':
      return `${who} 님은 이미 다른 작업공간에 있거나 초대를 기다리는 계정이라 여기서 열 수 없어요.`
    case 'outside':
      return `${who} 님은 홈페이지에서 가입한 계정이라 여기서 열 수 없어요.`
    case 'missing':
      return '서버에 가입 승인 기능이 아직 없어요(0029 적용 전).'
    default:
      return '그 계정을 찾지 못했어요. 목록을 새로 불러올게요.'
  }
}

/** 날짜(한국 시각) — 2026.11.18 */
export function signupDay(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t + 9 * 60 * 60 * 1000)
  return `${d.getUTCFullYear()}.${d.getUTCMonth() + 1}.${d.getUTCDate()}`
}

// ---------------------------------------------------------------- 서버

const cloud = (): boolean => getDataModeConfig().mode === 'supabase'

/** 승인 전 화면 — 내 가입 신청은 어떻게 됐나(모르면 outside = 예전 화면 그대로) */
export async function loadMySignupStatus(): Promise<MySignupStatus> {
  if (!cloud()) return 'missing'
  try {
    const { data, error } = await getSupabaseClient().rpc('my_signup_status')
    if (error) return isSelfSignupMissing(error) ? 'missing' : 'outside'
    return parseMySignupStatus(data)
  } catch {
    return 'outside'
  }
}

/** 대표 — 가입 신청 목록(기다림 먼저 · 거절한 사람도). 대표가 아니면 [] · 0029 전이면 missing */
export async function loadSignupRequests(): Promise<{ status: 'ready'; rows: SignupRequest[] } | { status: 'missing' } | { status: 'off' }> {
  if (!cloud()) return { status: 'missing' }
  try {
    const { data, error } = await getSupabaseClient().rpc('signup_requests', { p_limit: 200 })
    if (error) return isSelfSignupMissing(error) ? { status: 'missing' } : { status: 'off' }
    return { status: 'ready', rows: parseSignupRequests(data) }
  } catch {
    return { status: 'off' }
  }
}

/** 대표 — 기다리는 가입 신청 수(종 · 설정). 모르면 0 */
export async function loadSignupRequestsCount(): Promise<number> {
  if (!cloud()) return 0
  try {
    const { data, error } = await getSupabaseClient().rpc('signup_requests_count')
    return !error && typeof data === 'number' && Number.isFinite(data) ? data : 0
  } catch {
    return 0
  }
}

/** 대표 — [승인](실패 · 연결은 던진다) */
export async function approveSignup(userId: string, workspaceName: string): Promise<SignupDecisionResult> {
  const { data, error } = await getSupabaseClient().rpc('signup_approve', { p_uid: userId, p_name: workspaceName.replace(/\s+/g, ' ').trim().slice(0, 40) })
  if (error) {
    if (isSelfSignupMissing(error) && !/not allowed/i.test(String(error.message ?? ''))) return 'missing'
    throw error
  }
  return parseSignupDecision(data)
}

/** 대표 — [거절](메모는 대표만 본다 · 실패 · 연결은 던진다) */
export async function rejectSignup(userId: string, note: string): Promise<SignupDecisionResult> {
  const { data, error } = await getSupabaseClient().rpc('signup_reject', { p_uid: userId, p_note: note.trim().slice(0, 200) })
  if (error) {
    if (isSelfSignupMissing(error) && !/not allowed/i.test(String(error.message ?? ''))) return 'missing'
    throw error
  }
  return parseSignupDecision(data)
}
