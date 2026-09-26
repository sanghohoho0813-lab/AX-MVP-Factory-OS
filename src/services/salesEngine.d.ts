/** 영업 규칙 엔진 타입 (D-114 2단계) — 구현은 salesEngine.js (원본 SalesApp.jsx 에서 옮김) */

/** 엔진이 읽는 고객 한 줄 — 원본 영업 도구의 고객 모양 (매출은 백만원) */
export interface SalesEngineItem {
  name?: string
  industry?: string
  revenue?: number | string
  empCount?: number | string
  estYears?: number | string
  ceoAge?: number | string
  interests?: string[]
  concern?: string
  memo?: string
  source?: string
  stage?: string
  nextDate?: string
  flags?: Record<string, boolean>
  corpType?: string
  juPosition?: string
}

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
  level: string
  needTaxPro: boolean
}
export const STRATEGY_LIBRARY: Strategy[]
export const NEED_WEIGHT: Record<string, number>
export const STAGE_WEIGHT: Record<string, number>
export function scoreLead(item: SalesEngineItem): number

export type ScoreTierKey = 'high' | 'chase' | 'nurture' | 'long' | 'low'
export interface ScoreTier {
  min: number
  key: ScoreTierKey
  label: string
  short: string
}
export const SCORE_TIERS: ScoreTier[]
export function scoreTier(score: number): ScoreTier

export function recommendedStrategiesFor(item: SalesEngineItem): (Strategy & { score?: number })[]

export interface LeadPlan {
  priority: string
  tier: ScoreTierKey
  score: number
  target: string
  hook: string
  phone: string
  kakao: string
  objections: [string, string][]
  meetingBridge: string
  products: string[]
}
export function buildLeadPlan(item: SalesEngineItem): LeadPlan

export type MeetingThemeKey = 'succession' | 'suspense' | 'rd' | 'employment' | 'welfare' | 'conversion' | 'charter' | 'general'
export interface MeetingTheme {
  label: string
  openFocus: string
  avoid: string
  m1q: string[]
}
export const MEETING_THEMES: Record<MeetingThemeKey, MeetingTheme>
export const INTEREST_THEME: Record<string, MeetingThemeKey>
export const DEFAULT_M2_OBJ: [string, string][]
export function detectTheme(item: SalesEngineItem): MeetingThemeKey

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
  approach: string
  objections: [string, string][]
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
export function buildMeetingPlan(item: SalesEngineItem, stage: 'm1'): MeetingPlanM1
export function buildMeetingPlan(item: SalesEngineItem, stage: 'm2'): MeetingPlanM2
export function buildMeetingPlan(item: SalesEngineItem, stage: 'm3'): MeetingPlanM3

export function followUpKakao(item: SalesEngineItem): string

/** [키, 이름, 묶음] */
export const CUST_FLAGS: [string, string, string][]
export const CUST_SECTIONS: string[]
export function deriveInterests(f: { interests?: string[]; flags?: Record<string, boolean> }): string[]
export function parseMemo(text: string): {
  flags: Record<string, boolean>
  industry?: string
  revenue?: number
  empCount?: number
  ceoAge?: number
  estYears?: number
}

export interface TranscriptAnalysis {
  summary: string
  reaction: string
  interested: string[]
  hesitant: string[]
  newInfo: string[]
  issues: string[]
  secondPoints: string[]
  strategy: string
  nextDocs: string[]
  kakao: string
  analyzedAt: string
}
export function analyzeTranscript(text: string): TranscriptAnalysis
