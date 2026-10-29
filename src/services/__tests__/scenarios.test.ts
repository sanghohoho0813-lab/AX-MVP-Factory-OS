/**
 * D-199 상황 예시로 바로 설계 — 카탈로그 · 업체 숫자로 계산 · 필요한 숫자 ✓/✗ · 요청 문구 · 모듈 엔진과 같은 답.
 */
import { normalizeClientOps, withToolResult } from '../clientOpsService'
import { SCENARIO_PRESETS, labPresetFor, presetAssumptions, presetFieldsKept, scenarioPath, scenarioPreset, withoutPresetFields } from '../scenarioPresets'
import { fitDataRequest, runScenario, runScenarios, scenarioTaxProfile, scenariosRequest, type ScenarioRun } from '../scenarios'
import { SCENARIO_QUESTIONS, fitContext, scenarioAnswer, scenarioFit, withScenarioAnswer, type QuestionKey } from '../scenarioFit'
import { salaryPlan, parseGoalText } from '../taxPlan'
import { cashPlan, goalNeeds, shareValueOf, viewProfile } from '../taxPlan'
import { diagnoseHiring } from '../../tools/employment/lib/eligibility'
import { DEFAULT_PROGRAMS } from '../../tools/employment/lib/programs'
import type { ClientOpsRecord } from '../../types/clientOps'
import { businessTypeOf, clientFacts } from '../../tools/shared/clientPrefill'
import { SITUATION_PLANS, buildSituationPlan, planDef, planResultInput, planSummary, planTitle, situationChoices, smeConfirmed } from '../situationPlan'
import { defaultTaxUnits } from '../../tools/employment/lib/rosterCore'
import { startupRegion } from '../clientInsights'
import { formatWon, withFactValue } from '../customerFacts'
import { buildInsights } from '../clientInsights'
import { calcPresetValues, runCalcScenario } from '../calcScenario'
import { calculatorOf, defaultValues, type RowValues } from '../taxCalc'

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
  'S1 카탈로그 42개 — 절세 11 + 계산기 05 · 06 5(D-243) · 고용 9 · 연구소 4 · 창업감면 6(D-328 벤처 확인) · 정책자금 7(NX-4 13개 더함) · 아이디 겹침 없음 · 주소에 업체 · 가정 · 계산기',
  SCENARIO_PRESETS.length === 42 && by('tax') === 16 && SCENARIO_PRESETS.filter((s) => s.calc).length === 5 && by('employment') === 9 && by('labcare') === 4 && by('startup-tax') === 6 && by('policy-funding') === 7 && new Set(SCENARIO_PRESETS.map((s) => s.id)).size === 42 && scenarioPath(SCENARIO_PRESETS[0], 'c 1') === '/tools/tax?client=c%201&preset=tax-cash-1e' && scenarioPath(scenarioPreset('calc-t7-loan')!, 'c 1') === '/tools/tax?client=c%201&m=calc&c=t7&s=w1&preset=calc-t7-loan' && scenarioPreset('emp-youth')?.module === 'employment' && scenarioPreset('nope') === null,
  SCENARIO_PRESETS.map((s) => s.id),
)

// S2 숫자가 다 있는 업체
const runs = runScenarios(full, today)
const r = (id: string) => runs.find((x) => x.id === id)!
check('S2 숫자가 다 있는 업체 — 42개 모두 계산(멈춘 것 없음) · 바로 설계됨 15개 넘게', runs.length === 42 && runs.filter((x) => x.state === 'ready').length >= 15, runs.map((x) => `${x.id}:${x.state}`))
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
// D-244: 업태 '제조업' 은 종목 글('정밀기계 부품')이 있어도 업종으로 읽는다 — 아는 말이 하나도 없을 때만 ✗
const mvUnknown = runScenario(scenarioPreset('startup-move')!, normalizeClientOps({ ...full, id: 'mvu', businessCategory: '기타', businessItem: '정밀기계 부품' } as unknown as Partial<ClientOpsRecord>), today)
check('S9 본점 옮기면 — 지금 권역 결론과 나란히 · 업태로 업종 ✓ · 아는 업종 말이 없으면 ✗ 로 남김(짐작 안 함)', mv.lines[0]?.startsWith('지금 권역') && mv.needs.some((n) => n.label === '업종' && n.ok) && mvUnknown.needs.some((n) => n.label === '업종' && !n.ok), { mv: mv.needs, mvUnknown: mvUnknown.needs })
// D-322 감면율은 창업한 곳 기준 — 옮겨도 올라간다고 말하지 않는다(처음부터 밖이었다면은 따로 한 줄)
check('D-322 본점 옮기면 — "옮겨도 감면율은 그대로일 가능성" · 지금(창업한 곳) 감면율 · 처음부터 밖이었다면 · 세무사 확인', mv.headline.startsWith('옮겨도 감면율은 그대로일 가능성이 커요') && mv.lines.some((l) => l.startsWith('지금(창업한 곳): 감면율')) && mv.lines.some((l) => l.startsWith('처음부터 수도권 밖에서 창업했다면: 감면율')) && mv.lines.some((l) => l.includes('창업일의 사업장 소재지')), { h: mv.headline, l: mv.lines })
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
  'F5 가연 — 맞는 상황은 근거가 있는 것만: 창업감면(설립 2년) · 본점 이전(서울 과밀억제권역) · 운전자금(매출 1.5억) · NX-4 창업 초기 창업자금(설립 2년) · D-328 벤처 확인(서울 · 창업 3년 안 · 일반 대표)',
  JSON.stringify(fitIds(gyRuns)) === JSON.stringify(['policy-startup', 'policy-working', 'startup-move', 'startup-new', 'startup-venture']) && gyRuns.find((x) => x.id === 'policy-startup')!.fit.why.includes('2024-05-01'),
  fitIds(gyRuns),
)
check(
  'F6 맞는 상황마다 "왜" 한 줄 — 이 업체 숫자가 들어 있다(설립일 · 매출 · 주소)',
  gyRuns.find((x) => x.id === 'startup-new')!.fit.why.includes('2024-05-01') && gyRuns.find((x) => x.id === 'policy-working')!.fit.why.includes('1억 5,000만원') && gyRuns.find((x) => x.id === 'startup-move')!.fit.why.includes('서울'),
  gyRuns.filter((x) => x.fit.kind === 'fit').map((x) => x.fit.why),
)
check('F7 가연 — 맞는 상황이 맨 앞(42개 중 5개 · 정렬)', gyRuns.slice(0, 5).every((x) => x.fit.kind === 'fit') && gyRuns.length === 42)

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
check('F20 질문 22가지(D-243 회사에 빌려준 돈 · 재산 넣어 주기 · NX-4 상황 예시 9가지 더함) — 모두 예/아니요로 답할 수 있는 한 문장(물음표로 끝남)', Object.values(SCENARIO_QUESTIONS).length === 22 && Object.values(SCENARIO_QUESTIONS).every((q) => q.endsWith('?')))

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
    if (full.length !== SCENARIO_PRESETS.length) bad.push(`${rec.id}: ${full.length}개`)
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
    if (ctx.entity !== 'corporation' && (corpOnlyIds.includes(r.id) || r.id.startsWith('calc-'))) bad.push(`${rec.id} ${r.id}: 법인 아닌데 맞음`)
    // D-243 계산기 05 · 06 — 친족 주주가 있어야 · 회사에 빌려줌/넣어 줌은 대표가 '예' 해야
    const kin = rec.shareholderRegister.filter((h) => h.shares > 0 && h.relation !== 'ceo')
    if (r.id.startsWith('calc-t7') && kin.length === 0) bad.push(`${rec.id} ${r.id}: 친족 주주 없는데 맞음`)
    if ((r.id === 'calc-t7-loan' || r.id === 'calc-t7-forgive') && scenarioAnswer(rec, 'lendToCorp') !== 'yes') bad.push(`${rec.id} ${r.id}: 빌려준 돈 '예' 없이 맞음`)
    if (r.id === 'calc-t7-gift' && scenarioAnswer(rec, 'giftToCorp') !== 'yes') bad.push(`${rec.id} ${r.id}: 재산 넣어 주기 '예' 없이 맞음`)
    if (r.id === 'calc-t8-reduce' && (kin.length === 0 || scenarioAnswer(rec, 'succession') !== 'yes')) bad.push(`${rec.id} ${r.id}: 친족 주주 · 승계 '예' 없이 맞음`)
    if (r.id === 'calc-t8-issue' && !((ctx.children ?? 0) > 0 || scenarioAnswer(rec, 'succession') === 'yes')) bad.push(`${rec.id} ${r.id}: 자녀 · 승계 계획 없이 맞음`)
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
check('F21 무작위 업체 2,000곳 × 28 상황 — 기록이 반대를 말하는데 "맞음" 0건 · 까닭 없는 판단 0 · 같은 입력 같은 판단 · 답과 판단 일치', bad.length === 0, bad.slice(0, 8))
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
const noTaxChips = SCENARIO_PRESETS.filter((x) => x.module === 'tax' && !x.calc).every((x) => presetAssumptions(x).length === 0)
const allOthers = SCENARIO_PRESETS.filter((x) => x.module !== 'tax' || x.calc).every((x) => presetAssumptions(x).length > 0)
check('G7 절세 설계 상황은 칩 없음(상황 문장이 칸에 그대로) · 계산기 05 · 06 5 + 나머지 12 상황은 칩이 하나 이상', noTaxChips && allOthers)
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

