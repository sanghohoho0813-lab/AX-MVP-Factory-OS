/**
 * 절세 설계 시험 (D-130) — 원하는 결과를 적으면 계산기 식으로 거꾸로 찾는다.
 *  - 찾은 값을 계산기에 다시 넣으면 목표가 나온다(되돌려 확인)
 *  - 증여세 · 가지급금 · 주식가치는 계산기 밖의 숫자 함수로 따로 계산해 같은지 본다
 *  - 문장 읽기 · 주주 글 읽기 · 예전 기록(새 칸 없음)
 * 실행: npm run test:taxplan
 */

import { normalizeClientOps } from '../clientOpsService'
import { computeSalary, inheritGiftTax, unlistedShareValuation } from '../taxCalc'
import {
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
  viewProfile,
  wonOf,
  type TaxProfile,
} from '../taxPlan'
import type { ClientOpsRecord, ShareholderRow } from '../../types/clientOps'

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
check('현금 1억: 추천은 되는 것 중 순부담이 가장 적은 것(퇴직금 제외)', !!cash.best && ok.filter((r) => r.key !== 'retire').every((r) => cash.best!.netBurden <= r.netBurden + 1))
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

/* ---- 상속 ---- */
const inh = inheritancePlan(p, reg, sv, g10)
check('상속: 대표 재산 = 부동산 + 금융 + 주식(6만주 × 1주 가치)', inh.ok && inh.estate === 15e8 + 3e8 + 60000 * sv.perShare && inh.taxNow > 0, inh)
check('상속: 증여 뒤 10년 지나면 상속세가 준다', !!inh.withGift && inh.withGift.after10 < inh.taxNow)
check('상속: 10년 안이면 증여가 다시 더해진다(10년 뒤보다 많다)', !!inh.withGift && inh.withGift.within10 >= inh.withGift.after10)

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
check('문장: 아무 말 없으면 아무 목표도 없음', parseGoalText('   ').goals.length === 0)

/* ---- 주주 글 · 예전 기록 ---- */
const hs = holdersFromText('대표 60% · 배우자 25% · 김이사 15% / 등기임원 2명', '김대표')
check('주주 글: 대표 · 배우자 · 이사 — 지분율만(주식 수 짐작 없음)', hs.length === 3 && hs[0].relation === 'ceo' && hs[0].name === '김대표' && hs[1].relation === 'spouse' && hs[2].relation === 'executive' && hs[2].pct === 15, hs)
const old = normalizeClientOps({ id: 'x', companyName: 'x' } as Partial<ClientOpsRecord>)
check('예전 기록: 주주명부 [] · 절세 현황 {}', Array.isArray(old.shareholderRegister) && old.shareholderRegister.length === 0 && Object.keys(old.taxProfile).length === 0)
const cleaned = normalizeClientOps({ id: 'y', companyName: 'y', shareholderRegister: [{ id: '', name: '갑', relation: 'weird', shares: -3, acquirePrice: '5,000' }] } as unknown as Partial<ClientOpsRecord>)
check('주주명부 정리: 모르는 관계 → 기타 · 음수 → 0 · 글자 숫자 읽기', cleaned.shareholderRegister[0].relation === 'other' && cleaned.shareholderRegister[0].shares === 0 && cleaned.shareholderRegister[0].acquirePrice === 5000 && cleaned.shareholderRegister[0].id !== '')
const withFacts = normalizeClientOps({ id: 'z', companyName: 'z', establishedAt: '2019-03-02', factValues: { totalAssets: '5000000000', netIncome: '600000000' } } as Partial<ClientOpsRecord>)
const sug = profileSuggestions(withFacts, {})
check('업체 기록에서 채우기: 자산 · 순이익(결산 연도) · 설립일 — 빈 칸에만', sug.some((x) => x.key === 'vAsset' && x.value === '5000000000') && sug.some((x) => x.key === 'vInc2') && sug.some((x) => x.key === 'ceoStartDate') && profileSuggestions(withFacts, { vAsset: '1억' }).every((x) => x.key !== 'vAsset'))

if (process.env.SHOW) {
  console.log('주식', sv.perShare, sv.total)
  for (const r of cash.routes) console.log(r.label, r.ok, r.reason, 'out', Math.round(r.companyOut), 'tax', Math.round(r.personalTax), 'save', Math.round(r.corpSaving), 'burden', Math.round(r.netBurden), r.lines.join(' / '))
  console.log('best', cash.best?.label, cash.notes)
  console.log('gift10', g10.tax, g10.lines, 'inh', inh.taxNow, inh.withGift)
  console.log('loan', loan.yearLoss, loan.tenYear, 'retire', ret.limit, ret.tax, 's20', s20.monthly, 'net800', net.monthly, 'min', mn.monthly)
}
console.log(`\ntax-plan: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
