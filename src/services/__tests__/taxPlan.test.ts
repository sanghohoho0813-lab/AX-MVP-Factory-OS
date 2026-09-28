/**
 * 절세 설계 시험 (D-130) — 원하는 결과를 적으면 계산기 식으로 거꾸로 찾는다.
 *  - 찾은 값을 계산기에 다시 넣으면 목표가 나온다(되돌려 확인)
 *  - 증여세 · 가지급금 · 주식가치는 계산기 밖의 숫자 함수로 따로 계산해 같은지 본다
 *  - 문장 읽기 · 주주 글 읽기 · 예전 기록(새 칸 없음)
 * 실행: npm run test:taxplan
 */

import { normalizeClientOps } from '../clientOpsService'
import { calculatorOf, computeSalary, defaultValues, inheritGiftTax, unlistedShareValuation } from '../taxCalc'
import {
  ASSUMPTIONS,
  calcDefault,
  checkProof,
  type Proof,
  cashPlan,
  giftPlan,
  holdersFromText,
  inheritancePlan,
  loanPlan,
  parseGoalText,
  profileSuggestions,
  retirePlan,
  salaryPlan,
  shareValueOf,
  splitPlan,
  SPLIT_YEARS,
  successionLimit,
  successionSpecialTax,
  viewProfile,
  wonOf,
  type TaxProfile,
} from '../taxPlan'
import type { ClientOpsRecord, ShareholderRow } from '../../types/clientOps'
import { parseTypedDate } from '../../lib/typedDate'

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' ' + JSON.stringify(detail)}`)
}

const TODAY = '2026-09-28'
const reg: ShareholderRow[] = [
  { id: 'a', name: '김대표', relation: 'ceo', shares: 60000, acquirePrice: 5000 },
  { id: 'b', name: '이배우', relation: 'spouse', shares: 25000, acquirePrice: 5000 },
  { id: 'c', name: '김자녀', relation: 'child', shares: 0, acquirePrice: 0 },
  { id: 'd', name: '박이사', relation: 'executive', shares: 15000, acquirePrice: 5000 },
]
const raw: TaxProfile = {
  monthlySalary: '800만',
  ceoStartDate: '2015-03-02',
  loanBalance: '3억',
  retainedEarnings: '20억',
  corpBand: '2억 이하',
  par: '5000',
  vRate: '10',
  vAsset: '50억',
  vDebt: '20억',
  vInc0: '4억',
  vInc1: '5억',
  vInc2: '6억',
  estateRealEstate: '15억',
  estateFinancial: '3억',
  children: '2',
}
const p = viewProfile(raw)

/* ---- 현황 ---- */
check('금액 글 읽기: 800만 · 1억 2천만 · 300백만 · 1,500,000', wonOf('800만') === 8e6 && wonOf('1억 2천만') === 1.2e8 && wonOf('300백만') === 3e8 && wonOf('1,500,000') === 1.5e6)
check('현황: 모르는 순이익은 null(0 으로 짐작하지 않음)', viewProfile({ vInc2: '6억' }).vInc[0] === null && viewProfile({ vInc2: '6억' }).vInc[2] === 6e8)
const sv = shareValueOf(p, reg)
const direct = unlistedShareValuation({ shares: 100000, ratePct: 10, asset: 5e9, debt: 2e9, reBook: 0, reFair: 0, severance: 0, goodwill: 0, corpType: '일반법인', income: [4e8, 5e8, 6e8], months: [0, 0, 0], caps: [0, 0, 0] })
check('주식가치: 09 식과 같다(발행주식 = 주주명부 합계 100,000주)', sv.source === '09' && sv.totalShares === 100000 && sv.perShare === Math.round(direct.finalPerShare), { sv: sv.perShare, direct: direct.finalPerShare })
check('주식가치: 직접 적으면 그 값', shareValueOf(viewProfile({ ...raw, perShareManual: '12만' }), reg).perShare === 120000)
const noInc = shareValueOf(viewProfile({ vAsset: '50억', vDebt: '20억', vInc2: '6억' }), reg)
check('주식가치: 없는 연도 순이익은 0원 + 알림', noInc.notes.some((n) => n.includes('2년 전 · 직전 연도')), noInc.notes)
check('주식가치: 재료가 없으면 계산하지 않는다', shareValueOf(viewProfile({}), reg).source === 'none')

/* ---- 급여 ---- */
const s20 = salaryPlan(p, { mode: 'rate', ratePct: 20 })
check('급여 · 실효 20%: 찾은 급여는 20% 이하', s20.ok && computeSalary(s20.monthly).effRate <= 0.2, s20.monthly)
check('급여 · 실효 20%: 1천원만 더 받아도 20% 넘음(가장 많이)', computeSalary(s20.monthly + 1000).effRate > 0.2, computeSalary(s20.monthly + 1000).effRate)
const net = salaryPlan(p, { mode: 'net', netMonthly: 8e6 })
check('급여 · 세후 월 800만: 찾은 급여로 세후 800만 이상', net.ok && computeSalary(net.monthly).afterTax / 12 >= 8e6, net.monthly)
check('급여 · 세후 월 800만: 1천원 적으면 모자람', computeSalary(net.monthly - 1000).afterTax / 12 < 8e6)
check('급여 · 너무 낮은 실효율은 안 된다고 말한다', !salaryPlan(p, { mode: 'rate', ratePct: 3 }).ok)
const mn = salaryPlan(p, { mode: 'min' })
check('급여 · 순유출 최소: 01 계산기 표의 노란 줄(100만~2,000만 중 최소)', mn.ok && mn.monthly === mn.best.low.m)

/* ---- 현금 1억 ---- */
const cash = cashPlan(p, reg, sv, 1e8, TODAY)
const ok = cash.routes.filter((r) => r.ok)
check('현금 1억: 되는 방법이 둘 이상', ok.length >= 2, cash.routes.map((r) => [r.key, r.ok, r.reason]))
for (const r of ok) {
  const slack = r.key === 'shareSale' ? sv.perShare : 20000
  check(`현금 1억 · ${r.label}: 손에 1억 이상 · 넘친 것은 작다`, r.net >= 1e8 - 1 && r.net - 1e8 < slack, { net: r.net })
  check(`현금 1억 · ${r.label}: 순부담 = 세금 − 법인세 절감`, Math.abs(r.netBurden - (r.personalTax - r.corpSaving)) < 1)
}
check('현금 1억: 추천은 되는 것 중 순부담이 가장 적은 것(퇴직금 · ★다툼 있는 방법 제외)', !!cash.best && ok.filter((r) => r.key !== 'retire' && !r.unsafe).every((r) => cash.best!.netBurden <= r.netBurden + 1))
const div = cash.routes.find((r) => r.key === 'dividend')!
check('현금 1억 · 배당: 지분 60% 라 회사 전체 배당은 대표 몫 ÷ 0.6', div.ok && Math.abs(div.companyOut - (div.net + div.personalTax) / 0.6) < 2, div)
const sal = cash.routes.find((r) => r.key === 'salary')!
const r0 = computeSalary(8e6)
const m1 = Number(sal.open?.values.s_monthly)
check('현금 1억 · 급여: 늘어난 세금 = 01 계산기 개인부담 차이', sal.ok && Math.abs(sal.personalTax - (computeSalary(m1).personalTotal - r0.personalTotal)) < 1 && sal.companyOut === (m1 - 8e6) * 12, { m1 })
const poor = cashPlan(viewProfile({ ...raw, retainedEarnings: '5천만' }), reg, sv, 1e8, TODAY)
check('현금 1억 · 배당: 잉여금 5천만이면 안 된다고 한다', poor.routes.find((r) => r.key === 'dividend')?.ok === false)
check('현금: 대표 주식이 없으면 주식 팔기는 까닭을 댄다', cashPlan(p, [], sv, 1e8, TODAY).routes.find((r) => r.key === 'shareSale')?.reason.includes('대표 주식') === true)
check('현금: 취임일이 없으면 퇴직금은 까닭을 댄다', cashPlan(viewProfile({ ...raw, ceoStartDate: '' }), reg, sv, 1e8, TODAY).routes.find((r) => r.key === 'retire')?.reason.includes('취임일') === true)

/* ---- 증여 ---- */
const g10 = giftPlan(p, reg, sv, { recipientId: 'c', mode: 'pct', amount: 10 })
const expectTax = inheritGiftTax(Math.max(10000 * sv.perShare - 5e7, 0))
check('증여 10%: 1만주 · 성년 자녀 공제 5천만 · 세금은 세율표 그대로', g10.ok && g10.qty === 10000 && g10.deduction === 5e7 && Math.abs(g10.tax - expectTax) < 1, { tax: g10.tax, expectTax })
check('증여 10%: 대표 60% → 50% · 자녀 0% → 10%', Math.abs(g10.ceoAfterPct - 50) < 1e-9 && Math.abs(g10.recipientAfterPct - 10) < 1e-9)
const free = giftPlan(p, reg, sv, { recipientId: 'c', mode: 'free', amount: 0 })
check('증여 · 세금 없이: 공제 5천만 안의 주식 수 · 세금 0', free.tax === 0 && free.qty === Math.floor(5e7 / sv.perShare))
const budget = giftPlan(p, reg, sv, { recipientId: 'c', mode: 'budget', amount: 1e8 })
const nextTax = giftPlan(p, reg, sv, { recipientId: 'c', mode: 'shares', amount: budget.qty + 1 }).tax
check('증여 · 세금 1억 이하 최대: 한 주 더 주면 1억 넘음', budget.tax <= 1e8 && nextTax > 1e8, { q: budget.qty, tax: budget.tax, nextTax })
const minor = giftPlan(p, [...reg.slice(0, 2), { id: 'm', name: '막내', relation: 'minor_child', shares: 0, acquirePrice: 0 }], sv, { recipientId: 'm', mode: 'free', amount: 0 })
check('증여 · 미성년 자녀 공제 2천만', minor.deduction === 2e7)
check('증여 · 받는 사람 없으면 묻는다', !giftPlan(p, reg, sv, { recipientId: 'zz', mode: 'pct', amount: 10 }).ok)

/* ---- D-131: 자사주 소각 · 배우자 증여 후 소각 ---- */
const burn = cash.routes.find((r) => r.key === 'shareBurn')!
check('자사주 소각: 손에 1억 이상 · 넘친 것은 1주 값 미만', burn.ok && burn.net >= 1e8 - 1 && burn.net - 1e8 < sv.perShare, { net: burn.net })
check('자사주 소각: 의제배당 = 받은 돈 − 취득가(5,000원) · ★ 표시', burn.lines[1].includes('의제배당') && burn.verify.length > 0)
check('자사주 양도에도 ★(목적 판정)', (cash.routes.find((r) => r.key === 'shareSale')?.verify.length ?? 0) > 0)
const spouse = cash.routes.find((r) => r.key === 'spouseBurn')!
check('배우자 증여 후 소각: 계산은 하되 추천하지 않고 맨 뒤 · ★ · 돈은 배우자에게', spouse.unsafe === true && cash.best?.key !== 'spouseBurn' && cash.routes[cash.routes.length - 1].key === 'spouseBurn' && spouse.receiver === '배우자' && spouse.verify.length >= 2)
check('배우자 증여 후 소각: 1억어치는 배우자 공제 6억 안이라 증여세 0', spouse.personalTax === 0, spouse.personalTax)

/* ---- D-131: 가업승계 증여세 과세특례 ---- */
check('특례 세액: 50억 → (50억 − 10억) × 10% = 4억', successionSpecialTax(5e9) === 4e8)
check('특례 세액: 150억 → 120억 × 10% + 20억 × 20% = 16억', successionSpecialTax(1.5e10) === 1.2e9 + 2e9 * 0.2)
check('특례 세액: 10억 이하는 0', successionSpecialTax(1e9) === 0 && successionSpecialTax(3e8) === 0)
check('특례 한도: 10년 300억 · 20년 400억 · 30년 600억 · 10년 미만 0', successionLimit(10) === 3e10 && successionLimit(25) === 4e10 && successionLimit(31) === 6e10 && successionLimit(9) === 0 && successionLimit(null) === 0)
const pOld = viewProfile({ ...raw, ceoAge: '65', bizYears: '15' })
const big = giftPlan(pOld, reg, sv, { recipientId: 'c', mode: 'pct', amount: 50 })
check('특례: 요건(60세 · 18세 자녀 · 10년) 맞으면 · 업종은 확인 필요', !!big.succession && big.succession.checks[0].state === 'ok' && big.succession.checks[2].state === 'ok' && big.succession.state === 'unknown')
check('특례: 22억(5만주) → (22억 − 10억) × 10% = 1.2억 · 일반보다 적음', !!big.succession && big.succession.specialTax === (5e4 * sv.perShare - 1e9) * 0.1 && big.succession.total < big.tax, big.succession)
check('특례: 가업자산 비율을 안 적으면 ★', big.succession!.verify.some((v) => v.includes('가업자산 비율')))
const young = giftPlan(viewProfile({ ...raw, ceoAge: '52', bizYears: '15' }), reg, sv, { recipientId: 'c', mode: 'pct', amount: 10 })
check('특례: 대표 52세면 요건 안 됨', young.succession?.state === 'no' && young.succession.checks[0].state === 'no')
const half = giftPlan(viewProfile({ ...raw, ceoAge: '65', bizYears: '15', bizAssetRatio: '80' }), reg, sv, { recipientId: 'c', mode: 'pct', amount: 50 })
check('특례: 가업자산 80% → 20% 몫은 특례 밖(일반 증여세)', !!half.succession && Math.abs(half.succession.excessValue - 5e4 * sv.perShare * 0.2) < 1 && half.succession.excessTax > 0)
check('특례: 배우자에게는 특례 비교 없음', giftPlan(pOld, reg, sv, { recipientId: 'b', mode: 'shares', amount: 100 }).succession === null)

/* ---- 상속 ---- */
const inh = inheritancePlan(p, reg, sv, g10)
check('상속: 대표 재산 = 부동산 + 금융 + 주식(6만주 × 1주 가치)', inh.ok && inh.estate === 15e8 + 3e8 + 60000 * sv.perShare && inh.taxNow > 0, inh)
check('상속: 증여 뒤 10년 지나면 상속세가 준다', !!inh.withGift && inh.withGift.after10 < inh.taxNow)
check('상속: 10년 안이면 증여가 다시 더해진다(10년 뒤보다 많다)', !!inh.withGift && inh.withGift.within10 >= inh.withGift.after10)

const fb = inheritancePlan(viewProfile({ ...raw, bizYears: '15' }), reg, sv, null)
check('가업상속공제 ★: 15년 경영 → 주식가치 전부 공제(한도 300억 안) · 상속세가 준다', !!fb.familyBiz && fb.familyBiz.deduction === 60000 * sv.perShare && fb.familyBiz.tax < fb.taxNow && fb.familyBiz.verify.length > 0)
check('가업상속공제: 경영 햇수를 모르면 계산하지 않는다', inheritancePlan(p, reg, sv, null).familyBiz === null)

/* ---- 가지급금 · 퇴직금 ---- */
const loan = loanPlan(p)
const a = computeSalary(8e6)
const b = computeSalary(8.1e6)
const marginal = (b.finalTax + b.localTax - (a.finalTax + a.localTax)) / 1.2e6
const expectLoss = 3e8 * 0.046 * (0.11 + Math.round(marginal * 1000) / 1000 + 0.09)
check('가지급금 3억: 1년 손실 = 인정이자 × (법인세 + 대표 한계세율 + 4대보험)', loan.ok && Math.abs(loan.yearLoss - expectLoss) < 2, { got: loan.yearLoss, expectLoss })
check('가지급금: 10년 = 1년 × 10', Math.abs(loan.tenYear - loan.yearLoss * 10) < 11)
const ret = retirePlan(p, TODAY)
check('퇴직금: 한도 · 세금 · 세후', ret.ok && ret.limit > 0 && ret.tax > 0 && Math.abs(ret.net - (ret.limit - ret.tax)) < 1, ret)

/* ---- 문장 읽기 ---- */
const q1 = parseGoalText('이번에 1억 현금화하고 싶어')
check('문장: 1억 현금화 → 현금 1억', q1.goals.includes('cash') && q1.cash === 1e8, q1)
const q2 = parseGoalText('급여를 실효세율 20%로 맞추고 싶어')
check('문장: 급여 실효 20%', q2.salary?.mode === 'rate' && q2.salary.ratePct === 20 && !q2.goals.includes('cash'), q2)
const q3 = parseGoalText('세후 월 800만원 받게 급여 정해줘')
check('문장: 세후 월 800만 급여', q3.salary?.mode === 'net' && q3.salary.netMonthly === 8e6 && !q3.goals.includes('cash'), q3)
const q4 = parseGoalText('자녀에게 지분 30% 증여')
check('문장: 자녀에게 30% 증여', q4.gift?.mode === 'pct' && q4.gift.amount === 30, q4)
const q5 = parseGoalText('가지급금 3억 정리')
check('문장: 가지급금 3억 → 손실 + 갚을 돈 가져오기', q5.goals.includes('loan') && q5.loan === 3e8 && q5.cash === 3e8, q5)
const q6 = parseGoalText('가업승계 준비')
check('문장: 가업승계 → 증여 + 상속', q6.goals.includes('gift') && q6.goals.includes('inherit'), q6)
check('문장: 1억 5천만원', parseGoalText('1억 5천만원 필요해').cash === 1.5e8)
check('문장: 퇴직', parseGoalText('퇴직금 얼마까지 되나').goals.includes('retire'))
const q7 = parseGoalText('자사주 소각으로 1억 가져오기')
check('문장: 자사주 소각 1억 → 현금 1억(양도 · 소각 비교)', q7.goals.includes('cash') && q7.cash === 1e8, q7)
const q8 = parseGoalText('자사주 소각으로 1억, 가업승계 특례로 자녀에게 지분 30%')
check('문장: 1억 현금 + 지분 30% 증여를 함께', q8.cash === 1e8 && q8.gift?.mode === 'pct' && q8.gift.amount === 30, q8)
check('문장: 가업승계 특례', parseGoalText('가업승계 특례 알려줘').goals.includes('gift'))
check('문장: 아무 말 없으면 아무 목표도 없음', parseGoalText('   ').goals.length === 0)

/* ---- 주주 글 · 예전 기록 ---- */
const hs = holdersFromText('대표 60% · 배우자 25% · 김이사 15% / 등기임원 2명', '김대표')
check('주주 글: 대표 · 배우자 · 이사 — 지분율만(주식 수 짐작 없음)', hs.length === 3 && hs[0].relation === 'ceo' && hs[0].name === '김대표' && hs[1].relation === 'spouse' && hs[2].relation === 'executive' && hs[2].pct === 15, hs)
const old = normalizeClientOps({ id: 'x', companyName: 'x' } as Partial<ClientOpsRecord>)
check('예전 기록: 주주명부 [] · 절세 현황 {}', Array.isArray(old.shareholderRegister) && old.shareholderRegister.length === 0 && Object.keys(old.taxProfile).length === 0)
const cleaned = normalizeClientOps({ id: 'y', companyName: 'y', shareholderRegister: [{ id: '', name: '갑', relation: 'weird', shares: -3, acquirePrice: '5,000' }] } as unknown as Partial<ClientOpsRecord>)
check('주주명부 정리: 모르는 관계 → 기타 · 음수 → 0 · 글자 숫자 읽기', cleaned.shareholderRegister[0].relation === 'other' && cleaned.shareholderRegister[0].shares === 0 && cleaned.shareholderRegister[0].acquirePrice === 5000 && cleaned.shareholderRegister[0].id !== '')
const withFacts = normalizeClientOps({ id: 'z', companyName: 'z', establishedAt: '2019-03-02', factValues: { totalAssets: '5000000000', netIncome: '600000000' } } as Partial<ClientOpsRecord>)
const sug = profileSuggestions(withFacts, {}, '2026-09-28')
check('업체 기록에서 채우기: 자산 · 순이익(결산 연도) · 설립일 — 빈 칸에만', sug.some((x) => x.key === 'vAsset' && x.value === '5000000000') && sug.some((x) => x.key === 'vInc2') && sug.some((x) => x.key === 'ceoStartDate') && profileSuggestions(withFacts, { vAsset: '1억' }).every((x) => x.key !== 'vAsset') && sug.some((x) => x.key === 'bizYears' && x.value === '7'))

/* ---- D-131: 큰 달력 직접 적기 ---- */
check('날짜 적기: 20150302 · 2015-03-02 · 2015.3.2 · 2015/3/2 · 2015년 3월 2일', ['20150302', '2015-03-02', '2015.3.2', '2015/3/2', '2015년 3월 2일'].every((t) => parseTypedDate(t) === '2015-03-02'))
check('날짜 적기: 없는 날짜(2월 30일 · 13월) · 글은 null', parseTypedDate('20260230') === null && parseTypedDate('2026.13.1') === null && parseTypedDate('내일') === null)
check('날짜 적기: 윤년 2월 29일', parseTypedDate('2024.2.29') === '2024-02-29' && parseTypedDate('2025.2.29') === null)

/* ---- D-132: 원본 식 지킴이 ---- */
const dv = (c: string, f: string) => defaultValues(calculatorOf(c)!)[f]
check('가정 = 계산기 기본값: 03 인적공제 · 07 인정이자 · 4대보험 · 차입이자 · 기간 · 02 지급배수 · 09 환원율',
  ASSUMPTIONS.personalDed === dv('t9', 'inc_a_personalDed') && ASSUMPTIONS.loanRate === dv('t1', 'g_rate') && ASSUMPTIONS.loanIns === dv('t1', 'g_ins') &&
  ASSUMPTIONS.loanBorrow === dv('t1', 'g_borrow') && ASSUMPTIONS.loanYears === dv('t1', 'g_years') && ASSUMPTIONS.retireMultPre === dv('t6', 'r_mult_pre') &&
  ASSUMPTIONS.retireMultPost === dv('t6', 'r_mult_post') && ASSUMPTIONS.valuationRate === dv('t3', 'v_rate'), ASSUMPTIONS)
check('법인세 절감률 = 01 계산기 식(과표 2억 이하 · 초과)', Math.abs(ASSUMPTIONS.corpRateLow - computeSalary(5e6).corpSaveLow / 6e7) < 1e-12 && Math.abs(ASSUMPTIONS.corpRateHigh - computeSalary(5e6).corpSaveHigh / 6e7) < 1e-12)
let threw = false
try {
  calcDefault('t1', '없는칸')
} catch {
  threw = true
}
check('계산기에 없는 칸을 가정으로 쓰려 하면 멈춘다(짐작하지 않음)', threw)

const proofsOf = (): (Proof | null | undefined)[] => [
  ...cash.routes.map((r) => r.proof),
  salaryPlan(p, { mode: 'rate', ratePct: 20 }).proof,
  g10.proof,
  inh.proof,
  fb.familyBiz?.proof,
  loan.proof,
  ret.proof,
]
const proofs = proofsOf().filter((x): x is Proof => !!x)
const bad = proofs.filter((pf) => !checkProof(pf).ok)
check(`대조: 결과 ${proofs.length}개가 모두 같은 값으로 계산기를 열었을 때와 같다`, proofs.length >= 10 && bad.length === 0, bad.map((b) => [b.calc, b.k, b.expect, checkProof(b).got]))
check('대조: 계산기 밖 식에는 표시(특례 · 섞기 · 배우자 소각 · 퇴직금 법인세 절감)', !!big.succession?.outside && cash.routes.filter((r) => r.outside).length >= 2)
check('대조: 틀린 숫자는 잡아낸다', !checkProof({ ...proofs[0], expect: proofs[0].expect + 1000 }).ok)

check('금액: "1억 5천" = 1억 5천만 · "5천" 은 5천원인지 5천만원인지 몰라 읽지 않음 · 음수 급여는 0', wonOf('1억 5천') === 1.5e8 && wonOf('1억5천') === 1.5e8 && wonOf('5천') === 0 && viewProfile({ monthlySalary: '-300만' }).monthlySalary === 0)

// 무작위 현황 — 어떤 값이 들어와도 멈추거나 NaN 이 나오지 않고, 목표를 채우고, 계산기와 같다
{
  let seed = 20260928
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
  let cases = 0
  let broken: string[] = []
  for (let i = 0; i < 40; i++) {
    const total = pick([1000, 10000, 100000, 1000000])
    const ceoPct = pick([0.3, 0.51, 0.8, 1])
    const regR: ShareholderRow[] = [
      { id: 'a', name: '대표', relation: 'ceo', shares: Math.round(total * ceoPct), acquirePrice: pick([0, 500, 5000, 10000]) },
      { id: 'b', name: '자녀', relation: pick(['child', 'minor_child'] as const), shares: Math.round(total * (1 - ceoPct)), acquirePrice: 0 },
    ]
    const prof: TaxProfile = {
      monthlySalary: String(pick([0, 2e6, 8e6, 3e7])),
      ceoStartDate: pick(['', '2005-01-10', '2019-12-31', '2024-06-01']),
      retainedEarnings: String(pick([0, 5e7, 3e9])),
      corpBand: pick(['2억 이하', '2억 초과']),
      par: String(pick([0, 500, 5000])),
      vAsset: String(pick([0, 3e8, 5e9, 8e10])),
      vDebt: String(pick([0, 1e8, 2e9])),
      vInc0: pick(['', '-2억', '1억']),
      vInc1: pick(['', '0', '3억']),
      vInc2: pick(['', '-5000만', '6억', '30억']),
      loanBalance: String(pick([0, 5e7, 1e9])),
      estateRealEstate: String(pick([0, 1e9])),
      children: pick(['', '0', '2']),
      ceoAge: pick(['', '45', '65']),
      bizYears: pick(['', '5', '12', '35']),
    }
    const pv = viewProfile(prof)
    const svR = shareValueOf(pv, regR)
    const target = pick([1e7, 1e8, 5e8, 2e9])
    try {
      const cp = cashPlan(pv, regR, svR, target, TODAY)
      const sp = salaryPlan(pv, { mode: pick(['rate', 'net', 'min'] as const), ratePct: pick([12, 20, 35]), netMonthly: pick([3e6, 8e6, 3e7]) })
      const gp = giftPlan(pv, regR, svR, { recipientId: 'b', mode: pick(['pct', 'free', 'budget', 'value'] as const), amount: pick([10, 1e8, 5e8]) })
      const ip = inheritancePlan(pv, regR, svR, gp)
      const lp = loanPlan(pv)
      const rp = retirePlan(pv, TODAY)
      const nums = [
        ...cp.routes.flatMap((r) => [r.companyOut, r.personalTax, r.corpSaving, r.netBurden, r.net]),
        gp.tax, gp.value, ip.taxNow, lp.yearLoss, rp.limit, rp.tax, sp.monthly,
        ...(gp.succession ? [gp.succession.total, gp.succession.general] : []),
      ]
      if (nums.some((n) => !Number.isFinite(n))) broken.push(`${i}: NaN/Infinity`)
      for (const r of cp.routes) if (r.ok && !r.unsafe && r.key !== 'mix' && r.net < target - 1) broken.push(`${i}: ${r.key} 손에 ${r.net} < ${target}`)
      if (cp.best?.unsafe) broken.push(`${i}: 다툼 있는 방법이 추천됨`)
      if (i < 10) {
        const spR = splitPlan(pv, regR, svR, target, TODAY)
        for (const r of spR.rows) {
          if (!Number.isFinite(r.total)) broken.push(`${i}: 나눠 ${r.years}년 NaN`)
          if (r.ok && r.steps.some((x) => x.unsafe || x.key === 'retire')) broken.push(`${i}: 나눠 ${r.years}년에 다툼 · 퇴직금`)
          for (const pf of r.proofs) if (!checkProof(pf).ok) broken.push(`${i}: 나눠 ${r.years}년 대조 ${pf.k}`)
        }
        if (spR.rows[0]?.ok !== !!cp.best) broken.push(`${i}: 나눠 1년 ≠ 추천`)
      }
      const pfs = [...cp.routes.map((r) => r.proof), sp.proof, gp.proof, ip.proof, ip.familyBiz?.proof, lp.proof, rp.proof].filter((x): x is Proof => !!x)
      for (const pf of pfs) if (!checkProof(pf).ok) broken.push(`${i}: ${pf.calc} ${pf.k} ${pf.expect} ≠ ${checkProof(pf).got}`)
      cases += 1
    } catch (e) {
      broken.push(`${i}: 멈춤 ${String(e)}`)
    }
  }
  broken = broken.slice(0, 8)
  check(`무작위 현황 ${cases}벌: 멈춤 · NaN 0 · 목표 채움 · 계산기 대조 전부 일치 · 다툼 방법 추천 0 · 나눠 가져오기 10벌`, cases === 40 && broken.length === 0, broken)
}


/* ---------------- D-133 나눠 가져오기 ---------------- */
{
  const t0 = Date.now()
  const sp = splitPlan(p, reg, sv, 1e8, TODAY)
  const ms = Date.now() - t0
  check(`나눠: 1 · 2 · 3 · 5년 네 줄 (${ms}ms)`, sp.rows.map((r) => r.years).join(',') === SPLIT_YEARS.join(','), sp.rows.map((r) => r.years))
  const one = sp.rows[0]
  check('나눠: 1년 줄 = 현금 가져오기 추천과 같은 방법 · 같은 순부담', one.ok && one.steps[0].key === cash.best?.key && Math.abs(one.total - (cash.best?.netBurden ?? -1)) < 1, [one.total, cash.best?.netBurden])
  check('나눠: 해마다 목표만큼 손에(합이 목표 이상)', sp.rows.filter((r) => r.ok).every((r) => r.steps.length === r.years && r.steps.reduce((a, x) => a + x.net, 0) >= 1e8 - r.years * 2), sp.rows.map((r) => [r.years, Math.round(r.steps.reduce((a, x) => a + x.net, 0))]))
  check('나눠: 가장 싼 줄 ≤ 1년에 다 · 아끼는 돈 = 차이', !!sp.best && sp.best.total <= one.total + 1 && Math.abs(sp.saving - (one.total - sp.best.total)) < 1, [sp.best?.years, sp.best?.total, one.total, sp.saving])
  check('나눠: 해마다 결과도 계산기로 다시 맞춰 보면 같다', sp.rows.flatMap((r) => r.proofs).length >= 5 && sp.rows.flatMap((r) => r.proofs).every((pf) => checkProof(pf).ok))
  check('나눠: 계산기 밖(더하기 · 해마다 같다고 봄) 표시', sp.outside.includes('해마다') && sp.outside.includes('더한'))
  const soldAll = sp.rows.map((r) => r.steps.reduce((a, x) => a + (x.soldShares ?? 0), 0))
  check('나눠: 해마다 판 주식의 합 ≤ 대표 주식', soldAll.every((n) => n <= 60000), soldAll)
  // 배당가능이익 1억 · 주식가치 모름(주식 방법 안 됨) → 급여 · 배당만. 배당으로 쓴 이익의 합은 1억을 넘지 않는다
  const tight = viewProfile({ ...raw, retainedEarnings: '1억', vAsset: '', vDebt: '', vInc0: '', vInc1: '', vInc2: '' })
  const spT = splitPlan(tight, reg, shareValueOf(tight, reg), 1.5e8, TODAY)
  const used = spT.rows.map((r) => r.steps.filter((x) => x.key === 'dividend' || x.key === 'shareBurn' || x.key === 'mix').reduce((a, x) => a + (x.fromEarnings ?? 0), 0))
  check('나눠: 배당가능이익은 해마다 줄어든다(배당으로 쓴 합 ≤ 1억)', spT.rows.some((r) => r.ok && r.years > 1) && used.every((u) => u <= 1e8 + 1), spT.rows.map((r, k) => [r.years, r.ok, Math.round(used[k]), r.steps.map((x) => x.key).join(',')]))
  const sale = cashPlan(viewProfile({ ...raw, retainedEarnings: '1억' }), reg, sv, 3e8, TODAY).routes.find((r) => r.key === 'shareSale')
  check('주식 팔기: 회사가 사기에 이익이 모자라면 그렇다고 적는다', sale?.conditions.some((x) => x.includes('다른 사람에게 팔아야')) === true, sale?.conditions)
  check('나눠: 금액이 없으면 줄 없음', splitPlan(p, reg, sv, 0, TODAY).rows.length === 0)
  const sp5 = splitPlan(p, reg, sv, 5e8, TODAY)
  check('나눠: 5억도 오류 없이 · 합 NaN 0', sp5.rows.every((r) => Number.isFinite(r.total) && Number.isFinite(r.totalTax)), sp5.rows.map((r) => r.total))
  if (process.env.SHOW) for (const x of [sp, spT, sp5]) console.log(x.target, x.rows.map((r) => `${r.years}년 ${r.ok ? Math.round(r.total) : r.reason} [${r.steps.map((s) => s.key).join(',')}]`).join(' | '), 'best', x.best?.years, 'save', Math.round(x.saving))
}

if (process.env.SHOW) {
  console.log('주식', sv.perShare, sv.total)
  for (const r of cash.routes) console.log(r.label, r.ok, r.reason, 'out', Math.round(r.companyOut), 'tax', Math.round(r.personalTax), 'save', Math.round(r.corpSaving), 'burden', Math.round(r.netBurden), r.lines.join(' / '))
  console.log('best', cash.best?.label, cash.notes)
  console.log('gift10', g10.tax, g10.lines, 'inh', inh.taxNow, inh.withGift)
  console.log('loan', loan.yearLoss, loan.tenYear, 'retire', ret.limit, ret.tax, 's20', s20.monthly, 'net800', net.monthly, 'min', mn.monthly)
}
console.log(`\ntax-plan: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
