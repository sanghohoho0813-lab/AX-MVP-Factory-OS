/**
 * 대규모 조합 셀프테스트
 *
 * 수백~수천 개의 입력 조합을 전수 생성해 judge()를 실행하고,
 * 구조적 불변식(structural invariants)과 도메인 규칙(domain rules)을 검증한다.
 *
 * 원본: startup-tax-checker/scripts/selftest.ts — 옮길 때 import 경로와 마지막 요약 줄만 바꿨다.
 * 실행: npm run test:startup-tax
 */
import type { AdvancedInput, FormData, JudgementResult, Verdict } from '../types'
import { judge, VERDICT_LABEL, VERDICT_ONELINE } from '../lib/judgement'
import { buildSummaryText } from '../lib/summary'
import {
  BUSINESS_TYPES,
  INDUSTRIES,
  OVERCONCENTRATIONS,
  REGIONS,
  STARTUP_FORMS,
} from '../lib/options'

const BASE = new Date('2026-06-24')

const EMPTY_ADV: AdvancedInput = {
  originalStartDate: '',
  hasExistingSole: '',
  hasExistingCorp: '',
  isExistingExec: '',
  newOwnerShare: '',
  familyShare: '',
  existingCorpExecShare: '',
  isOligopoly: '',
  prevIndustryRelation: '',
  assetTakeoverRatio: '',
  employeeMoved: '',
  reuseIdentity: '',
  sameAddress: '',
}

const NO_CHECK = {
  incomeTax: false,
  acquisitionTax: false,
  propertyTax: false,
  registrationTax: false,
}

function mkForm(p: Partial<FormData> = {}, adv: Partial<AdvancedInput> = {}): FormData {
  return {
    businessType: 'corporation',
    birthDate: '1990-01-01',
    startupDate: '2024-01-01',
    region: 'other_local',
    overconcentration: 'no',
    industry: 'manufacturing',
    startupForm: 'brand_new',
    checkItems: { ...NO_CHECK },
    ...p,
    advanced: { ...EMPTY_ADV, ...adv },
  } as FormData
}

// ---------------------------------------------------------------------------
// 검증 결과 수집
// ---------------------------------------------------------------------------
interface Failure {
  rule: string
  detail: string
  form: string
}
const failures: Failure[] = []
let checks = 0

function describe(f: FormData): string {
  const a = f.advanced
  const adv = Object.entries(a)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join(',')
  return `${f.businessType}/${f.industry}/${f.startupForm}/과밀=${f.overconcentration}/${f.region}/생년=${f.birthDate}/창업=${f.startupDate}${adv ? ' {' + adv + '}' : ''}`
}

function check(cond: boolean, rule: string, detail: string, f: FormData) {
  checks++
  if (!cond) failures.push({ rule, detail, form: describe(f) })
}

const VERDICTS: Verdict[] = ['good', 'caution', 'conditional', 'bad']
const RANK: Record<Verdict, number> = { bad: 0, conditional: 1, caution: 2, good: 3 }

// 문자열에 undefined/NaN 등 오염이 없는지
function clean(s: string): boolean {
  return (
    typeof s === 'string' &&
    s.length > 0 &&
    !s.includes('undefined') &&
    !s.includes('NaN') &&
    !s.includes('[object')
  )
}

