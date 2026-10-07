/**
 * 갱신 일정 (P1) — 유효기간 끝(사람이 적은 날짜)에서 '갱신 준비 시기'(알림) · '갱신 서류 준비'(진짜 할 일) · 만료를 낸다.
 * 날짜를 모르면 아무것도 만들지 않는다. 날 수는 rules 의 인증별 기준(공식 연장 · 재확인 기간)에서 읽는다.
 */
import { CERT_RULES } from '../rules/officialRules'
import type { CertificationKey } from './types'

const DAY = 86_400_000
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY)
const add = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

export type RenewalPhase = 'ok' | 'notice' | 'todo' | 'grace' | 'expired'

export const RENEWAL_PHASE_LABEL: Record<RenewalPhase, string> = {
  ok: '유효',
  notice: '갱신 준비 시기',
  todo: '갱신 서류 준비',
  grace: '만료 — 연장 신청 가능 기간',
  expired: '만료',
}

export interface RenewalPlan {
  cert: CertificationKey
  validUntil: string
  daysLeft: number
  phase: RenewalPhase
  /** '갱신 준비 시기' 알림이 뜨는 날(D-noticeDays) */
  noticeOn: string
  /** 진짜 할 일 날(D-todoDays) */
  todoOn: string
  /** 만료 뒤에도 연장 신청이 되는 마지막 날(없으면 '') */
  graceUntil: string
  /** 왜 이 날짜인지(공식 기준 한 줄) */
  why: string
}

export function renewalPlan(cert: CertificationKey, validUntil: string, today: string): RenewalPlan | null {
  const r = CERT_RULES[cert].renewal
  if (!r || !/^\d{4}-\d{2}-\d{2}$/.test(validUntil) || !Number.isFinite(Date.parse(`${validUntil}T00:00:00Z`))) return null
  const left = days(today, validUntil)
  const noticeOn = add(validUntil, -r.noticeDays)
  const todoOn = add(validUntil, -r.todoDays)
  const graceUntil = r.graceDaysAfter > 0 ? add(validUntil, r.graceDaysAfter) : ''
  const phase: RenewalPhase = left < 0 ? (graceUntil && today <= graceUntil ? 'grace' : 'expired') : today >= todoOn ? 'todo' : today >= noticeOn ? 'notice' : 'ok'
  return { cert, validUntil, daysLeft: left, phase, noticeOn, todoOn, graceUntil, why: r.why }
}

/** 달력 · 오늘 · 할 일에 걸 일정 — 알림(D-notice) · 할 일(D-todo) · 만료일. 만료된 뒤에는 만들지 않는다 */
export interface RenewalDeadline {
  date: string
  title: string
  note: string
  /** 진짜 할 일(오늘 화면 · 할 일 목록) */
  todo?: true
  /** 놓치면 끝나는 날 */
  hard?: true
}

export function renewalDeadlines(plan: RenewalPlan, label: string): RenewalDeadline[] {
  if (plan.phase === 'expired') return []
  if (plan.phase === 'grace') return [{ date: plan.graceUntil, title: `${label} 연장 신청 마지막 날`, note: plan.why, hard: true }]
  return [
    { date: plan.noticeOn, title: `${label} 갱신 준비 시기`, note: plan.why },
    { date: plan.todoOn, title: `${label} 갱신 서류 준비`, note: plan.why, todo: true },
    { date: plan.validUntil, title: `${label} 유효기간 끝`, note: '', hard: true },
  ]
}
