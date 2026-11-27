/**
 * D-684 계약 끝나는 날 · 재계약 챙기기 — 규칙 계산(AI 아님 · 외부 호출 0 · DB 변경 0).
 *
 *   끝나는 날은 사람이 적은 것만 쓴다(계약일 + 1년으로 짐작해 채우지 않는다).
 *   끝나기 30일 전부터 끝난 뒤 30일까지 '재계약 챙길 때' — 오늘 '안부 챙길 계약 고객' 에 한 줄 · 7일 안이면 급함.
 *   [재계약했어요] → 이번 기간 시작 = 앞 계약 끝 다음 날 · 끝나는 날 = 고른 날 · 활동 기록 한 줄 · 오늘 연락한 것으로.
 *   저장은 업체 기록 payload 의 contract 두 칸(endsAt · termFrom) — 이 칸이 없던 기록은 '' (예전 그대로).
 */
import type { ClientOpsRecord, ContractInfo } from '../types/clientOps'
import { withActivity } from './clientOpsActivity'

/** 끝나기 며칠 전부터 챙길지 */
export const RENEWAL_AHEAD = 30
/** 끝난 뒤 며칠까지 챙길지 — 그 뒤에는 목록에서 빠진다(끝난 계약을 끝없이 띄우지 않는다) */
export const RENEWAL_AFTER = 30
/** 이 날 수 안이면 급함 */
export const RENEWAL_URGENT = 7

const DAY = /^\d{4}-\d{2}-\d{2}$/

function utc(day: string): number {
  return Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10))
}

/** 'YYYY-MM-DD' 에 n 일 */
export function addDay(day: string, n: number): string {
  return new Date(utc(day) + n * 86_400_000).toISOString().slice(0, 10)
}

