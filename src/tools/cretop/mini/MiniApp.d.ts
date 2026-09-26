/** [D-93] 원본 크레탑 분석 앱(JSX) 을 TS 화면에서 부를 때의 모양 */
import type { ReactNode } from 'react'

export interface CretopMiniHistoryItem {
  id: string
  company: string
  ts: string
  clientName?: string
  ui: CretopMiniUi
}
/** 엔진 결과 + 원본 앱이 덧붙이는 칸들 — 화면이 그대로 읽는다 */
export type CretopMiniUi = Record<string, unknown> & {
  companyInfo?: { companyName?: string; businessNo?: string; creditGrade?: string } & Record<string, unknown>
}
export interface CretopMiniAppProps {
  history?: CretopMiniHistoryItem[]
  onSaved?: (ui: CretopMiniUi) => void
  onDelete?: (item: CretopMiniHistoryItem) => void
  extraInput?: ReactNode
  resultBar?: (ui: CretopMiniUi, selected: string[]) => ReactNode
  pendingFile?: File | null
  onPendingDone?: () => void
  /** [D-121] 다른 화면 안에 들어갈 때 — 마지막 세션 대신 이 분석으로 시작 */
  initialUi?: CretopMiniUi | null
  embedded?: boolean
}
export function CretopMiniApp(props: CretopMiniAppProps): ReactNode
export interface CretopOneLiner { company: string; risks: string[]; questions: string[]; strategies: string[] }
export function buildOneLiner(ui: CretopMiniUi): CretopOneLiner
export function oneLinerText(o: CretopOneLiner): string
export function buildDiagnosisSummary(ui: CretopMiniUi): { text: string; tone: string }[]
export function rankStrategies(ui: CretopMiniUi): { s: { name: string; cat: string }; score: number }[]
export function estCorpTaxWon(niEok: number): number | null
/** [D-94] 방금 분석한 보고서 원문 (없으면 null) */
export function lastCretopSource(): { text: string; fileName: string } | null
