/**
 * AI 도우미 서버 함수(/api/ai-assist) 부르기 — 브라우저는 AI 공급자를 직접 부르지 않는다(키 · 주소 모두 서버에만).
 * 로그인 토큰만 붙인다(AI 작업실과 같은 방식). 오류는 사람 말로 바꾼다.
 */
import { getDataModeConfig } from '../../data/dataMode'
import { getSupabaseClient } from '../../lib/supabase/client'
import type { AssistContext } from './context'
import type { AssistPage } from './presets'

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

export interface AssistStatus {
  providers: ProviderInfo[]
  defaultChoice: { provider: ProviderId; model: string }
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
  ms: number
  sent: { userChars: number; rows: number; rowsCut: number }
  createdAt: string
}

export class AssistError extends Error {
  code: string
  missing: string[]
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
  rate_limited: '조금 전에 많이 눌렀어요. 1분 뒤 다시 눌러 주세요.',
  too_large: '보낼 자료가 너무 많습니다.',
  provider_auth: 'AI 키가 맞지 않습니다. 키를 다시 확인해 주세요.',
  provider_busy: 'AI 쪽이 붐비거나 사용 한도에 닿았습니다. 잠시 뒤 다시 눌러 주세요.',
  provider_rejected: '이 모델을 쓸 수 없습니다. 다른 모델을 골라 주세요.',
  provider_unreachable: 'AI 답을 받지 못했습니다(시간 초과). 다시 눌러 주세요.',
  provider_error: 'AI 쪽 오류로 답을 받지 못했습니다. 다시 눌러 주세요.',
  network: '서버에 닿지 못했습니다. 인터넷 연결을 확인해 주세요.',
}

export function assistMessage(code: string): string {
  return MESSAGE[code] ?? MESSAGE.provider_error
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

/** 서버 함수가 없는 곳(로컬 미리보기)은 화면 HTML 이 돌아온다 — '키 설정 필요' 로 */
function notJson(res: Response): boolean {
  return !/json/i.test(res.headers.get('content-type') ?? '')
}

async function readError(res: Response): Promise<AssistError> {
  let body: { code?: string; missing?: string[] } = {}
  try {
    body = await res.json()
  } catch {
    return new AssistError('setup_needed', MESSAGE.setup_needed)
  }
  const code = typeof body.code === 'string' ? body.code : 'provider_error'
  return new AssistError(code, assistMessage(code), Array.isArray(body.missing) ? body.missing.map(String) : [])
}

export async function fetchAssistStatus(withModels = false): Promise<AssistStatus> {
  let res: Response
  try {
    res = await fetch(`${ASSIST_ENDPOINT}?status=1${withModels ? '&models=1' : ''}`, { headers: { ...(await authHeader()) } })
  } catch {
    throw new AssistError('network', MESSAGE.network)
  }
  if (!res.ok) throw await readError(res)
  if (notJson(res)) throw new AssistError('setup_needed', MESSAGE.setup_needed)
  const b = (await res.json()) as AssistStatus & { ok: boolean }
  return { providers: Array.isArray(b.providers) ? b.providers : [], defaultChoice: b.defaultChoice }
}

export async function callAssist(req: { requestId: string; assistId: string; page: AssistPage; choice: { provider: ProviderId; model: string } | null; context: AssistContext; ask?: string }): Promise<AssistRun> {
  let res: Response
  try {
    res = await fetch(ASSIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ requestId: req.requestId, assistId: req.assistId, page: req.page, choice: req.choice, context: req.context, ask: req.ask ?? '' }),
    })
  } catch {
    throw new AssistError('network', MESSAGE.network)
  }
  if (!res.ok) throw await readError(res)
  if (notJson(res)) throw new AssistError('setup_needed', MESSAGE.setup_needed)
  const b = (await res.json()) as { ok: boolean; run?: AssistRun }
  if (!b || !b.run) throw new AssistError('provider_error', MESSAGE.provider_error)
  return b.run
}
