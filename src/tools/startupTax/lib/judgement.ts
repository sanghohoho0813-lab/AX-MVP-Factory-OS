import type {
  FormData,
  ItemResult,
  JudgementResult,
  RegistrationReference,
  Verdict,
} from '../types'
import { calcAge, isYouthAge } from './date'
import { diagnoseExclusion } from './exclusion'
import { buildYouthStatus } from './youth'
import { buildFrameworks } from './frameworks'
import { buildLineage } from './lineage'
import {
  buildConsultChecklist,
  buildConsultQuestions,
  buildExpertReview,
  buildKeyChecks,
  buildKeyReasons,
  buildMissedPoints,
  buildReasons,
  buildSavingsAdvice,
  buildSavingsLevel,
  buildSavingsPoints,
} from './consult'

// ---------------------------------------------------------------------------
// 판정 상태 라벨 / 순위 / 한줄 결론
// ---------------------------------------------------------------------------
export const VERDICT_LABEL: Record<Verdict, string> = {
  good: '감면 가능성 높음',
  caution: '주의 필요',
  conditional: '조건부 검토',
  bad: '불가 가능성 높음',
}

export const VERDICT_EMOJI: Record<Verdict, string> = {
  good: '🟢',
  caution: '🟡',
  conditional: '🟠',
  bad: '🔴',
}

// 한줄 결론 (사장님이 3초 안에 "그래서 받을 수 있는가"를 이해)
export const VERDICT_ONELINE: Record<Verdict, string> = {
  good: '현재 정보 기준으로 창업감면 적용 가능성이 높아 보입니다.',
  caution: '창업감면 가능성은 있으나 일부 핵심 항목 확인이 필요합니다.',
  conditional: '감면 가능성은 있으나 적용 여부가 크게 달라질 수 있습니다.',
  bad: '현재 정보 기준으로는 창업감면 적용이 어려워 보입니다.',
}

// 긍정적일수록 높은 순위 (종합판정은 가장 보수적인 = 최저 순위 채택)
const VERDICT_RANK: Record<Verdict, number> = {
  bad: 0,
  conditional: 1,
  caution: 2,
  good: 3,
}

export const DISCLAIMER =
  '본 결과는 상담용 1차 판정이며, 실제 감면 적용 여부는 조세특례제한법, 지방세특례제한법, 업종코드, 창업 형태, 과밀억제권역 여부, 지자체 해석에 따라 달라질 수 있습니다. 최종 적용 전 세무사 또는 관할 지자체 확인이 필요합니다.'

// 법 기준 분리 안내
export const DISCLAIMER_FRAMEWORK =
  '조특법상 창업 인정과 중소기업창업 지원법상 창업기업 확인은 판단 목적과 기준이 다를 수 있습니다. 세액감면, 정책자금, 창업기업확인은 각각 별도 검토가 필요합니다.'

// ---------------------------------------------------------------------------
// A. 창업 인정 여부 판정 (4단계)
// ---------------------------------------------------------------------------
function judgeStartupRecognition(form: FormData): { verdict: Verdict; note: string } {
  switch (form.startupForm) {
    case 'brand_new':
      return { verdict: 'good', note: '완전 신규 창업으로 보여 창업 인정 가능성이 높습니다.' }
    case 'conversion':
      return {
        verdict: 'caution',
        note: '개인사업자에서 법인전환한 경우 신규 창업으로 보지 않을 수 있어 주의가 필요합니다.',
      }
    case 'acquisition':
      return {
        verdict: 'caution',
        note: '기존 사업을 양수한 경우 창업으로 인정되지 않을 가능성이 있습니다.',
      }
    case 'reopen_same':
      return {
        verdict: 'caution',
        note: '폐업 후 같은 업종으로 재창업한 경우 창업 인정이 제한될 수 있습니다.',
      }
    case 'succession':
      return {
        verdict: 'bad',
        note: '가족·특수관계인의 사업을 승계한 경우 창업으로 인정되지 않을 가능성이 높습니다.',
      }
    case 'unknown':
      return {
        verdict: 'conditional',
        note: '창업 형태가 불분명하여 창업 인정 여부 확인이 필요합니다.',
      }
    default:
      return {
        verdict: 'conditional',
        note: '창업 형태를 선택하면 창업 인정 여부를 판단할 수 있습니다.',
      }
  }
}

