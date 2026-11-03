/**
 * D-521 작업공간 전체 내보내기(CLOUD-2) — 고객 관리 [백업 내려받기] 한 번에 이 작업공간 자료를 한 파일로.
 *
 * 예전 백업(2판)은 업체 + 이 브라우저의 도구 입력값만 담았다. 클라우드로 쓰면 모듈 기록(module_data — 고용지원금 직원 · 연구소 기록 ·
 * 마케팅 결과 …)과 업무 일기는 서버에만 있어 파일에서 빠졌고, 서류 파일이 어디 있는지 한눈에 볼 목록도 없었다.
 * 3판: 예전과 같은 모양(업체 · 도구 입력값 — 예전 [백업 불러오기] 가 그대로 읽는다) + `workspace` 칸
 *   - journal   업무 일기 전부(내가 쓴 것 — 서버도 쓴 사람 본인 것만 준다)
 *   - moduleRows 모듈 기록 전부(클라우드 모드 · 서버 표). 이 브라우저에만 있는 모듈 기록은 예전처럼 도구 입력값 칸에 들어 있다
 *   - files     서류 파일 목록(업체 · 서류 칸 · 파일 이름 · 크기 · 폴더 · 올린 날 · 저장 위치) — 파일 자체(PDF · 사진)는 담지 않는다
 *   - summary   숫자 요약 · missing 못 담은 것(인터넷이 끊기는 등) — 담지 못한 것을 감추지 않는다
 * 읽기만 — 서버에 아무것도 쓰지 않는다. 열어 볼 수 있는 임시 주소(서명 주소)는 넣지 않는다(파일이 퍼져도 서류가 열리지 않게).
 * 주민등록번호 · 비밀번호는 원래 저장하지 않으므로 파일에도 없다. 규칙 정리 — AI 아님.
 */
import type { ClientOpsRecord, DocumentKey } from '../types/clientOps'
import type { JournalEntry } from '../types/bridge'
import { BACKUP_FORMAT, MODULE_DATA_PREFIX, buildBackup, readToolInputs, type BackupFile } from './clientOpsBackup'
import { documentMetaOf } from './clientOpsDocuments'
import { listJournal } from './journalService'
import { listWorkspaceRows, type WorkspaceModuleRow } from './moduleData'
import { nowIso } from '../lib/appClock'

export const WORKSPACE_BACKUP_VERSION = 3

export interface ExportFileRow {
  clientId: string
  company: string
  slot: DocumentKey
  label: string
  fileName: string
  fileSize: number
  folderPath: string
  uploadedAt: string
  issuedAt: string
  validUntil: string
  /** 비공개 저장소 안 위치(열어 볼 수 있는 주소 아님) */
  storagePath: string
}

export interface WorkspaceSummary {
  clients: number
  /** 받은 서류 칸(파일이 없어도 받았다고 적은 것 포함) */
  documents: number
  files: number
  journal: number
  moduleRows: number
  /** 모듈마다 줄 수 */
  modules: Record<string, number>
  /** 도구 입력값 중 이 브라우저에만 있는 모듈 기록 칸 수 */
  localModuleKeys: number
}

export interface WorkspaceSection {
  mode: 'cloud' | 'local'
  workspaceId: string | null
  summary: WorkspaceSummary
  journal: JournalEntry[]
  moduleRows: WorkspaceModuleRow[]
  files: ExportFileRow[]
  /** 못 담은 것(쉬운 말) — 비어 있으면 전부 담았다 */
  missing: string[]
}

export type WorkspaceBackupFile = BackupFile & { workspace: WorkspaceSection }

/** 서류 파일 목록 — 파일이 붙은 칸만(이름이나 저장 위치가 있는 것) */
export function exportFileRows(records: readonly ClientOpsRecord[]): ExportFileRow[] {
  const out: ExportFileRow[] = []
  for (const r of records) {
    for (const [slot, d] of Object.entries(r.documents ?? {})) {
      if (!d || (!d.fileName && !d.storagePath)) continue
      out.push({
        clientId: r.id,
        company: r.companyName,
        slot,
        label: documentMetaOf(r, slot).label,
        fileName: d.fileName,
        fileSize: d.fileSize ?? 0,
        folderPath: d.folderPath ?? '',
        uploadedAt: d.uploadedAt ?? d.updatedAt ?? '',
        issuedAt: d.issuedAt ?? '',
        validUntil: d.validUntil ?? '',
        storagePath: d.storagePath ?? '',
      })
    }
  }
  return out
}

