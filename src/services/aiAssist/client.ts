/**
 * AI 도우미 서버 함수(/api/ai-assist) 부르기 — 브라우저는 AI 공급자를 직접 부르지 않는다(키 · 주소 모두 서버에만).
 * 로그인 토큰만 붙인다(AI 전략실과 같은 방식). 오류는 사람 말로 바꾼다.
 */
import { getDataModeConfig } from '../../data/dataMode'
import { getSupabaseClient } from '../../lib/supabase/client'
import type { AssistContext } from './context'
import type { AssistPage } from './presets'
import { brandForRequest } from '../brandProfile'
import { accountEpoch, allowedProviders, autoUpgradeAllowed, lastAutoPick, noteAutoPick, noteCheapModels, readChoice } from './store'
import { classifyAsk, pickAuto, type AskWeight } from './autoModel'

export const ASSIST_ENDPOINT = '/api/ai-assist'

export type ProviderId = 'gemini' | 'openai' | 'anthropic'

export interface ModelInfo {
  id: string
  label: string
  note: string
  /** [입력, 출력] USD · 100만 토큰 */
  price: [number, number] | null
  /** 키로 공급자 목록을 물었을 때 그 목록에 있었나(못 물었으면 null) */
  verified: boolean | null
  /** 이 공급자에서 빠르게(cheap) · 보통(standard) · 깊게(deep) 기본 모델 — D-241 '더 잘 쓰는 모델로 다시' */
  tier?: 'cheap' | 'standard' | 'deep' | null
}

export interface ProviderInfo {
  id: ProviderId
  label: string
  configured: boolean
  keyName: string
  models: ModelInfo[]
  checked: boolean
}

/** D-353 [연결 점검] 공급자 하나 — ok · no_key · bad_base · provider_auth · provider_billing · provider_model · provider_busy · provider_unreachable … */
export interface ProviderProbe {
  id: ProviderId
  code: string
  /** 키 이름(키가 없을 때 · 값은 보내지 않는다) */
  keyName?: string
  /** 점검에 쓴 가장 싼 모델 */
  model?: string
  /** 공급자가 준 까닭 한 줄(키 값은 가림) */
  detail: string
}

export interface AssistStatus {
  /** D-629 서버가 본 이 계정 — owner(대표) · pilot(팀장 등급: 내부 팀장 · 구독 고객). 옛 서버 · 시험 자료에는 없을 수 있다 */
  role?: 'owner' | 'pilot'
  /** D-353 [연결 점검] 결과(눌렀을 때만) */
  probe?: ProviderProbe[]
  providers: ProviderInfo[]
  defaultChoice: { provider: ProviderId; model: string }
  /** SAAS-2 마케팅 AI 가 이 계정에 열렸나(대표는 늘 true · 고객은 사용량 장부가 켜졌을 때) */
  marketing?: boolean
  /** SAAS-2 고객 이번 달 사용량(장부가 켜졌을 때만) */
  /** SAAS-2 내부 팀장은 limit = null(한도 없이 기록만) */
  usage?: { used: number; limit: number | null; month: string; kind: 'internal' | 'customer'; plan: string; active: boolean } | null
}

export interface AssistItem {
  title: string
  detail?: string
  tag?: string
  ref?: string
  when?: string
  amount?: string
  outline?: string[]
  body?: string
}

export interface AssistAnswer {
  headline: string
  items: AssistItem[]
  next?: string[]
  caution?: string
}

export interface AssistRun {
  requestId: string
  assistId: string
  page: AssistPage
  provider: ProviderId
  model: string
  status: 'succeeded' | 'parse_fallback'
  structured: AssistAnswer | null
  raw: string
  usage: { input: number; output: number; total: number }
  estimatedCostUsd: number | null
  /** SAAS-2 고객 — 이 요청을 센 뒤 이번 달 사용량 */
  quota?: { used: number; limit: number } | null
  ms: number
  sent: { userChars: number; rows: number; rowsCut: number }
  createdAt: string
  /** D-252 조사 단추 — 웹 검색 근거가 붙었는지 · 출처(없으면 AI 가 아는 범위) */
  grounded?: boolean
  sources?: { title: string; url: string }[]
  /** 공급자가 답을 멈춘 까닭(STOP · MAX_TOKENS · length · max_tokens …) */
  finish?: string
  /** D-269 공급자가 실제로 답한 모델(고른 모델과 다를 수 있다) */
  servedModel?: string
}

