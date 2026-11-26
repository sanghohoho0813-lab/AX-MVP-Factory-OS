/**
 * D-677 내 AI 이용 권한 — 이용 기간 · 이번 달 남은 양을 '막히기 전에' 알린다(SALE-4 상태 안내).
 *
 * 예전: 구독 고객은 AI 단추가 실패한 뒤에야 '이번 달 양을 다 썼어요 · 이용 기간이 끝났어요' 를 알았다.
 *       설정 칸에도 언제까지인지(날짜)는 없었다.
 *  - 서버가 센 값 그대로: 장부 `my_ai_access`(0022 — 이번 달 쓴 양 · 한도 · 이용 중인지 · 이용 기간이 끝나는 때).
 *    화면이 세지 않는다 · DB 는 바꾸지 않는다(읽기만 · 함수 하나).
 *  - 알림은 구독 고객(kind = customer)만. 내부 팀장은 한도 없이 기록만이라 알릴 것이 없다. 대표 계정은 묻지 않는다.
 *  - 순서: 이용 기간 끝 → 이번 달 양 다 씀 → 이용 기간 7일 안 → 80% 넘음. 하나만 알린다.
 * 설정 › 이번 달 AI 사용량 칸과 종(알림)이 같은 값 · 같은 글을 쓴다(따로 세지 않는다).
 */
import { getDataModeConfig } from '../data/dataMode'
import { getSupabaseClient } from '../lib/supabase/client'

export interface AiAccess {
  kind: 'internal' | 'customer'
  active: boolean
  marketing: boolean
  used: number
  /** 내부 팀장은 null(한도 없이 기록만) */
  limit: number | null
  /** 'YYYY-MM' */
  month: string
  /** 이용 기간이 끝나는 때(ISO) — 없으면 null(아직 이용 기간을 받지 않음 — 서버는 이때 '이용 중 아님' 으로 본다) */
  activeUntil: string | null
}

export interface AiNotice {
  /** ended 이용 기간 끝(또는 시작 전) · quota 이번 달 양 다 씀 · ending 7일 안에 끝남 · low 80% 넘음 */
  key: 'ended' | 'quota' | 'ending' | 'low'
  /** danger = 지금 AI 가 멈춰 있다 · warn = 곧 멈춘다 */
  tone: 'danger' | 'warn'
  title: string
  detail: string
}

// ---------------------------------------------------------------- 규칙(순수)

const DAY = 24 * 60 * 60 * 1000
/** 며칠 안에 끝나면 미리 알리나 */
export const ENDING_DAYS = 7
/** 이번 달 양을 몇 % 넘게 쓰면 미리 알리나 */
export const LOW_PCT = 80

