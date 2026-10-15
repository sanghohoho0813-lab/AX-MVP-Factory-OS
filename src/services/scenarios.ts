/**
 * 상황 예시로 바로 설계 (D-199 · 로드맵 5단계) — 업체 기록 + 상황 가정 → 모듈 엔진 그대로 → 결과 한 장.
 *
 *  - 가정은 scenarioPresets.ts(모듈 화면도 `?preset=` 로 같은 가정을 읽는다). 계산은 모듈 화면과 같은 엔진
 *    (절세 설계 taxPlan · 채용 진단 diagnoseHiring · 연구개발비 세액공제 getTaxCreditEstimate · 창업감면 judge · 정책자금 runDiagnosis).
 *  - 업체 숫자는 업체 기록에서 — 절세 현황이 비어 있으면 회사 정보(자산 · 순이익 · 설립일 · 대표 생년월일)로 채운다(절세 설계 '채우기' 와 같은 값).
 *  - 이 상황에 필요한 숫자마다 ✓(있음 · 값) / ✗(없음) — 빠진 것은 대표님께 보낼 요청 문구로(같은 자료는 하나로).
 *  - 모르는 것은 짐작하지 않는다 — 꼭 필요한 값이 없으면 결과 대신 '이것을 받으면 바로 계산' 만 말한다.
 *  - 규칙 계산이다(AI · LLM 호출 없음). 저장하지 않고 볼 때마다 계산한다.
 */
import type { ClientOpsRecord } from '../types/clientOps'
import { clientFacts, type ClientFacts } from '../tools/shared/clientPrefill'
import { formatWon } from './customerFacts'
import { manwonText, startupRegion } from './clientInsights'
import { requestItemFor, requestMessage, type RequestItem } from './recoRequest'
import { SCENARIO_MODULE_LABEL, SCENARIO_PRESETS, scenarioPath, type ScenarioModule, type ScenarioPreset } from './scenarioPresets'
import {
  GOAL_LABEL,
  cashPlan,
  giftPlan,
  goalNeeds,
  inheritancePlan,
  loanPlan,
  parseGoalText,
  profileSuggestions,
  retirePlan,
  salaryPlan,
  shareValueOf,
  splitPlan,
  viewProfile,
  type GoalKey,
  type TaxProfile,
} from './taxPlan'
import { diagnoseHiring, type HiringAnswers } from '../tools/employment/lib/eligibility'
import { DEFAULT_PROGRAMS } from '../tools/employment/lib/programs'
import { getTaxCreditEstimate } from '../tools/labcare/lib/taxCredit'
import type { Client as LabClient } from '../tools/labcare/types'
import { judge } from '../tools/startupTax/lib/judgement'
import { EMPTY_FORM } from '../tools/startupTax/lib/formDefaults'
import type { FormData as StartupForm } from '../tools/startupTax/types'
import { runDiagnosis } from '../tools/policyFunding/diagnosis'
import { policyInputFromFacts } from '../tools/policyFunding/clientInput'
import { fitContext, scenarioFit, type FitContext, type FitKind, type ScenarioFit } from './scenarioFit'

export interface ScenarioNeed {
  /** 화면에 쓰는 이름 */
  label: string
  ok: boolean
  /** 있으면 그 값(사람이 읽는 모양) */
  value: string
}

export type ScenarioState = 'ready' | 'partial' | 'need'

export const SCENARIO_STATE_LABEL: Record<ScenarioState, string> = {
  ready: '바로 설계됨',
  partial: '설계됨 · 더 정확히',
  need: '받으면 바로 설계',
}

