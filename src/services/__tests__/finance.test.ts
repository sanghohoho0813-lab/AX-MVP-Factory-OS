/**
 * 매출 · 비용 시험 (D-142).
 *  - 매출은 계약 수금 항목에서: 입금일 달 = 들어온 돈 · 받기로 한 날 달 = 들어올 예정 · 이번 달엔 미수금 · 날짜 없는 청구 가능도
 *  - 조건 대기 · 날짜 없는 예전 항목 · 아직 안 나눈 계약금액 = 시기 미정(달에 안 넣음)
 *  - 정기 결제: 매월 N일(31일 → 그 달 마지막 날) · 연 결제 · 시작 전 · 해지 뒤 · 달러 환산 · 다음 결제일 · 3일 안 결제
 *  - 비용: 그 달 쓴 돈 · 영업자 수수료(준 날) · 분류별 · CSV · 금액 글 읽기
 * 실행: npm run test:finance
 */
import { normalizeClientOps } from '../clientOpsService'
import {
  DEFAULT_SETTINGS,
  isActiveSub,
  addMonths,
  chargeDateIn,
  costCsv,
  costInMonth,
  krwShort,
  monthSummary,
  monthlyEquivalent,
  moneyText,
  nextCharge,
  normalizeExpense,
  normalizeSettings,
  normalizeSubscription,
  outlook,
  parseAmount,
  revenueInMonth,
  toKrw,
  undatedRevenue,
  upcomingCharges,
  type Expense,
  type Subscription,
} from '../finance/financeCore'

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) pass += 1
  else {
    fail += 1
    console.log('FAIL', name, detail === undefined ? '' : JSON.stringify(detail))
  }
}

const TODAY = '2026-10-02'
const S = { usdKrw: 1400, rateSet: true }

const sub = (p: Partial<Subscription>): Subscription => ({
  id: 's',
  name: 'Claude',
  category: 'ai',
  amount: 20,
  currency: 'USD',
  cycle: 'monthly',
  billingDay: 5,
  billingMonth: 1,
  startDate: '',
  endDate: '',
  payMethod: 'corp_card',
  memo: '',
  createdAt: '',
  updatedAt: '',
  ...p,
})
const exp = (p: Partial<Expense>): Expense => ({ id: 'e', date: '2026-10-01', name: '택시', category: 'travel', amount: 12000, currency: 'KRW', payMethod: 'corp_card', memo: '', clientId: '', createdAt: '', updatedAt: '', ...p })

/* ---------------- 날짜 ---------------- */
{
  check('결제일: 매월 5일', chargeDateIn(sub({}), '2026-10') === '2026-10-05')
  check('결제일: 31일 → 9월 30일 · 2월 28일', chargeDateIn(sub({ billingDay: 31 }), '2026-09') === '2026-09-30' && chargeDateIn(sub({ billingDay: 31 }), '2027-02') === '2027-02-28')
  check('결제일: 연 결제는 그 달에만', chargeDateIn(sub({ cycle: 'yearly', billingMonth: 3, billingDay: 10 }), '2027-03') === '2027-03-10' && chargeDateIn(sub({ cycle: 'yearly', billingMonth: 3 }), '2026-10') === '')
  check('결제일: 시작 전 달은 없음', chargeDateIn(sub({ startDate: '2026-10-10' }), '2026-10') === '' && chargeDateIn(sub({ startDate: '2026-10-10' }), '2026-11') === '2026-11-05')
  check('결제일: 해지 뒤 없음', chargeDateIn(sub({ endDate: '2026-10-31' }), '2026-11') === '' && chargeDateIn(sub({ endDate: '2026-10-31' }), '2026-10') === '2026-10-05')
  check('다음 결제: 오늘 이후 첫 날', nextCharge(sub({ billingDay: 1 }), TODAY) === '2026-11-01' && nextCharge(sub({ billingDay: 2 }), TODAY) === '2026-10-02')
  check('쓰는 중: 오늘 해지하면 해지한 것 · 내일 해지면 아직 쓰는 중', !isActiveSub(sub({ endDate: TODAY }), TODAY) && isActiveSub(sub({ endDate: '2026-10-03' }), TODAY))
  check('다음 결제: 해지했으면 없음', nextCharge(sub({ endDate: '2026-10-01' }), TODAY) === '')
  check('달 넘기기: 12월 + 1 = 다음 해 1월 · 1월 − 1', addMonths('2026-12', 1) === '2027-01' && addMonths('2026-01', -1) === '2025-12')
  const up = upcomingCharges([sub({ id: 'a', billingDay: 2 }), sub({ id: 'b', billingDay: 5 }), sub({ id: 'c', billingDay: 6 }), sub({ id: 'd', billingDay: 3, endDate: '2026-10-01' }), sub({ id: 'z', amount: 0, billingDay: 3 })], TODAY)
  check('3일 안 결제: 오늘 · 5일 (6일 · 해지 · 금액 0 빠짐)', up.map((x) => `${x.sub.id}${x.inDays}`).join() === 'a0,b3', up.map((x) => x.sub.id))
}

