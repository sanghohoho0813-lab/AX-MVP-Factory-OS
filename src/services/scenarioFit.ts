/**
 * 상황 예시 — 이 업체에 맞는 상황인가 (D-201 · 대표 지적 "기준을 모르겠다 · 그냥 갖다 붙인 것 같다").
 *
 * D-199 는 23가지 상황을 모든 업체에 다 계산했다 — '바로 설계됨' 은 '계산에 필요한 숫자가 있다' 는 뜻이었지
 * '이 업체에 맞는 상황' 이라는 뜻이 아니었다. 그래서 매출이 작은 업체에 '세후 월 800만원 급여' 가,
 * 직원 나이를 모르는 업체에 '만 60세 이상 채용' 이 설계되어 나왔다.
 *
 * 이제 상황마다 먼저 '맞는가' 를 따진다. 넷 중 하나:
 *   fit   업체 기록에 근거가 있다 — 근거 한 줄(왜)을 붙여 설계한다
 *   ask   계획 · 사정은 기록에 없다(채용 계획 · 계약직 · 설비 투자 …) — 대표에게 예/아니요 하나만 묻는다
 *   data  판단할 숫자가 없다(영업이익 · 이익잉여금 · 설립일 …) — 받을 자료를 말한다
 *   no    기록이 반대를 말한다(개인사업자 · 창업 5년 지남 · 이익이 모자람 …) — 까닭과 함께 접어 둔다
 * 대표의 답은 업체 기록 `decided` 에 `scn.질문` 으로 남는다(DB 변경 없음 · 확인함과 같은 칸).
 *
 * 규칙 계산이다(AI · LLM 호출 없음). 기준은 아래 함수에 한 줄씩 — 바꾸면 시험(scenarios.test.ts)도 같이 바꾼다.
 */
import type { ClientOpsRecord, ShareholderRow } from '../types/clientOps'
import { clientFacts, type ClientFacts } from '../tools/shared/clientPrefill'
import { formatWon, usableFactValue } from './customerFacts'
import { startupRegion } from './clientInsights'
import { entityKindOf } from './clientOrder'
import { latestEmploymentRoster } from './toolResultGroups'
import { isExcludedIndustryText } from '../tools/labcare/lib/assessmentOptions'
import type { ScenarioPreset } from './scenarioPresets'
import { parseGoalText, profileSuggestions, salaryPlan, viewProfile, type ProfileView, type TaxProfile } from './taxPlan'

export type FitKind = 'fit' | 'ask' | 'data' | 'no'

export const FIT_LABEL: Record<FitKind, string> = {
  fit: '이 업체에 맞음',
  ask: '물어보면 알 수 있음',
  data: '자료를 받으면 판단',
  no: '이 업체엔 안 맞음',
}

/** 대표에게 묻는 것 — 같은 질문을 여러 상황이 함께 쓴다(한 번 답하면 같이 열린다) */
export const SCENARIO_QUESTIONS = {
  hireYouth: '청년(만 15~34세)을 새로 뽑을 계획이 있나요?',
  hireSenior: '만 60세 이상을 새로 뽑을 계획이 있나요?',
  childcare: '육아휴직을 쓰고 있거나 쓸 직원이 있나요?',
  contract: '계약직(기간제) 직원이 있나요?',
  researchStaff: '연구 · 개발을 맡을 직원(이공계 학위 · 관련 경력)이 있나요?',
  prototype: '올해 시제품 · 개발 재료비가 드나요?',
  conversion: '개인사업자에서 법인으로 바꾼 회사인가요?',
  facility: '기계 · 설비를 살 계획(견적)이 있나요?',
  succession: '자녀에게 회사 지분을 넘길 계획이 있나요?',
  loan: '가지급금(대표가 회사 돈을 가져다 쓴 것)이 있나요?',
  retire: '대표 퇴임이나 퇴직금 중간정산을 생각하고 있나요?',
} as const

export type QuestionKey = keyof typeof SCENARIO_QUESTIONS

