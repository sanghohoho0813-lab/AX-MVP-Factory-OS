/**
 * 상황별 한 장 설계서 (D-242 · 로드맵 7단계) — 상황 하나를 여러 모듈 엔진으로 한 장에.
 *
 * 대표 지시(고도화 목표 3): 계산기는 상황 예시로 — 한 번 누르면 그 업체 숫자로 설계까지.
 * 상황 예시(D-199)는 모듈 하나씩이었다. '청년 2명 채용' 은 고용지원금 · 세액공제 · 정책자금이 한꺼번에 걸리는데
 * 세 화면을 따로 열어 더해야 했다. 이제 한 장에:
 *   1. 받을 수 있는 돈(1차 추정) — 고용지원금 × 사람 수 + 세액공제(1년 차 · 유지하면 3년)
 *   2. 모듈별 근거 — 모듈 화면과 같은 엔진(채용 진단 diagnoseHiring · 명부 세액공제 estimateTaxCredit ·
 *      연구개발비 세액공제 getTaxCreditEstimate · 정책자금 runDiagnosis)
 *   3. 추천 행동 — 언제 무엇을 → 업체에 붙이면 할 일로(달력 · 오늘)
 *  - 맞는 상황인지는 상황 예시와 같은 기준(scenarioFit) — 안 맞으면 설계를 보여 주지 않는다.
 *  - 모르는 것은 짐작하지 않는다 — 가정은 ★ 로 적는다. 정책자금은 갚는 돈(대출)이라 합계에 넣지 않는다.
 *  - 규칙 계산이다(AI · LLM 호출 없음). 저장하지 않고 볼 때마다 계산한다 — 붙일 때만 업체 기록에 한 줄.
 *
 * D-244: '창업 5년 안 채용' — 창업감면(판정기 그대로) + 청년 채용(고용지원금 · 통합고용세액공제 · 정책자금)을 한 장에.
 *  창업감면은 판정만(감면율 · 기간) — 금액은 그해 낼 세금을 알아야 해서 새 식을 만들지 않았다.
 *  두 제도를 같은 해에 함께 받는지 · 고용 증가 추가 감면은 ★ 세무사 확인으로 적는다.
 */
import type { ClientOpsRecord, ToolDeadline } from '../types/clientOps'
import { clientFacts, type ClientFacts } from '../tools/shared/clientPrefill'
import { manwonText, smeConfirmed, startupRegion } from './clientInsights'
import { requestItemFor, requestMessage, type RequestItem } from './recoRequest'
import { scenarioPath, scenarioPreset } from './scenarioPresets'
import { fitContext, scenarioFit, type FitContext, type ScenarioFit } from './scenarioFit'
import { startupFormOf, type ScenarioNeed } from './scenarios'
import { addDaysLocal } from './clientOpsNextAction'
import { placeOf } from './grants/grantMatch'
import { diagnoseHiring, type DiagnosisRow, type HiringAnswers } from '../tools/employment/lib/eligibility'
import { DEFAULT_PROGRAMS } from '../tools/employment/lib/programs'
import { defaultTaxUnits, estimateTaxCredit, regionTypeOf, type RegionType } from '../tools/employment/lib/taxCredit'
import { getTaxCreditEstimate } from '../tools/labcare/lib/taxCredit'
import type { Client as LabClient } from '../tools/labcare/types'
import { runDiagnosis } from '../tools/policyFunding/diagnosis'
import { policyInputFromFacts } from '../tools/policyFunding/clientInput'
import { policyAssumption, policyEvidence } from './policyEvidence'
import { judge, VERDICT_LABEL } from '../tools/startupTax/lib/judgement'

export type PlanId = 'hire-youth' | 'hire-senior' | 'lab-start' | 'startup-hire'

export interface PlanDef {
  id: PlanId
  /** 고르는 칩 글 */
  label: string
  /** 상황 예시(D-199)의 아이디 — 맞는지 기준 · 모듈 화면 가정을 같이 쓴다 */
  preset: string
  /** 채용 상황(고용지원금 가정 · 채용 계획 질문) — 없으면 preset 이 채용 상황 */
  hiring?: string
  /** 사람 수 칩 */
  counts: readonly number[]
  defaultCount: number
  /** 한 줄 설명 */
  when: string
}

