/**
 * D-199 상황 예시로 바로 설계 — 카탈로그 · 업체 숫자로 계산 · 필요한 숫자 ✓/✗ · 요청 문구 · 모듈 엔진과 같은 답.
 */
import { normalizeClientOps } from '../clientOpsService'
import { SCENARIO_PRESETS, presetAssumptions, presetFieldsKept, scenarioPath, scenarioPreset, withoutPresetFields } from '../scenarioPresets'
import { fitDataRequest, runScenario, runScenarios, scenarioTaxProfile, scenariosRequest, type ScenarioRun } from '../scenarios'
import { SCENARIO_QUESTIONS, fitContext, scenarioAnswer, scenarioFit, withScenarioAnswer, type QuestionKey } from '../scenarioFit'
import { salaryPlan, parseGoalText } from '../taxPlan'
import { cashPlan, goalNeeds, shareValueOf, viewProfile } from '../taxPlan'
import { diagnoseHiring } from '../../tools/employment/lib/eligibility'
import { DEFAULT_PROGRAMS } from '../../tools/employment/lib/programs'
import type { ClientOpsRecord } from '../../types/clientOps'
import { businessTypeOf } from '../../tools/shared/clientPrefill'
import { startupRegion } from '../clientInsights'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1
    console.log('PASS ', name)
  } else {
    failed += 1
    console.log('FAIL ', name, detail === undefined ? '' : JSON.stringify(detail))
  }
}