export interface ScenarioFit {
  kind: FitKind
  /** 화면 한 줄 — 맞는 근거 · 안 맞는 까닭 · 무엇을 알면 판단하는지 */
  why: string
  /** ask — 대표에게 물을 것 */
  question?: QuestionKey
  /** data — 받으면 판단할 것(요청 문구의 항목 이름) */
  dataNeeds?: string[]
  /** fit · no 가 대표의 답에서 나왔으면 그 질문(답 바꾸기) */
  answered?: QuestionKey
}

const answerKey = (q: QuestionKey) => `scn.${q}`

export function scenarioAnswer(record: Pick<ClientOpsRecord, 'decided'>, q: QuestionKey): 'yes' | 'no' | null {
  return record.decided?.[answerKey(q)]?.a ?? null
}

/** 대표의 답 저장(null 이면 지운다 — 답 바꾸기) */
export function withScenarioAnswer(record: ClientOpsRecord, q: QuestionKey, a: 'yes' | 'no' | null, now: string): ClientOpsRecord {
  const decided = { ...(record.decided ?? {}) }
  if (a === null) delete decided[answerKey(q)]
  else decided[answerKey(q)] = { a, at: now }
  return { ...record, decided }
}

/* ------------------------------------------------------------------ */
/* 판단에 쓰는 업체 사정                                                 */
/* ------------------------------------------------------------------ */

export interface FitContext {
  record: ClientOpsRecord
  facts: ClientFacts
  /** 법인 · 개인(근거가 확실) · 모름(이름에 '주식회사' 가 없을 뿐) */
  entity: 'corporation' | 'individual' | 'unknown'
  /** 왜 그렇게 봤는지 — 화면 문구에 쓴다 */
  entityBasis: string
  p: ProfileView
  /** 절세 현황에 적힌 칸(0 도 '적힘') */
  given: (k: keyof TaxProfile) => boolean
  reg: readonly ShareholderRow[]
  /** 자녀 수 — 주주명부 · 절세 현황에서(모르면 null) */
  children: number | null
  netIncome: number | null
  opProfit: number | null
  revenue: number | null
  retained: number | null
  loan: number | null
  roster: { youth: number; senior: number; active: number } | null
  hasLab: boolean
  industryText: string
}

export function fitContext(record: ClientOpsRecord, today: string): FitContext {
  const facts = clientFacts(record, new Date(`${today}T00:00:00`))
  const industryText = facts.industryText || [record.businessCategory, record.businessItem].map((v) => (v ?? '').trim()).filter(Boolean).join(' ')
  const base: TaxProfile = Object.fromEntries(Object.entries(record.taxProfile ?? {}).filter(([, v]) => typeof v === 'string' && v.trim() !== ''))
  const profile: TaxProfile = { ...base }
  for (const s of profileSuggestions(record, base, today)) profile[s.key] = s.value
  const p = viewProfile(profile)
  const given = (k: keyof TaxProfile) => typeof base[k] === 'string' && base[k]!.trim() !== ''
  const reg = record.shareholderRegister ?? []
  // 법인 · 개인 — 법인번호 · 사업자번호 가운데 두 자리 · 이름 · 주주명부. 근거가 이름이 없다는 것뿐이면 '모름'
  const digits = (record.businessNumber ?? '').replace(/\D/g, '')
  const mid = digits.length === 10 ? Number(digits.slice(3, 5)) : null
  const kind = entityKindOf(record)
  let entity: FitContext['entity'] = 'unknown'
  let entityBasis = '법인인지 개인사업자인지 몰라요'
  if (kind === 'corporation') {
    entity = 'corporation'
    entityBasis = record.corporateNumber.trim() ? '법인번호 있음' : mid !== null && [81, 82, 84, 85, 86, 87, 88].includes(mid) ? '사업자번호가 법인' : '회사 이름이 법인'
  } else if (reg.length > 0) {
    entity = 'corporation'
    entityBasis = '주주명부 있음'
  } else if (mid !== null && ((mid >= 1 && mid <= 79) || (mid >= 90 && mid <= 99))) {
    entity = 'individual'
    entityBasis = '사업자번호가 개인사업자'
  }
  const kids = reg.filter((r) => r.relation === 'child' || r.relation === 'minor_child').length
  const children = kids > 0 ? Math.max(kids, p.children) : given('children') ? p.children : null
  const roster = latestEmploymentRoster(record)
  const rd = roster ? (roster.data as { counts?: { youthCount?: number; seniorCount?: number; activeCount?: number } }).counts : null
  return {
    record,
    facts,
    entity,
    entityBasis,
    p,
    given,
    reg,
    children,
    netIncome: facts.netIncome?.won ?? null,
    opProfit: facts.operatingProfit?.won ?? null,
    revenue: facts.revenue?.won ?? null,
    retained: given('retainedEarnings') ? p.retainedEarnings : null,
    loan: given('loanBalance') ? p.loanBalance : null,
    roster: rd ? { youth: rd.youthCount ?? 0, senior: rd.seniorCount ?? 0, active: rd.activeCount ?? 0 } : null,
    hasLab: usableFactValue(record, 'researchLab').trim() !== '',
    industryText,
  }
}

