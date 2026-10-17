/**
 * 갱신 일정 (P1) — 유효기간 끝(사람이 적은 날짜)에서 '갱신 준비 시기'(알림) · '갱신 서류 준비'(진짜 할 일) · 만료를 낸다.
 * 날짜를 모르면 아무것도 만들지 않는다. 날 수는 rules 의 인증별 기준(공식 연장 · 재확인 기간)에서 읽는다.
 */
import { CERT_RULES, type RenewalRule } from '../rules/officialRules'
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
  /** D-214: 지금 기준으로 신청할 수 있는 마지막 날(만료 전에 새 기준이 시행되는 전환기만) */
  ruleEndsOn?: string
}

type DatedRule = RenewalRule & { from?: string; until?: string }
const inForce = (x: DatedRule, d: string) => (!x.from || d >= x.from) && (!x.until || d <= x.until)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * AX Hotfix: 판정 날짜(today)에 시행 중인 갱신 규칙 — 시행일로 갈리는 인증(벤처 재확인 2027-02-21)은 renewalRules 에서 고른다.
 * D-214: 오늘 규칙으로 따진 '갱신 서류 준비' 날이 새 규칙 시행 뒤면, 그날 실제로 신청할 때는 새 규칙이 적용되므로 새 규칙 날짜를 쓴다.
 *   (예전: 2026년에 적은 2029년 만료도 옛 규칙 D-60 · 만료 뒤 1개월로 달력에 걸려, 새 규칙의 140일 전 기한을 80일쯤 넘겼다.)
 *   오늘 규칙으로도 시행 전에 신청할 수 있으면 오늘 규칙 그대로 — 대신 만료 뒤 연장 · 신청 마지막 날은 시행 전날까지만(ruleEndsOn).
 */
export function renewalRuleFor(cert: CertificationKey, today: string, validUntil = ''): (RenewalRule & { ruleEndsOn?: string }) | null {
  const rule = CERT_RULES[cert]
  const list: DatedRule[] = rule.renewalRules ?? []
  const hit = list.find((x) => inForce(x, today))
  if (!hit) return rule.renewal ?? null
  const nextRule = hit.until ? list.find((x) => x.from && x.from > hit.until!) : undefined
  if (!nextRule || !DATE_RE.test(validUntil)) return hit
  const from = nextRule.from!
  const todoByToday = add(validUntil, -hit.todoDays)
  if (todoByToday >= from) return { ...nextRule, why: `${nextRule.why} · 신청할 때(${todoByToday} 무렵)는 이미 이 기준이 시행 중` }
  // 오늘 규칙으로 시행 전에 신청할 수 있다 — 만료 뒤 연장 신청이 시행일을 넘기면 그 몫은 없다
  if (add(validUntil, hit.graceDaysAfter) > hit.until!) {
    return { ...hit, ruleEndsOn: hit.until, why: `${hit.why} · ${from}부터는 새 기준(${nextRule.why.split(' — ')[1] ?? nextRule.why}) — ${hit.until}까지 신청해야 지금 기준으로 이어짐` }
  }
  return hit
}

export function renewalPlan(cert: CertificationKey, validUntil: string, today: string): RenewalPlan | null {
  const r = renewalRuleFor(cert, today, validUntil)
  if (!r || !DATE_RE.test(validUntil) || !Number.isFinite(Date.parse(`${validUntil}T00:00:00Z`))) return null
  const left = days(today, validUntil)
  const noticeOn = add(validUntil, -r.noticeDays)
  const todoOn = add(validUntil, -r.todoDays)
  let graceUntil = r.graceDaysAfter > 0 ? add(validUntil, r.graceDaysAfter) : ''
  if (graceUntil && r.ruleEndsOn && graceUntil > r.ruleEndsOn) graceUntil = r.ruleEndsOn > validUntil ? r.ruleEndsOn : ''
  const ruleEndsOn = r.ruleEndsOn && r.ruleEndsOn < validUntil ? r.ruleEndsOn : ''
  const phase: RenewalPhase = left < 0 ? (graceUntil && today <= graceUntil ? 'grace' : 'expired') : today >= todoOn ? 'todo' : today >= noticeOn ? 'notice' : 'ok'
  return { cert, validUntil, daysLeft: left, phase, noticeOn, todoOn, graceUntil, why: r.why, ...(ruleEndsOn ? { ruleEndsOn } : {}) }
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
  // D-214: 이미 지난 알림은 걸지 않고, 지난 '서류 준비' 는 오늘로 — 붙이자마자 '기한 지남' 으로 한 달 동안 뜨지 않게.
  //   '할 일(todo)' 은 사람이 건 것만 뜻한다(다시 판정해도 남김) — 계산한 날짜에 붙이면 다시 붙일 때마다 같은 줄이 늘었다.
  const today = add(plan.validUntil, -plan.daysLeft)
  const out: RenewalDeadline[] = []
  if (plan.noticeOn > today) out.push({ date: plan.noticeOn, title: `${label} 갱신 준비 시기`, note: plan.why })
  out.push({ date: plan.todoOn > today ? plan.todoOn : today, title: `${label} 갱신 서류 준비`, note: plan.why })
  if (plan.ruleEndsOn) out.push({ date: plan.ruleEndsOn, title: `${label} 지금 기준으로 신청할 마지막 날`, note: plan.why, hard: true })
  out.push({ date: plan.validUntil, title: `${label} 유효기간 끝`, note: '', hard: true })
  return out
}