/** D-269 이 답을 실제로 쓴 모델 */
export const usedModel = (run: Pick<AssistRun, 'model' | 'servedModel'>): string => String(run.servedModel || run.model || '').trim()

/** D-268 답이 길이 상한에서 잘렸나 — Gemini MAX_TOKENS · OpenAI length · Claude max_tokens */
export const cutOff = (run: Pick<AssistRun, 'finish'> | null | undefined): boolean => /^(?:max_tokens|length)$/i.test(String(run?.finish ?? '').trim())

export const PROVIDER_NAME: Record<ProviderId, string> = { gemini: 'Gemini', openai: 'GPT', anthropic: 'Claude' }
/** D-353 공급자 관리 화면(키 · 잔액을 고치는 곳) */
export const PROVIDER_CONSOLE: Record<ProviderId, string> = {
  gemini: 'Google AI Studio(aistudio.google.com) › API 키 · 결제',
  openai: 'OpenAI 플랫폼(platform.openai.com) › API keys · Billing',
  anthropic: 'Anthropic 콘솔(console.anthropic.com) › API Keys · Plans & Billing',
}
const isProvider = (v: unknown): v is ProviderId => v === 'gemini' || v === 'openai' || v === 'anthropic'

/** D-353 어느 회사의 무슨 문제인지 — 키 틀림 · 잔액 부족 · 모델 이름은 회사 이름과 고치는 곳까지 */
export function providerMessage(code: string, provider: ProviderId | '', detail = ''): string {
  if (!provider) return assistMessage(code)
  const name = PROVIDER_NAME[provider]
  // D-638 대표가 아닌 화면(팀장 · 구독 고객)에는 키 · 결제 · 서버 설정 이야기를 보이지 않는다 — 고칠 수 있는 사람은 관리자뿐
  if (!autoUpgradeAllowed() && (code === 'provider_billing' || code === 'provider_auth')) return 'AI 연결에 잠깐 문제가 있어요 — 관리자에게 알려 두었어요. 잠시 뒤 다시 해 주세요.'
  const why = detail ? ` (회사가 준 까닭: ${detail})` : ''
  if (code === 'provider_billing') return `${name} 계정의 잔액(크레딧) · 사용 한도가 다 됐어요 — ${PROVIDER_CONSOLE[provider]} 에서 충전하면 바로 됩니다(키는 그대로).${why}`
  if (code === 'provider_auth') return `${name} 키가 틀렸거나 폐기됐어요 — ${PROVIDER_CONSOLE[provider]} 에서 새 키를 만들어 Vercel 환경변수에 넣고 Redeploy 해 주세요.${why}`
  if (code === 'provider_model') return `${name} 가 이 모델 이름을 모릅니다(이름이 바뀌었거나 끝난 모델) — 다른 모델을 골라 주세요.${why}`
  return `${name} — ${assistMessage(code)}`
}

export class AssistError extends Error {
  code: string
  missing: string[]
  /** D-353 문제가 난 AI 회사 · 그 회사가 준 까닭(있으면) */
  provider: ProviderId | '' = ''
  detail = ''
  constructor(code: string, message: string, missing: string[] = []) {
    super(message)
    this.code = code
    this.missing = missing
  }
}

