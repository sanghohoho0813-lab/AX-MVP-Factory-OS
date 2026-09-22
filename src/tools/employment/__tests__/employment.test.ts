/**
 * 고용지원금 도구 — 특성화(characterization) 시험.
 *
 * 원본(고용지원금 매니저 Pro)의 표·계산식이 옮기는 동안 한 글자도 안 바뀌었는지 못 박는다.
 * 실행: npm run test:employment
 */
import { BOSU_FLOOR_2026, DIAG_CATS, ELIG, EXCL, MIN_WAGE_2026, MIN_WAGE_MONTH_2026, STS } from '../lib/constants'
import { COMPANY_DEFAULT_DOCS, DEFAULT_PROGRAMS, PROGRAM_CHECKLISTS, PROGRAM_ENABLED_DEFAULTS, PROGRAM_LIST, type Program } from '../lib/programs'
import { addMo, calcAgeDetailed, calcMilitaryLimit, formatDday, getDdayFrom, parseJumin } from '../lib/dates'
import { fMan, fProgramAmt, fmtBizNo, fmtPhone, clampMoney, clampRate } from '../lib/format'
import { buildAnswers, checkWage, diagnoseHiring, youthGate, type HiringAnswers } from '../lib/eligibility'
import { computePayroll } from '../lib/payroll'
import { buildRounds, roundDate, roundSchedule, sumReceived, sumRemaining } from '../lib/schedule'
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
  parseRosterText,
  ROSTER_FIELDS,
  rosterStaleness,
  SUBSIDY_DEFS,
  SUBSIDY_MAX_PER_PERSON,
  TAX_CHECKLIST,
  textToGrid,
  detectRoster,
  extractEmployees,
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
check('calcMilitaryLimit 18개월', (() => {
  const m = calcMilitaryLimit(18)
  return m.maxTotalMonths === 426 && m.maxYears === 35 && m.maxRemainMonths === 6 && m.isBorderline === true
})())
check('calcMilitaryLimit 상한 39*12', calcMilitaryLimit(100).maxTotalMonths === 39 * 12 && calcMilitaryLimit(100).maxYears === 39)
check('calcMilitaryLimit 0', calcMilitaryLimit(0).maxTotalMonths === 408 && calcMilitaryLimit(0).isBorderline === false)
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
check('computePayroll 300만/40h/부양0', (() => {
  const r = computePayroll(3000000, 40, 0)
  if (!r) return false
  const monthly = 3000000
  const pensionBase = Math.min(monthly, 5900000)
  const pension = Math.round(pensionBase * 0.045)
  const health = Math.round(monthly * 0.03545)
  const care = Math.round(health * 0.1295)
  const employ = Math.round(monthly * 0.009)
  const injury = Math.round(monthly * 0.0143)
  const annual = monthly * 12
  const emDed = 7500000 + (annual - 15000000) * 0.15
  const taxBase = Math.max(0, annual - emDed - 1500000 * 1)
  const annTax = 840000 + (taxBase - 14000000) * 0.15
  const credit = Math.min(annTax <= 1300000 ? annTax * 0.55 : 715000 + (annTax - 1300000) * 0.3, 740000)
  const incomeTax = Math.max(0, Math.round((annTax - credit) / 12))
  const localTax = Math.round(incomeTax * 0.1)
  return (
    r.pension_ee === pension &&
    r.pension_ee === 135000 &&
    r.health_ee === health &&
    r.care_ee === care &&
    r.employ_ee === employ &&
    r.total4_ee === pension + health + care + employ &&
    r.pension_er === pension &&
    r.injury_er === injury &&
    r.total4_er === pension + health + care + employ + injury &&
    r.incomeTax === incomeTax &&
    r.incomeTax === 131458 &&
    r.localTax === localTax &&
    r.netPay === monthly - r.total4_ee - incomeTax - localTax &&
    r.totalEmployerCost === monthly + r.total4_er &&
    r.hourlyWage === 14354 &&
    r.isAboveMin
  )
})(), JSON.stringify(computePayroll(3000000, 40, 0)))
check('computePayroll 연금 상한 590만', (() => {
  const r = computePayroll(8000000, 40, 1)
  return !!r && r.pension_ee === Math.round(5900000 * 0.045)
})())
check('computePayroll 저소득 구간(연 500만 이하 70%)', (() => {
  const r = computePayroll(400000, 40, 1)
  return !!r && r.incomeTax === 0 && r.localTax === 0
})())
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
  check('youth_jump 사전신청 안 함 → reason(예외)', rowOf(rows4, 'youth_jump')?.reasons.indexOf('사전신청 원칙(입사 3개월 내 예외)') >= 0 && rowOf(rows4, 'youth_jump')?.blockers.length === 0)
  check('work_exp 사전신청 안 함 → blocker', rowOf(rows4, 'work_exp')?.blockers.indexOf('사전신청 필수') >= 0)
}

