/**
 * L-9 · D-609 고객(컨설턴트)마다 상담 신청 링크 — 서버 0027(intake_link_* · public_intake_*).
 *
 *  - 문은 DB 가 지킨다(주인만 만들기 · 공개 화면은 제목 · 소개만 · 신청은 그 작업공간 잠재고객으로) — 이 파일은 부르고 모양을 맞출 뿐이다.
 *  - 0027 전(함수 없음) · 되돌린 뒤(실행 권한 없음) · 로컬 모드 → 'missing' — 링크 칸은 그리지 않는다(지금과 같다).
 *  - 공개 신청 화면(/ask/<주소>)은 로그인 없이 — 여기 공개 함수 둘만 부른다.
 */
import { getDataModeConfig } from '../data/dataMode'
import { getSupabaseClient } from '../lib/supabase/client'

/** 공개 화면 '어디서 보고 오셨어요?' — 서버가 받는 값(그 밖은 '상담 링크'). 영업 관리 유입 경로 목록 · 글 보고 온 곳 세기(D-574)와 같은 말 */
export const INTAKE_SOURCES = ['스레드', '인스타', '유튜브', '블로그'] as const
export type IntakeSource = (typeof INTAKE_SOURCES)[number]
/** 경로를 안 고르면 서버가 적는 유입 경로 */
export const INTAKE_DEFAULT_SOURCE = '상담 링크'
/** 링크로 들어온 잠재고객의 다음 할 일(서버가 적는 글 그대로) */
export const INTAKE_NEXT_ACTION = '상담 신청 — 연락드리기'

/** ?from= 에 올 수 있는 영어 이름 → 경로 */
const FROM_ALIAS: Record<string, IntakeSource> = {
  threads: '스레드', thread: '스레드', instagram: '인스타', insta: '인스타', ig: '인스타',
  youtube: '유튜브', yt: '유튜브', shorts: '유튜브', blog: '블로그', naver: '블로그',
}

export interface IntakeLink {
  slug: string
  title: string
  intro: string
  createdAt: string
  received: number
  lastAt: string
}

export type IntakeState = { role: 'none' } | { role: 'owner'; link: IntakeLink | null; closed: number }

export const INTAKE_CHANGED = 'axmvp:intake-link-changed'

// ---------------------------------------------------------------- 규칙(순수)

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export function parseIntakeState(raw: unknown): IntakeState {
  if (!raw || typeof raw !== 'object') return { role: 'none' }
  const o = raw as Record<string, unknown>
  if (o.role !== 'owner') return { role: 'none' }
  const l = o.link && typeof o.link === 'object' ? (o.link as Record<string, unknown>) : null
  const slug = l ? str(l.slug) : ''
  return {
    role: 'owner',
    link: l && /^[0-9a-f]{12}$/.test(slug)
      ? { slug, title: str(l.title), intro: str(l.intro), createdAt: str(l.createdAt), received: Number(l.received) || 0, lastAt: str(l.lastAt) }
      : null,
    closed: Number(o.closed) || 0,
  }
}

/** 공개 주소 — 지금 열린 주소(운영 · 미리 보기 모두 같은 곳) */
export function intakeUrl(slug: string, origin: string = typeof window !== 'undefined' ? window.location.origin : ''): string {
  return `${origin.replace(/\/+$/, '')}/ask/${slug}`
}

/** 글 끝 · 프로필에 붙일 한 줄 */
export function intakeLine(slug: string, origin?: string): string {
  return `상담 신청은 여기로 → ${intakeUrl(slug, origin)}`
}

/** 처음 만들 때 제목 — '김은혜 상담 신청'. 이름이 비었거나 기본 이름이면 '상담 신청' */
export function defaultIntakeTitle(name: string, company = ''): string {
  const n = name.trim()
  const who = n && !['사용자', '팀장님', 'Pilot'].includes(n) ? n : company.trim()
  return who ? `${who} 상담 신청`.slice(0, 40) : '상담 신청'
}

/** 주소 /ask/<12자리> 에서 주소 조각을 꺼낸다 — 아니면 ''(App.tsx 첫 조각용 작은 파일과 같은 것) */
export { slugFromPath } from '../lib/askPath'

/** ?from=threads 같은 꼬리 → 경로(모르면 '') */
export function sourceFromQuery(search: string): IntakeSource | '' {
  const raw = new URLSearchParams(search).get('from')?.trim() ?? ''
  if (!raw) return ''
  if ((INTAKE_SOURCES as readonly string[]).includes(raw)) return raw as IntakeSource
  return FROM_ALIAS[raw.toLowerCase()] ?? ''
}

export interface IntakeForm {
  name: string
  companyName: string
  phone: string
  email: string
  message: string
  source: IntakeSource | ''
  consent: boolean
  /** 사람 눈에 안 보이는 칸 — 로봇이 채운다 */
  website: string
}

export const EMPTY_INTAKE_FORM: IntakeForm = { name: '', companyName: '', phone: '', email: '', message: '', source: '', consent: false, website: '' }

/** 보내기 전 확인(서버와 같은 규칙) — 문제 있으면 사람 말로 한 줄, 없으면 '' */
export function validateIntake(f: IntakeForm): string {
  if (!f.name.trim() && !f.companyName.trim()) return '이름이나 회사 이름을 적어 주세요.'
  const phone = f.phone.trim()
  const email = f.email.trim()
  if (!phone && !email) return '연락받을 휴대폰 번호(또는 이메일)를 적어 주세요.'
  if (phone && !/^[0-9+() -]{8,20}$/.test(phone)) return '휴대폰 번호는 숫자로 적어 주세요. 예: 010-1234-5678'
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return '이메일 모양이 맞지 않아요. 예: name@example.com'
  if (f.message.length > 500) return '하고 싶은 말은 500자까지 적을 수 있어요.'
  if (!f.consent) return '연락을 위해 적은 내용을 보내는 데 동의해 주세요.'
  return ''
}