// ---------------- D-242 상황별 한 장 설계서(로드맵 7) — 여러 모듈을 한 장에 · 같은 엔진 · 합계 · 추천 행동 → 붙이기 ----------------
{
  check(
    'P1 설계서 4가지(청년 채용 · 만 60세 이상 채용 · 연구소 · 창업 5년 안 채용 D-244) · 제목 · 상황 예시 기준과 같은 preset',
    SITUATION_PLANS.length === 4 && planTitle('hire-youth', 2) === '청년 2명 채용' && planTitle('startup-hire', 1) === '창업 5년 안 청년 1명 채용' && planDef('startup-hire')?.hiring === 'emp-youth' && scenarioPreset(planDef('startup-hire')!.hiring!) !== null && planDef('lab-start')?.preset === 'lab-two' && planDef('nope') === null && SITUATION_PLANS.every((d) => scenarioPreset(d.preset) !== null),
  )
  const youth2 = buildSituationPlan('hire-youth', full, today, 2)
  const sub = youth2.blocks.find((b) => b.key === 'subsidy')!
  const cred = youth2.blocks.find((b) => b.key === 'credit')!
  const pol = youth2.blocks.find((b) => b.key === 'policy')!
  const top = (rows.find((x) => x.status === 'recommend') ?? rows.find((x) => x.status === 'maybe'))!
  check(
    'P2 청년 2명 — 고용지원금은 채용 진단과 같은 1순위 × 2명(받는 때 회차도 × 2)',
    sub.state === 'ok' && sub.headline.includes(top.program.name) && sub.won === top.program.totalAmount * 2 && sub.lines.some((l) => l.startsWith('받는 때:')) && sub.openPath.includes('preset=emp-youth'),
    { headline: sub.headline, won: sub.won, lines: sub.lines },
  )
  // D-319 2026년에 뽑으면 2026 개편표 — 수도권 중소 청년 등 1년 차 700 · 2년 차 1,600 · 3년 차 1,700만
  const unit = defaultTaxUnits('metro', 'sme', 2026).youth * 10_000
  check(
    'P3 · D-319 통합고용세액공제 — 명부 화면과 같은 식(경기 = 수도권 중소 청년 1년 차 700만 × 2명) · 유지하면 2 · 3년 차(1,600 · 1,700만 × 2) · 중소기업 가정 ★',
    cred.state === 'ok' && unit === 7_000_000 && cred.won === unit * 2 && cred.laterWon === (16_000_000 + 17_000_000) * 2 && cred.lines.some((l) => l.includes('2년 차 약 3,200만원') && l.includes('3년 차 약 3,400만원')) && cred.assumptions.some((a) => a.includes('중소기업으로 보고')) && cred.openPath.startsWith('/tools/employment/roster'),
    { won: cred.won, unit, later: cred.laterWon, lines: cred.lines, a: cred.assumptions },
  )
  check(
    'P4 합계 — 1년 안 = 지원금 + 세액공제 1년 차 · 유지하면 + 2·3년 차 · 정책자금(대출)은 합계에 안 넣음',
    youth2.firstWon === sub.won + cred.won && youth2.keepWon === youth2.firstWon + cred.laterWon && pol.won === 0 && youth2.totalText.startsWith('약 ') && pol.assumptions.some((a) => a.includes('합계에 넣지 않았어요')),
    { first: youth2.firstWon, keep: youth2.keepWon, total: youth2.totalText },
  )
  const youth5 = buildSituationPlan('hire-youth', full, today, 5)
  check('P5 사람 수를 바꾸면 그 숫자로 다시(2명 → 5명 = 지원금 · 세액공제 모두 2.5배)', youth5.count === 5 && youth5.blocks[0].won === sub.won * 2.5 && youth5.blocks[1].won === cred.won * 2.5 && youth5.title === '청년 5명 채용')
  check(
    'P6 정책자금 — 같은 진단 엔진(채용 계획 · 청년 채용 예정) · 진행 가능성 · 추천 기관 · 가점 한 줄',
    pol.state === 'ok' && pol.headline.startsWith('진행 가능성') && pol.lines[0].includes('채용 계획(청년)이 가점') && pol.openPath.includes('preset=policy-hiring'),
    { headline: pol.headline, lines: pol.lines },
  )
  const acts = youth2.actions.map((a) => a.id)
  check(
    'P7 추천 행동 — 뽑기 전 참여신청 → 계약 · 4대보험 → n개월 뒤 1차 신청 → 결산 전 세무사 → 정책자금 · 날짜는 오늘 이후 · 주말이면 월요일 · 결산 전은 12월 1일',
    acts.join(',') === 'apply,contract,round1,tax,policy' && youth2.actions[0].when === '뽑기 전' && youth2.actions.every((a) => a.date > today && ![0, 6].includes(new Date(`${a.date}T00:00:00`).getDay())) && youth2.actions.find((a) => a.id === 'tax')!.date === '2026-12-01' && buildSituationPlan('hire-youth', full, '2026-12-05', 2).actions.find((a) => a.id === 'tax')!.date === '2027-12-01',
    youth2.actions,
  )
  // 지방 · 주소 없음 · 중소기업 확인 · 300명 넘음
  const local = normalizeClientOps({ ...full, id: 'local', businessAddress: '전라남도 순천시 중앙로 1' } as unknown as Partial<ClientOpsRecord>)
  const noAddr = normalizeClientOps({ ...full, id: 'noaddr', businessAddress: '' } as unknown as Partial<ClientOpsRecord>)
  const smeRec = normalizeClientOps({ ...full, id: 'sme', customFields: [{ id: 'cf1', group: 'credential', label: '중소기업 확인', value: '소기업 · 2027-03-31까지' }] } as unknown as Partial<ClientOpsRecord>)
  const big = normalizeClientOps({ ...full, id: 'big', employeeCount: '420' } as unknown as Partial<ClientOpsRecord>)
  const credOf = (rec: ClientOpsRecord) => buildSituationPlan('hire-youth', rec, today, 1).blocks.find((b) => b.key === 'credit')!
  check(
    'P8 세액공제 단가 — 지방은 지방 단가 · 주소 없으면 수도권(낮은 쪽) + 가정 표시 · 중소기업 확인서 있으면 ★ 없음 · 300명 넘고 확인서 없으면 계산 안 함',
    credOf(local).won === defaultTaxUnits('local', 'sme', 2026).youth * 10_000 &&
      credOf(noAddr).won === unit && credOf(noAddr).assumptions.some((a) => a.includes('주소를 몰라')) &&
      smeConfirmed(smeRec) && !credOf(smeRec).assumptions.some((a) => a.includes('중소기업으로 보고')) &&
      credOf(big).state === 'need' && credOf(big).won === 0,
    { local: credOf(local).won, big: credOf(big) },
  )
  // 맞는지 — 상황 예시와 같은 기준(채용 계획은 묻는다 → '예' 면 맞음)
  const askFit = buildSituationPlan('hire-youth', full, today, 2).fit
  const yes = withScenarioAnswer(full, 'hireYouth', 'yes', '2026-10-01T00:00:00.000Z')
  check('P9 맞는지 — 채용 계획을 모르면 묻기(ask) · 대표 답 예 → 맞음 · 아니요 → 안 맞음', askFit.kind === 'ask' && askFit.question === 'hireYouth' && buildSituationPlan('hire-youth', yes, today, 2).fit.kind === 'fit' && buildSituationPlan('hire-youth', withScenarioAnswer(full, 'hireYouth', 'no', '2026-10-01T00:00:00.000Z'), today, 2).fit.kind === 'no')
  // 연구소 — 연구개발비 세액공제(같은 엔진) · 전담부서/연구소 기준 · 이미 연구소가 있으면 안 맞음
  const lab = buildSituationPlan('lab-start', full, today, 2)
  const rnd = lab.blocks.find((b) => b.key === 'rnd')!
  check(
    'P10 연구소 2명 — 인건비 8,000만원 × 공제율 25% = 해마다 약 2,000만원 · 업력 3년 넘어 연구소는 3명 → 2명이면 전담부서 · 3년 이어 가면 × 3',
    rnd.state === 'ok' && rnd.won === 20_000_000 && rnd.lines.some((l) => l.includes('연구개발전담부서 기준')) && lab.keepWon === 60_000_000 && lab.actions[0].id === 'staff' && lab.actions.some((a) => a.text.includes('KOITA')),
    { rnd, keep: lab.keepWon },
  )
  const hasLab = normalizeClientOps({ ...full, id: 'haslab', factValues: { ...(full.factValues ?? {}), researchLab: '기업부설연구소 2024-01-02' } } as unknown as Partial<ClientOpsRecord>)
  check('P11 이미 연구소가 있으면 연구소 만들기는 안 맞음(상황 예시와 같은 까닭)', buildSituationPlan('lab-start', hasLab, today, 2).fit.kind === 'no')
  // 빈 업체 — 멈추지 않고 받을 것을 말한다
  const emptyPlan = buildSituationPlan('hire-youth', empty, today, 2)
  check(
    'P12 빈 업체 — 멈추지 않음 · 정책자금은 받을 것 · 요청 문구(같은 자료는 하나로) · 숫자 없는 칸은 합계 0',
    emptyPlan.blocks.find((b) => b.key === 'policy')!.state === 'need' && emptyPlan.request.includes('대표님') && emptyPlan.firstWon >= 0 && !/undefined|NaN/.test(planSummary(emptyPlan, empty.companyName)),
    { request: emptyPlan.request, blocks: emptyPlan.blocks.map((b) => `${b.key}:${b.state}`) },
  )
  // 붙이기 — 업체 기록 한 줄 · 고른 행동만 할 일로(달력 · 오늘) · 요약에 금액 · 행동
  const input = planResultInput(youth2, full.companyName, ['apply', 'tax'])
  const attached = withToolResult(full, input)
  check(
    'P13 업체에 붙이기 — situation-plan 결과 한 줄 · 고른 행동 2개만 할 일(todo) · 요약에 제목 · 금액 · 진행 순서',
    attached.toolResults[0].toolKey === 'situation-plan' && attached.toolResults[0].title === '상황별 설계서 · 청년 2명 채용' && attached.toolResults[0].deadlines.length === 2 && attached.toolResults[0].deadlines.every((d) => d.todo) && input.summary.includes('청년 2명 채용') && input.summary.includes('■ 이렇게 진행해요') && input.verdictLabel.includes('1년 안'),
    { title: attached.toolResults[0].title, deadlines: attached.toolResults[0].deadlines, label: input.verdictLabel },
  )
  check(
    'P14 고르는 판 — 맞는 상황이 먼저 · 요금제에 없는 모듈(연구소)은 빠짐',
    situationChoices(yes, today)[0].def.id === 'hire-youth' && situationChoices(yes, today, (m) => m !== 'labcare').every((c) => c.def.id !== 'lab-start'),
    situationChoices(yes, today).map((c) => `${c.def.id}:${c.fit.kind}`),
  )
  const longName = runScenario(scenarioPreset('emp-youth')!, normalizeClientOps({ ...full, id: 'jn', businessAddress: '충청북도 청주시 흥덕구 1' } as unknown as Partial<ClientOpsRecord>), today)
  check(
    'P16 긴 시 · 도 이름(충청북도 · 전라남도) — 상황 예시 채용도 비수도권으로(예전: 주소 모름 → 수도권)',
    longName.needs.find((x) => x.label.startsWith('회사 주소'))?.value === '비수도권' && !longName.assumptions.some((a) => a.includes('주소를 몰라')),
    longName.needs,
  )
  const senior = buildSituationPlan('hire-senior', full, today, 1)
  check('P15 만 60세 이상 1명 — 세액공제는 청년 등 단가(만 60세 이상 포함) · 제목', senior.title === '만 60세 이상 1명 채용' && senior.blocks.find((b) => b.key === 'credit')!.won === unit && senior.blocks.find((b) => b.key === 'credit')!.headline.includes('만 60세 이상'), senior.blocks.map((b) => `${b.key}:${b.state}:${b.headline}`))
}

