import type { UnlistedShareResult } from '../../../services/taxCalc'
import type { CretopMiniUi } from './MiniApp.jsx'

export const SV_EVENT: string
export function svCurrent(ui: CretopMiniUi): {
  r: UnlistedShareResult | null
  shares: number | null
  cond: Record<string, string>
  edited: boolean
  sharesEdited: boolean
}
export function svSummaryLines(ui: CretopMiniUi): string[]
export interface SvEntry {
  at: string
  shares?: string
  cond?: Record<string, string>
}
export function svRestore(ui: CretopMiniUi | { companyInfo?: { companyName?: string; businessNo?: string } }, entry: SvEntry | null | undefined): boolean
/** D-136 */
export function svDefaults(ui: CretopMiniUi): Record<string, string>
export function svSave(ui: CretopMiniUi, v: { shares?: string | null; cond?: Record<string, string> | null }): void
export function svLoad(ui: CretopMiniUi): Partial<SvEntry> & { v?: number; basis?: string }
export function svMerge(ui: CretopMiniUi, saved: (Partial<SvEntry> & { v?: number; basis?: string }) | null, defaults: Record<string, string>): { cond: Record<string, string>; sharesText: string; sharesEdited: boolean; edited: boolean }
export function svBasis(ui: CretopMiniUi): string
export function netIncomeSlots(ui: CretopMiniUi): { year: number | null; val: number | null }[]
export function bsWon(ui: CretopMiniUi, names: string[]): number | null
