import type {
  FormData,
  ItemResult,
  JudgementResult,
  Lineage,
  RegistrationReference,
  Verdict,
} from '../types'
import { calcAge, formatDate, parseLocalDate, toLocalDay } from './date'
import { diagnoseExclusion } from './exclusion'
import { buildYouthStatus } from './youth'
import { buildFrameworks } from './frameworks'
import { buildLineage } from './lineage'
import {
  checkRegion,
  industryAlertOf,
  industryClassOf,
  REVISED_RULE_ALERT,
  REVISED_RULE_FROM,
  worstOf,
} from './rules'
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

// D-136: 판정 대신 보여 주는 안내 (한줄 결론 자리)
export const NOTICE_MISSING_DATES = '생년월일·창업일을 입력해야 판정합니다.'
export const NOTICE_DATE_ORDER = '생년월일이 창업일보다 늦습니다. 날짜를 확인해야 판정합니다.'
export const NOTICE_PRE_STARTUP = '예비창업 — 창업 후 판정합니다. 지금 결과는 참고용입니다.'

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
      // 조특법은 창업이 아니다(§6⑩ — 세액감면은 불가로 본다). 창업지원법은 폐업 3년 뒤면 창업일 수 있어 '주의' 로 둔다.
      return {
        verdict: 'caution',
        note: '폐업 후 같은 업종으로 다시 시작한 경우 조특법상 창업이 아닙니다. 창업지원법은 폐업 후 3년(부도·파산 2년)이 지나면 창업으로 볼 수 있습니다.',
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
// 판정에 함께 쓰는 사실 (D-136)
// ---------------------------------------------------------------------------
interface Facts {
  youthTax: boolean | null // 조특법 청년 (창업 당시 나이 기준, 35~40세는 병역 확인 전 null)
  lineage: Lineage
  baseYear: number
  datesMissing: boolean // 생년월일·창업일 없음 / 잘못됨 / 예시 날짜 / 순서 뒤바뀜
  future: boolean // 창업일이 아직 오지 않음 (예비창업)
  after2026: boolean // 2026-01-01 이후 창업 (개정 규정 확인 필요)
  regionInconsistent: boolean // 지역 ↔ 과밀억제권역 답이 맞지 않음
}

// 모든 항목에 똑같이 씌우는 상한 — 입력이 불완전하면 '가능성 높음' 이 나오지 않게
function applyInputCaps(verdict: Verdict, reasons: string[], facts: Facts): Verdict {
  let v = verdict
  if (facts.regionInconsistent) {
    v = worstOf(v, 'caution')
    reasons.push('사업장 지역과 과밀억제권역 답이 서로 맞지 않아 주소 확인이 필요합니다.')
  }
  if (facts.datesMissing) {
    v = worstOf(v, 'conditional')
    reasons.push('생년월일·창업일을 입력해야 판정합니다.')
  } else if (facts.future) {
    v = worstOf(v, 'conditional')
    reasons.push('예비창업 — 창업 후 판정합니다.')
  }
  return v
}

// ---------------------------------------------------------------------------
// C. 법인세 / 소득세 감면 (조특법 §6)
// ---------------------------------------------------------------------------
function judgeIncomeTax(form: FormData, recognition: Verdict, facts: Facts): ItemResult {
  const reasons: string[] = []
  const checkPoints: string[] = [
    '창업 지역·업종·과밀억제권역 여부에 따라 감면율(0%~100%)이 달라집니다.',
    '최초로 소득이 발생한 과세연도 기준으로 감면 기간이 산정됩니다.',
    '업종 코드(한국표준산업분류)가 감면 대상 업종에 해당하는지 확인이 필요합니다.',
  ]
  let verdict: Verdict
  let consultScript: string

  const industry = industryClassOf(form.industry)
  // form.overconcentration 은 지역과 맞춰 본 값 (서울 = 과밀)
  const over = form.overconcentration
  const isYouth = facts.youthTax

  if (industry === 'excluded') {
    verdict = 'bad'
    reasons.push(
      form.industry === 'real_estate'
        ? '부동산업은 창업중소기업 세액감면 대상 업종에서 제외되는 경우가 많습니다.'
        : '금융·보험업은 창업중소기업 세액감면 대상 업종에 해당하지 않을 가능성이 높습니다.',
    )
    reasons.push('대상 업종 여부를 업종 코드로 다시 확인할 필요가 있습니다.')
    consultScript =
      '대표님 업종은 창업감면 대상 업종에서 제외될 수 있어, 정확한 업종 코드 확인이 먼저 필요합니다.'
  } else if (form.startupForm === 'reopen_same') {
    // D-136: 폐업 후 같은 업종 재개업은 조특법상 창업이 아니다 (§6⑩)
    verdict = 'bad'
    reasons.push('폐업 후 같은 업종을 다시 시작한 것은 조특법상 창업으로 보지 않습니다. (조특법 §6⑩)')
    reasons.push('폐업 전과 업종이 달라졌다면 결과가 달라질 수 있어 확인이 필요합니다.')
    consultScript =
      '폐업 전과 같은 업종을 다시 시작하신 경우 조특법 창업감면은 받기 어렵습니다. 업종이 달라졌는지부터 확인하겠습니다.'
  } else if (isRecognitionWeak(recognition)) {
    verdict = 'caution'
    reasons.push('창업 인정 여부가 불확실하여 감면 적용에 주의가 필요합니다.')
    reasons.push('창업 형태(전환·양수·승계 등)에 따라 적용이 제한될 수 있습니다.')
    consultScript =
      '이 케이스는 신규창업이라기보다 법인전환·사업승계로 볼 여지가 있어 창업감면 적용이 제한될 수 있습니다.'
    // 잔여 감면기간을 이어받더라도 과밀억제권역 + 청년 아님이면 원칙 0%
    if (over !== 'no' && isYouth !== true) {
      verdict = 'conditional'
      reasons.push('과밀억제권역에서 청년이 아니면 원칙적으로 감면이 없어(0%) 생계형·벤처 해당 여부 확인이 필요합니다.')
    }
  } else if (recognition === 'conditional') {
    verdict = 'conditional'
    reasons.push('창업 형태가 확인되어야 감면 적용 여부를 판단할 수 있습니다.')
    reasons.push('신규 창업으로 확인되면 감면 가능성이 높아집니다.')
    consultScript = '창업 형태(신규/전환/양수)를 먼저 확인하면 감면 가능 여부가 분명해집니다.'
  } else if (over === 'no') {
    // 과밀억제권역 밖: 청년 100% · 청년 아님 50% — 둘 다 감면 대상
    verdict = 'good'
    if (isYouth === true) {
      reasons.push('청년 창업 + 수도권 과밀억제권역 외 지역으로 유리한 조건입니다.')
      reasons.push('청년창업중소기업 세액감면(높은 감면율) 적용 가능성을 검토할 수 있습니다.')
      consultScript =
        '대표님은 청년 + 비과밀억제권역 창업으로, 창업감면에서 가장 유리한 구간에 해당할 가능성이 있습니다.'
    } else {
      reasons.push('비과밀억제권역 창업으로 일반 창업중소기업 세액감면(감면율 50%) 검토가 가능합니다.')
      if (isYouth === null) reasons.push('병역 기간을 빼면 청년(감면율 우대)일 수 있어 확인이 필요합니다.')
      consultScript =
        '대표님 케이스는 창업감면 가능성이 있어 보이지만, 업종 코드와 최초 소득 발생연도 확인이 먼저 필요합니다.'
    }
  } else if (isYouth === true) {
    // 과밀억제권역(또는 모름) + 청년: 과밀이면 50%
    verdict = 'caution'
    if (over === 'yes') {
      reasons.push('청년 창업이지만 수도권 과밀억제권역으로 감면율이 50%로 낮아집니다.')
      reasons.push('과밀억제권역에서는 감면율이 낮아지거나 적용이 제한될 수 있습니다.')
      consultScript =
        '청년 창업이지만 과밀억제권역이라 감면율이 달라질 수 있어, 권역 여부 확인이 우선입니다.'
    } else {
      reasons.push('청년 창업이지만 과밀억제권역 여부에 따라 감면율이 50%~100%로 달라집니다.')
      reasons.push('사업장 주소로 과밀억제권역인지 먼저 확인해야 합니다.')
      consultScript = '청년 창업이라 감면 가능성은 있으나, 과밀억제권역 여부에 따라 감면율이 크게 다릅니다.'
    }
  } else {
    // D-136: 과밀억제권역(또는 모름) + 청년 아님 → 원칙 감면 0% (§6①).
    // 예외는 생계형(연 매출 8천만원 이하, §6⑥) · 벤처기업(§6②) — 판정기는 모르므로 '조건부'.
    verdict = 'conditional'
    reasons.push(
      over === 'yes'
        ? '과밀억제권역에서 청년이 아니면 창업감면이 없는 것(0%)이 원칙입니다.'
        : '과밀억제권역이라면 청년이 아닌 경우 창업감면이 없을 수 있습니다(0%).',
    )
    reasons.push('생계형(연 매출 8천만원 이하)·벤처기업이면 감면받을 수 있어 확인이 필요합니다.')
    consultScript =
      '과밀억제권역에서 청년이 아니시면 원칙적으로 감면이 없습니다. 연 매출 8천만원 이하이거나 벤처기업이면 달라지니 그것부터 확인하겠습니다.'
  }

  // 업종 — 대상 업종 목록(§6③)에 확실히 있지 않으면 '가능성 높음' 금지
  if (industry === 'partial') {
    verdict = worstOf(verdict, 'caution')
    reasons.push(
      form.industry === 'wholesale_retail'
        ? '도소매업은 통신판매업만 감면 대상이라 세부 업종 확인이 필요합니다.'
        : '전문서비스업은 변호사·세무사·회계사 등 전문직이 감면 대상에서 빠져 세부 업종 확인이 필요합니다.',
    )
  } else if (industry === 'unknown') {
    verdict = worstOf(verdict, 'caution')
    reasons.push('업종 확인 필요 — 감면 대상 업종인지 업종 코드로 확인해야 합니다.')
  }

  // 감면 기간 — 신규 창업도 5개 과세연도가 지나면 끝 (승계형은 조특법 기준 블록에서 본다)
  const L = facts.lineage
  if (!L.inherited && L.taxLastYear !== null) {
    if (facts.baseYear > L.taxLastYear) {
      verdict = 'bad'
      reasons.push(
        `창업한 해부터 5개 과세연도(~${L.taxLastYear}년)가 지나 감면 기간이 끝났을 가능성이 높습니다.`,
      )
    } else if (facts.baseYear === L.taxLastYear) {
      verdict = worstOf(verdict, 'caution')
      reasons.push(`올해(${L.taxLastYear}년)가 감면 마지막 과세연도일 수 있습니다.`)
    }
  }

  if (facts.after2026) {
    verdict = worstOf(verdict, 'caution')
    reasons.push('2026년 이후 창업은 개정 규정(지역 구분 · 감면율) 확인이 필요합니다.')
  }
  verdict = applyInputCaps(verdict, reasons, facts)

  reasons.push('정확한 감면율은 창업지역, 업종, 과밀억제권역, 최초 소득 발생연도에 따라 달라집니다.')

  return { key: 'incomeTax', title: '법인세 / 소득세 감면', verdict, reasons, checkPoints, consultScript }
}

// 지방세(취득세·재산세) 공용 — 지특법 §58의3 도 조특법 §6③ 업종 목록을 따른다
function applyLocalIndustry(verdict: Verdict, reasons: string[], form: FormData): Verdict {
  const industry = industryClassOf(form.industry)
  if (industry === 'excluded') {
    reasons.push('감면 대상 업종이 아니면 지방세 창업감면도 받기 어렵습니다.')
    return 'bad'
  }
  if (industry !== 'eligible') {
    reasons.push('지방세 창업감면도 대상 업종이어야 하므로 업종 확인이 필요합니다.')
    return worstOf(verdict, 'caution')
  }
  return verdict
}

// ---------------------------------------------------------------------------
// D. 취득세 감면
// ---------------------------------------------------------------------------
function judgeAcquisitionTax(form: FormData, recognition: Verdict, facts: Facts): ItemResult {
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
    // D-136: 지특법 §58의3 창업중소기업 감면은 원칙적으로 과밀억제권역 밖 창업만
    verdict = 'bad'
    reasons.push('지방세 창업감면(지특법 §58의3)은 원칙적으로 과밀억제권역 밖 창업만 대상입니다.')
    reasons.push('과밀억제권역 내 취득은 중과 또는 감면 배제 대상이 될 수 있습니다.')
    consultScript =
      '과밀억제권역이라 취득세는 감면이 어렵고 오히려 불리할 수 있어, 권역·중과 여부 확인이 필요합니다.'
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

  verdict = applyLocalIndustry(verdict, reasons, form)
  verdict = applyInputCaps(verdict, reasons, facts)

  return { key: 'acquisitionTax', title: '취득세 감면', verdict, reasons, checkPoints, consultScript }
}

// ---------------------------------------------------------------------------
// E. 재산세 감면
// ---------------------------------------------------------------------------
function judgePropertyTax(form: FormData, recognition: Verdict, facts: Facts): ItemResult {
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
  } else if (form.overconcentration === 'yes') {
    // D-136: 과밀억제권역이면 재산세도 창업감면 대상 밖이 원칙 (지특법 §58의3)
    verdict = 'bad'
    reasons.push('지방세 창업감면(지특법 §58의3)은 원칙적으로 과밀억제권역 밖 창업만 대상입니다.')
    reasons.push('과밀억제권역 창업은 재산세 감면도 받기 어렵습니다.')
    consultScript = '과밀억제권역 창업이라 재산세 창업감면은 어렵습니다. 예외가 있는지만 확인하겠습니다.'
  } else if (form.overconcentration !== 'no') {
    verdict = 'conditional'
    reasons.push('과밀억제권역 여부가 확인되어야 재산세 감면 판단이 가능합니다.')
    reasons.push('사업용 직접 사용 여부도 함께 확인되어야 합니다.')
    consultScript = '과밀억제권역 여부와 부동산 사용 형태가 확인되어야 재산세 감면 판단이 가능합니다.'
  } else {
    verdict = 'good'
    reasons.push('창업 인정 가능성이 있고 사업용 직접 사용 부동산이면 감면 가능성이 있습니다.')
    reasons.push('단, 투자용·임대용 부동산은 불리하므로 사용 형태 확인이 필요합니다.')
    consultScript =
      '사업장으로 직접 사용하는 부동산이라면 재산세 감면 가능성이 있습니다. 임대·투자용이면 달라집니다.'
  }

  verdict = applyLocalIndustry(verdict, reasons, form)
  verdict = applyInputCaps(verdict, reasons, facts)

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
// ★ 세무사 확인 필요 — 판정기가 단정하지 못한 이유 (D-136)
// ---------------------------------------------------------------------------
function buildAlerts(form: FormData, facts: Facts, age: number | null, regionAlert: string | null): string[] {
  const out: string[] = []
  const industry = industryClassOf(form.industry)

  if (regionAlert) out.push(regionAlert)

  const industryAlert = industryAlertOf(form.industry)
  if (industryAlert) out.push(industryAlert)

  if (form.startupForm === 'reopen_same') {
    out.push('폐업 후 같은 업종 재개업은 조특법상 창업이 아닙니다(§6⑩). 폐업 전과 업종이 정말 같은지 ★확인')
  }

  // 과밀(또는 모름) + 청년 아님 → 원칙 0%
  if (industry !== 'excluded' && form.overconcentration !== 'no' && facts.youthTax !== true) {
    out.push('과밀억제권역에서 청년이 아니면 감면 0%가 원칙입니다. 생계형(연 매출 8천만원 이하)·벤처기업이면 감면 가능 — ★확인')
  }

  if (facts.youthTax === null && age !== null) {
    out.push(`창업 당시 만 ${age}세 — 병역 기간(최대 6년)을 빼면 청년일 수 있습니다. 병역 기간 ★확인`)
  }
  if (form.businessType === 'corporation' && (facts.youthTax === true || (facts.youthTax === null && age !== null))) {
    out.push('법인은 청년 대표가 최대주주(최대출자자)여야 청년 감면을 받습니다 — 지분 ★확인')
  }

  // 감면 기간 (과세연도)
  const L = facts.lineage
  if (L.taxLastYear !== null && L.hasTaxRemaining === false) {
    out.push(
      `감면 기간(~${L.taxLastYear}년 과세연도)이 끝난 것으로 봤습니다. 처음 소득이 난 해가 늦었거나 지난 해분 신고·경정청구가 남았다면 받을 수 있습니다 — ★확인`,
    )
  } else if (L.taxLastYear !== null && L.taxRemainingYears === 1) {
    out.push(`올해(${L.taxLastYear}년)가 감면 마지막 과세연도일 수 있습니다. 처음 소득이 난 해에 따라 달라집니다 — ★확인`)
  }
  // 끝났거나 마지막 해일 때만 — 법인 사업연도가 1~12월이 아니면 경계가 달라진다
  if (L.taxLastYear !== null && L.taxRemainingYears !== null && L.taxRemainingYears <= 1 && form.businessType === 'corporation') {
    out.push('과세연도는 1~12월로 계산했습니다. 법인 사업연도가 다르면 감면 기간이 달라집니다 — ★확인')
  }

  if (facts.after2026) out.push(REVISED_RULE_ALERT)

  if (form.overconcentration === 'yes' && industry !== 'excluded') {
    out.push('과밀억제권역 창업은 취득세·재산세 창업감면(지특법 §58의3) 대상이 아닌 것이 원칙입니다 — 예외 ★확인')
  }

  return [...new Set(out)]
}

// ---------------------------------------------------------------------------
// 종합 판정
// ---------------------------------------------------------------------------
export function judge(inputForm: FormData, baseDate: Date = new Date()): JudgementResult {
  // D-136: 지역과 과밀억제권역 답을 맞춰 본다 (서울 = 전 지역 과밀). 판정은 맞춘 값으로 한다.
  const region = checkRegion(inputForm)
  const form: FormData =
    region.effective === inputForm.overconcentration
      ? inputForm
      : { ...inputForm, overconcentration: region.effective }

  const today = toLocalDay(baseDate)
  const lineage = buildLineage(form, baseDate)
  const birth = parseLocalDate(form.birthDate)
  const start = parseLocalDate(form.startupDate)
  const future = start !== null && start.getTime() > today.getTime()

  // D-136: 조특법 청년은 "창업 당시" 나이 — 승계형은 실질 창업일(기존 사업 최초 개시일) 기준
  const youthStart = parseLocalDate(lineage.effectiveStartDate) ?? start
  const rawAge = birth && youthStart ? calcAge(form.birthDate, youthStart) : null
  const dateOrderWrong = rawAge !== null && rawAge < 0
  const age = dateOrderWrong ? null : rawAge
  const rawAgeNow = birth ? calcAge(form.birthDate, today) : null
  const ageNow = rawAgeNow !== null && rawAgeNow >= 0 ? rawAgeNow : null

  const youth = buildYouthStatus(age, ageNow)
  const isYouth = youth.taxLaw
  const recognition = judgeStartupRecognition(form)

  const facts: Facts = {
    youthTax: isYouth,
    lineage,
    baseYear: today.getFullYear(),
    datesMissing: !birth || !start || dateOrderWrong,
    future,
    after2026: start !== null && formatDate(start) >= REVISED_RULE_FROM,
    regionInconsistent: region.inconsistent,
  }

  const checked = form.checkItems
  const anyChecked =
    checked.incomeTax || checked.acquisitionTax || checked.propertyTax || checked.registrationTax

  // 핵심 항목 (종합판정 대상): 법인세 / 취득세 / 재산세
  const allCore: ItemResult[] = [
    judgeIncomeTax(form, recognition.verdict, facts),
    judgeAcquisitionTax(form, recognition.verdict, facts),
    judgePropertyTax(form, recognition.verdict, facts),
  ]
  const coreItems = allCore.filter((item) => !anyChecked || checked[item.key])

  // 등록면허세 참고 (선택 시 또는 전체일 때 표시)
  const showRegistration = !anyChecked || checked.registrationTax
  const registration = showRegistration ? buildRegistrationReference(form) : null

  const alerts = buildAlerts(form, facts, age, region.alert)
  const frameworks = buildFrameworks(
    form,
    allCore,
    recognition.verdict,
    youth,
    registration ? registration.note : buildRegistrationReference(form).note,
    lineage,
    facts.after2026 ? [REVISED_RULE_ALERT] : [],
  )

  // 종합판정: 핵심 항목(등록면허세 제외) 중 가장 보수적인 상태
  // D-136: 조특법 기준(세액감면) 판정보다 좋게 나오지 않는다 — 머리 판정이 법 기준 블록과 어긋나지 않게
  let overall: Verdict = 'good'
  if (coreItems.length === 0) {
    overall = 'conditional'
  } else {
    for (const item of coreItems) {
      if (VERDICT_RANK[item.verdict] < VERDICT_RANK[overall]) overall = item.verdict
    }
  }
  const taxLaw = frameworks.find((f) => f.key === 'taxLaw')
  if (taxLaw) overall = worstOf(overall, taxLaw.verdict)

  const notice = facts.datesMissing
    ? dateOrderWrong
      ? NOTICE_DATE_ORDER
      : NOTICE_MISSING_DATES
    : future
      ? NOTICE_PRE_STARTUP
      : null

  const keyChecks = buildKeyChecks(form)

  return {
    overall,
    oneLineConclusion: notice ?? VERDICT_ONELINE[overall],
    notice,
    alerts,
    reasons: buildReasons(form, isYouth, age),
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