// ---------------- D-244 상황별 설계서 '창업 5년 안 채용' — 창업감면(판정기 그대로) + 청년 채용(지원금 · 세액공제 · 정책자금) ----------------
{
  const yes = withScenarioAnswer(full, 'hireYouth', 'yes', '2026-10-01T00:00:00.000Z')
  const sh = buildSituationPlan('startup-hire', yes, today, 1)
  const yh = buildSituationPlan('hire-youth', yes, today, 1)
  const at = (p: typeof sh, k: string) => p.blocks.find((b) => b.key === k)!
  const st = at(sh, 'startup')
  check(
    'Q1 맞는지 — 창업 5년 안이 먼저(설립일) · 그다음 청년 채용 계획(대표 답) · 둘 다 맞으면 근거 두 줄',
    buildSituationPlan('startup-hire', full, today, 1).fit.kind === 'ask' && buildSituationPlan('startup-hire', full, today, 1).fit.question === 'hireYouth' &&
      sh.fit.kind === 'fit' && sh.fit.why.includes('5년 안') && sh.fit.why.includes('대표 답') &&
      buildSituationPlan('startup-hire', withScenarioAnswer(full, 'hireYouth', 'no', '2026-10-01T00:00:00.000Z'), today, 1).fit.kind === 'no' &&
      buildSituationPlan('startup-hire', normalizeClientOps({ ...yes, id: 'old', establishedAt: '2019-01-02' } as unknown as Partial<ClientOpsRecord>), today, 1).fit.kind === 'no' &&
      buildSituationPlan('startup-hire', normalizeClientOps({ ...yes, id: 'noest', establishedAt: '' } as unknown as Partial<ClientOpsRecord>), today, 1).fit.kind === 'data',
    sh.fit,
  )
  check(
    'Q2 한 장 순서 — 창업감면 → 고용지원금 → 통합고용세액공제 → 정책자금 · 창업감면은 판정만(합계 0)',
    sh.blocks.map((b) => b.key).join(',') === 'startup,subsidy,credit,policy' && st.state === 'ok' && st.won === 0 && st.amount === '' && st.openPath.includes('preset=startup-new') && st.assumptions.some((a) => a.includes('판정만')),
    sh.blocks.map((b) => `${b.key}:${b.state}:${b.won}`),
  )
  check(
    'Q3 창업감면 — 판정기 결론 · 감면 기간(창업한 해 + 4년 · 올해 포함 남은 해) · 고용 늘면 추가 감면 ★',
    st.headline.includes(' — ') && st.lines.some((l) => l.includes('감면 기간: 2023~2027년') && l.includes('2년 남음')) && st.lines.some((l) => l.startsWith('★ 감면 기간 중 직원이 늘어난 해')),
    st,
  )
  check(
    'Q4 채용 숫자는 청년 채용 설계서와 같은 엔진 · 같은 금액(1년 안 · 3년) — 창업감면을 더하지 않음',
    sh.firstWon === yh.firstWon && sh.keepWon === yh.keepWon && at(sh, 'subsidy').won === at(yh, 'subsidy').won && at(sh, 'credit').won === at(yh, 'credit').won && at(sh, 'subsidy').openPath.includes('preset=emp-youth'),
    { sh: sh.firstWon, yh: yh.firstWon },
  )
  check(
    'Q5 세액공제에 창업 초기 확인 두 줄(같은 해 함께 · 이월) · 청년 채용 설계서엔 없음 · 결산 전 할 일에 창업감면',
    at(sh, 'credit').lines.some((l) => l.includes('중복 배제')) && at(sh, 'credit').lines.some((l) => l.includes('이월')) && !at(yh, 'credit').lines.some((l) => l.includes('중복 배제')) &&
      sh.actions.map((a) => a.id).join(',') === yh.actions.map((a) => a.id).join(',') && sh.actions.find((a) => a.id === 'tax')!.text.includes('창업감면') && at(sh, 'policy').lines[0].includes('(청년)'),
    sh.actions,
  )
  const noBirth = buildSituationPlan('startup-hire', normalizeClientOps({ ...yes, id: 'nb', representativeBirth: '' } as unknown as Partial<ClientOpsRecord>), today, 1)
  check(
    'Q6 대표 생년월일이 없으면 창업감면은 받을 것(짐작 안 함) · 나머지는 그대로 계산 · 요청 문구',
    at(noBirth, 'startup').state === 'need' && at(noBirth, 'startup').headline.includes('대표 생년월일') && noBirth.firstWon === sh.firstWon && noBirth.request.includes('대표님'),
    at(noBirth, 'startup'),
  )
  const older = buildSituationPlan('startup-hire', normalizeClientOps({ ...yes, id: 'od', representativeBirth: '1970-01-01', businessAddress: '부산광역시 해운대구 1' } as unknown as Partial<ClientOpsRecord>), today, 1)
  check('Q7 청년 대표가 아니면(만 53세 · 부산) — 판정기 그대로 일반 감면율 50%', at(older, 'startup').lines.some((l) => l.includes('50%')) && !at(older, 'startup').lines.some((l) => l.includes('청년창업')), at(older, 'startup').lines)
  const late = buildSituationPlan('startup-hire', normalizeClientOps({ ...yes, id: 'late', establishedAt: '2021-12-01' } as unknown as Partial<ClientOpsRecord>), today, 1)
  check('Q8 창업한 해 + 4년이 지났지만 5년(60개월)은 안 됨 — 맞음 · 기간은 ★ 확인(남은 해 0이라고 하지 않음)', late.fit.kind === 'fit' && at(late, 'startup').lines.some((l) => l.includes('2025년에 끝') && l.includes('★')) && !at(late, 'startup').lines.some((l) => l.includes('0년 남음')), at(late, 'startup').lines)
  check(
    "Q9 상황 예시 '새로 창업한 경우' 줄 → [한 장 설계서로] 는 이 설계서 · '청년 채용' 줄은 그대로 청년 채용 · 고용 모듈이 없으면 빠짐",
    SITUATION_PLANS.find((d) => d.preset === 'startup-new')?.id === 'startup-hire' && SITUATION_PLANS.find((d) => d.preset === 'emp-youth')?.id === 'hire-youth' && situationChoices(yes, today, (m) => m !== 'employment').every((c) => c.def.id === 'lab-start'),
  )
  check(
    "Q10 업종 — 업태 '제조업' · 종목 '정밀기계 부품'(아는 말 없음)이면 업태로(예전: 종목 글이 있으면 업태를 안 봐서 '모름')",
    clientFacts(full, new Date(`${today}T00:00:00`)).industry === 'manufacturing' && at(sh, 'startup').needs.find((n) => n.label === '업종')?.ok === true &&
      clientFacts(normalizeClientOps({ ...full, id: 'ict', businessItem: '소프트웨어 개발' } as unknown as Partial<ClientOpsRecord>), new Date(`${today}T00:00:00`)).industry === 'ict',
  )
  const txt = planSummary(sh, full.companyName)
  check('Q11 요약 · 붙이기 — 창업감면 줄 · 결과 제목', txt.includes('■ 창업감면 — ') && planResultInput(sh, full.companyName, ['tax']).title === '상황별 설계서 · 창업 5년 안 청년 1명 채용' && !/undefined|NaN/.test(txt))
}

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
  let plansSeen = 0
  let badPlan = 0
  const badPlanEx: unknown[] = []
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
      // D-242 상황별 설계서 — 같은 업체로 3가지 · 아무 사람 수(0 · 음수 · NaN · 너무 큼 포함)
      for (const d of SITUATION_PLANS) {
        const plan = buildSituationPlan(d.id, rec, today, pick([0, 1, 2, 5, 99, -3, NaN]))
        plansSeen += 1
        const txt = planSummary(plan, rec.companyName) + plan.request + JSON.stringify(planResultInput(plan, rec.companyName, plan.actions.map((a) => a.id)).deadlines)
        const bad = BAD.test(txt) || !Number.isFinite(plan.firstWon) || plan.firstWon < 0 || plan.keepWon < plan.firstWon || plan.count < 1 || plan.count > 50 || plan.actions.some((a) => !/^\d{4}-\d{2}-\d{2}$/.test(a.date) || a.date < today || [0, 6].includes(new Date(`${a.date}T00:00:00`).getDay()))
        if (bad) {
          badPlan += 1
          if (badPlanEx.length < 3) badPlanEx.push({ i, id: d.id, at: txt.match(BAD)?.[0], first: plan.firstWon, keep: plan.keepWon, count: plan.count, raw })
        }
      }
    } catch (e) {
      throws += 1
      if (firstBad.length < 3) firstBad.push({ i, error: String(e).slice(0, 200), raw })
    }
  }
  check(`Z1 무작위 업체 ${N.toLocaleString()}곳 × 23 상황(${runsSeen}번 계산) — 멈춤 0 · 조용히 빠진 상황 0 · NaN/undefined/Infinity 0 · 한 곳 1.5초 넘게 걸림 0`, throws === 0 && dropped === 0 && badText === 0 && slow.length === 0, { throws, dropped, droppedEx, badText, firstBad, slow })
  check(`Z2 D-242 무작위 업체 × 상황별 설계서 3가지(${plansSeen}장) — 깨진 글자 0 · 금액 음수/NaN 0 · 유지 합계 ≥ 1년 합계 · 사람 수 1~50 · 할 일 날짜 오늘 이후 · 평일`, plansSeen === N * SITUATION_PLANS.length && badPlan === 0, { plansSeen, badPlan, badPlanEx })
}