const MESSAGE: Record<string, string> = {
  setup_needed: 'AI 키가 아직 들어 있지 않습니다.',
  db_setup_needed: 'AI 권한 DB 설정(0021)이 아직 안 됐습니다.',
  login_required: '다시 로그인해 주세요.',
  forbidden: '이 기능은 대표 계정에서만 쓸 수 있습니다.',
  provider_not_allowed: '팀장 계정은 지금 Gemini 모델만 쓸 수 있습니다 — 모델을 Gemini 로 바꿔 주세요.',
  rate_limited: '조금 전에 많이 눌렀어요. 1분 뒤 다시 눌러 주세요.',
  too_large: '보낼 자료가 너무 많습니다.',
  provider_auth: 'AI 키가 맞지 않습니다. 키를 다시 확인해 주세요.',
  provider_busy: 'AI 쪽이 붐비거나 사용 한도에 닿았습니다. 잠시 뒤 다시 눌러 주세요.',
  provider_rejected: '이 모델을 쓸 수 없습니다. 다른 모델을 골라 주세요.',
  provider_billing: 'AI 회사 계정의 잔액 · 사용 한도가 다 됐습니다. 충전한 뒤 다시 눌러 주세요.',
  provider_model: 'AI 회사가 이 모델 이름을 모릅니다. 다른 모델을 골라 주세요.',
  provider_unreachable: 'AI 답을 받지 못했습니다(시간 초과). 다시 눌러 주세요.',
  // D-638 서버 함수가 시간 안에 못 끝남(게이트웨이 504) — 같은 번호로 답을 다시 물어본 뒤에도 못 받았을 때
  gateway_timeout: 'AI 답이 늦어 받지 못했습니다(시간 초과). 잠시 뒤 다시 눌러 주세요.',
  provider_error: 'AI 쪽 오류로 답을 받지 못했습니다. 다시 눌러 주세요.',
  network: '서버에 닿지 못했습니다. 인터넷 연결을 확인해 주세요.',
  auth_unreachable: '로그인 확인이 늦어 멈췄습니다. 잠시 뒤 다시 눌러 주세요.',
  not_deployed: 'AI 서버 함수가 없는 곳입니다(로컬 미리보기 등). 배포된 주소에서 눌러 주세요.',
  // SAAS-2 고객별 AI 사용량(서버 장부)
  quota_exceeded: '이번 달 AI 사용량을 다 썼어요. 다음 달 1일에 다시 채워집니다(설정 › 계정 · 보기에서 남은 양 확인).',
  usage_setup_needed: '이 AI 기능은 사용량 관리가 준비되면 열립니다.',
  subscription_inactive: '이용 기간이 끝났거나 요금제가 아직 없어요. 구독을 확인해 주세요.',
  marketing_not_included: '마케팅 · 브랜딩은 이 기능이 포함된 요금제에서 열려요.',
  usage_unreachable: 'AI 사용량을 확인하지 못해 멈췄어요(세지 않았습니다). 잠시 뒤 다시 눌러 주세요.',
  request_in_progress: '같은 요청이 아직 처리 중이에요. 잠시 뒤 결과를 확인해 주세요.',
  request_done: '답은 이미 만들어졌는데 이 화면이 받지 못했어요(사용량은 한 번만 셌어요). 잠시 뒤 다시 눌러 주세요.',
  result_not_found: '답을 받지 못했습니다. 다시 눌러 주세요.',
}

export function assistMessage(code: string): string {
  return MESSAGE[code] ?? MESSAGE.provider_error
}

/**
 * D-244 JSON 이 아닌 오류(Vercel 504 · 502 · 413 화면 등) → 상태 번호로. 예전엔 모두 '키가 아직' 이라 키를 다시 넣게 했다.
 * '키 설정 필요(setup_needed)' 는 서버가 그렇게 말할 때만.
 */
export function codeOfStatus(status: number): string {
  if (status === 502 || status === 503 || status === 504) return 'provider_unreachable'
  if (status === 413) return 'too_large'
  if (status === 401) return 'login_required'
  if (status === 403) return 'forbidden'
  if (status === 429) return 'rate_limited'
  if (status === 404 || status === 405) return 'not_deployed'
  return 'provider_error'
}