// ---------------------------------------------------------------------------
// 1) 구조적 불변식 — 모든 조합에 적용
// ---------------------------------------------------------------------------
function checkStructure(f: FormData, r: JudgementResult) {
  check(VERDICTS.includes(r.overall), 'overall 유효값', `overall=${r.overall}`, f)
  check(
    r.oneLineConclusion === VERDICT_ONELINE[r.overall],
    '한줄결론 일치',
    `conclusion="${r.oneLineConclusion}"`,
    f,
  )
  check(clean(r.oneLineConclusion), '한줄결론 오염없음', r.oneLineConclusion, f)

  // 법 기준 3개
  check(r.frameworks.length === 3, '프레임워크 3개', `len=${r.frameworks.length}`, f)
  const keys = r.frameworks.map((x) => x.key).join(',')
  check(keys === 'taxLaw,startupLaw,localTax', '프레임워크 순서/키', keys, f)
  for (const fw of r.frameworks) {
    check(VERDICTS.includes(fw.verdict), `${fw.key} verdict 유효`, `${fw.verdict}`, f)
    check(clean(fw.conclusion), `${fw.key} conclusion 오염없음`, fw.conclusion, f)
    check(clean(fw.note), `${fw.key} note 오염없음`, fw.note, f)
    check(fw.points.length > 0, `${fw.key} points 존재`, `len=${fw.points.length}`, f)
    for (const p of fw.points) check(clean(p.text), `${fw.key} point 오염없음`, p.text, f)
    for (const rk of fw.risks) check(clean(rk), `${fw.key} risk 오염없음`, rk, f)
    for (const cp of fw.checkPoints) check(clean(cp), `${fw.key} checkPoint 오염없음`, cp, f)
  }

  // 핵심 이유 / 확인사항
  check(r.keyReasons.length <= 3, '핵심이유 3개 이하', `len=${r.keyReasons.length}`, f)
  for (const k of r.keyReasons) check(clean(k), '핵심이유 오염없음', k, f)
  for (const k of r.keyChecks) check(clean(k), '확인사항 오염없음', k, f)

  // 상담 질문 — 중복 없음, 상한
  check(r.consultQuestions.length <= 8, '상담질문 8개 이하', `len=${r.consultQuestions.length}`, f)
  check(
    new Set(r.consultQuestions).size === r.consultQuestions.length,
    '상담질문 중복없음',
    r.consultQuestions.join('|'),
    f,
  )
  check(r.consultChecklist.length === 5, '체크리스트 5개', `len=${r.consultChecklist.length}`, f)

  // 등급
  check(['A', 'B', 'C', 'D'].includes(r.expertReview.grade), '추천도 등급 유효', r.expertReview.grade, f)
  check(['A', 'B', 'C', 'D'].includes(r.savingsLevel.level), '절세규모 등급 유효', r.savingsLevel.level, f)
  check(clean(r.savingsLevel.label), '절세규모 라벨 오염없음', r.savingsLevel.label, f)

  // 등록면허세는 추천도 산정 요소에서 제외되어야 함
  check(
    !r.expertReview.factors.some((x) => x.includes('등록면허세')),
    '추천도에 등록면허세 미포함',
    r.expertReview.factors.join(','),
    f,
  )

  // 종합판정은 핵심 3항목 중 최저 (등록면허세 제외)
  if (r.coreItems.length > 0) {
    const min = Math.min(...r.coreItems.map((i) => RANK[i.verdict]))
    check(RANK[r.overall] === min, '종합=핵심항목 최저', `overall=${r.overall}`, f)
  }

  // 카톡 요약
  const sum = buildSummaryText(r)
  check(clean(sum), '요약문 오염없음', sum.slice(0, 40), f)
  check(sum.includes(VERDICT_LABEL[r.overall]), '요약문에 판정 포함', VERDICT_LABEL[r.overall], f)
  check(sum.split('\n').length <= 18, '요약문 길이 제한', `lines=${sum.split('\n').length}`, f)

  // 승계 분석 일관성
  const L = r.lineage
  const inheritedForms = ['conversion', 'acquisition', 'succession']
  check(
    L.inherited === inheritedForms.includes(f.startupForm as string),
    '승계형 판별 일치',
    `inherited=${L.inherited} form=${f.startupForm}`,
    f,
  )
  if (L.businessAgeYears !== null) {
    check(L.businessAgeYears >= 0, '업력 음수 아님', `${L.businessAgeYears}`, f)
    check(
      L.within7Years === L.businessAgeYears <= 7,
      '7년 판정 일치',
      `age=${L.businessAgeYears} within=${L.within7Years}`,
      f,
    )
  }
}

