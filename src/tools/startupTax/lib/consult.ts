import type {
  ExpertReview,
  FormData,
  ItemResult,
  SavingsLevel,
  SavingsPoint,
  Verdict,
} from '../types'
import { LABEL } from './options'

// 결과 기반으로 상담 활용 콘텐츠를 생성한다.
// - reasons: 판정 사유 (간단 불릿, 종합카드/카톡 공용)
// - keyChecks: 주요 확인사항 (초기 화면 노출)
// - consultQuestions: 상담 시 확인해야 할 핵심 질문
// - consultChecklist: 전문가 상담 시 확인할 항목 (계약 유도)

function isExcludedIndustry(form: FormData): boolean {
  return form.industry === 'real_estate' || form.industry === 'finance_insurance'
}

// 창업 형태 짧은 라벨 (핵심 이유용)
const STARTUP_FORM_SHORT: Record<string, string> = {
  brand_new: '신규 창업',
  conversion: '개인사업 법인전환',
  acquisition: '기존 사업 양수',
  reopen_same: '동종업 재창업',
  succession: '특수관계인 승계',
  unknown: '창업 형태 미확인',
}

// 이번 판정의 핵심 이유 (3줄) — 창업형태 / 업종 / 권역
// 사용자가 결과 이유를 3초 안에 이해하도록 핵심만 추린다.
export function buildKeyReasons(form: FormData): string[] {
  const out: string[] = []

  if (form.startupForm) out.push(STARTUP_FORM_SHORT[form.startupForm] ?? '창업 형태 미확인')
  if (form.industry) out.push(LABEL.industry[form.industry] ?? '업종 미확인')

  if (form.overconcentration === 'yes') out.push('수도권 과밀억제권역')
  else if (form.overconcentration === 'no') out.push('비과밀억제권역')
  else out.push('과밀억제권역 미확인')

  return out.slice(0, 3)
}

// ---------------------------------------------------------------------------
// 예상 절세 규모 (LEVEL A~D) — 실제 세액 계산이 아니라 가능성 수준만 안내
// ---------------------------------------------------------------------------
const SAVINGS_LEVEL_LABEL: Record<string, string> = {
  A: '수천만 원 이상 절세 가능성',
  B: '수백만~수천만 원 절세 가능성',
  C: '제한적 절세 가능성',
  D: '절세효과 기대 어려움',
}

export function buildSavingsLevel(
  form: FormData,
  coreItems: ItemResult[],
  overall: Verdict,
  recognition: Verdict,
  isYouth: boolean | null,
): SavingsLevel {
  const income = coreItems.find((i) => i.key === 'incomeTax')
  const incomeGood = income?.verdict === 'good'
  const goodCount = coreItems.filter((i) => i.verdict === 'good').length

  // 창업 제외 가능성이 크거나 종합이 불가면 절세효과 기대 어려움
  if (recognition === 'bad' || overall === 'bad' || isExcludedIndustry(form)) {
    return { level: 'D', label: SAVINGS_LEVEL_LABEL.D }
  }

  // 핵심 감면(법인세·소득세)이 유리 + 청년/비과밀 등 유리조건 → 가장 큰 절세 구간
  const strongCondition = isYouth === true || form.overconcentration === 'no'
  if (incomeGood && strongCondition && goodCount >= 2) {
    return { level: 'A', label: SAVINGS_LEVEL_LABEL.A }
  }
  if (incomeGood) {
    return { level: 'B', label: SAVINGS_LEVEL_LABEL.B }
  }
  if (overall === 'caution') {
    return { level: 'B', label: SAVINGS_LEVEL_LABEL.B }
  }
  // 조건부 등 그 외
  return { level: 'C', label: SAVINGS_LEVEL_LABEL.C }
}

