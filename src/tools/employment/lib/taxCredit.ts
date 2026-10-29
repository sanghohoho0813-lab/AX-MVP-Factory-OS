/**
 * 통합고용세액공제 식 — 단가 · 늘어난 인원 × 단가 (D-302 에 rosterCore 에서 떼어 냄).
 * 맞춤 추천(clientInsights)이 명부 엔진 전체를 끌어오지 않고 이 식만 쓰게 — rosterCore 는 그대로 다시 내보낸다.
 */

// 시/도 → 수도권 여부 (통합고용세액공제 지역 구분)
export const METRO_SIDO: readonly string[] = ['서울', '경기', '인천']
export type RegionType = 'metro' | 'local'
export function regionTypeOf(sido: string | null | undefined): RegionType | null {
  if (!sido) return null
  return METRO_SIDO.indexOf(sido) >= 0 ? 'metro' : 'local'
}

// ── 통합고용세액공제 기본 단가 (만원/인, 편집 가능) ───────
// 귀속연도별로 바뀌므로 반드시 "법령표 확인 필요" 전제. 기본값은 참고용.
// D-319 인원이 늘어난 해로 표를 고른다(조특법 §29의8 — 2026-01-01 이후 시작하는 과세연도부터 개편).
//   2025 과세연도까지 늘어난 인원: 3년 같은 금액 — 중소 청년 등 수도권 1,450 · 지방 1,550 / 일반 850 · 950, 중견 800 · 450
//   2026 과세연도부터 늘어난 인원: 고용을 유지하면 2 · 3년 차가 커진다 — 중소 청년 등 수도권 700 → 1,600 → 1,700 · 지방 1,000 → 1,900 → 2,000,
//     일반 수도권 400 → 900 → 1,000 · 지방 700 → 1,200 → 1,300. 중견 · 그 밖은 개편 단가를 직접 넣는다(★ 확인).
//   예전에는 해를 보지 않아 2026년에 뽑은 청년도 '1년 차 1,450만원' 으로 나와 첫해 공제가 두 배 가까이 부풀었다.
export const CREDIT_REFORM_YEAR = 2026
export type SizeType = 'sme' | 'mid' | 'other'
type Three = [number, number, number]
export interface TaxUnits {
  /** 1년 차 단가(만원) — 화면 칸 · estimateTaxCredit 에 넣는 값 */
  youth: number
  normal: number
  /** 1 · 2 · 3년 차 단가(만원) — 인원을 유지할 때 */
  schedule: { youth: Three; normal: Three }
  /** 고른 표 — 2023(3년 같은 금액) · 2026(개편) */
  table: 2023 | 2026
}
export const SME_2026: Record<RegionType, { youth: Three; normal: Three }> = {
  metro: { youth: [700, 1600, 1700], normal: [400, 900, 1000] },
  local: { youth: [1000, 1900, 2000], normal: [700, 1200, 1300] },
}
const flat = (youth: number, normal: number, table: 2023 | 2026): TaxUnits => ({ youth, normal, schedule: { youth: [youth, youth, youth], normal: [normal, normal, normal] }, table })
/** year = 인원이 늘어난 과세연도(부르는 쪽이 넘긴다 — 명부의 올해 · 오늘). 넘기지 않으면 2025 표 */
export function defaultTaxUnits(region: RegionType | null | string, sizeType: SizeType | string, year = CREDIT_REFORM_YEAR - 1): TaxUnits {
  const reform = year >= CREDIT_REFORM_YEAR
  if (sizeType === 'sme') {
    if (reform) {
      const t = SME_2026[region === 'local' ? 'local' : 'metro']
      return { youth: t.youth[0], normal: t.normal[0], schedule: t, table: 2026 }
    }
    return region === 'local' ? flat(1550, 950, 2023) : flat(1450, 850, 2023)
  }
  if (sizeType === 'mid' && !reform) return flat(800, 450, 2023)
  return flat(0, 0, reform ? 2026 : 2023) // 기타 · 2026 중견 → 직접 입력
}

/** D-319 늘어난 인원의 1 · 2 · 3년 차 공제(원) — 인원을 유지할 때. 단가는 표 그대로(직접 고친 단가에는 쓰지 않는다) */
export function creditYears(units: TaxUnits, incYouth: number, incNormal: number): Three {
  return [0, 1, 2].map((i) => (units.schedule.youth[i] * incYouth + units.schedule.normal[i] * incNormal) * 10000) as Three
}

export interface TaxCreditParams {
  region?: RegionType | null
  sizeType?: SizeType | string
  prevTotal?: number | null
  prevYouth?: number | null
  curTotal?: number | null
  curYouth?: number | null
  unitYouth?: number | string | null
  unitNormal?: number | string | null
}

export interface TaxCreditResult {
  computable: boolean
  youthKnown: boolean
  incTotal: number | null
  incYouth: number | null
  incNormal: number | null
  creditYouth: number | null
  creditNormal: number | null
  creditTotal: number | null
  overYouth: boolean
  needsRecheck: boolean
}

