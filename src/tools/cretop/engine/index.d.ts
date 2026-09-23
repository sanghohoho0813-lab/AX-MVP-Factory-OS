/**
 * cretop-engine 타입 선언 (D-88).
 *
 * `index.js` 는 원본(corp-consult-sales-os/packages/cretop-engine)을 한 글자도 바꾸지 않은 것이다.
 * 여기에는 화면이 실제로 쓰는 것만 선언한다 — 엔진이 돌려주는 106개 심볼 전부를 옮겨 적지 않는다.
 * 모르는 칸은 `unknown` 으로 두고, 화면에서 좁혀 쓴다.
 */

export interface CretopAmount {
  value: number | null
  unit?: string
  /** 억원 환산 */
  eok?: number | null
  year?: number | null
  series?: Array<number | null>
  years?: number[]
  /** 원문에 계정이 아예 없어 0으로 둔 것 */
  absent?: boolean
  source?: string
  isRatio?: boolean
  /** 부채비율 — 자본잠식 위험 */
  capitalErosion?: boolean
  formula?: string | null
}

export interface CretopTrendPoint {
  year: number | null
  raw: unknown
  val: number | null
}

export interface CretopTrendStep {
  fromYear: number | null
  toYear: number | null
  deltaAbs: number | null
  deltaPct: number | null
  transition: string
  dir: string
}

export interface CretopTrend {
  series: CretopTrendPoint[]
  steps: CretopTrendStep[]
  latest: CretopTrendPoint | null
  prev: CretopTrendPoint | null
  deltaAbs: number | null
  deltaPct: number | null
  dir: string
  isRatio: boolean
  unit: string
  pUnit?: string
}

export interface CretopTrendRow {
  key: string
  label: string
  isRatio?: boolean
  missing?: boolean
  trend?: CretopTrend
  isGrade?: boolean
  gradeSeries?: string[]
  years?: number[]
  cashflowGrade?: unknown
  unit?: string
  rawLabel?: string | null
  source?: string
}

export interface CretopRatioArea {
  key: string
  name: string
  hint: string
  metrics: CretopTrendRow[]
}

export interface CretopCompanyInfo {
  companyName?: string
  ceoName?: string
  businessNo?: string
  corpRegNo?: string
  industry?: string
  standardIndustry?: string
  employees?: string | number
  established?: string
  creditGrade?: string
  cashflowGrade?: { latest?: string; gradeSeries?: string[]; years?: number[] } | null
  [k: string]: unknown
}

export interface CretopParsedForUi {
  companyInfo: CretopCompanyInfo
  certInfo: Record<string, unknown>
  ipInfo: Record<string, unknown>
  corePreview: Record<string, CretopAmount | null | undefined>
  trendRows: CretopTrendRow[]
  ratioAreas: CretopRatioArea[]
  ratioYears: number[]
  reportRatioYears: number[]
  computedRatioYears: number[]
  financialYears: number[]
  ignoredYears: number[]
  ratioYearSource: string
  ratioYearConfidence: string
  detailStatements: Record<string, unknown>
  _meta: { rows: number; [k: string]: unknown }
  [k: string]: unknown
}

export interface CretopExtractRow {
  accountKey: string
  status: string
  rawValue: unknown
  unit?: string
  isRatio?: boolean
  isGrade?: boolean
  gradeSeries?: string[]
  numberCandidates?: unknown[]
  yearCandidates?: unknown[]
  [k: string]: unknown
}

export interface CretopCoreExtract {
  rows: CretopExtractRow[]
  debug: unknown
  company: Record<string, unknown>
  detail: unknown
  external: Record<string, unknown>
  detectedYears: number[]
}

export function buildCretopParsedForUi(rawText: string): CretopParsedForUi
export function extractCretopCore(rawText: string): CretopCoreExtract
export function normalizeCretopPdfText(rawText: string): string
export function parseCretopPastedTables(input: { incomeText?: string; balanceText?: string; ratioText?: string; detailText?: string }): {
  combined: string
  finalCore: unknown
}
export function cretopRowTrend(row: unknown): CretopTrend
export function cretopTrendCommentRich(key: string, t: CretopTrend): { text: string; tone: 'red' | 'green' | 'gray' }
export function cretopPreviewTone(key: string, p: CretopAmount | null | undefined, manualGrade?: string | null): string | null
export function cretopGradeTone(grade: string | null | undefined): string | null
export function cretopCashflowGradeInfo(grade: string): { level: string; color: string; text: string }
export function cretopRowRank(row: CretopExtractRow | null | undefined): number
export function extractRowEok(row: CretopExtractRow | null | undefined): number | null
export function parseNumLoose(s: unknown): number | null
export function cretopEokText(eok: number | null | undefined): string
export function groupItemsIntoLines(items: Array<{ text: string; x: number; y: number; w: number; h: number }>): Array<{ text: string; [k: string]: unknown }>
export const CRETOP_RATIO_AREAS: Array<{ key: string; name: string; metrics: string[]; hint: string }>
export const CORE_PREVIEW_ORDER: string[]
export const CRETOP_CORE6: string[]
export const CORE_LABELS: Record<string, string>
export const EXTRACT_STATUS: string[]

/* 숫자 추출기 (D-91 에서 화면을 붙일 때 쓰는 것) */
export interface CretopExtractedRow {
  id: string
  accountKey: string
  account: string
  rawLabel: string
  year: number | null
  values: Array<number | null>
  rawValue: number | null
  unit: string
  section: string
  rowText: string
  confidence: string
  status: string
  isRatio: boolean
  sel: boolean
}
export interface CretopExtractResult {
  rows: CretopExtractedRow[]
  detectedYears: number[]
  sections: string[]
  queryDate: string | null
}
export function extractCretopNumbers(rawText: string): CretopExtractResult
export function extractRowsToCsv(rows: CretopExtractedRow[]): string
export function extractRowsToText(rows: CretopExtractedRow[]): string
export function extractEokText(row: CretopExtractedRow): string
export const CRETOP_EXTRACT_SAMPLE: string
export const CRETOP_CORE_SAMPLE: string
export const EXTRACT_ORDER: string[]
export const EXTRACT_LABEL_KR: Record<string, string>

/* 원본 분석 화면을 그대로 세울 때 쓰는 것 (D-92) */
export const CRETOP_PREVIEW_TONES: Record<string, { bg: string; bd: string; fg: string; tag: string }>
/** 단위 → 억원 배율 */
export const CRETOP_UF: Record<string, number>
/** 상세 재무제표 한 줄 */
export interface CretopDetailItem {
  id: string
  account?: string
  rawLabel?: string | null
  unit?: string
  numberCandidates?: Array<number | null>
  yearCandidates?: Array<number | null>
  [k: string]: unknown
}
export interface CretopDetailStatement {
  name?: string
  items: CretopDetailItem[]
  years: Array<number | null>
  noData: boolean
}
