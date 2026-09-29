/**
 * 채용 진단 엔진 — 원본 diagnoseHiring(SubsidyApp.jsx 496 줄)·checkWage(54 줄)·EligChk 관문(763 줄).
 *
 * 점수·차단 사유·정렬 순서를 원본 그대로 두었다. 결과는 "가능성" 이지 확정이 아니다.
 */

import { BOSU_FLOOR_2026, ELIG, EXCL, MIN_WAGE_2026 } from './constants'
import { hireWindowBlocks, hireWindowOf } from './hireWindow'
import { YOUTH_MAX_AGE, youthAgeAt, youthByYears, youthLimitLabel } from './dates'
import type { EmpType, Gender, Program } from './programs'

export type Situation = 'new' | 'retain' | 'childcare'
export type Region = '수도권' | '비수도권'

export interface HiringAnswers {
  situation: Situation
  cats: string[]
  specials: string[]
  age: number | null
  gender: Gender | null
  milMonths: number
  region: Region
  companySize: number | null
  empType: EmpType
  preApply: boolean
  noLayoff: boolean
  aboveFloor: boolean
  youthEligible: boolean
}

export type DiagnosisStatus = 'recommend' | 'maybe' | 'exclude'

export interface DiagnosisRow {
  program: Program
  status: DiagnosisStatus
  score: number
  reasons: string[]
  blockers: string[]
  /** ★ 확인할 것 (D-136) — 있으면 '가능성 높음' 으로 올리지 않는다(capped 일 때) */
  cautions: string[]
}

const STATUS_ORDER: Record<DiagnosisStatus, number> = { recommend: 0, maybe: 1, exclude: 2 }

/** 청년일자리도약장려금 참여 기업 — 피보험자 5인 이상 우선지원대상기업(일부 업종 1인 이상 예외) ★ 공고 확인 */
export const YOUTH_JUMP_MIN_INSURED = 5

export function diagnoseHiring(a: HiringAnswers, programs: readonly Program[]): DiagnosisRow[] {
  const results: DiagnosisRow[] = []
  programs.forEach((p) => {
    const m = p.match || ({} as Program['match'])
    let score = 0
    const reasons: string[] = []
    const blockers: string[] = []
    const cautions: string[] = []
    let capped = false
    if (m.deprecated) {
      results.push({ program: p, status: 'exclude', score: 0, reasons: ['2026년 신규 종료'], blockers: [], cautions: [] })
      return
    }
    const catHit = (m.cats || []).some((c) => (a.cats || []).indexOf(c) >= 0)
    if (catHit) {
      score += 40
      reasons.push('대상 유형 일치')
    }
    if (m.special && m.special.length) {
      const spHit = m.special.some((s) => (a.specials || []).indexOf(s) >= 0)
      if (spHit) {
        score += 35
        reasons.push('상황 조건 일치')
      }
    }
    if (m.ageMin != null || m.ageMax != null) {
      const age = a.age != null && Number.isFinite(a.age) ? a.age : null
      if (age != null) {
        // D-136: 청년(15~34세 · 병역 가산) 은 자격요건 화면과 같은 규칙(youthByYears)으로 본다
        const youthRule = !!m.milExtend && m.ageMax === YOUTH_MAX_AGE
        let verdict: 'ok' | 'fail' | 'border'
        if (youthRule) {
          verdict = youthByYears(age, a.gender === 'male' ? a.milMonths : 0) || 'fail'
          if (m.ageMin != null && age < m.ageMin) verdict = 'fail'
        } else {
          verdict = 'ok'
          if (m.ageMin != null && age < m.ageMin) verdict = 'fail'
          if (m.ageMax != null && age > m.ageMax) verdict = 'fail'
        }
        if (verdict === 'ok') {
          score += 15
          reasons.push('나이 요건 충족')
        } else if (verdict === 'border') {
          cautions.push('★ 나이 경계 — 생년월일·입사일·복무기간으로 확인')
          capped = true
        } else {
          blockers.push('나이 요건 미충족')
        }
      } else if (catHit) {
        cautions.push('★ 나이 미입력 — 나이 요건 확인')
        capped = true
      }
    }
    if (m.gender && m.gender !== 'any' && a.gender && a.gender !== m.gender) {
      blockers.push(m.gender === 'female' ? '여성 대상 제도' : '성별 요건')
    }
    if (m.empTypes && a.empType) {
      if (m.empTypes.indexOf(a.empType) < 0) blockers.push('채용형태(' + m.empTypes.join('/') + ') 요건')
      else score += 8
    }
    if (m.companyMax != null && a.companySize != null && a.companySize >= m.companyMax) {
      blockers.push(m.companyMax + '인 미만 대상')
    }
    if (m.companyMin != null && a.companySize != null && a.companySize < m.companyMin) {
      blockers.push(m.companyMin + '인 이상 대상')
    }
    if (m.preApply && a.preApply === false) {
      if (p.id === 'youth_jump') {
        // D-137: 예외는 '입사 후 3개월 안' 뿐 — 그 뒤면 새로 신청할 수 없으니 이유가 아니라 확인할 것
        cautions.push('★ 채용 전에 신청 안 했으면 입사 후 3개월 안에 참여신청 — 지났으면 신청 불가')
        capped = true
      } else {
        blockers.push('사전신청 필수')
      }
    }
    if (m.bosuFloor && a.aboveFloor === false) {
      blockers.push('월보수 124만↑ 필요')
    }
    if (a.noLayoff === false) {
      blockers.push('최근 감원 이력—신청 제한')
    }
    if (p.id === 'youth_jump' && a.region === '수도권' && a.youthEligible === false) {
      blockers.push('수도권은 취업애로요건 필수')
    }
    if (p.id === 'youth_jump' && a.region === '비수도권' && catHit) {
      score += 12
      reasons.push('비수도권: 기업+청년 합산 가능')
    }
    // D-136: 청년도약은 피보험자 5인 이상 우선지원대상기업 (일부 업종 예외) — 확실하지 않으면 올려 주지 않는다
    if (p.id === 'youth_jump') {
      if (a.companySize != null && Number.isFinite(a.companySize)) {
        if (a.companySize < YOUTH_JUMP_MIN_INSURED) {
          cautions.push('★ 피보험자 5인 미만 — 참여 가능 업종인지 확인')
          capped = true
        }
      } else {
        cautions.push('★ 회사 규모 미입력 — 5인 이상 우선지원대상기업인지 확인')
      }
    }
    let status: DiagnosisStatus
    if (blockers.length > 0 && !catHit && score < 30) status = 'exclude'
    else if (blockers.length > 0) status = 'maybe'
    else if (score >= 55) status = 'recommend'
    else if (score >= 22) status = 'maybe'
    else status = 'exclude'
    if (capped && status === 'recommend') status = 'maybe'
    results.push({ program: p, status: status, score: score, reasons: reasons, blockers: blockers, cautions: cautions })
  })
  results.sort((x, y) => {
    if (STATUS_ORDER[x.status] !== STATUS_ORDER[y.status]) return STATUS_ORDER[x.status] - STATUS_ORDER[y.status]
    return y.score - x.score
  })
  return results
}