// ---------------------------------------------------------------------------
// 2) 도메인 규칙
// ---------------------------------------------------------------------------
function checkDomain(f: FormData, r: JudgementResult) {
  const tax = r.frameworks[0]
  const startup = r.frameworks[1]

  // 부동산업 → 조특법 감면 불가
  if (f.industry === 'real_estate') {
    check(tax.verdict === 'bad', '부동산업 조특법 불가', tax.verdict, f)
  }
  // 금융보험업 → 조특법 good 아님
  if (f.industry === 'finance_insurance') {
    check(tax.verdict !== 'good', '금융보험 조특법 good아님', tax.verdict, f)
  }
  // 특수관계인 승계 → 종합 good 아님
  if (f.startupForm === 'succession') {
    check(r.overall !== 'good', '승계는 종합 good아님', r.overall, f)
  }
  // 업력 7년 초과 → 창업지원법 불가
  if (r.lineage.within7Years === false) {
    check(startup.verdict === 'bad', '업력7년초과 창업기업 불가', startup.verdict, f)
  }
  // 승계형 + 개시일 미입력 → 판단 보류(good 금지)
  if (r.lineage.needsOriginalDate) {
    check(startup.verdict !== 'good', '개시일미입력 창업기업 good아님', startup.verdict, f)
    check(tax.verdict !== 'good', '개시일미입력 조특법 good아님', tax.verdict, f)
  }
  // 법인전환 + 업력 7년 이내 + 별도 결격사유 없음 → 창업기업 불가로 단정 금지
  // (친족 50%초과·과점주주 등 실제 제외사유가 있으면 bad는 정상)
  const a = f.advanced
  const hasDisqualifier =
    Number(a.familyShare || 0) > 50 ||
    Number(a.existingCorpExecShare || 0) > 50 ||
    a.isOligopoly === 'yes'
  if (f.startupForm === 'conversion' && r.lineage.within7Years === true && !hasDisqualifier) {
    check(startup.verdict !== 'bad', '법인전환 7년내 창업기업 단정불가 금지', startup.verdict, f)
  }
  // 청년 기준 정확성
  const age = r.youth.age
  if (age !== null) {
    if (age >= 15 && age <= 34) check(r.youth.taxLaw === true, '조특법청년 15~34', `${age}`, f)
    else if (age >= 35 && age <= 40) check(r.youth.taxLaw === null, '조특법청년 경계 35~40', `${age}`, f)
    else check(r.youth.taxLaw === false, '조특법청년 그외 false', `${age}`, f)
    check(r.youth.startupLaw === age <= 39, '창업지원법청년 39이하', `${age}`, f)
  }
}

// ---------------------------------------------------------------------------
// 3) 전수 조합 실행
// ---------------------------------------------------------------------------
const AGES = ['1995-06-01', '1988-06-01', '1986-06-01', '1971-06-01'] // 31 / 38 / 40 / 55세
const STARTUP_DATES = ['2024-01-01', '2016-01-01'] // 업력 2년 / 10년
const ADV_VARIANTS: { name: string; adv: Partial<AdvancedInput> }[] = [
  { name: 'none', adv: {} },
  { name: 'orig2024', adv: { originalStartDate: '2024-03-01', prevIndustryRelation: 'same' } },
  { name: 'orig2015', adv: { originalStartDate: '2015-01-01', prevIndustryRelation: 'same' } },
  { name: 'heavy', adv: { familyShare: '70', isOligopoly: 'yes', assetTakeoverRatio: '60', sameAddress: 'yes', reuseIdentity: 'yes' } },
]

