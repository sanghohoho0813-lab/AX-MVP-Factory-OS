/**
 * D-568 문의 · 화면 오류 (출시 목록 L-4) — 고객 · 팀장이 보낸 글과 화면 오류를 운영자(대표)가 받는다. 서버 0025(support_messages).
 *
 *  - 표 · 함수가 아직 없으면(0025 전) 'missing' — 화면은 단추를 숨긴다. 하루에 한 번만 다시 물어본다.
 *    잠깐 못 물어본 것은 'off' — 다음에 다시 묻는다.
 *  - 고객사 자료는 보내지 않는다: 적은 글 · 화면 주소(물음표 뒤는 뺀다) · 오류 글(긴 숫자 · 이메일은 가린다).
 *  - 쓰기는 전부 서버 함수(support_send · support_reply · support_mark_read · support_seen) — 하루 한도 · 권한은 서버가 본다.
 * 로그인(클라우드) 모드에서만 — 로컬 모드에는 운영자가 따로 없다.
 */
import { getDataModeConfig } from '../data/dataMode'
import { getSupabaseClient } from '../lib/supabase/client'
import { isStaleChunkError } from '../lib/staleChunk'

export type SupportKind = 'question' | 'error'
export type SupportState = 'ready' | 'missing' | 'off'

export interface SupportMessage {
  id: string
  kind: SupportKind
  body: string
  /** 화면 주소 · 오류 자리 같은 짧은 정보(글자만) */
  context: Record<string, string>
  createdAt: string
  readAt: string
  reply: string
  repliedAt: string
  seenAt: string
}

export interface InboxMessage extends SupportMessage {
  userId: string
  authorName: string
  authorEmail: string
  audience: 'internal' | 'customer'
}

export type SendResult = { ok: true; id: string } | { ok: false; reason: 'missing' | 'limit' | 'empty' | 'denied' | 'failed' }

/** 보냄 · 읽음 · 답장 — 숫자를 다시 센다 */
export const SUPPORT_CHANGED = 'axmvp:support-changed'
/** 0025 전 — 마지막으로 '없음' 을 확인한 때(하루에 한 번만 다시 묻는다) */
const MISSING_KEY = 'axmvp.support.missingAt'
/** 한 번이라도 문의를 보낸 브라우저 — 그때부터만 '답장 왔어요' 를 살핀다(안 쓴 사람에게는 요청 0) */
const SENT_KEY = 'axmvp.support.sent'
const DAY_MS = 24 * 60 * 60 * 1000
export const SUPPORT_BODY_MAX = 2000

// ---------------------------------------------------------------- 규칙(순수)

/** 긴 숫자(6자리 이상 · 사이에 - . 빈칸이 끼어도) · 이메일은 가린다 — 전화 · 사업자번호 · 주민번호가 오류 글에 섞여 나가지 않게 */
export function scrubText(input: string, max = 600): string {
  const s = String(input ?? '')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '(이메일)')
    .replace(/\d(?:[\s.-]?\d){5,}/g, '(숫자)')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/** 화면 주소 — 길만(물음표 · # 뒤는 보내지 않는다: 찾는 말 · 이름이 들어 있을 수 있다) */
export function cleanPath(pathname: string): string {
  const p = String(pathname ?? '').split(/[?#]/)[0] || '/'
  return p.length > 160 ? p.slice(0, 160) : p
}

/** 사람이 어쩔 수 없는 흔한 잡음 — 받은함을 채우지 않는다 */
export function isNoiseError(message: string): boolean {
  return /ResizeObserver loop|AbortError|The user aborted|Load failed|Failed to fetch|NetworkError|network request failed|Script error\.?$|cancelled|canceled/i.test(message)
}

export interface ErrorEnv {
  path: string
  /** 어디서 잡았나 — screen(화면 오류 판) · window(잡히지 않은 오류) · promise */
  source: 'screen' | 'window' | 'promise'
  build?: string
  viewport?: string
  agent?: string
}

/** 화면 오류 → 보낼 글 · 화면 정보. 새 버전 조각 오류 · 잡음 · 빈 오류는 null(보내지 않는다) */
export function errorReport(error: unknown, env: ErrorEnv): { body: string; context: Record<string, string> } | null {
  if (error === null || error === undefined) return null
  if (isStaleChunkError(error)) return null
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : (() => {
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  })()
  const head = scrubText([name && !message.startsWith(name) ? `${name}: ` : '', message].join(''), 400)
  if (!head || isNoiseError(`${name} ${message}`)) return null
  const stack = error instanceof Error && error.stack ? scrubText(error.stack.split('\n').slice(1, 5).map((l) => l.trim().replace(/https?:\/\/[^/\s)]+/g, '')).join('\n'), 500) : ''
  const context: Record<string, string> = { path: cleanPath(env.path), source: env.source }
  if (stack) context.stack = stack
  if (env.build) context.build = env.build.slice(0, 60)
  if (env.viewport) context.viewport = env.viewport.slice(0, 20)
  if (env.agent) context.agent = env.agent.slice(0, 120)
  return { body: head, context }
}

/** 표 · 함수가 아직 없다(0025 전) */
export function isMissingError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  const code = error.code ?? ''
  return code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST204' || code === 'PGRST205' || /could not find the (table|function)|does not exist|schema cache/i.test(error.message ?? '')
}