/** 입력 글자 → 0 이상 정수. 비었거나 숫자가 아니면 null ('abc' 가 통과하지 않게) */
export function parseCount(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const s = String(v).trim().replace(/,/g, '')
  if (!s) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.floor(n)
}

/**
 * 화면 입력 → 진단 답안. 원본 runDiagnose 가 상황·유형에 따라 cats/specials 를 덧붙이던 규칙 그대로.
 */
export function buildAnswers(input: {
  situation: Situation
  cats: string[]
  specials: string[]
  age: string
  gender: Gender | ''
  milMonths: string
  region: Region
  companySize: string
  empType: EmpType
  preApply: boolean
  noLayoff: boolean
  aboveFloor: boolean
  youthEligible: boolean
}): HiringAnswers {
  const cats = input.cats.slice()
  if (input.situation === 'childcare' && cats.indexOf('육아') < 0) cats.push('육아')
  if (input.situation === 'retain' && cats.indexOf('재직') < 0) cats.push('재직')
  const specials = input.specials.slice()
  if (input.cats.indexOf('여성') >= 0) specials.push('경력단절')
  if (input.cats.indexOf('취약계층') >= 0) specials.push('프로그램이수')
  if (input.cats.indexOf('장애인') >= 0) specials.push('장애')
  return {
    situation: input.situation,
    cats: cats,
    specials: specials,
    age: parseCount(input.age),
    gender: input.gender || null,
    milMonths: parseCount(input.milMonths) || 0,
    region: input.region,
    companySize: parseCount(input.companySize),
    empType: input.empType,
    preApply: input.preApply,
    noLayoff: input.noLayoff,
    aboveFloor: input.aboveFloor,
    youthEligible: input.youthEligible,
  }
}

export interface WageCheck {
  hourlyWage: number
  monthlyHours: number
  minMonthly: number
  minHourly: number
  isAboveMin: boolean
  isAboveFloor: boolean
  gap: number
}

