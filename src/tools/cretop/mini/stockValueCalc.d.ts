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
