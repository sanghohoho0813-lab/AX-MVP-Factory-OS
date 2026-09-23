/** salesAnalytics.js 타입 (D-92) */
import type { SalesItem, SalesPackage } from './salesData'

export interface AnalyticsData {
  list: SalesItem[]
  packages?: SalesPackage[]
  goals?: Partial<Goals>
}
export interface Goals {
  feeGoal: number
  contractGoal: number
  proposalGoal: number
}
export interface Range {
  start: string
  end: string
}
export interface MonthStats {
  mkey: string
  newCust: number
  proposed: number
  quote: number
  contracted: number
  contractFee: number
  followLate: number
}
export interface CsvTable {
  headers: string[]
  rows: Array<Array<string | number>>
}
export const PIPELINE: Array<{ key: string; label: string; match: string[] }>
export function pipeColOf(stage: string): string
export function dymd(s: unknown): string
export function dMonthKey(s: unknown): string
export function monthKeyOffset(off: number): string
export function monthLabel(key: string): string
export function feeMoney(m: unknown): string
export function expFee(x: unknown): number
export function getGoals(data: AnalyticsData): Goals
export const FUNNEL: Array<[string, string]>
export function funnelStageOf(c: SalesItem): string
export function analyticsFunnel(data: AnalyticsData): Array<{ key: string; label: string; count: number; fee: number; share: number; conv: number | null }>
export function productPerformance(data: AnalyticsData): Array<{ name: string; cat: string; proposed: number; quote: number; contracted: number; propFee: number; contFee: number; avgFee: number; conv: number }>
export function salesMetrics(data: AnalyticsData): {
  total: number
  thisWeek: number
  overdue: number
  review: number
  done: number
  feeSum: number
  top5Fee: number
  proposed: number
  proposedFeeSum: number
  contractedFeeSum: number
  quoteFeeSum: number
  quoteSent: number
  negotiating: number
  preContract: number
  onhold: number
  monthlyPropCount: number
  monthlyPremiumSum: number
  projectedSum: number
  affordN: { green: number; yellow: number; red: number }
}
export const PERIOD_OPTIONS: Array<[string, string]>
export function periodRange(period: string, cs?: string, ce?: string): Range | null
export function periodLabel(range: Range | null): string
export function isContractedCust(c: SalesItem): boolean
export function monthlyStats(data: AnalyticsData, mkey: string): MonthStats
export function monthCompare(data: AnalyticsData): { cur: MonthStats; prev: MonthStats }
export function monthlyTrend(data: AnalyticsData, n: number): MonthStats[]
export function deltaInfo(cur: number, prev: number): { diff: number; txt: string; col: string }
export function productMonthlyCompare(data: AnalyticsData): Array<{ name: string; cat: string; propCur: number; propPrev: number; contCur: number; contPrev: number; badge: { t: string; col: string; bg: string } | null }>
export function csvCell(v: unknown): string
export function buildCSV(headers: string[], rows: Array<Array<string | number>>): string
export function csvAnalytics(data: AnalyticsData): CsvTable
export function csvProducts(data: AnalyticsData): CsvTable
export function filterDataByPeriod(data: AnalyticsData, range: Range | null): AnalyticsData
export function csvCustomers(data: AnalyticsData): CsvTable
export function csvFollowups(data: AnalyticsData): CsvTable