export const SITUATION_PLANS: readonly PlanDef[] = [
  { id: 'hire-youth', label: '청년 채용', preset: 'emp-youth', counts: [1, 2, 3, 5], defaultCount: 2, when: '만 15~34세를 정규직으로 새로 뽑을 때 — 지원금 · 세액공제 · 정책자금 가점' },
  { id: 'hire-senior', label: '만 60세 이상 채용', preset: 'emp-senior', counts: [1, 2, 3], defaultCount: 1, when: '경력 있는 만 60세 이상을 새로 뽑을 때 — 지원금 · 세액공제' },
  { id: 'lab-start', label: '연구소 만들기', preset: 'lab-two', counts: [1, 2, 3, 5], defaultCount: 2, when: '연구원을 두고 연구소(전담부서)를 만들 때 — 연구개발비 세액공제 · 정책자금 가점' },
  { id: 'startup-hire', label: '창업 5년 안 채용', preset: 'startup-new', hiring: 'emp-youth', counts: [1, 2, 3], defaultCount: 1, when: '창업감면 기간(5년) 안에 청년을 뽑을 때 — 창업감면 · 지원금 · 세액공제 · 정책자금' },
]

export function planDef(id: string | null | undefined): PlanDef | null {
  return SITUATION_PLANS.find((p) => p.id === id) ?? null
}

/** 상황 제목 — '청년 2명 채용' */
export function planTitle(id: PlanId, count: number): string {
  if (id === 'hire-youth') return `청년 ${count}명 채용`
  if (id === 'hire-senior') return `만 60세 이상 ${count}명 채용`
  if (id === 'startup-hire') return `창업 5년 안 청년 ${count}명 채용`
  return `연구원 ${count}명으로 연구소 만들기`
}

export type BlockKey = 'startup' | 'subsidy' | 'credit' | 'rnd' | 'policy'
/** ok: 금액 · 판정이 나옴 · need: 받을 것이 있어야 계산 · none: 이 조건에 맞는 것이 없음 */
export type BlockState = 'ok' | 'need' | 'none'

export interface PlanBlock {
  key: BlockKey
  label: string
  state: BlockState
  headline: string
  /** 합계에 더하는 돈(원 · 1년 안) — 정책자금(대출)은 0 */
  won: number
  /** 이어 가면 더 받는 돈(원) — 세액공제 2 · 3년 차 */
  laterWon: number
  /** 사람이 읽는 금액(없으면 '') */
  amount: string
  lines: string[]
  assumptions: string[]
  needs: ScenarioNeed[]
  /** 모듈 화면 — 같은 업체 · 같은 가정으로 */
  openPath: string
  openLabel: string
}

export interface PlanAction {
  id: string
  /** 언제 — '채용 전' · '뽑고 6개월 뒤' · '결산 전' */
  when: string
  text: string
  /** 업체에 붙일 때 걸 할 일 날짜(YYYY-MM-DD) */
  date: string
}

export interface SituationPlan {
  id: PlanId
  title: string
  count: number
  when: string
  fit: ScenarioFit
  blocks: PlanBlock[]
  /** 1년 안에 받을 수 있는 돈(지원금 + 세액공제 1년 차) */
  firstWon: number
  /** 이어 가면(세액공제 3년 · 연구개발비 3년) 모두 */
  keepWon: number
  keepYears: number
  /** '인원을 그대로 두면' · '연구를 이어 가면' */
  keepLabel: string
  /** 머리 금액 글 — '약 3,780만원(1차 추정)' · 계산 못 하면 '' */
  totalText: string
  actions: PlanAction[]
  assumptions: string[]
  /** 빠진 숫자 요청 문구(같은 자료는 하나로 · 없으면 '') */
  request: string
}

const man = (won: number) => manwonText(won) || '0원'
const q = (id: string) => `?client=${encodeURIComponent(id)}`

function need(label: string, value: string | null | undefined): ScenarioNeed {
  const v = (value ?? '').trim()
  return { label, ok: v !== '', value: v }
}

/** 시 · 도 짧은 이름 — '전라남도 …' · '충청북도 …' 처럼 긴 이름도(지원사업 맞춤과 같은 풀이) */
function sidoOf(facts: ClientFacts): string {
  return placeOf(facts.address).sido
}

/** 중소기업 확인 — clientInsights 로 옮김(D-302 · 맞춤 추천 고용 세액공제도 같은 기준) */
export { smeConfirmed }

/** 할 일 날짜가 토 · 일이면 다음 월요일로 — 달력 · 오늘 화면에 주말 할 일이 뜨지 않게 */
function workday(date: string): string {
  const d = new Date(`${date}T00:00:00`).getDay()
  return d === 6 ? addDaysLocal(date, 2) : d === 0 ? addDaysLocal(date, 1) : date
}

/** 오늘부터 n일 뒤(주말이면 월요일) */
const after = (today: string, n: number) => workday(addDaysLocal(today, n))