export function sendFailReason(error: { code?: string; message?: string } | null | undefined): Exclude<SendResult, { ok: true }>['reason'] {
  const msg = error?.message ?? ''
  if (/support_rate_limited/.test(msg)) return 'limit'
  if (/support_empty|support_bad_kind/.test(msg)) return 'empty'
  if (/support_not_allowed|support_login_required|support_operator_only/.test(msg) || error?.code === '42501') return 'denied'
  if (isMissingError(error)) return 'missing'
  return 'failed'
}

/** 보내기 실패를 사람 말로 */
export function sendFailText(reason: Exclude<SendResult, { ok: true }>['reason']): string {
  if (reason === 'limit') return '오늘 보낼 수 있는 만큼 다 보냈어요. 내일 다시 보내 주세요.'
  if (reason === 'empty') return '보낼 글을 적어 주세요.'
  if (reason === 'denied') return '이 계정으로는 보낼 수 없어요. 다시 로그인해 보세요.'
  if (reason === 'missing') return '문의 창구를 준비하고 있어요. 조금만 기다려 주세요.'
  return '보내지 못했어요. 적은 글은 그대로 있어요 — 잠시 뒤 다시 눌러 주세요.'
}

/** 내가 보낸 문의 가운데 답장이 왔는데 아직 안 본 것 */
export function unseenReplies(list: readonly SupportMessage[]): SupportMessage[] {
  return list.filter((m) => m.reply && !m.seenAt)
}

/** 운영자가 아직 안 읽은 것 */
export function inboxUnread(list: readonly InboxMessage[]): number {
  return list.filter((m) => !m.readAt).length
}

/** 문의의 지금 상태 한마디 */
export function messageStatus(m: SupportMessage): { key: 'sent' | 'read' | 'replied'; label: string } {
  if (m.reply) return { key: 'replied', label: '답장 왔어요' }
  if (m.readAt) return { key: 'read', label: '읽었어요' }
  return { key: 'sent', label: '보냈어요' }
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asContext(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string' && val) out[k] = val
    else if (typeof val === 'number' || typeof val === 'boolean') out[k] = String(val)
  }
  return out
}

/** 서버 줄 → 화면 모양(모르는 값은 빈칸으로) */
export function toMessage(row: Record<string, unknown>): SupportMessage {
  return {
    id: asText(row.id),
    kind: row.kind === 'error' ? 'error' : 'question',
    body: asText(row.body),
    context: asContext(row.context),
    createdAt: asText(row.created_at),
    readAt: asText(row.read_at),
    reply: asText(row.reply),
    repliedAt: asText(row.replied_at),
    seenAt: asText(row.seen_at),
  }
}

export function toInboxMessage(row: Record<string, unknown>): InboxMessage {
  return {
    ...toMessage(row),
    userId: asText(row.user_id),
    authorName: asText(row.author_name),
    authorEmail: asText(row.author_email),
    audience: row.author_audience === 'customer' ? 'customer' : 'internal',
  }
}

// ---------------------------------------------------------------- 서버

let known: SupportState | null = null
let probing: Promise<SupportState> | null = null

function readStore(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function writeStore(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    /* 못 적어도 그린다 */
  }
}

function markMissing() {
  known = 'missing'
  writeStore(MISSING_KEY, String(Date.now()))
}

function changed() {
  try {
    window.dispatchEvent(new Event(SUPPORT_CHANGED))
  } catch {
    /* 창이 없으면 넘어간다 */
  }
}

/** 문의 창구가 열려 있나 — 로컬 모드 · 0025 전이면 'missing'. 같은 순간의 물음은 하나로 합친다. */
export async function supportState(force = false): Promise<SupportState> {
  if (getDataModeConfig().mode !== 'supabase') return 'missing'
  if (!force && known === 'ready') return 'ready'
  if (!force && known === 'missing') return 'missing'
  if (!force) {
    const at = Number(readStore(MISSING_KEY) || 0)
    if (at && Date.now() - at < DAY_MS) {
      known = 'missing'
      return 'missing'
    }
  }
  if (probing) return probing
  probing = (async (): Promise<SupportState> => {
    try {
      const { error } = await getSupabaseClient().from('support_messages').select('id').limit(1)
      if (!error) {
        known = 'ready'
        writeStore(MISSING_KEY, '')
        return 'ready'
      }
      if (isMissingError(error)) {
        markMissing()
        return 'missing'
      }
      return 'off'
    } catch {
      return 'off'
    } finally {
      probing = null
    }
  })()
  return probing
}

