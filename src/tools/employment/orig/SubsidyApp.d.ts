/** 원본 고용지원금 매니저 Pro 화면 (SubsidyApp.jsx) — 타입만 (D-93) */
import type { ReactElement } from 'react'

type Rec = Record<string, unknown>

export interface SubsidyAppProps {
  view: string
  companyId: string | null
  onNav: (next: { view?: string; company?: string | null }) => void
  onBack: () => void
  osClients: Rec[]
  companies: Rec[]
  employees: Rec[]
  programs: Record<string, Rec> | undefined
  calendarMemos: Record<string, unknown[]>
  profile: Rec
  orgName: string
  subStatus: string
  plan: string
  uploadFn?: (companyId: string, empId: string | null, file: File) => Promise<Rec>
  getUrlFn: (path: string) => Promise<string | null>
  onSaveCompany: (c: Rec) => void
  onPatchCompany: (id: string, patch: Rec) => void
  onDeleteCompany: (id: string) => void
  onSaveEmployee: (e: Rec) => void
  onPatchEmployee: (id: string, patch: Rec) => void
  onDeleteEmployee: (id: string) => void
  onBulkSaveCompanies: (list: Rec[]) => Promise<void>
  onBulkSaveEmployees: (list: Rec[]) => Promise<void>
  onDeleteSampleRows: (empIds: string[], compIds: string[]) => Promise<void>
  onSavePrograms: (map: Record<string, Rec>) => void
  onSaveMemo: (dateKey: string, memos: unknown[]) => void
  onUpdateProfile: (p: Rec) => void
}

export default function SubsidyApp(props: SubsidyAppProps): ReactElement
export const DEFAULT_PROGRAMS: Record<string, Rec>
export const PROGRAM_ENABLED_DEFAULTS: Record<string, boolean>
