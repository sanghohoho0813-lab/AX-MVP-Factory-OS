/**
 * 인증별 판정 (D-170) — 업체 사정(CertificationClientContext) → 준비도 5단계 · 추천 · 한 줄 이유 · 근거 · 모자란 것 · 혜택 · 타이밍 · 다음 행동.
 * 기준 숫자는 rules/officialRules.ts 에서만 읽는다. 모르는 값은 '?' 로 두고 추측하지 않는다.
 */
import { CERT_RULES, LAB_RESEARCHERS, VENTURE_RND, ventureRndRatio, type CertRule } from '../rules/officialRules'
import { innobizIndustry, mainbizIndustry } from '../rules/industryMap'
import { renewalPlan, RENEWAL_PHASE_LABEL } from './renewal'
import { pickBenefits } from './benefits'
import { readinessOf, reasonsOf, type Check } from './readiness'
import { assessIso } from '../iso/isoAdvice'
import { rndNeedsExact, rndPositive, rndText } from './rnd'
import { RND_RANGE_LABEL, type CertificationAssessment, type CertificationClientContext, type CertificationKey, type NextAction, type Readiness, type Recommendation } from './types'

const DAY = 86_400_000

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY)
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 업력 n년이 되는 날(설립일을 모르면 '') */
function yearsReachedOn(c: CertificationClientContext, years: number): string {
  if (c.months === null) return ''
  const left = years * 12 - c.months
  if (left <= 0) return c.today
  const d = new Date(`${c.today}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + left)
  return d.toISOString().slice(0, 7)
}

const won = (n: number) => (Math.abs(n) >= 1e8 ? `${Math.round(n / 1e7) / 10}억원` : `${Math.round(n / 1e4).toLocaleString()}만원`)

function heldOf(c: CertificationClientContext, key: CertificationKey) {
  return c.held.find((h) => h.key === key) ?? null
}

/** 보유했지만 유효기간이 지났고 연장 신청 기간도 지난 인증 — '보유 중' 이 아니라 다시 신청할 대상 (P1) */
function expiredHeld(c: CertificationClientContext, key: CertificationKey) {
  const h = heldOf(c, key)
  if (!h || !h.validUntil) return null
  const plan = renewalPlan(key, h.validUntil, c.today)
  return plan && (plan.phase === 'expired' || plan.phase === 'grace') ? { h, plan } : null
}

/** 보유 중으로 볼 인증(만료 · 연장 기간 안 포함) */
function liveHeld(c: CertificationClientContext, key: CertificationKey) {
  const h = heldOf(c, key)
  if (!h) return null
  const ex = expiredHeld(c, key)
  return ex && ex.plan.phase === 'expired' ? null : h
}

/**
 * 만료된 인증 — 새로 판정한 결과 위에 '이전 인증 만료' 를 얹는다. 보유 중 · 매우 높음으로 보이지 않게(P1 시나리오 E).
 */
function withExpired(a: CertificationAssessment, c: CertificationClientContext): CertificationAssessment {
  const ex = expiredHeld(c, a.key)
  if (!ex || ex.plan.phase !== 'expired') return a
  const ago = -ex.plan.daysLeft
  return {
    ...a,
    oneLine: `이전 인증 만료(${ex.h.validUntil}, ${ago}일 지남) — 다시 신청해야 합니다 · ${a.oneLine}`,
    reasons: [{ state: 'no', text: `이전 ${a.label} 만료 ${ex.h.validUntil}(${ago}일 지남)${ex.plan.graceUntil ? ` · 연장 신청 기간(${ex.plan.graceUntil}까지)도 지남` : ''} — 신규로 신청` }, ...a.reasons],
    renewal: { validUntil: ex.h.validUntil, daysLeft: ex.plan.daysLeft, prepareFrom: ex.plan.todoOn, note: CERT_RULES[a.key].renewalNote },
    expired: true,
  }
}

function evidenceSplit(rule: CertRule, c: CertificationClientContext) {
  const have: string[] = []
  const missing: string[] = []
  for (const e of rule.evidence) {
    const doc = c.evidence.find((d) => d.id === e.id)
    if (doc?.have && !doc.stale) have.push(e.label)
    else missing.push(e.label)
  }
  return { have, missing }
}

/**
 * AX: 중소기업 여부 — 직원 수 · 매출만으로는 '충족' 으로 확정하지 않는다(독립성 · 관계기업 · 업종별 매출 기준은 확인서로만 알 수 있다).
 * 중소기업확인서(서류함 · 인증서 칸) 또는 확인서를 보고 고른 규모가 있어야 ✓.
 */
function smeCheck(c: CertificationClientContext): Check {
  if (c.size === 'mid_large' || c.size === 'large') return { weight: 'must', state: 'no', text: '중소기업이 아님(중견 · 대기업)' }
  if (c.smeDoc) return { weight: 'must', state: 'ok', text: '중소기업(중소기업확인서 있음)' }
  if (c.size === 'small' || c.size === 'medium') return { weight: 'must', state: 'ok', text: `${c.size === 'small' ? '소기업' : '중기업'}(중소기업확인서 기준으로 확인함)` }
  const hint = c.employees !== null && c.employees < 50 && (c.revenue === null || c.revenue < 40_000_000_000) ? ` — 직원 ${c.employees}명으로 중소기업으로 보이지만 확정 아님` : ''
  return { weight: 'must', state: 'unknown', text: `중소기업 여부 · 확인 필요${hint}(중소기업확인서로 확인)` }
}

/** 모르는 것의 이름만(뒤 설명 · '· 확인 필요' 꼬리는 뺀다) — '중소기업 여부, 체납 · 회생 같은 제외 사유 확인이 먼저 필요' */
function factsOf(checks: readonly Check[]): string[] {
  return checks.filter((x) => x.state === 'unknown').map((x) => x.text.split(' — ')[0].replace(/\s*·?\s*확인 필요.*$/, '').replace(/\(.*\)$/, '').trim())
}

function yearsCheck(c: CertificationClientContext, need: number): Check {
  if (c.years === null) return { weight: 'must', state: 'unknown', text: `업력 ${need}년 이상 — 설립일 확인 필요` }
  if (c.years >= need) return { weight: 'must', state: 'ok', text: `업력 ${need}년 이상 충족(${c.years}년)` }
  const on = yearsReachedOn(c, need)
  return { weight: 'must', state: 'no', text: `업력 ${c.years}년 — ${need}년 이상 필요${on ? `(${on} 부터 가능)` : ''}` }
}

function exclusionCheck(c: CertificationClientContext): Check {
  if (c.exclusionFlags.length) return { weight: 'must', state: 'no', text: `제외 사유: ${c.exclusionFlags.join(' · ')}` }
  // FV: 근거 목록이 있는데 제외 사유를 누구도 확인하지 않았으면 ✓ 로 보이지 않게(아는 척 금지) — 판정을 막지는 않는다
  if (c.basis && !c.basis.some((b) => b.field === 'exclusion' && b.state !== 'missing')) return { weight: 'note', state: 'unknown', text: '체납 · 회생 같은 제외 사유 — 신청 전 확인 필요' }
  return { weight: 'must', state: 'ok', text: '체납 · 회생 같은 제외 사유 확인된 것 없음(신청 전 최종 확인)' }
}

const RANK: Record<Readiness, number> = { very_high: 5, high: 4, medium: 3, low: 2, very_low: 1, unknown: 0 }
/** 준비도 상한 — 모르는 것('추가 확인 필요')은 그대로 둔다 */
function capReadiness(r: Readiness, max: Readiness): Readiness {
  return r !== 'unknown' && RANK[r] > RANK[max] ? max : r
}

/**
 * FV: 준비도는 '신청 준비' 다 — 제출 자료가 덜 모였으면 요건이 좋아도 한계가 있다(공통 규칙, 업체 이름 무관).
 *   자료 3분의 1 미만 → 최대 '보통' · 4분의 3 미만 → 최대 '높음'
 */
function evidenceCap(have: number, total: number): Readiness {
  if (total === 0) return 'very_high'
  const r = have / total
  return r < 1 / 3 ? 'medium' : r < 0.75 ? 'high' : 'very_high'
}

function finish(
  rule: CertRule,
  c: CertificationClientContext,
  checks: Check[],
  rec: Recommendation,
  oneLine: string,
  timing: string,
  next: NextAction,
  missingFacts: string[],
  readinessOverride?: Readiness,
): CertificationAssessment {
  const ev = evidenceSplit(rule, c)
  const held = heldOf(c, rule.key)
  let renewal: CertificationAssessment['renewal']
  if (held && held.validUntil) {
    const plan = renewalPlan(rule.key, held.validUntil, c.today)
    const daysLeft = daysBetween(c.today, held.validUntil)
    renewal = { validUntil: held.validUntil, daysLeft, prepareFrom: plan ? plan.noticeOn : addDays(held.validUntil, -rule.prepareDaysBefore), note: rule.renewalNote }
  }
  const raw = readinessOverride ?? readinessOf(checks)
  const capped = rec === 'held' ? raw : capReadiness(raw, evidenceCap(ev.have.length, ev.have.length + ev.missing.length))
  const reasons = reasonsOf(checks)
  if (capped !== raw) reasons.push({ state: 'warn', text: `제출 자료 ${ev.have.length}/${ev.have.length + ev.missing.length} 준비 — 자료가 더 모이면 준비도가 올라갑니다` })
  return {
    key: rule.key,
    label: rule.label,
    readiness: capped,
    recommendation: rec,
    oneLine,
    reasons,
    missingFacts,
    missingEvidence: ev.missing,
    haveEvidence: ev.have,
    benefits: pickBenefits(rule.benefits, c),
    timing,
    nextAction: next,
    ...(renewal ? { renewal } : {}),
  }
}

/** 보유 중인 인증 — 갱신 시기로 판정(날짜는 사람이 적은 유효기간만 쓴다) */
function heldAssessment(rule: CertRule, c: CertificationClientContext): CertificationAssessment {
  const h = heldOf(c, rule.key)!
  const checks: Check[] = [{ weight: 'must', state: 'ok', text: `${rule.label} 보유${h.note ? ` · ${h.note}` : ''}` }]
  if (!h.validUntil && rule.validYears) checks.push({ weight: 'core', state: 'unknown', text: '유효기간 — 확인서로 확인 필요' })
  const plan = h.validUntil ? renewalPlan(rule.key, h.validUntil, c.today) : null
  let timing: string
  let oneLine = '이미 보유 중입니다'
  let rec: Recommendation = 'held'
  let next: NextAction = { label: '보유 인증 관리', kind: 'wait' }
  if (!plan) timing = rule.validYears ? '유효기간을 적어 두면 갱신 준비일을 알려 드립니다' : '요건 유지 · 변경 신고 관리'
  else if (plan.phase === 'grace') {
    timing = `만료 ${-plan.daysLeft}일 지남 — ${plan.graceUntil}까지 연장 신청 가능`
    oneLine = `유효기간이 지났지만 ${plan.graceUntil}까지 연장 신청할 수 있습니다`
    rec = 'now'
    next = { label: '지금 연장 신청', kind: 'renew' }
    checks.push({ weight: 'core', state: 'warn', text: `유효기간 ${plan.validUntil} 지남 · 연장 신청 마지막 날 ${plan.graceUntil}` })
  } else if (plan.phase === 'todo' || plan.phase === 'notice') {
    timing = `${RENEWAL_PHASE_LABEL[plan.phase]} — 만료까지 ${plan.daysLeft}일(${plan.validUntil})`
    oneLine = plan.phase === 'todo' ? '갱신 서류를 준비할 때입니다' : '갱신 준비 시기가 다가왔습니다'
    next = { label: '갱신 준비 시작', kind: 'renew' }
  } else timing = `유효 · ${plan.validUntil} 까지(갱신 준비 ${plan.noticeOn} 부터)`
  return finish(rule, c, checks, rec, oneLine, timing, next, h.validUntil || !rule.validYears ? [] : ['유효기간'], 'very_high')
}

/* ------------------------------------------------------------------ */
/* 이노비즈                                                               */
/* ------------------------------------------------------------------ */

function techSignals(c: CertificationClientContext) {
  const lab = c.researchUnit === 'lab' || c.researchUnit === 'dept'
  const patents = (c.patents ?? 0) > 0
  const rnd = rndPositive(c) === true || c.rndPlan === true
  return { lab, patents, rnd, count: [lab, patents, rnd].filter(Boolean).length }
}

export function assessInnobiz(c: CertificationClientContext): CertificationAssessment {
  const rule = CERT_RULES.innobiz
  if (liveHeld(c, 'innobiz')) return heldAssessment(rule, c)
  const t = techSignals(c)
  const checks: Check[] = [smeCheck(c), yearsCheck(c, 3), exclusionCheck(c)]
  // AX: 이노비즈는 제조 · 건설 · 농업 · 비제조업 · SW · 바이오 · 환경 · 전문디자인 8가지 평가표 — 도소매 · 서비스도 '비제조업' 으로 신청 가능.
  //     떨어뜨리는 것은 별표2 제외 업종(KSIC 코드 확인)뿐. KSIC 가 없으면 '세부 업종 확인 필요'(준비도에 넣지 않음).
  checks.push(innobizIndustry(c.ksic, c.industryGroup, c.industryText))
  checks.push(c.researchUnit === null ? { weight: 'core', state: 'unknown', text: '연구조직(연구소 · 전담부서) — 확인 필요' } : t.lab ? { weight: 'core', state: 'ok', text: c.researchUnit === 'lab' ? '기업부설연구소 보유' : '연구개발전담부서 보유' } : { weight: 'core', state: 'warn', text: '연구조직 없음 — 연구소 · 전담부서가 있으면 크게 유리' })
  checks.push(c.patents === null ? { weight: 'core', state: 'unknown', text: '특허 · 지식재산 — 확인 필요' } : c.patents > 0 ? { weight: 'core', state: 'ok', text: `특허 ${c.patents}건 보유` } : { weight: 'core', state: 'warn', text: '특허 없음 — 기술 성과 증빙 보강 필요' })
  checks.push(rndPositive(c) === null && c.rndPlan === null ? { weight: 'core', state: 'unknown', text: '연구개발 활동 · 비용 — 확인 필요' } : t.rnd ? { weight: 'core', state: 'ok', text: rndPositive(c) ? `연구개발비 ${rndText(c)}` : '연구개발 계획 있음' } : { weight: 'core', state: 'warn', text: '연구개발 활동 기록이 약함' })
  checks.push(c.revenue === null ? { weight: 'core', state: 'unknown', text: '매출 · 재무 — 재무제표 필요' } : c.operatingProfit !== null && c.operatingProfit < 0 ? { weight: 'core', state: 'warn', text: '영업손실 — 재무 지표 보강 필요' } : { weight: 'core', state: 'ok', text: `매출 ${won(c.revenue)}` })

  // FV: 기술 근거 3가지(연구조직 · 특허 · 연구개발)가 없으면 '낮음', 하나뿐이면 '보통' 까지만
  const techKnown = c.researchUnit !== null && c.patents !== null && (rndPositive(c) !== null || c.rndPlan !== null)
  const rawReadiness = readinessOf(checks)
  const readiness = techKnown && t.count === 0 ? capReadiness(rawReadiness, 'low') : t.count === 1 ? capReadiness(rawReadiness, 'medium') : rawReadiness
  const missingFacts = factsOf(checks)
  const tooEarly = c.years !== null && c.years < 3
  const mustNo = checks.some((x) => x.weight === 'must' && x.state === 'no')
  let rec: Recommendation
  let oneLine: string
  let timing: string
  let next: NextAction
  if (tooEarly) {
    const on = yearsReachedOn(c, 3)
    rec = 'too_early'
    oneLine = `업력 3년 이상부터 신청 가능${on ? ` — ${on} 부터` : ''}`
    timing = t.lab ? '그 사이 연구소 · 특허를 쌓아 두면 바로 신청' : '먼저 연구소 · 벤처로 기반을 만들고 3년 차에'
    next = { label: '업력 되는 날 알림', kind: 'wait' }
  } else if (mustNo) {
    rec = 'not_needed'
    oneLine = checks.find((x) => x.weight === 'must' && x.state === 'no')!.text
    timing = '제외 사유 해소 전에는 신청 불가'
    next = { label: '제외 사유 확인', kind: 'confirm_facts' }
  } else if (readiness === 'unknown') {
    rec = 'need_info'
    oneLine = `${missingFacts.slice(0, 2).join(', ')} 확인이 먼저 필요`
    timing = '정보를 채우면 바로 다시 판정'
    next = { label: '모자란 정보 채우기', kind: 'confirm_facts' }
  } else if (t.count === 0 && techKnown) {
    // FV: 이노비즈는 기술혁신 평가(기술혁신능력 · 성과) — 연구조직 · 특허 · 연구개발이 하나도 없으면 업력 · 업종만으로 추천하지 않는다
    rec = 'low_priority'
    oneLine = '연구조직 · 특허 · 연구개발이 아직 없어 이노비즈는 나중에 — 메인비즈가 더 맞을 수 있음'
    timing = '기술 기반(연구조직 · 특허 · 연구개발)이 생기면 다시 검토'
    next = { label: '메인비즈 살펴보기', kind: 'self_check' }
  } else if (readiness === 'very_high' || readiness === 'high') {
    rec = 'now'
    oneLine = `업력 요건 충족${t.lab ? ' · 연구조직 보유' : ''}${t.patents ? ' · 특허 보유' : ''} — 사전진단부터`
    timing = c.policyFundPlan ? '정책자금 신청 전에 준비 추천' : '지금 진행 추천'
    next = { label: '사전진단 시작', kind: 'self_check' }
  } else if (readiness === 'medium') {
    rec = 'possible'
    oneLine = `진행 가능 · ${checks.filter((x) => x.state === 'warn').map((x) => x.text.split(' — ')[0]).slice(0, 2).join(' · ') || '증빙'} 보강 권장`
    timing = '3개월 안에 증빙을 갖추고 검토'
    next = { label: '사전진단 시작', kind: 'self_check' }
  } else {
    rec = 'after_fix'
    oneLine = '연구조직 · 특허 · R&D 기록을 먼저 보강'
    timing = t.lab ? '특허 · 연구 기록 보강 후' : '연구소(또는 전담부서) 먼저 추천'
    next = { label: '보강할 것 보기', kind: 'collect_docs' }
  }
  return finish(rule, c, checks, rec, oneLine, timing, next, missingFacts, readiness)
}

/* ------------------------------------------------------------------ */
/* 메인비즈                                                               */
/* ------------------------------------------------------------------ */

export function assessMainbiz(c: CertificationClientContext, innobiz?: CertificationAssessment): CertificationAssessment {
  const rule = CERT_RULES.mainbiz
  if (liveHeld(c, 'mainbiz')) return heldAssessment(rule, c)
  const checks: Check[] = [smeCheck(c), yearsCheck(c, 3), exclusionCheck(c)]
  // AX: 낱말로 떨어뜨리지 않는다 — 제외는 KSIC 코드가 확인될 때만, 낱말은 '세부 업종 확인 필요' 신호
  checks.push(mainbizIndustry(c.ksic, c.industryText))
  if (c.totalAssets !== null && c.totalLiabilities !== null) {
    const equity = c.totalAssets - c.totalLiabilities
    if (equity <= 0) checks.push({ weight: 'must', state: 'no', text: '완전자본잠식 — 신청 제외' })
    else {
      const debt = c.totalLiabilities / equity
      checks.push(debt >= 10 ? { weight: 'must', state: 'no', text: `부채비율 ${Math.round(debt * 100)}% — 1,000% 이상은 제외` } : { weight: 'core', state: debt <= 2 ? 'ok' : 'warn', text: `부채비율 ${Math.round(debt * 100)}%` })
    }
  } else checks.push({ weight: 'core', state: 'unknown', text: '부채비율 · 자본잠식 — 재무제표 필요' })
  checks.push(c.operatingProfit === null ? { weight: 'core', state: 'unknown', text: '영업이익 — 재무제표 필요' } : c.operatingProfit > 0 ? { weight: 'core', state: 'ok', text: `영업이익 ${won(c.operatingProfit)}` } : { weight: 'core', state: 'warn', text: '영업손실 — 경영 성과 보강 필요' })
  checks.push(c.employees === null ? { weight: 'core', state: 'unknown', text: '직원 수 — 확인 필요' } : c.employees >= 5 ? { weight: 'core', state: 'ok', text: `직원 ${c.employees}명 — 조직 · 인사 체계 평가 가능` } : { weight: 'core', state: 'warn', text: `직원 ${c.employees}명 — 조직 · 인사 체계 증빙이 약할 수 있음` })
  const hr = c.evidence.find((e) => e.id === 'hr_rules')
  checks.push(hr?.have ? { weight: 'core', state: 'ok', text: '취업규칙 · 인사 기록 있음' } : { weight: 'core', state: 'warn', text: '취업규칙 · 인사 · 교육 기록 보강' })

  const readiness = readinessOf(checks)
  const missingFacts = factsOf(checks)
  const mustNo = checks.find((x) => x.weight === 'must' && x.state === 'no')
  const tooEarly = c.years !== null && c.years < 3
  const tech = techSignals(c)
  let rec: Recommendation
  let oneLine: string
  let timing: string
  let next: NextAction
  if (tooEarly) {
    const on = yearsReachedOn(c, 3)
    rec = 'too_early'
    oneLine = `업력 3년 이상부터${on ? ` — ${on} 부터` : ''}`
    timing = '그 사이 사업계획 · 성과 관리 기록을 쌓아 두기'
    next = { label: '업력 되는 날 알림', kind: 'wait' }
  } else if (mustNo) {
    rec = 'not_needed'
    oneLine = mustNo.text
    timing = '제외 사유 해소 전에는 신청 불가'
    next = { label: '제외 사유 확인', kind: 'confirm_facts' }
  } else if (readiness === 'unknown') {
    rec = 'need_info'
    oneLine = `${missingFacts.slice(0, 2).join(', ')} 확인이 먼저 필요`
    timing = '재무제표 · 직원 수를 채우면 바로 다시 판정'
    next = { label: '모자란 정보 채우기', kind: 'confirm_facts' }
  } else if (innobiz && (innobiz.recommendation === 'now' || innobiz.recommendation === 'held') && tech.count >= 2) {
    rec = 'low_priority'
    oneLine = '진행 가능하나 기술 기반이 강해 이노비즈가 먼저'
    timing = '이노비즈 뒤에 필요하면'
    next = { label: '살펴보기', kind: 'self_check' }
  } else if (readiness === 'very_high' || readiness === 'high') {
    rec = 'now'
    oneLine = '업력 · 재무 요건 충족 — 경영 혁신 증빙만 갖추면 진행'
    timing = c.policyFundPlan || c.procurement ? '정책자금 · 조달 전에 준비 추천' : '지금 진행 추천'
    next = { label: '사전진단 시작', kind: 'self_check' }
  } else if (readiness === 'medium') {
    rec = 'possible'
    oneLine = '진행 가능 · 경영 기록(계획 · 성과 · 인사) 보강 권장'
    timing = '3개월 안에 검토'
    next = { label: '사전진단 시작', kind: 'self_check' }
  } else {
    rec = 'after_fix'
    oneLine = '재무 · 조직 기록을 먼저 보강'
    timing = '재무 개선 · 기록 정비 후'
    next = { label: '보강할 것 보기', kind: 'collect_docs' }
  }
  return finish(rule, c, checks, rec, oneLine, timing, next, missingFacts, readiness)
}

/* ------------------------------------------------------------------ */
/* 벤처 · 연구소 — 기존 화면(특허+벤처 · 연구소 관리)으로 이어 준다                */
/* ------------------------------------------------------------------ */

export function assessVenture(c: CertificationClientContext): CertificationAssessment {
  const rule = CERT_RULES.venture
  if (liveHeld(c, 'venture')) return heldAssessment(rule, c)
  const lab = c.researchUnit === 'lab' || c.researchUnit === 'dept'
  const checks: Check[] = []
  checks.push(c.researchUnit === null ? { weight: 'core', state: 'unknown', text: '연구조직 — 확인 필요' } : lab ? { weight: 'core', state: 'ok', text: '연구조직 보유 — 연구개발유형 가능성' } : { weight: 'core', state: 'warn', text: '연구조직 없음 — 연구개발유형은 연구소 · 전담부서 필요' })
  // AX: 공식 판단(5천만원 이상 · 매출 대비 비율)은 정확한 금액으로만 — 고른 범위는 '정확한 연구개발비 확인 필요'
  const min = won(VENTURE_RND.minExpenseWon)
  if (c.rndExpense !== null) checks.push(c.rndExpense >= VENTURE_RND.minExpenseWon ? { weight: 'core', state: 'ok', text: `연구개발비 ${won(c.rndExpense)}(${min} 이상)` } : { weight: 'core', state: 'warn', text: `연구개발비 ${won(c.rndExpense)} — ${min} 미만` })
  else if (c.rndRange === 'none' || c.rndRange === 'under_50m') checks.push({ weight: 'core', state: 'warn', text: `연구개발비 ${rndText(c)} — ${min} 미만이면 연구개발유형 기준 미달` })
  else if (rndNeedsExact(c)) checks.push({ weight: 'core', state: 'unknown', text: `정확한 연구개발비 확인 필요 — 고른 범위(${RND_RANGE_LABEL[c.rndRange!]})로는 공식 판단 불가(${min} 이상 · 매출 대비 비율)` })
  else checks.push({ weight: 'core', state: 'unknown', text: `연구개발비 — ${min} 이상인지 확인 필요` })
  const young = c.years !== null && c.years < 3
  if (young) checks.push({ weight: 'core', state: 'ok', text: '창업 3년 미만 — 매출 대비 비율 미적용(법 제2조의2 단서 · 5천만원 이상은 그대로)' })
  else if (c.rndExpense !== null && c.revenue !== null && c.revenue > 0) {
    const r = c.rndExpense / c.revenue
    const pct = (x: number) => `${Math.round(x * 1000) / 10}%`
    // 확인요령 별표1 — 세부 업종(KSIC) · 매출 구간별 비율. 세부 업종을 모르면 비율을 고르지 않는다
    const need = ventureRndRatio(c.ksic, c.revenue)
    if (!need) checks.push({ weight: 'core', state: 'unknown', text: `세부 업종 확인 필요 — 매출 대비 연구개발비 ${pct(r)} · 기준 비율은 세부 업종(KSIC)과 매출 구간으로 정해짐(5~10%)` })
    else checks.push(r >= need.ratio ? { weight: 'core', state: 'ok', text: `매출 대비 연구개발비 ${pct(r)}(기준 ${pct(need.ratio)} 이상 · 별표1 '${need.row}')` } : { weight: 'core', state: 'warn', text: `매출 대비 연구개발비 ${pct(r)} — 기준 ${pct(need.ratio)} 미만(별표1 '${need.row}')` })
  }
  checks.push(c.patents === null ? { weight: 'core', state: 'unknown', text: '특허 — 확인 필요' } : c.patents > 0 ? { weight: 'core', state: 'ok', text: `특허 ${c.patents}건 — 혁신성 증빙` } : { weight: 'core', state: 'warn', text: '특허 없음 — 혁신성장유형은 사업계획 · 기술성으로 평가' })
  const readiness = readinessOf(checks)
  const missingFacts = factsOf(checks)
  const rndType = lab && (c.rndExpense ?? 0) >= VENTURE_RND.minExpenseWon
  const rndMaybe = lab && rndNeedsExact(c)
  let rec: Recommendation
  let oneLine: string
  let timing: string
  if (readiness === 'unknown') {
    rec = 'need_info'
    oneLine = `${missingFacts.slice(0, 2).join(', ')} 확인이 먼저 필요`
    timing = '정보를 채우면 유형을 골라 드립니다'
  } else if (rndType) {
    rec = 'now'
    oneLine = '연구개발유형 요건에 가까움 — 연구소 · 연구개발비 증빙으로'
    timing = c.policyFundPlan ? '정책자금 신청 전에 준비 추천' : '지금 진행 추천'
  } else if (rndMaybe) {
    rec = 'possible'
    oneLine = '연구개발유형 가능성 — 정확한 연구개발비 확인 필요'
    timing = '재무제표로 정확한 연구개발비를 확인한 뒤'
  } else if ((c.patents ?? 0) > 0 || c.rndPlan) {
    rec = 'possible'
    oneLine = '혁신성장유형 검토 추천 — 기술성 · 성장성 평가'
    timing = '사업계획서를 갖추고 검토'
  } else if (!lab && c.rndPlan === false && rndPositive(c) !== true) {
    // FV: 연구개발 계획도 특허도 없으면 연구소를 만들라고 밀지 않는다
    rec = 'low_priority'
    oneLine = '연구개발 · 특허 · 혁신 제품 계획이 생기면 검토 — 지금은 우선순위 낮음'
    timing = '기술 · 혁신 계획이 생기면'
  } else if (!lab) {
    rec = 'after_fix'
    oneLine = '연구소(또는 전담부서)를 먼저 — 연구개발유형 길이 열림'
    timing = '연구소 먼저 추천'
  } else {
    rec = 'possible'
    oneLine = '연구개발비를 쌓으면 연구개발유형 가능'
    timing = '연구개발비 5천만원 이상 쌓인 뒤'
  }
  // 혁신성장유형은 확인기관 평가로 정해진다 — 요건형(연구개발유형)이 아니면 '매우 높음' 까지는 말하지 않는다
  const shown: Readiness = rec === 'low_priority' ? capReadiness(readiness, 'low') : rec !== 'now' && readiness === 'very_high' ? 'high' : readiness
  return finish(rule, c, checks, rec, oneLine, timing, { label: '벤처 화면 열기', kind: 'open_tool' }, missingFacts, shown)
}

/** 연구전담요원 기준 — 규모 · 업력 · 벤처 여부 */
export function labResearchersNeeded(c: CertificationClientContext): number | null {
  if (c.held.some((h) => h.key === 'venture')) return LAB_RESEARCHERS.venture
  if (c.size === 'small' || (c.size === null && c.employees !== null && c.employees < 50)) return c.months !== null && c.months < 36 ? LAB_RESEARCHERS.smallStartup : LAB_RESEARCHERS.small
  if (c.size === 'medium') return LAB_RESEARCHERS.medium
  if (c.size === 'mid_large') return LAB_RESEARCHERS.midLarge
  if (c.size === 'large') return LAB_RESEARCHERS.large
  return null
}

export function assessLab(c: CertificationClientContext): CertificationAssessment {
  const rule = CERT_RULES.lab
  if (c.researchUnit === 'lab' || heldOf(c, 'lab')) {
    const held = heldOf(c, 'lab') ?? { key: 'lab' as const, validUntil: '', note: '' }
    return heldAssessment(rule, { ...c, held: [...c.held.filter((h) => h.key !== 'lab'), held] })
  }
  const need = labResearchersNeeded(c)
  const checks: Check[] = []
  if (c.researchers === null) checks.push({ weight: 'must', state: 'unknown', text: `연구전담요원 수 — 확인 필요${need ? `(${need}명 이상)` : ''}` })
  else if (need !== null && c.researchers >= need) checks.push({ weight: 'must', state: 'ok', text: `연구전담요원 ${c.researchers}명(기준 ${need}명 이상)` })
  else if (c.researchers >= LAB_RESEARCHERS.dept) checks.push({ weight: 'core', state: 'warn', text: `연구전담요원 ${c.researchers}명 — 연구소 기준(${need ?? '?'}명) 미만, 전담부서는 가능` })
  else checks.push({ weight: 'must', state: 'no', text: '연구전담요원 없음 — 최소 1명(전담부서)' })
  checks.push({ weight: 'core', state: 'unknown', text: '독립된 연구공간 — 현장 확인 필요' })
  checks.push(rndPositive(c) === true ? { weight: 'core', state: 'ok', text: '연구개발 활동 · 비용 있음' } : c.rndPlan ? { weight: 'core', state: 'ok', text: '연구개발 계획 있음' } : { weight: 'core', state: 'unknown', text: '연구개발 활동 — 확인 필요' })
  const readiness = readinessOf(checks)
  const missingFacts = factsOf(checks)
  const deptOnly = c.researchers !== null && need !== null && c.researchers < need && c.researchers >= 1
  // FV: 연구 인력도 연구개발 계획도 없으면 '보완 후 추천' 이 아니라 '지금은 필요 없음'(연구소를 위해 연구소를 만들지 않는다)
  const noRnd = c.researchers === 0 && c.rndPlan === false && rndPositive(c) !== true
  const rec: Recommendation = c.researchUnit === 'dept' ? 'possible' : noRnd ? 'not_needed' : readiness === 'very_low' ? 'after_fix' : deptOnly ? 'possible' : readiness === 'unknown' ? 'need_info' : 'now'
  const oneLine =
    c.researchUnit === 'dept' ? '전담부서 보유 — 인원이 늘면 연구소로 전환 검토' : noRnd ? '연구개발 계획이 생기면 검토 — 지금은 필요 없음' : deptOnly ? '연구개발전담부서부터 — 인원이 늘면 연구소로' : rec === 'need_info' ? '연구 인력 · 공간 조건 확인 필요' : rec === 'after_fix' ? '연구 인력을 먼저 갖춰야 함' : '연구 인력 조건 충족 — 공간 · 서류 준비'
  return finish(rule, c, checks, rec, oneLine, rec === 'now' ? '지금 진행 추천 — 벤처 · 이노비즈의 바탕' : rec === 'not_needed' ? '연구개발을 시작할 때' : '인력 · 공간을 갖춘 뒤', { label: '연구소 화면 열기', kind: 'open_tool' }, missingFacts, readiness)
}

/* ------------------------------------------------------------------ */
/* 전부                                                                   */
/* ------------------------------------------------------------------ */


export function assessAll(c: CertificationClientContext): CertificationAssessment[] {
  const innobiz = withExpired(assessInnobiz(c), c)
  return [assessLab(c), withExpired(assessVenture(c), c), innobiz, withExpired(assessMainbiz(c, innobiz), c), ...assessIso(c)]
}
