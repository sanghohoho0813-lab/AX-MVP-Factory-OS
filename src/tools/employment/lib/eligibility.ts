/**
 * 채용 진단 엔진 — 원본 diagnoseHiring(SubsidyApp.jsx 496 줄)·checkWage(54 줄)·EligChk 관문(763 줄).
 *
 * 점수·차단 사유·정렬 순서를 원본 그대로 두었다. 결과는 "가능성" 이지 확정이 아니다.
 */

import { BOSU_FLOOR_2026, ELIG, EXCL, MIN_WAGE_2026 } from './constants'
import { calcAgeDetailed, calcMilitaryLimit } from './dates'
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
}

const STATUS_ORDER: Record<DiagnosisStatus, number> = { recommend: 0, maybe: 1, exclude: 2 }

export function diagnoseHiring(a: HiringAnswers, programs: readonly Program[]): DiagnosisRow[] {
  const results: DiagnosisRow[] = []
  programs.forEach((p) => {
    const m = p.match || ({} as Program['match'])
    let score = 0
    const reasons: string[] = []
    const blockers: string[] = []
    if (m.deprecated) {
      results.push({ program: p, status: 'exclude', score: 0, reasons: ['2026년 신규 종료'], blockers: [] })
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
      let maxAge = m.ageMax
      if (m.milExtend && a.gender === 'male' && a.milMonths > 0) {
        maxAge = calcMilitaryLimit(a.milMonths).maxYears
      }
      if (a.age != null) {
        let ageOk = true
        if (m.ageMin != null && a.age < m.ageMin) ageOk = false
        if (maxAge != null && a.age > maxAge) ageOk = false
        if (ageOk) {
          score += 15
          reasons.push('나이 요건 충족')
        } else {
          blockers.push('나이 요건 미충족')
        }
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
        reasons.push('사전신청 원칙(입사 3개월 내 예외)')
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
    let status: DiagnosisStatus
    if (blockers.length > 0 && !catHit && score < 30) status = 'exclude'
    else if (blockers.length > 0) status = 'maybe'
    else if (score >= 55) status = 'recommend'
    else if (score >= 22) status = 'maybe'
    else status = 'exclude'
    results.push({ program: p, status: status, score: score, reasons: reasons, blockers: blockers })
  })
  results.sort((x, y) => {
    if (STATUS_ORDER[x.status] !== STATUS_ORDER[y.status]) return STATUS_ORDER[x.status] - STATUS_ORDER[y.status]
    return y.score - x.score
  })
  return results
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
    age: input.age !== '' ? Number(input.age) : null,
    gender: input.gender || null,
    milMonths: Number(input.milMonths) || 0,
    region: input.region,
    companySize: input.companySize !== '' ? Number(input.companySize) : null,
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

/** 월급·주 소정근로시간 → 시급 환산과 최저임금·보수하한 비교 */
export function checkWage(monthlyPay: number | null | undefined, weeklyHours?: number | null): WageCheck | null {
  if (!monthlyPay || monthlyPay <= 0) return null
  const wh = weeklyHours || 40
  const mh = wh >= 40 ? 209 : Math.round((wh + (wh >= 15 ? (wh / 40) * 8 : 0)) * 4.345)
  const hourlyWage = Math.round(monthlyPay / mh)
  const minMonthly = Math.round(MIN_WAGE_2026 * mh)
  return {
    hourlyWage: hourlyWage,
    monthlyHours: mh,
    minMonthly: minMonthly,
    minHourly: MIN_WAGE_2026,
    isAboveMin: hourlyWage >= MIN_WAGE_2026,
    isAboveFloor: monthlyPay >= BOSU_FLOOR_2026,
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
}

/** 청년도약 자격요건 관문 — 원본 EligChk 의 aOk/anyE/allXok/nearBorder 계산 그대로 */
export function youthGate(input: YouthGateInput): YouthGateResult {
  const ageD = calcAgeDetailed(input.birthDate, input.hireDate)
  const age = ageD ? ageD.years : null
  const ageMonths = ageD ? ageD.totalMonths : 0
  const milLimit =
    input.gender === 'male' ? calcMilitaryLimit(input.milMonths) : { maxTotalMonths: 34 * 12, maxYears: 34, maxRemainMonths: 0 }
  const aOk = ageD !== null && ageMonths >= 15 * 12 && ageMonths <= milLimit.maxTotalMonths
  const anyE = ELIG.some((e) => !!input.elig[e.id])
  const failedX = EXCL.filter((x) => input.excl[x.id] === false)
  const allXok = EXCL.every((x) => input.excl[x.id] === true)
  const ok = aOk && anyE && allXok
  const has = !!input.birthDate && input.birthDate !== '2000-01-01'
  const maxLabel =
    milLimit.maxRemainMonths > 0 ? '만' + milLimit.maxYears + '세' + milLimit.maxRemainMonths + '개월' : '만' + milLimit.maxYears + '세'
  const nearBorder = !!ageD && input.gender === 'male' && input.milMonths > 0 && ageMonths > 34 * 12 && ageMonths <= milLimit.maxTotalMonths
  return {
    age: age,
    ageMonths: ageMonths,
    maxLabel: maxLabel,
    ageOk: aOk,
    anyElig: anyE,
    allExclOk: allXok,
    failedExcl: failedX.map((x) => x.label),
    nearBorder: nearBorder,
    ok: ok,
    hasBirth: has,
  }
}
