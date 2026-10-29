import type { FormData, Overconcentration, Verdict } from '../types'

// ---------------------------------------------------------------------------
// 판정 공용 규칙 (D-136)
// ---------------------------------------------------------------------------

// 판정 사다리 (나쁨 → 좋음)
const LADDER: Verdict[] = ['bad', 'conditional', 'caution', 'good']

/** 둘 중 더 보수적인(나쁜) 판정 */
export function worstOf(a: Verdict, b: Verdict): Verdict {
  return LADDER.indexOf(a) <= LADDER.indexOf(b) ? a : b
}

// ---------------------------------------------------------------------------
// 업종 — 조특법 §6③ 은 "감면 대상 업종을 적어 둔 목록" 이다.
// 목록에 없거나 모르는 업종은 절대 '가능성 높음' 으로 보지 않는다.
//  eligible : 제조 · 정보통신 · 음식점 (세부 제외는 업종코드로 확인)
//  partial  : 도소매(통신판매업만 대상) · 전문서비스(변호사·세무사 등 전문직 제외)
//  excluded : 부동산 · 금융보험
//  unknown  : 기타 · 빈칸 · 이 판정기가 모르는 값
// ---------------------------------------------------------------------------
export type IndustryClass = 'eligible' | 'partial' | 'excluded' | 'unknown'

export function industryClassOf(industry: string): IndustryClass {
  switch (industry) {
    case 'manufacturing':
    case 'ict':
    case 'restaurant':
      return 'eligible'
    case 'wholesale_retail':
    case 'professional':
      return 'partial'
    case 'real_estate':
    case 'finance_insurance':
      return 'excluded'
    default:
      return 'unknown'
  }
}

/** 업종 때문에 단정하지 못하는 이유 (★ 세무사 확인) — 없으면 null */
export function industryAlertOf(industry: string): string | null {
  switch (industryClassOf(industry)) {
    case 'eligible':
      return null
    case 'partial':
      return industry === 'wholesale_retail'
        ? '도소매업은 통신판매업(온라인 판매)만 감면 대상입니다. 일반 도매·소매는 대상이 아닙니다 — ★확인'
        : '전문서비스업 중 변호사·변리사·법무사·회계사·세무사·수의사·행정사·건축설계 등은 감면 대상이 아닙니다 — ★확인'
    case 'excluded':
      return industry === 'finance_insurance'
        ? '금융·보험업은 감면 대상이 아닌 것이 원칙입니다. 정보통신을 활용한 금융서비스 일부만 예외라 ★확인'
        : null
    default:
      return '업종 확인 필요 — 주업종 코드가 감면 대상 업종(조특법 §6③)에 있는지 ★확인'
  }
}

// ---------------------------------------------------------------------------
// 지역 ↔ 과밀억제권역 답 맞춰 보기
//  - 서울은 전 지역이 과밀억제권역 → '아니오' 라고 답해도 과밀로 본다
//  - 지방(광역시·기타)에는 과밀억제권역이 없다 → '예' 면 두 답이 맞지 않음 (보수적으로 과밀로 보고 주의)
//  - 경기·인천은 일부만 과밀억제권역 → 답은 그대로 두고 주소 확인 안내
// ---------------------------------------------------------------------------
export interface RegionCheck {
  effective: Overconcentration | '' // 판정에 쓰는 과밀억제권역 값
  inconsistent: boolean // 두 답이 서로 맞지 않음 → 판정 상한 '주의'
  alert: string | null
}

export function checkRegion(form: Pick<FormData, 'region' | 'overconcentration'>): RegionCheck {
  const oc = form.overconcentration
  switch (form.region) {
    case 'seoul':
      if (oc === 'yes') return { effective: 'yes', inconsistent: false, alert: null }
      if (oc === 'no') {
        return {
          effective: 'yes',
          inconsistent: true,
          alert: '서울은 전 지역이 수도권 과밀억제권역입니다. "아니오" 로 답했지만 과밀로 보고 판정했습니다 — 사업장 주소 ★확인',
        }
      }
      return {
        effective: 'yes',
        inconsistent: false,
        alert: '서울은 전 지역이 수도권 과밀억제권역이라 과밀로 보고 판정했습니다.',
      }
    case 'metro_city':
    case 'other_local':
      if (oc === 'yes') {
        return {
          effective: 'yes',
          inconsistent: true,
          alert: '지방인데 과밀억제권역 "예" 로 답했습니다. 과밀억제권역은 수도권에만 있어 두 답이 맞지 않습니다 — 사업장 주소 ★확인',
        }
      }
      return { effective: oc, inconsistent: false, alert: null }
    case 'gyeonggi_incheon':
      return {
        effective: oc,
        inconsistent: false,
        alert: '경기·인천은 일부 지역만 과밀억제권역입니다. 사업장 주소(시·군·구)로 ★확인',
      }
    default:
      return { effective: oc, inconsistent: false, alert: null }
  }
}