/* ------------------------------------------------------------------ */
/* 기준                                                                  */
/* ------------------------------------------------------------------ */

const krw = (n: number) => formatWon(n)
const EOK = 100_000_000

const fit = (why: string, answered?: QuestionKey): ScenarioFit => ({ kind: 'fit', why, ...(answered ? { answered } : {}) })
const no = (why: string, answered?: QuestionKey): ScenarioFit => ({ kind: 'no', why, ...(answered ? { answered } : {}) })
const data = (why: string, dataNeeds: string[]): ScenarioFit => ({ kind: 'data', why, dataNeeds })
const ask = (question: QuestionKey, why = ''): ScenarioFit => ({ kind: 'ask', why: why || SCENARIO_QUESTIONS[question], question })

/** 답이 있으면 그대로, 없으면 묻는다 */
function byAnswer(c: FitContext, q: QuestionKey, yes: string, noWhy: string, hint = ''): ScenarioFit {
  const a = scenarioAnswer(c.record, q)
  if (a === 'yes') return fit(`대표 답: ${yes}`, q)
  if (a === 'no') return no(`대표 답: ${noWhy}`, q)
  return ask(q, hint ? `${SCENARIO_QUESTIONS[q]} — ${hint}` : '')
}

/** 법인에만 있는 일(배당 · 자사주 · 대표 급여 · 가지급금 · 퇴직금) */
function corpOnly(c: FitContext, what: string): ScenarioFit | null {
  if (c.entity === 'individual') return no(`개인사업자예요(${c.entityBasis}) — ${what}는 법인에만 있는 일이에요`)
  if (c.entity === 'unknown') return data(`법인인지 몰라요 — ${what}는 법인에만 있는 일이에요`, ['사업자등록증(법인 · 개인 구분)'])
  return null
}

/** 대표가 목돈을 가져갈 수 있는 이익이 있나 — 이익잉여금(쌓인 이익) + 앞으로 n년 순이익. label 은 '…억' 으로 끝난다(조사 '을') */
function cashRoom(c: FitContext, target: number, years: number, label: string): ScenarioFit {
  const ni = c.netIncome !== null ? Math.max(0, c.netIncome) : null
  if (c.retained !== null) {
    const room = c.retained + (ni ?? 0) * years
    const basis = `배당 가능한 이익 ${krw(c.retained)}${ni !== null && years > 0 ? ` + 순이익 ${krw(ni)}${years > 1 ? ` × ${years}년` : ''}` : ''}`
    if (room >= target) return fit(`${basis} — ${label}을 가져갈 만큼 이익이 있어요`)
    if (ni === null && years > 0) return data(`${basis} — 순이익까지 알면 ${label}이 되는지 판단해요`, ['최근 재무제표(순이익)'])
    return no(`${basis} — ${label}을 가져가기엔 이익이 모자라요`)
  }
  if (ni !== null && ni * Math.max(1, years) >= target) return fit(`순이익 ${krw(ni)}${years > 1 ? ` × ${years}년` : ''} — ${label}을 가져갈 만큼 이익이 있어요(쌓인 이익은 재무제표로 확인)`)
  return data(`쌓인 이익(이익잉여금)을 알아야 ${label}을 가져갈 수 있는지 판단해요${ni !== null ? ` — 최근 순이익 ${krw(ni)}` : ''}`, ['최근 재무제표(배당 가능한 이익)'])
}