// 판정 사유 (긍정/부정 요소를 짧게)
export function buildReasons(form: FormData, isYouth: boolean | null): string[] {
  const out: string[] = []

  // 창업 형태
  switch (form.startupForm) {
    case 'brand_new':
      out.push('신규 창업')
      break
    case 'conversion':
      out.push('법인전환 (창업 제외 가능성)')
      break
    case 'acquisition':
      out.push('기존 사업 양수 (창업 제외 가능성)')
      break
    case 'reopen_same':
      out.push('동종업 재창업 (창업 제외 가능성)')
      break
    case 'succession':
      out.push('특수관계인 승계 (창업 제외 가능성)')
      break
    case 'unknown':
      out.push('창업 형태 미확인')
      break
  }

  // 청년
  if (isYouth === true) out.push('청년 창업')
  else if (isYouth === false) out.push('청년 요건 미해당')

  // 과밀억제권역
  if (form.overconcentration === 'no') out.push('비과밀억제권역')
  else if (form.overconcentration === 'yes') out.push('수도권 과밀억제권역')

  // 업종
  if (isExcludedIndustry(form)) out.push('부동산·금융업 (감면 제외 가능성)')
  else if (form.industry && form.industry !== 'etc') out.push('감면 대상 업종 가능성')

  return out
}

// 주요 확인사항 (초기 화면용, 2~4개)
export function buildKeyChecks(form: FormData): string[] {
  const out: string[] = []

  if (form.overconcentration === 'unknown' || form.overconcentration === '') {
    out.push('과밀억제권역 여부 확인')
  }
  if (isExcludedIndustry(form) || form.industry === 'etc' || form.industry === '') {
    out.push('정확한 업종코드 확인')
  }
  if (
    form.startupForm === 'unknown' ||
    form.startupForm === 'conversion' ||
    form.startupForm === 'acquisition' ||
    form.startupForm === 'reopen_same' ||
    form.startupForm === 'succession'
  ) {
    out.push('창업 인정 여부 확인')
  }
  // 항상 들어가는 공통 확인
  out.push('최초 소득 발생연도 확인')

  return dedupe(out).slice(0, 4)
}

// 상담 시 확인해야 할 핵심 질문 (결과에 따라 가변)
export function buildConsultQuestions(form: FormData, isYouth: boolean | null): string[] {
  const out: string[] = []

  const hasHistorySuspect =
    form.startupForm === 'conversion' ||
    form.startupForm === 'acquisition' ||
    form.startupForm === 'reopen_same' ||
    form.startupForm === 'succession' ||
    form.startupForm === 'unknown'

  if (hasHistorySuspect) {
    out.push('기존 사업 이력이 있으신가요? (폐업·양수·승계 포함)')
  }
  if (
    form.startupForm === 'reopen_same' ||
    form.startupForm === 'acquisition' ||
    form.startupForm === 'succession' ||
    form.startupForm === 'unknown'
  ) {
    out.push('동일 업종을 운영하신 경험이 있으신가요?')
  }
  if (form.startupForm === 'conversion' || form.businessType === 'corporation') {
    out.push('개인사업자에서 법인전환을 하신 경우인가요?')
  }
  if (form.overconcentration === 'unknown' || form.overconcentration === '') {
    out.push('사업장을 어디에 두실 예정인가요? (수도권 과밀억제권역 여부)')
  }
  if (isExcludedIndustry(form) || form.industry === 'etc' || form.industry === '') {
    out.push('주업종의 정확한 업종코드(한국표준산업분류)는 무엇인가요?')
  }
  // 취득세 관련 (사업용 부동산)
  out.push('취득 예정인 사업용 부동산이 있으신가요?')

  // 상세 입력 기반 자동 생성 질문 (사업 동일성·지분·매출 유형)
  const a = form.advanced
  if (a.sameAddress === 'yes' || a.sameAddress === 'unknown' || a.hasExistingSole === 'yes') {
    out.push('기존 사업장과 주소가 완전히 분리되어 있나요?')
  }
  if (
    a.reuseIdentity === 'yes' ||
    a.reuseIdentity === 'unknown' ||
    a.employeeMoved === 'yes' ||
    form.startupForm === 'acquisition'
  ) {
    out.push('기존 사업의 직원·거래처·홈페이지·상표를 그대로 사용하나요?')
  }
  if (a.assetTakeoverRatio !== '' || form.startupForm === 'acquisition' || form.startupForm === 'conversion') {
    out.push('기존 사업의 자산을 얼마나 가져왔나요? (인수 비율)')
  }
  if (form.businessType === 'corporation') {
    out.push('신규 법인의 대표 및 친족 지분율은 어떻게 되나요?')
  }
  if (a.hasExistingCorp === 'yes' || a.isExistingExec !== 'no') {
    out.push('기존 법인의 임원으로 등재되어 있나요?')
  }
  // 매출 유형 (조특법 업종 판단 핵심)
  out.push('실제 매출은 상품매출인가요, 제품매출인가요, 용역매출인가요?')

  // 청년 병역
  if (isYouth === false || isYouth === null) {
    out.push('대표자 병역 이행 기간이 있으신가요? (조특법 청년 기간 연장 가능)')
  }

  return dedupe(out).slice(0, 8)
}