/** 서버 오류 → 사람 말 */
export function intakeErrorText(error: unknown): string {
  const msg = String((error as { message?: string })?.message ?? '')
  if (/too many requests/i.test(msg)) return '잠깐 사이에 너무 많이 보냈어요. 10분쯤 뒤에 다시 보내 주세요.'
  if (/consent/i.test(msg)) return '연락을 위해 적은 내용을 보내는 데 동의해 주세요.'
  if (/name required/i.test(msg)) return '이름이나 회사 이름을 적어 주세요.'
  if (/contact required/i.test(msg)) return '연락받을 휴대폰 번호(또는 이메일)를 적어 주세요.'
  if (/invalid phone/i.test(msg)) return '휴대폰 번호는 숫자로 적어 주세요. 예: 010-1234-5678'
  if (/invalid email/i.test(msg)) return '이메일 모양이 맞지 않아요. 예: name@example.com'
  if (/[가-힣]/.test(msg)) return msg
  return '잠깐 연결이 안 됐어요. 잠시 뒤 다시 보내 주세요.'
}

/** 함수가 없거나(0027 전) 실행 권한이 없으면(되돌림) 'missing' 으로 본다 */
export function isIntakeMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  const code = String(error.code ?? '')
  return (
    code === '42883' || code === 'PGRST202' || code === '42501' ||
    /could not find the function|does not exist|schema cache|permission denied for function/i.test(String(error.message ?? ''))
  )
}

/** '11월 14일' — 한국 날짜 */
export function koDay(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t + 9 * 60 * 60 * 1000)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`
}

// ---------------------------------------------------------------- 서버 — 주인 화면

export type IntakeLoad = { status: 'ready'; state: IntakeState } | { status: 'missing' } | { status: 'off' }

const inflight = new Map<string, Promise<IntakeLoad>>()
/** 0027 전이면 한 시간 동안 다시 묻지 않는다(화면을 열 때마다 404 를 쌓지 않게 · 새로 고치면 다시 묻는다) */
let missingUntil = 0
const MISSING_MS = 60 * 60 * 1000

export function loadIntakeLink(workspaceId: string | null | undefined): Promise<IntakeLoad> {
  if (!workspaceId || getDataModeConfig().mode !== 'supabase') return Promise.resolve({ status: 'missing' })
  if (Date.now() < missingUntil) return Promise.resolve({ status: 'missing' })
  const hit = inflight.get(workspaceId)
  if (hit) return hit
  const run = (async (): Promise<IntakeLoad> => {
    try {
      const { data, error } = await getSupabaseClient().rpc('intake_link_state', { p_ws: workspaceId })
      if (error) {
        if (!isIntakeMissing(error)) return { status: 'off' }
        missingUntil = Date.now() + MISSING_MS
        return { status: 'missing' }
      }
      return { status: 'ready', state: parseIntakeState(data) }
    } catch {
      return { status: 'off' }
    } finally {
      setTimeout(() => inflight.delete(workspaceId), 0)
    }
  })()
  inflight.set(workspaceId, run)
  return run
}

async function call(fn: string, args: Record<string, unknown>): Promise<IntakeState> {
  const { data, error } = await getSupabaseClient().rpc(fn, args)
  if (error) throw error
  const state = parseIntakeState(data)
  try {
    window.dispatchEvent(new CustomEvent(INTAKE_CHANGED))
  } catch {
    // 듣는 쪽이 없어도 된다
  }
  return state
}

export const saveIntakeLink = (workspaceId: string, title: string, intro: string) => call('intake_link_save', { p_ws: workspaceId, p_title: title, p_intro: intro })
export const rotateIntakeLink = (workspaceId: string) => call('intake_link_rotate', { p_ws: workspaceId })
export const offIntakeLink = (workspaceId: string) => call('intake_link_off', { p_ws: workspaceId })

// ---------------------------------------------------------------- 서버 — 공개 화면(로그인 없음)

export type PublicFormLoad = { status: 'open'; title: string; intro: string } | { status: 'closed' } | { status: 'error' }

export async function loadPublicIntakeForm(slug: string): Promise<PublicFormLoad> {
  if (!slug || getDataModeConfig().mode !== 'supabase') return { status: 'closed' }
  try {
    const { data, error } = await getSupabaseClient().rpc('public_intake_form', { p_slug: slug })
    if (error) return isIntakeMissing(error) ? { status: 'closed' } : { status: 'error' }
    if (!data || typeof data !== 'object') return { status: 'closed' }
    const o = data as Record<string, unknown>
    return { status: 'open', title: str(o.title) || '상담 신청', intro: str(o.intro) }
  } catch {
    return { status: 'error' }
  }
}

/** 'ok' = 접수됨(같은 연락처 다시 · 로봇 칸도 ok) · 'closed' = 그 사이 주소가 닫힘 */
export async function submitPublicIntake(slug: string, f: IntakeForm): Promise<'ok' | 'closed'> {
  const { data, error } = await getSupabaseClient().rpc('public_intake_submit', {
    p_slug: slug,
    p_payload: {
      name: f.name.trim(),
      company_name: f.companyName.trim(),
      phone: f.phone.trim(),
      email: f.email.trim(),
      message: f.message.trim(),
      source: f.source,
      consent: f.consent,
      website: f.website,
    },
  })
  if (error) {
    if (isIntakeMissing(error)) return 'closed'
    throw error
  }
  return data === 'closed' ? 'closed' : 'ok'
}
