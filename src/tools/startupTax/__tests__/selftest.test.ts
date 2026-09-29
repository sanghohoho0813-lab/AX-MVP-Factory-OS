/**
 * 대규모 조합 셀프테스트
 *
 * 수천~수만 개의 입력 조합을 전수 생성해 judge()를 실행하고,
 * 구조적 불변식(structural invariants)과 도메인 규칙(domain rules)을 검증한다.
 *
 * 원본: startup-tax-checker/scripts/selftest.ts — 옮길 때 import 경로와 마지막 요약 줄만 바꿨다.
 * D-136: 판정 규칙을 고치며 불변식·경계 사례를 더했다 (창업 당시 청년 나이 · 과밀+비청년 · 5개 과세연도 ·
 *        머리 판정 ≤ 조특법 · 지역↔과밀 · 업종 목록 · 동종 재개업 · 예시 날짜 · 예비창업 · 2026 창업 · 시간대).
 *        TZ=UTC 와 TZ=Asia/Seoul 둘 다에서 돌아야 한다 — 기준일은 로컬 달력 날짜로 만든다.
 * 실행: npm run test:startup-tax
 */
import type { AdvancedInput, FormData, JudgementResult, Verdict } from '../types'
import {
  judge,
  NOTICE_DATE_ORDER,
  NOTICE_MISSING_DATES,
  NOTICE_PRE_STARTUP,
  VERDICT_LABEL,
  VERDICT_ONELINE,
} from '../lib/judgement'
import { buildSummaryText } from '../lib/summary'
import { calcAge, formatDate, parseLocalDate } from '../lib/date'
import { calendarYearsBetween, formatAge, formatTaxRemaining } from '../lib/lineage'
import { EMPTY_FORM, PLACEHOLDER_BIRTH, PLACEHOLDER_STARTUP, withoutPlaceholders } from '../lib/formDefaults'
import { REVISED_RULE_ALERT } from '../lib/rules'
import {
  BUSINESS_TYPES,
  INDUSTRIES,
  OVERCONCENTRATIONS,
  REGIONS,
  STARTUP_FORMS,
} from '../lib/options'

// 로컬 달력 날짜 (new Date('YYYY-MM-DD') 는 UTC 라 시간대마다 날짜가 달라진다)
const BASE = new Date(2026, 5, 24) // 2026-06-24
const BASE_YEAR = BASE.getFullYear()

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
    !s.includes('[object') &&
    !s.includes('null')
  )
}

// 시험이 따로 세는 만 나이 (글자로만 계산 — 판정기 코드와 독립, 시간대 무관)
function ageAt(birth: string, on: string): number {
  const [by, bm, bd] = birth.split('-').map(Number)
  const [y, m, d] = on.split('-').map(Number)
  let a = y - by
  if (m < bm || (m === bm && d < bd)) a--
  return a
}
const INHERITED = ['conversion', 'acquisition', 'succession']
const ELIGIBLE_INDUSTRIES = ['manufacturing', 'ict', 'restaurant']
function validDate(s: string): boolean {
  return parseLocalDate(s) !== null
}
// 청년 판단에 쓰는 창업일 (승계형 + 기존 개시일 있으면 그 날짜)
function youthStartOf(f: FormData): string {
  return INHERITED.includes(f.startupForm) && validDate(f.advanced.originalStartDate)
    ? f.advanced.originalStartDate
    : f.startupDate
}
function effectiveOver(f: FormData): boolean {
  return f.region === 'seoul' || f.overconcentration === 'yes'
}

// ---------------------------------------------------------------------------
// 1) 구조적 불변식 — 모든 조합에 적용
// ---------------------------------------------------------------------------
function checkStructure(f: FormData, r: JudgementResult) {
  check(VERDICTS.includes(r.overall), 'overall 유효값', `overall=${r.overall}`, f)
  check(
    r.oneLineConclusion === (r.notice ?? VERDICT_ONELINE[r.overall]),
    '한줄결론 일치',
    `conclusion="${r.oneLineConclusion}"`,
    f,
  )
  check(clean(r.oneLineConclusion), '한줄결론 오염없음', r.oneLineConclusion, f)
  for (const a of r.alerts) check(clean(a), '★확인 오염없음', a, f)
  check(new Set(r.alerts).size === r.alerts.length, '★확인 중복없음', r.alerts.join('|'), f)

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
    for (const rk of fw.risks) {
      check(clean(rk), `${fw.key} risk 오염없음`, rk, f)
      check(!rk.includes('약 0년'), `${fw.key} risk '약 0년' 없음 (D-136)`, rk, f)
    }
    for (const cp of fw.checkPoints) check(clean(cp), `${fw.key} checkPoint 오염없음`, cp, f)
  }

  // 핵심 이유 / 확인사항
  check(r.keyReasons.length <= 3, '핵심이유 3개 이하', `len=${r.keyReasons.length}`, f)
  for (const k of r.keyReasons) check(clean(k), '핵심이유 오염없음', k, f)
  for (const k of r.keyChecks) check(clean(k), '확인사항 오염없음', k, f)
  for (const k of r.reasons) check(clean(k), '판정사유 오염없음', k, f)

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
  // D-136: '수천만 원 이상'(A)은 종합이 '가능성 높음' 일 때만
  if (r.savingsLevel.level === 'A') {
    check(r.overall === 'good', '절세 A 는 종합 good 일 때만', `overall=${r.overall}`, f)
  }

  // 등록면허세는 추천도 산정 요소에서 제외되어야 함
  check(
    !r.expertReview.factors.some((x) => x.includes('등록면허세')),
    '추천도에 등록면허세 미포함',
    r.expertReview.factors.join(','),
    f,
  )

  // 종합판정 = min(핵심 항목, 조특법 기준) — D-136: 조특법 블록보다 좋게 나오지 않는다
  const taxLaw = r.frameworks[0]
  const coreMin = r.coreItems.length > 0 ? Math.min(...r.coreItems.map((i) => RANK[i.verdict])) : RANK.conditional
  check(
    RANK[r.overall] === Math.min(coreMin, RANK[taxLaw.verdict]),
    '종합=min(핵심항목, 조특법)',
    `overall=${r.overall} coreMin=${coreMin} tax=${taxLaw.verdict}`,
    f,
  )
  check(RANK[r.overall] <= RANK[taxLaw.verdict], '종합 ≤ 조특법', `overall=${r.overall} tax=${taxLaw.verdict}`, f)

  // 카톡 요약
  const sum = buildSummaryText(r)
  check(clean(sum), '요약문 오염없음', sum.slice(0, 40), f)
  check(sum.includes(VERDICT_LABEL[r.overall]), '요약문에 판정 포함', VERDICT_LABEL[r.overall], f)
  check(sum.split('\n').length <= 18, '요약문 길이 제한', `lines=${sum.split('\n').length}`, f)
  if (r.notice) check(sum.includes(r.notice), '요약문에 안내 포함', r.notice, f)

  // 승계 분석 일관성
  const L = r.lineage
  check(
    L.inherited === INHERITED.includes(f.startupForm as string),
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
  // D-136: 감면 잔여는 과세연도 정수 — 남았다고 하면 1 이상
  if (L.taxRemainingYears !== null) {
    check(Number.isInteger(L.taxRemainingYears), '감면 잔여 정수', `${L.taxRemainingYears}`, f)
    check(L.hasTaxRemaining === L.taxRemainingYears >= 1, '감면 잔여 표시 일치', `${L.taxRemainingYears}/${L.hasTaxRemaining}`, f)
    check(L.taxLastYear !== null && L.taxRemainingYears === Math.max(0, L.taxLastYear - BASE_YEAR + 1), '감면 잔여 = 마지막해-올해+1', `${L.taxLastYear}`, f)
  }
}