// 창업 인정이 "약함"(부정적) 인지 — 양수/전환/승계 등
function isRecognitionWeak(v: Verdict): boolean {
  return v === 'caution' || v === 'bad'
}

// ---------------------------------------------------------------------------
// C. 법인세 / 소득세 감면
// ---------------------------------------------------------------------------
function judgeIncomeTax(form: FormData, recognition: Verdict, isYouth: boolean | null): ItemResult {
  const reasons: string[] = []
  const checkPoints: string[] = [
    '창업 지역·업종·과밀억제권역 여부에 따라 감면율(50%~100%)이 달라집니다.',
    '최초로 소득이 발생한 과세연도 기준으로 감면 기간이 산정됩니다.',
    '업종 코드(한국표준산업분류)가 감면 대상 업종에 해당하는지 확인이 필요합니다.',
  ]
  let verdict: Verdict
  let consultScript: string

  const isExcludedIndustry =
    form.industry === 'real_estate' || form.industry === 'finance_insurance'
  const inOverconcentration = form.overconcentration === 'yes'

  if (isExcludedIndustry) {
    verdict = 'bad'
    reasons.push(
      form.industry === 'real_estate'
        ? '부동산업은 창업중소기업 세액감면 대상 업종에서 제외되는 경우가 많습니다.'
        : '금융·보험업은 창업중소기업 세액감면 대상 업종에 해당하지 않을 가능성이 높습니다.',
    )
    reasons.push('대상 업종 여부를 업종 코드로 다시 확인할 필요가 있습니다.')
    consultScript =
      '대표님 업종은 창업감면 대상 업종에서 제외될 수 있어, 정확한 업종 코드 확인이 먼저 필요합니다.'
  } else if (isRecognitionWeak(recognition)) {
    verdict = 'caution'
    reasons.push('창업 인정 여부가 불확실하여 감면 적용에 주의가 필요합니다.')
    reasons.push('창업 형태(전환·양수·승계 등)에 따라 적용이 제한될 수 있습니다.')
    consultScript =
      '이 케이스는 신규창업이라기보다 법인전환·사업승계로 볼 여지가 있어 창업감면 적용이 제한될 수 있습니다.'
  } else if (recognition === 'conditional') {
    verdict = 'conditional'
    reasons.push('창업 형태가 확인되어야 감면 적용 여부를 판단할 수 있습니다.')
    reasons.push('신규 창업으로 확인되면 감면 가능성이 높아집니다.')
    consultScript = '창업 형태(신규/전환/양수)를 먼저 확인하면 감면 가능 여부가 분명해집니다.'
  } else if (isYouth === true && !inOverconcentration) {
    verdict = 'good'
    reasons.push('청년 창업 + 수도권 과밀억제권역 외 지역으로 유리한 조건입니다.')
    reasons.push('청년창업중소기업 세액감면(높은 감면율) 적용 가능성을 검토할 수 있습니다.')
    consultScript =
      '대표님은 청년 + 비과밀억제권역 창업으로, 창업감면에서 가장 유리한 구간에 해당할 가능성이 있습니다.'
  } else if (isYouth === true && inOverconcentration) {
    verdict = 'caution'
    reasons.push('청년 창업이지만 수도권 과밀억제권역으로 일부 제한이 있을 수 있습니다.')
    reasons.push('과밀억제권역에서는 감면율이 낮아지거나 적용이 제한될 수 있습니다.')
    consultScript =
      '청년 창업이지만 과밀억제권역이라 감면율이 달라질 수 있어, 권역 여부 확인이 우선입니다.'
  } else {
    verdict = 'good'
    reasons.push('창업 인정 가능성이 있어 창업중소기업 세액감면 검토가 가능합니다.')
    reasons.push(
      inOverconcentration
        ? '다만 과밀억제권역 여부에 따라 감면율이 달라질 수 있습니다.'
        : '비과밀억제권역으로 비교적 유리한 조건입니다.',
    )
    consultScript =
      '대표님 케이스는 창업감면 가능성이 있어 보이지만, 과밀억제권역 여부와 업종 코드 확인이 먼저 필요합니다.'
  }

  reasons.push('정확한 감면율은 창업지역, 업종, 과밀억제권역, 최초 소득 발생연도에 따라 달라집니다.')

  return { key: 'incomeTax', title: '법인세 / 소득세 감면', verdict, reasons, checkPoints, consultScript }
}