/* ---------------- 돈 ---------------- */
{
  check('달러 환산', toKrw(20, 'USD', S) === 28000 && toKrw(28000, 'KRW', S) === 28000)
  check('연 결제 한 달 치', monthlyEquivalent(sub({ cycle: 'yearly', amount: 120000, currency: 'KRW' }), S) === 10000)
  check('글자: $20 · 28,000원', moneyText(20, 'USD') === '$20' && moneyText(28000, 'KRW') === '28,000원')
  check('짧게: 1억 2,000만원 · 850만원 · 28,000원 · 100만 아래는 정확히 336,000원', krwShort(120_000_000) === '1억 2,000만원' && krwShort(8_500_000) === '850만원' && krwShort(28000) === '28,000원' && krwShort(336000) === '336,000원', [krwShort(120_000_000), krwShort(8_500_000)])
  check('금액 읽기: 2.8만 · 1억2천 · 15,000원 · $20 · 20달러', parseAmount('2.8만')?.amount === 28000 && parseAmount('1억2천')?.amount === 120_000_000 && parseAmount('15,000원')?.amount === 15000 && parseAmount('$20')?.currency === 'USD' && parseAmount('20달러')?.amount === 20)
  check('금액 읽기: 3천만 · 500만원', parseAmount('3천만')?.amount === 30_000_000 && parseAmount('500만원')?.amount === 5_000_000, [parseAmount('3천만'), parseAmount('500만원')])
  check('금액 읽기: 1억2천만 · 숫자만', parseAmount('1억2천만')?.amount === 120_000_000 && parseAmount('120000000')?.amount === 120_000_000)
  check('금액 읽기: 순서 틀린 단위(만억)는 못 읽음', parseAmount('3만2억') === null)
  check('금액 읽기: 글자 · 0 은 못 읽음', parseAmount('abc') === null && parseAmount('0') === null && parseAmount('') === null)
  check('환율 설정: 이상한 값은 기본', normalizeSettings({ usdKrw: 5 }).usdKrw === DEFAULT_SETTINGS.usdKrw && normalizeSettings({ usdKrw: 1385.5, rateSet: true }).usdKrw === 1385.5)
}

