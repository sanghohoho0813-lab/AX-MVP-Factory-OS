/**
 * 반복 할 일 날짜 (D-139) — '매주 월요일 주간 회의' · '매월 10일 급여 증빙 요청' 을 한 번에 적는다.
 * 할 일은 날짜마다 한 줄씩 만든다(하나를 끝내거나 미뤄도 나머지는 그대로).
 *  - 매월: 31일에 시작하면 31일이 없는 달은 그 달 말일(2월 28/29일).
 *  - 쉬는 날 · 주말을 피하고 싶으면 skipOff — 그 전 영업일로 당긴다(마감은 늦는 것보다 이른 게 낫다).
 */
import { addDays, isWeekend } from './daysOff'

export type RepeatEvery = 'none' | 'weekly' | 'biweekly' | 'monthly'

export const REPEAT_LABEL: Record<RepeatEvery, string> = {
  none: '한 번',
  weekly: '매주',
  biweekly: '2주마다',
  monthly: '매월',
}

/** 반복 횟수 한도 — 실수로 수백 줄이 생기지 않게 */
export const REPEAT_MAX = 24

function monthly(start: string, i: number): string {
  const [y, m, d] = start.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + i, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const day = Math.min(d, last)
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * D-150: `notBefore`(보통 오늘) — 쉬는 날을 피해 앞으로 당기다 이 날보다 앞서면 대신 다음 평일로(넣자마자 '지난 할 일' 이 되지 않게).
 */
export function repeatDates(start: string, every: RepeatEvery, count: number, opts?: { skipOff?: ReadonlySet<string> | null; notBefore?: string }): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return []
  const n = every === 'none' ? 1 : Math.max(1, Math.min(REPEAT_MAX, Math.floor(count) || 1))
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const planned = every === 'weekly' ? addDays(start, 7 * i) : every === 'biweekly' ? addDays(start, 14 * i) : every === 'monthly' ? monthly(start, i) : start
    let d = planned
    const off = opts?.skipOff
    if (off) {
      for (let k = 0; k < 20 && (isWeekend(d) || off.has(d)); k++) d = addDays(d, -1)
      // D-150: 당기다 오늘보다 앞서면(오늘 토요일에 시작한 반복) 뒤로 — 다음 평일. 넣자마자 '지난 할 일' 이 되던 것
      if (opts?.notBefore && d < opts.notBefore) {
        d = planned
        for (let k = 0; k < 20 && (isWeekend(d) || off.has(d)); k++) d = addDays(d, 1)
      }
    }
    if (!out.includes(d)) out.push(d)
  }
  return out
}
