/**
 * salesData.js 타입 선언 — 원본(기업컨설팅 세일즈 OS)을 고치지 않고 화면에서 쓰기 위한 것.
 * 모양이 불확실한 칸은 `unknown`/느슨한 타입으로 두고 화면에서 좁혀 쓴다.
 */

export interface Strategy {
  id: string
  name: string
  fields: string[]
  fit: string
  pitch: string
  questions: string[]
  docs: string[]
  risk: string
  fee: string
  close: string
  level: '낮음' | '보통' | '높음'
  needTaxPro: boolean
  score?: number
}

export interface SalesPackage {
  id: string
  name: string
  cat: string
  fee: number
  strat: string
  desc: string
  fit: string
  docs: string[]
  caution: string
  simple: string
  kakao: string
  point: string
  sample: string
}

export interface Weapon {
  name: string
  p: string
  r: string
  q: string
  d: string
}

export interface WeaponCategory {
  cat: string
  items: Weapon[]
}

export interface MeetingTheme {
  label: string
  openFocus: string
  avoid: string
  m1q: string[]
}

/** 원본 App.jsx 의 고객(lead/company) 레코드 — 이 도구에서 쓰는 칸만 */
export interface SalesItem {
  name?: string
  companyName?: string
  interests?: string[]
  concern?: string
  memo?: string
  industry?: string
  field?: string
  keywords?: string
  summary?: string
  ceoAge?: number | string
  estYears?: number | string
  empCount?: number | string
  revenue?: number | string
  netIncome?: number | string
  stage?: string
  dbSource?: string
  flags?: Record<string, boolean>
  financialNumbers?: Array<{ label: string; display: string }>
  [k: string]: unknown
}

export interface MeetingPlanM1 {
  title: string
  goal: string
  opening: string
  questions: string[]
  avoid: string
  next: string
  kakao: string
  docs: string[]
}
export interface MeetingPlanM2 {
  title: string
  goal: string
  topIssues: string[]
  approach: string[] | string
  objections: Array<[string, string]> | string[]
  close: string
  docs: string[]
  fee: string
}
export interface MeetingPlanM3 {
  title: string
  goal: string
  strategy: string
  proposal: string
  priceTalk: string
  holdTalk: string
  contractKakao: string
}

export interface LeadPlan {
  score: number
  band: ScoreBand
  hook: string
  callScript: string
  kakao: string
  objections: Array<[string, string]> | string[]
  meetingMove: string
  [k: string]: unknown
}

export interface ScoreBand {
  label: string
  short: string
  color: string
  bg: string
}

export interface FinanceSignal {
  level: string
  label?: string
  color?: string
  bg?: string
  advice?: string
  icon?: string
  reasons: string[]
  opportunities?: string[]
  [k: string]: unknown
}

export const STRATEGY_LIBRARY: Strategy[]
export const PKG_CATEGORIES: string[]
export const DEFAULT_PACKAGES: SalesPackage[]
export function buildDefaultPackages(): SalesPackage[]
export const CRETOP_WEAPONS: WeaponCategory[]
export const CRETOP_WEAPON_MAP: Record<string, Weapon>
export const INTEREST_THEME: Record<string, string>
export function detectTheme(item: SalesItem): string
export const DEFAULT_M2_OBJ: Array<[string, string]>
export const MEETING_THEMES: Record<string, MeetingTheme>
export function buildMeetingPlan(item: SalesItem, stage: 'm1'): MeetingPlanM1
export function buildMeetingPlan(item: SalesItem, stage: 'm2'): MeetingPlanM2
export function buildMeetingPlan(item: SalesItem, stage: 'm3'): MeetingPlanM3
export const CUST_FLAGS: Array<[string, string, string]>
export const CUST_SECTIONS: string[]
export function deriveInterests(f: { interests?: string[]; flags?: Record<string, boolean> }): string[]
export function parseMemo(text: string): Record<string, unknown>
export const NEED_WEIGHT: Record<string, number>
export const STAGE_WEIGHT: Record<string, number>
export function scoreLead(l: SalesItem): number
export function scoreBand(score: number): ScoreBand
export function recommendedStrategiesFor(item: SalesItem): Strategy[]
export function buildLeadPlan(item: SalesItem): LeadPlan
export const HOLD_REASONS: string[]
export const MANAGE_CYCLES: Array<[string, number]>
export function holdReasonAdvice(reason: string): string
export function holdReasonMessage(item: SalesItem): string
export function manageMessage(item: SalesItem, kind: string): string
export function referralAdvice(item: SalesItem): string
export function referralMessage(item: SalesItem): string
export function financeSignal(item: SalesItem): FinanceSignal
export const DEAL_STAGES: Array<{ key: string; label: string; icon: string; color: string; bg: string }>
export function stageOf(key: string): { key: string; label: string; icon: string; color: string; bg: string }
export function missedConsultItems(item: SalesItem): string[]