export interface ScenarioRun {
  id: string
  module: ScenarioModule
  moduleLabel: string
  title: string
  when: string
  /** ready: 필요한 숫자가 다 있다 · partial: 결과는 나왔지만 빠진 것을 받으면 더 정확 · need: 결과 대신 받을 것 */
  state: ScenarioState
  /** 결과 한 줄(need 면 무엇을 받으면 되는지) */
  headline: string
  /** 설계 몇 줄 */
  lines: string[]
  /** 엔진이 계산한 금액만(없으면 '') */
  amount: string
  needs: ScenarioNeed[]
  /** 업체 기록에서 저절로 채운 값(절세 현황이 비어 있어 회사 정보로) */
  filledFrom: string[]
  /** 계산에 둔 가정(★ 확인 필요 포함) */
  assumptions: string[]
  /** 모듈 화면 — 같은 가정 · 같은 업체로 열린다 */
  openPath: string
  /** 대표님께 보낼 요청 문구(빠진 것만 · 없으면 '') */
  request: string
  /** D-201: 이 업체에 맞는 상황인가 — 맞음(근거) · 물어볼 것 · 받을 자료 · 안 맞음(까닭) */
  fit: ScenarioFit
}

const krw = (n: number) => (Number.isFinite(n) ? formatWon(n) : '-')

function need(label: string, value: string | null | undefined): ScenarioNeed {
  const v = (value ?? '').trim()
  return { label, ok: v !== '', value: v }
}

/* ------------------------------------------------------------------ */
/* 절세                                                                  */
/* ------------------------------------------------------------------ */

/** 목표마다 이것이 없으면 결과를 내지 않는 값(goalNeeds 의 key) — 나머지는 '더 정확히' */
const TAX_CORE: Partial<Record<GoalKey, string[]>> = {
  cash: ['holders', 'retainedEarnings'],
  gift: ['holders', 'value', 'kid'],
  inherit: ['estateRealEstate', 'children'],
  loan: ['loanBalance'],
  retire: ['ceoStartDate', 'monthlySalary'],
}

/** 절세 현황 — 비어 있는 칸은 회사 정보로(절세 설계 '채우기' 와 같은 값) */
export function scenarioTaxProfile(record: ClientOpsRecord, today: string): { profile: TaxProfile; filledFrom: string[] } {
  const base: TaxProfile = Object.fromEntries(Object.entries(record.taxProfile ?? {}).filter(([, v]) => typeof v === 'string' && v.trim() !== ''))
  const sug = profileSuggestions(record, base, today)
  const profile: TaxProfile = { ...base }
  for (const s of sug) profile[s.key] = s.value
  return { profile, filledFrom: sug.map((s) => s.from) }
}

