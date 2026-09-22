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

/** 판정 4단계 → OS 색 (초록·노랑·주황·빨강 그대로) */
export const VERDICT_TONE: Record<Verdict, Tone> = {
  good: 'success',
  caution: 'warning',
  conditional: 'warning',
  bad: 'danger',
}