/** 시험용 — 기억한 상태를 잊는다 */
export function resetSupportStateForTest() {
  known = null
  probing = null
}

export async function sendSupport(kind: SupportKind, body: string, context: Record<string, string> = {}): Promise<SendResult> {
  const text = body.trim().slice(0, SUPPORT_BODY_MAX)
  if (!text) return { ok: false, reason: 'empty' }
  try {
    const { data, error } = await getSupabaseClient().rpc('support_send', { p_kind: kind, p_body: text, p_context: context })
    if (error) {
      const reason = sendFailReason(error)
      if (reason === 'missing') markMissing()
      return { ok: false, reason }
    }
    known = 'ready'
    if (kind === 'question') writeStore(SENT_KEY, '1')
    changed()
    return { ok: true, id: typeof data === 'string' ? data : '' }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

/** 이 브라우저에서 문의를 보낸 적이 있나 — 있을 때만 답장을 살핀다 */
export function hasSentSupport(): boolean {
  return readStore(SENT_KEY) === '1'
}

/** 내가 보낸 것(최근 60줄) */
export async function listMySupport(userId: string): Promise<SupportMessage[]> {
  const { data, error } = await getSupabaseClient()
    .from('support_messages')
    .select('id,kind,body,context,created_at,read_at,reply,replied_at,seen_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) {
    if (isMissingError(error)) markMissing()
    throw new Error('보낸 문의를 불러오지 못했습니다.')
  }
  const list = (Array.isArray(data) ? data : []).map((r) => toMessage(r as Record<string, unknown>))
  if (list.some((m) => m.kind === 'question')) writeStore(SENT_KEY, '1')
  return list
}

/** 답장을 봤다 */
export async function markSupportSeen(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await getSupabaseClient().rpc('support_seen', { p_ids: ids })
  if (!error) changed()
}

/** 운영자 받은함 — 운영자가 아니면 서버가 빈 목록을 준다 */
export async function listSupportInbox(): Promise<InboxMessage[]> {
  const { data, error } = await getSupabaseClient().rpc('support_inbox', { p_limit: 200 })
  if (error) {
    if (isMissingError(error)) {
      markMissing()
      return []
    }
    throw new Error('받은 문의를 불러오지 못했습니다.')
  }
  return (Array.isArray(data) ? data : []).map((r) => toInboxMessage(r as Record<string, unknown>))
}

export async function markSupportRead(ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) return true
  const { error } = await getSupabaseClient().rpc('support_mark_read', { p_ids: ids })
  if (error) return false
  changed()
  return true
}

export async function replySupport(id: string, reply: string): Promise<boolean> {
  const text = reply.trim().slice(0, SUPPORT_BODY_MAX)
  if (!text) return false
  const { data, error } = await getSupabaseClient().rpc('support_reply', { p_id: id, p_reply: text })
  if (error || data !== true) return false
  changed()
  return true
}

// ---------------------------------------------------------------- 화면 오류 자동으로 알리기

const reported = new Set<string>()
const MAX_PER_LOAD = 5

function buildName(): string {
  try {
    const el = document.querySelector('script[type="module"][src*="/assets/"]') as HTMLScriptElement | null
    return el?.src.split('/').pop() ?? ''
  } catch {
    return ''
  }
}

/**
 * 화면 오류를 운영자에게 알린다 — 같은 오류는 한 번 · 한 번 여는 동안 5개까지.
 * 창구가 없거나(0025 전) 보내지 못하면 조용히 false. 화면을 막지 않는다.
 */
export async function reportScreenError(error: unknown, source: ErrorEnv['source']): Promise<boolean> {
  try {
    if (getDataModeConfig().mode !== 'supabase') return false
    const report = errorReport(error, {
      path: window.location.pathname,
      source,
      build: buildName(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      agent: navigator.userAgent,
    })
    if (!report) return false
    if (reported.has(report.body)) return true
    if (reported.size >= MAX_PER_LOAD) return false
    if ((await supportState()) !== 'ready') return false
    reported.add(report.body)
    const res = await sendSupport('error', report.body, report.context)
    if (!res.ok) reported.delete(report.body)
    return res.ok
  } catch {
    return false
  }
}

/**
 * 잡히지 않은 오류(눌러도 아무 일도 안 일어나는 종류)도 알린다 — 껍데기가 한 번 단다. 돌려주는 함수로 뗀다.
 * 그림 · 글꼴 같은 파일을 못 받은 것(자원 오류)은 보내지 않는다.
 */
export function installErrorReporter(): () => void {
  const onError = (e: ErrorEvent) => {
    if (!e.error && !e.message) return
    void reportScreenError(e.error ?? e.message, 'window')
  }
  const onRejection = (e: PromiseRejectionEvent) => {
    if (!(e.reason instanceof Error)) return
    void reportScreenError(e.reason, 'promise')
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