// ---------------------------------------------------------------------------
// D. 취득세 감면
// ---------------------------------------------------------------------------
function judgeAcquisitionTax(form: FormData, recognition: Verdict): ItemResult {
  const reasons: string[] = []
  const checkPoints: string[] = [
    '취득한 부동산이 사업용(직접 사용)인지 확인이 필요합니다.',
    '창업일로부터 일정 기간 내 취득한 사업용 재산인지 확인이 필요합니다.',
    '지방세특례제한법상 감면 요건과 적용기한을 관할 지자체에 확인하는 것이 안전합니다.',
  ]
  let verdict: Verdict
  let consultScript: string

  const inOverconcentration = form.overconcentration === 'yes'

  if (isRecognitionWeak(recognition)) {
    verdict = 'bad'
    reasons.push('창업 인정 여부가 불확실하여 취득세 감면 적용이 어려울 수 있습니다.')
    reasons.push('창업으로 인정되지 않으면 취득세 감면 대상에서 제외될 수 있습니다.')
    consultScript = '창업 인정 여부가 불확실해 취득세 감면은 보수적으로 보는 것이 안전합니다.'
  } else if (recognition === 'conditional') {
    verdict = 'conditional'
    reasons.push('창업 인정 여부와 사업용 부동산 취득 계획이 확인되어야 판단할 수 있습니다.')
    reasons.push('신규 창업 + 사업용 직접 사용이면 감면 가능성이 생깁니다.')
    consultScript = '취득세는 창업 인정 여부와 사업용 부동산 취득 계획 확인 후 판단이 가능합니다.'
  } else if (inOverconcentration) {
    verdict = 'caution'
    reasons.push('수도권 과밀억제권역으로 취득세 감면이 제한되거나 불리할 수 있습니다.')
    reasons.push('과밀억제권역 내 취득은 중과 또는 감면 배제 대상이 될 수 있습니다.')
    consultScript =
      '과밀억제권역이라 취득세는 오히려 불리할 수 있어, 권역·중과 여부 확인이 필요합니다.'
  } else if (form.overconcentration === 'no') {
    verdict = 'good'
    reasons.push('비과밀억제권역으로 창업 사업용 부동산 취득세 감면 가능성이 있습니다.')
    reasons.push('사업용으로 직접 사용하는 부동산이라면 감면 검토가 가능합니다.')
    consultScript =
      '비과밀억제권역이라 사업용 부동산 취득세 감면 가능성이 있어 보입니다. 사업용 사용 여부를 확인해 주세요.'
  } else {
    verdict = 'conditional'
    reasons.push('과밀억제권역 여부가 불분명하여 취득세 감면 판단이 어렵습니다.')
    reasons.push('권역 여부에 따라 결과가 크게 달라집니다.')
    consultScript = '과밀억제권역 여부가 확인되어야 취득세 감면 판단이 가능합니다.'
  }

  return { key: 'acquisitionTax', title: '취득세 감면', verdict, reasons, checkPoints, consultScript }
}

// ---------------------------------------------------------------------------
// E. 재산세 감면
// ---------------------------------------------------------------------------
function judgePropertyTax(recognition: Verdict): ItemResult {
  const reasons: string[] = []
  const checkPoints: string[] = [
    '해당 부동산을 사업에 직접 사용하는지(자가 사용) 확인이 필요합니다.',
    '단순 투자용·임대용 부동산은 감면 대상에서 제외될 수 있습니다.',
    '재산세 감면은 본 진단에서 별도 입력을 받지 않으므로 안내 위주로 참고해 주세요.',
  ]
  let verdict: Verdict
  let consultScript: string

  if (isRecognitionWeak(recognition)) {
    verdict = 'caution'
    reasons.push('창업 인정 여부가 불확실하여 재산세 감면도 보수적으로 봐야 합니다.')
    reasons.push('사업용 직접 사용 부동산이 아니라면 감면이 어렵습니다.')
    consultScript =
      '재산세 감면은 창업 인정과 사업용 직접 사용이 전제이므로, 두 가지를 먼저 확인해 주세요.'
  } else if (recognition === 'conditional') {
    verdict = 'conditional'
    reasons.push('창업 형태가 확인되어야 재산세 감면 판단이 가능합니다.')
    reasons.push('사업용 직접 사용 여부도 함께 확인되어야 합니다.')
    consultScript = '재산세 감면은 창업 인정 여부와 부동산 사용 형태 확인 후 판단이 가능합니다.'
  } else {
    verdict = 'good'
    reasons.push('창업 인정 가능성이 있고 사업용 직접 사용 부동산이면 감면 가능성이 있습니다.')
    reasons.push('단, 투자용·임대용 부동산은 불리하므로 사용 형태 확인이 필요합니다.')
    consultScript =
      '사업장으로 직접 사용하는 부동산이라면 재산세 감면 가능성이 있습니다. 임대·투자용이면 달라집니다.'
  }

  return { key: 'propertyTax', title: '재산세 감면', verdict, reasons, checkPoints, consultScript }
}

