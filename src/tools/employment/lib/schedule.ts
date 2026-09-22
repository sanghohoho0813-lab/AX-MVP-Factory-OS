/**
 * 회차 일정 — 입사일 + 프로그램 회차표 → 신청 가능일·D-day.
 *
 * 원본에서 직원 저장 시 회차를 복사하던 규칙(3845 줄: rounds 에 isPaid:false, received:0 덧붙임)과
 * 대시보드 DdayAlerts(1251~1291 줄)·위험도 랭킹(1397~1416 줄)의 회차 날짜 계산(addMo + getDday)을 그대로 쓴다.
 */

import { addMo, formatDday, getDdayFrom } from './dates'
import type { Program, ProgramRound } from './programs'

export interface EmployeeRound extends ProgramRound {
  isPaid: boolean
  received: number
  expectedAmount?: number
}

/** 프로그램 회차표를 직원 회차로 복사 (원본 save() 와 같이 isPaid:false, received:0) */
export function buildRounds(program: Pick<Program, 'rounds'>): EmployeeRound[] {
  return JSON.parse(JSON.stringify(program.rounds || [])).map((r: ProgramRound) => ({ ...r, isPaid: false, received: 0 }))
}

/** 회차 신청 가능일 = 입사일 + month 개월 */
export function roundDate(startDate: string, round: Pick<ProgramRound, 'month'>): string {
  return addMo(startDate, round.month)
}

export function sumReceived(rounds: readonly EmployeeRound[]): number {
  return rounds.reduce((s, r) => s + (r.isPaid ? r.received || 0 : 0), 0)
}

/** 아직 안 받은 회차의 예정액 (원본 CompanyRiskRanking 의 remaining 과 같은 식) */
export function sumRemaining(rounds: readonly EmployeeRound[]): number {
  return rounds.reduce((s, r) => s + (r.isPaid ? 0 : r.expectedAmount || r.amount || 0), 0)
}

export type RoundKind = '지급 완료' | '신청 지연' | '신청 임박' | '신청 예정'

export interface ScheduleRow {
  index: number
  label: string
  month: number
  amount: number
  date: string
  dday: number | null
  ddayLabel: string
  kind: RoundKind
  isPaid: boolean
}

export interface RoundSchedule {
  rows: ScheduleRow[]
  total: number
  received: number
  remaining: number
  overdue: number
  next7: number
  nextDday: number | null
}

/**
 * 회차별 신청 가능일·D-day 표. paid 는 회차 index → 받은 회차.
 * "임박" 은 원본 DdayAlerts 기본값(ddayAlert 7일)·위험도 랭킹(next7) 과 같은 7일.
 */
export function roundSchedule(startDate: string, program: Pick<Program, 'rounds'>, today: Date, paid?: readonly boolean[]): RoundSchedule {
  const rounds = buildRounds(program).map((r, i) => ({ ...r, isPaid: !!(paid && paid[i]), received: paid && paid[i] ? r.amount : 0 }))
  let overdue = 0
  let next7 = 0
  let nextDday: number | null = null
  const rows: ScheduleRow[] = rounds.map((r, i) => {
    const date = startDate ? roundDate(startDate, r) : ''
    const dday = date ? getDdayFrom(date, today) : null
    let kind: RoundKind = '신청 예정'
    if (r.isPaid) kind = '지급 완료'
    else if (dday !== null && dday < 0) kind = '신청 지연'
    else if (dday !== null && dday <= 7) kind = '신청 임박'
    if (!r.isPaid && dday !== null) {
      if (dday < 0) overdue++
      else if (dday <= 7) next7++
      if (dday >= 0 && (nextDday === null || dday < nextDday)) nextDday = dday
    }
    return { index: i, label: r.label, month: r.month, amount: r.amount, date: date, dday: dday, ddayLabel: formatDday(dday), kind: kind, isPaid: r.isPaid }
  })
  return {
    rows: rows,
    total: rounds.reduce((s, r) => s + (r.amount || 0), 0),
    received: sumReceived(rounds),
    remaining: sumRemaining(rounds),
    overdue: overdue,
    next7: next7,
    nextDday: nextDday,
  }
}