/** 이 급여를 회사가 줄 수 있나 — 영업이익 + 지금 대표 급여(이미 비용) ≥ 새 급여 × 12 × 1.1(4대보험 회사 부담 어림) */
function salaryRoom(c: FitContext, s: ScenarioPreset): ScenarioFit {
  const g = parseGoalText(s.taxText ?? '')
  const plan = salaryPlan(c.p, g.salary ?? { mode: 'min' })
  if (!plan.ok || plan.monthly <= 0) return data('급여를 계산할 값이 모자라요', ['대표 월 급여'])
  const yearly = Math.round(plan.monthly * 12 * 1.1)
  const profit = c.opProfit ?? c.netIncome
  const profitName = c.opProfit !== null ? '영업이익' : '순이익'
  const now = c.p.monthlySalary * 12
  if (profit === null) return data(`이 급여(월 ${krw(plan.monthly)} · 회사 부담 포함 연 약 ${krw(yearly)})를 줄 수 있는지 이익을 알아야 해요`, ['최근 재무제표(영업이익)'])
  const room = profit + now
  const basis = `${profitName} ${krw(profit)}${now > 0 ? ` + 지금 대표 급여 연 ${krw(now)}` : ''}`
  if (room >= yearly) return fit(`${basis} — 이 급여(월 ${krw(plan.monthly)} · 회사 부담 포함 연 약 ${krw(yearly)})를 줄 수 있어요`)
  return no(`${basis} — 이 급여(월 ${krw(plan.monthly)} · 연 약 ${krw(yearly)})를 주기엔 이익이 모자라요`)
}

/** 연구소를 둘 만한 업종인가(제조 · IT · 연구 · 설계 …) — 서비스 · 도소매도 전담부서는 되지만 묻는다 */
const RND_INDUSTRY = /제조|소프트웨어|정보통신|정보서비스|IT|아이티|연구|개발|엔지니어링|바이오|전자|기계|화학|의료기기|반도체|설계|플랫폼|인공지능|AI|데이터|부품|소재|장비|시스템/i