/** 두 날짜 사이 날 수(b 가 뒤면 양수) */
export function dayDiff(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

/** 끝나는 날 — 적힌 것이 날짜일 때만(모르면 '') */
export function contractEnd(contract: Pick<ContractInfo, 'endsAt'> | null | undefined): string {
  const d = (contract?.endsAt ?? '').slice(0, 10)
  return DAY.test(d) ? d : ''
}

/**
 * 이번 계약 기간이 시작한 날 — 재계약했으면 그 날, 아니면 계약일(모르면 '').
 * today 를 주면: 끝나기 전에 미리 재계약해 새 기간이 아직 안 왔으면 지금 돌고 있는 기간(계약일)으로 본다.
 */
export function termStart(contract: Pick<ContractInfo, 'signedAt' | 'termFrom'> | null | undefined, today?: string): string {
  const t = (contract?.termFrom ?? '').slice(0, 10)
  if (DAY.test(t) && !(today && DAY.test(today) && t > today)) return t
  const s = (contract?.signedAt ?? '').slice(0, 10)
  return DAY.test(s) ? s : ''
}

/**
 * from 에서 n 년 계약의 끝나는 날 — 2026-01-15 → 1년 = 2027-01-14(하루 전).
 * 2/29 에 시작한 계약은 평년에 3/1 이 되기 전날(2/28)에 끝난다.
 */
export function endAfterYears(from: string, years: number): string {
  if (!DAY.test(from) || !(years >= 1 && years <= 10)) return ''
  const t = new Date(Date.UTC(+from.slice(0, 4) + years, +from.slice(5, 7) - 1, +from.slice(8, 10)))
  return addDay(t.toISOString().slice(0, 10), -1)
}

/**
 * 지금 돌고 있는 계약이 끝나는 날 — 끝나기 전에 미리 재계약했으면(새 기간이 아직 안 옴) 앞 계약이 끝나는 날(새 기간 시작 하루 전).
 * 고객 화면 '재계약 전 연간 보고' 는 이 날로 본다(미리 재계약해도 끝나는 계약의 보고는 챙긴다).
 */
export function currentTermEnd(contract: Pick<ContractInfo, 'endsAt' | 'termFrom'> | null | undefined, today: string): string {
  const t = (contract?.termFrom ?? '').slice(0, 10)
  if (DAY.test(t) && DAY.test(today) && t > today) return addDay(t, -1)
  return contractEnd(contract)
}

/** 끝나는 날이 그 기간 시작보다 앞이면 틀린 값 — 저장 전에 막는다 */
export function endBeforeStart(start: string, end: string): boolean {
  return DAY.test(start) && DAY.test(end) && end < start
}

export interface RenewalState {
  endsAt: string
  /** 남은 날(오늘 끝나면 0 · 지났으면 음수) */
  daysLeft: number
  /** 지금 챙길 때인지(끝나기 30일 전 ~ 끝난 뒤 30일) */
  due: boolean
  urgent: boolean
}

export function renewalState(contract: Pick<ContractInfo, 'endsAt'> | null | undefined, today: string): RenewalState | null {
  const endsAt = contractEnd(contract)
  if (!endsAt || !DAY.test(today)) return null
  const daysLeft = dayDiff(today, endsAt)
  return { endsAt, daysLeft, due: daysLeft <= RENEWAL_AHEAD && daysLeft >= -RENEWAL_AFTER, urgent: daysLeft <= RENEWAL_URGENT }
}

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

/** '23일 남음' · '오늘' · '3일 지남' */
export function renewalWhen(daysLeft: number): string {
  return daysLeft > 0 ? `${daysLeft}일 남음` : daysLeft === 0 ? '오늘' : `${-daysLeft}일 지남`
}

/** 계약 칸 한 줄 — '~ 2027-01-14' · 60일 안이면 ' · 23일 남음' · 지났으면 ' · 끝남' */
export function contractEndText(contract: Pick<ContractInfo, 'endsAt'> | null | undefined, today: string): { text: string; tone: 'plain' | 'soon' | 'ended' } | null {
  const s = renewalState(contract, today)
  if (!s) return null
  if (s.daysLeft < 0) return { text: `${s.endsAt} 끝남 · ${-s.daysLeft}일 지남`, tone: 'ended' }
  if (s.daysLeft <= 60) return { text: `${s.endsAt}까지 · ${renewalWhen(s.daysLeft)}`, tone: 'soon' }
  return { text: `${s.endsAt}까지`, tone: 'plain' }
}

/** 재계약 줄 한 줄 설명 */
export function renewalText(s: RenewalState): string {
  return s.daysLeft >= 0
    ? `계약 끝 ${md(s.endsAt)}(${renewalWhen(s.daysLeft)}) — 성과 보고 드리고 재계약 이야기`
    : `계약 끝 ${md(s.endsAt)}(${renewalWhen(s.daysLeft)}) — 재계약했으면 [재계약했어요]`
}

/**
 * 재계약하면 새 끝나는 날을 무엇으로 먼저 고를지 — 지금 기간이 딱 n년(1~5)이면 같은 n년, 아니면 1년.
 * 새 기간은 앞 계약이 끝난 다음 날부터.
 */
export function renewalYears(contract: Pick<ContractInfo, 'signedAt' | 'termFrom' | 'endsAt'>): number {
  const start = termStart(contract)
  const end = contractEnd(contract)
  if (!start || !end || end < start) return 1
  for (let n = 1; n <= 5; n += 1) if (endAfterYears(start, n) === end) return n
  return 1
}

export function renewalDefaultEnd(contract: Pick<ContractInfo, 'signedAt' | 'termFrom' | 'endsAt'>, years = renewalYears(contract)): string {
  const end = contractEnd(contract)
  return end ? endAfterYears(addDay(end, 1), years) : ''
}

/**
 * [재계약했어요] — 이번 기간 시작 = 앞 계약 끝 다음 날 · 끝나는 날 = newEnd · 활동 기록 한 줄 · 오늘 연락한 것으로(미루기는 지움).
 * 새 끝나는 날이 앞 계약 끝보다 늦지 않으면 바꾸지 않는다(같은 기록을 두 번 눌러도 한 번).
 */
export function withRenewal(record: ClientOpsRecord, newEnd: string, today: string, at: string = new Date().toISOString()): ClientOpsRecord {
  const end = contractEnd(record.contract)
  if (!end || !DAY.test(newEnd) || newEnd <= end) return record
  const termFrom = addDay(end, 1)
  const next: ClientOpsRecord = {
    ...record,
    contract: { ...record.contract, endsAt: newEnd, termFrom },
    care: { lastContactAt: today },
  }
  return withActivity(next, 'contract', `재계약 — ${termFrom} ~ ${newEnd}`, null, at)
}
