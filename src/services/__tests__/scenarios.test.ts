/**
 * D-199 상황 예시로 바로 설계 — 카탈로그 · 업체 숫자로 계산 · 필요한 숫자 ✓/✗ · 요청 문구 · 모듈 엔진과 같은 답.
 */
import { normalizeClientOps } from '../clientOpsService'
import { SCENARIO_PRESETS, scenarioPath, scenarioPreset } from '../scenarioPresets'
import { runScenario, runScenarios, scenarioTaxProfile, scenariosRequest } from '../scenarios'
import { cashPlan, goalNeeds, shareValueOf, viewProfile } from '../taxPlan'
import { diagnoseHiring } from '../../tools/employment/lib/eligibility'
import { DEFAULT_PROGRAMS } from '../../tools/employment/lib/programs'
import type { ClientOpsRecord } from '../../types/clientOps'

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
const sorted = runScenarios(empty, today, () => true, true)
const rank = { ready: 0, partial: 1, need: 2 } as const
check('S15 바로 설계된 것 먼저(같으면 카탈로그 순서)', sorted.every((x, i) => i === 0 || rank[sorted[i - 1].state] <= rank[x.state]))
check('S16 요금제에 없는 모듈은 빼고 계산', runScenarios(full, today, (m) => m === 'tax').every((x) => x.module === 'tax') && runScenarios(full, today, () => false).length === 0)

// S17 절세 설계 화면과 같은 '필요한 값' 목록
const none = viewProfile({})
const needs = goalNeeds('cash', none, [], shareValueOf(none, []), {}).map((n) => n.key)
check('S17 필요한 값 목록(절세 설계 빨간 안내와 같은 함수) — 대표 급여 · 주주명부 · 주식가치 · 배당 가능한 이익 · 취임일', ['monthlySalary', 'holders', 'value', 'retainedEarnings', 'ceoStartDate'].every((k) => needs.includes(k)), needs)

// S18 한 상황이 실패해도 나머지는 보인다
const one = runScenario(SCENARIO_PRESETS[0], full, today)
check('S18 상황 하나만 계산해도 같은 결과', one.headline === cash.headline)

console.log(`\nscenarios: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