export function scenarioFit(s: ScenarioPreset, c: FitContext): ScenarioFit {
  const f = c.facts
  const age = f.representativeAge
  const months = f.months
  const est = f.establishedAt
  switch (s.id) {
    /* 절세 — 목돈 · 급여 */
    case 'tax-cash-1e':
      return corpOnly(c, '배당 · 자사주로 가져가기') ?? cashRoom(c, EOK, 1, '1억')
    case 'tax-cash-3e-split':
      return corpOnly(c, '배당 · 자사주로 가져가기') ?? cashRoom(c, 3 * EOK, 3, '3년에 나눠 3억')
    case 'tax-treasury': {
      const corp = corpOnly(c, '자사주 사기')
      if (corp) return corp
      // 자사주 취득은 배당 가능한 이익 안에서만
      if (c.retained === null) return data('자사주는 배당 가능한 이익 안에서만 살 수 있어요 — 이익잉여금을 알아야 판단', ['최근 재무제표(배당 가능한 이익)'])
      return c.retained >= EOK ? fit(`배당 가능한 이익 ${krw(c.retained)} — 자사주 1억 취득 한도 안`) : no(`배당 가능한 이익 ${krw(c.retained)} — 자사주 1억은 한도를 넘어요`)
    }
    case 'tax-salary-rate':
    case 'tax-salary-net':
      return corpOnly(c, '대표 급여 설계하기') ?? salaryRoom(c, s)
    /* 절세 — 자녀 · 승계 · 상속 */
    case 'tax-gift-10':
    case 'tax-gift-free': {
      const corp = corpOnly(c, '지분 증여하기')
      if (corp) return corp
      const a = scenarioAnswer(c.record, 'succession')
      if (a === 'no') return no('대표 답: 자녀에게 지분을 넘길 계획 없음', 'succession')
      if (c.children !== null && c.children > 0) return fit(c.reg.some((r) => r.relation === 'child' || r.relation === 'minor_child') ? `주주명부에 자녀 ${c.children}명` : `자녀 ${c.children}명(절세 현황)`)
      if (c.children === 0) return no('자녀 없음(절세 현황)')
      if (a === 'yes') return fit('대표 답: 자녀에게 지분을 넘길 계획 있음', 'succession')
      return ask('succession')
    }
    case 'tax-succession': {
      const corp = corpOnly(c, '가업승계 증여특례 받기')
      if (corp) return corp
      if (months !== null && months < 120) return no(`업력 ${Math.floor(months / 12)}년 — 가업승계 증여특례는 10년 이상 경영한 회사`)
      if (age !== null && age < 50) return no(`대표 만 ${age}세 — 증여특례는 60세 이상 부모가 줄 때(지금 준비할 단계는 아님)`)
      if (months === null || age === null) return data('업력 · 대표 나이를 알면 판단해요(10년 이상 경영 · 60세 이상)', [months === null ? '설립일' : '', age === null ? '대표 생년월일' : ''].filter(Boolean))
      const a = scenarioAnswer(c.record, 'succession')
      if (a === 'no') return no('대표 답: 자녀에게 지분을 넘길 계획 없음', 'succession')
      if (c.children === 0) return no('자녀 없음(절세 현황)')
      const basis = `업력 ${Math.floor(months / 12)}년 · 대표 만 ${age}세`
      if (c.children !== null && c.children > 0) return fit(`${basis} · 자녀 ${c.children}명`)
      if (a === 'yes') return fit(`${basis} · 대표 답: 물려줄 계획 있음`, 'succession')
      return ask('succession', `${SCENARIO_QUESTIONS.succession} — ${basis}`)
    }
    case 'tax-inherit': {
      const estate = c.p.estateRealEstate + c.p.estateFinancial + c.p.estateOther - c.p.estateDebt
      if (estate >= 10 * EOK) return fit(`대표 재산 약 ${krw(estate)} — 상속 공제(10억 안팎)를 넘어요`)
      if (age !== null && age >= 60) return fit(`대표 만 ${age}세 — 상속세를 미리 볼 때`)
      if (age !== null) return no(`대표 만 ${age}세${estate > 0 ? ` · 재산 약 ${krw(estate)}` : ''} — 지금 상속세를 따질 때는 아니에요`)
      return data('대표 나이(또는 재산)를 알면 판단해요', ['대표 생년월일'])
    }
    case 'tax-loan': {
      const corp = corpOnly(c, '가지급금 정리하기')
      if (corp) return corp
      if (c.loan !== null) return c.loan > 0 ? fit(`가지급금 ${krw(c.loan)}(절세 현황)`) : no('가지급금 0원(절세 현황)')
      return byAnswer(c, 'loan', '가지급금 있음', '가지급금 없음')
    }
    case 'tax-retire': {
      const corp = corpOnly(c, '대표 퇴직금 받기')
      if (corp) return corp
      if (age !== null && age >= 60) return fit(`대표 만 ${age}세 — 퇴임 · 퇴직금을 준비할 때`)
      return byAnswer(c, 'retire', '퇴임 · 중간정산 생각 있음', '퇴임 · 중간정산 생각 없음')
    }
    /* 고용지원금 — 채용 계획은 기록에 없다 → 묻는다 */
    case 'emp-youth':
      return byAnswer(c, 'hireYouth', '청년을 뽑을 계획 있음', '청년 채용 계획 없음')
    case 'emp-senior':
      return byAnswer(c, 'hireSenior', '만 60세 이상을 뽑을 계획 있음', '고령자 채용 계획 없음', c.roster && c.roster.senior > 0 ? `명부에 이미 만 60세 이상 ${c.roster.senior}명(계속고용은 명부 진단에서)` : '')
    case 'emp-childcare':
      if (f.employeeCount === 0) return no('직원 0명')
      return byAnswer(c, 'childcare', '육아휴직 직원 있음', '육아휴직 직원 없음')
    case 'emp-convert':
      if (f.employeeCount === 0) return no('직원 0명')
      return byAnswer(c, 'contract', '계약직 직원 있음', '계약직 직원 없음')
    /* 연구소 */
    case 'lab-two': {
      if (c.hasLab) return no('이미 연구소(전담부서)가 있어요 — 세액공제는 연구소 관리에서')
      if (isExcludedIndustryText(c.industryText)) return no(`업종(${c.industryText}) — 연구소 인정 제외 업종으로 보여요`)
      if (f.employeeCount !== null && f.employeeCount < 2) return no(`직원 ${f.employeeCount}명 — 연구원 2명을 두기 어려워요`)
      const a = scenarioAnswer(c.record, 'researchStaff')
      if (a === 'yes') return fit('대표 답: 연구 · 개발 맡을 직원 있음', 'researchStaff')
      if (a === 'no') return no('대표 답: 연구 · 개발 맡을 직원 없음', 'researchStaff')
      if (RND_INDUSTRY.test(c.industryText) && f.employeeCount !== null && f.employeeCount >= 5) return fit(`업종 ${c.industryText} · 직원 ${f.employeeCount}명 · 연구소 없음 — 설립을 검토할 만해요`)
      return ask('researchStaff', c.industryText ? `${SCENARIO_QUESTIONS.researchStaff} — 업종 ${c.industryText}` : '')
    }
    case 'lab-material':
      if (isExcludedIndustryText(c.industryText)) return no(`업종(${c.industryText}) — 연구소 인정 제외 업종으로 보여요`)
      return byAnswer(c, 'prototype', '올해 시제품 · 개발 재료비 듦', '시제품 · 개발 재료비 없음', c.hasLab ? '연구소 있음' : '')
    /* 창업감면 — 5년 안 */
    case 'startup-new':
      if (!est || months === null) return data('설립일을 알면 판단해요(창업 5년 안이 대상)', ['설립일(창업일)'])
      if (months >= 60) return no(`설립 ${est} — 창업 5년이 지나 감면 기간이 끝났어요`)
      return fit(`설립 ${est} — 창업 ${Math.floor(months / 12)}년 ${months % 12}개월(5년 안)`)
    case 'startup-convert':
      if (c.entity === 'individual') return no(`지금 개인사업자예요(${c.entityBasis})`)
      if (months !== null && months >= 60) return no(`설립 ${est} — 창업 5년이 지났어요`)
      return byAnswer(c, 'conversion', '개인사업자에서 법인으로 바꿈', '처음부터 법인')
    case 'startup-move': {
      if (months !== null && months >= 60) return no(`설립 ${est} — 창업 5년이 지났어요`)
      const { region, over } = startupRegion(f.address)
      if (!region) return data('본점 주소를 알면 판단해요(수도권 과밀억제권역 안이 대상)', ['회사 주소'])
      // D-209: 경기 · 인천은 시 · 구 · 동마다 달라 '모름' — 예전에는 모두 '이미 밖' 이라고 잘못 말했다
      if (over === 'unknown') return data(`본점 ${f.address.split(' ').slice(0, 2).join(' ')} — 이 시 · 구는 동마다 과밀억제권역 안팎이 달라요. 창업감면 판정에서 확인해요`, ['본점이 과밀억제권역 안인지(동 · 번지 — 창업감면 판정에서 고르기)'])
      if (over !== 'yes') return no('본점이 이미 과밀억제권역 밖이에요')
      return fit(`본점 ${f.address.split(' ').slice(0, 2).join(' ')} — 수도권 과밀억제권역 안`)
    }
    /* 정책자금 */
    case 'policy-working':
      if (c.revenue !== null && c.revenue > 0) return fit(`매출 ${krw(c.revenue)} — 운전자금 상담 대상`)
      if (f.employeeCount !== null && f.employeeCount > 0) return fit(`직원 ${f.employeeCount}명 — 인건비 운전자금 상담 대상`)
      return data('매출이나 직원 수를 알면 판단해요', ['최근 재무제표(매출)', '4대보험 가입자 명부(직원 수)'])
    case 'policy-facility':
      return byAnswer(c, 'facility', '설비 살 계획(견적) 있음', '설비 투자 계획 없음')
    case 'policy-hiring':
      return byAnswer(c, 'hireYouth', '청년을 뽑을 계획 있음', '청년 채용 계획 없음')
    default:
      return ask('facility')
  }
}