// ── youthGate ───────────────────────────────────────────
const ALL_ELIG_NONE: Record<string, boolean> = {}
const ALL_EXCL_OK: Record<string, boolean> = { x1: true, x2: true, x3: true, x4: true, x5: true }
{
  const g = youthGate({ birthDate: '1991-01-15', gender: 'male', milMonths: 18, elig: { e3: true }, excl: ALL_EXCL_OK, hireDate: '2026-06-01' })
  check('youthGate 경계선 (35세4개월 · 군 18개월)', g.age === 35 && g.ageOk && g.nearBorder && g.ok && g.maxLabel === '만35세6개월', JSON.stringify(g))
  const g2 = youthGate({ birthDate: '1991-01-15', gender: 'male', milMonths: 0, elig: { e3: true }, excl: ALL_EXCL_OK, hireDate: '2026-06-01' })
  check('youthGate 군복무 없으면 미충족', !g2.ageOk && !g2.ok && !g2.nearBorder && g2.maxLabel === '만34세')
  const g3 = youthGate({ birthDate: '1998-03-10', gender: 'female', milMonths: 0, elig: ALL_ELIG_NONE, excl: ALL_EXCL_OK, hireDate: '2026-06-01' })
  check('youthGate 취업애로 0개 → ok false', g3.ageOk && !g3.anyElig && !g3.ok)
  const g4 = youthGate({ birthDate: '1998-03-10', gender: 'female', milMonths: 0, elig: { e1: true }, excl: { ...ALL_EXCL_OK, x2: false }, hireDate: '2026-06-01' })
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
  { name: '홍길동', birthDate: '1998-03-10', gender: 'M', rrnMasked: '980310-1******', hireDate: '2026-01-05', loseDate: null, statusRaw: '취득', insuranceRaw: '국민·건강·산재·고용', workplace: '', bizNo: '', ins: { np: true, hi: true, wc: true, ei: true }, insKnown: { np: true, hi: true, wc: true, ei: true } },
  { name: '박노인', birthDate: '1965-05-01', gender: 'M', rrnMasked: '650501-1******', hireDate: '2015-01-01', loseDate: null, statusRaw: '취득', insuranceRaw: '국민·건강·산재·고용', workplace: '', bizNo: '', ins: { np: true, hi: true, wc: true, ei: true }, insKnown: { np: true, hi: true, wc: true, ei: true } },
  { name: '김영희', birthDate: '1986-02-01', gender: 'F', rrnMasked: '860201-2******', hireDate: '2020-03-01', loseDate: null, statusRaw: '취득', insuranceRaw: '국민·건강', workplace: '', bizNo: '', ins: { np: true, hi: true, wc: false, ei: false }, insKnown: { np: true, hi: true, wc: true, ei: true } },
]
{
  const d0 = classifyEmployee(ROSTER[0], { baseDate: BASE })
  check('classify 청년 28세 · 신규입사', d0.age === 28 && d0.isYouth && d0.recentHire && d0.active && d0.eiOn && !d0.insPartial && !d0.relSuspect)
  check('  후보 youth_jump(check) · emp_promo(more)', d0.candidates.map((c) => `${c.key}:${c.level}`).join() === 'youth_jump:check,emp_promo:more')
  const d1 = classifyEmployee(ROSTER[1], { baseDate: BASE })
  check('classify 61세 → senior_continue·senior_intern', d1.age === 61 && d1.isSenior && d1.candidates.map((c) => c.key).join() === 'senior_continue,senior_intern' && d1.candidates.every((c) => c.level === 'check'))
  const d2 = classifyEmployee(ROSTER[2], { baseDate: BASE })
  check('classify 여성 40세 · 고용/산재 미가입', d2.age === 40 && d2.isFemale && d2.eiNeedsCheck && d2.wcNeedsCheck && d2.insPartial && d2.onlyNpHi && d2.relSuspect && d2.insMissingCount === 2)
  check('  후보 saeil_women(check) + 확인 문구', d2.candidates.length === 1 && d2.candidates[0].key === 'saeil_women' && d2.candidates[0].level === 'check' && d2.candidates[0].note.indexOf('고용보험 피보험자격 확인 필요') >= 0 && d2.candidates[0].note.indexOf('특수관계자·대표자·임원 여부 확인 필요') >= 0)
  const d3 = classifyEmployee({ ...ROSTER[0], rel: 'ceo' }, { baseDate: BASE })
  check('classify 대표자 표시 → level more', d3.relMarked && d3.candidates[0].level === 'more')
  const d4 = classifyEmployee({ ...ROSTER[0], statusRaw: '상실' }, { baseDate: BASE })
  check('classify 상실 → active false', !d4.active)

  const a = analyzeRoster(ROSTER, { baseDate: BASE })
  check('analyzeRoster counts', a.counts.totalEmp === 3 && a.counts.activeCount === 3 && a.counts.youthCount === 1 && a.counts.seniorCount === 1 && a.counts.generalCount === 2 && a.counts.newHireCount === 1, JSON.stringify(a.counts))
  check('analyzeRoster 확인 필요 인원', a.eiCheckCount === 1 && a.wcCheckCount === 1 && a.partialInsCount === 1 && a.relCheckCount === 1)
  check('analyzeRoster 후보 지원금 4건', a.candidateSubsidyCount === 4 && a.checkItemCount === 5, `${a.candidateSubsidyCount}/${a.checkItemCount}`)
  const yj = a.subsidySummary.find((s) => s.key === 'youth_jump')
  const pa = a.subsidySummary.find((s) => s.key === 'parental')
  check('summary youth_jump check 1 · level check', !!yj && yj.check === 1 && yj.candidateCount === 1 && yj.level === 'check' && yj.confidence === 'more')
  check('summary parental 는 항상 more', !!pa && pa.level === 'more' && pa.candidateCount === 0)
  check('estimateSubsidyTotal', estimateSubsidyTotal(a.subsidySummary) === (1200 + 720 + 240 + 380) * 10000)
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
check('SUBSIDY_MAX_PER_PERSON', SUBSIDY_MAX_PER_PERSON.youth_jump === 1200 && SUBSIDY_MAX_PER_PERSON.saeil_women === 380 && SUBSIDY_MAX_PER_PERSON.parental === 0)
check('EMP_DOC_CHECKLIST 7 · TAX_CHECKLIST 7', EMP_DOC_CHECKLIST.length === 7 && TAX_CHECKLIST.length === 7 && TAX_CHECKLIST[6] === '세무대리인(세무사) 최종 검토 필요')
check('ROSTER_FIELDS 9', ROSTER_FIELDS.length === 9 && ROSTER_FIELDS[0].key === 'name' && ROSTER_FIELDS[1].aliases.indexOf('주민(앞)') >= 0)

console.log(`\nemployment: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
