/** 상품 · 견적 · 제안 규칙 타입 (D-114 3단계) — 구현은 salesProposal.js (원본 SalesApp.jsx 에서 옮김) */
import type { SalesEngineItem, Strategy } from './salesEngine'

/** 제안 문서가 읽는 고객 한 줄 — 엔진 한 줄 + 월납 제안 값(만원) */
export interface ProposalItem extends SalesEngineItem {
  proposalMonthlyPremium?: number
  proposalMonths?: number
  proposalRefundRate?: number
  /** 직전년도 당기순이익(만원) */
  netIncome?: number
}

export interface SalesPackage {
  id: string
  name: string
  /** 8분류 중 하나 */
  cat: string
  /** 수임료(만원) */
  fee: number
  /** 연결된 전략 id ('' 이면 없음) */
  strat: string
  desc: string
  fit: string
  docs: string[]
  caution: string
  simple: string
  kakao: string
  point: string
  sample?: boolean
}

export interface ReportProfile {
  consultant: string
  org: string
  title: string
  phone: string
  email: string
  footer?: string
}

export const PKG_CATEGORIES: string[]
export function buildDefaultPackages(): SalesPackage[]
export const DEFAULT_PACKAGES: SalesPackage[]
export function matchPackages(item: ProposalItem, packages: SalesPackage[]): { pkg: SalesPackage; reason: string }[]
export function buildProposal(item: ProposalItem, pkgs: SalesPackage[], mode: 'internal' | 'client', profile?: Partial<ReportProfile>): string

export const SCOPE_TEMPLATES: Record<string, string[]>
export const PKG_DURATION: Record<string, string>
export const SCOPE_EXCLUDED: string[]
export function scopeItems(pkg: SalesPackage): string[]
export function pkgDuration(pkg: SalesPackage): string
export function buildScopeDoc(item: ProposalItem, pkg: SalesPackage, profile?: Partial<ReportProfile>): string
export function buildQuoteText(item: ProposalItem, pkg: SalesPackage): string
export function scopeKakaoSet(item: ProposalItem, pkg: SalesPackage): [string, string][]

export const PROPOSAL_STATES: string[]
export const CONTRACT_CHECKLIST: string[]
export function recoReason(item: ProposalItem, s: Strategy): string
export function topRecommendations(item: ProposalItem): { name: string; reason: string; docs: string[]; risk: string; pitch: string; needTaxPro: boolean }[]
export function buildKakaoSet(item: ProposalItem): [string, string][]
export function buildDocRequestText(item: ProposalItem): string

/** 방문용 1페이지 사전 점검 리포트 (공유용/내부용) */
export function buildVisitReport(item: ProposalItem, mode: 'internal' | 'client', profile?: Partial<ReportProfile>): string
export const REPORT_PROFILE_DEFAULT: ReportProfile
export const VISIT_BASE_DOCS: string[]
export function extraCheckItems(item: ProposalItem): string[]
export function visitRequestDocs(item: ProposalItem): string[]
export function visitReasonText(item: ProposalItem, mode: 'internal' | 'client'): string
export function buildVisitKakaoSet(item: ProposalItem): [string, string][]

export const REQUIRED_DOCS: string[]
export function manToText(man: number): string
export function insuranceSim(monthly: number, months: number, rate: number): { total: number; base: number; months: number; rate: number }
export interface AffordSettings {
  greenPerEok: number
  yellowPerEok: number
  defMonths: number
  defRate: number
}
export function getAffordSettings(data: unknown): AffordSettings
export function manFromDisplay(s: string): number | null
export function custNetIncomeMan(item: ProposalItem): number | null
export interface Affordability {
  level: 'none' | 'green' | 'yellow' | 'red'
  label: string
  msg: string
  greenLimit: number
  yellowLimit: number
  hasBase: boolean
  note?: string
}
export function affordability(monthlyMan: number, netIncomeMan: number | null, settings?: Partial<AffordSettings>): Affordability
export function monthlyPlanText(item: ProposalItem, settings: AffordSettings | null, mode: 'internal' | 'client'): string[]

export const CONSULT_CATALOG: { cat: string; items: [string, string][] }[]
export function consultDesc(name: string): string
export function bundleReason(names: string[]): string