/** 다음 결산 전(12월 1일 · 주말이면 월요일) — 오늘이 12월이면 다음 해 */
function beforeClosing(today: string): string {
  const y = Number(today.slice(0, 4))
  return workday(today.slice(5, 7) === '12' ? `${y + 1}-12-01` : `${y}-12-01`)
}

/* ------------------------------------------------------------------ */
/* 채용 — 고용지원금 · 통합고용세액공제                                    */
/* ------------------------------------------------------------------ */

function hiringRows(record: ClientOpsRecord, facts: ClientFacts, presetId: string): { rows: DiagnosisRow[]; regionKnown: boolean } {
  const s = scenarioPreset(presetId)!
  const sido = sidoOf(facts)
  const answers: HiringAnswers = {
    ...s.hiring!,
    milMonths: 0,
    region: sido && !['서울', '경기', '인천'].includes(sido) ? '비수도권' : '수도권',
    companySize: facts.employeeCount,
    preApply: true,
    noLayoff: true,
    aboveFloor: true,
    youthEligible: true,
  }
  void record
  return { rows: diagnoseHiring(answers, Object.values(DEFAULT_PROGRAMS)), regionKnown: sido !== '' }
}

function subsidyBlock(record: ClientOpsRecord, facts: ClientFacts, presetId: string, count: number): { block: PlanBlock; main: DiagnosisRow | null } {
  const { rows, regionKnown } = hiringRows(record, facts, presetId)
  const usable = rows.filter((r) => r.status !== 'exclude' && r.program.totalAmount > 0)
  const main = usable.find((r) => r.status === 'recommend') ?? usable[0] ?? null
  const needs = [need('직원 수', facts.employeeCount === null ? '' : `${facts.employeeCount}명`), need('회사 주소(수도권 여부)', regionKnown ? facts.address.split(' ').slice(0, 2).join(' ') : '')]
  const openPath = scenarioPath({ id: presetId, module: 'employment' }, record.id)
  const assumptions = [
    '채용 전에 참여신청 · 최근 감원 없음 · 최저임금 이상 — 맞다고 보고 계산(★ 확인)',
    ...(regionKnown ? [] : ['주소를 몰라 수도권으로 보고 계산']),
    ...(facts.employeeCount === null ? ['직원 수를 몰라 규모 조건(피보험자 5인 이상 등)은 확인 못 함'] : []),
    '금액은 규칙표 총액 기준 1차 추정 — 공고로 확인',
  ]
  if (!main) {
    const why = rows.find((r) => r.blockers.length)?.blockers[0] ?? '조건을 바꿔 채용 진단에서 다시 보세요'
    return {
      main: null,
      block: { key: 'subsidy', label: '고용지원금', state: 'none', headline: '이 조건에 맞는 고용지원금이 지금은 없어요', won: 0, laterWon: 0, amount: '', lines: [why], assumptions, needs, openPath, openLabel: '채용 진단에서 이어서' },
    }
  }
  const per = main.program.totalAmount
  const total = per * count
  const rounds = main.program.rounds
  // D-244: '1년 안' 은 12개월 안에 받는 회차만 — 시니어 인턴십(3 · 9 · 18 · 24 · 36개월)은 나머지를 '이어 가면' 으로(예전엔 총액을 1년 안에 넣었다)
  const yearOne = rounds.length ? Math.min(per, rounds.filter((r) => r.month <= 12).reduce((a, r) => a + r.amount, 0)) : per
  const capital = !regionKnown || ['서울', '경기', '인천'].includes(sidoOf(facts))
  const lines = [
    `${main.status === 'recommend' ? '가능성 높음' : '검토'} · ${main.program.name} — 1명 최대 ${man(per)} × ${count}명`,
    `받는 때: ${rounds.slice(0, 3).map((r) => `${r.label} ${man(r.amount * count)}`).join(' → ')}${rounds.length > 3 ? ` → 그 뒤 ${rounds.length - 3}번 더` : ''}`,
    ...main.cautions.slice(0, 1).map((c) => `★ ${c}`),
    // 규칙표 note 의 수도권 조건(청년도약 — 수도권은 취업애로 요건 필수)
    ...(main.program.id === 'youth_jump' && capital ? ['★ 수도권은 취업애로 요건이 있는 청년만 대상 — 공고 확인'] : []),
  ]
  // '또는' 은 같은 근로 형태로 받을 수 있는 것만(정규직 채용에 인턴 사업을 나란히 두지 않는다)
  const empType = scenarioPreset(presetId)?.hiring?.empType
  const others = usable.filter((r) => r !== main && (!empType || r.program.match.empTypes.includes(empType))).slice(0, 2)
  if (others.length) lines.push(`또는 ${others.map((r) => `${r.program.name}(1명 최대 ${man(r.program.totalAmount)})`).join(' · ')} — 같은 사람에게 겹쳐 받기 어려워 하나만 셈`)
  return {
    main,
    block: {
      key: 'subsidy',
      label: '고용지원금',
      state: 'ok',
      headline: `${main.program.name} ${count}명 — 최대 ${man(total)}`,
      won: yearOne * count,
      laterWon: (per - yearOne) * count,
      amount: yearOne < per ? `1년 안 ${man(yearOne * count)} · 모두 최대 ${man(total)}` : `최대 ${man(total)}`,
      lines,
      assumptions,
      needs,
      openPath,
      openLabel: '채용 진단에서 이어서',
    },
  }
}