const today = '2026-10-14'
const full = normalizeClientOps({
  id: 'full',
  companyName: '한솔정밀(주)',
  representativeName: '김한솔',
  establishedAt: '2023-03-02',
  businessCategory: '제조업',
  businessItem: '정밀기계 부품',
  businessAddress: '경기도 화성시 동탄대로 1',
  representativeBirth: '1990-05-05',
  employeeCount: '12',
  taxProfile: { monthlySalary: '5,000,000', retainedEarnings: '800,000,000', ceoStartDate: '2023-03-02', par: '5000', loanBalance: '120,000,000', children: '2', estateRealEstate: '1,500,000,000' },
  shareholderRegister: [
    { id: 'h1', name: '김한솔', relation: 'ceo', shares: 8000, acquirePrice: 5000 },
    { id: 'h2', name: '김다온', relation: 'child', shares: 2000, acquirePrice: 5000 },
  ],
  factValues: { totalAssets: '3,000,000,000', totalLiabilities: '1,200,000,000', netIncome: '400,000,000', revenue: '5,000,000,000' },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
} as unknown as Partial<ClientOpsRecord>)
const empty = normalizeClientOps({ id: 'empty', companyName: '빈회사', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' } as unknown as Partial<ClientOpsRecord>)

// S1 카탈로그
const by = (m: string) => SCENARIO_PRESETS.filter((s) => s.module === m).length
check(
  'S1 카탈로그 23개 — 절세 11 · 고용 4 · 연구소 2 · 창업감면 3 · 정책자금 3 · 아이디 겹침 없음 · 주소에 업체 · 가정',
  SCENARIO_PRESETS.length === 23 && by('tax') === 11 && by('employment') === 4 && by('labcare') === 2 && by('startup-tax') === 3 && by('policy-funding') === 3 && new Set(SCENARIO_PRESETS.map((s) => s.id)).size === 23 && scenarioPath(SCENARIO_PRESETS[0], 'c 1') === '/tools/tax?client=c%201&preset=tax-cash-1e' && scenarioPreset('emp-youth')?.module === 'employment' && scenarioPreset('nope') === null,
  SCENARIO_PRESETS.map((s) => s.id),
)

// S2 숫자가 다 있는 업체
const runs = runScenarios(full, today)
const r = (id: string) => runs.find((x) => x.id === id)!
check('S2 숫자가 다 있는 업체 — 23개 모두 계산(멈춘 것 없음) · 바로 설계됨 15개 넘게', runs.length === 23 && runs.filter((x) => x.state === 'ready').length >= 15, runs.map((x) => `${x.id}:${x.state}`))
const cash = r('tax-cash-1e')
const p = viewProfile(scenarioTaxProfile(full, today).profile)
const direct = cashPlan(p, full.shareholderRegister, shareValueOf(p, full.shareholderRegister), 100_000_000, today)
check('S3 절세 1억 — 절세 설계와 같은 엔진 · 같은 추천 · 순부담 금액', cash.state === 'ready' && !!direct.best && cash.headline.includes(direct.best.label) && cash.amount.startsWith('순부담') && cash.openPath.includes('preset=tax-cash-1e'), { headline: cash.headline, best: direct.best?.label })
const tre = r('tax-treasury')
check(
  'S4 자사주 — 양도(주식 팔기)와 소각(의제배당)을 나란히 · 머리글은 비교(1억 가져오기와 같은 글이 아님) · 금액은 차이',
  tre.lines.some((l) => l.includes('주식 팔기')) && tre.lines.some((l) => l.includes('소각')) && tre.headline.includes(' vs ') && tre.headline !== cash.headline && tre.amount.startsWith('차이'),
  { headline: tre.headline, amount: tre.amount, lines: tre.lines },
)
const split = r('tax-cash-3e-split')
check(
  'S5 3억 나눠 가져오기 — 여러 해 비교 한 줄 · 덜 내면 머리글이 그 절약액',
  split.lines.some((l) => /년에 나누면|나눠도/.test(l)) && (!split.lines.some((l) => l.includes('년에 나누면')) || (split.headline.includes('나눠 가져오면') && split.amount.endsWith('덜 냄'))),
  { headline: split.headline, amount: split.amount, lines: split.lines },
)
const youth = r('emp-youth')
const rows = diagnoseHiring({ situation: 'new', cats: ['청년'], specials: [], age: 29, gender: null, milMonths: 0, region: '수도권', companySize: 12, empType: '정규직', preApply: true, noLayoff: true, aboveFloor: true, youthEligible: true }, Object.values(DEFAULT_PROGRAMS))
const topName = (rows.find((x) => x.status === 'recommend') ?? rows.find((x) => x.status === 'maybe'))?.program.name ?? ''
check('S6 청년 채용 — 채용 진단과 같은 답(같은 1순위 · 1명 금액) · 직원 수 · 권역 ✓', youth.state === 'ready' && !!topName && youth.headline.includes(topName) && /1명 최대 \d/.test(youth.amount) && youth.needs.every((n) => n.ok), { headline: youth.headline, topName, needs: youth.needs })
const lab = r('lab-two')
check('S7 연구원 2명 — 연구개발비 8,000만원 · 연간 약 2,000만원(일반 R&D 25% · 중소기업 가정 ★)', lab.headline.includes('8,000만원') && lab.amount.includes('2,000만원') && lab.lines[0].includes('25%') && lab.lines[0].includes('★'), lab)
const pol = r('policy-working')
check('S8 정책자금 운전자금 — 진단 결과(가능성 · 추천 기관) · 업종 · 설립일 · 직원 수 · 매출 ✓', pol.state === 'ready' && /진행 가능성 .+ · 추천 기관 .+/.test(pol.headline) && pol.needs.every((n) => n.ok), pol)
const mv = r('startup-move')
check('S9 본점 옮기면 — 지금 권역 결론과 나란히 · 업종을 모르면 ✗ 로 남김(짐작 안 함)', mv.lines[0]?.startsWith('지금 권역') && mv.needs.some((n) => n.label === '업종' && !n.ok), mv)
check('S10 업체 기록에서 채운 값은 따로 알림(자산 · 순이익) · 업체 기록 자체는 바꾸지 않음', cash.filledFrom.some((f) => f.includes('자산')) && !('vAsset' in (full.taxProfile ?? {})), cash.filledFrom)

// S11 빈 업체 — 짐작하지 않는다
const er = runScenarios(empty, today)
const e = (id: string) => er.find((x) => x.id === id)!
check('S11 빈 업체 — 절세 결과를 내지 않는 상황은 받을 것을 말함(주주명부 · 배당 가능한 이익)', e('tax-cash-1e').state === 'need' && e('tax-cash-1e').amount === '' && e('tax-cash-1e').needs.some((n) => n.label.includes('주주명부') && !n.ok) && er.filter((x) => x.module === 'tax').every((x) => x.state !== 'ready'), e('tax-cash-1e'))
check('S12 빈 업체 — 창업감면은 설립일 · 대표 생년월일을 받으면 판정 · 정책자금은 업종 · 설립일', e('startup-new').state === 'need' && e('startup-new').headline.includes('설립일') && e('startup-new').headline.includes('생년월일') && e('policy-working').state === 'need' && e('policy-working').headline.includes('업종'), [e('startup-new').headline, e('policy-working').headline])
const req = e('tax-cash-1e').request
check('S13 요청 문구 — 빠진 것만 · 고객 말(주주명부 · 재무제표 · 급여) · 주민등록번호 요구 없음', req.includes('주주명부') && req.includes('재무제표') && req.includes('급여') && !req.includes('주민등록번호를') && req.includes('빈회사'), req)
const all = scenariosRequest(empty, er.filter((x) => x.state === 'need'))
check(
  'S14 한 번에 요청 — 같은 자료는 한 줄만(재무제표 · 사업자등록증) · 무엇 확인용은 모듈 이름만(상황 제목 늘어놓지 않음)',
  (all.match(/^\d+\. 최근 재무제표/gm) ?? []).length === 1 && (all.match(/^\d+\. 사업자등록증 사본/gm) ?? []).length === 1 && /^\d+\. 최근 재무제표\(표준재무제표증명\) — 절세 · 정책자금 확인용$/m.test(all) && !all.includes('대표가 1억 가져오기'),
  all,
)

// S15 순서 · 요금제
const sorted = runScenarios(full, today, () => true, true)
const rank = { ready: 0, partial: 1, need: 2 } as const
const frank = { fit: 0, ask: 1, data: 2, no: 3 } as const
check(
  'S15 D-201: 이 업체에 맞는 상황 먼저(맞음 → 물어볼 것 → 받을 자료 → 안 맞음) · 같은 칸 안에서는 바로 설계된 것 먼저',
  sorted.every((x, i) => i === 0 || frank[sorted[i - 1].fit.kind] < frank[x.fit.kind] || (frank[sorted[i - 1].fit.kind] === frank[x.fit.kind] && rank[sorted[i - 1].state] <= rank[x.state])),
  sorted.map((x) => `${x.id}:${x.fit.kind}/${x.state}`),
)
check('S16 요금제에 없는 모듈은 빼고 계산', runScenarios(full, today, (m) => m === 'tax').every((x) => x.module === 'tax') && runScenarios(full, today, () => false).length === 0)

// S17 절세 설계 화면과 같은 '필요한 값' 목록
const none = viewProfile({})
const needs = goalNeeds('cash', none, [], shareValueOf(none, []), {}).map((n) => n.key)
check('S17 필요한 값 목록(절세 설계 빨간 안내와 같은 함수) — 대표 급여 · 주주명부 · 주식가치 · 배당 가능한 이익 · 취임일', ['monthlySalary', 'holders', 'value', 'retainedEarnings', 'ceoStartDate'].every((k) => needs.includes(k)), needs)

// S18 한 상황이 실패해도 나머지는 보인다
const one = runScenario(SCENARIO_PRESETS[0], full, today)
check('S18 상황 하나만 계산해도 같은 결과', one.headline === cash.headline)

/* ================================================================== */
/* D-201 맞는 상황인가 — 대표 지적: "기준을 모르겠다 · 그냥 갖다 붙인 것 같다"       */
/* ================================================================== */

const mk = (o: Record<string, unknown>) =>
  normalizeClientOps({ createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', ...o } as unknown as Partial<ClientOpsRecord>)
const kinds = (runs: readonly ScenarioRun[]) => Object.fromEntries(runs.map((x) => [x.id, x.fit.kind]))
const fitIds = (runs: readonly ScenarioRun[]) => runs.filter((x) => x.fit.kind === 'fit').map((x) => x.id).sort()

// 가연 인터내셔널 같은 업체 — 법인 · 도소매(무역) · 직원 2명 · 매출 1.5억 · 영업이익 적자 · 설립 2년 · 대표 만 45세 · 서울
const gayeonBase = {
  id: 'gy',
  companyName: '가연인터내셔널 주식회사',
  corporateNumber: '110111-1234567',
  businessCategory: '도매 및 소매업',
  businessItem: '무역',
  establishedAt: '2024-05-01',
  employeeCount: '2',
  representativeBirth: '1981-03-03',
  businessAddress: '서울특별시 강남구 테헤란로 1',
  factValues: { revenue: '150,000,000', operatingProfit: '-5,000,000', netIncome: '-8,000,000' },
}
const gy = mk(gayeonBase)
const gyRuns = runScenarios(gy, today, () => true, true)
const gyK = kinds(gyRuns)
check(
  'F1 가연 같은 작은 업체 — 대표 급여(세후 월 800만 · 실효세율 20%)는 설계하지 않는다(이익이 모자람 → 안 맞음 + 까닭)',
  gyK['tax-salary-net'] === 'no' && gyK['tax-salary-rate'] === 'no' && gyRuns.find((x) => x.id === 'tax-salary-net')!.fit.why.includes('영업이익') && gyRuns.find((x) => x.id === 'tax-salary-net')!.fit.why.includes('모자라요'),
  gyRuns.filter((x) => x.id.startsWith('tax-salary')).map((x) => x.fit),
)
check(
  'F2 가연 — 고용지원금 4가지(청년 · 만 60세 이상 · 육아휴직 · 계약직 전환)는 맞다고 하지 않고 대표에게 묻는다(직원 나이 · 계약직을 기록이 모름)',
  ['emp-youth', 'emp-senior', 'emp-childcare', 'emp-convert'].every((id) => gyK[id] === 'ask') && gyRuns.find((x) => x.id === 'emp-senior')!.fit.question === 'hireSenior' && gyRuns.find((x) => x.id === 'emp-convert')!.fit.question === 'contract',
  ['emp-youth', 'emp-senior', 'emp-childcare', 'emp-convert'].map((id) => gyK[id]),
)
check('F3 가연 — 연구소(무역 · 직원 2명)는 설계하지 않는다(맞음 아님)', gyK['lab-two'] !== 'fit' && gyK['lab-material'] !== 'fit', [gyK['lab-two'], gyK['lab-material']])
check('F4 가연 — 목돈 · 자사주는 쌓인 이익을 몰라 "자료를 받으면 판단"(설계 안 함) · 가업승계는 업력 2년이라 안 맞음 · 상속은 대표 만 45세라 안 맞음', gyK['tax-cash-1e'] === 'data' && gyK['tax-treasury'] === 'data' && gyK['tax-succession'] === 'no' && gyK['tax-inherit'] === 'no', gyK)
check(
  'F5 가연 — 맞는 상황은 근거가 있는 것만: 창업감면(설립 2년) · 본점 이전(서울 과밀억제권역) · 운전자금(매출 1.5억)',
  JSON.stringify(fitIds(gyRuns)) === JSON.stringify(['policy-working', 'startup-move', 'startup-new']),
  fitIds(gyRuns),
)
check(
  'F6 맞는 상황마다 "왜" 한 줄 — 이 업체 숫자가 들어 있다(설립일 · 매출 · 주소)',
  gyRuns.find((x) => x.id === 'startup-new')!.fit.why.includes('2024-05-01') && gyRuns.find((x) => x.id === 'policy-working')!.fit.why.includes('1억 5,000만원') && gyRuns.find((x) => x.id === 'startup-move')!.fit.why.includes('서울'),
  gyRuns.filter((x) => x.fit.kind === 'fit').map((x) => x.fit.why),
)
check('F7 가연 — 맞는 상황이 맨 앞(23개 중 3개 · 정렬)', gyRuns.slice(0, 3).every((x) => x.fit.kind === 'fit') && gyRuns.length === 23)

// 대표가 답하면 — 같은 질문을 쓰는 상황이 함께 열린다
const gyAns = withScenarioAnswer(withScenarioAnswer(withScenarioAnswer(gy, 'hireSenior', 'yes', '2026-10-15T00:00:00.000Z'), 'contract', 'no', '2026-10-15T00:00:00.000Z'), 'hireYouth', 'yes', '2026-10-15T00:00:00.000Z')
const gaK = kinds(runScenarios(gyAns, today))
check(
  'F8 대표 답 — "만 60세 이상 뽑을 계획 있음" → 고령자 채용 맞음 · "계약직 없음" → 정규직 전환 안 맞음 · "청년 뽑을 계획" → 청년 채용 + 정책자금 청년 채용 함께 맞음',
  gaK['emp-senior'] === 'fit' && gaK['emp-convert'] === 'no' && gaK['emp-youth'] === 'fit' && gaK['policy-hiring'] === 'fit' && scenarioAnswer(gyAns, 'hireSenior') === 'yes',
  gaK,
)
const gyBack = withScenarioAnswer(gyAns, 'hireSenior', null, '2026-10-15T00:00:00.000Z')
check('F9 답 지우기(답 바꾸기) → 다시 묻는다 · 다른 답은 그대로', kinds(runScenarios(gyBack, today))['emp-senior'] === 'ask' && scenarioAnswer(gyBack, 'contract') === 'no')
check(
  'F10 답은 업체 기록 decided 에 scn.질문 으로 — 확인함 답과 같은 칸 · 정규화(저장 · 다시 읽기)에도 남는다',
  normalizeClientOps(JSON.parse(JSON.stringify(gyAns)) as Partial<ClientOpsRecord>).decided?.['scn.hireSenior']?.a === 'yes',
)

// 같은 회사가 개인사업자면
const gyIndiv = mk({ ...gayeonBase, id: 'gyi', companyName: '가연인터내셔널', corporateNumber: '', businessNumber: '123-45-67890' })
const giK = kinds(runScenarios(gyIndiv, today))
const corpOnlyIds = ['tax-cash-1e', 'tax-cash-3e-split', 'tax-treasury', 'tax-salary-rate', 'tax-salary-net', 'tax-gift-10', 'tax-gift-free', 'tax-succession', 'tax-loan', 'tax-retire']
check('F11 개인사업자(사업자번호 가운데 45) — 배당 · 자사주 · 대표 급여 · 증여 · 가지급금 · 퇴직금 10가지 모두 안 맞음(까닭: 개인사업자)', corpOnlyIds.every((id) => giK[id] === 'no') && giK['startup-convert'] === 'no', giK)
// 이름에 '주식회사' 가 없을 뿐이면 개인으로 단정하지 않는다
const gyUnknown = mk({ ...gayeonBase, id: 'gyu', companyName: '가연인터내셔널', corporateNumber: '' })
const guRuns = runScenarios(gyUnknown, today)
check(
  'F12 법인인지 모름(번호 없음 · 이름에 주식회사 없음) — 개인으로 단정하지 않고 "사업자등록증을 받으면 판단"',
  corpOnlyIds.every((id) => guRuns.find((x) => x.id === id)!.fit.kind === 'data') && fitDataRequest(gyUnknown, guRuns).includes('사업자등록증 사본'),
  corpOnlyIds.map((id) => guRuns.find((x) => x.id === id)!.fit.kind),
)

// 40명 제조업 · 업력 28년 · 대표 만 64세 · 이익 큼 · 자녀 · 가지급금
const big = mk({
  id: 'big',
  companyName: '(주)한빛정밀',
  corporateNumber: '134511-0000001',
  businessCategory: '제조업',
  businessItem: '정밀기계 부품',
  establishedAt: '1998-03-02',
  employeeCount: '40',
  representativeBirth: '1962-02-02',
  businessAddress: '경기도 화성시 동탄대로 1',
  taxProfile: { monthlySalary: '10,000,000', retainedEarnings: '2,000,000,000', loanBalance: '120,000,000', children: '2', par: '5000' },
  shareholderRegister: [
    { id: 'h1', name: '박한빛', relation: 'ceo', shares: 9000, acquirePrice: 5000 },
    { id: 'h2', name: '박다온', relation: 'child', shares: 1000, acquirePrice: 5000 },
  ],
  factValues: { revenue: '10,000,000,000', operatingProfit: '800,000,000', netIncome: '600,000,000', totalAssets: '9,000,000,000', totalLiabilities: '3,000,000,000' },
})
const bigRuns = runScenarios(big, today, () => true, true)
const bK = kinds(bigRuns)
check(
  'F13 40명 제조업 · 업력 28년 · 대표 만 64세 — 목돈 · 나눠 가져오기 · 자사주 · 급여 · 증여 · 가업승계 · 상속 · 가지급금 · 퇴직금 · 연구소 설립 · 운전자금 맞음',
  ['tax-cash-1e', 'tax-cash-3e-split', 'tax-treasury', 'tax-salary-rate', 'tax-salary-net', 'tax-gift-10', 'tax-gift-free', 'tax-succession', 'tax-inherit', 'tax-loan', 'tax-retire', 'lab-two', 'policy-working'].every((id) => bK[id] === 'fit'),
  bK,
)
check('F14 업력 28년 — 창업감면 3가지는 안 맞음(창업 5년 지남)', ['startup-new', 'startup-convert', 'startup-move'].every((id) => bK[id] === 'no') && bigRuns.find((x) => x.id === 'startup-new')!.fit.why.includes('5년'))
check('F15 가업승계 근거 — 업력 · 대표 나이 · 자녀가 한 줄에', /업력 28년 · 대표 만 64세 · 자녀 2명/.test(bigRuns.find((x) => x.id === 'tax-succession')!.fit.why), bigRuns.find((x) => x.id === 'tax-succession')!.fit.why)
// 연구소가 이미 있으면 설립 상황은 안 맞음
const bigLab = mk({ ...JSON.parse(JSON.stringify(big)), id: 'bl', factValues: { ...big.factValues, researchLab: '기업부설연구소(2015 인정)' } })
check('F16 연구소가 이미 있으면 "연구소 설립" 은 안 맞음(까닭: 이미 있음)', kinds(runScenarios(bigLab, today))['lab-two'] === 'no')

// 개인 카페 · 부산 · 설립 1년
const cafe = mk({ id: 'cafe', companyName: '행복카페', businessNumber: '123-45-67890', businessCategory: '숙박 및 음식점업', businessItem: '커피전문점', establishedAt: '2025-01-10', employeeCount: '3', representativeBirth: '1990-07-07', businessAddress: '부산광역시 해운대구 1', factValues: { revenue: '200,000,000' } })
const cK = kinds(runScenarios(cafe, today))
check('F17 개인 카페(부산 · 설립 1년) — 창업감면 맞음 · 본점 이전은 안 맞음(이미 과밀억제권역 밖) · 법인 전환 안 맞음 · 상속 안 맞음(만 36세)', cK['startup-new'] === 'fit' && cK['startup-move'] === 'no' && cK['startup-convert'] === 'no' && cK['tax-inherit'] === 'no' && cK['policy-working'] === 'fit', cK)

// 빈 업체 — 아무것도 '맞음' 이 아니다
const eRuns = runScenarios(empty, today)
check('F18 빈 업체 — 맞는 상황 0개(짐작해서 붙이지 않음) · 물어볼 것과 받을 자료로만', eRuns.every((x) => x.fit.kind === 'ask' || x.fit.kind === 'data'), kinds(eRuns))
const eReq = fitDataRequest(empty, eRuns)
check('F19 받을 자료 요청 문구 — 같은 자료는 한 번(재무제표 · 사업자등록증) · 주민등록번호 요구 없음', (eReq.match(/^\d+\. 최근 재무제표/gm) ?? []).length === 1 && (eReq.match(/^\d+\. 사업자등록증 사본/gm) ?? []).length === 1 && !eReq.includes('주민등록번호를'), eReq)
check('F20 질문 11가지 — 모두 예/아니요로 답할 수 있는 한 문장(물음표로 끝남)', Object.values(SCENARIO_QUESTIONS).length === 11 && Object.values(SCENARIO_QUESTIONS).every((q) => q.endsWith('?')))

// 무작위 업체 2,000곳 — 기록이 반대를 말하는데 '맞음' 이 나오지 않는가
let seed = 20261015
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]
const maybe = <T,>(v: T): T | '' => (rnd() < 0.3 ? '' : v)
const won = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
let bad: string[] = []
let fitCount = 0
const entityMismatch: string[] = []
const QKEYS = Object.keys(SCENARIO_QUESTIONS) as QuestionKey[]
for (let i = 0; i < 2000; i++) {
  const corp = rnd() < 0.5
  const indivNum = rnd() < 0.5
  const estYear = 1990 + Math.floor(rnd() * 37)
  const op = (rnd() - 0.3) * 2e9
  const ni = op * (0.5 + rnd() * 0.5)
  const emp = Math.floor(rnd() * 60)
  const answers: Record<string, { a: 'yes' | 'no'; at: string }> = {}
  for (const q of QKEYS) if (rnd() < 0.3) answers[`scn.${q}`] = { a: rnd() < 0.5 ? 'yes' : 'no', at: '2026-10-01T00:00:00.000Z' }
  const rec = mk({
    id: `r${i}`,
    companyName: corp ? `(주)무작위${i}` : `무작위상회${i}`,
    corporateNumber: corp && rnd() < 0.5 ? '110111-0000000' : '',
    businessNumber: !corp && indivNum ? '123-45-67890' : corp && rnd() < 0.5 ? '123-81-67890' : '',
    businessCategory: maybe(pick(['제조업', '도매 및 소매업', '정보통신업', '숙박 및 음식점업', '건설업', '전문 과학 및 기술 서비스업'])),
    businessItem: maybe(pick(['부품', '무역', '소프트웨어 개발', '한식', '인테리어', '디자인'])),
    establishedAt: maybe(`${estYear}-0${1 + Math.floor(rnd() * 9)}-15`),
    employeeCount: maybe(String(emp)),
    representativeBirth: maybe(`${1950 + Math.floor(rnd() * 45)}-05-05`),
    businessAddress: maybe(pick(['서울특별시 강남구 1', '경기도 수원시 1', '경기도 화성시 1', '부산광역시 1', '인천광역시 남동구 1', '전라남도 순천시 1'])),
    taxProfile: Object.fromEntries(
      Object.entries({ monthlySalary: rnd() < 0.5 ? won(rnd() * 2e7) : '', retainedEarnings: rnd() < 0.5 ? won(rnd() * 3e9) : '', loanBalance: rnd() < 0.4 ? won(rnd() < 0.3 ? 0 : rnd() * 5e8) : '', children: rnd() < 0.4 ? String(Math.floor(rnd() * 3)) : '' }).filter(([, v]) => v !== ''),
    ),
    shareholderRegister: corp && rnd() < 0.4 ? [{ id: 'h1', name: '대표', relation: 'ceo', shares: 9000, acquirePrice: 5000 }, ...(rnd() < 0.5 ? [{ id: 'h2', name: '자녀', relation: 'child', shares: 1000, acquirePrice: 5000 }] : [])] : [],
    factValues: Object.fromEntries(Object.entries({ revenue: rnd() < 0.6 ? won(Math.abs(op) * 10 + 1e8) : '', operatingProfit: rnd() < 0.5 ? (op < 0 ? '-' : '') + won(Math.abs(op)) : '', netIncome: rnd() < 0.5 ? (ni < 0 ? '-' : '') + won(Math.abs(ni)) : '', researchLab: rnd() < 0.15 ? '연구전담부서' : '' }).filter(([, v]) => v !== '')),
    decided: answers,
  })
  const ctx = fitContext(rec, today)
  // D-209: 도구(사실 창고)와 상황 예시가 법인 · 개인을 같게 본다
  if ((businessTypeOf(rec) || 'unknown') !== ctx.entity) entityMismatch.push(`${rec.id}:${rec.businessNumber}/${rec.companyName}→${businessTypeOf(rec) || '?'}≠${ctx.entity}`)
  // 판단만 바로(빠르다) — 스무 곳에 한 번은 계산까지 다 돌려 같은 판단 · 23개 · 멈춤 없음을 본다
  const runs = SCENARIO_PRESETS.map((s) => ({ id: s.id, module: s.module, fit: scenarioFit(s, ctx) }))
  if (i % 20 === 0) {
    const full = runScenarios(rec, today)
    if (full.length !== 23) bad.push(`${rec.id}: ${full.length}개`)
    if (JSON.stringify(full.map((x) => x.fit)) !== JSON.stringify(runs.map((x) => x.fit))) bad.push(`${rec.id}: 계산까지 돌린 판단과 다름`)
  }
  if (JSON.stringify(SCENARIO_PRESETS.map((s) => scenarioFit(s, fitContext(rec, today)))) !== JSON.stringify(runs.map((x) => x.fit))) bad.push(`${rec.id}: 같은 입력 다른 판단`)
  for (const r of runs) {
    const fk = r.fit.kind
    if (fk === 'fit') fitCount++
    if (!r.fit.why.trim()) bad.push(`${rec.id} ${r.id}: 까닭 없음`)
    if (fk === 'ask' && !r.fit.question) bad.push(`${rec.id} ${r.id}: 묻는데 질문 없음`)
    if (fk === 'data' && !(r.fit.dataNeeds ?? []).length) bad.push(`${rec.id} ${r.id}: 자료 없음`)
    if (r.fit.answered && scenarioAnswer(rec, r.fit.answered) !== (fk === 'fit' ? 'yes' : 'no')) bad.push(`${rec.id} ${r.id}: 답과 판단이 다름`)
    if (fk !== 'fit') continue
    if (ctx.entity !== 'corporation' && corpOnlyIds.includes(r.id)) bad.push(`${rec.id} ${r.id}: 법인 아닌데 맞음`)
    if (ctx.facts.months !== null && ctx.facts.months >= 60 && r.module === 'startup-tax') bad.push(`${rec.id} ${r.id}: 창업 5년 지났는데 맞음`)
    if (ctx.hasLab && r.id === 'lab-two') bad.push(`${rec.id}: 연구소 있는데 설립 맞음`)
    if (ctx.facts.employeeCount === 0 && (r.id === 'emp-childcare' || r.id === 'emp-convert')) bad.push(`${rec.id} ${r.id}: 직원 0명인데 맞음`)
    const askOnly: Partial<Record<string, QuestionKey>> = { 'emp-youth': 'hireYouth', 'emp-senior': 'hireSenior', 'emp-childcare': 'childcare', 'emp-convert': 'contract', 'policy-facility': 'facility', 'policy-hiring': 'hireYouth', 'lab-material': 'prototype' }
    const q = askOnly[r.id]
    if (q && scenarioAnswer(rec, q) !== 'yes') bad.push(`${rec.id} ${r.id}: 대표가 '예' 하지 않았는데 맞음`)
    if (r.id === 'tax-salary-rate' || r.id === 'tax-salary-net') {
      const plan = salaryPlan(ctx.p, parseGoalText(SCENARIO_PRESETS.find((s) => s.id === r.id)!.taxText ?? '').salary ?? { mode: 'min' })
      const profit = ctx.opProfit ?? ctx.netIncome
      if (profit === null || profit + ctx.p.monthlySalary * 12 < plan.monthly * 12 * 1.1 - 1) bad.push(`${rec.id} ${r.id}: 이익으로 못 주는 급여인데 맞음`)
    }
    if (r.id === 'tax-cash-1e') {
      const room = (ctx.retained ?? 0) + Math.max(0, ctx.netIncome ?? 0)
      if (room < 1e8) bad.push(`${rec.id}: 이익이 1억 안 되는데 1억 가져오기 맞음`)
    }
    if (r.id === 'tax-treasury' && !(ctx.retained !== null && ctx.retained >= 1e8)) bad.push(`${rec.id}: 배당 가능한 이익 1억 미만인데 자사주 맞음`)
    if (r.id === 'tax-succession' && !((ctx.facts.months ?? 0) >= 120 && (ctx.facts.representativeAge ?? 0) >= 50)) bad.push(`${rec.id}: 업력 · 나이 안 되는데 가업승계 맞음`)
  }
}
check('F21 무작위 업체 2,000곳 × 23 상황 — 기록이 반대를 말하는데 "맞음" 0건 · 까닭 없는 판단 0 · 같은 입력 같은 판단 · 답과 판단 일치', bad.length === 0, bad.slice(0, 8))
check('F22 무작위 업체에서 "맞음" 도 실제로 나온다(전부 숨기는 것이 아님)', fitCount > 2000, fitCount)
check('F23 무작위 업체 2,000곳 — 계산기(사실 창고)와 상황 예시의 법인 · 개인 판단이 모두 같음', entityMismatch.length === 0, entityMismatch.slice(0, 6))

/* ---------------- D-209 점검 결과 ---------------- */
const moveOf = (addr: string) => {
  const r = mk({ id: `mv-${addr}`, companyName: '(주)이전정밀', corporateNumber: '110111-1234567', establishedAt: '2024-05-02', businessAddress: addr })
  return scenarioFit(SCENARIO_PRESETS.find((x) => x.id === 'startup-move')!, fitContext(r, today))
}
const mvSn = moveOf('경기도 성남시 분당구 판교로 1')
const mvHs = moveOf('경기도 화성시 동탄대로 1')
const mvNd = moveOf('인천광역시 남동구 남동대로 1')
const mvSe = moveOf('서울특별시 강남구 테헤란로 1')
const mvBs = moveOf('부산광역시 해운대구 센텀로 1')
check('F24 본점 이전 — 성남(과밀억제권역)은 맞음 · 화성은 이미 밖 · 인천 남동구(산업단지 일부 제외)는 확인할 것 · 서울 맞음 · 부산 밖(예전: 경기 · 인천 모두 "이미 밖")', mvSn.kind === 'fit' && mvHs.kind === 'no' && mvNd.kind === 'data' && !/이미 과밀억제권역 밖/.test(mvNd.why) && mvSe.kind === 'fit' && mvBs.kind === 'no', { mvSn: mvSn.kind, mvHs: mvHs.kind, mvNd, mvSe: mvSe.kind, mvBs: mvBs.kind })
const overTable: [string, string][] = [['경기도 수원시 영통구 1', 'yes'], ['경기도 고양시 일산동구 1', 'yes'], ['경기도 과천시 1', 'yes'], ['경기도 용인시 수지구 1', 'no'], ['경기도 평택시 1', 'no'], ['경기도 남양주시 별내동 1', 'unknown'], ['경기도 시흥시 정왕동 1', 'unknown'], ['인천광역시 부평구 1', 'yes'], ['인천광역시 계양구 1', 'yes'], ['인천광역시 강화군 1', 'no'], ['인천광역시 연수구 송도동 1', 'unknown'], ['경기 수원 1', 'unknown']]
const overBad = overTable.filter(([a, want]) => startupRegion(a).over !== want).map(([a, want]) => `${a}: ${startupRegion(a).over}≠${want}`)
check('F27 과밀억제권역 표(수도권정비계획법 시행령 별표1) — 시 전체 · 일부 · 밖 · 줄인 주소는 모름', overBad.length === 0, overBad)
const indivNo = mk({ id: 'bt1', companyName: '정밀상회', businessNumber: '123-45-67890', establishedAt: '2022-01-01', businessCategory: '제조업' })
const corpName = mk({ id: 'bt2', companyName: '한빛산업 주식회사', businessNumber: '', establishedAt: '2022-01-01' })
check('F25 사업자번호가 개인(가운데 45) → 계산기도 개인사업자 · 이름에 주식회사 → 법인(예전: 둘 다 "모름" 으로 법인세 계산)', businessTypeOf(indivNo) === 'individual' && fitContext(indivNo, today).entity === 'individual' && businessTypeOf(corpName) === 'corporation' && fitContext(corpName, today).entity === 'corporation')
const labIndiv = runScenario(SCENARIO_PRESETS.find((x) => x.id === 'lab-two')!, indivNo, today)
check('F26 연구소 2명 상황 — 개인사업자면 소득세로 계산 · "사업자 구분" 을 모자란 것으로 묻지 않음', /소득세/.test(labIndiv.headline) && labIndiv.needs.every((n) => !JSON.stringify(n).includes('사업자 구분') || (n as { ok?: boolean }).ok), { h: labIndiv.headline, needs: labIndiv.needs })

/* ---------------- D-211 모듈 화면 '넣은 가정' 칩 · [가정 빼기] ---------------- */
const chipsOf = (id: string) => presetAssumptions(scenarioPreset(id)!).map((c) => c.text)
check('G1 연구소 2명 — 칩은 인건비 8,000만원 · 일반 R&D (0원인 재료비는 칩 없음)', JSON.stringify(chipsOf('lab-two')) === JSON.stringify(['인건비 8,000만원', '일반 R&D']), chipsOf('lab-two'))
check('G2 연구원 1명 + 재료비 — 인건비 4,000만원 · 재료비 3,000만원 · 일반 R&D', JSON.stringify(chipsOf('lab-material')) === JSON.stringify(['인건비 4,000만원', '재료비 3,000만원', '일반 R&D']), chipsOf('lab-material'))
check('G3 본점 이전 — 새로 창업 · 본점 기타 지방 · 과밀억제권역 밖', JSON.stringify(chipsOf('startup-move')) === JSON.stringify(['새로 창업', '본점 기타 지방', '과밀억제권역 밖']), chipsOf('startup-move'))
check('G4 정책자금 청년 채용 — 운전자금 · 채용 계획 있음 · 청년 채용 예정', JSON.stringify(chipsOf('policy-hiring')) === JSON.stringify(['운전자금', '채용 계획 있음', '청년 채용 예정']), chipsOf('policy-hiring'))
check('G5 고용 육아휴직 — 같은 말 한 번씩(육아휴직이 상황 · 구체 상황 둘 다여도 하나)', new Set(chipsOf('emp-childcare')).size === chipsOf('emp-childcare').length && chipsOf('emp-childcare').includes('대체인력'), chipsOf('emp-childcare'))
check('G6 고용 청년 — 신규 채용 · 청년 · 만 29세 · 정규직(진단 화면 단추와 같은 말)', JSON.stringify(chipsOf('emp-youth')) === JSON.stringify(['신규 채용', '청년', '만 29세', '정규직']), chipsOf('emp-youth'))
const noTaxChips = SCENARIO_PRESETS.filter((x) => x.module === 'tax').every((x) => presetAssumptions(x).length === 0)
const allOthers = SCENARIO_PRESETS.filter((x) => x.module !== 'tax').every((x) => presetAssumptions(x).length > 0)
check('G7 절세는 칩 없음(상황 문장이 칸에 그대로) · 나머지 12 상황은 칩이 하나 이상', noTaxChips && allOthers)
check('G8 칩에 업체 숫자(직원 수 · 매출 · 주소)는 없음 — 가정만', SCENARIO_PRESETS.flatMap(presetAssumptions).every((c) => !/직원 ?수|매출|피보험자|주소/.test(c.text)), SCENARIO_PRESETS.flatMap(presetAssumptions).map((c) => c.text))
type LabF = { payroll: number | ''; material: number | ''; category: string; rate: number | '' }
const applied: Partial<LabF> = { payroll: 80_000_000, material: 0, category: '일반 R&D', rate: '' }
const before: Partial<LabF> = { payroll: 30_000_000, material: 5_000_000, category: '미정', rate: 25 }
const afterEdit: LabF = { payroll: 80_000_000, material: 12_000_000, category: '일반 R&D', rate: '' }
const kept = presetFieldsKept(afterEdit, applied).map(String).sort()
check('G9 가정 칸 중 직접 고친 재료비는 "남은 가정" 에서 빠짐', JSON.stringify(kept) === JSON.stringify(['category', 'payroll', 'rate']), kept)
const cleared = withoutPresetFields(afterEdit, applied, before)
check('G10 [가정 빼기] — 가정 그대로인 칸만 예전 값(인건비 3,000만 · 미정 · 25%) · 직접 고친 재료비 1,200만은 그대로', cleared.payroll === 30_000_000 && cleared.category === '미정' && cleared.rate === 25 && cleared.material === 12_000_000, cleared)
check('G11 [가정 빼기] — 원래 객체는 바꾸지 않음', afterEdit.payroll === 80_000_000 && afterEdit.category === '일반 R&D')
const emptyBefore = withoutPresetFields({ purpose: '운전자금', revenue: '10억' }, { purpose: '운전자금' }, { purpose: '' })
check('G12 상황 예시 전이 빈 칸이면 빈 칸으로(짐작해서 채우지 않음) · 다른 칸 그대로', emptyBefore.purpose === '' && emptyBefore.revenue === '10억', emptyBefore)

// ---------------- D-224 무작위 업체(기본 150곳 · FUZZ_N=1500 으로 크게) — 23 상황 × 5 모듈이 멈추거나 깨진 글자를 내지 않는지 ----------------
{
  let seed = 20241017
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]
  const MONEY = ['', '0', '-1', '-999,999,999,999', '1', '150,000,000', '5,000,000,000', '90,000,000,000', '1e309', 'abc', '3억', '1억5000', '12.5', ' ', '0원', '9'.repeat(30)]
  const DATES = ['', '2026-07-01', '2019-03-02', '1995-06-01', '2031-01-01', '1890-01-01', '2026-13-45', 'abc', '2026-10-14', '2021-02-29', '20200101']
  const CATS = ['', '제조업', '정보통신업', '숙박 및 음식점업', '도매 및 소매업', '건설업', '전문, 과학 및 기술 서비스업', '???', '농업', '금융 및 보험업']
  const ADDR = ['', '서울특별시 강남구 테헤란로 1', '경기도 화성시 동탄대로 1', '경기도 수원시', '인천광역시 연수구', '전라남도 순천시', '부산광역시 해운대구', '세종특별자치시', '해외 주소', '서울']
  const EMP = ['', '0', '1', '4', '12', '32', '420', '많음', '-3', '12명(대표 포함)', '1e9']
  const BAD = /\bNaN\b|undefined|Infinity|\[object Object\]/
  let throws = 0
  let badText = 0
  let runsSeen = 0
  const firstBad: unknown[] = []
  const slow: unknown[] = []
  let dropped = 0
  const droppedEx: unknown[] = []
  // 업체 한 곳에 0.3초 남짓(23 상황 · 5 모듈 엔진) — 게이트에서는 150곳, 크게 볼 때는 FUZZ_N=1500
  const N = Number(process.env.FUZZ_N ?? 150)
  for (let i = 0; i < N; i += 1) {
    if (process.env.FUZZ_TRACE && i % 25 === 0) console.log('fuzz', i, Date.now())
    const holders = Array.from({ length: Math.floor(rnd() * 4) }, (_, k) => ({ id: `h${k}`, name: pick(['김대표', '', '배우자', '자녀']), relation: pick(['ceo', 'spouse', 'child', 'other', 'x']), shares: pick([0, -10, 100, 9000, 1e12, NaN]), acquirePrice: pick([0, 5000, -1, 1e9]) }))
    const raw = {
      id: `fz${i}`,
      companyName: pick(['', '가', '테스트(주)', '아주긴이름'.repeat(30)]),
      representativeName: pick(['', '김대표']),
      corporateNumber: pick(['', '110111-1234567']),
      establishedAt: pick(DATES),
      representativeBirth: pick(DATES),
      businessCategory: pick(CATS),
      businessItem: pick(['', '정밀기계 부품', '한식', '앱 개발', '무역', '연구개발']),
      businessAddress: pick(ADDR),
      employeeCount: pick(EMP),
      taxProfile: rnd() < 0.5 ? {} : { monthlySalary: pick(MONEY), retainedEarnings: pick(MONEY), ceoStartDate: pick(DATES), par: pick(['', '0', '5000', '-1']), loanBalance: pick(MONEY), children: pick(['', '0', '2', '-3', 'abc']), estateRealEstate: pick(MONEY) },
      shareholderRegister: holders,
      factValues: rnd() < 0.3 ? {} : { revenue: pick(MONEY), operatingProfit: pick(MONEY), netIncome: pick(MONEY), totalAssets: pick(MONEY), totalLiabilities: pick(MONEY) },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    }
    let rec = normalizeClientOps(raw as unknown as Partial<ClientOpsRecord>)
    // 질문 몇 개에 아무렇게나 답해 둔다
    for (const q of Object.keys(SCENARIO_QUESTIONS) as QuestionKey[]) if (rnd() < 0.3) rec = withScenarioAnswer(rec, q, pick(['yes', 'no', null] as const), '2026-10-01T00:00:00.000Z')
    const t0 = Date.now()
    try {
      const rs = runScenarios(rec, today, () => true, true)
      const ms = Date.now() - t0
      if (ms > 1500 && slow.length < 3) slow.push({ i, ms, raw })
      runsSeen += rs.length
      // runScenarios 는 한 상황이 실패하면 조용히 뺀다 — 빠진 상황을 하나씩 다시 돌려 까닭을 잡는다
      if (rs.length !== SCENARIO_PRESETS.length) {
        for (const p of SCENARIO_PRESETS.filter((x) => !rs.some((r) => r.id === x.id))) {
          try {
            runScenario(p, rec, today)
          } catch (e) {
            dropped += 1
            if (droppedEx.length < 5) droppedEx.push({ i, id: p.id, error: String(e).slice(0, 160), raw })
          }
        }
      }
      for (const r of rs) {
        const txt = [r.title, r.when, r.headline, r.amount, r.request, r.openPath, ...r.lines, ...r.assumptions, ...r.filledFrom, ...r.needs.map((n) => JSON.stringify(n))].join(' | ')
        if (BAD.test(txt)) {
          badText += 1
          if (firstBad.length < 3) firstBad.push({ i, id: r.id, txt: txt.match(BAD)?.[0], at: txt.slice(Math.max(0, txt.search(BAD) - 80), txt.search(BAD) + 30), raw })
        }
      }
      scenariosRequest(rec, rs)
    } catch (e) {
      throws += 1
      if (firstBad.length < 3) firstBad.push({ i, error: String(e).slice(0, 200), raw })
    }
  }
  check(`Z1 무작위 업체 ${N.toLocaleString()}곳 × 23 상황(${runsSeen}번 계산) — 멈춤 0 · 조용히 빠진 상황 0 · NaN/undefined/Infinity 0 · 한 곳 1.5초 넘게 걸림 0`, throws === 0 && dropped === 0 && badText === 0 && slow.length === 0, { throws, dropped, droppedEx, badText, firstBad, slow })
}

console.log(`\nscenarios: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