/** 2026-01-01 이후 창업은 개정 감면율표(조특법 §6① 2호 · 시행령 §5②)로 본다 — D-318 */
export const REVISED_RULE_FROM = '2026-01-01'
export const REVISED_RULE_ALERT = '사업장이 가평 · 연천 · 강화 · 옹진(수도권 인구감소지역)이면 수도권 밖과 같은 감면율, 아니면 한 단계 낮은 감면율(청년 75% · 일반 25%) — 주소 ★확인'

/**
 * D-318 창업감면(법인세 · 소득세) 감면율 — 조특법 §6① · ⑥ · 시행령 §5②.
 *  2025년까지 창업: 과밀억제권역 밖 청년 100 · 일반 50 / 과밀억제권역 청년 50 · 일반 0
 *  2026년부터 창업: 수도권 밖 · 수도권 인구감소지역 청년 100 · 일반 50 / 수도권(과밀 · 인구감소지역 밖) 청년 75 · 일반 25 / 과밀억제권역 청년 50 · 일반 0
 *  일반 창업도 연 수입금액 8천만원 이하인 해(§6⑥)는 청년과 같은 감면율.
 * 예전에는 2026년 이후 창업을 '개정 규정 확인 필요' 로만 두고 '주의' 로 막았다.
 */
export const METRO_POP_DECLINE = ['가평군', '연천군', '강화군', '옹진군']
export type StartupZone = 'outside' | 'metro' | 'metro_unsure' | 'overcrowded' | 'unknown'

export function startupZone(form: Pick<FormData, 'region' | 'overconcentration' | 'popDecline'>, after2026: boolean): StartupZone {
  if (form.overconcentration === 'yes') return 'overcrowded'
  if (form.region === 'metro_city' || form.region === 'other_local') return 'outside'
  if (form.overconcentration !== 'no') return 'unknown'
  // 과밀억제권역 밖 — 2025년까지는 지역을 더 나누지 않는다
  if (!after2026 || form.region !== 'gyeonggi_incheon') return 'outside'
  return form.popDecline === 'yes' ? 'outside' : form.popDecline === 'no' ? 'metro' : 'metro_unsure'
}

export interface StartupRates {
  youth: number | null
  general: number | null
  /** 사람이 읽는 한 줄 — '청년 100% · 일반 50%' · '청년 75~100% · 일반 25~50%' */
  text: string
}

export function startupRates(zone: StartupZone, after2026: boolean): StartupRates {
  if (zone === 'outside') return { youth: 100, general: 50, text: '청년 100% · 일반 50%' }
  if (zone === 'overcrowded') return { youth: 50, general: 0, text: '청년 50% · 일반 0%(연 수입금액 8천만원 이하인 해는 50%)' }
  if (zone === 'metro') return { youth: 75, general: 25, text: '청년 75% · 일반 25%(연 수입금액 8천만원 이하인 해는 75%)' }
  if (zone === 'metro_unsure') return { youth: null, general: null, text: '청년 75~100% · 일반 25~50%(인구감소지역이면 높은 쪽)' }
  return { youth: null, general: null, text: after2026 ? '청년 50~100% · 일반 0~50%(권역에 따라)' : '청년 50~100% · 일반 0~50%(과밀억제권역 여부에 따라)' }
}

/**
 * D-325 창업벤처중소기업(조특법 §6②) — 창업 후 3년 안에 벤처기업으로 확인받으면, 확인받은 뒤 처음 소득이 난 해부터 5년 50%.
 * 권역(과밀억제권역 포함) · 나이와 상관없다. §6① 감면과 겹치면 유리한 쪽 하나.
 * true = 창업일부터 3년 안 확인 · false = 3년 뒤 확인 · null = 확인일 · 창업일을 모름
 */
export const VENTURE_STARTUP_RATE = 50
export function ventureWithin3y(startupDate: string, ventureDate: string | undefined): boolean | null {
  if (!ventureDate || !/^\d{4}-\d{2}-\d{2}$/.test(ventureDate) || !/^\d{4}-\d{2}-\d{2}$/.test(startupDate)) return null
  if (ventureDate < startupDate) return true // 창업 전에 받은 예비벤처 등 — 3년 안으로 본다(★ 확인)
  const y = Number(startupDate.slice(0, 4)) + 3
  return ventureDate < `${y}${startupDate.slice(4)}`
}