/** 주 소정근로시간 → 월 소정근로시간(주휴 포함). 40시간 이상은 209시간 */
export function monthlyHoursOf(weeklyHours?: number | null): number {
  const wh = Number(weeklyHours) > 0 ? Number(weeklyHours) : 40
  return wh >= 40 ? 209 : Math.round((wh + (wh >= 15 ? (wh / 40) * 8 : 0)) * 4.345)
}

/**
 * 월급·주 소정근로시간 → 시급 환산과 최저임금·보수하한 비교.
 * D-136: 반올림한 시급으로 비교하지 않는다 — 월급 ≥ 최저시급 × 월 시간 을 그대로 비교한다
 * (2,156,879원 / 209시간 은 반올림하면 10,320원이지만 미달이다). 표시 시급은 버림.
 */
export function checkWage(monthlyPay: number | null | undefined, weeklyHours?: number | null): WageCheck | null {
  const pay = Number(monthlyPay)
  if (!Number.isFinite(pay) || pay <= 0) return null
  const mh = monthlyHoursOf(weeklyHours)
  const hourlyWage = Math.floor(pay / mh)
  const minMonthly = MIN_WAGE_2026 * mh
  return {
    hourlyWage: hourlyWage,
    monthlyHours: mh,
    minMonthly: minMonthly,
    minHourly: MIN_WAGE_2026,
    isAboveMin: pay >= minMonthly,
    isAboveFloor: pay >= BOSU_FLOOR_2026,
    gap: hourlyWage - MIN_WAGE_2026,
  }
}

export interface YouthGateInput {
  /** 생년월일 YYYY-MM-DD */
  birthDate: string
  gender: Gender | ''
  milMonths: number
  /** 취업애로요건 체크 (id → 체크됨) */
  elig: Record<string, boolean>
  /** 제외요건 확인 (id → "해당 아님" 확인됨). false 면 해당할 수 있음, undefined 면 미확인 */
  excl: Record<string, boolean | undefined>
  /** 입사일 (나이 기준일). 없으면 오늘 */
  hireDate?: string
  /** D-137: 기준일(오늘) — 입사 3개월 신청 기한을 본다. 없으면 오늘 */
  today?: Date | string
  /** D-137: 이미 참여신청을 해 둔 직원(진행 상태가 준비 다음) — 기한과 상관없이 회차대로 */
  enrolled?: boolean
}

export interface YouthGateResult {
  age: number | null
  ageMonths: number
  maxLabel: string
  ageOk: boolean
  anyElig: boolean
  allExclOk: boolean
  failedExcl: string[]
  nearBorder: boolean
  ok: boolean
  hasBirth: boolean
  /** D-137: 입사일로 본 신청 기한 — 지났으면(참여 중이 아니면) ok 가 아니다 */
  hireWindowBlocked: boolean
  hireWindowText: string
}

/** 생년월일을 모를 때 원본 폼이 넣어 두던 자리값 — 이 값이면 '생년월일 미입력' 으로 본다 */
export const BIRTH_PLACEHOLDER = '2000-01-01'

/**
 * 청년도약 자격요건 관문 — 원본 EligChk 의 aOk/anyE/allXok/nearBorder.
 * D-136: 나이는 youthAgeAt(입사일 기준 만 나이, 병역 가산 최대 6년) 하나로 본다 — 채용 진단과 같은 규칙.
 *        생년월일이 비었거나 자리값(2000-01-01)이면 ok 로 올리지 않는다.
 */
export function youthGate(input: YouthGateInput): YouthGateResult {
  const mil = input.gender === 'male' ? input.milMonths : 0
  const ya = youthAgeAt(input.birthDate, input.hireDate || null, mil)
  const aOk = ya.known && ya.ok
  const anyE = ELIG.some((e) => !!input.elig[e.id])
  const failedX = EXCL.filter((x) => input.excl[x.id] === false)
  const allXok = EXCL.every((x) => input.excl[x.id] === true)
  const has = !!input.birthDate && input.birthDate !== BIRTH_PLACEHOLDER
  const hw = hireWindowOf('youth_jump', input.hireDate || null, input.today ?? new Date())
  const hwBlocked = hireWindowBlocks(hw) && !input.enrolled
  const ok = has && aOk && anyE && allXok && !hwBlocked
  return {
    age: ya.age,
    ageMonths: ya.totalMonths ?? 0,
    maxLabel: youthLimitLabel(mil),
    ageOk: aOk,
    anyElig: anyE,
    allExclOk: allXok,
    failedExcl: failedX.map((x) => x.label),
    nearBorder: ya.byService,
    ok: ok,
    hasBirth: has,
    hireWindowBlocked: hwBlocked,
    hireWindowText: hw.text,
  }
}