async function authHeader(): Promise<Record<string, string>> {
  if (getDataModeConfig().mode !== 'supabase') return {}
  try {
    const { data } = await getSupabaseClient().auth.getSession()
    const t = data.session?.access_token
    return t ? { Authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

/** 서버 함수가 없는 곳(로컬 미리보기)은 화면 HTML 이 돌아온다 — '서버 함수 없음' 으로(D-244: 예전엔 '키 설정 필요') */
function notJson(res: Response): boolean {
  return !/json/i.test(res.headers.get('content-type') ?? '')
}

async function readError(res: Response): Promise<AssistError> {
  let body: { code?: string; missing?: string[]; used?: number; limit?: number; provider?: string; detail?: string } = {}
  try {
    body = await res.json()
  } catch {
    const code = codeOfStatus(res.status)
    return new AssistError(code, assistMessage(code))
  }
  const code = typeof body.code === 'string' ? body.code : 'provider_error'
  // SAAS-2 한도를 다 쓰면 몇 단위 중 몇을 썼는지도
  const quota = code === 'quota_exceeded' && Number.isFinite(body.used) && Number.isFinite(body.limit) ? ` (이번 달 ${body.used} / ${body.limit})` : ''
  const provider = isProvider(body.provider) ? body.provider : ''
  const detail = typeof body.detail === 'string' ? body.detail.slice(0, 160) : ''
  const err = new AssistError(code, (provider ? providerMessage(code, provider, detail) : assistMessage(code)) + quota, Array.isArray(body.missing) ? body.missing.map(String) : [])
  err.provider = provider
  err.detail = detail
  return err
}

export async function fetchAssistStatus(withModels = false, probe = false): Promise<AssistStatus> {
  let res: Response
  try {
    res = await fetch(`${ASSIST_ENDPOINT}?status=1${withModels ? '&models=1' : ''}${probe ? '&probe=1' : ''}`, { headers: { ...(await authHeader()) } })
  } catch {
    throw new AssistError('network', MESSAGE.network)
  }
  if (!res.ok) throw await readError(res)
  if (notJson(res)) throw new AssistError('not_deployed', MESSAGE.not_deployed)
  const b = (await res.json()) as AssistStatus & { ok: boolean }
  // D-614 가장 싼 모델 이름을 기억해 둔다(가장 싼 것만 쓰는 계정이 예전에 고른 비싼 모델을 걸러 낸다)
  if (Array.isArray(b.providers)) noteCheapModels(b.providers.filter((p) => p && Array.isArray(p.models)))
  const status: AssistStatus = {
    ...(b.role === 'owner' || b.role === 'pilot' ? { role: b.role } : {}),
    ...(Array.isArray(b.probe) ? { probe: b.probe.filter((x) => x && isProvider(x.id)).map((x) => ({ id: x.id, code: String(x.code ?? ''), keyName: x.keyName ? String(x.keyName) : undefined, model: x.model ? String(x.model) : undefined, detail: String(x.detail ?? '').slice(0, 160) })) } : {}),
    providers: Array.isArray(b.providers) ? b.providers : [],
    defaultChoice: b.defaultChoice,
    // SAAS-2 서버가 분명히 연다고 한 때만(옛 서버 · 빠진 칸은 닫힘)
    marketing: b.marketing === true,
    usage: b.usage && Number.isFinite(b.usage.used) ? { used: b.usage.used, limit: Number.isFinite(b.usage.limit) ? b.usage.limit : null, month: String(b.usage.month ?? ''), kind: b.usage.kind === 'internal' ? 'internal' : 'customer', plan: String(b.usage.plan ?? ''), active: b.usage.active === true } : null,
  }
  // D-629 자동 모델이 요청마다 다시 묻지 않게 기억해 둔다(어느 화면이 받았든 같이 쓴다)
  seen = { status, at: Date.now(), epoch: accountEpoch() }
  return status
}

/* ------------------------------------------------------------------ */
/* D-629 자동 모델 — 요청마다 물음은 가장 싼 모델 · 일을 시킬 때는 좋은 모델     */
/* ------------------------------------------------------------------ */

/** 서버 모델 목록을 기억하는 동안 · 못 받은 뒤 다시 묻기까지 */
const STATUS_KEEP_MS = 5 * 60_000
const STATUS_FAIL_MS = 30_000
let seen: { status: AssistStatus; at: number; epoch: number } | null = null
let failedAt = 0
let loading: Promise<AssistStatus | null> | null = null

/** 기억해 둔 서버 모델 목록(없으면 null) — 모델 고르기 단추가 판을 열기 전에도 '자동' 인지 알게 */
export function peekAssistStatus(): AssistStatus | null {
  return seen && seen.epoch === accountEpoch() ? seen.status : null
}

/** 시험용 — 기억한 서버 모델 목록 비우기 */
export function __resetAssistStatusCache(): void {
  seen = null
  failedAt = 0
  loading = null
}

/** 자동이 쓸 서버 모델 목록 — 기억한 것(5분) · 없으면 한 번 받는다(동시에 여러 요청이 와도 한 번). 못 받으면 null */
async function statusForAuto(): Promise<AssistStatus | null> {
  const now = Date.now()
  const mine = seen && seen.epoch === accountEpoch() ? seen : null
  if (mine && now - mine.at < STATUS_KEEP_MS) return mine.status
  // 방금 못 받았으면 잠깐은 다시 묻지 않는다(서버 함수가 없는 미리보기에서 요청마다 두 번씩 부르지 않게) — 예전 것이 있으면 그것으로
  if (now - failedAt < STATUS_FAIL_MS) return mine?.status ?? null
  loading ??= fetchAssistStatus()
    .catch(() => {
      failedAt = Date.now()
      return mine?.status ?? null
    })
    .finally(() => {
      loading = null
    })
  return loading
}

/**
 * 이번 요청에 쓸 모델 — 모든 AI 단추 · 대화창이 여기 한 곳을 지난다(화면마다 따로 정하지 않는다).
 *   부른 쪽이 준 모델(이번 한 번만 다른 모델 · 직접 고른 모델) → 그대로
 *   직접 고른 모델이 저장돼 있음 → 그대로(부른 쪽이 안 읽어 왔어도)
 *   자동 → 물음은 가장 싼 모델 · 일을 시킬 때는 좋은 모델(서버가 이 계정에 준 목록 안에서)
 *   자동인데 올려 쓸 수 없는 화면(팀장 · 구독 고객) · 목록을 못 받음 → 고른 것 없이(서버 기본 = 예전 그대로 가장 싼 모델)
 */
export async function resolveAssistChoice(req: { assistId: string; ask?: string; skill?: string; choice: { provider: ProviderId; model: string } | null }): Promise<{ choice: { provider: ProviderId; model: string } | null; auto: AskWeight | null }> {
  const picked = req.choice ?? readChoice()
  if (picked) return { choice: picked, auto: null }
  if (!autoUpgradeAllowed()) return { choice: null, auto: null }
  const weight = classifyAsk(req)
  const choice = pickAuto(await statusForAuto(), weight, { providers: allowedProviders(), upgrade: true })
  return { choice, auto: choice ? weight : null }
}

/** D-260 영상 단추(radar.transcript) — 영상 번호 · 구간(초). 주소는 서버가 만든다 */
export interface AssistVideo {
  id: string
  start: number
  end: number
}

/* ------------------------------------------------------------------ */
/* D-638 한 번 누르면 끝까지 — 끊겨도 같은 요청 번호로 답을 다시 받는다       */
/* ------------------------------------------------------------------ */

/**
 * 대표(2026-11-19) "한 번 누르면 중간에 이탈 · 이동 · 멈춤 · 코인이 갑자기 … 백그라운드에서 돌아가도 전혀 문제없게".
 *   휴대폰이 다른 앱으로 가면 브라우저가 연결을 끊는 일이 잦다 — 서버는 그래도 답을 끝까지 만들고(사용량은 한 번) 보관한다(0030).
 *   그래서 연결이 끊긴 요청은 실패로 끝내지 않고: 화면이 다시 보일 때까지 기다린 뒤 → 같은 요청 번호의 답을 묻는다(GET ?result)
 *   → 아직 쓰는 중이면 조금 뒤 다시 → 서버에 없으면 같은 번호로 한 번 더 보낸다(resume — 서버가 보관 · 장부를 먼저 본다 · 두 번 세지 않음).
 *   멈추기(signal)를 누른 요청은 이어 받지 않는다.
 */
const RECOVER_CODES = new Set(['network', 'gateway_timeout', 'request_in_progress', 'request_done'])
/** 이어 받기를 끝까지 기다리는 시간(화면이 숨어 있던 시간은 빼고) */
const RECOVER_MS = 120_000
let recoverMs = RECOVER_MS
let recoverGapMs = 2_000
/** 시험용 — 이어 받기 시간 */
export function __setRecoverTimes(total: number, gap: number) {
  recoverMs = total
  recoverGapMs = gap
}

/** 화면이 보일 때까지 — 휴대폰이 다른 앱에 가 있는 동안은 묻지 않는다(돌아오면 바로) */
function untilVisible(signal?: AbortSignal): Promise<void> {
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return Promise.resolve()
  return new Promise((ok) => {
    const done = () => {
      document.removeEventListener('visibilitychange', on)
      signal?.removeEventListener('abort', done)
      ok()
    }
    const on = () => {
      if (document.visibilityState !== 'hidden') done()
    }
    document.addEventListener('visibilitychange', on)
    signal?.addEventListener('abort', done)
  })
}

const pause = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((ok) => {
    const t = setTimeout(ok, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      ok()
    })
  })

/** 같은 요청 번호의 답 — 'done'(답) · 'pending'(아직 쓰는 중) · 'missing'(서버에 없음) · 'error'(그 밖 — 실패 이유) */
export async function fetchAssistResult(requestId: string, signal?: AbortSignal): Promise<{ state: 'done'; run: AssistRun } | { state: 'pending' } | { state: 'missing' } | { state: 'error'; error: AssistError }> {
  let res: Response
  try {
    res = await fetch(`${ASSIST_ENDPOINT}?result=${encodeURIComponent(requestId)}`, { headers: { ...(await authHeader()) }, ...(signal ? { signal } : {}) })
  } catch {
    return { state: 'error', error: new AssistError('network', MESSAGE.network) }
  }
  // 아직 쓰는 중(202) · 묻는 길이 잠깐 잘림(게이트웨이 504 — 화면 HTML) → 조금 뒤 다시 묻는다
  if (res.status === 202 || (res.status === 504 && notJson(res))) return { state: 'pending' }
  if (res.status === 404 && !notJson(res)) return { state: 'missing' }
  if (!res.ok) return { state: 'error', error: await readError(res) }
  if (notJson(res)) return { state: 'error', error: new AssistError('not_deployed', MESSAGE.not_deployed) }
  try {
    const b = (await res.json()) as { run?: AssistRun }
    return b && b.run ? { state: 'done', run: b.run } : { state: 'missing' }
  } catch {
    return { state: 'missing' }
  }
}

type PostBody = Record<string, unknown> & { requestId: string }

async function postAssist(body: PostBody, signal?: AbortSignal): Promise<AssistRun> {
  let res: Response
  try {
    res = await fetch(ASSIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(body),
      // D-350 [멈추기] — 기다리던 답을 버린다(서버가 이미 받은 요청은 끝까지 갈 수 있다)
      ...(signal ? { signal } : {}),
    })
  } catch {
    if (signal?.aborted) throw new AssistError('aborted', '멈췄습니다.')
    throw new AssistError('network', MESSAGE.network)
  }
  // 함수가 잘렸거나(게이트웨이 504 — 화면 HTML) 연결이 이상하게 끝난 것은 '끊김' 으로 — 서버가 답을 보관했을 수 있다
  if (res.status === 504 && notJson(res)) throw new AssistError('gateway_timeout', MESSAGE.gateway_timeout)
  if (!res.ok) throw await readError(res)
  if (notJson(res)) throw new AssistError('not_deployed', MESSAGE.not_deployed)
  const b = (await res.json()) as { ok: boolean; run?: AssistRun }
  if (!b || !b.run) throw new AssistError('provider_error', MESSAGE.provider_error)
  return b.run
}

/**
 * 끊긴 요청 이어 받기 — 받으면 답, 끝내 못 받으면 마지막 오류.
 * 같은 요청 번호로만 묻고 보낸다(서버 · 장부가 두 번 세지 않는다). 다시 보내기는 두 번까지.
 */
async function recoverRun(first: AssistError, body: PostBody, signal?: AbortSignal): Promise<AssistRun> {
  let last = first
  let resent = 0
  let spent = 0
  while (spent < recoverMs) {
    if (signal?.aborted) throw new AssistError('aborted', '멈췄습니다.')
    await untilVisible(signal)
    const began = Date.now()
    const got = await fetchAssistResult(body.requestId, signal)
    if (got.state === 'done') return got.run
    if (got.state === 'error' && got.error.code !== 'network') throw got.error
    // 장부는 '이미 끝남' 인데 보관된 답이 없음(보관 표 0030 이 없는 운영) — 더 기다려도 못 받는다. 센 것은 한 번뿐
    if (got.state === 'missing' && last.code === 'request_done') throw last
    if (got.state === 'missing' && resent < 2) {
      resent += 1
      try {
        return await postAssist({ ...body, resume: true }, signal)
      } catch (e) {
        if (!(e instanceof AssistError) || !RECOVER_CODES.has(e.code)) throw e
        last = e
      }
    }
    await pause(recoverGapMs, signal)
    spent += Date.now() - began
  }
  throw last
}

export async function callAssist(req: { requestId: string; assistId: string; page: AssistPage; choice: { provider: ProviderId; model: string } | null; context: AssistContext; ask?: string; video?: AssistVideo; skill?: string; signal?: AbortSignal }): Promise<AssistRun> {
  const brand = brandForRequest()
  // D-629 자동이면 이 요청의 물음 · 단추로 모델을 정한다(직접 고른 모델은 그대로)
  const { choice, auto } = await resolveAssistChoice(req)
  // SAAS-1 이 작업공간의 브랜드 · AI 설정(있으면) — 서버는 대표가 아닌 계정에만 쓴다
  const body: PostBody = { requestId: req.requestId, assistId: req.assistId, page: req.page, choice, context: req.context, ask: req.ask ?? '', ...(req.video ? { video: req.video } : {}), ...(req.skill ? { skill: req.skill } : {}), ...(brand ? { brand } : {}) }
  let run: AssistRun
  try {
    run = await postAssist(body, req.signal)
  } catch (e) {
    // D-638 끊김 · 같은 요청 처리 중 · 이미 처리됨 → 같은 번호로 이어 받기(멈추기는 그대로 끝)
    if (!(e instanceof AssistError) || !RECOVER_CODES.has(e.code) || req.signal?.aborted) throw e
    run = await recoverRun(e, body, req.signal)
  }
  // D-629 자동이 고른 것 — 모델 고르기 판에 '방금: 좋은 모델로 답함' 한 줄(서버가 실제로 부른 모델로 — 답 아래 'AI 답 · 모델' 과 같은 이름)
  if (auto && isProvider(run.provider)) noteAutoPick({ weight: auto, provider: run.provider, model: String(run.model || choice?.model || ''), at: Date.now() })
  // 방금 답은 자동이 고른 것이 아니다(직접 고른 모델 · 이번 한 번만 다른 모델) — 앞의 '방금' 줄을 남겨 두지 않는다
  else if (lastAutoPick()) noteAutoPick(null)
  return run
}
