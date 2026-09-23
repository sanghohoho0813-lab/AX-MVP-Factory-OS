/**
 * salesDocs.js 타입 (D-92). 원본 함수가 받는 고객(item)은 salesData 의 SalesItem 을 쓴다.
 */
import type { SalesItem, SalesPackage } from './salesData'

export interface ReportProfile {
  consultant: string
  org: string
  title: string
  phone: string
  email: string
  footer: string
}
export interface SalesDocsData extends Record<string, unknown> {
  reportProfile?: Partial<ReportProfile>
  affordSettings?: Partial<AffordSettings>
  packages?: SalesPackage[]
}
export interface AffordSettings {
  greenPerEok: number
  yellowPerEok: number
  defMonths: number
  defRate: number
}
export interface Recommendation {
  name: string
  reason: string
  docs: string[]
  risk: string
  pitch: string
  needTaxPro: boolean
}
export interface Affordability {
  level: 'none' | 'green' | 'yellow' | 'red'
  label: string
  color: string
  bg: string
  msg: string
  greenLimit: number
  yellowLimit: number
  hasBase: boolean
  note?: string
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
export interface RoadmapStep {
  id: string
  month: string
  task: string
  purpose: string
  docs: string
  owner: string
  status: string
}
export interface ProposalTopic {
  key: string
  name: string
  kw: string[]
  cats: string[]
  industries?: string[]
  pkgCats: string[]
  action: string
}
export interface TimelineEvent {
  date: string
  type: string
  memo: string
}
export type KakaoPair = [string, string]

export function wonFromMillion(m: unknown): string
export function getPackages(data: SalesDocsData | null | undefined): SalesPackage[]
export function matchPackages(item: SalesItem, packages: SalesPackage[]): Array<{ pkg: SalesPackage; reason: string }>
export function buildProposal(item: SalesItem, pkgs: SalesPackage[], mode: 'customer' | 'internal', profile?: ReportProfile): string
export const SCOPE_TEMPLATES: Record<string, string[]>
export const PKG_DURATION: Record<string, string>
export const SCOPE_EXCLUDED: string[]
export function scopeItems(pkg: SalesPackage): string[]
export function pkgDuration(pkg: SalesPackage): string
export function buildScopeDoc(item: SalesItem, pkg: SalesPackage, profile?: ReportProfile): string
export function buildQuoteText(item: SalesItem, pkg: SalesPackage): string
export function scopeKakaoSet(item: SalesItem, pkg: SalesPackage): KakaoPair[]
export const PROPOSAL_STATES: string[]
export const CONTRACT_CHECKLIST: string[]
export function recoReason(item: SalesItem, s: unknown): string
export function topRecommendations(item: SalesItem): Recommendation[]
export function buildKakaoSet(item: SalesItem): KakaoPair[]
export function buildDocRequestText(item: SalesItem): string
export function buildMeetingReport(item: SalesItem): string
export const NEXT_ACTIONS: string[]
export const TODO_KINDS: string[]
export const CONTACT_TYPES: string[]
export function followUpKakao(item: SalesItem): string
export function currentIssueSummary(item: SalesItem): string
export const REPORT_PROFILE_DEFAULT: ReportProfile
export function getReportProfile(data: SalesDocsData | null | undefined): ReportProfile
export const VISIT_BASE_DOCS: string[]
export const EXTRA_CHECK_MAP: Record<string, string>
export function extraCheckItems(item: SalesItem): string[]
export function visitRequestDocs(item: SalesItem): string[]
export function visitReasonText(item: SalesItem, mode: 'customer' | 'internal'): string
export function buildVisitKakaoSet(item: SalesItem): KakaoPair[]
export function buildVisitReport(item: SalesItem, mode: 'customer' | 'internal', profile?: ReportProfile): string
export function customerShareSummary(item: SalesItem, profile?: ReportProfile): string
export const DB_SOURCES: string[]
export const DEAL_RESULTS: string[]
export const REQUIRED_DOCS: string[]
export const DOC_STATUSES: string[]
export const CONSULT_ITEMS: string[]
export const MANAGE_MSG_KINDS: string[]
export function manToText(man: unknown): string
export function buildOnePager(item: SalesItem, profile?: ReportProfile): string
export function analyzeTranscript(text: string): TranscriptAnalysis
export function insuranceSim(monthly: unknown, months: unknown, rate: unknown): { total: number; base: number; months: number; rate: number }
export function getAffordSettings(data: SalesDocsData | null | undefined): AffordSettings
export function manFromDisplay(s: unknown): number | null
export function custNetIncomeMan(item: SalesItem): number | null
export function affordability(monthlyMan: unknown, netIncomeMan: unknown, settings?: AffordSettings): Affordability
export function monthlyPlanText(item: SalesItem, settings: AffordSettings | null, mode: 'customer' | 'internal'): string[]
export function buildSecondMeetingDoc(item: SalesItem, profile: ReportProfile | null, sim: { monthlyMan: number | string; months: number | string; rate: number | string } | null): string
export function defaultRoadmap(item: SalesItem): RoadmapStep[]
export function buildTimeline(item: SalesItem): TimelineEvent[]
export const PROPOSAL_TOPICS: ProposalTopic[]
export function topicMatchCustomer(c: SalesItem, topic: ProposalTopic): { match: boolean; score: number; reason: string }
export function classifyTopicsFromText(text: string): string[]
export function relatedTopicsForCustomer(item: SalesItem): Array<{ topic: ProposalTopic; match: boolean; score: number; reason: string }>
export function topicKakao(c: SalesItem, topic: ProposalTopic): string
export function topicPackages(topic: ProposalTopic, data: SalesDocsData | null | undefined): SalesPackage[]
export function prepSufficiency(item: SalesItem): { level: string; pts: number; color: string; bg: string }
export function prepBriefing(item: SalesItem): string
export function prepQuestions(item: SalesItem): Array<[string, string]>
export function prepPoints(item: SalesItem): Array<{ name: string; why: string; ment: string; docs: string[]; caution: string }>
export const PREP_DOC_STATES: string[]
export function prepDocs(item: SalesItem): string[]
export function prepKakaos(item: SalesItem): KakaoPair[]
export const PREP_NEXT_ACTIONS: string[]
export function prepDiagText(item: SalesItem): string
export const CONSULT_CATALOG: Array<{ cat: string; items: Array<[string, string]> }>
export const CONSULT_DESC: Record<string, string>
export function consultDesc(name: string): string
export function bundleReason(names: string[]): string
export const PROPOSAL_ADD_ITEMS: string[]
export const MONTHLY_QUICK: number[]
export function lastActivityOf(c: SalesItem): string
export function followStatus(item: SalesItem): { t: string; c: string; b: string; kind: string } | null
export interface TopicHit {
  c: SalesItem
  reason: string
  score: number
  topic: ProposalTopic
}
export function relatedCustomersForTopicOf(list: SalesItem[], topicKey: string, limit?: number): TopicHit[]
export function todayProposalRows(list: SalesItem[]): Array<{ key: string; name: string; tp: ProposalTopic; list: TopicHit[] }>
export function focusCustomersOf(list: SalesItem[], scoreLead: (c: SalesItem) => number): Array<{ c: SalesItem; s: number; why: string }>
export function riskSignalsOf(list: SalesItem[], scoreLead: (c: SalesItem) => number): Array<{ c: SalesItem; reason: string; last: string; action: string }>
export function recontactListOf(list: SalesItem[]): Array<{ c: SalesItem; reasons: string[]; ment: string; ds: number }>
