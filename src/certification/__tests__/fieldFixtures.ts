/**
 * 현장 검증용 업체 5유형 (Field Validation · QA 전용) — 실제 컨설팅에서 자주 보는 모양을 흉내 낸 가짜 업체.
 * 화면 · Core 에는 쓰지 않는다. 판정을 업체 이름으로 바꾸는 예외 처리 금지 — 공통 규칙만 시험한다.
 */
import type { BasisItem, CertificationClientContext } from '../core/types'

export const FIELD_TODAY = '2026-10-07'

const base: CertificationClientContext = {
  companyName: '', entity: 'corporation', years: null, months: null, industryText: '', industryGroup: '', employees: null, size: null,
  revenue: null, operatingProfit: null, netIncome: null, totalAssets: null, totalLiabilities: null, rndExpense: null, researchUnit: null,
  researchers: null, patents: null, held: [], b2b: null, procurement: null, exportPlan: null, policyFundPlan: null, rndPlan: null,
  exclusionFlags: [], evidence: [], basis: [], today: FIELD_TODAY,
}
const ev = (...ids: string[]) => ids.map((id) => ({ id, label: id, have: true }))
const B = (field: BasisItem['field'], label: string, value: string, from: string): BasisItem => ({ field, label, value, state: 'confirmed', from })
/** 컨설턴트가 칩으로 고른 값(앱에서 실제로 만들어지는 모양) */
const CHIP = (field: BasisItem['field'], label: string, value: string): BasisItem => ({ field, label, value, state: 'estimated', from: '컨설턴트 선택(회사 정보 미확인)' })

/** A 기술기업 — 6년 · 연구소 · 특허 2 · R&D · B2B · 정책자금 관심 */
export const techCo: CertificationClientContext = {
  ...base, companyName: '가온테크', years: 6, months: 75, industryText: '산업용 센서 제조', industryGroup: 'manufacturing', employees: 28, size: 'small',
  revenue: 4_200_000_000, operatingProfit: 310_000_000, netIncome: 240_000_000, totalAssets: 3_800_000_000, totalLiabilities: 1_900_000_000,
  rndExpense: 380_000_000, researchUnit: 'lab', researchers: 4, patents: 2, b2b: true, procurement: false, exportPlan: false, policyFundPlan: true, rndPlan: true,
  evidence: ev('biz_reg', 'fin3', 'lab_cert', 'patent'),
  basis: [
    B('years', '업력', '6년(설립 2020-07-01)', '사업자등록증'), B('industry', '업종', '산업용 센서 제조', '사업자등록증'), B('employees', '직원', '28명', '4대보험 명부'),
    B('revenue', '매출', '42억원', '재무제표(2025)'), B('researchUnit', '연구조직', '기업부설연구소', '연구소 인정서(2021-05-10)'),
    B('researchers', '연구전담요원', '4명', '연구소 관리 기록'), B('patents', '특허', '2건', '특허 등록증'), CHIP('b2b', 'B2B 납품', '예'),
    { field: 'exclusion', label: '제외 사유', value: '없음', state: 'estimated', from: '컨설턴트 확인(신청 전 증명서로 최종 확인)' },
  ],
}

/** B 일반 서비스 · 경영혁신 — 9년 · 연구소 · 특허 없음 · 직원 25 · 흑자 · 인사 기록 */
export const serviceCo: CertificationClientContext = {
  ...base, companyName: '바른교육서비스', years: 9, months: 110, industryText: '기업 교육 서비스', industryGroup: 'service', employees: 25, size: 'small',
  revenue: 3_100_000_000, operatingProfit: 260_000_000, netIncome: 200_000_000, totalAssets: 2_000_000_000, totalLiabilities: 700_000_000,
  rndExpense: 0, researchUnit: 'none', researchers: 0, patents: 0, b2b: true, procurement: false, exportPlan: false, policyFundPlan: false, rndPlan: false,
  evidence: ev('biz_reg', 'fin3', 'hr_rules', 'org_chart', 'vision'),
  basis: [
    B('years', '업력', '9년(설립 2017-08-01)', '사업자등록증'), B('industry', '업종', '기업 교육 서비스', '사업자등록증'), B('employees', '직원', '25명', '4대보험 명부'),
    B('revenue', '매출', '31억원', '재무제표(2025)'), B('researchUnit', '연구조직', '없음', '회사 정보(확인)'), B('patents', '특허', '0건', '회사 정보(확인)'),
  ],
}

/** C 신규 · 정보 부족 — 업력만 확인 */
export const sparseCo: CertificationClientContext = {
  ...base, companyName: '새봄상사', years: 4, months: 52, basis: [B('years', '업력', '4년(설립 2022-06-10)', '사업자등록증')],
}

/** D 제조 B2B — 11년 · 금속가공 · 연구조직 없음 · 특허 없음 · 직원 60(중기업) · 납품 · 조달 · 수출 */
export const factoryCo: CertificationClientContext = {
  ...base, companyName: '대성정밀', years: 11, months: 135, industryText: '자동차 부품 금속 가공', industryGroup: 'manufacturing', employees: 60, size: 'medium',
  revenue: 15_000_000_000, operatingProfit: 900_000_000, netIncome: 650_000_000, totalAssets: 12_000_000_000, totalLiabilities: 7_000_000_000,
  rndExpense: 0, researchUnit: 'none', researchers: 0, patents: 0, b2b: true, procurement: true, exportPlan: true, policyFundPlan: true, rndPlan: false,
  evidence: ev('biz_reg', 'fin3', 'org_chart'),
  basis: [
    B('years', '업력', '11년(설립 2015-04-01)', '사업자등록증'), B('industry', '업종', '자동차 부품 금속 가공', '사업자등록증'), B('employees', '직원', '60명', '4대보험 명부'),
    B('revenue', '매출', '150억원', '재무제표(2025)'), B('researchUnit', '연구조직', '없음', '회사 정보(확인)'), B('patents', '특허', '0건', '회사 정보(확인)'),
    CHIP('b2b', 'B2B 납품', '예'), CHIP('procurement', '조달 · 입찰', '예'), CHIP('exportPlan', '수출', '예'),
  ],
}

/** E 인증 보유 · 만료 — 벤처 보유(유효) · 연구소 보유 · 이노비즈 만료(연장 기간도 지남) */
export const heldCo: CertificationClientContext = {
  ...techCo, companyName: '누리소프트', industryText: '소프트웨어 개발', industryGroup: 'software',
  held: [
    { key: 'venture', validUntil: '2027-09-30', note: '확인번호 20240930' },
    { key: 'lab', validUntil: '', note: '인정 2021-05-10' },
    { key: 'innobiz', validUntil: '2026-07-31', note: '인증번호 230801-001' },
  ],
}

export const FIELD_COS = { A: techCo, B: serviceCo, C: sparseCo, D: factoryCo, E: heldCo } as const