/** 계산기 글('46,000,000원') → 화면 금액(4,600만원) */
const formatWonText = (v: string) => formatWon(Number(v.replace(/[^\d-]/g, '')) || 0)

/* ---------------- D-243 세금 계산기 05 특정법인 · 06 불균등 증자 · 감자 상황 ---------------- */
{
  const famBase = {
    id: 'fam',
    companyName: '(주)가족정밀',
    corporateNumber: '110111-1111111',
    establishedAt: '2010-03-02',
    representativeBirth: '1962-01-01',
    businessCategory: '제조업',
    businessAddress: '경기도 화성시 동탄대로 1',
    taxProfile: { par: '5000', vAsset: '5,000,000,000', vDebt: '2,000,000,000', vInc0: '300,000,000', vInc1: '350,000,000', vInc2: '400,000,000' },
    shareholderRegister: [
      { id: 'h1', name: '김대표', relation: 'ceo', shares: 60000, acquirePrice: 5000 },
      { id: 'h2', name: '이배우', relation: 'spouse', shares: 25000, acquirePrice: 5000 },
      { id: 'h3', name: '김자녀', relation: 'child', shares: 15000, acquirePrice: 5000 },
    ],
  }
  const yes = { a: 'yes' as const, at: '2026-10-01T00:00:00.000Z' }
  const fam = mk({ ...famBase, decided: { 'scn.lendToCorp': yes, 'scn.giftToCorp': yes, 'scn.succession': yes } })
  const famAsk = mk(famBase)
  const P = (id: string) => scenarioPreset(id)!
  const CALC = ['calc-t7-loan', 'calc-t7-forgive', 'calc-t7-gift', 'calc-t8-issue', 'calc-t8-reduce']
  const fitOf = (rec: ClientOpsRecord) => Object.fromEntries(CALC.map((id) => [id, scenarioFit(P(id), fitContext(rec, today))]))
  const fy = fitOf(fam)
  const fa = fitOf(famAsk)
  check('C1 가족 주주 회사 + 대표 답 "예" → 계산기 상황 5가지 모두 맞음(왜: 대표 답 · 자녀)', CALC.every((id) => fy[id].kind === 'fit' && fy[id].why.length > 0), Object.fromEntries(CALC.map((id) => [id, `${fy[id].kind}:${fy[id].why}`])))
  check(
    'C2 답이 없으면 — 빌려주기 · 면제는 "빌려준 돈 있나요?" · 재산은 "넣어 줄 계획?" · 감자는 승계 계획을 묻고(친족 주주 이름 함께) · 증자는 주주명부 자녀로 맞음',
    fa['calc-t7-loan'].kind === 'ask' && fa['calc-t7-loan'].question === 'lendToCorp' && fa['calc-t7-forgive'].question === 'lendToCorp' && fa['calc-t7-gift'].question === 'giftToCorp' && fa['calc-t8-reduce'].question === 'succession' && fa['calc-t8-reduce'].why.includes('이배우') && fa['calc-t8-issue'].kind === 'fit',
    fa,
  )
  const solo = mk({ ...famBase, id: 'solo', shareholderRegister: [{ id: 'h1', name: '김대표', relation: 'ceo', shares: 100000, acquirePrice: 5000 }], decided: { 'scn.lendToCorp': yes, 'scn.giftToCorp': yes } })
  const fs = fitOf(solo)
  check('C3 대표 혼자 주주 — 05 세 가지 · 감자는 안 맞음(까닭: 친족 주주 없음 · 대표 답 "예" 여도)', ['calc-t7-loan', 'calc-t7-forgive', 'calc-t7-gift', 'calc-t8-reduce'].every((id) => fs[id].kind === 'no' && fs[id].why.includes('친족 주주')), fs)
  const indiv = mk({ id: 'ind', companyName: '정밀상회', businessNumber: '123-45-67890', establishedAt: '2020-01-01' })
  const noReg = mk({ id: 'noreg', companyName: '(주)명부없음', corporateNumber: '110111-2222222', establishedAt: '2020-01-01' })
  const fi = fitOf(indiv)
  const fn = fitOf(noReg)
  check('C4 개인사업자는 5가지 모두 안 맞음 · 주주명부 없는 법인은 "주주명부를 받으면 판단"', CALC.every((id) => fi[id].kind === 'no') && CALC.every((id) => fn[id].kind === 'data' && (fn[id].dataNeeds ?? []).some((d) => d.includes('주주명부'))), { fi, fn })
  const needRun = runScenario(P('calc-t7-loan'), noReg, today)
  check('C5 주주명부가 없으면 짐작하지 않음 — 결과 없이 "주주명부를 받으면 바로 계산" · 요청 문구에 주주명부', needRun.state === 'need' && needRun.lines.length === 0 && needRun.amount === '' && needRun.headline.includes('주주명부') && needRun.request.includes('주주명부(최근 것)'), needRun)

  // 계산기 식 그대로 — 업체 상세 숫자 = 계산기 화면 숫자
  const calcOut = (presetId: string, rec: ClientOpsRecord) => {
    const pr = P(presetId)
    const c = calculatorOf(pr.calc!.key)!
    const pv = calcPresetValues(pr, rec, today)
    return { pv, out: c.subs.find((x) => x.key === pr.calc!.sub)!.compute({ ...defaultValues(c), ...pv.values }) }
  }
  const loan = runCalcScenario(P('calc-t7-loan'), fam, today)
  const loanCalc = calcOut('calc-t7-loan', fam)
  const lim = loanCalc.out.blocks.find((b) => b.id === 'w1_out')!.lines.find((l) => l.k === '과세되지 않는 대여원금 한도')!.v
  check(
    'C6 대표가 10억 무이자 — 회사 이익 4,600만원 · 배우자 25% 1,150만원 · 자녀 15% 690만원 비과세 · 한도(계산기 · 지분율 60%) 36억 2,319만원',
    loan.state === 'ready' && loan.headline === '비과세 — 가족 주주 몫이 가장 커도 1,150만원(1억 미만)' && loan.lines[0] === '회사가 얻는 이익(1년 이자) 4,600만원' && loan.lines.some((l) => l.startsWith('이배우 · 지배주주의 친족 25.0% → 1,150만원 비과세')) && loan.amount === '한도 36억 2,319만원' && lim === '3,623,188,406원',
    loan,
  )
  const big = runCalcScenario({ ...P('calc-t7-loan'), calc: { key: 't7', sub: 'w1', amount: 10_000_000_000 } }, fam, today)
  check('C7 100억이면 — 배우자 몫 1억 1,500만원 1억 이상 → 과세(이름 · 지분율 · 금액)', big.headline.startsWith('과세 — 이배우(25.0%) 1억 1,500만원') && !big.headline.includes('김자녀'), big.headline)
  const fg = runCalcScenario(P('calc-t7-forgive'), fam, today)
  const fgCalc = calcOut('calc-t7-forgive', fam)
  const fgNet = fgCalc.out.blocks.find((b) => b.id === 'w2_out')!.lines.find((l) => l.k === '정산증여액')!.v
  check('C8 채무면제 3억 — 회사 소득금액 = 결산 순손익 4억(✓) · 정산증여액이 계산기와 같은 숫자', fg.state === 'ready' && fgCalc.pv.values.w2_income === '400000000' && fg.needs.some((n) => n.label.includes('순이익') && n.ok) && fg.lines[0].endsWith(formatWonText(fgNet)), { fg: fg.lines[0], fgNet })
  const fgNoInc = runCalcScenario(P('calc-t7-forgive'), mk({ ...famBase, id: 'noinc', taxProfile: { par: '5000' } }), today)
  check('C9 순이익을 모르면 0 으로 계산하되 "더 정확히"(partial) + 까닭(증여 금액이 크게 보일 수 있음) · 요청 문구에 재무제표', fgNoInc.state === 'partial' && fgNoInc.assumptions.some((a) => a.includes('소득금액 0')) && fgNoInc.needs.some((n) => !n.ok && n.label.includes('순이익')), fgNoInc)
  const iss = runCalcScenario(P('calc-t8-issue'), fam, today)
  const issCalc = calcOut('calc-t8-issue', fam)
  const kidRow = (issCalc.pv.values.x1_rows as RowValues[]).find((r) => r.name === '김자녀')!
  const issJudge = (issCalc.out.tables ?? [])[0].rows.find((r) => r.cells[0] === '김자녀')!
  check(
    'C10 자녀만 신주 20% — 기존 10만 주의 20% = 2만 주 · 인수가 = 액면가 5,000원 · 시가 = 09 식 1주 가치 · 계산기 표의 이익과 같은 금액',
    kidRow.extra === '20000' && issCalc.pv.values.x1_issue === '5000' && Number(issCalc.pv.values.x1_fair) > 5000 && iss.headline.startsWith('김자녀 이익') && iss.amount === `이익 ${formatWonText(issJudge.cells[5])}`,
    { iss: iss.headline, kidRow, judge: issJudge.cells },
  )
  const noKid = calcPresetValues(P('calc-t8-issue'), solo, today)
  check('C11 주주명부에 자녀가 없으면 "자녀(새 주주)" 줄을 더하고 알림(실제 받을 사람으로 바꾸기)', (noKid.values.x1_rows as RowValues[]).some((r) => r.name === '자녀(새 주주)' && r.extra === '20000' && r.qty === '0') && noKid.notes.some((n) => n.includes('자녀(새 주주)')), noKid)
  const red = runCalcScenario(P('calc-t8-reduce'), fam, today)
  const redCalc = calcOut('calc-t8-reduce', fam)
  const ceoRow = (redCalc.pv.values.x2_rows as RowValues[])[0]
  check('C12 대표 주식 30% 감자 — 6만 주의 30% = 1만 8천 주 · 감자대가 = 액면가 · 지분이 늘어나는 배우자 · 자녀 두 줄', ceoRow.extra === '18000' && redCalc.pv.values.x2_redeem === '5000' && red.lines.filter((l) => /^(이배우|김자녀) — 지분/.test(l)).length === 2 && /^(과세|비과세)/.test(red.headline), red)
  const noVal = runCalcScenario(P('calc-t8-issue'), mk({ ...famBase, id: 'noval', taxProfile: { par: '5000' } }), today)
  check('C13 06 은 1주 가치를 모르면 짐작하지 않음 — "주식가치를 받으면 바로 계산"', noVal.state === 'need' && noVal.headline.includes('주식가치') && noVal.lines.length === 0, noVal)
  const ap = (id: string) => Object.keys(calcPresetValues(P(id), fam, today).applied).sort().join(',')
  check('C14 넣은 가정(칩 · 가정 빼기 대상)은 상황 값만 — 05 금액 한 칸 · 06 인수가/감자대가 + 그 표', ap('calc-t7-loan') === 'w1_principal' && ap('calc-t7-gift') === 'w3_amount' && ap('calc-t8-issue') === 'x1_issue,x1_rows' && ap('calc-t8-reduce') === 'x2_redeem,x2_rows', [ap('calc-t7-loan'), ap('calc-t8-issue'), ap('calc-t8-reduce')])
  const chipFields = CALC.flatMap((id) => presetAssumptions(P(id)).map((c) => ({ id, f: c.field })))
  check('C15 칩마다 칸 이름이 넣은 가정과 맞음(그 칸이 바뀌면 칩이 사라지게) · 칸 없는 칩은 "이자 없이" 하나', chipFields.every(({ id, f }) => !f || Object.keys(calcPresetValues(P(id), fam, today).applied).includes(f)) && chipFields.filter((x) => !x.f).length === 1, chipFields)
  const famRuns = runScenarios(fam, today, () => true, true)
  check('C16 업체 상세 목록에도 — 계산기 5가지가 절세로 · 단추 "세금 계산기 05/06에서 이어서" · 열면 그 계산기 · 그 탭 · 같은 업체', CALC.every((id) => { const x = famRuns.find((r) => r.id === id); return !!x && x.moduleLabel === '절세' && x.openLabel === `세금 계산기 ${P(id).calc!.key === 't7' ? '05' : '06'}에서 이어서` && x.openPath.includes('m=calc') && x.openPath.includes(`c=${P(id).calc!.key}`) && x.openPath.includes('client=fam') }), famRuns.filter((r) => r.id.startsWith('calc')).map((r) => r.openPath))

  const chipText = (id: string) => presetAssumptions(P(id)).map((c) => c.text)
  check('C18 칩 글 — "빌려준 돈 10억원"(만원으로 "100,000만원" 아님) · "면제한 빚 3억원" · "자녀 신주 — 기존 주식의 20%" · "대표 주식 30% 감자"', JSON.stringify(chipText('calc-t7-loan')) === JSON.stringify(['빌려준 돈 10억원', '이자 없이']) && chipText('calc-t7-forgive')[0] === '면제한 빚 3억원' && chipText('calc-t8-issue')[0] === '자녀 신주 — 기존 주식의 20%' && chipText('calc-t8-reduce')[0] === '대표 주식 30% 감자', CALC.map(chipText))
  // 무작위 주주명부 600곳 × 5 상황 — 멈춤 · NaN · 지분 합 어긋남 0
  let calcBad: string[] = []
  const REL = ['ceo', 'spouse', 'child', 'minor_child', 'parent', 'relative', 'executive', 'corp', 'other'] as const
  for (let i = 0; i < 600; i++) {
    const n = Math.floor(rnd() * 15)
    const holders = Array.from({ length: n }, (_, k) => ({ id: `x${k}`, name: rnd() < 0.1 ? '' : `주주${k}`, relation: k === 0 && rnd() < 0.8 ? 'ceo' : pick(REL), shares: rnd() < 0.1 ? 0 : Math.floor(rnd() * 50000), acquirePrice: 0 }))
    const rec = mk({
      id: `cr${i}`,
      companyName: `(주)무작위계산${i}`,
      corporateNumber: '110111-3333333',
      taxProfile: Object.fromEntries(Object.entries({ par: rnd() < 0.8 ? pick(['100', '500', '5000', '10000']) : '', vAsset: rnd() < 0.6 ? won(rnd() * 1e10) : '', vDebt: rnd() < 0.6 ? won(rnd() * 5e9) : '', vInc2: rnd() < 0.6 ? (rnd() < 0.2 ? '-' : '') + won(rnd() * 2e9) : '' }).filter(([, v]) => v !== '')),
      shareholderRegister: holders,
    })
    const total = holders.filter((h) => h.shares > 0).reduce((a, h) => a + h.shares, 0)
    for (const id of CALC) {
      try {
        const run = runCalcScenario(P(id), rec, today)
        const text = [run.headline, ...run.lines, run.amount].join(' ')
        if (/NaN|undefined|Infinity/.test(text)) calcBad.push(`${rec.id} ${id}: ${text.slice(0, 80)}`)
        if (!run.headline) calcBad.push(`${rec.id} ${id}: 머리글 없음`)
        const pv = calcPresetValues(P(id), rec, today)
        if (id.startsWith('calc-t7') && total > 0) {
          const rows = pv.values.w_share_rows as RowValues[]
          if (rows.length !== 10 || rows.reduce((a, r) => a + Number(r.qty), 0) !== total) calcBad.push(`${rec.id} ${id}: 05 표 ${rows.length}줄 · 합 어긋남`)
        }
        if (id === 'calc-t8-issue' && total > 0 && !(pv.applied.x1_rows as RowValues[]).some((r) => Number(r.extra) > 0)) calcBad.push(`${rec.id}: 신주 받는 줄 없음`)
      } catch (e) {
        calcBad.push(`${rec.id} ${id}: ${String(e)}`)
      }
    }
  }
  check('C17 무작위 주주명부 600곳 × 5 상황 — 멈춤 · NaN 0 · 05 표 10줄 · 주식 수 합 그대로 · 증자엔 받는 줄', calcBad.length === 0, calcBad.slice(0, 6))
}