// ---------------------------------------------------------------------------
// F. 등록면허세 — 종합판정 제외, 별도 참고
// ---------------------------------------------------------------------------
function buildRegistrationReference(form: FormData): RegistrationReference {
  const checkPoints: string[] = [
    '현재 시점의 지방세특례제한법 개정·일몰(적용기한) 여부를 확인해야 합니다.',
    '관할 지자체의 해석 및 적용기한을 직접 확인하는 것이 안전합니다.',
    '법인 설립 등기 시점과 과밀억제권역 중과 여부를 확인해야 합니다.',
  ]
  let note =
    '법인설립 등기 관련 등록면허세 감면은 개정·적용기한에 민감해 단정하기 어렵습니다. 세무사 또는 관할 지자체 확인이 필요합니다.'

  if (form.businessType === 'individual') {
    note += ' (개인사업자는 법인설립 등기 감면과 직접 관련이 적을 수 있습니다.)'
  } else if (form.overconcentration === 'yes') {
    note += ' (과밀억제권역 내 설립 등기는 등록면허세 중과 가능성도 함께 확인해야 합니다.)'
  }

  return { title: '등록면허세 (참고)', note, checkPoints }
}

// ---------------------------------------------------------------------------
// 종합 판정
// ---------------------------------------------------------------------------
export function judge(form: FormData, baseDate: Date = new Date()): JudgementResult {
  const age = calcAge(form.birthDate, baseDate)
  const isYouth = isYouthAge(age)
  const recognition = judgeStartupRecognition(form)

  const checked = form.checkItems
  const anyChecked =
    checked.incomeTax || checked.acquisitionTax || checked.propertyTax || checked.registrationTax

  // 핵심 항목 (종합판정 대상): 법인세 / 취득세 / 재산세
  const allCore: ItemResult[] = [
    judgeIncomeTax(form, recognition.verdict, isYouth),
    judgeAcquisitionTax(form, recognition.verdict),
    judgePropertyTax(recognition.verdict),
  ]
  const coreItems = allCore.filter((item) => !anyChecked || checked[item.key])

  // 등록면허세 참고 (선택 시 또는 전체일 때 표시)
  const showRegistration = !anyChecked || checked.registrationTax
  const registration = showRegistration ? buildRegistrationReference(form) : null

  // 종합판정: 핵심 항목(등록면허세 제외) 중 가장 보수적인 상태
  let overall: Verdict = 'good'
  if (coreItems.length === 0) {
    overall = 'conditional'
  } else {
    for (const item of coreItems) {
      if (VERDICT_RANK[item.verdict] < VERDICT_RANK[overall]) overall = item.verdict
    }
  }

  const keyChecks = buildKeyChecks(form)
  const youth = buildYouthStatus(age)
  const lineage = buildLineage(form, baseDate)
  const frameworks = buildFrameworks(
    form,
    allCore,
    recognition.verdict,
    youth,
    registration ? registration.note : buildRegistrationReference(form).note,
    lineage,
  )

  return {
    overall,
    oneLineConclusion: VERDICT_ONELINE[overall],
    reasons: buildReasons(form, isYouth),
    keyReasons: buildKeyReasons(form),
    keyChecks,
    savingsPoints: buildSavingsPoints(coreItems, overall, recognition.verdict),
    savingsAdvice: buildSavingsAdvice(keyChecks),
    savingsLevel: buildSavingsLevel(form, coreItems, overall, recognition.verdict, isYouth),
    missedPoints: buildMissedPoints(form, isYouth),
    expertReview: buildExpertReview(form, coreItems, isYouth, age),
    isYouth,
    age,
    youth,
    frameworks,
    lineage,
    startupRecognition: recognition.verdict,
    startupRecognitionNote: recognition.note,
    exclusionReasons: diagnoseExclusion(form),
    coreItems,
    registration,
    consultQuestions: buildConsultQuestions(form, isYouth),
    consultChecklist: buildConsultChecklist(form),
  }
}