// ── 통합고용세액공제 예상 검토 계산 ───────────────────────
// params: { region, sizeType, prevTotal, prevYouth, curTotal, curYouth, unitYouth, unitNormal }
// "모름"은 null 로 전달. 단가는 만원 단위. 반환 금액은 원 단위.
export function estimateTaxCredit(params?: TaxCreditParams | null): TaxCreditResult {
  const p = params || {}
  const computable = typeof p.prevTotal === 'number' && typeof p.curTotal === 'number'
  const incTotal = computable ? Math.max(0, (p.curTotal as number) - (p.prevTotal as number)) : null

  const youthKnown = typeof p.prevYouth === 'number' && typeof p.curYouth === 'number'
  const rawIncYouth = youthKnown ? Math.max(0, (p.curYouth as number) - (p.prevYouth as number)) : null
  // D-136: 청년 등 증가는 전체 증가를 넘을 수 없다 → 전체 증가로 자른다 (넘으면 overYouth 로 입력 재확인 안내)
  const incYouth = rawIncYouth != null && incTotal != null ? Math.min(rawIncYouth, incTotal) : rawIncYouth
  const incNormal = incTotal != null && incYouth != null ? Math.max(0, incTotal - incYouth) : null

  const unitY = Number(p.unitYouth) || 0
  const unitN = Number(p.unitNormal) || 0
  const creditYouth = incYouth != null ? incYouth * unitY * 10000 : null
  const creditNormal = incNormal != null ? incNormal * unitN * 10000 : null
  const creditTotal = (creditYouth || 0) + (creditNormal || 0)

  // 검증: 청년 등 증가 인원이 전체 증가 인원을 초과하면 입력값 재확인 필요(과대계산 위험)
  const overYouth = incTotal != null && rawIncYouth != null && rawIncYouth > incTotal

  return {
    computable: computable,
    youthKnown: youthKnown,
    incTotal: incTotal,
    incYouth: incYouth,
    incNormal: incNormal,
    creditYouth: creditYouth,
    creditNormal: creditNormal,
    creditTotal: creditYouth != null || creditNormal != null ? creditTotal : null,
    overYouth: overYouth,
    needsRecheck: overYouth,
  }
}

// ── D-302 명부 날짜로 센 인원(매월 말 평균) — 세는 방법은 rosterCore.rosterHeadcount ─────
export interface YearHeadcount {
  year: number
  /** 매월 말 상시근로자 평균(소수 둘째 자리까지 버림) */
  total: number
  youth: number
  /** 실제로 센 달 수(나머지는 그날 인원 그대로로 본 달) */
  actualMonths: number
}

export interface RosterHeadcount {
  /** 센 기준일(YYYY-MM-DD) — 명부 발급일과 오늘 중 이른 날 */
  asOf: string
  prev: YearHeadcount
  cur: YearHeadcount
  /** history: 상실 날짜가 있는 명부 · current: 지금 직원만(작년 퇴사자가 없을 수 있음) */
  basis: 'history' | 'current'
  counted: number
  excluded: { rel: number; noEi: number; noHire: number; lostNoDate: number }
}

/** 명부 날짜로 센 인원 → 통합고용세액공제(명부 화면과 같은 식 · 단가 기본값) */
export function headcountTaxCredit(hc: Pick<RosterHeadcount, 'prev' | 'cur'>, region: RegionType | null, sizeType: SizeType): { units: TaxUnits; estimate: TaxCreditResult } {
  // D-319 늘어난 해(명부의 올해)로 단가 표를 고른다
  const units = defaultTaxUnits(region ?? 'metro', sizeType, hc.cur.year)
  const estimate = estimateTaxCredit({ region, sizeType, prevTotal: hc.prev.total, prevYouth: hc.prev.youth, curTotal: hc.cur.total, curYouth: hc.cur.youth, unitYouth: units.youth, unitNormal: units.normal })
  return { units, estimate }
}

/** 0.41 · 2 · 3.5 — 인원 평균을 보일 때(뒤 0 없이) */
export function headText(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** 붙여 둔 결과의 인원 기록 — 모양이 맞을 때만(맞춤 추천 세액공제 · 정책자금 고용 증가가 같이 쓴다) */
export function headcountOf(v: unknown): RosterHeadcount | null {
  const h = v as RosterHeadcount | null | undefined
  const ok = (y: unknown) => {
    const x = y as { year?: unknown; total?: unknown; youth?: unknown; actualMonths?: unknown } | null | undefined
    return !!x && typeof x.year === 'number' && typeof x.total === 'number' && typeof x.youth === 'number' && typeof x.actualMonths === 'number'
  }
  return h && ok(h.prev) && ok(h.cur) && (h.basis === 'history' || h.basis === 'current') ? h : null
}
