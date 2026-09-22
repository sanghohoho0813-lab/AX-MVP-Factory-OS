/**
 * 고용지원금 규칙표 — DEFAULT_PROGRAMS 15개.
 *
 * 원본(SubsidyApp.jsx 60~107 줄)에서 이름·금액·회차·서류·note·match 를 글자 하나 바꾸지 않고 옮겼다.
 * 진단(eligibility.ts)·회차 일정(schedule.ts)이 전부 이 표만 읽는다.
 */

import type { ProgramGroup } from './constants'

export type EmpType = '정규직' | '계약직' | '인턴' | '대체인력'
export type Gender = 'male' | 'female'

export interface ProgramRound {
  month: number
  amount: number
  label: string
}

export interface ProgramMatch {
  cats: string[]
  ageMin: number | null
  ageMax: number | null
  milExtend?: boolean
  gender: Gender | 'any'
  empTypes: EmpType[]
  preApply: boolean
  companyMin?: number | null
  companyMax: number | null
  regionSensitive: boolean
  bosuFloor: boolean
  special?: string[]
  deprecated?: boolean
}

export interface Program {
  id: string
  name: string
  year: number
  group: ProgramGroup
  color: string
  totalAmount: number
  rounds: ProgramRound[]
  companyDocs: string[]
  employeeDocs: string[]
  hasEligibility?: boolean
  isCustom: boolean
  isBuiltIn: boolean
  note: string
  applyUrl: string
  match: ProgramMatch
}

