/** [D-119] 크레탑 규칙 계산(analysisCore.js)을 TS 화면 · 서비스에서 부를 때의 모양 */
import type { CretopMiniUi } from './MiniApp.jsx'

export interface CretopStrategy {
  cat: string
  name: string
  base: number
  signals: [string, number, string][]
  always?: string
  why: string
  interest: string[]
  questions: string[]
  docs: string[]
  problem?: string
  implication?: string
  ment: string
  effects: string[]
  personalNote?: string
}
export interface CretopRanked {
  s: CretopStrategy
  /** 0~98 — 화면에는 보이지 않고 등급(최우선 · 권장 · 조건 확인 · 낮음)으로만 쓴다 */
  score: number
  reasons: string[]
  held: boolean
}
export type CretopTone = 'bad' | 'warn' | 'good' | 'info'

export const CONSULTING_CATEGORIES: string[]
export const CONSULTING_STRATEGIES: CretopStrategy[]
export function analyzeCretopText(raw: string, pages?: Array<{ pageNo: number; text: string }> | null): CretopMiniUi
export function buildDiagnosisSummary(ui: CretopMiniUi): { text: string; tone: CretopTone }[]
export function rankStrategies(ui: CretopMiniUi): CretopRanked[]
export function buildMeetingQuestions(ui: CretopMiniUi): string[]
export function buildOneLiner(ui: CretopMiniUi): { company: string; risks: string[]; questions: string[]; strategies: string[] }
export function oneLinerText(o: { company: string; risks: string[]; questions: string[]; strategies: string[] }): string
export function extractCeoAge(raw: string): number | null
export function detailHasPositive(ui: CretopMiniUi, re: RegExp): boolean
