/**
 * 서버 함수(/api/ai-run) 부르기 — 브라우저는 AI 공급자를 직접 부르지 않는다(키 · 주소 모두 서버에만).
 * 로그인 토큰만 붙인다. 오류는 사람 말(서버가 준 code)로 바꾼다 — 원문 · 비밀은 화면에 나오지 않는다.
 */
import { getDataModeConfig } from '../../data/dataMode'
import { getSupabaseClient } from '../../lib/supabase/client'
import type { AiContextPayload } from './context'
import type { AiRunInput, SkillId, Tier } from './types'
import { readChoice } from '../aiAssist/store'

export const AI_ENDPOINT = '/api/ai-run'

export interface ServerRun {
  requestId: string
  skillId: SkillId
  skillVersion: number
  tier: Exclude<Tier, 'manual'>
  provider: string
  model: string
  status: 'succeeded' | 'parse_fallback'
  structured: unknown
  raw: string
  parseErrors: string[]
  usage: { input: number; output: number; total: number }
  estimatedCostUsd: number | null
  contextVersion: number | null
  createdAt: string
}

export interface AiStatus {
  configured: boolean
  tiers: Record<'cheap' | 'standard' | 'deep', boolean>
  missing: string[]
  priced: Record<'cheap' | 'standard' | 'deep', boolean>
}

export class AiCallError extends Error {
  code: string
  missing: string[]
  retryAfter: number | null
  constructor(code: string, message: string, missing: string[] = [], retryAfter: number | null = null) {
    super(message)
    this.code = code
    this.missing = missing
    this.retryAfter = retryAfter
  }
}

const MESSAGE: Record<string, string> = {
  setup_needed: 'AI 기능 설정이 필요합니다.',
  db_setup_needed: 'AI 전략실 DB 설정이 필요합니다.',
  login_required: 'AI 는 로그인한 클라우드 화면에서만 부를 수 있습니다. 다시 로그인해 주세요.',
  forbidden: '이 기능을 쓸 권한이 없습니다.',
  rate_limited: '요청이 너무 잦습니다. 잠시 뒤 다시 눌러 주세요.',
  too_large: '보낼 자료가 너무 많습니다. 자료를 줄여 주세요.',
  network: '서버에 닿지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.',
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

/** 서버 함수가 없는 곳(로컬 미리보기 등)은 화면 HTML 이 돌아온다 — 'AI 기능 설정이 필요합니다' 로 */
function notJson(res: Response): boolean {
  return !/json/i.test(res.headers.get('content-type') ?? '')
}

async function readError(res: Response): Promise<AiCallError> {
  let body: { code?: string; message?: string; missing?: string[]; retryAfter?: number } = {}
  try {
    body = await res.json()
  } catch {
    // 서버 함수가 없는 곳(로컬 미리보기 등) — 설정 필요로
    return new AiCallError(res.status === 404 ? 'setup_needed' : 'provider_error', res.status === 404 ? MESSAGE.setup_needed : 'AI 결과를 받지 못했습니다. 다시 시도해 주세요.')
  }
  const code = typeof body.code === 'string' ? body.code : 'provider_error'
  return new AiCallError(code, MESSAGE[code] ?? (typeof body.message === 'string' ? body.message : 'AI 결과를 받지 못했습니다.'), Array.isArray(body.missing) ? body.missing.map(String) : [], typeof body.retryAfter === 'number' ? body.retryAfter : null)
}

export async function fetchAiStatus(): Promise<AiStatus> {
  let res: Response
  try {
    // D-239: 화면에서 고른 AI 회사(Gemini · GPT · Claude)로 상태를 본다 — 고른 게 없으면 서버 기본
    const pick = readChoice()
    res = await fetch(`${AI_ENDPOINT}?status=1${pick ? `&provider=${encodeURIComponent(pick.provider)}` : ''}`, { headers: { ...(await authHeader()) } })
  } catch {
    throw new AiCallError('network', MESSAGE.network)
  }
  if (!res.ok) throw await readError(res)
  if (notJson(res)) throw new AiCallError('setup_needed', MESSAGE.setup_needed)
  const b = (await res.json()) as AiStatus & { ok: boolean }
  return { configured: !!b.configured, tiers: b.tiers, missing: b.missing ?? [], priced: b.priced }
}

export async function callAi(req: { requestId: string; skillId: SkillId; caseId: string; contextVersion: number; input: AiRunInput; context: AiContextPayload }): Promise<{ run: ServerRun; replayed: boolean }> {
  let res: Response
  try {
    res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      // D-239: 고른 AI 회사를 같이 보낸다 — 서버가 그 회사의 빠르게 · 보통 · 깊게 모델을 쓴다
      // D-255 고른 모델까지 보낸다 — 고르지 않았으면 서버가 일마다 빠르게 · 보통 · 깊게 모델을 고른다
      body: JSON.stringify({ ...req, ...(readChoice() ? { choice: readChoice() } : {}) }),
    })
  } catch {
    throw new AiCallError('network', MESSAGE.network)
  }
  if (!res.ok) throw await readError(res)
  if (notJson(res)) throw new AiCallError('setup_needed', MESSAGE.setup_needed)
  const b = (await res.json()) as { ok: boolean; run: ServerRun; replayed?: boolean }
  if (!b || !b.run) throw new AiCallError('provider_error', 'AI 결과를 받지 못했습니다.')
  return { run: b.run, replayed: !!b.replayed }
}