// ---------------------------------------------------------------------------
// 2) 도메인 규칙
// ---------------------------------------------------------------------------
function checkDomain(f: FormData, r: JudgementResult) {
  const tax = r.frameworks[0]
  const startup = r.frameworks[1]
  const income = r.coreItems.find((i) => i.key === 'incomeTax')

  // 부동산업 → 조특법 감면 불가
  if (f.industry === 'real_estate') {
    check(tax.verdict === 'bad', '부동산업 조특법 불가', tax.verdict, f)
  }
  // 금융보험업 → 조특법 good 아님
  if (f.industry === 'finance_insurance') {
    check(tax.verdict !== 'good', '금융보험 조특법 good아님', tax.verdict, f)
  }
  // D-136: 대상 업종 목록(제조·정보통신·음식점) 밖이면 조특법·종합 good 금지
  if (!ELIGIBLE_INDUSTRIES.includes(f.industry)) {
    check(tax.verdict !== 'good', '목록 밖 업종 조특법 good아님', tax.verdict, f)
    check(r.overall !== 'good', '목록 밖 업종 종합 good아님', r.overall, f)
  }
  // 특수관계인 승계 → 종합 good 아님
  if (f.startupForm === 'succession') {
    check(r.overall !== 'good', '승계는 종합 good아님', r.overall, f)
  }
  // D-136: 폐업 후 동종 재개업 → 조특법 불가 (§6⑩)
  if (f.startupForm === 'reopen_same') {
    check(tax.verdict === 'bad', '동종 재개업 조특법 불가', tax.verdict, f)
    if (income) check(income.verdict === 'bad', '동종 재개업 법인세 항목 불가', income.verdict, f)
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
  // D-136: 감면 5개 과세연도 (보수적: 창업한 해 + 4) — 신규 창업도
  const taxStart = r.lineage.inherited && !r.lineage.needsOriginalDate ? f.advanced.originalStartDate : f.startupDate
  if (!r.lineage.needsOriginalDate && validDate(taxStart) && !r.notice) {
    const last = Number(taxStart.slice(0, 4)) + 4
    if (BASE_YEAR > last) check(tax.verdict === 'bad', '감면 5개 과세연도 지나면 조특법 불가', `${taxStart} ${tax.verdict}`, f)
    else if (BASE_YEAR === last) check(tax.verdict !== 'good', '마지막 과세연도 조특법 good아님', `${taxStart} ${tax.verdict}`, f)
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

  // 청년 기준 정확성 — D-136: 조특법 청년은 "창업 당시" 나이
  const ys = youthStartOf(f)
  if (validDate(f.birthDate) && validDate(ys) && ageAt(f.birthDate, ys) >= 0) {
    const age = ageAt(f.birthDate, ys)
    check(r.youth.age === age, '청년 나이 = 창업 당시 나이', `${r.youth.age} vs ${age}`, f)
    if (age >= 15 && age <= 34) check(r.youth.taxLaw === true, '조특법청년 창업당시 15~34', `${age}`, f)
    else if (age >= 35 && age <= 40) check(r.youth.taxLaw === null, '조특법청년 경계 35~40(병역 확인)', `${age}`, f)
    else check(r.youth.taxLaw === false, '조특법청년 그외 false', `${age}`, f)
    check(r.isYouth === r.youth.taxLaw, '청년 카드 = 판정 청년값', `${r.isYouth}/${r.youth.taxLaw}`, f)
    if (r.youth.taxLaw === null) {
      check(!r.reasons.includes('청년 요건 미해당'), '35~40 은 미해당이라 쓰지 않음', r.reasons.join('|'), f)
    }
  }
  if (validDate(f.birthDate)) {
    const now = ageAt(f.birthDate, formatDate(BASE))
    check(r.youth.startupLaw === now <= 39, '창업지원법청년 39이하(오늘 나이)', `${now}`, f)
  }

  // D-136: 과밀(서울 포함) + 청년 아님(또는 병역 확인 전) → 조특법·종합 good 금지 (원칙 0%)
  if (effectiveOver(f)) {
    check(tax.verdict !== 'good', '과밀 조특법 good아님', tax.verdict, f)
    check(r.overall !== 'good', '과밀 종합 good아님', r.overall, f)
    // 지특법 §58의3 — 과밀이면 취득세·재산세 good 금지
    for (const it of r.coreItems) {
      if (it.key !== 'incomeTax') check(it.verdict !== 'good', '과밀 지방세 good아님', `${it.key}=${it.verdict}`, f)
    }
  }
  if (f.region === 'seoul' && f.overconcentration !== 'yes') {
    check(r.alerts.some((x) => x.includes('서울은 전 지역')), '서울 과밀 안내', r.alerts.join('|'), f)
  }
  // 지방 + 과밀 '예' → 두 답 불일치 → 종합 good 금지 · 안내
  if ((f.region === 'metro_city' || f.region === 'other_local') && f.overconcentration === 'yes') {
    check(r.overall !== 'good', '지방+과밀예 종합 good아님', r.overall, f)
    check(r.alerts.some((x) => x.includes('맞지 않습니다')), '지방+과밀예 안내', r.alerts.join('|'), f)
  }
  if (f.region === 'gyeonggi_incheon') {
    check(r.alerts.some((x) => x.includes('경기·인천')), '경기·인천 주소 확인 안내', r.alerts.join('|'), f)
  }

  // D-136: 2026 이후 창업 → 종합 good 금지 · 개정 규정 안내
  if (f.startupDate >= '2026-01-01') {
    check(r.overall !== 'good', '2026 창업 종합 good아님', r.overall, f)
    check(r.alerts.includes(REVISED_RULE_ALERT), '2026 창업 개정 안내', r.alerts.join('|'), f)
  }
  // D-136: 예비창업(창업일이 아직 안 옴) → 안내 · good 금지
  if (validDate(f.startupDate) && f.startupDate > formatDate(BASE) && validDate(f.birthDate)) {
    check(r.notice === NOTICE_PRE_STARTUP, '예비창업 안내', `${r.notice}`, f)
    check(r.overall !== 'good', '예비창업 종합 good아님', r.overall, f)
  }
  // 법인 + 청년(또는 확인 필요) → 최대주주 안내
  if (f.businessType === 'corporation' && r.youth.taxLaw === true) {
    check(r.alerts.some((x) => x.includes('최대주주')), '법인 청년 최대주주 안내', r.alerts.join('|'), f)
  }
}

// ---------------------------------------------------------------------------
// 3) 전수 조합 실행
// ---------------------------------------------------------------------------
const AGES = ['1995-06-01', '1988-06-01', '1986-06-01', '1971-06-01']
// 업력 2년 / 10년 / 마지막 과세연도(2022+4=2026) / 2026 창업(개정) / 예비창업(아직 안 옴)
const STARTUP_DATES = ['2024-01-01', '2016-01-01', '2022-03-01', '2026-02-01', '2026-12-01']
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

// (C) D-136 청년 단조성 — 같은 입력에서 청년이 청년 아님(또는 병역 확인 전)보다 나쁘면 안 된다
let youthMonoChecked = 0
for (const bt of BUSINESS_TYPES) {
  for (const ind of INDUSTRIES) {
    for (const sf of STARTUP_FORMS) {
      for (const oc of OVERCONCENTRATIONS) {
        for (const rg of REGIONS) {
          for (const sd of ['2024-01-01', '2022-03-01', '2026-02-01']) {
            const y = Number(sd.slice(0, 4))
            // 창업 당시 30세(청년) / 37세(병역 확인) / 50세(청년 아님)
            const births = [`${y - 30}-01-01`, `${y - 37}-01-01`, `${y - 50}-01-01`]
            const rs = births.map((b) =>
              judge(mkForm({ businessType: bt.value, industry: ind.value, startupForm: sf.value, overconcentration: oc.value, region: rg.value, startupDate: sd, birthDate: b }), BASE),
            )
            const tags = ['청년', '병역확인', '비청년']
            for (let i = 1; i < 3; i++) {
              for (const pick of [(r: JudgementResult) => r.overall, (r: JudgementResult) => r.frameworks[0].verdict]) {
                checks++
                youthMonoChecked++
                if (RANK[pick(rs[0])] < RANK[pick(rs[i])]) {
                  failures.push({
                    rule: '청년 단조성(청년이 더 나쁘면 안 됨)',
                    detail: `${tags[0]}=${pick(rs[0])} < ${tags[i]}=${pick(rs[i])}`,
                    form: `${bt.value}/${ind.value}/${sf.value}/${oc.value}/${rg.value}/${sd}`,
                  })
                }
              }
            }
          }
        }
      }
    }
  }
}

// (D) D-136 업종 — 모든 업종 값(모르는 값 포함)에서 목록 밖이면 good 이 나오지 않는다
let industryChecked = 0
for (const ind of [...INDUSTRIES.map((i) => i.value as string), '', 'construction', 'unknown', '도소매']) {
  const f = mkForm({ industry: ind as FormData['industry'], birthDate: '1995-06-01' })
  const r = judge(f, BASE)
  industryChecked++
  if (ELIGIBLE_INDUSTRIES.includes(ind)) {
    check(r.overall === 'good', '대상 업종(제조·정보통신·음식점) 깨끗한 입력 → good', r.overall, f)
  } else {
    check(r.overall !== 'good' && r.frameworks[0].verdict !== 'good', '목록 밖·모르는 업종 good 금지', `${r.overall}/${r.frameworks[0].verdict}`, f)
  }
}

// ---------------------------------------------------------------------------
// (E) 핵심 회귀 케이스 — 명시적 기대값
// ---------------------------------------------------------------------------
interface Expect {
  name: string
  form: FormData
  base?: Date
  expect: (r: JudgementResult) => [boolean, string]
}
const tax = (r: JudgementResult) => r.frameworks[0].verdict
const item = (r: JudgementResult, k: string) => r.coreItems.find((i) => i.key === k)?.verdict
const hasAlert = (r: JudgementResult, s: string) => r.alerts.some((a) => a.includes(s))

const CASES: Expect[] = [
  {
    name: '청년+제조+비과밀+신규 → 종합 good, 조특법 good',
    form: mkForm({ birthDate: '1995-06-01', industry: 'manufacturing', overconcentration: 'no', startupForm: 'brand_new' }),
    expect: (r) => [r.overall === 'good' && tax(r) === 'good', `overall=${r.overall} tax=${tax(r)}`],
  },
  {
    name: '비청년(55세)+제조+비과밀+신규 → 조특법 여전히 good (청년 게이팅 없음, 50%)',
    form: mkForm({ birthDate: '1971-06-01', industry: 'manufacturing', overconcentration: 'no', startupForm: 'brand_new' }),
    expect: (r) => [tax(r) === 'good', `tax=${tax(r)}`],
  },
  {
    name: '비청년(55세) 신규 → 창업지원법 good (청년 무관)',
    form: mkForm({ birthDate: '1971-06-01', startupForm: 'brand_new' }),
    expect: (r) => [r.frameworks[1].verdict === 'good', `startup=${r.frameworks[1].verdict}`],
  },
  {
    name: '2024개인창업→법인전환(동종) → 창업기업 유지가능(bad 아님), 감면 잔여 3개 과세연도',
    form: mkForm({ startupForm: 'conversion', startupDate: '2026-03-01' }, { originalStartDate: '2024-03-01', prevIndustryRelation: 'same' }),
    expect: (r) => [
      r.frameworks[1].verdict !== 'bad' && r.lineage.hasTaxRemaining === true && r.lineage.within7Years === true && r.lineage.taxRemainingYears === 3 && r.lineage.taxLastYear === 2028,
      `startup=${r.frameworks[1].verdict} remain=${r.lineage.taxRemainingYears} last=${r.lineage.taxLastYear} within7=${r.lineage.within7Years}`,
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
    expect: (r) => [tax(r) === 'bad', `tax=${tax(r)}`],
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
    // (1990-01-01 생 · 2024-01-01 창업은 창업 당시 만 34세 = 경계구간이라 청년 나이를 28세로 둔다)
    name: '깨끗한 신규창업 법인 → 추천도 D (등록면허세 요소 제외 확인)',
    form: mkForm({ businessType: 'corporation', startupForm: 'brand_new', industry: 'manufacturing', overconcentration: 'no', birthDate: '1995-06-01' }),
    expect: (r) => [r.expertReview.grade === 'D', `grade=${r.expertReview.grade} factors=${r.expertReview.factors.join('|')}`],
  },

  // ---- 1. 청년 나이는 창업 당시 (조특법 시행령 §5) ----
  {
    name: '[1] 오늘 36세지만 창업 당시 33세 → 조특법 청년',
    form: mkForm({ birthDate: '1990-03-01', startupDate: '2023-05-01' }),
    expect: (r) => [r.youth.taxLaw === true && r.age === 33 && r.youth.ageNow === 36, `taxLaw=${r.youth.taxLaw} age=${r.age} now=${r.youth.ageNow}`],
  },
  {
    name: '[1] 35번째 생일 하루 전 창업 → 만 34세 청년',
    form: mkForm({ birthDate: '1990-06-02', startupDate: '2025-06-01' }),
    expect: (r) => [r.youth.taxLaw === true && r.age === 34 && r.overall === 'good', `taxLaw=${r.youth.taxLaw} age=${r.age} overall=${r.overall}`],
  },
  {
    name: '[1] 35번째 생일에 창업 → 만 35세, 병역 확인 필요(청년으로 보지 않음)',
    form: mkForm({ birthDate: '1990-06-01', startupDate: '2025-06-01' }),
    expect: (r) => [r.youth.taxLaw === null && r.isYouth === null && r.age === 35 && hasAlert(r, '병역'), `taxLaw=${r.youth.taxLaw} age=${r.age}`],
  },
  {
    name: '[1] 35번째 생일 창업 + 과밀 → 청년으로 보지 않아 good 아님',
    form: mkForm({ birthDate: '1990-06-01', startupDate: '2025-06-01', region: 'gyeonggi_incheon', overconcentration: 'yes' }),
    expect: (r) => [r.overall !== 'good' && tax(r) === 'conditional', `overall=${r.overall} tax=${tax(r)}`],
  },
  {
    name: '[1] 2월 29일생: 평년 2월 28일 창업은 아직 34세 → 청년',
    form: mkForm({ birthDate: '1992-02-29', startupDate: '2027-02-28' }),
    base: new Date(2027, 5, 1),
    expect: (r) => [r.age === 34 && r.youth.taxLaw === true, `age=${r.age} taxLaw=${r.youth.taxLaw}`],
  },
  {
    name: '[1] 2월 29일생: 평년 3월 1일 창업은 35세 → 병역 확인',
    form: mkForm({ birthDate: '1992-02-29', startupDate: '2027-03-01' }),
    base: new Date(2027, 5, 1),
    expect: (r) => [r.age === 35 && r.youth.taxLaw === null, `age=${r.age} taxLaw=${r.youth.taxLaw}`],
  },
  {
    name: '[1] 법인 + 청년 → 최대주주 ★확인',
    form: mkForm({ businessType: 'corporation', birthDate: '1995-06-01' }),
    expect: (r) => [hasAlert(r, '최대주주'), r.alerts.join('|')],
  },
  {
    name: '[1] 개인 + 청년 → 최대주주 안내 없음',
    form: mkForm({ businessType: 'individual', birthDate: '1995-06-01' }),
    expect: (r) => [!hasAlert(r, '최대주주'), r.alerts.join('|')],
  },
  {
    name: '[12] 창업 당시 37세 → 카드·판정 모두 "확인 필요"(미해당이라 쓰지 않음)',
    form: mkForm({ birthDate: '1986-06-01', startupDate: '2024-01-01' }),
    expect: (r) => [r.isYouth === null && r.youth.taxLaw === null && r.reasons.includes('청년 여부 확인 필요 (병역 기간)') && !r.reasons.includes('청년 요건 미해당'), r.reasons.join('|')],
  },

  // ---- 2. 과밀억제권역 + 청년 아님 → 원칙 0% ----
  {
    name: '[2] 비청년 + 과밀 → 조특법·종합 good 아님, 생계형·벤처 ★확인',
    form: mkForm({ birthDate: '1971-06-01', region: 'gyeonggi_incheon', overconcentration: 'yes' }),
    expect: (r) => [r.overall !== 'good' && tax(r) === 'conditional' && item(r, 'incomeTax') === 'conditional' && hasAlert(r, '생계형(연 매출 8천만원 이하)'), `overall=${r.overall} tax=${tax(r)}`],
  },
  {
    name: '[2] 청년 + 과밀 → 주의(50%) — 비청년보다 나쁘지 않음',
    form: mkForm({ birthDate: '1995-06-01', region: 'gyeonggi_incheon', overconcentration: 'yes' }),
    expect: (r) => [item(r, 'incomeTax') === 'caution' && tax(r) === 'caution', `income=${item(r, 'incomeTax')} tax=${tax(r)}`],
  },
  {
    name: '[2] 비청년 + 과밀 모름 → good 아님',
    form: mkForm({ birthDate: '1971-06-01', region: 'gyeonggi_incheon', overconcentration: 'unknown' }),
    expect: (r) => [r.overall !== 'good' && tax(r) !== 'good', `overall=${r.overall} tax=${tax(r)}`],
  },
  {
    name: '[2] 법인전환(잔여기간) + 과밀 + 비청년 → 조건부',
    form: mkForm({ startupForm: 'conversion', birthDate: '1971-06-01', region: 'gyeonggi_incheon', overconcentration: 'yes', startupDate: '2025-03-01' }, { originalStartDate: '2024-03-01' }),
    expect: (r) => [item(r, 'incomeTax') === 'conditional' && r.overall !== 'good', `income=${item(r, 'incomeTax')} overall=${r.overall}`],
  },

  // ---- 3. 신규 창업 5개 과세연도 ----
  {
    name: '[3] 2021년 창업 → 2021~2025 끝, 2026년에는 조특법 불가',
    form: mkForm({ startupDate: '2021-03-01', birthDate: '1995-06-01' }),
    expect: (r) => [tax(r) === 'bad' && r.overall === 'bad' && item(r, 'incomeTax') === 'bad' && hasAlert(r, '끝난 것으로') && r.lineage.hasTaxRemaining === false, `tax=${tax(r)} overall=${r.overall}`],
  },
  {
    name: '[3] 2021-12-31 창업도 2025 과세연도로 끝 → 2026년 불가',
    form: mkForm({ startupDate: '2021-12-31', birthDate: '1995-06-01' }),
    expect: (r) => [tax(r) === 'bad', `tax=${tax(r)}`],
  },
  {
    name: '[3] 2022년 창업 → 2026년이 마지막 과세연도 → 주의',
    form: mkForm({ startupDate: '2022-01-01', birthDate: '1995-06-01' }),
    expect: (r) => [tax(r) === 'caution' && r.overall === 'caution' && hasAlert(r, '마지막 과세연도') && r.lineage.taxRemainingYears === 1, `tax=${tax(r)} remain=${r.lineage.taxRemainingYears}`],
  },
  {
    name: '[3] 2023-12-31 창업 → 기간 남음 → good',
    form: mkForm({ startupDate: '2023-12-31', birthDate: '1995-06-01' }),
    expect: (r) => [r.overall === 'good' && r.lineage.taxRemainingYears === 2, `overall=${r.overall} remain=${r.lineage.taxRemainingYears}`],
  },
  {
    name: '[3] 경계: 2021-01-01 창업을 2025-12-31 에 보면 마지막 과세연도(주의)',
    form: mkForm({ startupDate: '2021-01-01', birthDate: '1995-06-01' }),
    base: new Date(2025, 11, 31, 23, 30),
    expect: (r) => [tax(r) === 'caution', `tax=${tax(r)}`],
  },
  {
    name: '[3] 경계: 2021-01-01 창업을 2026-01-01 에 보면 끝(불가)',
    form: mkForm({ startupDate: '2021-01-01', birthDate: '1995-06-01' }),
    base: new Date(2026, 0, 1, 0, 30),
    expect: (r) => [tax(r) === 'bad', `tax=${tax(r)}`],
  },

  // ---- 4. 머리 판정 ≤ 조특법 ----
  {
    name: '[4] 동종·자산 인수로 조특법이 내려가면 종합도 따라 내려간다',
    form: mkForm({ birthDate: '1995-06-01' }, { prevIndustryRelation: 'same', assetTakeoverRatio: '60' }),
    expect: (r) => [RANK[r.overall] <= RANK[tax(r)] && r.overall !== 'good', `overall=${r.overall} tax=${tax(r)}`],
  },
  {
    name: '[4] 취득세만 골라도 조특법이 불가면 종합 불가',
    form: mkForm({ startupDate: '2020-06-01', birthDate: '1995-06-01', checkItems: { ...NO_CHECK, acquisitionTax: true } }),
    expect: (r) => [r.coreItems.length === 1 && r.overall === 'bad', `overall=${r.overall} items=${r.coreItems.length}`],
  },

  // ---- 5. 지역 ↔ 과밀억제권역 ----
  {
    name: '[5] 서울 + 과밀 "아니오" → 과밀로 보고 good 아님 · 안내',
    form: mkForm({ birthDate: '1971-06-01', region: 'seoul', overconcentration: 'no' }),
    expect: (r) => [r.overall !== 'good' && tax(r) !== 'good' && hasAlert(r, '서울은 전 지역') && item(r, 'acquisitionTax') !== 'good', `overall=${r.overall} tax=${tax(r)}`],
  },
  {
    name: '[5] 서울 + 청년 + 과밀 "아니오" → 청년 과밀(주의)로',
    form: mkForm({ birthDate: '1995-06-01', region: 'seoul', overconcentration: 'no' }),
    expect: (r) => [r.overall === 'caution' || r.overall === 'bad', `overall=${r.overall}`],
  },
  {
    name: '[5] 서울 + 모름 → 과밀로 판정',
    form: mkForm({ birthDate: '1971-06-01', region: 'seoul', overconcentration: 'unknown' }),
    expect: (r) => [r.keyReasons.includes('수도권 과밀억제권역') && r.overall !== 'good', r.keyReasons.join('|')],
  },
  {
    name: '[5] 지방 광역시 + 과밀 "예" → 불일치 주의 · 안내',
    form: mkForm({ birthDate: '1995-06-01', region: 'metro_city', overconcentration: 'yes' }),
    expect: (r) => [r.overall !== 'good' && hasAlert(r, '맞지 않습니다'), `overall=${r.overall}`],
  },
  {
    name: '[5] 기타 지방 + 과밀 "예" → 불일치 주의',
    form: mkForm({ birthDate: '1995-06-01', region: 'other_local', overconcentration: 'yes' }),
    expect: (r) => [r.overall !== 'good' && hasAlert(r, '맞지 않습니다'), `overall=${r.overall}`],
  },
  {
    name: '[5] 경기·인천 + 아니오 → 답 그대로(청년 good) · 주소 ★확인',
    form: mkForm({ birthDate: '1995-06-01', region: 'gyeonggi_incheon', overconcentration: 'no' }),
    expect: (r) => [r.overall === 'good' && hasAlert(r, '경기·인천'), `overall=${r.overall}`],
  },
  {
    name: '[5] 기타 지방 + 아니오 → 안내 없음',
    form: mkForm({ birthDate: '1995-06-01', region: 'other_local', overconcentration: 'no' }),
    expect: (r) => [r.overall === 'good' && !hasAlert(r, '과밀억제권역입니다') && !hasAlert(r, '맞지 않습니다'), r.alerts.join('|')],
  },

  // ---- 6. 업종 (대상 업종 목록) ----
  ...(['manufacturing', 'ict', 'restaurant'] as const).map((ind) => ({
    name: `[6] ${ind} → 대상 업종, good`,
    form: mkForm({ industry: ind, birthDate: '1995-06-01' }),
    expect: (r: JudgementResult): [boolean, string] => [r.overall === 'good' && item(r, 'incomeTax') === 'good', `overall=${r.overall}`],
  })),
  {
    name: '[6] 도소매 → 주의 + 통신판매업만 ★확인',
    form: mkForm({ industry: 'wholesale_retail', birthDate: '1995-06-01' }),
    expect: (r) => [item(r, 'incomeTax') === 'caution' && tax(r) === 'caution' && hasAlert(r, '통신판매업'), `income=${item(r, 'incomeTax')}`],
  },
  {
    name: '[6] 전문서비스 → 주의 + 전문직 제외 ★확인',
    form: mkForm({ industry: 'professional', birthDate: '1995-06-01' }),
    expect: (r) => [item(r, 'incomeTax') === 'caution' && hasAlert(r, '세무사'), `income=${item(r, 'incomeTax')}`],
  },
  {
    name: '[6] 기타 → 주의 + 업종 확인 필요',
    form: mkForm({ industry: 'etc', birthDate: '1995-06-01' }),
    expect: (r) => [item(r, 'incomeTax') === 'caution' && hasAlert(r, '업종 확인 필요'), `income=${item(r, 'incomeTax')}`],
  },
  {
    name: '[6] 업종 빈칸 → 주의 + 업종 확인 필요',
    form: mkForm({ industry: '', birthDate: '1995-06-01' }),
    expect: (r) => [r.overall === 'caution' && hasAlert(r, '업종 확인 필요'), `overall=${r.overall}`],
  },
  {
    name: '[6] 모르는 업종 값(construction) → 죽지 않고 good 아님',
    form: mkForm({ industry: 'construction' as FormData['industry'], birthDate: '1995-06-01' }),
    expect: (r) => [r.overall === 'caution' && hasAlert(r, '업종 확인 필요') && r.frameworks[0].checkPoints.some((c) => c.includes('업종 확인 필요')), `overall=${r.overall}`],
  },
  {
    name: '[6] 금융·보험 → 불가 + 핀테크 예외 ★확인',
    form: mkForm({ industry: 'finance_insurance', birthDate: '1995-06-01' }),
    expect: (r) => [tax(r) === 'bad' && r.overall === 'bad' && hasAlert(r, '정보통신을 활용한 금융서비스'), `tax=${tax(r)}`],
  },
  {
    name: '[6] 부동산 → 지방세도 불가',
    form: mkForm({ industry: 'real_estate', birthDate: '1995-06-01' }),
    expect: (r) => [item(r, 'acquisitionTax') === 'bad' && item(r, 'propertyTax') === 'bad' && r.savingsLevel.level === 'D', `acq=${item(r, 'acquisitionTax')}`],
  },

  // ---- 8. 폐업 후 동종 재개업 ----
  {
    name: '[8] 동종 재개업 → 조특법 불가, 창업지원법은 3년 규칙(불가로 단정 안 함)',
    form: mkForm({ startupForm: 'reopen_same', birthDate: '1995-06-01' }),
    expect: (r) => [
      tax(r) === 'bad' && item(r, 'incomeTax') === 'bad' && r.overall === 'bad' && r.frameworks[1].verdict !== 'bad' && r.frameworks[1].risks.some((x) => x.includes('3년')),
      `tax=${tax(r)} startup=${r.frameworks[1].verdict}`,
    ],
  },

  // ---- 9. 과세연도 · '약 0년' ----
  {
    name: '[9] 옛 365.25일 계산의 "약 0년 남음" 사례 → 과세연도로 끝(불가)',
    form: mkForm({ startupForm: 'conversion', startupDate: '2025-01-01' }, { originalStartDate: '2021-07-01' }),
    expect: (r) => [
      r.lineage.hasTaxRemaining === false && r.lineage.taxRemainingYears === 0 && tax(r) === 'bad' && !r.frameworks[0].risks.some((x) => x.includes('약 0년')),
      `remain=${r.lineage.taxRemainingYears} tax=${tax(r)} risks=${r.frameworks[0].risks.join('|')}`,
    ],
  },
  {
    name: '[9] 법인전환 · 기존 2022 개시 → 올해가 마지막 과세연도(주의, 1개 남음)',
    form: mkForm({ startupForm: 'conversion', startupDate: '2025-01-01' }, { originalStartDate: '2022-03-01' }),
    expect: (r) => [r.lineage.taxRemainingYears === 1 && tax(r) !== 'good' && formatTaxRemaining(r.lineage).includes('마지막'), `remain=${r.lineage.taxRemainingYears}`],
  },
  {
    name: '[9] 업력 7년 경계: 7번째 창업기념일 당일은 이내',
    form: mkForm({ startupDate: '2019-06-24' }),
    expect: (r) => [r.lineage.within7Years === true, `age=${r.lineage.businessAgeYears}`],
  },
  {
    name: '[9] 업력 7년 경계: 기념일 다음 날(하루 더 된 창업)은 초과',
    form: mkForm({ startupDate: '2019-06-23' }),
    expect: (r) => [r.lineage.within7Years === false, `age=${r.lineage.businessAgeYears}`],
  },

  // ---- 10. 예시 날짜 · 빈 날짜 · 잘못된 날짜 · 예비창업 ----
  {
    name: '[10] 예시 날짜 그대로(1980-01-01 · 2020-01-01) → 입력해야 판정 · good 아님',
    form: withoutPlaceholders(mkForm({ birthDate: PLACEHOLDER_BIRTH, startupDate: PLACEHOLDER_STARTUP })),
    expect: (r) => [r.notice === NOTICE_MISSING_DATES && r.oneLineConclusion === NOTICE_MISSING_DATES && r.overall !== 'good' && r.savingsLevel.level !== 'A', `overall=${r.overall} notice=${r.notice}`],
  },
  {
    name: '[10] 생년월일만 예시 → 입력해야 판정',
    form: withoutPlaceholders(mkForm({ birthDate: PLACEHOLDER_BIRTH, startupDate: '2024-01-01' })),
    expect: (r) => [r.notice === NOTICE_MISSING_DATES && r.overall !== 'good', `overall=${r.overall}`],
  },
  {
    name: '[10] 빈 폼 → 죽지 않고 입력해야 판정 · good 아님',
    form: { ...EMPTY_FORM, checkItems: { ...NO_CHECK }, advanced: { ...EMPTY_ADV } },
    expect: (r) => [r.notice === NOTICE_MISSING_DATES && r.overall !== 'good', `overall=${r.overall}`],
  },
  {
    name: '[10] 날짜 비움 + 나머지 좋은 조건 → good 아님(A 아님)',
    form: mkForm({ birthDate: '', startupDate: '' }),
    expect: (r) => [r.overall === 'conditional' && r.savingsLevel.level !== 'A', `overall=${r.overall} level=${r.savingsLevel.level}`],
  },
  {
    name: '[10] 없는 날짜(2023-02-30) → 입력해야 판정',
    form: mkForm({ startupDate: '2023-02-30', birthDate: '1995-06-01' }),
    expect: (r) => [r.notice === NOTICE_MISSING_DATES && r.overall !== 'good', `overall=${r.overall}`],
  },
  {
    name: '[10] 생년월일이 창업일보다 늦음 → 날짜 확인 안내',
    form: mkForm({ startupDate: '2024-01-01', birthDate: '2025-01-01' }),
    expect: (r) => [r.notice === NOTICE_DATE_ORDER && r.overall !== 'good', `notice=${r.notice}`],
  },
  {
    name: '[10] 창업일이 아직 안 옴 → 예비창업 — 창업 후 판정',
    form: mkForm({ startupDate: '2026-08-01', birthDate: '1995-06-01' }),
    expect: (r) => [r.notice === NOTICE_PRE_STARTUP && r.oneLineConclusion.includes('예비창업 — 창업 후 판정') && r.overall !== 'good', `overall=${r.overall}`],
  },
  {
    name: '[10] 창업일 = 오늘 → 예비창업 아님',
    form: mkForm({ startupDate: '2026-06-24', birthDate: '1995-06-01' }),
    expect: (r) => [r.notice === null, `notice=${r.notice}`],
  },

  // ---- 11. 지방세 · 과밀 ----
  {
    name: '[11] 과밀 → 취득세·재산세 불가 + 지특법 ★확인',
    form: mkForm({ birthDate: '1995-06-01', region: 'gyeonggi_incheon', overconcentration: 'yes' }),
    expect: (r) => [item(r, 'acquisitionTax') === 'bad' && item(r, 'propertyTax') === 'bad' && r.frameworks[2].verdict === 'bad' && hasAlert(r, '지특법'), `acq=${item(r, 'acquisitionTax')} prop=${item(r, 'propertyTax')}`],
  },
  {
    name: '[11] 과밀 모름 → 재산세 조건부(good 아님)',
    form: mkForm({ birthDate: '1995-06-01', region: 'gyeonggi_incheon', overconcentration: 'unknown' }),
    expect: (r) => [item(r, 'propertyTax') === 'conditional', `prop=${item(r, 'propertyTax')}`],
  },

  // ---- 13. 2026년 이후 창업 ----
  {
    name: '[13] 2026-01-01 창업 → 개정 규정 ★확인 · 종합 주의 상한',
    form: mkForm({ startupDate: '2026-01-01', birthDate: '1995-06-01' }),
    expect: (r) => [r.overall === 'caution' && tax(r) === 'caution' && r.alerts.includes(REVISED_RULE_ALERT) && r.frameworks[0].risks.includes(REVISED_RULE_ALERT), `overall=${r.overall}`],
  },
  {
    name: '[13] 2025-12-31 창업 → 개정 안내 없음 · good',
    form: mkForm({ startupDate: '2025-12-31', birthDate: '1995-06-01' }),
    expect: (r) => [r.overall === 'good' && !r.alerts.includes(REVISED_RULE_ALERT), `overall=${r.overall}`],
  },

  // ---- 절세 A 는 종합 good 일 때만 ----
  {
    name: '절세 A: 깨끗한 청년·비과밀·제조 → A',
    form: mkForm({ birthDate: '1995-06-01' }),
    expect: (r) => [r.savingsLevel.level === 'A' && r.overall === 'good', `level=${r.savingsLevel.level}`],
  },
  {
    name: '절세 A 금지: 2026 창업(종합 주의)',
    form: mkForm({ birthDate: '1995-06-01', startupDate: '2026-02-01' }),
    expect: (r) => [r.savingsLevel.level !== 'A', `level=${r.savingsLevel.level}`],
  },
  {
    name: '요약문: ★ 세무사 확인 필요 건수가 들어간다',
    form: mkForm({ industry: 'wholesale_retail', birthDate: '1995-06-01' }),
    expect: (r) => [buildSummaryText(r).includes(`★ 세무사 확인 필요 ${r.alerts.length}건`), buildSummaryText(r)],
  },
]

const caseFails: string[] = []
for (const c of CASES) {
  checks++
  try {
    const r = judge(c.form, c.base ?? BASE)
    const [ok, detail] = c.expect(r)
    if (!ok) caseFails.push(`${c.name} → ${detail}`)
    // 회귀 케이스도 구조 불변식은 지킨다 (기준일이 다른 사례는 잔여 계산식 검사를 건너뛴다)
    if (!c.base) checkStructure(c.form, r)
  } catch (e) {
    caseFails.push(`${c.name} → 예외: ${e}`)
  }
}

// ---------------------------------------------------------------------------
// (F) 날짜 유틸 — 시간대와 무관 (TZ=UTC · TZ=Asia/Seoul 둘 다)
// ---------------------------------------------------------------------------
function unit(cond: boolean, name: string, detail = '') {
  checks++
  if (!cond) caseFails.push(`${name} → ${detail}`)
}
{
  const d = parseLocalDate('2024-01-01')
  unit(d !== null && d.getFullYear() === 2024 && d.getMonth() === 0 && d.getDate() === 1, '[12] 날짜는 로컬 달력으로 읽는다', String(d))
  for (const s of ['2024-01-01', '2024-02-29', '1992-02-29', '2026-12-31', '2000-06-15']) {
    const p = parseLocalDate(s)
    unit(p !== null && formatDate(p) === s, `[12] 읽고 다시 쓰면 같은 날짜 ${s}`, String(p))
  }
  for (const bad of ['', '2023-02-29', '2024-13-01', '2024-00-10', '2024-1-1', 'abc', '2024-04-31']) {
    unit(parseLocalDate(bad) === null, `[12] 잘못된 날짜는 null (${bad || '빈칸'})`)
  }
  unit(calcAge('1992-02-29', new Date(2027, 1, 28)) === 34, '[1] 2/29생 평년 2/28 = 34')
  unit(calcAge('1992-02-29', new Date(2027, 2, 1)) === 35, '[1] 2/29생 평년 3/1 = 35')
  unit(calcAge('1992-02-29', new Date(2028, 1, 29)) === 36, '[1] 2/29생 윤년 2/29 = 36')
  unit(calcAge('1990-06-02', new Date(2025, 5, 1)) === 34, '[1] 35번째 생일 하루 전 = 34')
  unit(calcAge('1980-01-01', new Date(2026, 0, 1, 0, 5)) === 46, '[12] 자정 직후도 그날 나이', String(calcAge('1980-01-01', new Date(2026, 0, 1, 0, 5))))
  unit(calcAge('2024-02-30', BASE) === null, '[12] 없는 생일은 나이 없음')
  const y7 = calendarYearsBetween('2019-06-24', BASE)
  unit(y7 === 7, '[9] 7번째 기념일 = 정확히 7년', String(y7))
  unit(calendarYearsBetween('2026-06-25', BASE) === null, '[9] 앞으로의 날짜는 업력 없음')
  unit(formatAge(0.999) === '0년 11개월', '[9] 업력 표시는 12개월이 되지 않는다', formatAge(0.999))
  const lastText = formatTaxRemaining({ taxLastYear: 2026, taxRemainingYears: 1 })
  unit(!/(^|\D)0(개|년)/.test(lastText) && lastText.includes('마지막'), '[9] 마지막 과세연도 글에 "0개·0년" 없음', lastText)
  unit(formatTaxRemaining({ taxLastYear: 2025, taxRemainingYears: 0 }).includes('끝남'), '[9] 끝난 과세연도 글')
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
console.log(`청년 단조성     : ${youthMonoChecked} 건`)
console.log(`업종 목록       : ${industryChecked} 건`)
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