/* ---------------- 매출 ---------------- */
const recs = [
  normalizeClientOps({
    id: 'c1',
    companyName: '한솔',
    status: 'active',
    contract: { kind: 'cash', cashAmount: 30_000_000, signedAt: '2026-09-01' },
    fees: [
      { id: 'f1', kind: 'deposit', label: '계약금', amount: 5_000_000, dueDate: '', receivedAt: '2026-10-01', agentFee: 500_000, agentName: '김영업', agentPaidAt: '2026-10-02' },
      { id: 'f2', kind: 'interim', label: '중도금', amount: 10_000_000, dueDate: '2026-10-20', receivedAt: null },
      { id: 'f3', kind: 'interim', label: '잔금', amount: 5_000_000, dueDate: '2026-11-10', receivedAt: null },
      { id: 'f4', kind: 'success', label: '성공보수', amount: 7_000_000, dueDate: '', receivedAt: null, conditionKind: 'funding_100m' },
      { id: 'f5', kind: 'deposit', label: '9월 입금', amount: 1_000_000, dueDate: '', receivedAt: '2026-09-15' },
    ],
  } as never),
  normalizeClientOps({
    id: 'c2',
    companyName: '선한',
    status: 'active',
    fees: [
      { id: 'g1', kind: 'deposit', label: '밀린 돈', amount: 2_000_000, dueDate: '2026-09-20', receivedAt: null },
      { id: 'g2', kind: 'deposit', label: '계약 시', amount: 3_000_000, dueDate: '', receivedAt: null, conditionKind: 'on_contract' },
      { id: 'g3', kind: 'etc', label: '옛 항목', amount: 900_000, dueDate: '', receivedAt: null },
    ],
  } as never),
  normalizeClientOps({ id: 'c3', companyName: '보관', status: 'active', archivedAt: '2026-09-01T00:00:00Z', fees: [{ id: 'h1', kind: 'deposit', label: '보관 미수', amount: 4_000_000, dueDate: '2026-10-25', receivedAt: null }, { id: 'h2', kind: 'deposit', label: '보관 입금', amount: 600_000, dueDate: '', receivedAt: '2026-10-01' }] } as never),
]
{
  const oct = revenueInMonth(recs, '2026-10', TODAY)
  check('10월 들어온 돈 = 계약금 500만 + 보관 업체 입금 60만', oct.received === 5_600_000, oct.received)
  check('10월 들어올 예정 = 중도금 1,000만 + 밀린 200만 + 계약 시 300만 (조건 대기 · 옛 항목 · 보관 미수 빠짐)', oct.expected === 15_000_000, oct.lines.map((l) => `${l.label}:${l.kind}`))
  check('10월 그중 미수금 200만', oct.overdue === 2_000_000)
  const nov = revenueInMonth(recs, '2026-11', TODAY)
  check('11월 들어올 예정 = 잔금 500만만(미수금은 이번 달에만)', nov.expected === 5_000_000 && nov.received === 0, nov.lines.map((l) => l.label))
  const sep = revenueInMonth(recs, '2026-09', TODAY)
  check('지난달 9월: 들어온 돈 100만 · 예정 0', sep.received === 1_000_000 && sep.expected === 0)
  const und = undatedRevenue(recs, TODAY)
  check('시기 미정: 조건 대기 700만 · 날짜 없는 옛 항목 90만 · 안 나눈 계약 200만(3,000만 − 항목 2,800만)', und.waiting === 7_000_000 && und.undated === 900_000 && und.unplanned === 2_000_000, und)
  check('시기 미정: 업체별 큰 순', und.byClient[0].clientId === 'c1' && /조건 대기/.test(und.byClient[0].why) && /안 나눈 계약금액/.test(und.byClient[0].why))
  check('매출 계산이 기록을 바꾸지 않음', recs[0].fees[1].receivedAt === null && recs[0].fees.length === 5)
}