// 전문가 검토 시 확인할 항목 체크리스트 (계약 유도)
// CTA 사양에 맞춘 핵심 5개 항목을 기본 제공한다.
export function buildConsultChecklist(_form: FormData): string[] {
  return [
    '창업 연혁 확인',
    '업종 코드 검토',
    '과밀억제권역 검토',
    '취득세 감면 가능성 검토',
    '최초 소득 발생연도 검토',
  ]
}

// ---------------------------------------------------------------------------
// 예상 절세 포인트 — "검토받으면 돈을 아낄 수 있겠다"를 느끼게
// (정확한 세액 계산이 아니라 검토 대상 여부만 표현)
// ---------------------------------------------------------------------------
const SAVINGS_SHORT: Record<string, string> = {
  incomeTax: '법인세·소득세',
  acquisitionTax: '취득세',
  propertyTax: '재산세',
}

export function buildSavingsPoints(
  coreItems: ItemResult[],
  overall: Verdict,
  recognition: Verdict,
): SavingsPoint[] {
  const points: SavingsPoint[] = []

  // 창업 제외 가능성이 큰 경우 상단에 경고 한 줄
  if (recognition === 'bad' || overall === 'bad') {
    points.push({
      tone: 'bad',
      text: '창업 제외 가능성이 높아 세제혜택 적용이 어려울 수 있습니다.',
    })
  }

  for (const item of coreItems) {
    const short = SAVINGS_SHORT[item.key] ?? item.title
    switch (item.verdict) {
      case 'good':
        points.push({ tone: 'good', text: `${short} 감면 검토 대상` })
        break
      case 'caution':
        points.push({ tone: 'caution', text: `${short} 감면 가능성 있으나 제한 검토 필요` })
        break
      case 'conditional':
        points.push({ tone: 'caution', text: `${short} 감면 가능성 검토 필요 (조건부)` })
        break
      case 'bad':
        points.push({ tone: 'bad', text: `${short} 감면 어려움` })
        break
    }
  }

  return points
}

// 절세 포인트 하단 한 줄 — 상담 시 무엇을 확인해야 하는지
export function buildSavingsAdvice(keyChecks: string[]): string {
  if (keyChecks.length === 0) {
    return '상담 시 창업 인정 여부와 업종코드를 확인하면 적용 여부가 분명해집니다.'
  }
  const top = keyChecks
    .slice(0, 2)
    .map((c) => c.replace(/\s*확인$/, '').replace(/\s*여부$/, ''))
    .join(', ')
  return `상담 시 ${top} 등을 확인하면 적용 가능 여부가 분명해집니다.`
}