/** 통합고용세액공제 — 청년 등(만 15~34세 · 만 60세 이상 포함) 상시근로자가 늘어난 만큼(명부 화면과 같은 식) */
function creditBlock(record: ClientOpsRecord, facts: ClientFacts, count: number, who: string, extra: readonly string[] = []): PlanBlock {
  const sido = sidoOf(facts)
  const region: RegionType | null = regionTypeOf(sido || null)
  const sme = smeConfirmed(record)
  const tooBig = !sme && facts.employeeCount !== null && facts.employeeCount >= 300
  const needs = [need('회사 주소(수도권 · 지방 단가)', sido ? sido : ''), need('중소기업 확인서', sme ? '있음' : '')]
  const openPath = `/tools/employment/roster${q(record.id)}`
  const base = { key: 'credit' as const, label: '통합고용세액공제', needs, openPath, openLabel: '명부 진단에서 이어서' }
  if (tooBig) {
    return { ...base, state: 'need', headline: '직원 300명 이상 — 기업 규모(중소 · 중견)를 알아야 단가를 정해요', won: 0, laterWon: 0, amount: '', lines: [], assumptions: ['중소기업 확인서가 있으면 바로 계산'] }
  }
  const units = defaultTaxUnits(region ?? 'metro', 'sme')
  const prev = facts.employeeCount ?? 0
  const est = estimateTaxCredit({ region: region ?? 'metro', sizeType: 'sme', prevTotal: prev, curTotal: prev + count, prevYouth: 0, curYouth: count, unitYouth: units.youth, unitNormal: units.normal })
  const year1 = est.creditTotal ?? 0
  const years = 3
  return {
    ...base,
    state: 'ok',
    headline: `${who} ${count}명 늘면 1년 차 약 ${man(year1)} 덜 냄`,
    won: year1,
    laterWon: year1 * (years - 1),
    amount: `1년 차 약 ${man(year1)}`,
    lines: [
      `1명 ${man(units.youth * 10_000)}(${region === 'local' ? '지방' : '수도권'} 중소기업 · 청년 등) × ${count}명 = 1년 차 약 ${man(year1)}`,
      `인원을 그대로 두면 2년 더 — 3년 합계 약 ${man(year1 * years)}`,
      '★ 회사 전체 상시근로자 수가 늘어야 해요 — 그사이 다른 직원이 나가면 줄어요',
      ...extra,
    ],
    assumptions: [
      '단가는 명부 진단 화면과 같은 참고값 — 귀속연도 법령표 · 담당 세무사 확인',
      ...(sme ? [] : ['중소기업 확인서가 없어 중소기업으로 보고 계산(★)']),
      ...(region ? [] : ['주소를 몰라 수도권 단가(더 낮은 쪽)로 계산']),
      '소비성 서비스업 등 제외 업종 · 최저한세 · 중복공제는 세무사 확인',
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 연구소 — 연구개발비 세액공제                                            */
/* ------------------------------------------------------------------ */

const RESEARCHER_PAY = 40_000_000

function rndBlock(record: ClientOpsRecord, facts: ClientFacts, count: number): PlanBlock {
  const sme = smeConfirmed(record)
  const payroll = RESEARCHER_PAY * count
  const client: LabClient = {
    id: 'plan',
    name: facts.companyName,
    industry: facts.industryText,
    labType: '기업부설연구소',
    ceoName: '',
    address: facts.address,
    certifiedDate: '',
    researcherCount: count,
    labName: '',
    consultant: '',
    createdAt: '',
    businessType: facts.businessType === 'individual' ? '개인사업자' : '법인사업자',
    researchersPayrollTotal: payroll,
    rndMaterialCost: 0,
    rndOtherCost: 0,
    taxCreditCategory: '일반 R&D',
    ...(sme ? { taxCompanySize: '중소기업' as const } : {}),
  }
  const est = getTaxCreditEstimate(client)
  const early = facts.months !== null && facts.months < 36
  const labNeed = early ? 2 : 3
  const kind = count >= labNeed ? '기업부설연구소' : '연구개발전담부서'
  const needs = [need('사업자 구분(법인 · 개인)', facts.businessType === 'corporation' ? '법인' : facts.businessType === 'individual' ? '개인' : ''), need('업종', facts.industryText)]
  // D-244: 고른 연구원 수(n)로 연다 — 연구소 화면도 같은 인건비 · 같은 금액
  const base = { key: 'rnd' as const, label: '연구개발비 세액공제', needs, openPath: `${scenarioPath({ id: 'lab-two', module: 'labcare' }, record.id)}&n=${count}`, openLabel: '연구소 세액공제에서 이어서' }
  if (!est.available) return { ...base, state: 'need', headline: est.warnings[0] ?? '연구개발비를 알면 계산해요', won: 0, laterWon: 0, amount: '', lines: [], assumptions: [] }
  return {
    ...base,
    state: 'ok',
    headline: `연구원 ${count}명 인건비 ${man(payroll)} → ${est.taxType} 해마다 약 ${man(est.annual)} 덜 냄`,
    won: est.annual,
    laterWon: est.annual * 2,
    amount: `해마다 약 ${man(est.annual)}`,
    lines: [
      `공제율 ${est.rate}%(일반 R&D${est.sizeAssumed ? ' · ★ 중소기업으로 가정' : ''}) — 연구원 1명 연봉 ${man(RESEARCHER_PAY)}으로 계산`,
      `${count}명이면 ${kind} 기준(소기업 연구소는 ${labNeed}명${early ? ' — 창업 3년 안' : ''} · 전담부서는 1명 · 중기업 연구소는 5명)`,
      '연구소(전담부서) 인정 · 연구노트 · 연구개발비 구분경리가 있어야 받아요',
    ],
    assumptions: [...est.assumptions.slice(0, 2), '공제액은 그해 낼 세금을 넘을 수 없어요(★ 세무사 확인)', '연구원을 새로 뽑으면 통합고용세액공제도 따로 — 청년 채용 설계서에서 확인'],
  }
}

/* ------------------------------------------------------------------ */
/* 창업감면 — 판정기 그대로(감면율 · 기간 · 맞는지) · 금액은 계산하지 않음      */
/* ------------------------------------------------------------------ */

function startupBlock(record: ClientOpsRecord, facts: ClientFacts, today: string): PlanBlock {
  const needs = [
    need('설립일(창업일)', facts.establishedAt),
    need('대표 생년월일', facts.representativeBirth),
    need('회사 주소(권역)', startupRegion(facts.address).region ? facts.address : ''),
    need('업종', facts.industry ? facts.industryText || facts.industry : ''),
  ]
  const base = { key: 'startup' as const, label: '창업감면', won: 0, laterWon: 0, amount: '', needs, openPath: scenarioPath({ id: 'startup-new', module: 'startup-tax' }, record.id), openLabel: '창업감면 판정에서 이어서' }
  const core = needs.slice(0, 2).filter((n) => !n.ok)
  if (core.length) return { ...base, state: 'need', headline: `${core.map((n) => n.label).join(' · ')}을(를) 받으면 창업감면도 같이 판정해요`, lines: [], assumptions: [] }
  const r = judge(startupFormOf(facts, { startupForm: 'brand_new' }), new Date(`${today}T00:00:00`))
  if (r.notice) return { ...base, state: 'need', headline: r.notice, lines: [], assumptions: [] }
  const item = r.coreItems.find((i) => i.key === 'incomeTax')
  // 감면 기간 — 판정기와 같이 보수적으로 '창업한 해 + 4년'(최초 소득이 늦게 생겼으면 더 뒤까지)
  const from = Number(facts.establishedAt.slice(0, 4))
  const to = from + 4
  const left = to - Number(today.slice(0, 4)) + 1
  return {
    ...base,
    state: 'ok',
    headline: `${VERDICT_LABEL[item?.verdict ?? r.overall]} — ${r.oneLineConclusion}`,
    lines: [
      ...(item?.reasons ?? r.keyReasons).slice(0, 2),
      left > 0
        ? `감면 기간: ${from}~${to}년(창업한 해부터 5년으로 보수적으로) — 올해 포함 ${left}년 남음. 뽑은 해부터 남은 해까지 함께 챙겨요`
        : `감면 기간: 창업한 해부터 5년이면 ${to}년에 끝 — 최초 소득이 늦게 생겼으면 올해도 남았을 수 있어요(★ 확인)`,
      ...r.alerts.slice(0, 1).map((a) => `★ ${a}`),
      '★ 감면 기간 중 직원이 늘어난 해에는 늘어난 만큼 더 감면받는 규정도 있어요(업종별 직원 수 기준) — 세무사 확인',
    ],
    assumptions: [
      '새로 창업한 회사(이어받지 않음)로 보고 판정 — 법인전환 · 사업 양수면 달라요(★)',
      '감면율 · 기간은 판정기 규칙 — 업종 · 권역 · 창업 형태에 따라 달라요(★ 세무사 확인)',
      '감면 금액은 그해 낼 세금을 알아야 해서 계산하지 않았어요 — 판정만',
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 정책자금 — 가점 힌트(대출이라 합계에 넣지 않음)                           */
/* ------------------------------------------------------------------ */

function policyBlock(record: ClientOpsRecord, facts: ClientFacts, id: PlanId, today: string): PlanBlock {
  const { input, missing } = policyInputFromFacts(facts)
  const needs = [need('업종', facts.industryText), need('설립일(업력)', facts.establishedAt), need('매출', facts.revenue && !facts.revenue.estimated ? man(facts.revenue.won) : '')]
  const hiring = id !== 'lab-start'
  const youth = id === 'hire-youth' || id === 'startup-hire'
  const openPath = hiring ? scenarioPath({ id: 'policy-hiring', module: 'policy-funding' }, record.id) : `/tools/policy-funding/diagnosis${q(record.id)}`
  const base = { key: 'policy' as const, label: '정책자금', won: 0, laterWon: 0, amount: '', needs, openPath, openLabel: '정책자금 진단에서 이어서' }
  const core = missing.filter((m) => m !== '매출')
  if (core.length) return { ...base, state: 'need', headline: `${core.join(' · ')}을(를) 받으면 정책자금도 같이 봐요`, lines: [], assumptions: [] }
  // D-312 맞춤 추천 카드와 같은 근거(서류함) 위에 이 상황의 가정 — 연구소 상황은 가점에 연구소를 더한다
  const ev = policyEvidence(record, facts, today)
  const bonus = [...new Set([...(ev.input.bonusItems ?? []), ...(input.bonusItems ?? []), '기업부설연구소 보유' as const])]
  const r = runDiagnosis({
    ...input,
    ...ev.input,
    purpose: '운전자금',
    ...(hiring ? { hiringPlan: '있음' as const, ...(youth ? { youthEmployment: '예정' as const } : {}) } : { bonusItems: bonus }),
  })
  const level = r.likelihoodLevel ?? r.headline?.level ?? '보통'
  return {
    ...base,
    state: 'ok',
    headline: `진행 가능성 ${level} · 추천 기관 ${r.topAgency}`,
    lines: [
      hiring ? `채용 계획${youth ? '(청년)' : ''}이 가점이에요 — 신청서에 채용 계획을 적어요` : '연구소 인정 뒤 신청하면 가점이에요(기술 · R&D 자금도 열려요)',
      ...(r.headline?.reasons ?? []).slice(0, 1),
      r.nextAction,
    ].filter(Boolean),
    assumptions: ['정책자금은 갚는 돈(대출 · 보증)이라 위 합계에 넣지 않았어요', policyAssumption(ev)],
  }
}

/* ------------------------------------------------------------------ */
/* 추천 행동                                                             */
/* ------------------------------------------------------------------ */

function hiringActions(today: string, main: DiagnosisRow | null, count: number, policyOk: boolean, startup = false): PlanAction[] {
  const out: PlanAction[] = []
  if (main) {
    // '고용24(work24.go.kr)' · '고용24 / 1811-8447' → '고용24'
    const where = main.program.applyUrl.replace(/\(.*?\)/g, '').split(/\s*\/\s*|\s+/)[0]
    out.push({ id: 'apply', when: '뽑기 전', text: main.program.match.preApply ? `${where ? `${where}에서 ` : ''}${main.program.name} 참여신청` : `${main.program.name} 신청 요건 확인`, date: after(today, 3) })
  }
  out.push({ id: 'contract', when: '뽑을 때', text: '정규직 근로계약 · 최저임금 이상 · 4대보험 가입', date: after(today, 14) })
  const first = main?.program.rounds[0]
  if (main && first) out.push({ id: 'round1', when: `뽑고 ${first.month}개월 뒤`, text: `${main.program.name} ${first.label} 신청(${man(first.amount * count)})`, date: after(today, 14 + first.month * 30) })
  out.push(
    startup
      ? { id: 'tax', when: '결산 전', text: '세무사에게 창업감면 · 늘어난 인원 알리기 — 창업감면 · 통합고용세액공제 함께 검토', date: beforeClosing(today) }
      : { id: 'tax', when: '결산 전', text: '세무사에게 늘어난 인원 알리기 — 통합고용세액공제 신고', date: beforeClosing(today) },
  )
  if (policyOk) out.push({ id: 'policy', when: '이번 주', text: '정책자금 상담 — 채용 계획으로 가점', date: after(today, 7) })
  return out
}

function labActions(today: string, policyOk: boolean): PlanAction[] {
  return [
    { id: 'staff', when: '이번 주', text: '연구원 자격 확인 — 자연계 학사 이상(또는 학사 + 경력) · 연구 일만 하는 사람', date: after(today, 7) },
    { id: 'space', when: '이번 달', text: '독립된 연구 공간 — 칸막이 · 출입문 · 간판', date: after(today, 21) },
    { id: 'report', when: '공간 준비 뒤', text: '한국산업기술진흥협회(KOITA)에 연구소 · 전담부서 온라인 신고', date: after(today, 30) },
    { id: 'notes', when: '인정 뒤', text: '연구노트 · 연구개발비 구분경리 시작', date: after(today, 45) },
    { id: 'tax', when: '결산 전', text: '세무사에게 연구개발비 알리기 — 연구개발비 세액공제 신고', date: beforeClosing(today) },
    ...(policyOk ? [{ id: 'policy', when: '인정 뒤', text: '정책자금 상담 — 연구소 보유 가점', date: after(today, 45) }] : []),
  ]
}

/* ------------------------------------------------------------------ */

/**
 * 맞는지 — 상황 예시와 같은 기준. 채용이 붙은 상황(창업 5년 안 채용)은 둘 다 맞아야:
 * 창업 5년 안(설립일)이 먼저 — 모르거나 지났으면 그 까닭, 맞으면 채용 계획(대표 답)
 */
export function planFit(def: PlanDef, ctx: FitContext): ScenarioFit {
  const base = scenarioFit(scenarioPreset(def.preset)!, ctx)
  if (!def.hiring || base.kind === 'no' || base.kind === 'data') return base
  const hire = scenarioFit(scenarioPreset(def.hiring)!, ctx)
  return hire.kind === 'fit' ? { ...hire, why: `${base.why} · ${hire.why}` } : hire
}

/** '창업 5년 안 채용' 에만 붙는 세액공제 확인 — 두 제도를 같은 해에 · 낼 세금보다 공제가 클 때 */
const STARTUP_CREDIT_NOTES = [
  '★ 창업감면과 같은 해에 함께 받을 수 있는지(중복 배제) 세무사 확인',
  '★ 창업 초기엔 낼 세금이 적어 공제를 다 못 쓸 수 있어요 — 남은 공제를 다음 해로 넘기는지(이월) 세무사 확인',
]

/** 상황 하나 · 사람 수 → 이 업체 숫자로 한 장 */
export function buildSituationPlan(id: PlanId, record: ClientOpsRecord, today: string, count?: number, ctx: FitContext = fitContext(record, today)): SituationPlan {
  const def = planDef(id)!
  const n = count && count > 0 ? Math.min(Math.floor(count), 50) : def.defaultCount
  const facts = clientFacts(record, new Date(`${today}T00:00:00`))
  const f = facts.industryText ? facts : { ...facts, industryText: ctx.industryText }
  const fit = planFit(def, ctx)
  const blocks: PlanBlock[] = []
  let actions: PlanAction[]
  if (id === 'lab-start') {
    blocks.push(rndBlock(record, f, n))
    const pol = policyBlock(record, f, id, today)
    blocks.push(pol)
    actions = labActions(today, pol.state === 'ok')
  } else {
    const startup = id === 'startup-hire'
    if (startup) blocks.push(startupBlock(record, f, today))
    const { block, main } = subsidyBlock(record, f, def.hiring ?? def.preset, n)
    blocks.push(block, creditBlock(record, f, n, id === 'hire-senior' ? '만 60세 이상' : '청년', startup ? STARTUP_CREDIT_NOTES : []))
    const pol = policyBlock(record, f, id, today)
    blocks.push(pol)
    actions = hiringActions(today, main, n, pol.state === 'ok', startup)
  }
  const firstWon = blocks.reduce((s, b) => s + (b.state === 'ok' ? b.won : 0), 0)
  const keepWon = firstWon + blocks.reduce((s, b) => s + (b.state === 'ok' ? b.laterWon : 0), 0)
  const title = planTitle(id, n)
  const items = blocks
    .flatMap((b) => b.needs.filter((x) => !x.ok).map((x) => requestItemFor(x.label, `${title} 설계서`)))
    .filter((x): x is RequestItem => x !== null)
  return {
    id,
    title,
    count: n,
    when: def.when,
    fit,
    blocks,
    firstWon,
    keepWon,
    keepYears: 3,
    keepLabel: id === 'lab-start' ? '연구를 이어 가면' : '인원을 그대로 두면',
    totalText: firstWon > 0 ? `약 ${man(firstWon)}` : '',
    actions,
    assumptions: ['규칙 계산 · 1차 추정 — 실제 금액은 공고 · 세무사 확인으로 정해져요', '선정 · 승인을 보장하지 않아요'],
    // 같은 자료는 requestMessage 가 하나로 묶는다
    request: items.length ? requestMessage(record, items) : '',
  }
}

/** 고르는 판 — 상황마다 맞는지(맞음이 먼저 · 같으면 카탈로그 순서) */
export function situationChoices(record: ClientOpsRecord, today: string, usable: (module: string) => boolean = () => true): { def: PlanDef; fit: ScenarioFit }[] {
  const ctx = fitContext(record, today)
  const rank = { fit: 0, ask: 1, data: 2, no: 3 } as const
  return SITUATION_PLANS.filter((d) => usable(d.id === 'lab-start' ? 'labcare' : 'employment'))
    .map((def, i) => ({ def, fit: planFit(def, ctx), i }))
    .sort((a, b) => rank[a.fit.kind] - rank[b.fit.kind] || a.i - b.i)
    .map(({ def, fit }) => ({ def, fit }))
}

/** 한 장 글 — 업체에 붙이는 요약 · 카톡 · 인쇄에 같은 글(내부 메모 · 수수료 없음) */
export function planSummary(plan: SituationPlan, companyName: string): string {
  const lines = [`[상황별 설계서] ${companyName} — ${plan.title}`]
  if (plan.totalText) lines.push(`1년 안에 받을 수 있는 돈 ${plan.totalText}(1차 추정)${plan.keepWon > plan.firstWon ? ` · ${plan.keepLabel} ${plan.keepYears}년 합계 약 ${man(plan.keepWon)}` : ''}`)
  for (const b of plan.blocks) {
    lines.push('', `■ ${b.label} — ${b.headline}`)
    for (const l of b.lines) lines.push(`· ${l}`)
  }
  if (plan.actions.length) {
    lines.push('', '■ 이렇게 진행해요')
    plan.actions.forEach((a, i) => lines.push(`${i + 1}. [${a.when}] ${a.text}`))
  }
  lines.push('', ...plan.assumptions.map((a) => `※ ${a}`))
  return lines.join('\n')
}

/**
 * 업체 기록에 붙일 결과 한 줄(withToolResult 입력) — 고른 추천 행동은 할 일로(달력 · 오늘).
 * D-244: 앞서 붙인 설계서에 같은 날 · 같은 할 일이 이미 있으면 다시 걸지 않는다(예전엔 다시 붙이면 할 일이 두 배)
 */
export function planResultInput(plan: SituationPlan, companyName: string, actionIds: readonly string[], prior: readonly { toolKey: string; deadlines: readonly { date: string; title: string }[] }[] = []) {
  const had = new Set(prior.filter((r) => r.toolKey === 'situation-plan').flatMap((r) => r.deadlines.map((d) => `${d.date}|${d.title}`)))
  const deadlines: ToolDeadline[] = plan.actions
    .filter((a) => actionIds.includes(a.id))
    .map((a) => ({ date: a.date, title: a.text.split(' — ')[0], note: `${plan.title} 설계서 · ${a.when}`, todo: true as const }))
    .filter((d) => !had.has(`${d.date}|${d.title}`))
  return {
    toolKey: 'situation-plan',
    title: `상황별 설계서 · ${plan.title}`,
    verdict: plan.firstWon > 0 ? 'amount' : 'plan',
    verdictLabel: plan.totalText ? `1년 안 ${plan.totalText}(1차 추정)` : '설계서',
    summary: planSummary(plan, companyName),
    data: { planId: plan.id, count: plan.count, firstWon: plan.firstWon, keepWon: plan.keepWon, blocks: plan.blocks.map((b) => ({ key: b.key, state: b.state, won: b.won, headline: b.headline })) },
    deadlines,
  }
}