// ---------------- D-244 점검 고침 — 05 준 사람 · 결손 법인 · 10명 넘는 주주 · 1년 안 회차 · 다시 붙이기 · 연구원 수 · 이율 ----------------
{
  const P = (id: string) => scenarioPreset(id)!
  const lineV = (o: ReturnType<NonNullable<ReturnType<typeof calculatorOf>>['subs'][number]['compute']>, block: string, k: string) => o.blocks.find((b) => b.id === block)?.lines.find((l) => l.k === k)?.v ?? ''
  const base = { companyName: '(주)점검정밀', corporateNumber: '110111-4444444', establishedAt: '2015-01-01', taxProfile: { par: '5000', vAsset: '5,000,000,000', vDebt: '1,000,000,000', vInc2: '100,000,000' } }
  // R1 대표가 주식이 없으면 최대주주(배우자)도 받는 가족 — 결론에서 빼지 않는다
  const noCeo = mk({ ...base, id: 'nc', shareholderRegister: [{ id: 'a', name: '김대표', relation: 'ceo', shares: 0, acquirePrice: 0 }, { id: 'b', name: '이배우', relation: 'spouse', shares: 70000, acquirePrice: 5000 }, { id: 'c', name: '김자녀', relation: 'child', shares: 30000, acquirePrice: 5000 }] })
  const nc = runCalcScenario(P('calc-t7-forgive'), noCeo, today)
  check('R1 대표 주식 0 · 배우자 70% — 배우자도 증여 받는 가족(결론에 들어감) · \'준 사람 본인\' 줄 없음', nc.headline.includes('이배우') && !nc.lines.some((l) => l.includes('준 사람 본인')), { h: nc.headline, lines: nc.lines })
  const withCeo = runCalcScenario(P('calc-t7-forgive'), mk({ ...base, id: 'wc', shareholderRegister: [{ id: 'a', name: '김대표', relation: 'ceo', shares: 70000, acquirePrice: 5000 }, { id: 'c', name: '김자녀', relation: 'child', shares: 30000, acquirePrice: 5000 }] }), today)
  check('R1b 대표가 주주면 그대로 — 대표 줄은 \'준 사람 본인 · ★\' · 결론은 자녀 몫', withCeo.lines.some((l) => l.startsWith('김대표 · 지배주주(준 사람 본인)')) && !withCeo.headline.includes('김대표'), withCeo)
  // R2 결손 법인 — 법인세상당액 0 · 이익이 순이익 0 일 때보다 작지 않음
  const t7 = calculatorOf('t7')!
  const w2 = t7.subs.find((x) => x.key === 'w2')!
  const gainAt = (inc: number) => Number(lineV(w2.compute({ ...defaultValues(t7), w2_income: String(inc), w2_amount: '300000000' }), 'w2_out', '정산증여액').replace(/[^\d-]/g, ''))
  check('R2 순이익 -5억에 채무면제 3억 — 법인세 0 → 정산증여액 3억 그대로 · 순이익 -1억 ≥ 0 일 때(예전: 음수 세금으로 2.7억 · 순서 뒤집힘)', gainAt(-500_000_000) === 300_000_000 && gainAt(-100_000_000) >= gainAt(0) && gainAt(0) < 300_000_000, { m5: gainAt(-500_000_000), m1: gainAt(-100_000_000), z: gainAt(0) })
  // R3 주주 12명 — 자녀(명부 맨 끝)가 합친 줄에 묻히지 않음 · 합친 줄은 최대주주 지분율에서 빠짐
  const many = [{ id: 'ceo', name: '김대표', relation: 'ceo', shares: 20, acquirePrice: 0 }, ...Array.from({ length: 10 }, (_, i) => ({ id: `o${i}`, name: `남${i}`, relation: 'other', shares: 6, acquirePrice: 0 })), { id: 'kid', name: '김자녀', relation: 'child', shares: 20, acquirePrice: 0 }]
  const manyRec = mk({ ...base, id: 'many', shareholderRegister: many })
  const mpv = calcPresetValues(P('calc-t7-loan'), manyRec, today)
  const mrows = mpv.values.w_share_rows as RowValues[]
  const w1 = t7.subs.find((x) => x.key === 'w1')!
  const limit = Number(lineV(w1.compute({ ...defaultValues(t7), ...mpv.values }), 'w1_out', '과세되지 않는 대여원금 한도').replace(/[^\d-]/g, ''))
  check('R3 주주 12명 — 대표 · 자녀가 앞줄 · 합친 줄은 남 · 최대주주 지분율 20%(합친 32% 아님) → 한도 약 108.7억', mrows[0].name === '김대표' && mrows[1].name === '김자녀' && mrows[9].name.startsWith('그 외') && mrows.reduce((a, r) => a + Number(r.qty), 0) === 100 && Math.abs(limit - 100_000_000 / (0.046 * 0.2)) < 10, { names: mrows.map((r) => r.name), limit })
  // R4 1년 안 — 12개월 안 회차만(나머지는 이어 가면)
  const yes60 = withScenarioAnswer(full, 'hireSenior', 'yes', '2026-10-01T00:00:00.000Z')
  const badYear: string[] = []
  let laterSeen = 0
  for (const id of ['hire-youth', 'hire-senior', 'startup-hire'] as const) {
    for (const n of [1, 3]) {
      const pl = buildSituationPlan(id, id === 'hire-senior' ? yes60 : full, today, n)
      const sb = pl.blocks.find((b) => b.key === 'subsidy')!
      if (sb.state !== 'ok') continue
      const prog = Object.values(DEFAULT_PROGRAMS).find((p) => sb.headline.startsWith(p.name))!
      const within = prog.rounds.length ? Math.min(prog.totalAmount, prog.rounds.filter((r) => r.month <= 12).reduce((a, r) => a + r.amount, 0)) : prog.totalAmount
      if (sb.laterWon > 0) laterSeen += 1
      if (sb.won !== within * n || sb.won + sb.laterWon !== prog.totalAmount * n) badYear.push(`${id}×${n}: ${sb.won}/${sb.laterWon} vs ${within}`)
    }
  }
  check('R4 설계서 \'1년 안\' 고용지원금은 12개월 안 회차만 · 나머지는 \'이어 가면\'(합은 총액 그대로) · 12개월 넘는 회차가 있는 사업도 확인', badYear.length === 0 && laterSeen > 0, { badYear, laterSeen })
  // R5 다시 붙이기 — 같은 날 · 같은 할 일은 다시 걸지 않음
  const yy = withScenarioAnswer(full, 'hireYouth', 'yes', '2026-10-01T00:00:00.000Z')
  const p2 = buildSituationPlan('hire-youth', yy, today, 2)
  const ids = p2.actions.map((a) => a.id)
  const once = withToolResult(yy, planResultInput(p2, yy.companyName, ids, yy.toolResults))
  const again = planResultInput(p2, yy.companyName, ids, once.toolResults)
  const p3 = planResultInput(buildSituationPlan('hire-youth', yy, today, 3), yy.companyName, ids, once.toolResults)
  check('R5 같은 설계서를 다시 붙이면 새 할 일 0 · 3명으로 바꿔 붙이면 바뀐 할 일(회차 금액)만', once.toolResults[0].deadlines.length === ids.length && again.deadlines.length === 0 && p3.deadlines.length === 1 && p3.deadlines[0].title.includes('1차'), { again: again.deadlines, p3: p3.deadlines })
  // R6 연구소 설계서 → 연구소 화면은 고른 사람 수로
  const lab5 = buildSituationPlan('lab-start', full, today, 5).blocks.find((b) => b.key === 'rnd')!
  const lp = labPresetFor(P('lab-two'), 5)
  check('R6 연구원 5명 설계서 — 이어서 주소에 n=5 · 연구소 화면 인건비 2억(1명 4,000만원 × 5) · 제목 5명 · 1~50 밖이면 그대로', lab5.openPath.endsWith('&n=5') && lp.lab!.payroll === 200_000_000 && lp.title.startsWith('연구원 5명') && labPresetFor(P('lab-two'), 0) === P('lab-two') && labPresetFor(P('lab-material'), 5) === P('lab-material'), { open: lab5.openPath, lp: lp.lab })
  // R7 05 무이자 대여 — 이율은 계산기 기본값(예전에 바꾼 이율이 남아도 카드와 같은 숫자)
  check('R7 무이자 대여 상황은 이율을 계산기 기본값으로 둠(카드와 계산기 같은 숫자)', calcPresetValues(P('calc-t7-loan'), manyRec, today).values.w1_rate === defaultValues(t7).w1_rate && calcPresetValues(P('calc-t7-forgive'), manyRec, today).values.w1_rate === undefined)
}