export const DEFAULT_PROGRAMS: Record<string, Program> = {
  youth_jump: {
    id: 'youth_jump',
    name: '청년일자리도약장려금',
    year: 2026,
    group: '신규채용',
    color: '#1D4ED8',
    totalAmount: 7200000,
    rounds: [
      { month: 6, amount: 3600000, label: '1차(6개월)' },
      { month: 9, amount: 1800000, label: '2차(9개월)' },
      { month: 12, amount: 1800000, label: '3차(12개월)' },
    ],
    companyDocs: ['사업자등록증', '사업참여신청서', '사업주확인서', '협약서', '기업통장사본', '4대보험가입자명부', '개인정보동의서(사업주)', '고용보험취득확인서'],
    employeeDocs: ['근로계약서', '임금대장(6개월)', '급여이체확인서류', '개인정보동의서(근로자)', '최종학력확인서(졸업증명서)', '사실증명확인서'],
    hasEligibility: true,
    isCustom: false,
    isBuiltIn: true,
    note: '수도권: 기업 720만(취업애로요건 필수). 비수도권: 기업 720만+청년 근속인센티브 480~720만. 사전신청 후 채용(예외: 입사일 기준 3개월 내). 6개월 유지 후 1차 지급.',
    applyUrl: '고용24(work24.go.kr)',
    match: { cats: ['청년'], ageMin: 15, ageMax: 34, milExtend: true, gender: 'any', empTypes: ['정규직'], preApply: true, companyMax: null, regionSensitive: true, bosuFloor: true },
  },
  work_exp: {
    id: 'work_exp',
    name: '미래내일 일경험',
    year: 2026,
    group: '신규채용',
    color: '#2563EB',
    totalAmount: 1400000,
    rounds: [
      { month: 1, amount: 200000, label: '1개월' },
      { month: 2, amount: 200000, label: '2개월' },
      { month: 3, amount: 200000, label: '3개월' },
      { month: 4, amount: 200000, label: '4개월' },
    ],
    companyDocs: ['사업자등록증', '사업참여신청서', '운영계획서', '협약서', '개인정보동의서'],
    employeeDocs: ['참여신청서', '동의서및서약서', '출근부', '수당지급확인서'],
    isCustom: false,
    isBuiltIn: true,
    note: '인턴형 기준 기업 월20만+멘토수당 별도. 청년 주35만 수당. 기업 고용보험 10인↑(예외 벤처/이노/메인). 청년 미취업·사업자등록 불가.',
    applyUrl: '고용24 / 1811-8447',
    match: { cats: ['청년'], ageMin: 15, ageMax: 34, milExtend: true, gender: 'any', empTypes: ['인턴'], preApply: true, companyMax: null, regionSensitive: false, bosuFloor: false },
  },
  saeil_women: {
    id: 'saeil_women',
    name: '새일여성인턴제',
    year: 2026,
    group: '신규채용',
    color: '#2563EB',
    totalAmount: 4000000,
    rounds: [
      { month: 1, amount: 800000, label: '인턴1개월' },
      { month: 2, amount: 800000, label: '인턴2개월' },
      { month: 3, amount: 800000, label: '인턴3개월' },
      { month: 9, amount: 800000, label: '고용유지1차' },
      { month: 15, amount: 800000, label: '고용유지2차' },
    ],
    companyDocs: ['사업자등록증', '사업참여신청서', '인턴약정서', '협약서', '기업통장사본'],
    employeeDocs: ['구직등록확인서', '근로계약서', '임금대장', '급여이체확인서류'],
    isCustom: false,
    isBuiltIn: true,
    note: '기업 최대 400만. 새일센터 연계·인턴약정 먼저. 고용보험 5인↑~1000인미만. 가족채용 영구배제.',
    applyUrl: '여성새로일하기센터(saeil.mogef.go.kr)',
    match: { cats: ['여성'], ageMin: null, ageMax: null, gender: 'female', empTypes: ['인턴', '정규직'], preApply: true, companyMax: 1000, regionSensitive: false, bosuFloor: false, special: ['경력단절'] },
  },
  emp_promo: {
    id: 'emp_promo',
    name: '고용촉진장려금',
    year: 2026,
    group: '신규채용',
    color: '#0284C7',
    totalAmount: 7200000,
    rounds: [
      { month: 6, amount: 3600000, label: '1회차(6개월)' },
      { month: 12, amount: 3600000, label: '2회차(12개월)' },
    ],
    companyDocs: ['사업자등록증', '고용촉진장려금 지급신청서', '근로계약서', '고용보험확인서'],
    employeeDocs: ['근로계약서', '월별급여대장', '급여이체증빙', '취업지원프로그램 이수증'],
    isCustom: false,
    isBuiltIn: true,
    note: '우선지원/중견 연 720만. 취업지원프로그램 이수자·중증장애인·여성가장 정규직. 보수 124만↑. 12개월 내 첫 신청.',
    applyUrl: '고용24(work24.go.kr)',
    match: { cats: ['취약계층'], ageMin: null, ageMax: null, gender: 'any', empTypes: ['정규직'], preApply: false, companyMax: null, regionSensitive: false, bosuFloor: true, special: ['프로그램이수'] },
  },
  senior_intern: {
    id: 'senior_intern',
    name: '시니어 인턴십',
    year: 2026,
    group: '신규채용',
    color: '#2563EB',
    totalAmount: 5500000,
    rounds: [
      { month: 3, amount: 1200000, label: '1단계(3개월)' },
      { month: 9, amount: 1500000, label: '2단계(6개월)' },
      { month: 18, amount: 900000, label: '3단계(18개월)' },
      { month: 24, amount: 900000, label: '3단계(24개월)' },
      { month: 36, amount: 1000000, label: '3단계(36개월)' },
    ],
    companyDocs: ['사업자등록증', '사업참여신청서', '협약서', '4대보험가입자명부'],
    employeeDocs: ['근로계약서', '사전교육 이수증', '월별급여대장'],
    isCustom: false,
    isBuiltIn: true,
    note: '일반형 최대 550만. 만60세↑. 한국노인인력개발원 사전승인 필수. 요양보호사·경비·청소 등 단순노무 제외.',
    applyUrl: '한국노인인력개발원 / seniorro.or.kr',
    match: { cats: ['고령자'], ageMin: 60, ageMax: null, gender: 'any', empTypes: ['정규직', '인턴'], preApply: true, companyMax: null, regionSensitive: false, bosuFloor: false },
  },
  disabled_emp: {
    id: 'disabled_emp',
    name: '장애인 고용장려금',
    year: 2026,
    group: '신규채용',
    color: '#1E3A5F',
    totalAmount: 5400000,
    rounds: [{ month: 1, amount: 450000, label: '월(예시·중증여)' }],
    companyDocs: ['고용장려금 지급신청서', '장애인 근로자 명부', '근로계약서'],
    employeeDocs: ['장애인증명서', '근로계약서', '월별임금대장'],
    isCustom: false,
    isBuiltIn: true,
    note: '경증 남35/여50, 중증 남70/여90만 매월. 고용보험 가입+최저임금↑ 필수.',
    applyUrl: '한국장애인고용공단 e-신고(esingo.or.kr)',
    match: { cats: ['장애인'], ageMin: null, ageMax: null, gender: 'any', empTypes: ['정규직', '계약직'], preApply: false, companyMax: null, regionSensitive: false, bosuFloor: false, special: ['장애'] },
  },
  regular_convert: {
    id: 'regular_convert',
    name: '정규직 전환 지원금',
    year: 2026,
    group: '재직자유지',
    color: '#475569',
    totalAmount: 7200000,
    rounds: [
      { month: 3, amount: 1800000, label: '1차(3개월)' },
      { month: 6, amount: 1800000, label: '2차(6개월)' },
      { month: 9, amount: 1800000, label: '3차(9개월)' },
      { month: 12, amount: 1800000, label: '4차(12개월)' },
    ],
    companyDocs: ['사업참여신청서', '정규직전환 근로계약서', '사업자등록증', '취업규칙'],
    employeeDocs: ['전환 전 근로계약서', '전환 후 근로계약서', '월별임금대장'],
    isCustom: false,
    isBuiltIn: true,
    note: '기본 월40만+임금인상보전 월20만=연720. 5~30인미만. 2026 예산 한정·상반기 사전승인 필수. 6개월↑ 기간제→정규직. 먼저 전환하면 0원.',
    applyUrl: '고용24(work24.go.kr)',
    match: { cats: ['재직'], ageMin: null, ageMax: null, gender: 'any', empTypes: ['계약직'], preApply: true, companyMax: 30, regionSensitive: false, bosuFloor: true, special: ['정규직전환'] },
  },
  senior_continue: {
    id: 'senior_continue',
    name: '고령자 계속고용 장려금',
    year: 2026,
    group: '재직자유지',
    color: '#475569',
    totalAmount: 7200000,
    rounds: [
      { month: 3, amount: 900000, label: '1분기' },
      { month: 6, amount: 900000, label: '2분기' },
      { month: 9, amount: 900000, label: '3분기' },
      { month: 12, amount: 900000, label: '4분기' },
    ],
    companyDocs: ['지급신청서', '취업규칙(정년 명문화)', '재고용 근로계약서'],
    employeeDocs: ['근로계약서', '월별임금대장'],
    isCustom: false,
    isBuiltIn: true,
    note: '수도권 분기90만 2년 최대720. 비수도권 분기120만 3년 최대1440(2026). 정년연장/폐지/재고용 취업규칙 필수. 100인미만.',
    applyUrl: '고용24(work24.go.kr)',
    match: { cats: ['고령자', '재직'], ageMin: 55, ageMax: null, gender: 'any', empTypes: ['정규직'], preApply: false, companyMax: 100, regionSensitive: true, bosuFloor: false, special: ['정년도달'] },
  },
  worklife45: {
    id: 'worklife45',
    name: '워라밸+4.5 프로젝트',
    year: 2026,
    group: '재직자유지',
    color: '#475569',
    totalAmount: 7200000,
    rounds: [
      { month: 3, amount: 1800000, label: '1분기' },
      { month: 6, amount: 1800000, label: '2분기' },
      { month: 9, amount: 1800000, label: '3분기' },
      { month: 12, amount: 1800000, label: '4분기' },
    ],
    companyDocs: ['노사합의서', '사업참여신청서(재단)', '근태관리 증빙', '취업규칙'],
    employeeDocs: ['변경 근로계약서'],
    isCustom: false,
    isBuiltIn: true,
    note: '기존직원 부분단축 연240/전면단축 연720. 신규채용 보너스 별도. 20인↑. 노사발전재단(nosa.or.kr) 사전신청.',
    applyUrl: '노사발전재단(nosa.or.kr)',
    match: { cats: ['재직'], ageMin: null, ageMax: null, gender: 'any', empTypes: ['정규직'], preApply: true, companyMin: 20, companyMax: null, regionSensitive: false, bosuFloor: false, special: ['주4.5일제'] },
  },
  parental_leave: {
    id: 'parental_leave',
    name: '육아휴직 지원금(사업주)',
    year: 2026,
    group: '육아',
    color: '#059669',
    totalAmount: 3600000,
    rounds: [
      { month: 3, amount: 900000, label: '1차(3개월)' },
      { month: 6, amount: 900000, label: '2차(6개월)' },
      { month: 9, amount: 900000, label: '3차(9개월)' },
      { month: 12, amount: 900000, label: '4차(12개월)' },
    ],
    companyDocs: ['육아휴직 확인서', '사업자등록증', '근로계약서'],
    employeeDocs: ['육아휴직 신청서', '가족관계증명서', '휴직 발령 증빙'],
    isCustom: false,
    isBuiltIn: true,
    note: '사업주 월30만(남성 +10만). 생후12개월내 특례 첫3개월 월100만. 우선지원대상+30일↑ 허용.',
    applyUrl: '고용24(work24.go.kr)',
    match: { cats: ['육아'], ageMin: null, ageMax: null, gender: 'any', empTypes: ['정규직'], preApply: false, companyMax: null, regionSensitive: false, bosuFloor: true, special: ['육아휴직'] },
  },
  parental_reduce: {
    id: 'parental_reduce',
    name: '육아기 근로시간 단축(사업주)',
    year: 2026,
    group: '육아',
    color: '#059669',
    totalAmount: 3600000,
    rounds: [
      { month: 3, amount: 900000, label: '1차(3개월)' },
      { month: 6, amount: 900000, label: '2차(6개월)' },
      { month: 9, amount: 900000, label: '3차(9개월)' },
      { month: 12, amount: 900000, label: '4차(12개월)' },
    ],
    companyDocs: ['근로시간 단축 확인서', '사업자등록증', '변경 근로계약서'],
    employeeDocs: ['단축 신청서', '가족관계증명서', '변경 근로계약서'],
    isCustom: false,
    isBuiltIn: true,
    note: '사업주 월30만(남성 +10만). 근로자 단축급여 월최대250만. 만12세↓ 자녀, 최대3년.',
    applyUrl: '고용24(work24.go.kr)',
    match: { cats: ['육아'], ageMin: null, ageMax: null, gender: 'any', empTypes: ['정규직'], preApply: false, companyMax: null, regionSensitive: false, bosuFloor: true, special: ['근로시간단축'] },
  },
  replace_worker: {
    id: 'replace_worker',
    name: '대체인력 지원금',
    year: 2026,
    group: '육아',
    color: '#047857',
    totalAmount: 21000000,
    rounds: [{ month: 1, amount: 1400000, label: '월(예시·30인미만)' }],
    companyDocs: ['대체인력 채용 증빙', '육아휴직 확인서', '사업자등록증'],
    employeeDocs: ['대체인력 근로계약서', '월별임금대장', '급여이체증빙'],
    isCustom: false,
    isBuiltIn: true,
    note: '육아휴직 대체 30인미만 월최대140(최대15개월=2100). 100% 즉시 선지급. 채용전3개월~후1년 감원 시 전액환수.',
    applyUrl: '고용24 + 인재채움뱅크',
    match: { cats: ['육아'], ageMin: null, ageMax: null, gender: 'any', empTypes: ['계약직', '정규직'], preApply: false, companyMax: null, regionSensitive: false, bosuFloor: true, special: ['대체인력'] },
  },
  work_share: {
    id: 'work_share',
    name: '동료 업무분담 지원금',
    year: 2026,
    group: '육아',
    color: '#059669',
    totalAmount: 600000,
    rounds: [{ month: 1, amount: 600000, label: '월(예시)' }],
    companyDocs: ['업무분담수당 지급 증빙', '육아휴직 확인서'],
    employeeDocs: ['임금명세서(업무분담수당 명시)'],
    isCustom: false,
    isBuiltIn: true,
    note: '육아휴직 분담 30인미만 월최대60(2026 3배인상). 대체인력과 중복불가.',
    applyUrl: '고용24(work24.go.kr)',
    match: { cats: ['육아'], ageMin: null, ageMax: null, gender: 'any', empTypes: ['정규직'], preApply: false, companyMax: null, regionSensitive: false, bosuFloor: false, special: ['업무분담'] },
  },
  emp_retention: {
    id: 'emp_retention',
    name: '고용유지지원금',
    year: 2026,
    group: '재직자유지',
    color: '#475569',
    totalAmount: 6000000,
    rounds: [
      { month: 1, amount: 1500000, label: '1개월' },
      { month: 2, amount: 1500000, label: '2개월' },
      { month: 3, amount: 1500000, label: '3개월' },
      { month: 4, amount: 1500000, label: '4개월' },
    ],
    companyDocs: ['고용유지조치계획서', '사업자등록증', '임금대장', '고용보험 피보험자 명부', '휴업·단축 협약서'],
    employeeDocs: ['고용유지조치 동의서', '월별임금대장', '출근부(단축 확인)'],
    isCustom: false,
    isBuiltIn: true,
    note: '경영 위기 시 해고 대신 휴업·단축 선택 기업 지원. 우선지원 2/3, 대규모 1/2 보전. 연간 최대 180일(고용위기지역 등 특례). 사전 계획 신청 필수.',
    applyUrl: '고용24(work24.go.kr)',
    match: { cats: ['재직'], ageMin: null, ageMax: null, gender: 'any', empTypes: ['정규직', '계약직'], preApply: true, companyMax: null, regionSensitive: false, bosuFloor: true },
  },
  job_sharing: {
    id: 'job_sharing',
    name: '일자리함께하기 지원금',
    year: 2026,
    group: '재직자유지',
    color: '#475569',
    totalAmount: 7200000,
    rounds: [
      { month: 3, amount: 1800000, label: '1분기' },
      { month: 6, amount: 1800000, label: '2분기' },
      { month: 9, amount: 1800000, label: '3분기' },
      { month: 12, amount: 1800000, label: '4분기' },
    ],
    companyDocs: ['사업참여신청서', '노사합의서(단축협약)', '취업규칙', '4대보험 피보험자 명부', '근태관리 증빙'],
    employeeDocs: ['변경 근로계약서', '월별임금대장'],
    isCustom: false,
    isBuiltIn: true,
    note: '재직자 근로시간 단축 후 신규 채용 시 지원. 교대제 도입·심야근로 단축·정년연장형 등 유형별 지원. 우선지원 연최대 720만. 사전승인 필수.',
    applyUrl: '고용24(work24.go.kr)',
    match: { cats: ['재직'], ageMin: null, ageMax: null, gender: 'any', empTypes: ['정규직'], preApply: true, companyMin: null, companyMax: null, regionSensitive: false, bosuFloor: false, special: ['일자리나누기'] },
  },
}