export function summarizeWorkspace(input: {
  records: readonly ClientOpsRecord[]
  journal: readonly JournalEntry[]
  moduleRows: readonly WorkspaceModuleRow[]
  files: readonly ExportFileRow[]
  toolInputs: Record<string, string>
}): WorkspaceSummary {
  const modules: Record<string, number> = {}
  for (const row of input.moduleRows) modules[row.moduleKey] = (modules[row.moduleKey] ?? 0) + 1
  const documents = input.records.reduce((n, r) => n + Object.values(r.documents ?? {}).filter((d) => !!d && (d.received || !!d.fileName || !!d.storagePath)).length, 0)
  return {
    clients: input.records.length,
    documents,
    files: input.files.length,
    journal: input.journal.length,
    moduleRows: input.moduleRows.length,
    modules,
    localModuleKeys: Object.keys(input.toolInputs).filter((k) => k.startsWith(MODULE_DATA_PREFIX)).length,
  }
}

/** 파일 한 벌을 만든다(순수 — 시험이 직접 부른다) */
export function buildWorkspaceBackup(input: {
  records: ClientOpsRecord[]
  journal: JournalEntry[]
  moduleRows: WorkspaceModuleRow[]
  toolInputs: Record<string, string>
  mode: 'cloud' | 'local'
  workspaceId: string | null
  missing?: string[]
}): WorkspaceBackupFile {
  const files = exportFileRows(input.records)
  const base = buildBackup(input.records, input.toolInputs)
  return {
    ...base,
    version: WORKSPACE_BACKUP_VERSION,
    exportedAt: nowIso(),
    workspace: {
      mode: input.mode,
      workspaceId: input.workspaceId,
      summary: summarizeWorkspace({ ...input, files }),
      journal: input.journal,
      moduleRows: input.moduleRows,
      files,
      missing: input.missing ?? [],
    },
  }
}

/** 내려받은 뒤 한 줄 — '업체 3곳 · 업무 일기 12건 · 모듈 기록 40줄 · 서류 파일 9개' */
export function workspaceBackupLine(s: WorkspaceSummary): string {
  const parts = [`업체 ${s.clients}곳`, `업무 일기 ${s.journal}건`]
  const mod = s.moduleRows + s.localModuleKeys
  if (mod > 0) parts.push(`모듈 기록 ${s.moduleRows > 0 ? `${s.moduleRows}줄` : `${s.localModuleKeys}칸`}`)
  parts.push(`서류 파일 목록 ${s.files}개`)
  return parts.join(' · ')
}

/**
 * 이 작업공간 자료를 모은다 — 업무 일기 · 모듈 기록은 서버에서 다시 읽는다(화면에 띄운 것만이 아니라 전부).
 * 한쪽을 못 읽어도(인터넷 · 권한) 나머지로 파일을 만들고 missing 에 적는다.
 */
export async function collectWorkspaceBackup(workspaceId: string | null, records: ClientOpsRecord[], cloud: boolean): Promise<WorkspaceBackupFile> {
  const missing: string[] = []
  const [journal, rows] = await Promise.allSettled([listJournal(workspaceId), cloud ? listWorkspaceRows(workspaceId) : Promise.resolve(null)])
  if (journal.status === 'rejected') missing.push('업무 일기')
  if (rows.status === 'rejected') missing.push('모듈 기록(서버)')
  return buildWorkspaceBackup({
    records,
    journal: journal.status === 'fulfilled' ? journal.value : [],
    moduleRows: rows.status === 'fulfilled' ? rows.value ?? [] : [],
    toolInputs: readToolInputs(),
    mode: cloud ? 'cloud' : 'local',
    workspaceId,
    missing,
  })
}

/**
 * 파일 이름 — 예전 백업과 같은 영문 규칙(한글 이름은 브라우저가 버린다). 3판은 'workspace' 를 붙여 예전 파일과 갈린다.
 */
export function workspaceBackupFileName(today: string): string {
  return `client-ops-workspace-${today}.json`
}

export function downloadWorkspaceBackup(file: WorkspaceBackupFile, today: string): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = workspaceBackupFileName(today)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** [백업 불러오기] 가 3판 파일에서 '되살리지 않고 파일에 남는 것' 을 한 줄로 알릴 때 */
export function workspaceSectionOf(text: string): WorkspaceSummary | null {
  try {
    const raw = JSON.parse(text) as Partial<WorkspaceBackupFile>
    if (raw.format !== BACKUP_FORMAT || !raw.workspace || typeof raw.workspace !== 'object') return null
    const s = raw.workspace.summary
    return s && typeof s.journal === 'number' ? s : null
  } catch {
    return null
  }
}
