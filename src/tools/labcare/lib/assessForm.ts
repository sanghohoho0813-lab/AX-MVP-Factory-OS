/**
 * D-618 설립 가능성 체크의 입력 한 벌 — 모듈 화면과 업체 맞춤 추천(카드 · AI 도우미 자료)이 같이 쓴다.
 *
 * 예전에는 맞춤 추천의 연구소 줄이 '직원 수' 만 보는 따로 된 규칙이었고, 모듈 화면은 `assessFeasibility` 였다 —
 * 같은 업체가 두 곳에서 다른 말을 들었다. 이제 두 곳 모두 이 파일로 입력을 만들고 같은 판정 함수를 부른다.
 *
 *  - 기본값 · 남겨 둔 답 읽기 · 업체 기록으로 빈 칸 채우기 · 판정 입력 만들기는 여기 한 곳.
 *  - 규칙(인원 · 자격 · 공간)은 `feasibility.ts` 그대로 — 여기서는 한 글자도 바꾸지 않는다.
 * 규칙 계산이다 — AI 가 아니다.
 */
import type { ClientOpsRecord } from '../../../types/clientOps'
import { clientFacts, monthsInBusiness, type ClientFacts } from '../../shared/clientPrefill'
import { sharedToolKey } from '../../shared/toolStorage'
import type { ActivityNature, CompanySize, FeasibilityInput, FeasibilityResult, IndustryField, LabTypeChoice, NegativeActivity, ResearcherCandidate } from '../types'
import { isExcludedIndustryText } from './assessmentOptions'
import { assessFeasibility, requiredForLab } from './feasibility'
import { businessAgeLabel, withinStartupYears } from './startup'

/** 화면이 들고 있는 값 그대로(이 브라우저에 남기는 모양과 같다) */
export interface AssessForm {
  desiredType: LabTypeChoice
  companyName: string
  industry: string
  customIndustry: boolean
  industryField: IndustryField
  isExcludedIndustry: boolean
  companySize: CompanySize
  sizeConfirmed: boolean
  isVenture: boolean
  isResearcherFounded: boolean
  establishedAt: string
  becameMediumWithinYear: boolean
  employeeCount: string
  isOverseasLab: boolean
  isForProfit: boolean
  hasBusinessOps: boolean
  rndOnlyCompany: boolean
  isSubUnit: boolean
  projectName: string
  preCommercial: boolean
  activityNature: ActivityNature
  negativeActivities: NegativeActivity[]
  hasSpace: boolean
  independentSpace: boolean
  fixedWallsAndDoor: boolean
  movableWallPossible: boolean
  spaceUnder50: boolean
  adequateArea: boolean
  equipmentInSpace: boolean
  isInfoServiceOrSW: boolean
  pick: number
  candidates: ResearcherCandidate[]
}

let cidSeq = 0
export function newCandidate(): ResearcherCandidate {
  cidSeq += 1
  return {
    id: `cand-${Date.now()}-${cidSeq}`,
    name: '',
    isCeo: false,
    isRegisteredExec: false,
    fullTime: true,
    insured: true,
    researchDedicated: true,
    hasOtherDuties: false,
    daytimeGradSchool: false,
    education: '학사',
    major: '공학계열',
    cert: '없음',
    researchYears: 0,
    dutyDescription: '',
  }
}

/** 처음 열었을 때의 값 — 화면의 기본값과 같다(D-136: 규모는 고르기 전 · 50㎡ 예외는 '아니오' 에서) */
export function defaultAssessForm(): AssessForm {
  return {
    desiredType: '아직 모름',
    companyName: '',
    industry: '',
    customIndustry: false,
    industryField: '과학기술 분야',
    isExcludedIndustry: false,
    companySize: '소기업',
    sizeConfirmed: false,
    isVenture: false,
    isResearcherFounded: false,
    establishedAt: '',
    becameMediumWithinYear: false,
    employeeCount: '',
    isOverseasLab: false,
    isForProfit: true,
    hasBusinessOps: true,
    rndOnlyCompany: false,
    isSubUnit: true,
    projectName: '',
    preCommercial: true,
    activityNature: '새로운 제품·공정·서비스 개발',
    negativeActivities: [],
    hasSpace: true,
    independentSpace: true,
    fixedWallsAndDoor: true,
    movableWallPossible: false,
    spaceUnder50: false,
    adequateArea: true,
    equipmentInSpace: true,
    isInfoServiceOrSW: false,
    pick: 1,
    candidates: [newCandidate()],
  }
}

