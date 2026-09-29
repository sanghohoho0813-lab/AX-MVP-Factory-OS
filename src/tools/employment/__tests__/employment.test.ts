/**
 * 고용지원금 도구 — 특성화(characterization) 시험.
 *
 * 원본(고용지원금 매니저 Pro)의 표·계산식이 옮기는 동안 한 글자도 안 바뀌었는지 못 박는다.
 * 실행: npm run test:employment
 */
import { makeSimpleXlsx } from '../../../services/__tests__/xlsxFixture'
import { BOSU_FLOOR_2026, DIAG_CATS, ELIG, EXCL, MIN_WAGE_2026, MIN_WAGE_MONTH_2026, STS } from '../lib/constants'
import { COMPANY_DEFAULT_DOCS, DEFAULT_PROGRAMS, PROGRAM_CHECKLISTS, PROGRAM_ENABLED_DEFAULTS, PROGRAM_LIST, roundsMismatch, roundsSum, type Program } from '../lib/programs'
import { addMo, calcAgeDetailed, calcMilitaryLimit, fD, formatDday, getDdayFrom, parseJumin, toYMD, youthAgeAt, youthByYears } from '../lib/dates'
import { fMan, fProgramAmt, fmtBizNo, fmtPhone, clampMoney, clampRate } from '../lib/format'
import { buildAnswers, checkWage, diagnoseHiring, youthGate, type HiringAnswers } from '../lib/eligibility'
import { basicIncomeTax, computePayroll, RATE_LABELS, RATES_2026 } from '../lib/payroll'
import { buildRounds, roundDate, roundSchedule, sumReceived, sumRemaining } from '../lib/schedule'
import {
  EMP_STAGES,
  boardColumns,
  empNextDate,
  empNextDday,
  empReceived,
  empRemaining,
  empUrgency,
  normalizeStage,
  rollupByClient,
  summarizeEmployees,
  toEmpRecord,
  type EmpRecord,
} from '../lib/empRecords'
import { companyMetaOf, employeeRowData, matchOsClient, memosFromRow, osCompanyDefaults, osPickList, programsFromD91, regionOfAddress, toOrigCompany, toOrigEmployee } from '../orig/store'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { simulate, simulationText } from '../lib/simulator'
import { HIRE_WINDOWS, enrollBadgeText, enrollWindowOf, fullMonthsSince, hireWindowBlocks, hireWindowOf, notEnrolledYet } from '../lib/hireWindow'
import { notYetRegistered, youthEmployeeRecord, youthEnrollDeadlines, youthEnrollItems } from '../lib/rosterEnroll'
import { agencyAutoComment, agencyDocRequestText, agencyReportData, agencySummaryText, commissionSummary, companyRanking, companyRiskRanking, ddayAlerts, emptyCompanyMeta, monthlyReceived, pendingPayments, programPipeline } from '../lib/companyMeta'
import { buildImportPreview, parseBulkPaste, parseMoneyCell, xlAutoMap, xlBizNoCheck, xlDetectHeader, xlNormDate } from '../lib/excelImport'
import { birthFromCell, looksLikeRrn, safeBizNo } from '../lib/privacy'
import {
  analyzeRoster,
  buildCopyText,
  classifyEmployee,
  CONFIDENCE_META,
  defaultTaxUnits,
  deriveFromRRN,
  EMP_DOC_CHECKLIST,
  estimateSubsidyTotal,
  estimateTaxCredit,
  LEVELS,
  maskRRN,
  parseRosterFile,
  parseRosterText,
  ROSTER_FIELDS,
  rosterStaleness,
  SUBSIDY_DEFS,
  SUBSIDY_ESTIMATE_NOTE,
  SUBSIDY_MAX_PER_PERSON,
  TAX_CHECKLIST,
  textToGrid,
  detectRoster,
  extractEmployees,
  idCellKind,
  normDate,
  type RosterEmployee,
} from '../lib/payrollDiagnosis'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string) {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// ── 상수 ────────────────────────────────────────────────
check('최저임금 2026', MIN_WAGE_2026 === 10320 && MIN_WAGE_MONTH_2026 === 2156880 && BOSU_FLOOR_2026 === 1240000)
check('ELIG 10 · EXCL 5', ELIG.length === 10 && EXCL.length === 5)
check('ELIG 첫·끝', ELIG[0].id === 'e1' && ELIG[0].label === '실업 4개월 이상' && ELIG[9].id === 'e10' && ELIG[9].label === '기타 장관 인정')
check('EXCL x3', EXCL[2].label === '외국인이 아닐 것' && EXCL[2].desc === '외국인 제외(F-2,F-5,F-6 예외)')
check('STS 7단계 순서', STS.map((s) => s.key).join(',') === 'preparing,submitted,reviewing,approved,inprogress,completed,resigned')
check('DIAG_CATS 6', DIAG_CATS.length === 6 && DIAG_CATS[4].label === '취업취약계층(프로그램 이수)')

// ── 규칙표 ──────────────────────────────────────────────
const EXPECTED_PROGRAMS: [string, number][] = [
  ['youth_jump', 7200000],
  ['work_exp', 1400000],
  ['saeil_women', 4000000],
  ['emp_promo', 7200000],
  ['senior_intern', 5500000],
  ['disabled_emp', 5400000],
  ['regular_convert', 7200000],
  ['senior_continue', 7200000],
  ['worklife45', 7200000],
  ['parental_leave', 3600000],
  ['parental_reduce', 3600000],
  ['replace_worker', 21000000],
  ['work_share', 600000],
  ['emp_retention', 6000000],
  ['job_sharing', 7200000],
]
check('DEFAULT_PROGRAMS 15개', Object.keys(DEFAULT_PROGRAMS).length === 15 && PROGRAM_LIST.length === 15, String(Object.keys(DEFAULT_PROGRAMS).length))
check(
  'DEFAULT_PROGRAMS id·순서·totalAmount',
  EXPECTED_PROGRAMS.every(([id, amt], i) => PROGRAM_LIST[i]?.id === id && PROGRAM_LIST[i]?.totalAmount === amt),
  PROGRAM_LIST.map((p) => `${p.id}:${p.totalAmount}`).join(' '),
)
check('youth_jump 회차 합 = totalAmount', DEFAULT_PROGRAMS.youth_jump.rounds.reduce((s, r) => s + r.amount, 0) === 7200000)
check('youth_jump 회차 라벨', DEFAULT_PROGRAMS.youth_jump.rounds.map((r) => r.label).join('|') === '1차(6개월)|2차(9개월)|3차(12개월)')
check('youth_jump match', (() => {
  const m = DEFAULT_PROGRAMS.youth_jump.match
  return m.cats[0] === '청년' && m.ageMin === 15 && m.ageMax === 34 && m.milExtend === true && m.preApply === true && m.regionSensitive === true && m.bosuFloor === true
})())
check('regular_convert companyMax 30', DEFAULT_PROGRAMS.regular_convert.match.companyMax === 30 && DEFAULT_PROGRAMS.regular_convert.match.empTypes.join() === '계약직')
check('worklife45 companyMin 20', DEFAULT_PROGRAMS.worklife45.match.companyMin === 20)
check('senior_continue ageMin 55 · companyMax 100', DEFAULT_PROGRAMS.senior_continue.match.ageMin === 55 && DEFAULT_PROGRAMS.senior_continue.match.companyMax === 100)
check('saeil_women gender female · special 경력단절', DEFAULT_PROGRAMS.saeil_women.match.gender === 'female' && DEFAULT_PROGRAMS.saeil_women.match.special?.[0] === '경력단절')
check('senior_intern 5회차 · 마지막 36개월', DEFAULT_PROGRAMS.senior_intern.rounds.length === 5 && DEFAULT_PROGRAMS.senior_intern.rounds[4].month === 36)
check('youth_jump note 원문', DEFAULT_PROGRAMS.youth_jump.note.startsWith('수도권: 기업 720만(취업애로요건 필수). 비수도권: 기업 720만+청년 근속인센티브 480~720만.'))
check('PROGRAM_CHECKLISTS 15개 · youth_jump 6항목', Object.keys(PROGRAM_CHECKLISTS).length === 15 && PROGRAM_CHECKLISTS.youth_jump.length === 6 && PROGRAM_CHECKLISTS.replace_worker.length === 8)
check('PROGRAM_ENABLED_DEFAULTS', Object.keys(PROGRAM_ENABLED_DEFAULTS).join() === 'youth_jump' && PROGRAM_ENABLED_DEFAULTS.youth_jump === true)
check('COMPANY_DEFAULT_DOCS 5묶음', COMPANY_DEFAULT_DOCS.length === 5 && COMPANY_DEFAULT_DOCS[1].docs.length === 3)

// ── 날짜 ────────────────────────────────────────────────
check('addMo 6개월', addMo('2026-01-15', 6) === '2026-07-15', addMo('2026-01-15', 6))
check('addMo 12개월', addMo('2026-01-15', 12) === '2027-01-15', addMo('2026-01-15', 12))
check('addMo 빈값', addMo('', 6) === '')
check('getDday 5일 전', getDdayFrom('2026-07-15', new Date('2026-07-10T00:00:00')) === 5)
check('getDday 당일', getDdayFrom('2026-07-15', new Date('2026-07-15T12:00:00')) === 0)
check('getDday 지남', getDdayFrom('2026-07-15', new Date('2026-07-18T00:00:00')) === -3)
check('getDday null', getDdayFrom('', new Date()) === null)
check('formatDday', formatDday(5) === 'D-5' && formatDday(0) === 'D-Day' && formatDday(-3) === 'D+3' && formatDday(null) === '')
check('calcAgeDetailed', (() => {
  const d = calcAgeDetailed('1991-01-15', '2026-06-01')
  return !!d && d.years === 35 && d.months === 4 && d.totalMonths === 424
})())
// D-136: 상한은 '만 34세 11개월(35번째 생일 전날)' + 복무 개월 · 최대 만 39세 11개월
check('calcMilitaryLimit 18개월', (() => {
  const m = calcMilitaryLimit(18)
  return m.maxTotalMonths === 34 * 12 + 11 + 18 && m.extMonths === 18 && m.maxYears === 35 && m.maxRemainMonths === 6 && m.isBorderline === true
})(), JSON.stringify(calcMilitaryLimit(18)))
check('calcMilitaryLimit 상한 만 39세 11개월', calcMilitaryLimit(100).maxTotalMonths === 39 * 12 + 11 && calcMilitaryLimit(100).extMonths === 72 && calcMilitaryLimit(100).maxYears === 39, JSON.stringify(calcMilitaryLimit(100)))
check('calcMilitaryLimit 0', calcMilitaryLimit(0).maxTotalMonths === 34 * 12 + 11 && calcMilitaryLimit(0).isBorderline === false)
check('parseJumin 9501011', (() => {
  const p = parseJumin('9501011')
  return !!p && p.birthDate === '1995-01-01' && p.gender === 'male' && p.year === 1995
})())
check('parseJumin 0203154 → 2002 여', (() => {
  const p = parseJumin('020315-4')
  return !!p && p.birthDate === '2002-03-15' && p.gender === 'female'
})())

// ── 표시 ────────────────────────────────────────────────
check('fMan', fMan(7200000) === '720만 원' && fMan(9500) === '9,500원')
check('fProgramAmt 월형', fProgramAmt(DEFAULT_PROGRAMS.replace_worker) === '월 최대 140만 원')
check('fProgramAmt 총액형', fProgramAmt(DEFAULT_PROGRAMS.youth_jump) === '1인당 최대 720만 원')
check('fmtBizNo', fmtBizNo('1234567890') === '123-45-67890')
check('fmtPhone 휴대폰', fmtPhone('01012345678') === '010-1234-5678')
check('fmtPhone 서울', fmtPhone('0212345678') === '02-1234-5678')
check('clampMoney', clampMoney(-5) === 0 && clampMoney(1e11) === 1e10 && clampMoney('abc') === 0)
check('clampRate', clampRate(150) === 100 && clampRate(33) === 33)

// ── checkWage ───────────────────────────────────────────
check('checkWage 40h', (() => {
  const w = checkWage(3000000, 40)
  return !!w && w.monthlyHours === 209 && w.hourlyWage === 14354 && w.minMonthly === 2156880 && w.isAboveMin && w.isAboveFloor && w.gap === 14354 - 10320
})())
check('checkWage 20h', (() => {
  const w = checkWage(1500000, 20)
  return !!w && w.monthlyHours === 104 && w.hourlyWage === 14423 && w.minMonthly === 1073280 && w.isAboveMin
})())
check('checkWage 0', checkWage(0, 40) === null)

// ── computePayroll ──────────────────────────────────────
// D-136: 2026 요율 (국민연금 4.75% · 상한 637만 · 하한 40만 · 건강 3.595% · 장기요양 13.14% · 고용안정 0.25%)
check('computePayroll 2026 요율 한 묶음', RATES_2026.pensionEach === 0.0475 && RATES_2026.pensionBaseCap === 6370000 && RATES_2026.pensionBaseFloor === 400000 && RATES_2026.healthEach === 0.03595 && RATES_2026.careOfHealth === 0.1314 && RATES_2026.employEach === 0.009 && RATES_2026.employStabilityEr === 0.0025 && RATES_2026.injuryEr === 0.0143)
check('computePayroll 표시 글자도 같은 숫자', RATE_LABELS.pension === '4.75%' && RATE_LABELS.health === '3.595%' && RATE_LABELS.care === '건보×13.14%' && RATE_LABELS.injury.includes('★확인') && RATE_LABELS.note.includes('★') && RATE_LABELS.incomeTax.includes('근사치'), JSON.stringify(RATE_LABELS))
check('computePayroll 300만/40h/부양1', (() => {
  const r = computePayroll(3000000, 40, 1)
  if (!r) return false
  const monthly = 3000000
  const pension = Math.round(3000000 * 0.0475)
  const health = Math.round(monthly * 0.03595)
  const care = Math.round(health * 0.1314)
  const employ = Math.round(monthly * 0.009)
  const stab = Math.round(monthly * 0.0025)
  const injury = Math.round(monthly * 0.0143)
  // 간이세액표 산식 근사: 근로소득공제 · 인적 150만 · 연금보험료 · 특별소득공제 표준(1명) · 근로소득세액공제(한도)
  const annual = monthly * 12
  const emDed = 7500000 + (annual - 15000000) * 0.15
  const special = 3100000 + annual * 0.04 - (annual - 30000000) * 0.05
  const taxBase = annual - emDed - 1500000 - pension * 12 - special
  const annTax = 840000 + (taxBase - 14000000) * 0.15
  const credit = Math.min(715000 + (annTax - 1300000) * 0.3, 740000 - (annual - 33000000) * 0.008)
  const incomeTax = Math.round((annTax - credit) / 12)
  return (
    r.pension_ee === pension &&
    r.pension_ee === 142500 &&
    r.health_ee === health &&
    r.health_ee === 107850 &&
    r.care_ee === care &&
    r.employ_ee === employ &&
    r.total4_ee === pension + health + care + employ &&
    r.pension_er === pension &&
    r.employStab_er === stab &&
    r.employStab_er === 7500 &&
    r.injury_er === injury &&
    r.total4_er === pension + health + care + employ + stab + injury &&
    r.incomeTax === incomeTax &&
    r.localTax === Math.round(incomeTax * 0.1) &&
    r.netPay === monthly - r.total4_ee - r.incomeTax - r.localTax &&
    r.totalEmployerCost === monthly + r.total4_er &&
    r.hourlyWage === 14354 &&
    r.isAboveMin
  )
})(), JSON.stringify(computePayroll(3000000, 40, 1)))
check('computePayroll 소득세: 예전 식(연금·특별공제 빠짐)보다 낮다 · 0 보다 크다', (() => {
  const r = computePayroll(3000000, 40, 1)
  return !!r && r.incomeTax > 0 && r.incomeTax < 131458
})(), String(computePayroll(3000000, 40, 1)?.incomeTax))
check('computePayroll 연금 상한 637만', (() => {
  const r = computePayroll(8000000, 40, 1)
  return !!r && r.pension_ee === Math.round(6370000 * 0.0475)
})())
check('computePayroll 연금 하한 40만', (() => {
  const r = computePayroll(300000, 15, 1)
  return !!r && r.pension_ee === Math.round(400000 * 0.0475)
})())
check('computePayroll 저소득 → 소득세 0', (() => {
  const r = computePayroll(400000, 40, 1)
  return !!r && r.incomeTax === 0 && r.localTax === 0
})())
check('computePayroll 음수 급여 → 0 으로 보고 계산 안 함', computePayroll(-3000000, 40, 1) === null)
check('computePayroll 고소득 세율 구간(3억 초과 40%)', basicIncomeTax(400000000) === 94060000 + 100000000 * 0.4 && basicIncomeTax(150000000) === 37060000)
check('computePayroll 0 → null', computePayroll(0, 40, 1) === null)

// ── diagnoseHiring ──────────────────────────────────────
const BASE_ANSWERS: HiringAnswers = {
  situation: 'new',
  cats: ['청년'],
  specials: [],
  age: 29,
  gender: 'male',
  milMonths: 0,
  region: '비수도권',
  companySize: 10,
  empType: '정규직',
  preApply: true,
  noLayoff: true,
  aboveFloor: true,
  youthEligible: true,
}
function rowOf(rows: ReturnType<typeof diagnoseHiring>, id: string) {
  return rows.find((r) => r.program.id === id)
}

{
  const rows = diagnoseHiring(BASE_ANSWERS, PROGRAM_LIST)
  const yj = rowOf(rows, 'youth_jump')
  check('청년 정규직 비수도권 → youth_jump recommend', !!yj && yj.status === 'recommend' && yj.score === 75, JSON.stringify(yj && { s: yj.status, sc: yj.score, r: yj.reasons }))
  check('  reasons 원문', !!yj && yj.reasons.join('|') === '대상 유형 일치|나이 요건 충족|비수도권: 기업+청년 합산 가능')
  check('  정렬: recommend 가 맨 앞', rows[0].status === 'recommend' && rows[0].program.id === 'youth_jump')
  check('  work_exp 는 인턴 요건으로 maybe', rowOf(rows, 'work_exp')?.status === 'maybe' && rowOf(rows, 'work_exp')?.blockers.join() === '채용형태(인턴) 요건')
  check('  육아 제도는 exclude', rowOf(rows, 'parental_leave')?.status === 'exclude')
}
{
  const rows = diagnoseHiring({ ...BASE_ANSWERS, region: '수도권', youthEligible: false }, PROGRAM_LIST)
  const yj = rowOf(rows, 'youth_jump')
  check('수도권 청년 취업애로 미해당 → blocker', !!yj && yj.status === 'maybe' && yj.blockers.indexOf('수도권은 취업애로요건 필수') >= 0 && yj.score === 63)
}
{
  const rows = diagnoseHiring({ ...BASE_ANSWERS, cats: ['고령자'], age: 62 }, PROGRAM_LIST)
  check('60세 → senior_intern recommend', rowOf(rows, 'senior_intern')?.status === 'recommend' && rowOf(rows, 'senior_intern')?.score === 63)
  check('60세 → senior_continue recommend', rowOf(rows, 'senior_continue')?.status === 'recommend')
  check('60세 → youth_jump 나이 미충족 exclude', rowOf(rows, 'youth_jump')?.status === 'exclude' && rowOf(rows, 'youth_jump')?.blockers.indexOf('나이 요건 미충족') >= 0)
}
{
  const answers = buildAnswers({ situation: 'new', cats: ['여성'], specials: [], age: '40', gender: 'female', milMonths: '', region: '수도권', companySize: '10', empType: '인턴', preApply: true, noLayoff: true, aboveFloor: true, youthEligible: true })
  check('buildAnswers 여성 → 경력단절 special', answers.specials.indexOf('경력단절') >= 0 && answers.age === 40 && answers.companySize === 10)
  const rows = diagnoseHiring(answers, PROGRAM_LIST)
  const sw = rowOf(rows, 'saeil_women')
  check('여성 인턴 → saeil_women recommend', !!sw && sw.status === 'recommend' && sw.score === 83, JSON.stringify(sw && { s: sw.status, sc: sw.score }))
}
{
  const answers = buildAnswers({ situation: 'retain', cats: [], specials: ['정규직전환'], age: '', gender: '', milMonths: '', region: '수도권', companySize: '40', empType: '계약직', preApply: true, noLayoff: true, aboveFloor: true, youthEligible: true })
  check('buildAnswers retain → 재직 cat', answers.cats.indexOf('재직') >= 0)
  const rows = diagnoseHiring(answers, PROGRAM_LIST)
  const rc = rowOf(rows, 'regular_convert')
  check('40인 정규직 전환 → companyMax 30 blocker', !!rc && rc.status === 'maybe' && rc.blockers.indexOf('30인 미만 대상') >= 0 && rc.score === 83)
}
{
  const deprecated: Program = { ...DEFAULT_PROGRAMS.youth_jump, id: 'old_prog', match: { ...DEFAULT_PROGRAMS.youth_jump.match, deprecated: true } }
  const rows = diagnoseHiring(BASE_ANSWERS, [deprecated, DEFAULT_PROGRAMS.youth_jump])
  const d = rowOf(rows, 'old_prog')
  check('deprecated → exclude · 2026년 신규 종료', !!d && d.status === 'exclude' && d.score === 0 && d.reasons.join() === '2026년 신규 종료')
  check('  deprecated 는 뒤로 정렬', rows[1].program.id === 'old_prog')
}
{
  const rows = diagnoseHiring({ ...BASE_ANSWERS, age: 36, milMonths: 24 }, PROGRAM_LIST)
  check('군복무 24개월 → 36세도 나이 충족', rowOf(rows, 'youth_jump')?.blockers.length === 0 && rowOf(rows, 'youth_jump')?.status === 'recommend')
  const rows2 = diagnoseHiring({ ...BASE_ANSWERS, age: 36, milMonths: 0 }, PROGRAM_LIST)
  check('군복무 0 → 36세 나이 미충족', rowOf(rows2, 'youth_jump')?.blockers.indexOf('나이 요건 미충족') >= 0)
  const rows3 = diagnoseHiring({ ...BASE_ANSWERS, noLayoff: false }, PROGRAM_LIST)
  check('감원 이력 → 전 제도 blocker', rows3.every((r) => r.blockers.indexOf('최근 감원 이력—신청 제한') >= 0))
  const rows4 = diagnoseHiring({ ...BASE_ANSWERS, preApply: false }, PROGRAM_LIST)
  check('youth_jump 사전신청 안 함 → ★ 입사 3개월 안 확인 · 가능성 높음 아님(D-137)', (rowOf(rows4, 'youth_jump')?.cautions.join() ?? '').includes('입사 후 3개월 안에 참여신청') && rowOf(rows4, 'youth_jump')?.blockers.length === 0 && rowOf(rows4, 'youth_jump')?.status === 'maybe')
  check('work_exp 사전신청 안 함 → blocker', rowOf(rows4, 'work_exp')?.blockers.indexOf('사전신청 필수') >= 0)
}

// ── youthGate ───────────────────────────────────────────
const ALL_ELIG_NONE: Record<string, boolean> = {}
const ALL_EXCL_OK: Record<string, boolean> = { x1: true, x2: true, x3: true, x4: true, x5: true }
{
  const g = youthGate({ birthDate: '1991-01-15', gender: 'male', milMonths: 18, elig: { e3: true }, excl: ALL_EXCL_OK, hireDate: '2026-06-01', today: '2026-06-01' })
  check('youthGate 경계선 (35세4개월 · 군 18개월)', g.age === 35 && g.ageOk && g.nearBorder && g.ok && g.maxLabel === '만34세(+복무 18개월 · 최대 39세)', JSON.stringify(g))
  const g2 = youthGate({ birthDate: '1991-01-15', gender: 'male', milMonths: 0, elig: { e3: true }, excl: ALL_EXCL_OK, hireDate: '2026-06-01', today: '2026-06-01' })
  check('youthGate 군복무 없으면 미충족', !g2.ageOk && !g2.ok && !g2.nearBorder && g2.maxLabel === '만34세')
  const g3 = youthGate({ birthDate: '1998-03-10', gender: 'female', milMonths: 0, elig: ALL_ELIG_NONE, excl: ALL_EXCL_OK, hireDate: '2026-06-01', today: '2026-06-01' })
  check('youthGate 취업애로 0개 → ok false', g3.ageOk && !g3.anyElig && !g3.ok)
  const g4 = youthGate({ birthDate: '1998-03-10', gender: 'female', milMonths: 0, elig: { e1: true }, excl: { ...ALL_EXCL_OK, x2: false }, hireDate: '2026-06-01', today: '2026-06-01' })
  check('youthGate 제외요건 해당 → failedExcl', !g4.allExclOk && g4.failedExcl.join() === '사업주 가족이 아닐 것' && !g4.ok)
}

// ── 회차 일정 ───────────────────────────────────────────
{
  const rounds = buildRounds(DEFAULT_PROGRAMS.youth_jump)
  check('buildRounds isPaid:false received:0', rounds.length === 3 && rounds.every((r) => r.isPaid === false && r.received === 0))
  check('roundDate', roundDate('2026-01-15', rounds[0]) === '2026-07-15' && roundDate('2026-01-15', rounds[2]) === '2027-01-15')
  rounds[0].isPaid = true
  rounds[0].received = 3600000
  check('sumReceived/sumRemaining', sumReceived(rounds) === 3600000 && sumRemaining(rounds) === 3600000)
  const sch = roundSchedule('2026-01-15', DEFAULT_PROGRAMS.youth_jump, new Date('2026-07-10T00:00:00'), [false, false, false])
  check('roundSchedule rows', sch.rows.length === 3 && sch.rows[0].date === '2026-07-15' && sch.rows[0].dday === 5 && sch.rows[0].ddayLabel === 'D-5' && sch.rows[0].kind === '신청 임박')
  check('roundSchedule total', sch.total === 7200000 && sch.remaining === 7200000 && sch.received === 0 && sch.next7 === 1 && sch.overdue === 0 && sch.nextDday === 5)
  const sch2 = roundSchedule('2025-01-15', DEFAULT_PROGRAMS.youth_jump, new Date('2026-07-10T00:00:00'), [true, false, false])
  check('roundSchedule 지급완료·지연', sch2.rows[0].kind === '지급 완료' && sch2.rows[1].kind === '신청 지연' && sch2.overdue === 2 && sch2.received === 3600000 && sch2.remaining === 3600000)
}

// ── 명부 진단 ───────────────────────────────────────────
const BASE = new Date('2026-06-01T00:00:00')
const ROSTER: RosterEmployee[] = [
  { name: '홍길동', birthDate: '1998-03-10', gender: 'M', rrnMasked: '980310-1******', hireDate: '2026-04-01', loseDate: null, statusRaw: '취득', insuranceRaw: '국민·건강·산재·고용', workplace: '', bizNo: '', ins: { np: true, hi: true, wc: true, ei: true }, insKnown: { np: true, hi: true, wc: true, ei: true } },
  { name: '박노인', birthDate: '1965-05-01', gender: 'M', rrnMasked: '650501-1******', hireDate: '2015-01-01', loseDate: null, statusRaw: '취득', insuranceRaw: '국민·건강·산재·고용', workplace: '', bizNo: '', ins: { np: true, hi: true, wc: true, ei: true }, insKnown: { np: true, hi: true, wc: true, ei: true } },
  { name: '김영희', birthDate: '1986-02-01', gender: 'F', rrnMasked: '860201-2******', hireDate: '2020-03-01', loseDate: null, statusRaw: '취득', insuranceRaw: '국민·건강', workplace: '', bizNo: '', ins: { np: true, hi: true, wc: false, ei: false }, insKnown: { np: true, hi: true, wc: true, ei: true } },
]
{
  const d0 = classifyEmployee(ROSTER[0], { baseDate: BASE })
  check('classify 청년 28세 · 신규입사', d0.age === 28 && d0.isYouth && d0.recentHire && d0.active && d0.eiOn && !d0.insPartial && !d0.relSuspect)
  check('  후보 youth_jump(check) · emp_promo(more)', d0.candidates.map((c) => `${c.key}:${c.level}`).join() === 'youth_jump:check,emp_promo:more')
  const d1 = classifyEmployee(ROSTER[1], { baseDate: BASE })
  // D-137: 2015년 입사 61세 — 계속고용은 입사일과 상관없어 후보, 시니어 인턴십은 채용 전 약정이 필요해 뺀다
  check('classify 61세(2015 입사) → senior_continue 후보 · senior_intern 은 뺌', d1.age === 61 && d1.isSenior && d1.candidates.map((c) => c.key).join() === 'senior_continue' && d1.candidates.every((c) => c.level === 'check') && d1.expired.map((c) => c.key).join() === 'senior_intern', JSON.stringify({ c: d1.candidates, e: d1.expired }))
  const d2 = classifyEmployee(ROSTER[2], { baseDate: BASE })
  check('classify 여성 40세 · 고용/산재 미가입', d2.age === 40 && d2.isFemale && d2.eiNeedsCheck && d2.wcNeedsCheck && d2.insPartial && d2.onlyNpHi && d2.relSuspect && d2.insMissingCount === 2)
  // D-137: 김영희는 입사(2020-03-01) 때 만 34세 → 청년. 그러나 6년 전 입사 — 청년도약(입사 3개월) · 고용촉진(12개월) 기한이 지났고
  //        새일여성인턴은 채용 전 약정이 필요하다 → 후보 0, 모두 '뺀 것'
  check('  6년 전 입사 여성 → 후보 없음(새일 · 청년도약 뺌 · 고용촉진 없음)', d2.isYouth && d2.hireAge === 34 && d2.candidates.length === 0 && ['youth_jump', 'saeil_women'].every((k) => d2.expired.some((c) => c.key === k)) && !d2.candidates.some((c) => c.key === 'emp_promo'), JSON.stringify({ c: d2.candidates, e: d2.expired }))
  check('  뺀 까닭이 보인다(입사 N개월 · 기한 지남 / 채용 전 약정)', d2.expired.find((c) => c.key === 'youth_jump')?.note.includes('기한') === true && d2.expired.find((c) => c.key === 'saeil_women')?.note.includes('이미 채용한 직원') === true)
  const d3 = classifyEmployee({ ...ROSTER[0], rel: 'ceo' }, { baseDate: BASE })
  check('classify 대표자 표시 → level more', d3.relMarked && d3.candidates[0].level === 'more')
  const d4 = classifyEmployee({ ...ROSTER[0], statusRaw: '상실' }, { baseDate: BASE })
  check('classify 상실 → active false', !d4.active)

  const a = analyzeRoster(ROSTER, { baseDate: BASE })
  check('analyzeRoster counts (청년은 입사일 기준)', a.counts.totalEmp === 3 && a.counts.activeCount === 3 && a.counts.youthCount === 2 && a.counts.seniorCount === 1 && a.counts.generalCount === 1 && a.counts.newHireCount === 1, JSON.stringify(a.counts))
  check('analyzeRoster 확인 필요 인원', a.eiCheckCount === 1 && a.wcCheckCount === 1 && a.partialInsCount === 1 && a.relCheckCount === 1)
  check('analyzeRoster 후보 지원금 2건(청년도약 · 계속고용) · 오래된 직원은 뺀 수로', a.candidateSubsidyCount === 2 && a.checkItemCount === 3, `${a.candidateSubsidyCount}/${a.checkItemCount}`)
  check('analyzeRoster 뺀 수: 새일 1 · 시니어 인턴 1 · 청년도약 1 · 고용촉진 0(나이 조건 없는 지원금은 세지 않음)', a.subsidySummary.find((s) => s.key === 'saeil_women')?.expired === 1 && a.subsidySummary.find((s) => s.key === 'senior_intern')?.expired === 1 && a.subsidySummary.find((s) => s.key === 'youth_jump')?.expired === 1 && a.subsidySummary.find((s) => s.key === 'emp_promo')?.expired === 0, JSON.stringify(a.subsidySummary.map((s) => [s.key, s.expired])))
  const yj = a.subsidySummary.find((s) => s.key === 'youth_jump')
  const pa = a.subsidySummary.find((s) => s.key === 'parental')
  check('summary youth_jump check 1 · level check', !!yj && yj.check === 1 && yj.candidateCount === 1 && yj.level === 'check' && yj.confidence === 'more')
  check('summary parental 는 항상 more', !!pa && pa.level === 'more' && pa.candidateCount === 0)
  // D-136: 규칙표 총액 하나만 쓴다 (청년도약 720 · 계속고용 720 · 시니어 인턴 550 · 새일 400)
  check('estimateSubsidyTotal — 새로 신청할 수 있는 후보만(청년도약 720 · 계속고용 720)', estimateSubsidyTotal(a.subsidySummary) === (720 + 720) * 10000, String(estimateSubsidyTotal(a.subsidySummary)))
  const txt = buildCopyText({ company: '미래상사', totalEmp: 3, youthCount: 1, seniorCount: 1, eiCheckCount: 1, wcCheckCount: 1, partialInsCount: 1, relCheckCount: 1, candidateSubsidyCount: 4 })
  check('buildCopyText 첫줄·주의문구', txt.startsWith('미래상사 4대보험 명부 1차 검토 결과') && txt.indexOf('· 통합고용세액공제 예상: 전년도 인원·소재지 입력 후 검토 가능') >= 0 && txt.indexOf('홍길동') < 0)
}

// ── parseRosterText (주민번호 원본 미보관 계약) ─────────
{
  const sample = ['사업장명: 미래상사 사업자등록번호 123-45-67890', '발급일시 2026.05.20', '성명 주민등록번호 국민연금 건강보험 산재보험 고용보험', '980310-1234567 홍길동', '2026-01-05 2026-01-05 2026-01-05 2026-01-05', '860201-2345678 김영희', '2020-03-01 2020-03-01 - -'].join('\n')
  const r = parseRosterText(sample)
  const json = JSON.stringify(r)
  check('parseRosterText 2명', r.employees.length === 2 && r.stats.rrnCount === 2, JSON.stringify(r.employees.map((e) => e.name)))
  check('  1번: 이름·생년월일·성별·마스킹', r.employees[0].name === '홍길동' && r.employees[0].birthDate === '1998-03-10' && r.employees[0].gender === 'M' && r.employees[0].rrnMasked === '980310-1******', JSON.stringify(r.employees[0]))
  check('  1번: 4대보험 전부 ON · 입사일', !!r.employees[0].ins && r.employees[0].ins.np && r.employees[0].ins.hi && r.employees[0].ins.wc && r.employees[0].ins.ei && r.employees[0].hireDate === '2026-01-05')
  check('  2번: 국민·건강만 ON', r.employees[1].name === '김영희' && r.employees[1].gender === 'F' && !!r.employees[1].ins && r.employees[1].ins.np && r.employees[1].ins.hi && !r.employees[1].ins.wc && !r.employees[1].ins.ei && r.employees[1].insuranceRaw === '국민·건강', JSON.stringify(r.employees[1]))
  check('  주민번호 뒷자리 원본이 결과 어디에도 없음', json.indexOf('1234567') < 0 && json.indexOf('2345678') < 0 && json.indexOf('234567') < 0, json.slice(0, 300))
  check('  meta 사업장·사업자번호·발급일', r.meta.workplace === '미래상사' && r.meta.bizNo === '123-45-67890' && r.meta.issueDate === '2026-05-20', JSON.stringify(r.meta))
  check('  preview 마스킹', r.stats.preview.indexOf('980310-1******') >= 0 && r.stats.preview.indexOf('1234567') < 0)
  check('  missingCount 0', r.missingCount === 0)
  const st = rosterStaleness(r.meta.issueDate, BASE)
  check('rosterStaleness 12일 → ok', !!st && st.days === 12 && st.level === 'ok')
  check('rosterStaleness 100일 → high', rosterStaleness('2026-02-20', BASE)?.level === 'high')
}
check('deriveFromRRN', (() => {
  const d = deriveFromRRN('020315-4******')
  return !!d && d.birthDate === '2002-03-15' && d.gender === 'F'
})())
check('maskRRN', maskRRN('980310-1234567') === '980310-1******' && maskRRN('980310') === '980310-*******' && maskRRN('12') === null)

// ── CSV 격자 파서 (xlsx 대체) ───────────────────────────
{
  const csv = ['성명,주민등록번호,자격취득일,자격상실일,성별', '홍길동,980310-1234567,2026-01-05,,남', '김영희,860201-2******,2020.03.01,,여', '합계,,,,'].join('\n')
  const grid = textToGrid(csv)
  const det = detectRoster(grid)
  const emps = extractEmployees(grid, det)
  check('CSV → 헤더 0행 · 2명', det.headerIdx === 0 && emps.length === 2, JSON.stringify({ h: det.headerIdx, n: emps.length, map: det.map }))
  check('CSV 1번 마스킹·생년월일', emps[0].rrnMasked === '980310-1******' && emps[0].birthDate === '1998-03-10' && emps[0].gender === 'M' && emps[0].hireDate === '2026-01-05')
  check('CSV 2번 날짜 점 표기', emps[1].hireDate === '2020-03-01' && emps[1].gender === 'F')
  check('CSV 원본 뒷자리 없음', JSON.stringify(emps).indexOf('1234567') < 0)
}

// ── 세액공제 ────────────────────────────────────────────
check('defaultTaxUnits 표', (() => {
  const a = defaultTaxUnits('local', 'sme')
  const b = defaultTaxUnits('metro', 'sme')
  const c = defaultTaxUnits('metro', 'mid')
  const d = defaultTaxUnits('local', 'other')
  return a.youth === 1550 && a.normal === 950 && b.youth === 1450 && b.normal === 850 && c.youth === 800 && c.normal === 450 && d.youth === 0 && d.normal === 0
})())
check('estimateTaxCredit 샘플', (() => {
  const e = estimateTaxCredit({ region: 'metro', sizeType: 'sme', prevTotal: 10, curTotal: 13, prevYouth: 2, curYouth: 4, unitYouth: 1450, unitNormal: 850 })
  return e.computable && e.youthKnown && e.incTotal === 3 && e.incYouth === 2 && e.incNormal === 1 && e.creditYouth === 29000000 && e.creditNormal === 8500000 && e.creditTotal === 37500000 && !e.overYouth
})(), JSON.stringify(estimateTaxCredit({ prevTotal: 10, curTotal: 13, prevYouth: 2, curYouth: 4, unitYouth: 1450, unitNormal: 850 })))
check('estimateTaxCredit 청년 초과 → needsRecheck', estimateTaxCredit({ prevTotal: 10, curTotal: 11, prevYouth: 0, curYouth: 3, unitYouth: 1450, unitNormal: 850 }).needsRecheck === true)
check('estimateTaxCredit 모름 → computable false', (() => {
  const e = estimateTaxCredit({ prevTotal: null, curTotal: 13 })
  return !e.computable && e.incTotal === null && e.creditTotal === null
})())

// ── 메타 표 ─────────────────────────────────────────────
check('LEVELS 4 · 라벨', LEVELS.likely.label === '가능성 높음' && LEVELS.check.label === '확인 필요' && LEVELS.more.label === '추가자료 필요' && LEVELS.unknown.label === '판단 불가')
check('CONFIDENCE_META', CONFIDENCE_META.some.label === '일부 자료 필요' && CONFIDENCE_META.limited.label === '판단 제한')
check('SUBSIDY_DEFS 6 · parental limited', SUBSIDY_DEFS.length === 6 && SUBSIDY_DEFS[5].key === 'parental' && SUBSIDY_DEFS[5].confidence === 'limited')
check('SUBSIDY_MAX_PER_PERSON = 규칙표 총액', SUBSIDY_MAX_PER_PERSON.youth_jump * 10000 === DEFAULT_PROGRAMS.youth_jump.totalAmount && SUBSIDY_MAX_PER_PERSON.saeil_women * 10000 === DEFAULT_PROGRAMS.saeil_women.totalAmount && SUBSIDY_MAX_PER_PERSON.senior_intern * 10000 === DEFAULT_PROGRAMS.senior_intern.totalAmount && SUBSIDY_MAX_PER_PERSON.parental === 0 && SUBSIDY_ESTIMATE_NOTE.startsWith('★'))
check('EMP_DOC_CHECKLIST 7 · TAX_CHECKLIST 7', EMP_DOC_CHECKLIST.length === 7 && TAX_CHECKLIST.length === 7 && TAX_CHECKLIST[6] === '세무대리인(세무사) 최종 검토 필요')
check('ROSTER_FIELDS 9', ROSTER_FIELDS.length === 9 && ROSTER_FIELDS[0].key === 'name' && ROSTER_FIELDS[1].aliases.indexOf('주민(앞)') >= 0)

// ── 엑셀(.xlsx) 명부 (D-89) ─────────────────────────────
// "엑셀은 CSV 로 저장해 주세요" 를 없앴다. 엑셀 파일 그대로 올려서 직원이 잡히는지 본다.
{
  const buf = await makeSimpleXlsx([
    ['사업장명', '한솔테크(주)'],
    [],
    ['연번', '성명', '주민등록번호', '자격취득일'],
    ['1', '김철수', '900101-1234567', '2026-01-15'],
    ['2', '박영희', '880202-2345678', '2025-07-01'],
  ])
  const file = new File([buf], '4대보험 가입자명부.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const r = await parseRosterFile(file)
  check('엑셀 명부: 그대로 읽는다', r.ok === true && r.method === 'xlsx', JSON.stringify({ ok: r.ok, error: r.error, method: r.method }))
  check('엑셀 명부: 두 명을 찾는다', (r.employees?.length ?? 0) === 2, JSON.stringify(r.employees?.map((e) => e.name)))
  check('엑셀 명부: 이름·입사일을 읽는다', r.employees?.[0].name === '김철수' && r.employees?.[0].hireDate === '2026-01-15', JSON.stringify(r.employees?.[0]))
  check('엑셀 명부: 주민번호 원본은 보관하지 않는다', JSON.stringify(r.employees).indexOf('900101-1234567') < 0 && r.employees?.[0].rrnMasked === '900101-1******' && r.employees?.[0].birthDate === '1990-01-01')
  const bad = await parseRosterFile(new File([new TextEncoder().encode('hwp 인 척')], '명부.hwp', { type: '' }))
  check('엑셀 아닌 파일: 안 읽는 것은 그대로 안 읽는다', bad.ok === false && bad.error === 'unsupported')
}

/* ---- D-91 모듈 기록: 대상자 · 진행 보드 · 시뮬레이터 ---- */
{
  const T = new Date('2026-09-23T00:00:00')
  const mk = (over: Partial<EmpRecord>): EmpRecord =>
    ({
      id: over.id ?? 'e1',
      clientId: over.clientId ?? 'c1',
      name: over.name ?? '김직원',
      hireDate: over.hireDate ?? '2026-03-02',
      birthDate: '',
      empType: '정규직',
      programId: 'youth_jump',
      stage: over.stage ?? 'preparing',
      rounds: over.rounds ?? buildRounds(DEFAULT_PROGRAMS.youth_jump),
      docs: over.docs ?? [],
      memo: '',
    })

  check('단계: 7단계 그대로', EMP_STAGES.length === 7 && EMP_STAGES[0].key === 'preparing' && EMP_STAGES[6].key === 'resigned')
  check('단계: 모르는 값은 준비중', normalizeStage('없는단계') === 'preparing' && normalizeStage('approved') === 'approved')
  check('기록: 빠진 칸이 있어도 한 줄로 읽는다', toEmpRecord('x', 'c1', { name: '박직원' }).stage === 'preparing' && toEmpRecord('x', 'c1', {}).rounds.length === 0)
  check('기록: 주민등록번호 칸은 아예 없다', Object.keys(toEmpRecord('x', 'c1', { rrn: '900101-1234567' })).indexOf('rrn') < 0)

  const e = mk({})
  const first = DEFAULT_PROGRAMS.youth_jump.rounds[0]
  check('돈: 아직 못 받은 예정액은 회차 합', empRemaining(e) === DEFAULT_PROGRAMS.youth_jump.rounds.reduce((s, r) => s + r.amount, 0), String(empRemaining(e)))
  check('돈: 받은 돈 0 에서 시작', empReceived(e) === 0)
  const paid = mk({ rounds: buildRounds(DEFAULT_PROGRAMS.youth_jump).map((r, i) => (i === 0 ? { ...r, isPaid: true, received: r.amount } : r)) })
  check('돈: 한 회차 받으면 그만큼', empReceived(paid) === first.amount, String(empReceived(paid)))
  check('기한: 다음 회차는 입사일 + n개월', empNextDate(e) === addMo('2026-03-02', first.month), empNextDate(e))
  check('기한: D-day 는 그 날짜 기준', empNextDday(e, T) === getDdayFrom(addMo('2026-03-02', first.month), T))

  const late = mk({ id: 'late', hireDate: '2025-01-02' })
  const soonRounds = buildRounds(DEFAULT_PROGRAMS.youth_jump)
  check('급한 순: 지난 것이 0', empUrgency(late, T) === 0, String(empUrgency(late, T)))
  const docsLeft = mk({ id: 'docs', hireDate: '2026-09-01', rounds: soonRounds.map((r) => ({ ...r, isPaid: true })), docs: [{ name: '재직증명서', done: false }] })
  check('급한 순: 서류가 덜 차면 2', empUrgency(docsLeft, T) === 2, String(empUrgency(docsLeft, T)))
  const plain = mk({ id: 'plain', hireDate: '2026-09-01', rounds: soonRounds.map((r) => ({ ...r, isPaid: true })), docs: [{ name: '재직증명서', done: true }] })
  check('급한 순: 남은 것도 없고 서류도 다 되면 3', empUrgency(plain, T) === 3, String(empUrgency(plain, T)))

  const cols = boardColumns([e, mk({ id: 'e2', stage: 'completed' }), late], T)
  check('보드: 단계별로 나뉜다', cols.length === 7 && cols[0].items.length === 2 && cols[5].items.length === 1, JSON.stringify(cols.map((c) => c.items.length)))
  check('보드: 지연이 맨 앞', cols[0].items[0].id === 'late', cols[0].items.map((i) => i.id).join(','))

  const sum = summarizeEmployees([e, late, mk({ id: 'out', stage: 'resigned' })], T)
  check('모아보기: 퇴사는 빼고 센다', sum.active === 2, String(sum.active))
  check('모아보기: 지난 회차를 센다', sum.overdue > 0 && sum.overdueAmount > 0, JSON.stringify({ o: sum.overdue, a: sum.overdueAmount }))

  const roll = rollupByClient([e, mk({ id: 'e3', clientId: 'c2' })], T)
  check('업체별: 업체마다 따로 센다', roll.size === 2 && roll.get('c1')?.active === 1 && roll.get('c2')?.active === 1)

  // 시뮬레이터 — 원본과 같은 계산
  const sim = simulate(DEFAULT_PROGRAMS.youth_jump, 2, '2026-03-02')
  const perPerson = DEFAULT_PROGRAMS.youth_jump.rounds.reduce((s, r) => s + r.amount, 0)
  check('시뮬레이터: 인원만큼 곱한다', sim.total === perPerson * 2, String(sim.total))
  check('시뮬레이터: 같은 달은 한 줄로 합친다', sim.monthly.every((m, i) => i === 0 || m.month > sim.monthly[i - 1].month))
  check('시뮬레이터: 첫 달은 입사 + 1회차', sim.monthly[0].month === addMo('2026-03-02', DEFAULT_PROGRAMS.youth_jump.rounds[0].month).substring(0, 7), sim.monthly[0].month)
  check('시뮬레이터: 인원 0 이면 아무것도 없다', simulate(DEFAULT_PROGRAMS.youth_jump, 0, '2026-03-02').total === 0)
  check('시뮬레이터: 상담 문구에 금액과 기간', simulationText('청년일자리도약장려금', 2, sim).includes('예상 총 수령액') && simulationText('청년일자리도약장려금', 2, sim).includes('~'))
}


/* ---- D-92: 업체 관리 기록 · 기관 보고서 · 대시보드 · 엑셀 마법사 ---- */
{
  const T = new Date('2026-09-23T00:00:00')
  const base = (over: Partial<EmpRecord>): EmpRecord => ({
    id: 'x',
    clientId: 'c1',
    name: '박청년',
    hireDate: '2026-01-05',
    birthDate: '2000-01-01',
    empType: '정규직',
    programId: 'youth_jump',
    stage: 'inprogress',
    rounds: buildRounds(DEFAULT_PROGRAMS.youth_jump),
    docs: [{ name: '근로계약서', done: false }],
    memo: '',
    salary: 2800000,
    ...over,
  })
  const paid = base({ id: 'p', rounds: buildRounds(DEFAULT_PROGRAMS.youth_jump).map((r, i) => (i === 0 ? { ...r, isPaid: true, received: 3000000, paidDate: '2026-07-10' } : r)) })
  const cs = commissionSummary({ rate: 20, retainer: 500000 }, [paid])
  check('수수료: 청구 가능액 = 착수금 + 수령액×율', cs.billable === 500000 + 600000, String(cs.billable))
  check('수수료: 청구 전에는 미수금 0', cs.receivable === 0 && cs.state === '미청구')
  check('수수료: 청구하고 입금 전이면 미수금', commissionSummary({ rate: 20, retainer: 500000, billed: true }, [paid]).receivable === 1100000)
  check('수수료: 입금하면 미수금 0', commissionSummary({ rate: 20, billed: true, paid: true }, [paid]).receivable === 0)
  check('수수료: 성공보수 끄면 착수금만', commissionSummary({ rate: 20, retainer: 300000, successFee: false }, [paid]).billable === 300000)
  check('수수료: 기본 수수료율 20%', commissionSummary({}, [paid]).rate === 20)

  const meta = { ...emptyCompanyMeta(), companyDocs: [{ id: 'd', label: '사업자등록증', done: false }] }
  const rd = agencyReportData('한솔테크', meta, [paid, base({ id: 'n', name: '무급여', salary: 0 })], () => '청년일자리도약장려금', T)
  check('기관 보고서: 급여일 미입력을 위험으로 잡는다', rd.riskItems.some((r) => r.problem === '급여일 미입력'))
  check('기관 보고서: 급여 누락을 필수 정보 누락으로', rd.riskItems.some((r) => r.problem.includes('필수 정보 누락') && r.problem.includes('급여')))
  check('기관 보고서: 업체 서류 + 직원 서류를 센다', rd.missingDocsCount === 3, String(rd.missingDocsCount))
  check('기관 보고서: 이번 주 계획 맨 앞은 서류 회수', rd.planWeek[0]?.startsWith('미제출 서류'))
  check('기관 보고서: 코멘트에 예상 총액', agencyAutoComment(rd).includes('예상 총액'))
  check('기관 보고서: 서류 요청 문구 번호 매김', agencyDocRequestText(rd).includes('1. 사업자등록증'))
  check('기관 보고서: 대표 요약에 미제출 서류', agencySummaryText(rd).includes('미제출 서류 3건'))

  const comps = [{ id: 'c1', name: '한솔테크', meta }]
  const tasks = ddayAlerts([base({ id: 'late', stage: 'preparing' })], comps, T)
  // D-138: 2026-01-05 입사 · 아직 준비 → 참여신청 기한(4/5) 지남이 맨 앞, 회차 신청 지연도 같이
  check('오늘 할 일: 준비 중인데 입사 3개월 지났으면 맨 앞에 기한 지남(기한 초과로 셈)', tasks[0]?.kind === '기한 지남' && tasks[0]?.pri === 0 && tasks[0]?.sub.includes('참여신청 기한 지남'), tasks[0]?.kind)
  check('오늘 할 일: 지난 회차는 신청 지연', tasks.some((t) => t.kind === '신청 지연'))
  const t2 = ddayAlerts([base({ id: 'new', stage: 'preparing', hireDate: '2026-06-30' }), base({ id: 'on', stage: 'submitted', hireDate: '2020-01-01' })], comps, T)
  check('오늘 할 일: 입사 3개월 기한 7일 남음 → 참여신청 기한 D-7', t2.some((t) => t.id === 'enr-new' && t.kind === '참여신청 기한' && t.dday === 7 && t.pri === 1 && t.sub.includes('2026-09-30')) && t2.find((t) => t.id === 'enr-new' && t.pri === 0) === undefined, JSON.stringify(t2.map((t) => [t.id, t.kind, t.dday])))
  check('오늘 할 일: 이미 신청한 직원(접수)은 입사일이 오래돼도 기한 알림 없음', !t2.some((t) => t.id === 'enr-on'))
  const t3 = ddayAlerts([base({ id: 'far', stage: 'preparing', hireDate: '2026-09-01' })], comps, T)
  check('오늘 할 일: 기한이 한참 남으면(D-68) 아직 안 띄움', !t3.some((t) => t.id === 'enr-far'))
  check('오늘 할 일: 급여일 미입력 알림', tasks.some((t) => t.kind === '정보 누락'))
  check('오늘 할 일: 서류 미완료 알림', tasks.some((t) => t.kind === '서류'))
  check('월별 수령: 지급일 달에 들어간다', monthlyReceived([paid], 2026)[6].received === 3000000)
  check('순위: 받은 돈 순', companyRanking([paid], [{ id: 'c1', name: '한솔테크' }])[0].total === 3000000)
  check('미지급: 회차가 남으면 목록에', pendingPayments([paid], T).length === 1)
  check('위험도: 지난 회차가 있으면 지연', companyRiskRanking([base({ id: 'r' })], comps, T)[0].level.t === '지연')
  check('파이프라인: 지원금별 진행률', programPipeline([paid], () => '청년').length === 1)

  // 엑셀 마법사
  const grid = [['고객 명단'], ['업체명', '사업자번호', '성명', '입사일자', '생년월일', '지원금', '상태'], ['한솔테크(주)', '123-45-67890', '김하나', '2026.3.2', '19990101', '청년일자리도약장려금', '지급중'], ['합계', '', '', '', '', '', ''], ['모르는회사', '', '이둘', '2026-04-01', '', '', '']]
  const h = xlDetectHeader(grid)
  check('엑셀: 헤더 행을 스스로 찾는다', h === 1, String(h))
  const am = xlAutoMap(grid[h])
  check('엑셀: 성명 → 직원명 (완전 일치)', am.map.empName === 2 && am.conf.empName === 'high')
  check('엑셀: 입사일자 → 입사일', am.map.startDate === 3)
  check('엑셀: 날짜 모양 여러 가지', xlNormDate('2026.3.2').value === '2026-03-02' && xlNormDate('19990101').value === '1999-01-01' && xlNormDate('45000').ok)
  check('엑셀: 사업자번호 하이픈 위치', !xlBizNoCheck('12-345-67890').ok && xlBizNoCheck('123-45-67890').ok)
  const pv = buildImportPreview({ grid, headerRow: h, map: am.map, clients: [{ id: 'c1', companyName: '(주)한솔테크', businessNumber: '1234567890' }], programs: [{ id: 'youth_jump', name: '청년일자리도약장려금' }], existing: [] })
  check('엑셀: 합계 줄은 건너뛴다', pv.junk === 1, String(pv.junk))
  check('엑셀: 사업자번호로 업체를 맞춘다', pv.toSave.length === 1 && pv.toSave[0].clientId === 'c1')
  check('엑셀: 고객 운영에 없는 업체는 뺀다', pv.excluded === 1)
  check('엑셀: 상태 말을 단계로', pv.toSave[0].stage === 'inprogress')
  const dup = buildImportPreview({ grid, headerRow: h, map: am.map, clients: [{ id: 'c1', companyName: '한솔테크', businessNumber: '' }], programs: [], existing: [{ clientId: 'c1', name: '김하나', hireDate: '2026-03-02' }] })
  check('엑셀: 이미 있는 사람은 중복', dup.duplicates === 1 && dup.toSave.length === 0)
}


/* ═══ D-93 원본 화면 저장 자리 (orig/store.ts) ═══ */
{
  const os = {
    id: 'cli_a', workspaceId: null, companyName: '(주)한솔테크', contactName: '이과장', contactPhone: '010-1111-2222', contactEmail: 'a@b.kr',
    businessNumber: '123-45-67890', corporateNumber: '110111-1234567', businessAddress: '경기 성남시 분당구', industry: '제조업',
    representativeName: '김대표', employeeCount: '12명(대표 포함)', establishedAt: '2019-03-02', contactTitle: '과장', companyPhone: '031-000-0000',
    businessCategory: '', archivedAt: null, createdAt: '2026-01-01T00:00:00Z',
  } as unknown as ClientOpsRecord
  const other = { ...os, id: 'cli_b', companyName: '바른상사', businessNumber: '987-65-43210', businessAddress: '부산 해운대구', corporateNumber: '' } as unknown as ClientOpsRecord
  const def = osCompanyDefaults(os)
  check('원본 업체: 고객 운영 기록으로 칸을 채운다', def.name === '(주)한솔테크' && def.bizNo === '123-45-67890' && def.ceoName === '김대표' && def.managerName === '이과장' && def.corpType === '법인' && def.empCount === '12')
  check('원본 업체: 주소로 수도권·비수도권', regionOfAddress('서울 강남구') === '수도권' && regionOfAddress('부산 해운대구') === '비수도권' && regionOfAddress('') === '')
  const comp = toOrigCompany(os, { payday: '25', commission: { rate: 20 }, companyDocs: [{ id: 'd1', label: '사업자등록증', done: false }], name: '옛 이름' })
  check('원본 업체: 이름은 늘 고객 운영 그대로 · id = 업체 id', comp.name === '(주)한솔테크' && comp.id === 'cli_a' && comp.osId === 'cli_a')
  check('원본 업체: 고용지원금 쪽 기록(급여일·수수료)이 붙는다', comp.payday === '25' && (comp.commission as { rate: number }).rate === 20)
  check('원본 업체: 서류에 파일 칸이 생긴다', Array.isArray((comp.companyDocs as Array<{ files: unknown[] }>)[0].files))
  const meta = companyMetaOf({ ...comp, phone: '031-000-0000', addr: '서울 새 주소' }, os)
  check('원본 업체 저장: 고객 운영과 같은 값은 적지 않는다', !('phone' in meta) && !('bizNo' in meta) && !('name' in meta) && !('id' in meta))
  check('원본 업체 저장: 고친 값·고용지원금 기록은 적는다', meta.addr === '서울 새 주소' && meta.payday === '25')
  const pick = osPickList([os, other, { ...other, id: 'cli_x', archivedAt: '2026-01-01' } as unknown as ClientOpsRecord], new Set(['cli_a']))
  check('업체 고르기: 보관한 업체는 빼고, 등록된 업체는 표시', pick.length === 2 && pick[0].taken === true && pick[1].taken === false)
  check('엑셀 업체 맞추기: 사업자번호로', matchOsClient({ name: '아무개', bizNo: '9876543210' }, [os, other])?.id === 'cli_b')
  check('엑셀 업체 맞추기: (주) 떼고 이름으로', matchOsClient({ name: '한솔테크', bizNo: '' }, [os, other])?.id === 'cli_a')
  check('엑셀 업체 맞추기: 없으면 없다', matchOsClient({ name: '없는회사', bizNo: '' }, [os, other]) === undefined)

  // D-91 모양 직원 → 원본 직원
  const old = toOrigEmployee({ id: 'e1', clientId: 'cli_a', data: { name: '김청년', hireDate: '2026-03-02', stage: 'approved', gender: '여', militaryMonths: 0, rounds: [{ month: 6, amount: 3600000, label: '1차', isPaid: false, received: 0 }], docs: [{ name: '근로계약서', done: true }] } })
  check('옛 직원(D-91): 입사일·단계·성별을 원본 이름으로', old.startDate === '2026-03-02' && old.status === 'approved' && old.gender === 'female' && old.companyId === 'cli_a')
  check('옛 직원(D-91): 서류가 원본 모양으로', (old.employeeDocs as Array<{ label: string; done: boolean }>)[0].label === '근로계약서' && (old.employeeDocs as Array<{ done: boolean }>)[0].done)
  check('옛 직원(D-91): 회차 합계가 총 예정액', old.totalExpected === 3600000)
  const row = employeeRowData({ ...old, status: 'inprogress' })
  check('직원 저장: 원본 표시 + D-91 이름도 같이', row._v === 'orig' && row.hireDate === '2026-03-02' && row.stage === 'inprogress' && !('id' in row) && !('companyId' in row))
  const back = toOrigEmployee({ id: 'e1', clientId: 'cli_a', data: row })
  check('직원 저장 → 다시 읽기: 그대로', back.status === 'inprogress' && back.name === '김청년' && back.id === 'e1')

  // 지원금 표 · 달력 메모
  check('지원금 표: D-91 기록이 없으면 원본 기본 표', programsFromD91([], {}, {}) === undefined)
  const pm = programsFromD91([{ data: { programId: 'youth_jump', enabled: false } }, { data: { programId: 'my1', enabled: true, custom: { id: 'my1', name: '우리 지원금' } } }], { youth_jump: { id: 'youth_jump' }, work_exp: { id: 'work_exp' } }, { youth_jump: true })
  check('지원금 표: 끈 것은 끈 채로 · 기본값은 원본대로 · 더한 것도', pm?.youth_jump.enabled === false && pm?.work_exp.enabled === false && pm?.my1.enabled === true)
  const memos = memosFromRow({ memos: { '2026-09-05': [{ id: 'a', text: 'x' }], '2026-9-5': [{ id: 'b', text: 'y' }] } })
  check('달력 메모: D-92 날짜 열쇠를 원본 모양으로 모은다', Object.keys(memos).join() === '2026-9-5' && memos['2026-9-5'].length === 2)
}


/* ═══ D-136 고용지원금 바로잡기 — 틀리면 큰일인 곳 ═══ */
{
  const RRN_LIKE = /\d{6}\s*-?\s*[1-8]\d{6}/
  const noRrn = (v: unknown) => {
    const j = JSON.stringify(v)
    return !RRN_LIKE.test(j) && !/(?<!\d)\d{13}(?!\d)/.test(j) && j.indexOf('1234567') < 0
  }

  // ── 1. 주민번호가 사업자번호·메모로 저장되지 않는다 ──
  const m1 = xlAutoMap(['업체명', '주민등록번호', '성명', '생년월일'])
  check('RRN: 주민등록번호 칸은 사업자번호로 잡히지 않는다', m1.map.bizNo === -1 && Object.values(m1.map).indexOf(1) < 0, JSON.stringify(m1.map))
  check('RRN: 느슨한 "등록번호" 칸도 사업자번호가 아니다', xlAutoMap(['업체명', '등록번호', '성명']).map.bizNo === -1)
  check('RRN: "사업자 등록 번호(필수)" 는 사업자번호', xlAutoMap(['상호', '사업자 등록 번호(필수)', '이름']).map.bizNo === 1)
  check('RRN: 모양 판별', looksLikeRrn('950115-1234567') && looksLikeRrn('950115-1******') && looksLikeRrn('메모 9501151234567 확인') && !looksLikeRrn('123-45-67890') && !looksLikeRrn('2026-01-15') && !looksLikeRrn('010-1234-5678') && !looksLikeRrn('c1/1727654400000_a.pdf'))
  check('RRN: 사업자번호 칸 값', safeBizNo('950115-1234567') === '' && safeBizNo('9501151234567') === '' && safeBizNo('123-45-67890') === '123-45-67890')
  {
    const grid = [
      ['업체명', '번호', '성명', '메모', '생년월일'],
      ['한솔테크', '950115-1234567', '김하나', '주민 9501151234567 확인', '950115-1234567'],
    ]
    const pv = buildImportPreview({ grid, headerRow: 0, map: { companyName: 0, bizNo: 1, empName: 2, memo: 3, birthDate: 4, startDate: -1, salary: -1, programName: -1, status: -1 }, clients: [{ id: 'c1', companyName: '한솔테크', businessNumber: '' }], programs: [], existing: [] })
    const row = pv.rows[0]
    check('RRN: 사업자번호 칸에 주민번호를 직접 이어도 저장 안 함', row.bizNo === '' && row.messages.some((x) => x.includes('주민번호 모양')), JSON.stringify(row))
    check('RRN: 생년월일 칸의 주민번호는 생년월일만', row.birthDate === '1995-01-15' && row.messages.some((x) => x.includes('생년월일만')))
    check('RRN: 미리보기·저장 대상 어디에도 13자리가 없다', noRrn(pv) && row.memo.includes('[주민번호 지움]'), JSON.stringify(pv.toSave))
  }
  {
    const os = { id: 'cli_a', companyName: '한솔테크', businessNumber: '123-45-67890', businessAddress: '서울', corporateNumber: '', representativeName: '', contactName: '', archivedAt: null, createdAt: '' } as unknown as ClientOpsRecord
    const saved = companyMetaOf({ id: 'cli_a', name: '한솔테크', bizNo: '950115-1234567', memo: '9501151234567', notes: [{ id: 'n1', text: '대표 주민번호 950115-1234567' }], companyDocs: [{ id: 'd', label: '통장', files: [{ path: 'cli_a/1727654400000_a.pdf' }] }] }, os)
    check('RRN: 업체 저장 — 사업자번호 칸이 주민번호면 비운다', saved.bizNo === '', JSON.stringify(saved))
    check('RRN: 업체 저장 — 어디에도 13자리 번호가 없다(파일 경로 제외)', noRrn({ ...saved, companyDocs: undefined }), JSON.stringify(saved))
    check('RRN: 업체 저장 — 파일 경로 숫자는 건드리지 않는다', JSON.stringify(saved).includes('cli_a/1727654400000_a.pdf'))
    const er = employeeRowData({ id: 'e', companyId: 'c', name: '김', memo: '950115-1234567 / 880202-2******', birthDate: '1995-01-15' })
    check('RRN: 직원 저장 — 메모의 주민번호를 지운다 · 생년월일은 둔다', noRrn(er) && er.birthDate === '1995-01-15' && !String(er.memo).includes('880202-2'), JSON.stringify(er))
  }
  check('RRN: 생년월일 칸 읽기', birthFromCell('9501151', (x) => xlNormDate(x).value).value === '1995-01-15' && birthFromCell('19950115', (x) => xlNormDate(x).value).fromRrn === false && birthFromCell('19950115', (x) => xlNormDate(x).value).value === '1995-01-15')

  // ── 2. 청년 나이: 만 34세 11개월 통과 · 35세 0개월 탈락 · 병역 가산 · 두 화면 같은 답 ──
  const gate = (birthDate: string, milMonths = 0, gender: 'male' | 'female' = 'male') => youthGate({ birthDate, gender, milMonths, elig: { e1: true }, excl: ALL_EXCL_OK, hireDate: '2026-06-01', today: '2026-06-01' })
  check('청년: 34세 10개월 통과', gate('1991-07-02').ageOk && gate('1991-07-02').ok)
  check('청년: 34세 11개월(35번째 생일 전날) 통과', gate('1991-06-02').ageOk, JSON.stringify(gate('1991-06-02')))
  check('청년: 35세 0개월(35번째 생일 당일) 탈락', !gate('1991-06-01').ageOk)
  check('청년: 15세 미만 탈락 · 15세 통과', !gate('2011-06-02').ageOk && gate('2011-06-01').ageOk)
  check('청년: 36세 0개월 · 복무 12개월 → 35세 → 탈락', !youthAgeAt('1990-06-01', '2026-06-01', 12).ok)
  check('청년: 36세 0개월 · 복무 13개월 → 34세 → 통과(복무 덕)', youthAgeAt('1990-06-01', '2026-06-01', 13).ok && youthAgeAt('1990-06-01', '2026-06-01', 13).byService)
  check('청년: 39세 11개월 · 복무 72개월 → 통과', youthAgeAt('1986-06-02', '2026-06-01', 72).ok)
  check('청년: 40세 0개월 · 복무 72개월 → 탈락(최대 만 39세)', !youthAgeAt('1986-06-01', '2026-06-01', 72).ok)
  check('청년: 복무 100개월도 6년까지만', calcMilitaryLimit(100).extMonths === 72)
  check('청년: 여성은 복무 가산을 쓰지 않는다(입력 화면과 같게)', !gate('1990-06-01', 24, 'female').ageOk && gate('1990-06-01', 24, 'male').ageOk)
  check('청년: 생년월일 자리값(2000-01-01)이면 대상자 예상으로 올리지 않는다', !gate('2000-01-01').ok && !gate('2000-01-01').hasBirth && !gate('').ok)
  check('청년: 나이(만 N세)만 알 때', youthByYears(34, 0) === 'ok' && youthByYears(35, 0) === 'fail' && youthByYears(14, 0) === 'fail' && youthByYears(36, 24) === 'ok' && youthByYears(36, 18) === 'border' && youthByYears(40, 72) === 'fail')
  {
    // 두 화면이 서로 다른 답을 내지 않는다: 자격요건(생년월일) 통과인데 채용 진단(만 N세)이 막거나, 진단이 '충족' 인데 자격요건이 떨어뜨리는 일 없음
    let disagree = ''
    for (let y = 1984; y <= 1994; y++) {
      for (const md of ['01-15', '05-31', '06-01', '06-02', '12-31']) {
        for (const mil of [0, 11, 12, 18, 24, 60, 72]) {
          const b = `${y}-${md}`
          const g = youthAgeAt(b, '2026-06-01', mil)
          const v = youthByYears(g.age, mil)
          if (g.ok && v === 'fail') disagree += `${b}/${mil}:gate ok·diag fail `
          if (!g.ok && v === 'ok') disagree += `${b}/${mil}:gate fail·diag ok `
        }
      }
    }
    check('청년: 채용 진단과 자격요건이 같은 규칙', disagree === '', disagree)
  }
  {
    const rows = diagnoseHiring({ ...BASE_ANSWERS, age: 36, milMonths: 18 }, PROGRAM_LIST)
    const yj = rowOf(rows, 'youth_jump')
    check('채용 진단: 36세·복무 18개월은 경계 → 막지 않고 ★ 확인', !!yj && yj.status === 'maybe' && yj.blockers.length === 0 && yj.cautions.some((c) => c.includes('나이 경계')), JSON.stringify(yj && { s: yj.status, b: yj.blockers, c: yj.cautions }))
    const ans = buildAnswers({ situation: 'new', cats: ['청년'], specials: [], age: 'abc', gender: 'male', milMonths: 'x', region: '비수도권', companySize: '10', empType: '정규직', preApply: true, noLayoff: true, aboveFloor: true, youthEligible: true })
    const yj2 = rowOf(diagnoseHiring(ans, PROGRAM_LIST), 'youth_jump')
    check('채용 진단: 나이 "abc" 는 통과하지 않는다', ans.age === null && !!yj2 && yj2.reasons.indexOf('나이 요건 충족') < 0 && yj2.status !== 'recommend' && yj2.cautions.some((c) => c.includes('나이 미입력')), JSON.stringify(yj2 && { s: yj2.status, r: yj2.reasons, c: yj2.cautions }))
  }

  // ── 11. 청년도약 5인 이상 우선지원대상기업 ──
  {
    const small = rowOf(diagnoseHiring({ ...BASE_ANSWERS, companySize: 3 }, PROGRAM_LIST), 'youth_jump')
    check('청년도약: 피보험자 3명 → 가능성 높음으로 올리지 않고 ★', !!small && small.status === 'maybe' && small.cautions.some((c) => c.includes('5인 미만')), JSON.stringify(small && { s: small.status, c: small.cautions }))
    const unknown = rowOf(diagnoseHiring({ ...BASE_ANSWERS, companySize: null }, PROGRAM_LIST), 'youth_jump')
    check('청년도약: 규모 모름 → ★ 확인 문구', !!unknown && unknown.cautions.some((c) => c.includes('회사 규모 미입력')))
    const ok10 = rowOf(diagnoseHiring(BASE_ANSWERS, PROGRAM_LIST), 'youth_jump')
    check('청년도약: 10명이면 그대로 가능성 높음', !!ok10 && ok10.status === 'recommend' && ok10.cautions.length === 0)
  }

  // ── 3·4. 명부: 생년월일 칸이 날짜면 날짜로 · 이름 먼저 배치 ──
  {
    const grid = textToGrid(['성명,생년월일,자격취득일', '홍길동,1995-01-15,2026-01-05', '김영희,19880202,2025.07.01', '박철수,34714,2025-01-01', '이서준,1995.01.15,2025-02-01'].join('\n'))
    const emps = extractEmployees(grid, detectRoster(grid))
    check('명부: 생년월일 1995-01-15 → 그대로 (주민번호로 읽지 않음)', emps[0].birthDate === '1995-01-15' && emps[0].gender === null && emps[0].rrnMasked === null, JSON.stringify(emps[0]))
    check('명부: 19880202 · 엑셀 날짜 · 점 표기', emps[1].birthDate === '1988-02-02' && emps[2].birthDate === '1995-01-15' && emps[3].birthDate === '1995-01-15', JSON.stringify(emps.map((e) => e.birthDate)))
    check('명부: 칸 값 종류', idCellKind('950115-1******') === 'rrn' && idCellKind('9501151') === 'rrn' && idCellKind('9501151234567') === 'rrn' && idCellKind('1995-01-15') === 'date' && idCellKind('19950115') === 'date' && idCellKind('abc') === 'none')
  }
  {
    const nameFirst = ['성명 주민등록번호 국민연금 건강보험 산재보험 고용보험', '홍길동 980310-1****** 2026-01-05 2026-01-05 2026-01-05 2026-01-05', '김영희 860201-2****** 2020-03-01 2020-03-01 - -', '박철수 900101-1234567 2025.08.01 2025.08.01 2025.08.01 2025.08.01']
    for (const [label, text] of [['줄 나눔', nameFirst.join('\n')], ['한 줄', nameFirst.join(' ')]] as const) {
      const r = parseRosterText(text)
      const e = r.employees
      check(`명부 이름 먼저(${label}): 이름이 제자리`, e.length === 3 && e[0].name === '홍길동' && e[1].name === '김영희' && e[2].name === '박철수', JSON.stringify(e.map((x) => x.name)))
      check(`명부 이름 먼저(${label}): 입사일이 제자리`, e[0]?.hireDate === '2026-01-05' && e[1]?.hireDate === '2020-03-01' && e[2]?.hireDate === '2025-08-01', JSON.stringify(e.map((x) => x.hireDate)))
      check(`명부 이름 먼저(${label}): 보험 칸`, !!e[1]?.ins && e[1].ins.np && e[1].ins.hi && !e[1].ins.wc && !e[1].ins.ei && !!e[0]?.ins && e[0].ins.ei, JSON.stringify(e.map((x) => x.ins)))
      check(`명부 이름 먼저(${label}): 생년월일·성별 · 뒷자리 없음`, e[2]?.birthDate === '1990-01-01' && e[2]?.gender === 'M' && e[1]?.gender === 'F' && JSON.stringify(r).indexOf('1234567') < 0)
    }
    const glued = parseRosterText('980310-1****** 2026-01-05 2026-01-05 2026-01-05 2026-01-05 홍길동')
    check('명부: 가린 번호 뒤 날짜를 번호에 붙이지 않는다', glued.employees[0]?.hireDate === '2026-01-05' && glued.employees[0]?.name === '홍길동', JSON.stringify(glued.employees[0]))
    const glued2 = parseRosterText('홍길동 980310-1234567 2026-01-05 2026-01-05 2026-01-05 2026-01-05')
    check('명부: 전체 번호 뒤 날짜도 온전', glued2.employees[0]?.hireDate === '2026-01-05' && glued2.employees[0]?.name === '홍길동', JSON.stringify(glued2.employees[0]))
  }

  // ── 5·6·9. 급여 · 최저임금 ──
  check('최저임금: 2,156,879원 · 40시간 → 미달', checkWage(2156879, 40)?.isAboveMin === false && checkWage(2156879, 40)?.hourlyWage === 10319, JSON.stringify(checkWage(2156879, 40)))
  check('최저임금: 2,156,880원 · 40시간 → 충족', checkWage(2156880, 40)?.isAboveMin === true)
  check('최저임금: 급여 계산기도 같은 판정', computePayroll(2156879, 40, 1)?.isAboveMin === false && computePayroll(2156880, 40, 1)?.isAboveMin === true)
  check('최저임금: 음수 급여는 계산 안 함', checkWage(-100, 40) === null)

  // ── 7. 세액공제 ──
  {
    const e = estimateTaxCredit({ prevTotal: 10, curTotal: 11, prevYouth: 0, curYouth: 3, unitYouth: 1450, unitNormal: 850 })
    check('세액공제: 청년 증가는 전체 증가를 넘지 않는다', e.incYouth === 1 && e.incNormal === 0 && e.creditYouth === 14500000 && e.creditTotal === 14500000 && e.overYouth, JSON.stringify(e))
  }
  {
    const young = classifyEmployee({ ...ROSTER[0], birthDate: '1991-03-01', hireDate: '2026-01-05' }, { baseDate: BASE })
    check('세액공제·명부: 입사 때 34세면 청년 (지금 35세여도)', young.age === 35 && young.hireAge === 34 && young.isYouth, JSON.stringify({ a: young.age, h: young.hireAge, y: young.isYouth }))
    const older = classifyEmployee({ ...ROSTER[0], birthDate: '1990-12-01', hireDate: '2026-04-01' }, { baseDate: BASE })
    check('명부: 입사 때 35세 남성 → 청년 아님 · 복무 확인 ★', !older.isYouth && older.candidates.some((c) => c.key === 'youth_jump' && c.level === 'more' && c.note.includes('★')))
  }

  // ── 8·12. 날짜 ──
  check('날짜: 1월 31일 + 1개월 = 2월 28일', addMo('2026-01-31', 1) === '2026-02-28', addMo('2026-01-31', 1))
  check('날짜: 윤년 1월 31일 + 1개월 = 2월 29일', addMo('2028-01-31', 1) === '2028-02-29')
  check('날짜: 2월 29일 + 12개월 = 2월 28일', addMo('2024-02-29', 12) === '2025-02-28', addMo('2024-02-29', 12))
  check('날짜: 8월 31일 + 6개월 = 2월 28일 · 3월 31일 - 1개월', addMo('2025-08-31', 6) === '2026-02-28' && addMo('2026-03-31', -1) === '2026-02-28')
  check("날짜: '2026.1.15' · '2026-1-5' · 시각 붙은 값", addMo('2026.1.15', 6) === '2026-07-15' && addMo('2026-1-5', 1) === '2026-02-05' && addMo('2026-01-15T10:30:00', 6) === '2026-07-15' && toYMD('2026년 1월 15일') === '2026-01-15', addMo('2026.1.15', 6))
  check("날짜: '2026.1.15' D-day 가 하루 앞당겨지지 않는다", getDdayFrom('2026.1.15', new Date(2026, 0, 15, 23, 30)) === 0 && getDdayFrom('2026-01-15', new Date(2026, 0, 15, 0, 5)) === 0 && getDdayFrom('2026-01-16', new Date(2026, 0, 15, 23, 59)) === 1)
  {
    const sch = roundSchedule('2026.1.15', DEFAULT_PROGRAMS.youth_jump, new Date(2026, 6, 10, 9, 0), [false, false, false])
    check("날짜: '2026.1.15' 입사 → 1회차 2026-07-15 · D-5", sch.rows[0].date === '2026-07-15' && sch.rows[0].dday === 5, JSON.stringify(sch.rows[0]))
  }
  {
    let threw = false
    let out: unknown[] = []
    try {
      out = [addMo('2026-02-31', 1), addMo('abc', 3), addMo('2026-13-01', 1), getDdayFrom('abc', new Date()), fD('abc'), calcAgeDetailed('abc', '2026-01-01'), roundSchedule('abc', DEFAULT_PROGRAMS.youth_jump, new Date()).rows[0].dday, simulate(DEFAULT_PROGRAMS.youth_jump, 1, 'abc').monthly.length]
    } catch {
      threw = true
    }
    check('날짜: 잘못된 날짜는 던지지 않고 빈값', !threw && out[0] === '' && out[1] === '' && out[2] === '' && out[3] === null && out[4] === '' && out[5] === null && out[6] === null && out[7] === 3, JSON.stringify(out))
  }
  check('날짜: 명부 normDate 는 2026-02-31 을 거른다', normDate('2026-02-31') === null && normDate('2024-02-29') === '2024-02-29' && normDate('2025-02-29') === null && xlNormDate('2026-02-31').ok === false)
  check('날짜: parseJumin 은 없는 날짜를 거른다', parseJumin('9513011') === null && parseJumin('9502301') === null)
  check('날짜: 명부 발급 경과일은 시간대와 무관', rosterStaleness('2026-05-20', new Date(2026, 5, 1, 0, 0))?.days === 12 && rosterStaleness('2026-05-20', new Date(2026, 5, 1, 23, 59))?.days === 12)
  check('날짜: 월별 수령은 지급일 달 (1일도)', monthlyReceived([{ ...({} as EmpRecord), id: 'm', clientId: 'c', name: 'x', hireDate: '2026-01-01', birthDate: '', empType: '정규직', programId: 'youth_jump', stage: 'inprogress', docs: [], memo: '', rounds: [{ month: 6, amount: 100, label: '1', isPaid: true, received: 100, paidDate: '2026-07-01' }] }], 2026)[6].received === 100)

  // ── 8. 일괄등록: 주민번호가 없으면 모르는 채로 ──
  {
    const rows = parseBulkPaste(['이름\t주민번호앞7자리\t입사일\t연락처\t이메일\t지원금ID', '김하나\t\t2026.3.2\t010\ta@b.kr\tyouth_jump', '박둘\t9501011\t2026-03-02\t\t\tyouth_jump', '최셋\t9513011\t2026-02-31\t\t\tnone'].join('\n'), { youth_jump: {} })
    check('일괄등록: 주민번호 없으면 생년월일·성별 비움 (2000-01-01·남 아님)', rows[0].birthDate === '' && rows[0].gender === '' && rows[0].startDate === '2026-03-02', JSON.stringify(rows[0]))
    check('일괄등록: 앞 7자리는 생년월일·성별로만', rows[1].birthDate === '1995-01-01' && rows[1].gender === 'male' && JSON.stringify(rows).indexOf('9501011') < 0)
    check('일괄등록: 없는 날짜 · 모르는 지원금', rows[2].birthDate === '' && rows[2].startDate === '' && rows[2].programId === 'youth_jump')
  }

  // ── 12. 급여 글자 읽기 ──
  check('급여 칸: 3,000,000.00 · 2500000.5 · 280만 · 1억2천만 · 음수 · 글자', parseMoneyCell('3,000,000.00') === 3000000 && parseMoneyCell('2500000.5') === 2500000 && parseMoneyCell('280만') === 2800000 && parseMoneyCell('280만 원') === 2800000 && parseMoneyCell('2,800,000원') === 2800000 && parseMoneyCell('1억2천만') === 120000000 && parseMoneyCell('-100') === 0 && parseMoneyCell('abc') === 0 && parseMoneyCell(2800000) === 2800000, [parseMoneyCell('3,000,000.00'), parseMoneyCell('2500000.5'), parseMoneyCell('280만'), parseMoneyCell('1억2천만')].join(','))

  // ── 10. 회차 합 ≠ 규칙표 총액 — 목록을 드러낸다 (금액은 짐작해 고치지 않음 · ★ 표시) ──
  {
    const mismatched = PROGRAM_LIST.filter((p) => roundsMismatch(p)).map((p) => `${p.id}(회차 합 ${roundsSum(p)} / 총액 ${p.totalAmount})`)
    console.log(`  ★ 회차별 금액 확인 필요: ${mismatched.join(' · ')}`)
    check('회차 합 ≠ 총액 목록이 정확히 이 넷', PROGRAM_LIST.filter((p) => roundsMismatch(p)).map((p) => p.id).join() === 'work_exp,disabled_emp,senior_continue,replace_worker', mismatched.join(' · '))
    const sim = simulate(DEFAULT_PROGRAMS.work_exp, 2, '2026-01-01')
    check('시뮬레이터: 1인당 = 회차 합 (총수령액과 같은 숫자) + ★', sim.perPerson === 800000 && sim.total === 1600000 && sim.mismatch && sim.tableTotal === 1400000 && simulationText('미래내일 일경험', 2, sim).includes('★ 회차별 금액 확인 필요'))
    const yj = simulate(DEFAULT_PROGRAMS.youth_jump, 1, '2026-01-01')
    check('시뮬레이터: 청년도약은 회차 합 = 총액', !yj.mismatch && yj.perPerson === 7200000 && yj.total === 7200000 && !simulationText('청년', 1, yj).includes('★'))
  }
}

// ── D-137: 15개 지원금 × 맞는 경우 / 안 맞는 경우 (채용 진단 표) ──
{
  const TYPES = ['정규직', '계약직', '인턴'] as const
  const fails: string[] = []
  const table: string[] = []
  for (const p of PROGRAM_LIST) {
    const m = p.match
    const fit: HiringAnswers = {
      ...BASE_ANSWERS,
      cats: [m.cats[0]],
      specials: m.special ? [m.special[0]] : [],
      age: m.ageMin === 60 ? 62 : m.ageMin === 55 ? 60 : m.ageMax === 34 ? 29 : 40,
      gender: m.gender === 'female' ? 'female' : 'male',
      empType: m.empTypes[0],
      companySize: m.companyMin != null ? m.companyMin + 5 : m.companyMax != null ? Math.min(10, m.companyMax - 1) : 10,
    }
    const row = diagnoseHiring(fit, [p])[0]
    // 맞는 경우: 막는 것 0 · 제외 아님
    if (row.blockers.length || row.status === 'exclude') fails.push(`${p.id} 맞는 경우인데 ${row.status} ${row.blockers.join('/')}`)
    const cases: [string, Partial<HiringAnswers>, boolean][] = []
    if (m.ageMin != null) cases.push(['나이 모자람', { age: m.ageMin - 1 }, true])
    if (m.ageMax != null) cases.push(['나이 넘음', { age: m.milExtend ? 40 : m.ageMax + 1 }, true])
    if (m.gender === 'female') cases.push(['남성', { gender: 'male' }, true])
    const wrongType = TYPES.find((t) => m.empTypes.indexOf(t) < 0)
    if (wrongType) cases.push([`채용형태 ${wrongType}`, { empType: wrongType }, true])
    if (m.companyMax != null) cases.push([`${m.companyMax}인`, { companySize: m.companyMax }, true])
    if (m.companyMin != null) cases.push([`${m.companyMin - 1}인`, { companySize: m.companyMin - 1 }, true])
    if (m.preApply) cases.push(['사전신청 안 함', { preApply: false }, p.id !== 'youth_jump'])
    if (m.bosuFloor) cases.push(['보수 124만 아래', { aboveFloor: false }, true])
    cases.push(['최근 감원', { noLayoff: false }, true])
    let n = 0
    for (const [label, patch, mustBlock] of cases) {
      const r = diagnoseHiring({ ...fit, ...patch }, [p])[0]
      n++
      // 안 맞는 경우: 절대 '가능성 높음' 이 아니다. 막는 조건이면 막는 이유가 적힌다
      if (r.status === 'recommend') fails.push(`${p.id} ${label} → recommend`)
      if (mustBlock && !r.blockers.length) fails.push(`${p.id} ${label} → 막는 이유 없음`)
    }
    table.push(`${p.id}:${row.status}/${n}`)
  }
  console.log(`  15개 표: ${table.join(' ')}`)
  check('15개 지원금이 다 있다', PROGRAM_LIST.length === 15, String(PROGRAM_LIST.length))
  check('15개 × 맞는 경우는 막힘 없음 · 안 맞는 경우는 가능성 높음 아님 + 막는 이유', fails.length === 0, fails.join(' | '))
  // 청년 나이 경계(병역 가산): 34세 통과 · 35세 남 복무 없음 막힘 · 청년 아닌 유형은 청년 지원금 가능성 높음 아님
  const y35 = diagnoseHiring({ ...BASE_ANSWERS, age: 35, milMonths: 0 }, PROGRAM_LIST).find((r) => r.program.id === 'youth_jump')
  check('청년도약 35세 복무 없음 → 막힘', !!y35 && y35.blockers.includes('나이 요건 미충족') && y35.status !== 'recommend')
  const notYouth = diagnoseHiring({ ...BASE_ANSWERS, cats: ['고령자'], age: 62 }, PROGRAM_LIST).find((r) => r.program.id === 'youth_jump')
  check('고령자 62세 → 청년도약 가능성 높음 아님', !!notYouth && notYouth.status !== 'recommend')
}

// ── D-137: 입사일로 본 신청 기한 (대표: '몇 년 전에 입사했는데 대상자로 뜨면 안 된다') ──
{
  const T = '2026-06-15'
  const yj = (hd: string, today = T) => hireWindowOf('youth_jump', hd, today)
  check('기한: 청년도약 3개월 = 입사 3개월 되는 날까지', yj('2026-03-15').state === 'open' && yj('2026-03-15').deadline === '2026-06-15' && yj('2026-03-15').daysLeft === 0)
  check('  하루 지나면 닫힘', yj('2026-03-14').state === 'closed' && hireWindowBlocks(yj('2026-03-14')) && yj('2026-03-14').text.includes('지남'))
  check('  입사 1주 · 입사 예정은 열림', yj('2026-06-08').state === 'open' && yj('2026-07-01').state === 'open')
  check('  2년 전 · 6년 전 입사는 닫힘', yj('2024-06-15').state === 'closed' && yj('2020-03-01').state === 'closed' && yj('2020-03-01').monthsSinceHire === 75)
  check('  말일 입사: 11/30 → 2/28(평년) 까지', yj('2025-11-30', '2026-02-28').state === 'open' && yj('2025-11-30', '2026-03-01').state === 'closed' && yj('2025-11-30').deadline === '2026-02-28')
  check('  말일 입사: 2023-11-30 → 2024-02-29(윤년)', hireWindowOf('youth_jump', '2023-11-30', '2024-02-29').state === 'open' && hireWindowOf('youth_jump', '2023-11-30', '2024-03-01').state === 'closed')
  check('  입사일 모름 · 없는 날짜 → 판단 안 함(unknown)', yj('').state === 'unknown' && yj('2026-02-31').state === 'unknown' && !hireWindowBlocks(yj('')))
  check('  여러 모양 날짜(2026.3.15 · 20260315)', yj('2026.3.15').state === 'open' && yj('20260315').state === 'open')
  check('  고용촉진 12개월', hireWindowOf('emp_promo', '2025-06-15', T).state === 'open' && hireWindowOf('emp_promo', '2025-06-14', T).state === 'closed' && hireWindowOf('emp_promo', '2025-06-14', T).text.includes('★확인'))
  check('  사전 약정 지원금(새일 · 시니어 인턴 · 일경험): 이미 채용 → 막힘 · 채용 예정 → 열림', ['saeil_women', 'senior_intern', 'work_exp'].every((k) => hireWindowOf(k, '2026-06-01', T).state === 'preOnly' && hireWindowOf(k, '2026-06-15', T).state === 'preOnly' && hireWindowOf(k, '2026-07-01', T).state === 'open'))
  check('  입사일과 상관없는 지원금(계속고용 · 육아 · 고용유지 등) → na', ['senior_continue', 'parental_leave', 'emp_retention', 'worklife45', 'disabled_emp'].every((k) => hireWindowOf(k, '2010-01-01', T).state === 'na' && !hireWindowBlocks(hireWindowOf(k, '2010-01-01', T))))
  check('  대표 확인한 기준은 청년도약 3개월 하나(나머지 ★)', Object.entries(HIRE_WINDOWS).filter(([, r]) => r.confirmed).map(([k]) => k).join() === 'youth_jump')
  check('  꽉 찬 개월: 1/31→2/28 = 1 · 3/15→6/14 = 2 · 앞날 = 0', fullMonthsSince('2026-01-31', '2026-02-28') === 1 && fullMonthsSince('2026-03-15', '2026-06-14') === 2 && fullMonthsSince('2026-07-01', '2026-06-15') === 0)
  check('  Date 로 넘겨도 같은 날(현지 기준)', hireWindowOf('youth_jump', '2026-03-15', new Date(2026, 5, 15, 23, 59)).state === 'open' && hireWindowOf('youth_jump', '2026-03-15', new Date(2026, 5, 16, 0, 1)).state === 'closed')

  // 청년 자격요건(직원 한 명 화면) — 기한 지나면 '대상자 예상' 이 나오지 않는다. 이미 참여 중이면 회차대로
  const g = (hireDate: string, enrolled = false) => youthGate({ birthDate: '1998-03-10', gender: 'female', milMonths: 0, elig: { e1: true }, excl: ALL_EXCL_OK, hireDate, today: T, enrolled })
  check('자격요건: 입사 1개월 → 대상자 예상', g('2026-05-15').ok && !g('2026-05-15').hireWindowBlocked)
  check('자격요건: 입사 2년 → 대상자 아님(기한 지남 문구)', !g('2024-06-01').ok && g('2024-06-01').hireWindowBlocked && g('2024-06-01').hireWindowText.includes('기한'))
  check('자격요건: 입사 2년이어도 이미 참여 중이면 막지 않음', g('2024-06-01', true).ok && !g('2024-06-01', true).hireWindowBlocked)
}

// ── D-137: 무작위 명부 500명 × 기준일 여럿 — 기한 지난 사람이 후보로 나오지 않는다 ──
{
  let seed = 137
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const pad = (n: number) => String(n).padStart(2, '0')
  const rdate = (y0: number, y1: number) => { const y = y0 + Math.floor(rnd() * (y1 - y0 + 1)); const mo = 1 + Math.floor(rnd() * 12); const d = 1 + Math.floor(rnd() * 31); return `${y}-${pad(mo)}-${pad(Math.min(d, new Date(y, mo, 0).getDate()))}` }
  const bases = ['2026-01-31', '2026-03-01', '2026-06-15', '2026-09-29', '2026-12-31']
  const bad: string[] = []
  let youthCand = 0, youthExp = 0, total = 0
  for (const b of bases) {
    const emps: RosterEmployee[] = []
    for (let i = 0; i < 100; i++) {
      const gender = rnd() < 0.5 ? 'M' : 'F'
      const hireDate = rnd() < 0.08 ? null : rnd() < 0.4 ? rdate(2026, 2026) : rdate(2010, 2025)
      emps.push({ name: `직원${i}`, birthDate: rdate(1955, 2006), gender, rrnMasked: null, hireDate, loseDate: null, statusRaw: '취득', insuranceRaw: '국민·건강·산재·고용', workplace: '', bizNo: '', ins: { np: true, hi: true, wc: true, ei: true }, insKnown: { np: true, hi: true, wc: true, ei: true } })
    }
    for (const e of emps) {
      total++
      const d = classifyEmployee(e, { baseDate: b })
      for (const c of d.candidates) {
        const w = hireWindowOf(c.key, e.hireDate, b)
        if (hireWindowBlocks(w)) bad.push(`${b} ${e.hireDate} ${c.key}`)
        if (c.key === 'youth_jump' && e.hireDate && (fullMonthsSince(e.hireDate, b) ?? 0) >= 4) bad.push(`${b} 청년 ${e.hireDate} 입사 ${fullMonthsSince(e.hireDate, b)}개월`)
        if (c.key === 'emp_promo' && e.hireDate && (fullMonthsSince(e.hireDate, b) ?? 0) >= 13) bad.push(`${b} 고용촉진 ${e.hireDate}`)
        if (c.key === 'emp_promo' && !e.hireDate) bad.push(`${b} 고용촉진 입사일 모름`)
        if ((c.key === 'saeil_women' || c.key === 'senior_intern') && e.hireDate && e.hireDate <= b) bad.push(`${b} ${c.key} 이미 채용 ${e.hireDate}`)
        if (!e.hireDate && c.level !== 'more' && HIRE_WINDOWS[c.key]?.enrollMonths != null) bad.push(`${b} 입사일 모름인데 ${c.key}:${c.level}`)
        if (c.key === 'youth_jump') youthCand++
      }
      if (d.expired.some((c) => c.key === 'youth_jump')) youthExp++
      if (d.expired.some((c) => d.candidates.some((k) => k.key === c.key))) bad.push(`${b} 후보와 뺀 목록에 같은 지원금`)
    }
    const a = analyzeRoster(emps, { baseDate: b })
    const cand = a.subsidySummary.find((s) => s.key === 'youth_jump')
    const recount = emps.map((e) => classifyEmployee(e, { baseDate: b })).filter((d) => d.active && d.candidates.some((c) => c.key === 'youth_jump' && c.level !== 'more')).length
    if (cand && cand.candidateCount !== recount) bad.push(`${b} 요약 청년도약 ${cand.candidateCount} ≠ ${recount}`)
  }
  console.log(`  무작위 명부 ${total}명: 청년도약 후보 ${youthCand} · 기한 지나 뺌 ${youthExp}`)
  check('무작위 명부 500명: 기한 지난 사람은 어떤 지원금 후보에도 없다', bad.length === 0, bad.slice(0, 8).join(' | '))
  check('무작위 명부: 청년도약 후보와 뺀 사람이 둘 다 나온다(시험이 헛돌지 않음)', youthCand > 0 && youthExp > 0, `${youthCand}/${youthExp}`)
}

// ── D-138: 명부 → 참여신청 기한 · 직원 등록 · 등록 직원 기한 ──
{
  const T = '2026-09-29'
  const mk = (name: string, birthDate: string, gender: 'M' | 'F', hireDate: string | null, statusRaw = '취득'): RosterEmployee => ({ name, birthDate, gender, rrnMasked: null, hireDate, loseDate: null, statusRaw, insuranceRaw: '국민·건강·산재·고용', workplace: '', bizNo: '', ins: { np: true, hi: true, wc: true, ei: true }, insKnown: { np: true, hi: true, wc: true, ei: true } })
  const roster = [
    mk('가청년', '1998-03-10', 'M', '2026-08-03'),
    mk('나청년', '2000-05-10', 'F', '2026.7.1'),
    mk('다오래', '1999-01-01', 'M', '2023-03-02'),
    mk('라모름', '1999-01-01', 'M', null),
    mk('마고령', '1965-05-01', 'M', '2026-08-01'),
    mk('바퇴사', '1999-01-01', 'F', '2026-08-15', '상실'),
    mk('사예정', '2001-02-02', 'M', '2026-10-15'),
  ]
  const a = analyzeRoster(roster, { baseDate: T })
  const items = youthEnrollItems(a.rows, T)
  check('명부 → 참여신청: 기한 안 · 재직 · 입사일 아는 청년만(오래된 · 모름 · 고령 · 상실 뺌)', items.map((i) => i.name).join() === '나청년,가청년,사예정', items.map((i) => `${i.name}:${i.daysLeft}`).join())
  check('  기한이 가까운 사람부터 · 날짜 모양 맞춤(2026.7.1 → 2026-07-01)', items[0].name === '나청년' && items[0].hireDate === '2026-07-01' && items[0].deadline === '2026-10-01' && items[0].daysLeft === 2)
  check('  입사 예정은 입사 후 3개월까지', items[2].deadline === '2027-01-15' && items[2].gender === 'male')
  const dl = youthEnrollDeadlines(items)
  check('  업체에 붙일 기한: 사람마다 하나 · 도구 기한(todo 아님 — 다시 붙이면 바뀜) · 이름과 입사일', dl.length === 3 && dl.every((d) => !('todo' in d) && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) && dl[0].title === '청년도약 참여신청 — 나청년' && dl[0].note.includes('2026-07-01'))
  const existing = [{ id: 'e1', companyId: 'c1', name: '나 청년', startDate: '2026-07-01' }, { id: 'e2', companyId: 'c2', name: '가청년', startDate: '2026-08-03' }]
  const todo = notYetRegistered(items, existing, 'c1')
  check('  이미 같은 업체에 같은 이름 + 입사일이면 다시 만들지 않음(다른 업체는 상관없음)', todo.map((i) => i.name).join() === '가청년,사예정')
  const rec = youthEmployeeRecord(items[1], 'c1', DEFAULT_PROGRAMS.youth_jump as never, 'emp-1')
  check('  등록 모양: 청년도약 · 준비 · 회차 3개 · 720만 · 서류', rec.programId === 'youth_jump' && rec.status === 'preparing' && (rec.rounds as unknown[]).length === 3 && rec.totalExpected === 7200000 && (rec.employeeDocs as unknown[]).length > 0 && rec.startDate === '2026-08-03')
  const row = employeeRowData(rec)
  const back = toOrigEmployee({ id: 'emp-1', clientId: 'c1', data: row })
  check('  모듈 기록으로 저장 → 원본 화면이 같은 직원으로 읽음', back.name === '가청년' && back.status === 'preparing' && back.startDate === '2026-08-03' && back.companyId === 'c1' && row.hireDate === '2026-08-03' && row.stage === 'preparing')
  check('  주민번호 모양은 기록에 없음', !JSON.stringify(row).match(/\d{6}-\d{7}/))

  // 등록 직원 배지
  check('등록 직원: 준비 · 빈 상태만 기한을 본다', notEnrolledYet('preparing') && notEnrolledYet('') && notEnrolledYet(undefined) && !notEnrolledYet('submitted') && !notEnrolledYet('approved'))
  const w1 = enrollWindowOf('youth_jump', '2026-08-03', 'preparing', T)
  check('  청년도약 입사 2개월 → 참여신청 D-35 (11/03까지)', !!w1 && enrollBadgeText(w1) === '참여신청 D-35 (11/03까지)', w1 ? enrollBadgeText(w1) : 'null')
  const w2 = enrollWindowOf('youth_jump', '2024-01-02', 'preparing', T)
  check('  입사 2년 · 준비 → 참여신청 기한 지남', !!w2 && enrollBadgeText(w2) === '참여신청 기한 지남')
  check('  이미 신청(접수)했으면 · 입사일과 상관없는 지원금이면 · 입사일 모르면 → 표시 없음', enrollWindowOf('youth_jump', '2024-01-02', 'submitted', T) === null && enrollWindowOf('parental_leave', '2010-01-01', 'preparing', T) === null && enrollWindowOf('youth_jump', '', 'preparing', T) === null)
  const w3 = enrollWindowOf('saeil_women', '2026-09-01', 'preparing', T)
  check('  새일 인턴을 이미 채용한 뒤 준비로 등록 → 채용 전 약정 필요', !!w3 && enrollBadgeText(w3) === '채용 전 약정 필요')
}

console.log(`\nemployment: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