// D-312 정책자금 상황 예시 · 한 장 설계서도 맞춤 추천 카드와 같은 근거(서류함 · 명부) — 같은 업체에 다른 추천 기관이 나오지 않게
{
  const T = '2026-10-28'
  const NOW12 = '2026-10-28T09:00:00.000Z'
  let base = normalizeClientOps({ id: 'sc312', companyName: '고용테크(주)', businessCategory: '서비스업', businessItem: '소프트웨어 개발', businessAddress: '대전광역시 유성구 1', establishedAt: '2021-03-02', employeeCount: '6', createdAt: NOW12, updatedAt: NOW12 } as never)
  base = withFactValue(base, 'revenue', '400000000', { source: 'financialStatements', status: 'confirmed', asOf: '2025', now: NOW12 })
  const grew = normalizeClientOps({
    ...base,
    toolResults: [{ id: 'tr-r', toolKey: 'employment', title: '4대보험 명부 진단', verdict: 'candidates', verdictLabel: '', summary: '', data: { tab: 'roster', headcount: { asOf: '2026-10-01', prev: { year: 2025, total: 5, youth: 1, actualMonths: 12 }, cur: { year: 2026, total: 6.5, youth: 2, actualMonths: 10 }, basis: 'history', counted: 7, excluded: { rel: 0, noEi: 0, noHire: 0, lostNoDate: 0 } }, counts: { youthCount: 2, newHireCount: 1 } }, deadlines: [], createdAt: '2026-10-01T09:00:00.000Z', publishedUpdateId: null }],
  } as never)
  const agencyOf = (h: string) => /추천 기관 (.+)$/.exec(h)?.[1] ?? ''
  const card = buildInsights(grew, T, []).find((i) => i.key === 'policy-funding')!
  const work = runScenario(scenarioPreset('policy-working')!, grew, T)
  check('D-312 운전자금 상황 예시 = 맞춤 추천 카드와 같은 추천 기관(명부 고용 증가 → 중진공)', agencyOf(work.headline) === agencyOf(card.headline) && agencyOf(card.headline) === '중소벤처기업진흥공단', JSON.stringify({ card: card.headline, scenario: work.headline }))
  check('D-312 상황 예시 첫 줄: 서류에서 본 근거(고용 증가)', work.lines[0]?.startsWith('서류: 고용 증가('), JSON.stringify(work.lines))
  check("D-312 체납 서류가 없으면 '높음' 으로 보지 않았다고(예전 '문제없다고 보고' 아님)", work.assumptions.some((a) => a.includes("체납은 납세증명서 · 완납증명서가 없어 '높음' 으로 보지 않았어요")) && !work.assumptions.some((a) => a.includes('문제없다고')), JSON.stringify(work.assumptions))
  const plan = buildSituationPlan('hire-youth', grew, T)
  const pol = plan.blocks.find((b) => b.key === 'policy')
  check('D-312 한 장 설계서 정책자금도 같은 근거 · 같은 가정 문구', !!pol && pol.assumptions.some((a) => a.includes("'높음' 으로 보지 않았어요")) && !pol.assumptions.some((a) => a.includes('문제없다고')), JSON.stringify(pol?.assumptions))
  const hireFit = runScenario(scenarioPreset('policy-hiring')!, grew, T).fit
  check('D-312 청년 채용 계획 질문 옆에 명부 힌트(고용 증가 · 청년) — 정책자금', hireFit.kind === 'ask' && hireFit.why.includes('명부: 고용 증가(2025년 평균 5명 → 2026년 예상 6.5명, 청년 2명) — 더 뽑으면 고용창출 자금 가점'), JSON.stringify(hireFit))
  const empFit = runScenario(scenarioPreset('emp-youth')!, grew, T).fit
  check('D-312 고용지원금 청년 채용 질문에도 같은 힌트', empFit.kind === 'ask' && empFit.why.includes('명부: 고용 증가('), JSON.stringify(empFit))
  check('D-312 명부가 없으면 힌트 없음', !runScenario(scenarioPreset('policy-hiring')!, base, T).fit.why.includes('명부:'))
  const plain = runScenario(scenarioPreset('policy-working')!, base, T)
  check('D-312 서류가 없으면 근거 줄 없음(예전 그대로)', !plain.lines.some((l) => l.startsWith('서류:')), JSON.stringify(plain.lines))
}