function runTax(s: ScenarioPreset, record: ClientOpsRecord, today: string): Omit<ScenarioRun, 'id' | 'module' | 'moduleLabel' | 'title' | 'when' | 'openPath' | 'request' | 'fit'> {
  const { profile, filledFrom } = scenarioTaxProfile(record, today)
  const reg = record.shareholderRegister ?? []
  const p = viewProfile(profile)
  const sv = shareValueOf(p, reg)
  const g = parseGoalText(s.taxText ?? '')
  const kid = reg.find((r) => r.relation === 'child' || r.relation === 'minor_child') ?? null
  const lines: string[] = []
  const okGoals: GoalKey[] = []
  const verify: string[] = []
  let amount = ''
  // 상황의 요점 — 자사주는 '팔기 vs 소각', 나눠 가져오기는 '몇 년에 나누면 얼마 덜 냄'(같은 1억 결과를 두 번 보이지 않게)
  let point = ''
  const order: GoalKey[] = ['cash', 'salary', 'gift', 'inherit', 'loan', 'retire']
  const goals = order.filter((k) => g.goals.includes(k))
  const loanP = g.loan ? { ...p, loanBalance: g.loan } : p
  for (const goal of goals) {
    if (goal === 'cash' && g.cash) {
      const cash = cashPlan(p, reg, sv, g.cash, today)
      if (cash.best) {
        okGoals.push(goal)
        lines.push(`세후 ${krw(cash.target)} — 추천 ${cash.best.label} · 순부담 ${krw(cash.best.netBurden)}`)
        amount = amount || `순부담 ${krw(cash.best.netBurden)}`
        if (cash.best.verify.length > 0) verify.push(`${cash.best.label}: ${cash.best.verify[0]}`)
        const compared = []
        for (const key of s.taxCompare ?? []) {
          const r = cash.routes.find((x) => x.key === key)
          if (!r) continue
          lines.push(`${r === cash.best ? '[추천] ' : ''}${r.label} — ${r.ok ? `순부담 ${krw(r.netBurden)}` : `안 됨: ${r.reason}`}`)
          if (r.ok) compared.push(r)
        }
        if (compared.length >= 2) {
          const [lo, hi] = [...compared].sort((a, b) => a.netBurden - b.netBurden)
          const gap = hi.netBurden - lo.netBurden
          point = `${compared.map((r) => `${r.label.replace(/\(.*?\)/g, '').trim()} ${krw(r.netBurden)}`).join(' vs ')} — ${lo.label.replace(/\(.*?\)/g, '').trim()}가 ${krw(gap)} 덜 냄`
          amount = `차이 ${krw(gap)}`
        }
        if (s.taxSplit) {
          const split = splitPlan(p, reg, sv, g.cash, today)
          if (split.best && split.best.years > 1 && split.saving > 0) {
            lines.push(`★ ${split.best.years}년에 나누면 ${krw(split.saving)} 덜 냄`)
            point = `세후 ${krw(cash.target)} — ${split.best.years}년에 나눠 가져오면 한 번에보다 ${krw(split.saving)} 덜 냄`
            amount = `${krw(split.saving)} 덜 냄`
          } else if (split.best) lines.push('나눠도 한 번에 가져오는 것보다 덜 내지 않음')
        }
      } else lines.push(`세후 ${krw(g.cash)} — 되는 방법이 아직 없음(주주명부 · 주식가치 · 배당 가능한 이익 필요)`)
    }
    if (goal === 'salary') {
      const sal = salaryPlan(p, g.salary ?? { mode: 'min' })
      if (sal.ok) {
        okGoals.push(goal)
        lines.push(`${sal.message}: 월 ${krw(sal.monthly)}${sal.r ? ` · 실효부담률 ${(sal.r.effRate * 100).toFixed(1)}% · 세후 월 ${krw(sal.r.afterTax / 12)}` : ''}`)
        amount = amount || `월 급여 ${krw(sal.monthly)}`
      } else lines.push(sal.message)
    }
    if (goal === 'gift') {
      const gm = g.gift ?? { mode: 'pct' as const, amount: 10 }
      const gift = giftPlan(p, reg, sv, { recipientId: kid?.id ?? '', mode: gm.mode, amount: gm.amount })
      if (gift.ok) {
        okGoals.push(goal)
        lines.push(`${gift.recipient}에게 — 증여세 ${krw(gift.tax)} · 대표 지분 ${gift.ceoAfterPct.toFixed(1)}%`)
        if (gift.succession && gift.succession.state !== 'no') lines.push(`★ 가업승계 과세특례면 증여세 ${krw(gift.succession.total)}${gift.succession.state === 'unknown' ? '(요건 확인 필요)' : ''}`)
        amount = amount || `증여세 ${krw(gift.tax)}`
      } else lines.push(gift.message || '증여받을 자녀 · 주주명부가 필요해요')
    }
    if (goal === 'inherit') {
      const inh = inheritancePlan(p, reg, sv, null)
      if (inh.ok) {
        okGoals.push(goal)
        lines.push(`지금 상속되면 상속세 ${krw(inh.taxNow)}${inh.familyBiz ? ` · ★ 가업상속공제면 ${krw(inh.familyBiz.tax)}` : ''}`)
        amount = amount || `상속세 ${krw(inh.taxNow)}`
      } else lines.push(inh.message || '대표 재산 · 자녀 수가 필요해요')
    }
    if (goal === 'loan') {
      const loan = loanPlan(loanP)
      if (loan.ok) {
        okGoals.push(goal)
        lines.push(`가지급금 — 해마다 ${krw(loan.yearLoss)} · 10년 ${krw(loan.tenYear)} 손해`)
        amount = amount || `해마다 ${krw(loan.yearLoss)} 손해`
      } else lines.push('가지급금 잔액을 알면 해마다 손해를 계산해요')
    }
    if (goal === 'retire') {
      const ret = retirePlan(p, today)
      if (ret.ok) {
        okGoals.push(goal)
        lines.push(`퇴직금 한도 ${krw(ret.limit)} · 세금 ${krw(ret.tax)} · 세후 ${krw(ret.net)}`)
        amount = amount || `세후 ${krw(ret.net)}`
      } else lines.push(ret.message || '대표 취임일 · 급여가 필요해요')
    }
  }
  // 이 상황에 필요한 숫자 — 절세 설계 화면의 빨간 안내와 같은 목록 + 있는 값
  const missing = new Map<string, string>()
  for (const goal of goals) for (const n of goalNeeds(goal, loanP, reg, sv, profile, goal === 'gift' ? kid : null)) missing.set(n.key, n.label)
  const have: ScenarioNeed[] = []
  const shown = (label: string, value: string) => have.push({ label, ok: true, value })
  const ceo = reg.find((r) => r.relation === 'ceo')
  if (goals.some((x) => x === 'cash' || x === 'gift')) {
    if (ceo && ceo.shares > 0) shown('주주명부(대표 주식 수)', `${ceo.shares.toLocaleString('ko-KR')}주`)
    if (sv.perShare > 0) shown('주식가치', `1주 ${krw(sv.perShare)}`)
  }
  if (goals.some((x) => x === 'cash' || x === 'salary' || x === 'loan' || x === 'retire') && p.monthlySalary > 0) shown('대표 월 급여', krw(p.monthlySalary))
  if (goals.includes('retire') && p.ceoStartDate) shown('대표 취임일', p.ceoStartDate)
  if (goals.includes('gift') && kid) shown('증여받을 자녀', kid.name)
  if (goals.includes('gift') && !kid) missing.set('kid', '주주명부에 자녀(증여받을 사람)')
  const needs = [...have, ...[...missing.values()].map((label) => ({ label, ok: false, value: '' }))]
  const allOk = goals.length > 0 && okGoals.length === goals.length
  // 핵심 값이 없으면 결과를 내지 않는다 — 주주명부 · 배당 가능한 이익 없이 '급여 40% + 배당 60%' 같은 답은 믿을 수 없다
  const coreMissing = goals.some((goal) => (TAX_CORE[goal] ?? []).some((k) => missing.has(k)))
  const state: ScenarioState = coreMissing || !allOk ? (okGoals.length > 0 && !coreMissing ? 'partial' : 'need') : missing.size > 0 ? 'partial' : 'ready'
  const headline = state === 'need' ? `${[...missing.values()].slice(0, 3).join(' · ')}을(를) 받으면 바로 설계해요` : point || (lines[0] ?? GOAL_LABEL[goals[0]])
  return {
    state,
    headline,
    lines: state === 'need' ? [] : lines,
    amount: state === 'need' ? '' : amount,
    needs,
    filledFrom,
    assumptions: ['세금 계산기 9종과 같은 식 · 참고용 — 실행 전 담당 세무사 검토', ...verify.map((v) => `★ ${v}`)],
  }
}