/* ---------------- 비용 ---------------- */
{
  const subs = [sub({ id: 'a' }), sub({ id: 'b', name: 'Vercel', category: 'software', billingDay: 31 }), sub({ id: 'y', name: '도메인', amount: 33000, currency: 'KRW', cycle: 'yearly', billingMonth: 11, billingDay: 3 })]
  const exps = [exp({ id: 'e1' }), exp({ id: 'e2', date: '2026-10-15', name: '광고', category: 'marketing', amount: 300000, clientId: 'c1' }), exp({ id: 'e3', date: '2026-09-30', amount: 5000 })]
  const oct = costInMonth({ subscriptions: subs, expenses: exps, records: recs, settings: S }, '2026-10')
  check('10월 정기 결제 = $20 + $20 → 56,000원 (연 결제 빠짐)', oct.subscriptions === 56000, oct.subscriptions)
  check('10월 쓴 돈 = 12,000 + 300,000 (9월 것 빠짐)', oct.expenses === 312000)
  check('10월 영업자 수수료(준 날) = 50만', oct.agent === 500_000)
  check('10월 합계', oct.total === 56000 + 312000 + 500000)
  check('Vercel 31일 → 10월 31일', oct.lines.find((l) => l.name === 'Vercel')?.date === '2026-10-31')
  check('분류별: 수수료 > 광고 > AI 순', oct.byCategory.map((c) => c.category).slice(0, 3).join() === 'fee,marketing,ai', oct.byCategory)
  const nov = costInMonth({ subscriptions: subs, expenses: exps, records: recs, settings: S }, '2026-11')
  check('11월: 연 결제 도메인 33,000 들어감', nov.lines.some((l) => l.name === '도메인' && l.krw === 33000))
  const csv = costCsv(oct, (id) => (id === 'c1' ? '한솔' : ''))
  check('CSV: 머리줄 · 줄 수 · 업체 이름 · 엑셀 한글(BOM)', csv.startsWith('﻿날짜,항목,분류') && csv.split('\r\n').length === 1 + oct.lines.length && csv.includes(',한솔,'), csv.slice(0, 200))
  check('CSV: 쉼표 들어간 글은 따옴표', costCsv({ ...oct, lines: [{ ...oct.lines[0], name: 'A, B' }] }).includes('"A, B"'))

  const sum = monthSummary({ records: recs, subscriptions: subs, expenses: exps, settings: S }, '2026-10', TODAY)
  check('10월 남는 돈(지금) = 들어온 돈 − 나간 돈', sum.netSoFar === 5_600_000 - oct.total)
  check('10월 남는 돈(예상) = 들어온 + 들어올 − 나간', sum.netExpected === 5_600_000 + 15_000_000 - oct.total)
  const o = outlook({ records: recs, subscriptions: subs, expenses: exps, settings: S }, TODAY, 6)
  check('앞으로 6달: 10월부터 3월', o.length === 6 && o[0].ym === '2026-10' && o[5].ym === '2027-03')
  check('앞으로: 정기 결제는 해마다 · 매달 들어감', o[3].cost.subscriptions === 56000 && o[1].cost.subscriptions === 56000 + 33000)
}

/* ---------------- 다듬기 ---------------- */
{
  check('정기 결제: 이름 없으면 null', normalizeSubscription({ name: ' ' }, 'x', 'now') === null)
  const s = normalizeSubscription({ name: 'X', amount: -3, billingDay: 40, currency: 'EUR', category: '??', cycle: 'weekly', startDate: '2026/10/01', payMethod: '1234-5678' }, 'x', 'now')
  check('정기 결제: 이상한 값 다듬기', s?.amount === 0 && s?.billingDay === 1 && s?.currency === 'KRW' && s?.category === 'etc' && s?.cycle === 'monthly' && s?.startDate === '' && s?.payMethod === '', s)
  check('비용: 금액 · 날짜 없으면 null', normalizeExpense({ amount: 0, date: '2026-10-01' }, 'x', 'now') === null && normalizeExpense({ amount: 10, date: '10/1' }, 'x', 'now') === null)
  check('비용: 이름 없으면 분류 이름', normalizeExpense({ amount: 10, date: '2026-10-01', category: 'meal' }, 'x', 'now')?.name === '식대 · 접대')
  check('카드번호 같은 칸 없음', !Object.keys(normalizeExpense({ amount: 10, date: '2026-10-01', cardNumber: '1234' }, 'x', 'now') ?? {}).includes('cardNumber'))
}

console.log(`\nfinance: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