/* ---- D-318 창업감면 2026 개정 감면율 — 주소로 인구감소지역 · 상황 예시 · 한 장 설계서가 같은 값 ---- */
{
  check('D-318 주소 → 수도권 인구감소지역(가평 · 연천 · 강화 · 옹진)', startupRegion('인천광역시 강화군 강화읍 1').popDecline === 'yes' && startupRegion('경기도 가평군 가평읍 1').popDecline === 'yes' && startupRegion('경기도 화성시 동탄대로 1').popDecline === 'no' && startupRegion('부산광역시 해운대구 1').popDecline === '', [startupRegion('인천광역시 강화군 강화읍 1'), startupRegion('경기도 화성시 동탄대로 1')])
  const mk = (id: string, address: string, est: string, birth: string) =>
    normalizeClientOps({ ...full, id, businessAddress: address, establishedAt: est, representativeBirth: birth } as unknown as Partial<ClientOpsRecord>)
  const runLine = (r: ClientOpsRecord) => runScenario(scenarioPreset('startup-new')!, r, today).lines[0] ?? ''
  const planLine = (r: ClientOpsRecord) => (buildSituationPlan('startup-hire', r, today, 1).blocks.find((b) => b.key === 'startup')?.lines[0] ?? '')
  const gy26 = mk('gy26', '경기도 화성시 동탄대로 1', '2026-03-02', '1995-05-05')
  const gh26 = mk('gh26', '인천광역시 강화군 강화읍 1', '2026-03-02', '1995-05-05')
  const gy25 = mk('gy25', '경기도 화성시 동탄대로 1', '2025-03-02', '1995-05-05')
  const gy26old = mk('gy26o', '경기도 화성시 동탄대로 1', '2026-03-02', '1970-05-05')
  check('D-318 2026 창업 · 화성(수도권 · 과밀 밖) · 청년 → 상황 예시 감면율 75%', runLine(gy26).startsWith('감면율 75%') && runLine(gy26).includes('2026년 이후'), runLine(gy26))
  check('D-318 2026 창업 · 강화(인구감소지역) · 청년 → 100%', runLine(gh26).startsWith('감면율 100%') && runLine(gh26).includes('인구감소지역'), runLine(gh26))
  check('D-318 2025년 창업 · 화성 · 청년 → 옛 표 100%', runLine(gy25).startsWith('감면율 100%') && runLine(gy25).includes('2025년까지'), runLine(gy25))
  check('D-318 2026 창업 · 화성 · 일반 → 25%', runLine(gy26old).startsWith('감면율 25%'), runLine(gy26old))
  const insightDetail = (r: ClientOpsRecord) => buildInsights(r, today, []).find((i) => i.key === 'startup-tax')?.detail ?? ''
  check('D-318 맞춤 추천 창업감면 카드도 같은 감면율 줄로 시작(화성 청년 75%)', insightDetail(gy26).startsWith(runLine(gy26)), insightDetail(gy26))
  // D-325 서류함의 벤처기업확인서(확인일) → 창업벤처중소기업 50% — 서울 · 일반 대표
  const vSeoul = normalizeClientOps({ ...full, id: 'vseoul', businessAddress: '서울특별시 강남구 1', establishedAt: '2024-03-02', representativeBirth: '1970-05-05', factValues: { ...(full.factValues ?? {}), 'cf:벤처기업': '확인번호 V-1 · 확인일 2025-01-02 · 2028-01-01까지' } } as unknown as Partial<ClientOpsRecord>)
  check('D-325 벤처확인서 확인일(창업 3년 안) → 상황 예시 · 맞춤 추천 감면율 50% 창업벤처', runLine(vSeoul).startsWith('감면율 50% — 창업벤처중소기업') && insightDetail(vSeoul).startsWith('감면율 50% — 창업벤처'), [runLine(vSeoul), insightDetail(vSeoul)])
  // D-328 '창업 3년 안 벤처 확인을 받으면' — 서울 · 일반 · 2025 창업(벤처 없음) → 맞음 · 0% → 50%
  const vNone = normalizeClientOps({ ...full, id: 'vnone', businessAddress: '서울특별시 강남구 1', establishedAt: '2025-03-02', representativeBirth: '1970-05-05' } as unknown as Partial<ClientOpsRecord>)
  const vRun = runScenario(scenarioPreset('startup-venture')!, vNone, today)
  const vFit = scenarioFit(scenarioPreset('startup-venture')!, fitContext(vNone, today))
  check('D-328 벤처 확인 예시 — 서울 일반 창업 2년 안 → 맞음 · "벤처 확인을 받으면 0% → 50%" · 지금 · 받으면 두 줄', vFit.kind === 'fit' && vRun.headline.startsWith('벤처 확인을 받으면 0% → 50%') && vRun.lines[0].startsWith('지금(벤처 확인 없음): 감면율 0%') && vRun.lines[1].startsWith('벤처 확인을 받으면: 감면율 50%'), { fit: vFit, h: vRun.headline, l: vRun.lines })
  const fitOf = (r: ClientOpsRecord) => scenarioFit(scenarioPreset('startup-venture')!, fitContext(r, today))
  check('D-328 벤처 확인 예시 — 이미 벤처 · 청년 대표 · 지방 · 창업 3년 지남은 안 맞음(까닭)', fitOf(vSeoul).kind === 'no' && fitOf(gy26).kind === 'no' && fitOf(normalizeClientOps({ ...full, id: 'vbusan', businessAddress: '부산광역시 해운대구 1', establishedAt: '2025-03-02', representativeBirth: '1970-05-05' } as unknown as Partial<ClientOpsRecord>)).kind === 'no' && fitOf(normalizeClientOps({ ...full, id: 'vold', businessAddress: '서울특별시 강남구 1', establishedAt: '2022-03-02', representativeBirth: '1970-05-05' } as unknown as Partial<ClientOpsRecord>)).kind === 'no', [fitOf(vSeoul).why, fitOf(gy26).why])
  check('D-318 한 장 설계서(창업 5년 안 채용)의 창업감면 줄 = 상황 예시 줄', planLine(gy26) === runLine(gy26) && planLine(gh26) === runLine(gh26), [planLine(gy26), runLine(gy26)])
}

console.log(`\nscenarios: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