/* ------------------------------------------------------------------ */
/* 고용지원금 — 채용 진단                                                 */
/* ------------------------------------------------------------------ */

const CAPITAL = new Set(['서울', '경기', '인천'])

function regionOf(facts: ClientFacts): { region: HiringAnswers['region']; known: boolean } {
  const sido = facts.address.match(/^(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)/)?.[1] ?? ''
  if (!sido) return { region: '수도권', known: false }
  return { region: CAPITAL.has(sido) ? '수도권' : '비수도권', known: true }
}

function runHiring(s: ScenarioPreset, facts: ClientFacts): ReturnType<typeof runTax> {
  const h = s.hiring!
  const { region, known } = regionOf(facts)
  const answers: HiringAnswers = { ...h, milMonths: 0, region, companySize: facts.employeeCount, preApply: true, noLayoff: true, aboveFloor: true, youthEligible: true }
  const rows = diagnoseHiring(answers, Object.values(DEFAULT_PROGRAMS))
  const rec = rows.filter((r) => r.status === 'recommend')
  const maybe = rows.filter((r) => r.status === 'maybe')
  const needs = [need('직원 수', facts.employeeCount === null ? '' : `${facts.employeeCount}명`), need('회사 주소(수도권 여부)', known ? `${region}` : '')]
  const top = rec[0] ?? maybe[0] ?? null
  const lines = [...rec, ...maybe].slice(0, 3).map((r) => `${r.status === 'recommend' ? '가능성 높음' : '검토'} · ${r.program.name} — 1명 최대 ${manwonText(r.program.totalAmount) || '금액 공고 확인'}${r.cautions[0] ? ` (★ ${r.cautions[0]})` : ''}`)
  const missingCore = needs.filter((n) => !n.ok)
  const state: ScenarioState = !top ? 'partial' : missingCore.length > 0 ? 'partial' : 'ready'
  return {
    state,
    headline: top ? `${rec.length ? `가능성 높은 지원금 ${rec.length}가지` : `검토해 볼 지원금 ${maybe.length}가지`} — ${top.program.name}` : '이 상황에 맞는 지원금이 지금은 없어요',
    lines: top ? lines : [rows.find((r) => r.blockers.length)?.blockers[0] ?? '조건을 바꿔 채용 진단에서 다시 보세요'],
    amount: top && top.program.totalAmount > 0 ? `1명 최대 ${manwonText(top.program.totalAmount)}(1차 추정)` : '',
    needs,
    filledFrom: [],
    assumptions: [
      '채용 전에 참여신청 · 최근 감원 없음 · 최저임금 이상 — 맞다고 보고 계산(★ 확인)',
      ...(known ? [] : ['주소를 몰라 수도권으로 보고 계산']),
      ...(facts.employeeCount === null ? ['직원 수를 몰라 규모 조건(피보험자 5인 이상 등)은 확인 못 함'] : []),
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 연구소 — 연구개발비 세액공제                                            */
/* ------------------------------------------------------------------ */

function runLab(s: ScenarioPreset, facts: ClientFacts): ReturnType<typeof runTax> {
  const l = s.lab!
  const client: LabClient = {
    id: 'scenario',
    name: facts.companyName,
    industry: facts.industryText,
    labType: '기업부설연구소',
    ceoName: '',
    address: facts.address,
    certifiedDate: '',
    researcherCount: 0,
    labName: '',
    consultant: '',
    createdAt: '',
    businessType: facts.businessType === 'individual' ? '개인사업자' : '법인사업자',
    researchersPayrollTotal: l.payroll,
    rndMaterialCost: l.material,
    rndOtherCost: l.other,
    taxCreditCategory: l.category,
  }
  const est = getTaxCreditEstimate(client)
  const needs = [need('사업자 구분(법인 · 개인)', facts.businessType === 'corporation' ? '법인' : facts.businessType === 'individual' ? '개인' : '')]
  return {
    state: !est.available ? 'need' : needs.every((n) => n.ok) ? 'ready' : 'partial',
    headline: est.available ? `연구개발비 ${krw(est.totalRnd)} → ${est.taxType} 연간 약 ${manwonText(est.annual)} 공제(예상)` : est.warnings[0] ?? '연구개발비를 알면 계산해요',
    lines: est.available ? [`공제율 ${est.rate}%(${est.category}${est.sizeAssumed ? ' · ★ 중소기업으로 가정' : ''}) · 월 약 ${manwonText(est.monthly) || '0원'}`, '연구소(전담부서) 인정 · 구분경리 · 연구노트가 있어야 받을 수 있어요'] : [],
    amount: est.available ? `연간 약 ${manwonText(est.annual)}` : '',
    needs,
    filledFrom: [],
    assumptions: [...est.assumptions.slice(0, 2), '공제액은 그해 낼 세금을 넘을 수 없어요(★ 세무사 확인)'],
  }
}

/* ------------------------------------------------------------------ */
/* 창업감면                                                              */
/* ------------------------------------------------------------------ */

function startupFormOf(facts: ClientFacts, over: ScenarioPreset['startup']): StartupForm {
  const { region, over: oc } = startupRegion(facts.address)
  return {
    ...EMPTY_FORM,
    businessType: facts.businessType,
    birthDate: facts.representativeBirth,
    startupDate: facts.establishedAt,
    industry: (facts.industry || '') as StartupForm['industry'],
    region,
    overconcentration: oc,
    ...(over ?? {}),
  }
}

function runStartup(s: ScenarioPreset, facts: ClientFacts, today: string): ReturnType<typeof runTax> {
  const needs = [need('설립일(창업일)', facts.establishedAt), need('대표 생년월일', facts.representativeBirth), need('회사 주소(권역)', startupRegion(facts.address).region ? facts.address : ''), need('업종', facts.industry ? facts.industryText || facts.industry : '')]
  const core = needs.slice(0, 2).filter((n) => !n.ok)
  if (core.length) return { state: 'need', headline: `${core.map((n) => n.label).join(' · ')}을(를) 받으면 바로 판정해요`, lines: [], amount: '', needs, filledFrom: [], assumptions: [] }
  const date = new Date(`${today}T00:00:00`)
  const r = judge(startupFormOf(facts, s.startup), date)
  if (r.notice) return { state: 'partial', headline: r.notice, lines: [], amount: '', needs, filledFrom: [], assumptions: [] }
  const lines = [...r.keyReasons.slice(0, 2), ...r.alerts.slice(0, 1).map((a) => `★ ${a}`)]
  // 옮기면 — 지금 권역 결론과 나란히
  if (s.id === 'startup-move') {
    const now = judge(startupFormOf(facts, { startupForm: s.startup?.startupForm }), date)
    if (!now.notice) lines.unshift(`지금 권역: ${now.oneLineConclusion}`)
  }
  return {
    state: needs.every((n) => n.ok) ? 'ready' : 'partial',
    headline: r.oneLineConclusion,
    lines,
    amount: '',
    needs,
    filledFrom: [],
    assumptions: ['감면율 · 기간은 판정기 규칙 — 업종 · 권역 · 창업 형태에 따라 달라요(★ 세무사 확인)'],
  }
}

/* ------------------------------------------------------------------ */
/* 정책자금                                                              */
/* ------------------------------------------------------------------ */

function runPolicy(s: ScenarioPreset, facts: ClientFacts): ReturnType<typeof runTax> {
  const { input, missing } = policyInputFromFacts(facts)
  const needs = [
    need('업종', facts.industryText),
    need('설립일(업력)', facts.establishedAt),
    need('직원 수', facts.employeeCount === null ? '' : `${facts.employeeCount}명`),
    need('매출', facts.revenue && !facts.revenue.estimated ? krw(facts.revenue.won) : ''),
  ]
  const core = missing.filter((m) => m !== '매출')
  if (core.length) return { state: 'need', headline: `${core.join(' · ')}을(를) 받으면 바로 진단해요`, lines: [], amount: '', needs, filledFrom: [], assumptions: [] }
  const r = runDiagnosis({ ...input, ...(s.policy ?? {}) })
  const level = r.likelihoodLevel ?? r.headline?.level ?? '보통'
  return {
    state: needs.every((n) => n.ok) ? 'ready' : 'partial',
    headline: `진행 가능성 ${level} · 추천 기관 ${r.topAgency}`,
    lines: [...(r.headline?.reasons ?? []).slice(0, 2), r.nextAction].filter(Boolean),
    amount: '',
    needs,
    filledFrom: [],
    assumptions: ['신용 · 부채 · 체납은 모르면 문제없다고 보고 진단(★ 상담에서 확인)'],
  }
}

/* ------------------------------------------------------------------ */

/** 상황 하나 → 이 업체 숫자로 설계(맞는 상황인지도 함께 — D-201) */
export function runScenario(s: ScenarioPreset, record: ClientOpsRecord, today: string, ctx: FitContext = fitContext(record, today)): ScenarioRun {
  const facts = clientFacts(record, new Date(`${today}T00:00:00`))
  const f = facts.industryText ? facts : { ...facts, industryText: [record.businessCategory, record.businessItem].map((v) => (v ?? '').trim()).filter(Boolean).join(' ') }
  const body =
    s.module === 'tax' ? runTax(s, record, today) : s.module === 'employment' ? runHiring(s, f) : s.module === 'labcare' ? runLab(s, f) : s.module === 'startup-tax' ? runStartup(s, f, today) : runPolicy(s, f)
  const moduleLabel = SCENARIO_MODULE_LABEL[s.module]
  const items = body.needs.filter((n) => !n.ok).map((n) => requestItemFor(n.label, `${moduleLabel} · ${s.title}`)).filter((x): x is RequestItem => x !== null)
  return {
    id: s.id,
    module: s.module,
    moduleLabel,
    title: s.title,
    when: s.when,
    ...body,
    openPath: scenarioPath(s, record.id),
    request: items.length ? requestMessage(record, items) : '',
    fit: scenarioFit(s, ctx),
  }
}

const STATE_RANK: Record<ScenarioState, number> = { ready: 0, partial: 1, need: 2 }
/** D-201: 맞는 상황이 먼저 — 그다음 물어볼 것 · 받을 자료 · 안 맞는 것 */
const FIT_RANK: Record<FitKind, number> = { fit: 0, ask: 1, data: 2, no: 3 }

/**
 * 업체 하나 → 상황 예시 전부(모듈 순서 그대로 · 쓸 수 있는 모듈만). 한 상황이 실패해도 나머지는 보인다.
 * sortReady — 바로 설계된 것 먼저(같으면 카탈로그 순서)
 */
export function runScenarios(record: ClientOpsRecord, today: string, usable: (module: ScenarioModule) => boolean = () => true, sortReady = false): ScenarioRun[] {
  const out: ScenarioRun[] = []
  const ctx = fitContext(record, today)
  for (const s of SCENARIO_PRESETS) {
    if (!usable(s.module)) continue
    try {
      out.push(runScenario(s, record, today, ctx))
    } catch {
      // 한 모듈 엔진이 이 업체 값으로 실패해도 다른 상황은 보인다
    }
  }
  if (!sortReady) return out
  return out
    .map((x, i) => ({ x, i }))
    .sort((a, b) => FIT_RANK[a.x.fit.kind] - FIT_RANK[b.x.fit.kind] || STATE_RANK[a.x.state] - STATE_RANK[b.x.state] || a.i - b.i)
    .map((v) => v.x)
}

/** D-201: '판단할 자료' 요청 문구 — 자료를 받으면 맞는지 판단할 상황들(같은 자료는 하나로) */
export function fitDataRequest(record: ClientOpsRecord, runs: readonly ScenarioRun[]): string {
  const items = runs
    .filter((r) => r.fit.kind === 'data')
    .flatMap((r) => (r.fit.dataNeeds ?? []).map((n) => requestItemFor(n, r.moduleLabel)))
    .filter((x): x is RequestItem => x !== null)
  return items.length ? requestMessage(record, items) : ''
}

/** 여러 상황의 빠진 것을 한 장으로(같은 자료는 하나로) */
export function scenariosRequest(record: ClientOpsRecord, runs: readonly ScenarioRun[]): string {
  // 한 번에 보낼 때는 '무엇 확인용' 을 모듈 이름으로만(상황 제목을 다 늘어놓으면 고객이 읽기 어렵다)
  const items = runs.flatMap((r) => r.needs.filter((n) => !n.ok).map((n) => requestItemFor(n.label, r.moduleLabel))).filter((x): x is RequestItem => x !== null)
  return items.length ? requestMessage(record, items) : ''
}
