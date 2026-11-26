/**
 * D-676 AI 가 '운영 쪽 문제' 로 답하지 못했을 때 — 팀장 · 구독 고객 화면에서는 고칠 수 없다(키 · 잔액 · 권한 설정 · 모델 이름).
 *
 *  - 화면에는 쉬운 말만 보인다(키 · DB · 충전 이야기는 대표 화면에만 — client.ts 의 GUEST_MESSAGE).
 *  - 대신 운영자 받은함(0025 문의 · 화면 오류)에 한 줄을 남긴다 — 고객이 "AI 가 안 돼요" 라고 따로 알리지 않아도 대표가 먼저 안다.
 *  - 글은 늘 같은 모양(무슨 문제 · 어느 회사) — 서버가 같은 글은 하루에 한 줄로 합친다. 문의 번호 · 화면 주소는 옆 칸(context)으로.
 *  - 고객사 자료 · 물어본 글은 보내지 않는다. 대표 화면 · 로컬 모드에서는 보내지 않는다.
 * 계정 쪽 문제(이용 기간 끝 · 이번 달 양 다 씀)는 여기서 보내지 않는다 — 화면이 [문의하기] 로 안내한다.
 */
import { getDataModeConfig } from '../../data/dataMode'

/** 운영자만 고칠 수 있는 실패 */
const WHY: Record<string, string> = {
  setup_needed: 'AI 키가 서버에 없음',
  db_setup_needed: 'AI 권한 설정이 서버에 없음',
  provider_auth: 'AI 키가 틀렸거나 폐기됨',
  provider_billing: 'AI 회사 계정의 잔액 · 사용 한도가 다 됨',
  provider_model: 'AI 회사가 모델 이름을 모름',
  provider_rejected: 'AI 회사가 이 모델을 받지 않음',
}
const COMPANY: Record<string, string> = { gemini: 'Gemini', openai: 'GPT', anthropic: 'Claude' }

/** 팀장 · 고객이 스스로 풀 수 없는(운영자가 고쳐야 하는) 실패인가 */
export function isOperatorSide(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(WHY, code)
}

/** 계정 쪽 사정(이용 기간 · 이번 달 양 · 요금제) — 운영자에게 물어보면 풀리는 것 */
export function isAccountSide(code: string): boolean {
  return code === 'quota_exceeded' || code === 'subscription_inactive' || code === 'marketing_not_included'
}

/** 받은함에 남는 글 — 종류 · 회사만(같은 글은 서버가 하루 한 줄로) */
export function failReportBody(code: string, provider = ''): string {
  if (!isOperatorSide(code)) return ''
  const who = COMPANY[provider] ? ` (${COMPANY[provider]})` : ''
  return `AI 도우미가 답하지 못했어요 — ${WHY[code]}${who}`
}

let realGuest = false
/**
 * 진짜 팀장 · 구독 고객 계정으로 로그인했을 때만 보낸다(앱 껍데기가 정한다).
 * 대표가 팀장 화면으로 볼 때는 글은 팀장과 같지만 보내지 않는다 — 자기 받은함에 자기가 알리는 셈이라.
 */
export function setFailReportOn(on: boolean) {
  realGuest = on
}

/** sent 알림 · off 알릴 곳이 없음(로컬 모드 · 문의 창구 준비 전 · 대표가 팀장 화면으로 보는 중) · fail 보내지 못함 */
export type FailReport = 'sent' | 'off' | 'fail'

const sent = new Map<string, Promise<FailReport>>()

/** 운영자 받은함에 한 줄 — 같은 문제는 한 번만 보낸다(이 화면을 연 동안). 실패하면 다음에 다시 보낸다. */
export function reportAssistFail(code: string, provider = '', ref = ''): Promise<FailReport> {
  const body = failReportBody(code, provider)
  if (!body || !realGuest || getDataModeConfig().mode !== 'supabase') return Promise.resolve('off')
  const key = `${code}:${provider}`
  const hit = sent.get(key)
  if (hit) return hit
  const run = (async (): Promise<FailReport> => {
    try {
      const { cleanPath, sendSupport, supportState } = await import('../support')
      if ((await supportState()) !== 'ready') return 'off'
      const context: Record<string, string> = { path: cleanPath(window.location.pathname), source: 'ai', code }
      if (COMPANY[provider]) context.provider = COMPANY[provider]
      if (ref) context.ref = ref.slice(0, 12)
      const res = await sendSupport('error', body, context)
      return res.ok ? 'sent' : res.reason === 'missing' ? 'off' : 'fail'
    } catch {
      return 'fail'
    }
  })()
  sent.set(key, run)
  void run.then((r) => {
    if (r !== 'sent') sent.delete(key)
  })
  return run
}

/** 시험용 — 보낸 기억을 잊는다 */
export function resetFailReportForTest() {
  sent.clear()
  realGuest = false
}
