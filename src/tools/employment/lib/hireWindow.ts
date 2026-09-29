/**
 * 입사일로 보는 '지금 새로 신청할 수 있나' (D-137).
 *
 * 대표: "입사한 지 몇 년 지났는데 대상자라고 뜨는 건 옳지 않다. 청년일자리도약장려금은 입사 3개월 이내까지 봐주는 예외가 있다."
 *
 * 신규 채용 지원금은 대부분 '채용 전에 참여신청 · 약정' 이 원칙이라, 이미 오래 다닌 직원은 새로 신청할 수 없다.
 * 지원금마다 입사일부터 새로 신청할 수 있는 기간을 한 표에 두고, 명부 진단 · 직원 자격요건이 같은 표를 읽는다.
 *  - enrollMonths: 입사 후 몇 개월 안에 참여신청(첫 신청)을 해야 하나. 0 = 채용 전 약정 · 승인이 있어야 함(이미 채용한 직원은 새로 신청 불가)
 *  - null        = 입사일과 상관없는 지원금(계속고용 · 육아휴직 등)
 *  - confirmed   = 대표가 확인한 기준인가(false 면 화면에 ★)
 * 이미 참여신청을 해 둔 직원(진행 중)은 이 기간과 상관없이 회차대로 받는다 — 그건 회차 일정 화면의 일이다.
 */
import { addMo, parseYMD, toYMD, ymdString } from './dates'

export interface HireWindowRule {
  enrollMonths: number | null
  /** 사람이 읽는 기준 한 줄 */
  basis: string
  confirmed: boolean
}

export const HIRE_WINDOWS: Record<string, HireWindowRule> = {
  youth_jump: { enrollMonths: 3, basis: '채용 전 참여신청이 원칙 — 예외로 입사 후 3개월 안까지', confirmed: true },
  emp_promo: { enrollMonths: 12, basis: '채용 후 12개월 안에 첫 신청', confirmed: false },
  senior_intern: { enrollMonths: 0, basis: '한국노인인력개발원 사전 약정 · 승인 후 채용해야 함', confirmed: false },
  saeil_women: { enrollMonths: 0, basis: '새일센터 연계 · 인턴 약정 후 채용해야 함', confirmed: false },
  work_exp: { enrollMonths: 0, basis: '운영기관 참여 승인 후 일경험 시작', confirmed: false },
  senior_continue: { enrollMonths: null, basis: '정년에 이른 직원을 계속 고용할 때 — 입사일과 상관없음', confirmed: false },
}

export type HireWindowState =
  /** 입사일과 상관없는 지원금 */
  | 'na'
  /** 입사일을 모름 — 판단하지 않는다 */
  | 'unknown'
  /** 아직 새로 신청할 수 있다 */
  | 'open'
  /** 새로 신청할 기간이 지났다 */
  | 'closed'
  /** 채용 전 약정이 있어야 하는 지원금 — 이미 채용한 직원은 새로 신청 불가 */
  | 'preOnly'

export interface HireWindow {
  state: HireWindowState
  /** 입사 후 꽉 찬 개월 */
  monthsSinceHire: number | null
  /** 새로 신청할 수 있는 마지막 날(YYYY-MM-DD) — open/closed 일 때 */
  deadline: string
  /** 남은 날(open 일 때) */
  daysLeft: number | null
  basis: string
  confirmed: boolean
  /** 화면에 그대로 쓰는 한 줄 */
  text: string
}

function dayNo(ds: string): number | null {
  const p = parseYMD(ds)
  return p ? Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86400000) : null
}

/** 입사일 → 오늘까지 꽉 찬 개월(입사일이 오늘보다 뒤면 0) */
export function fullMonthsSince(hireDate: string, today: string): number | null {
  const h = parseYMD(hireDate)
  const t = parseYMD(today)
  if (!h || !t) return null
  let m = (t.y - h.y) * 12 + (t.m - h.m)
  // 그 달에 입사일과 같은 날이 없으면(1/31 → 2/28) 말일을 지나면 한 달로 본다
  const lastDay = new Date(t.y, t.m, 0).getDate()
  if (t.d < Math.min(h.d, lastDay)) m -= 1
  return Math.max(0, m)
}

/**
 * 이 지원금을 이 직원(입사일)으로 **지금 새로** 신청할 수 있나.
 * 기한 = 입사일 + enrollMonths 개월(그 달에 같은 날이 없으면 말일) — 그날까지는 open.
 */
export function hireWindowOf(programKey: string, hireDate: string | null | undefined, today: Date | string): HireWindow {
  const rule = HIRE_WINDOWS[programKey]
  const todayYmd = toYMD(today)
  const base = { basis: rule?.basis ?? '', confirmed: rule?.confirmed ?? false }
  if (!rule || rule.enrollMonths === null) return { state: 'na', monthsSinceHire: null, deadline: '', daysLeft: null, text: '', ...base }
  const hd = toYMD(hireDate)
  if (!hd || !todayYmd) return { state: 'unknown', monthsSinceHire: null, deadline: '', daysLeft: null, text: '입사일을 알아야 신청 기한을 봅니다', ...base }
  const months = fullMonthsSince(hd, todayYmd)
  const star = rule.confirmed ? '' : ' ★확인'
  if (rule.enrollMonths === 0) {
    // 채용 전 약정 — 입사일이 앞날(채용 예정)이면 아직 할 수 있다
    const future = (dayNo(hd) ?? 0) > (dayNo(todayYmd) ?? 0)
    if (future) return { state: 'open', monthsSinceHire: 0, deadline: hd, daysLeft: (dayNo(hd) ?? 0) - (dayNo(todayYmd) ?? 0), text: `채용 전에 약정 · 승인부터(${hd} 입사 예정)${star}`, ...base }
    return { state: 'preOnly', monthsSinceHire: months, deadline: '', daysLeft: null, text: `이미 채용한 직원 — ${rule.basis}${star}`, ...base }
  }
  const deadline = addMo(hd, rule.enrollMonths)
  const left = (dayNo(deadline) ?? 0) - (dayNo(todayYmd) ?? 0)
  if (left >= 0) return { state: 'open', monthsSinceHire: months, deadline, daysLeft: left, text: `신청 기한 ${deadline}까지(D-${left}) — ${rule.basis}${star}`, ...base }
  return { state: 'closed', monthsSinceHire: months, deadline, daysLeft: null, text: `입사 ${months}개월 — 신청 기한(${deadline}) 지남 · ${rule.basis}${star}`, ...base }
}

/** 새로 신청할 수 없는가(기한 지남 · 사전 약정 필요) */
export function hireWindowBlocks(w: HireWindow): boolean {
  return w.state === 'closed' || w.state === 'preOnly'
}

/** 오늘(현지) — 테스트에서 기준일을 넘길 수 있게 문자열로 */
export function todayYmdLocal(now: Date = new Date()): string {
  return ymdString({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() })
}