// ---------------------------------------------------------------------------
// 많은 대표님들이 놓치는 부분 — 결과별 자동 생성
// ---------------------------------------------------------------------------
export function buildMissedPoints(form: FormData, isYouth: boolean | null): string[] {
  const out: string[] = []

  out.push('업종코드에 따라 감면 적용 여부가 달라질 수 있습니다.')

  if (form.overconcentration !== 'no') {
    out.push('과밀억제권역 여부에 따라 결과가 크게 달라질 수 있습니다.')
  }
  if (form.startupForm === 'conversion') {
    out.push('법인전환 구조에 따라 창업 인정 여부가 달라질 수 있습니다.')
  }
  if (
    form.startupForm === 'acquisition' ||
    form.startupForm === 'succession' ||
    form.startupForm === 'reopen_same'
  ) {
    out.push('사업 양수·승계 구조에 따라 창업 인정 여부가 달라질 수 있습니다.')
  }
  out.push('사업장 주소(소재지)가 감면 판정에 중요할 수 있습니다.')
  if (isYouth === false || isYouth === null) {
    out.push('병역 이행 기간에 따라 청년 감면 대상 여부가 달라질 수 있습니다.')
  }

  return dedupe(out).slice(0, 5)
}

// ---------------------------------------------------------------------------
// 전문가 검토 추천도 (A/B/C/D)
// 단정하기 어려운/검토 필요 요소가 많을수록 A(상담 강력 추천)에 가깝다.
// ---------------------------------------------------------------------------
export function buildExpertReview(
  form: FormData,
  coreItems: ItemResult[],
  isYouth: boolean | null,
  age: number | null,
): ExpertReview {
  // 실질 검토 요소만 산정에 반영한다.
  // 등록면허세는 법인이라는 이유만으로 항상 잡혀 추천도를 부풀리므로 산정에서 제외
  // (등록면허세 참고 카드/안내문은 별도로 그대로 유지됨).
  const factors: string[] = []

  // 창업 형태 관련
  if (form.startupForm === 'conversion') factors.push('법인전환')
  if (form.startupForm === 'acquisition') factors.push('개인사업 양수')
  if (form.startupForm === 'succession') factors.push('특수관계인 승계')
  if (form.startupForm === 'reopen_same') factors.push('동종업 재창업')
  if (form.startupForm === 'unknown' || form.startupForm === '') factors.push('창업 형태 불명확')

  // 과밀억제권역
  if (form.overconcentration === 'yes') factors.push('과밀억제권역')
  if (form.overconcentration === 'unknown' || form.overconcentration === '')
    factors.push('과밀억제권역 불명확')

  // 업종
  if (form.industry === 'real_estate' || form.industry === 'finance_insurance')
    factors.push('감면 제외 우려 업종')
  if (form.industry === 'etc' || form.industry === '') factors.push('업종 불명확')

  // 항목별 검토 필요 (취득세/재산세)
  const acq = coreItems.find((i) => i.key === 'acquisitionTax')
  if (acq && acq.verdict !== 'good') factors.push('취득세 검토 필요')
  const prop = coreItems.find((i) => i.key === 'propertyTax')
  if (prop && prop.verdict !== 'good') factors.push('재산세 검토 필요')

  // 청년 경계구간 (만 33~35세) 또는 생년월일 미입력
  if (age !== null && age >= 33 && age <= 35) factors.push('청년 여부 경계구간')
  if (isYouth === null) factors.push('대표자 정보 부족')

  const n = factors.length

  if (n >= 4) {
    return {
      grade: 'A',
      label: '상담 강력 추천',
      description:
        '현재 정보만으로 단정하기 어려운 항목이 많아 전문가의 추가 검토가 강력히 권장됩니다.',
      factors,
    }
  }
  if (n >= 2) {
    return {
      grade: 'B',
      label: '상담 추천',
      description: '현재 정보만으로 단정하기 어려운 항목이 있어 추가 검토가 권장됩니다.',
      factors,
    }
  }
  if (n === 1) {
    return {
      grade: 'C',
      label: '간단 확인 권장',
      description: '대부분 명확하나 한 가지 항목은 간단히 확인해 두는 것이 좋습니다.',
      factors,
    }
  }
  return {
    grade: 'D',
    label: '셀프 검토 가능',
    description: '입력 정보 기준 큰 변수는 없어 보이나, 적용 전 최종 확인은 필요합니다.',
    factors,
  }
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)]
}