/** '12월 10일' — 한국 시각(Asia/Seoul) 날짜 */
export function koDay(iso: string | null): string {
  const t = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(t)) return ''
  const d = new Date(t + 9 * 60 * 60 * 1000)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`
}

/** 남은 날(한국 날짜로 센다 — 오늘 끝나면 0 · 내일이면 1) · 이미 지났으면 음수 · 기한이 없으면 null */
export function daysLeft(activeUntil: string | null, now = Date.now()): number | null {
  const t = activeUntil ? Date.parse(activeUntil) : NaN
  if (!Number.isFinite(t)) return null
  if (t <= now) return -1
  const day = (ms: number) => Math.floor((ms + 9 * 60 * 60 * 1000) / DAY)
  return day(t) - day(now)
}

/** 이번 달 쓴 비율(0~100) — 한도가 없으면 null */
export function usedPct(a: Pick<AiAccess, 'used' | 'limit'>): number | null {
  if (a.limit === null || a.limit <= 0) return null
  return Math.min(100, Math.round((a.used / a.limit) * 100))
}

/** 이용 기한 한 줄(설정 칸) — '12월 10일까지 · 14일 남음' · 기한이 없으면 '' */
export function periodText(a: Pick<AiAccess, 'activeUntil'>, now = Date.now()): string {
  const left = daysLeft(a.activeUntil, now)
  if (left === null) return ''
  const day = koDay(a.activeUntil)
  if (left < 0) return `${day}에 끝남`
  return `${day}까지 · ${left === 0 ? '오늘까지' : `${left}일 남음`}`
}

/** 지금 알릴 것 하나(없으면 null) — 구독 고객만 */
export function aiNotice(a: AiAccess | null, now = Date.now()): AiNotice | null {
  if (!a || a.kind !== 'customer') return null
  const left = daysLeft(a.activeUntil, now)
  if (!a.active) {
    const ended = left !== null && left < 0
    return {
      key: 'ended',
      tone: 'danger',
      title: ended ? `AI 이용 기간이 ${koDay(a.activeUntil)}에 끝났어요` : 'AI 이용 기간이 아직 시작 전이에요',
      detail: 'AI 기능은 그동안 쉬어요. 업체 · 서류 · 일정은 그대로 쓸 수 있어요.',
    }
  }
  const pct = usedPct(a)
  if (a.limit !== null && a.used >= a.limit) {
    return { key: 'quota', tone: 'danger', title: '이번 달 AI 사용량을 다 썼어요', detail: '다음 달 1일에 다시 채워져요.' }
  }
  if (left !== null && left <= ENDING_DAYS) {
    return {
      key: 'ending',
      tone: 'warn',
      title: left === 0 ? 'AI 이용 기간이 오늘까지예요' : `AI 이용 기간이 ${left}일 남았어요`,
      detail: `${koDay(a.activeUntil)}까지 쓸 수 있어요.`,
    }
  }
  // 문턱은 반올림하기 전 비율로(79.7% 는 아직 알리지 않는다)
  if (pct !== null && a.limit !== null && a.used * 100 >= a.limit * LOW_PCT) {
    return { key: 'low', tone: 'warn', title: `이번 달 AI 사용량을 ${pct}% 썼어요`, detail: `남은 양 ${Math.max(0, a.limit - a.used).toLocaleString('ko-KR')} · 다음 달 1일에 다시 채워져요.` }
  }
  return null
}

/** 서버가 준 모양 → 화면이 쓰는 모양. 장부가 없거나(configured 아님) 모르는 모양이면 null */
export function parseAiAccess(raw: unknown): AiAccess | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  if (d.configured !== true || (d.kind !== 'internal' && d.kind !== 'customer')) return null
  const limit = d.limit === null || d.limit === undefined ? null : Number(d.limit)
  const until = typeof d.active_until === 'string' && Number.isFinite(Date.parse(d.active_until)) ? d.active_until : null
  return {
    kind: d.kind,
    active: d.active === true,
    marketing: d.marketing === true,
    used: Number(d.used) || 0,
    limit: limit === null || !Number.isFinite(limit) ? null : limit,
    month: String(d.month ?? ''),
    activeUntil: until,
  }
}

// ---------------------------------------------------------------- 서버(읽기만)

/** AI 를 쓰고 나면 남은 양이 바뀐다 — 설정 칸 · 종이 다시 읽는다 */
export const AI_ACCESS_CHANGED = 'axmvp:ai-access-changed'

const CACHE_MS = 5 * 60 * 1000
let cache: { at: number; user: string; value: AiAccess | null } | null = null
let inflight: Promise<AiAccess | null> | null = null

/** 내 AI 이용 권한 — 5분 동안 기억(종 · 설정이 같이 쓴다). 로컬 모드 · 장부 전(0022) · 못 읽으면 null */
export function loadAiAccess(userId: string | null | undefined, force = false): Promise<AiAccess | null> {
  if (!userId || getDataModeConfig().mode !== 'supabase') return Promise.resolve(null)
  if (!force && cache && cache.user === userId && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.value)
  if (inflight) return inflight
  inflight = (async (): Promise<AiAccess | null> => {
    try {
      const { data, error } = await getSupabaseClient().rpc('my_ai_access')
      if (error) return null
      const value = parseAiAccess(data)
      cache = { at: Date.now(), user: userId, value }
      return value
    } catch {
      return null
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** AI 를 방금 썼다 · 한도 · 기간에 걸렸다 — 기억을 잊고 설정 칸 · 종에 다시 읽으라고 알린다(대표 화면에서는 부르지 않는다) */
export function noteAiUsed() {
  cache = null
  try {
    window.dispatchEvent(new CustomEvent(AI_ACCESS_CHANGED))
  } catch {
    // 듣는 쪽이 없어도 된다
  }
}

/** 시험용 · 계정이 바뀔 때 — 기억을 잊는다 */
export function resetAiAccessCache() {
  cache = null
  inflight = null
}