let total = 0
for (const bt of BUSINESS_TYPES) {
  for (const ind of INDUSTRIES) {
    for (const sf of STARTUP_FORMS) {
      for (const oc of OVERCONCENTRATIONS) {
        for (const birth of AGES) {
          for (const sd of STARTUP_DATES) {
            for (const av of ADV_VARIANTS) {
              const f = mkForm(
                {
                  businessType: bt.value,
                  industry: ind.value,
                  startupForm: sf.value,
                  overconcentration: oc.value,
                  birthDate: birth,
                  startupDate: sd,
                  region: REGIONS[total % REGIONS.length].value,
                },
                av.adv,
              )
              let r: JudgementResult
              try {
                r = judge(f, BASE)
              } catch (e) {
                failures.push({ rule: '예외 발생', detail: String(e), form: describe(f) })
                total++
                continue
              }
              checkStructure(f, r)
              checkDomain(f, r)
              total++
            }
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 4) 속성(차등) 테스트
// ---------------------------------------------------------------------------
// (A) 창업기업 확인은 나이와 무관해야 한다 — 생년월일만 바꿔도 startupLaw 판정 동일
let ageIndepChecked = 0
for (const sf of STARTUP_FORMS) {
  for (const ind of INDUSTRIES) {
    const verdicts = AGES.map((b) => {
      const f = mkForm({ startupForm: sf.value, industry: ind.value, birthDate: b })
      return judge(f, BASE).frameworks[1].verdict
    })
    const same = verdicts.every((v) => v === verdicts[0])
    checks++
    ageIndepChecked++
    if (!same) {
      failures.push({
        rule: '창업기업확인 나이 무관',
        detail: `verdicts=${verdicts.join(',')}`,
        form: `${sf.value}/${ind.value}`,
      })
    }
  }
}

// (B) 단조성 — 리스크를 추가하면 판정이 좋아지면 안 된다
let monoChecked = 0
for (const sf of STARTUP_FORMS) {
  for (const ind of INDUSTRIES) {
    const baseF = mkForm({ startupForm: sf.value, industry: ind.value })
    const worseF = mkForm(
      { startupForm: sf.value, industry: ind.value },
      { familyShare: '80', isOligopoly: 'yes', assetTakeoverRatio: '70', sameAddress: 'yes', reuseIdentity: 'yes', employeeMoved: 'yes' },
    )
    const b = judge(baseF, BASE)
    const w = judge(worseF, BASE)
    for (let i = 0; i < 3; i++) {
      checks++
      monoChecked++
      if (RANK[w.frameworks[i].verdict] > RANK[b.frameworks[i].verdict]) {
        failures.push({
          rule: '단조성(리스크 추가 시 개선 금지)',
          detail: `${b.frameworks[i].key}: ${b.frameworks[i].verdict} → ${w.frameworks[i].verdict}`,
          form: `${sf.value}/${ind.value}`,
        })
      }
    }
  }
}

// (C) 핵심 회귀 케이스 — 명시적 기대값
interface Expect {
  name: string
  form: FormData
  expect: (r: JudgementResult) => [boolean, string]
}
const CASES: Expect[] = [
  {
    name: '청년+제조+비과밀+신규 → 종합 good, 조특법 good',
    form: mkForm({ birthDate: '1995-06-01', industry: 'manufacturing', overconcentration: 'no', startupForm: 'brand_new' }),
    expect: (r) => [r.overall === 'good' && r.frameworks[0].verdict === 'good', `overall=${r.overall} tax=${r.frameworks[0].verdict}`],
  },
  {
    name: '비청년(55세)+제조+비과밀+신규 → 조특법 여전히 good (청년 게이팅 없음)',
    form: mkForm({ birthDate: '1971-06-01', industry: 'manufacturing', overconcentration: 'no', startupForm: 'brand_new' }),
    expect: (r) => [r.frameworks[0].verdict === 'good', `tax=${r.frameworks[0].verdict}`],
  },
  {
    name: '비청년(55세) 신규 → 창업지원법 good (청년 무관)',
    form: mkForm({ birthDate: '1971-06-01', startupForm: 'brand_new' }),
    expect: (r) => [r.frameworks[1].verdict === 'good', `startup=${r.frameworks[1].verdict}`],
  },
  {
    name: '2024개인창업→법인전환(동종) → 창업기업 유지가능(bad 아님), 감면 잔여 존재',
    form: mkForm({ startupForm: 'conversion', startupDate: '2026-03-01' }, { originalStartDate: '2024-03-01', prevIndustryRelation: 'same' }),
    expect: (r) => [
      r.frameworks[1].verdict !== 'bad' && r.lineage.hasTaxRemaining === true && r.lineage.within7Years === true,
      `startup=${r.frameworks[1].verdict} remain=${r.lineage.hasTaxRemaining} within7=${r.lineage.within7Years}`,
    ],
  },
  {
    name: '2015개인창업→법인전환 → 업력초과로 창업기업 불가',
    form: mkForm({ startupForm: 'conversion', startupDate: '2026-03-01' }, { originalStartDate: '2015-01-01' }),
    expect: (r) => [r.frameworks[1].verdict === 'bad' && r.lineage.within7Years === false, `startup=${r.frameworks[1].verdict} within7=${r.lineage.within7Years}`],
  },
  {
    name: '법인전환+개시일 미입력 → 조건부(판단 보류)',
    form: mkForm({ startupForm: 'conversion' }),
    expect: (r) => [r.lineage.needsOriginalDate === true && r.frameworks[1].verdict !== 'good', `needs=${r.lineage.needsOriginalDate} startup=${r.frameworks[1].verdict}`],
  },
  {
    name: '부동산업 → 조특법 불가',
    form: mkForm({ industry: 'real_estate' }),
    expect: (r) => [r.frameworks[0].verdict === 'bad', `tax=${r.frameworks[0].verdict}`],
  },
  {
    name: '특수관계인 승계 → 종합 good 아님',
    form: mkForm({ startupForm: 'succession' }),
    expect: (r) => [r.overall !== 'good', `overall=${r.overall}`],
  },
  {
    name: '신규창업 업력10년 → 창업기업 불가',
    form: mkForm({ startupForm: 'brand_new', startupDate: '2016-01-01' }),
    expect: (r) => [r.frameworks[1].verdict === 'bad', `startup=${r.frameworks[1].verdict}`],
  },
  {
    name: '깨끗한 신규창업 법인 → 추천도 D (등록면허세 요소 제외 확인)',
    form: mkForm({ businessType: 'corporation', startupForm: 'brand_new', industry: 'manufacturing', overconcentration: 'no' }),
    expect: (r) => [r.expertReview.grade === 'D', `grade=${r.expertReview.grade} factors=${r.expertReview.factors.join('|')}`],
  },
]

const caseFails: string[] = []
for (const c of CASES) {
  checks++
  try {
    const r = judge(c.form, BASE)
    const [ok, detail] = c.expect(r)
    if (!ok) caseFails.push(`${c.name} → ${detail}`)
  } catch (e) {
    caseFails.push(`${c.name} → 예외: ${e}`)
  }
}

// ---------------------------------------------------------------------------
// 리포트
// ---------------------------------------------------------------------------
console.log('='.repeat(70))
console.log('창업감면 판정기 셀프테스트')
console.log('='.repeat(70))
console.log(`조합 실행       : ${total.toLocaleString()} 건`)
console.log(`나이무관 속성   : ${ageIndepChecked} 건`)
console.log(`단조성 속성     : ${monoChecked} 건`)
console.log(`회귀 케이스     : ${CASES.length} 건`)
console.log(`총 검증(assert) : ${checks.toLocaleString()} 건`)
console.log('-'.repeat(70))

if (caseFails.length) {
  console.log(`\n❌ 회귀 케이스 실패 ${caseFails.length}건:`)
  caseFails.forEach((x) => console.log('  - ' + x))
}

if (failures.length) {
  // 규칙별 집계
  const byRule = new Map<string, Failure[]>()
  for (const f of failures) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, [])
    byRule.get(f.rule)!.push(f)
  }
  console.log(`\n❌ 불변식 위반 ${failures.length.toLocaleString()}건 (규칙 ${byRule.size}종):`)
  for (const [rule, list] of [...byRule.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  [${rule}] ${list.length}건`)
    list.slice(0, 3).forEach((x) => console.log(`    · ${x.detail}\n      ${x.form}`))
    if (list.length > 3) console.log(`    ... 외 ${list.length - 3}건`)
  }
} else if (!caseFails.length) {
  console.log('\n✅ 모든 검증 통과 — 실패 0건')
}

console.log('='.repeat(70))
const failedTotal = failures.length + caseFails.length
console.log(`\nstartup-tax: ${(checks - failedTotal).toLocaleString()} passed, ${failedTotal} failed`)
process.exit(failedTotal > 0 ? 1 : 0)
