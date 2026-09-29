/**
 * 창업감면 판정기 — 빈 폼과 판정색 (D-88).
 *
 * 화면 파일에서 떼어 둔 것: 단위 시험(`tools.test.ts`)이 화면을 통째로 불러오지 않고 빈 폼만 가져다 쓰고,
 * 화면 파일은 컴포넌트만 내보내야 Fast Refresh 가 온전히 돈다.
 */

import type { Tone } from '../../../components/ui/primitives'
import type { AdvancedInput, FormData as StartupTaxForm, Verdict } from '../types'

export const EMPTY_ADVANCED: AdvancedInput = {
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

export const EMPTY_FORM: StartupTaxForm = {
  businessType: '',
  birthDate: '',
  startupDate: '',
  region: '',
  overconcentration: '',
  industry: '',
  startupForm: '',
  checkItems: { incomeTax: false, acquisitionTax: false, propertyTax: false, registrationTax: false },
  advanced: { ...EMPTY_ADVANCED },
}

/**
 * 화면이 처음 보여 주는 예시 날짜 (원본 사양: 생년월일 1980-01-01, 창업일 2020-01-01).
 * D-136: 이 값은 '안 적은 것' 으로 본다 — 판정에 쓰지 않는다(업체 정보 채움 · 업체 정보 보내기도 같은 규칙).
 */
export const PLACEHOLDER_BIRTH = '1980-01-01'
export const PLACEHOLDER_STARTUP = '2020-01-01'

/** 판정에 넘길 폼 — 예시 날짜 그대로면 빈 칸으로 바꾼다(판정기는 '생년월일·창업일을 입력해야 판정합니다' 로 답한다) */
export function withoutPlaceholders(form: StartupTaxForm): StartupTaxForm {
  const birthDate = form.birthDate === PLACEHOLDER_BIRTH ? '' : form.birthDate
  const startupDate = form.startupDate === PLACEHOLDER_STARTUP ? '' : form.startupDate
  if (birthDate === form.birthDate && startupDate === form.startupDate) return form
  return { ...form, birthDate, startupDate }
}

/** 판정 4단계 → OS 색 (초록·노랑·주황·빨강 그대로) */
export const VERDICT_TONE: Record<Verdict, Tone> = {
  good: 'success',
  caution: 'warning',
  conditional: 'warning',
  bad: 'danger',
}