/** 표 순서 그대로의 배열 (진단·선택 목록용) */
export const PROGRAM_LIST: readonly Program[] = Object.values(DEFAULT_PROGRAMS)

/** 기본 활성 지원금 (신규 사용자 기준: 청년일자리도약장려금만 ON) */
export const PROGRAM_ENABLED_DEFAULTS: Record<string, boolean> = { youth_jump: true }

/** 지원금별 확인 체크리스트 */
export const PROGRAM_CHECKLISTS: Record<string, string[]> = {
  youth_jump: ['청년 나이 확인 (만 15~34세, 군복무 연장 적용 가능)', '수도권 사업장: 취업애로요건 최소 1개 해당 여부 확인', '사전신청 완료 여부 (또는 입사 후 3개월 내 사후신청)', '보수 월 124만 원 이상 지급 계획 확인', '6개월 이상 계속 고용 계획', '최근 3개월 내 감원 이력 없음 확인'],
  replace_worker: ['육아휴직·출산전후휴가·근로시간 단축 등 대체인력 발생 사유 확인', '대체인력 채용일 확인', '대체인력 고용보험 가입 여부 확인', '대체 대상 근로자의 휴직·휴가 기간 확인', '대체인력 근무기간 요건 확인', '임금 지급 및 근로계약서 작성 여부 확인', '동일 근로자 중복 지원 여부 확인', '신청 기한 확인'],
  senior_intern: ['연령 요건 확인 (만 60세 이상)', '참여 가능 직무 여부 확인 (단순노무직 제외)', '인턴 약정 기간 확인', '고용보험 가입 여부 확인', '운영기관(한국노인인력개발원) 사전 승인 여부 확인', '기존 근로자 전환 여부 확인', '중복 지원 제한 여부 확인'],
  regular_convert: ['전환 전 고용형태 확인 (6개월↑ 기간제·파견)', '정규직 전환일 확인', '임금 감소 여부 확인', '고용유지 기간 확인', '전환 대상자 중복 지원 여부 확인', '신청 기한 확인', '사전 신청 또는 승인(전환계획서) 필요 여부 확인'],
  senior_continue: ['정년제도 운영 여부 확인', '계속고용제도(연장·폐지·재고용) 도입 여부 확인', '대상 근로자 연령 요건 확인 (만 55세 이상)', '고용유지 여부 확인', '취업규칙 또는 사내규정 정비 여부 확인', '신청 기한 확인', '중복 지원 여부 확인'],
  work_exp: ['신청 대상 사업장 여부 확인 (고용보험 10인↑ 등 요건)', '대상 근로자 요건 확인 (미취업 청년, 사업자등록 없음)', '고용보험 가입 여부 확인', '신청 기한 확인', '중복 지원 제한 여부 확인', '필수 서류 준비 여부 확인', '운영기관(고용24/1811-8447) 기준 추가 확인 필요'],
  saeil_women: ['신청 대상 사업장 여부 확인 (고용보험 5인↑~1000인미만)', '대상 근로자 요건 확인 (경력단절 여성, 새일센터 연계)', '고용보험 가입 여부 확인', '신청 기한 확인', '중복 지원 제한 여부 확인', '필수 서류 준비 여부 확인', '운영기관(여성새로일하기센터) 기준 추가 확인 필요'],
  emp_promo: ['신청 대상 사업장 여부 확인', '대상 근로자 요건 확인 (취업지원프로그램 이수 등)', '고용보험 가입 및 보수 124만↑ 확인', '신청 기한 확인 (12개월 내 첫 신청)', '중복 지원 제한 여부 확인', '필수 서류 준비 여부 확인', '운영기관 또는 공고문 기준 추가 확인 필요'],
  disabled_emp: ['신청 대상 사업장 여부 확인', '장애 등급 확인 (경증·중증)', '고용보험 가입 및 최저임금 이상 지급 확인', '신청 기한 확인', '중복 지원 제한 여부 확인', '필수 서류 준비 여부 확인 (장애인증명서 등)', '운영기관(한국장애인고용공단) 기준 추가 확인 필요'],
  worklife45: ['신청 대상 사업장 여부 확인 (20인↑)', '노사합의서 및 취업규칙 정비 여부 확인', '고용보험 가입 여부 확인', '신청 기한 확인', '중복 지원 제한 여부 확인', '필수 서류 준비 여부 확인', '운영기관(노사발전재단) 기준 추가 확인 필요'],
  parental_leave: ['신청 대상 사업장 여부 확인 (우선지원대상기업)', '대상 근로자 요건 확인 (육아휴직 30일↑ 허용)', '고용보험 가입 여부 확인', '신청 기한 확인', '중복 지원 제한 여부 확인', '필수 서류 준비 여부 확인', '운영기관 또는 공고문 기준 추가 확인 필요'],
  parental_reduce: ['신청 대상 사업장 여부 확인', '대상 근로자 요건 확인 (만 12세↓ 자녀, 최대 3년)', '고용보험 가입 여부 확인', '신청 기한 확인', '중복 지원 제한 여부 확인', '필수 서류 준비 여부 확인', '운영기관 또는 공고문 기준 추가 확인 필요'],
  work_share: ['신청 대상 사업장 여부 확인 (30인미만)', '업무분담수당 지급 계획 확인', '고용보험 가입 여부 확인', '신청 기한 확인', '대체인력과 중복 신청 여부 확인', '필수 서류 준비 여부 확인', '운영기관 또는 공고문 기준 추가 확인 필요'],
  emp_retention: ['경영 위기 사유 확인 (매출 감소 등)', '고용유지조치계획서 사전 신청 여부 확인', '대상 근로자 요건 확인', '신청 기한 확인 (연간 180일 한도)', '중복 지원 제한 여부 확인', '필수 서류 준비 여부 확인', '운영기관 또는 공고문 기준 추가 확인 필요'],
  job_sharing: ['신청 대상 사업장 여부 확인', '근로시간 단축 유형 확인 (교대제·심야단축·정년연장형 등)', '신규 채용 계획 확인', '사전 신청(승인) 여부 확인', '고용보험 가입 여부 확인', '신청 기한 확인', '운영기관 또는 공고문 기준 추가 확인 필요'],
}

/** 업체 기본 서류 템플릿 (카테고리별) */
export const COMPANY_DEFAULT_DOCS: readonly { cat: string; docs: string[] }[] = [
  { cat: '기본 사업자 서류', docs: ['사업자등록증', '법인등기사항전부증명서 (법인)', '대표자 신분증 사본', '기업 통장 사본'] },
  { cat: '고용보험 관련', docs: ['고용보험 성립 신고서', '4대보험 가입자 명부', '고용보험 피보험자격 취득·상실 이력'] },
  { cat: '세무·재무', docs: ['법인세(소득세) 신고서', '재무제표 (손익계산서·대차대조표)', '국세 완납 증명서'] },
  { cat: '근로자 관련', docs: ['근로계약서 (전 직원)', '임금대장', '취업규칙'] },
  { cat: '지원금별 추가', docs: ['협약서', '사업참여신청서', '개인정보 동의서 (사업주)'] },
]