/** D-165: 설립 가능성 체크에 적은 것 — 업체마다 이 브라우저에 남긴다 */
const ASSESS_FORM_KEY = 'axmvp.tools.labcare.assessForm'
export const assessFormKey = (clientId: string | null) => (clientId ? `${ASSESS_FORM_KEY}.${clientId}` : sharedToolKey(ASSESS_FORM_KEY))

/** D-619 답을 남긴 때 — 이 브라우저에 남기는 값 안에 같이 적는다(판정 입력이 아니다 · 사람이 고쳤을 때만 새로 적는다) */
export const ASSESS_SAVED_AT = '_savedAt'

/** 남겨 둔 답(없거나 읽지 못하면 빈 것) — 브라우저 밖(시험 · 서버)에서는 늘 빈 것 */
export function readAssessForm(clientId: string | null): Record<string, unknown> {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(assessFormKey(clientId))
    const v = raw ? (JSON.parse(raw) as unknown) : null
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** 남긴 값이 같은 모양일 때만 쓴다(옛 모양 · 깨진 값은 기본값) */
export function restoreAssessForm(saved: Record<string, unknown> | null | undefined): AssessForm {
  const base = defaultAssessForm()
  if (!saved) return base
  const out = base as unknown as Record<string, unknown>
  for (const k of Object.keys(out)) {
    const v = saved[k]
    const fallback = out[k]
    if (v === undefined || v === null) continue
    if (Array.isArray(fallback)) {
      if (Array.isArray(v)) out[k] = v
    } else if (typeof v === typeof fallback) out[k] = v
  }
  return out as unknown as AssessForm
}

/**
 * 업체 기록으로 빈 칸만 채운다(D-126 · D-134 · D-136 · D-329 그대로) — 이미 적은 값은 덮지 않는다.
 * 돌려주는 patch 를 화면이 그대로 넣고, filled 는 '무엇을 채웠나' 한 줄에 쓴다.
 */
export function prefillAssessForm(form: AssessForm, facts: ClientFacts): { patch: Partial<AssessForm>; filled: string[] } {
  const patch: Partial<AssessForm> = {}
  const filled: string[] = []
  if (facts.companyName && !form.companyName.trim()) {
    patch.companyName = facts.companyName
    filled.push('회사명')
  }
  if (facts.industryText && !form.industry.trim()) {
    patch.industry = facts.industryText
    patch.customIndustry = true
    // D-136: 채운 업종도 직접 적은 것과 같이 제외 업종인지 본다
    patch.isExcludedIndustry = isExcludedIndustryText(facts.industryText)
    filled.push('업종')
  }
  if (facts.establishedAt && !form.establishedAt) {
    patch.establishedAt = facts.establishedAt
    filled.push('설립일')
  }
  // 직원 수는 판정에 안 쓰니 채웠다고 알리지 않는다(참고 칸만 채움)
  if (facts.employeeCount !== null && form.employeeCount === '') patch.employeeCount = String(facts.employeeCount)
  // D-329 서류함의 중소기업 확인서 → 기업 규모 · 벤처기업확인서(유효) → 벤처(전담요원 2명 기준)
  if (facts.smeSize && !form.sizeConfirmed) {
    patch.companySize = facts.smeSize
    patch.sizeConfirmed = true
    filled.push(`중소기업 확인서의 기업 규모(${facts.smeSize})`)
  }
  if (facts.ventureValidNow && !form.isVenture) {
    patch.isVenture = true
    filled.push('벤처기업 확인')
  }
  return { patch, filled }
}

/** 화면 값 → 판정 입력(설립일을 모르면 개월 수는 쓰지 않는다 — withinStartup3y = null 이 특례를 막는다) */
export function assessInputOf(form: AssessForm, today: Date): FeasibilityInput {
  const months = monthsInBusiness(form.establishedAt, today)
  return {
    desiredType: form.desiredType,
    companyName: form.companyName,
    industry: form.industry,
    industryField: form.industryField,
    isExcludedIndustry: form.isExcludedIndustry,
    companySize: form.companySize,
    sizeConfirmed: form.sizeConfirmed,
    isVenture: form.isVenture,
    isResearcherFounded: form.isResearcherFounded,
    businessMonths: months ?? 999,
    withinStartup3y: withinStartupYears(form.establishedAt, today),
    becameMediumWithinYear: form.companySize === '중기업' ? form.becameMediumWithinYear : false,
    employeeCount: Number(form.employeeCount) || 0,
    isOverseasLab: form.isOverseasLab,
    isForProfit: form.isForProfit,
    hasBusinessOps: form.hasBusinessOps,
    rndOnlyCompany: form.rndOnlyCompany,
    isSubUnit: form.isSubUnit,
    projectName: form.projectName,
    preCommercial: form.preCommercial,
    activityNature: form.activityNature,
    negativeActivities: form.negativeActivities,
    hasSpace: form.hasSpace,
    independentSpace: form.independentSpace,
    fixedWallsAndDoor: form.fixedWallsAndDoor,
    movableWallPossible: form.movableWallPossible,
    spaceUnder50: form.spaceUnder50,
    adequateArea: form.adequateArea,
    equipmentInSpace: form.equipmentInSpace,
    isInfoServiceOrSW: form.isInfoServiceOrSW,
    candidates: form.candidates,
  }
}

/** 후보자를 아직 한 명도 적지 않았나(이름 · 맡은 일 · 경력이 모두 처음 그대로) */
export function candidatesUntouched(form: AssessForm): boolean {
  return form.candidates.every((c) => !c.name.trim() && !c.dutyDescription.trim() && !c.researchYears && !c.isCeo && c.education === '학사' && c.cert === '없음')
}

export type LabTone = 'good' | 'maybe' | 'need' | 'no'

/** 카드 · 모듈 맨 위 줄이 같이 쓰는 한 줄 판정 */
export interface LabVerdictLine {
  tone: LabTone
  /** 판정 이름(모듈 결과 칸과 같은 글자) */
  verdict: string
  headline: string
  detail: string
  /** 판정에 더 필요한 것(이것만 넣으면 판정이 나온다) */
  needs: string[]
}

const TONE_OF: Record<FeasibilityResult['verdict'], LabTone> = {
  '기업부설연구소 가능': 'good',
  '연구개발전담부서 우선 추천': 'good',
  '보완 후 가능': 'maybe',
  '현재 진행 비추천': 'no',
  '추가 확인 필요': 'need',
}

/**
 * 판정 결과 → 한 줄. 모듈의 판정 이름을 그대로 쓰고, 아직 답하지 않은 것(규모 · 후보자)은 '더 필요한 것' 으로 꺼낸다.
 * 업체 맞춤 추천 카드 · AI 도우미에 가는 자료 · 모듈 화면 맨 위 줄이 모두 이 글이다.
 */
export function labVerdictLine(form: AssessForm, result: FeasibilityResult, today: Date): LabVerdictLine {
  const input = assessInputOf(form, today)
  const within = input.withinStartup3y
  const age = businessAgeLabel(form.establishedAt, today)
  const needs: string[] = []
  if (!form.sizeConfirmed && !form.isVenture && !form.isResearcherFounded && !form.isOverseasLab) needs.push('기업 규모(소기업 · 중기업)')
  const blank = candidatesUntouched(form)
  if (blank) needs.push('연구전담요원 후보(학위 · 전공 · 경력)')
  if (!form.establishedAt) needs.push('설립일')

  // 인원 기준 한 줄 — 규모를 알면 그 기준, 모르면 '소기업이면' 으로(특례는 설립일로 확인될 때만 말한다)
  const reqKnown = requiredForLab(input)
  const reqIfSmall = requiredForLab({ ...input, companySize: '소기업', sizeConfirmed: true })
  const sizeSettled = needs[0] !== '기업 규모(소기업 · 중기업)'
  const startupText = within === true ? `창업 3년 이내${age ? `(${age})` : ''}` : within === false && age ? `업력 ${age}` : ''
  const headcount = sizeSettled
    ? `기업부설연구소는 연구전담요원 ${reqKnown}명 · 연구개발전담부서는 1명이 필요해요`
    : `소기업이면 기업부설연구소는 연구전담요원 ${reqIfSmall}명 · 연구개발전담부서는 1명부터(중기업 5명)`
  const basis = [startupText, headcount].filter(Boolean).join(' — ')

  if (blank) {
    // 후보자를 적기 전 — 판정 이름은 모듈과 같이 '추가 확인 필요', 무엇을 넣으면 되는지를 먼저 말한다
    return {
      tone: 'need',
      verdict: result.verdict,
      headline: `연구소 설립 — ${needs.slice(0, 2).join(' · ')}만 넣으면 바로 판정돼요`,
      detail: basis,
      needs,
    }
  }
  const count = `인정 가능 ${result.eligibleCount}명 · 추가 확인 ${result.reviewCount}명 · 필요 ${result.requiredResearchers}명`
  const first = result.improvements[0] ?? ''
  return {
    tone: TONE_OF[result.verdict],
    verdict: result.verdict,
    headline: `${result.verdict} — ${result.recommendedType} · ${count}`,
    detail: [first, basis].filter(Boolean).join(' · '),
    needs,
  }
}

/*
 * D-619 답은 두 곳에 있을 수 있다 — 이 브라우저(적는 대로 남는다) · 업체 기록([업체 기록에 붙이기] 때 답도 같이 붙는다).
 * 업체 기록은 다른 기기 · 같은 작업공간의 다른 사람 화면에도 가므로, 붙여 둔 답이 더 새것이면 그 답으로 판정한다.
 * 그래서 PC 에서 답하고 붙이면 휴대폰의 카드 · AI 도우미 · 모듈 화면이 같은 글이 된다.
 */

/** 업체 기록에 붙인 설립 가능성 체크의 답 */
export interface AttachedAssess {
  form: Record<string, unknown>
  /** 붙인 때 */
  at: string
}

function plainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

/** 붙인 답이 화면이 읽을 수 있는 모양인가(후보자는 이름표가 있는 칸 묶음 · 해당 없는 활동은 글자 목록) */
function usableAssessForm(form: Record<string, unknown>): boolean {
  const c = form.candidates
  if (c !== undefined && !(Array.isArray(c) && c.length > 0 && c.every((x) => plainObject(x) && typeof x.id === 'string'))) return false
  const n = form.negativeActivities
  if (n !== undefined && !(Array.isArray(n) && n.every((x) => typeof x === 'string'))) return false
  return true
}

/** 업체 기록에 붙인 설립 가능성 체크 가운데 가장 최근 답(답이 같이 붙은 것만 — 예전에 붙인 결과에는 답이 없다) */
export function attachedAssessForm(record: Pick<ClientOpsRecord, 'toolResults'> | null | undefined): AttachedAssess | null {
  let best: AttachedAssess | null = null
  for (const r of record?.toolResults ?? []) {
    if (r.toolKey !== 'labcare') continue
    const d = r.data as { kind?: unknown; form?: unknown } | null
    if (d?.kind !== 'assess' || !plainObject(d.form) || !usableAssessForm(d.form)) continue
    if (!best || Date.parse(r.createdAt) > Date.parse(best.at)) best = { form: d.form, at: r.createdAt }
  }
  return best
}

export interface PickedAssess {
  saved: Record<string, unknown>
  /** local = 이 브라우저 · record = 업체 기록에 붙인 답 · none = 아직 없음 */
  from: 'local' | 'record' | 'none'
  /** 그 답을 남긴 때(모르면 빈 글자) */
  at: string
}

/** 이 브라우저의 답과 업체 기록에 붙인 답 가운데 더 새것 — 때를 모르는 이 브라우저 답(예전 것)은 붙인 답에 진다 */
export function pickAssessSaved(local: Record<string, unknown>, attached: AttachedAssess | null): PickedAssess {
  const stamp = local[ASSESS_SAVED_AT]
  const localAt = typeof stamp === 'string' ? stamp : ''
  const hasLocal = Object.keys(local).some((k) => k !== ASSESS_SAVED_AT)
  if (!attached) return { saved: local, from: hasLocal ? 'local' : 'none', at: localAt }
  if (hasLocal && localAt && Date.parse(localAt) >= Date.parse(attached.at)) return { saved: local, from: 'local', at: localAt }
  return { saved: attached.form, from: 'record', at: attached.at }
}

/** 두 답이 같은 내용인가(남긴 때는 빼고 · 화면이 읽는 칸만) */
export function sameAssessAnswers(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(restoreAssessForm(a)) === JSON.stringify(restoreAssessForm(b))
}

/** 이 업체의 답 — 이 브라우저와 업체 기록 가운데 더 새것(카드 · AI 도우미 자료 · 모듈 화면이 같이 쓴다) */
export function savedAssessFor(record: Pick<ClientOpsRecord, 'id' | 'toolResults'>): PickedAssess {
  return pickAssessSaved(readAssessForm(record.id), attachedAssessForm(record))
}

/** 업체 기록 하나로 설립 가능성 판정 — 남겨 둔 답(이 브라우저 · 업체 기록에 붙인 것 가운데 새것)이 있으면 그 답으로(모듈 화면과 같은 값) */
export function clientLabFeasibility(record: ClientOpsRecord, today: Date, saved: Record<string, unknown> = savedAssessFor(record).saved): { form: AssessForm; result: FeasibilityResult; line: LabVerdictLine } {
  const restored = restoreAssessForm(saved)
  const form: AssessForm = { ...restored, ...prefillAssessForm(restored, clientFacts(record, today)).patch }
  const result = assessFeasibility(assessInputOf(form, today))
  return { form, result, line: labVerdictLine(form, result, today) }
}
