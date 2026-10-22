/**
 * D-263 AI 단추를 한 번 어긋났다고 멈추지 않게 — 명세서(specRun) 와 같은 규칙을 벤처 사업계획서 · 악마판사에도.
 *   답 모양이 어긋남(읽을 것이 없음) → 무엇을 어떻게 내야 하는지 알려 주고 다시(최대 3번)
 *   잠깐 끊김(시간 초과 · 붐빔) → 3초 쉬고 다시 · 많이 불렀음 → 1분 쉬고 한 번 더
 */
import { AssistError, callAssist, type AssistRun } from './client'
import { newRequestId } from './store'

export const PARSE_MISS = 'parse_miss'
const TRANSIENT = new Set(['provider_unreachable', 'provider_busy', 'provider_error'])
let rateMs = 65_000
let transientMs = 3_000
/** 시험용 — 쉬는 시간 */
export function __setRetryTimes(rate: number, transient: number) {
  rateMs = rate
  transientMs = transient
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Req = Omit<Parameters<typeof callAssist>[0], 'requestId'>

/** parse 가 null 이면 '답 모양 어긋남' — hint 를 붙여 다시 부른다. 끝내 못 읽으면 AssistError(parse_miss | 마지막 오류) */
export async function callAssistRetry<T>(opts: { req: Req; parse: (run: AssistRun) => T | null; hint: string; missMessage: string; onRetry?: (why: 'parse' | 'transient' | 'rate', next: number, tries: number) => void; tries?: number }): Promise<{ run: AssistRun; value: T }> {
  const tries = opts.tries ?? 3
  let hint = ''
  let rateWaited = false
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      const run = await callAssist({ ...opts.req, requestId: newRequestId(), ...(hint ? { ask: hint } : {}) })
      const value = opts.parse(run)
      if (value == null) throw new AssistError(PARSE_MISS, opts.missMessage)
      return { run, value }
    } catch (e) {
      const code = e instanceof AssistError ? e.code : ''
      const left = attempt < tries - 1
      if (code === 'rate_limited' && !rateWaited && left) {
        rateWaited = true
        opts.onRetry?.('rate', attempt + 2, tries)
        await sleep(rateMs)
        continue
      }
      if (code === PARSE_MISS && left) {
        hint = opts.hint
        opts.onRetry?.('parse', attempt + 2, tries)
        continue
      }
      if (TRANSIENT.has(code) && left) {
        opts.onRetry?.('transient', attempt + 2, tries)
        await sleep(transientMs)
        continue
      }
      throw e
    }
  }
  throw new AssistError(PARSE_MISS, opts.missMessage)
}

/** 다시 부를 때 화면 줄에 쓸 말 */
export function retryText(why: 'parse' | 'transient' | 'rate', next: number, tries: number): string {
  if (why === 'rate') return '잠깐 많이 불러서 1분 쉬었다 다시 씁니다'
  if (why === 'transient') return `연결이 잠깐 끊겨 다시 씁니다(${next}/${tries})`
  return `답 모양이 어긋나 이름표를 다시 알려 주고 씁니다(${next}/${tries})`
}
