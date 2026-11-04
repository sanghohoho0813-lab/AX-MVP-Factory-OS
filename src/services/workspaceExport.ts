/**
 * D-521 작업공간 전체 내보내기(CLOUD-2) — 고객 관리 [백업 내려받기] 한 번에 이 작업공간 자료를 한 파일로.
 *
 * 예전 백업(2판)은 업체 + 이 브라우저의 도구 입력값만 담았다. 클라우드로 쓰면 모듈 기록(module_data — 고용지원금 직원 · 연구소 기록 ·
 * 마케팅 결과 …)과 업무 일기는 서버에만 있어 파일에서 빠졌고, 서류 파일이 어디 있는지 한눈에 볼 목록도 없었다.
 * 3판: 예전과 같은 모양(업체 · 도구 입력값 — 예전 [백업 불러오기] 가 그대로 읽는다) + `workspace` 칸
 *   - journal   업무 일기 전부(내가 쓴 것 — 서버도 쓴 사람 본인 것만 준다)
 *   - moduleRows 모듈 기록 전부(클라우드 모드 · 서버 표). 이 브라우저에만 있는 모듈 기록은 예전처럼 도구 입력값 칸에 들어 있다
 *   - events    상담신청 · 고객 이벤트(D-529 · 최근 500건 — 화면과 같은 읽기)
 *   - files     서류 파일 목록(업체 · 서류 칸 · 파일 이름 · 크기 · 폴더 · 올린 날 · 저장 위치) — 파일 자체(PDF · 사진)는 담지 않는다
 *   - summary   숫자 요약 · missing 못 담은 것(인터넷이 끊기는 등) — 담지 못한 것을 감추지 않는다
 * 읽기만 — 서버에 아무것도 쓰지 않는다. 열어 볼 수 있는 임시 주소(서명 주소)는 넣지 않는다(파일이 퍼져도 서류가 열리지 않게).
 * 주민등록번호 · 비밀번호는 원래 저장하지 않으므로 파일에도 없다. 규칙 정리 — AI 아님.
 */
import type { ClientOpsRecord, DocumentKey } from '../types/clientOps'
import type { CustomerEvent, JournalEntry } from '../types/bridge'
import { BACKUP_FORMAT, MODULE_DATA_PREFIX, buildBackup, readToolInputs, type BackupFile } from './clientOpsBackup'
import { documentMetaOf } from './clientOpsDocuments'
import { listJournal } from './journalService'
import { listClients } from './clientOpsService'
import { listEvents } from './customerBridgeService'
import { listWorkspaceRows, type WorkspaceModuleRow } from './moduleData'
import { listCustomServices, type CustomService } from './customServiceService'
import { nowIso } from '../lib/appClock'

export const WORKSPACE_BACKUP_VERSION = 3

/**
 * D-536 이 파일이 실제로 보장하는 것(점검 A7) — 화면 세 곳(고객 관리 › 더보기 · 설정 › 데이터 · 백업 불러오기)이 같은 말을 쓴다.
 * '백업' 이라는 말 때문에 모두 되살아난다고 오해하지 않게, 되살아나는 것 · 보관용으로만 담기는 것 · 담기지 않는 것을 나눈다.
 */
export const BACKUP_SCOPE = {
  restore: ['업체(회사 정보 · 서류 칸 기록 · 계약 · 수금 · 서류 요청)', '이 브라우저의 도구 입력값'],
  archive: ['업무 일기(내가 쓴 것)', '모듈 기록(서버)', '상담신청(최근 500건)', '직접 만든 업무 항목', '서류 파일 목록(이름 · 크기 · 저장 위치)'],
  excluded: ['서류 파일 원본(PDF · 사진) — 서류함에서 따로 내려받기', '다른 구성원의 업무 일기', '컨설팅 기록 · 고객 플랫폼 자료 · 화면 꾸미기'],
} as const

/** 모듈 기록 · 상담신청을 한 번에 담는 상한 — 넘으면 '일부만 담음' 으로 알린다(조용히 자르지 않는다) */
export const EXPORT_MODULE_ROWS_MAX = 50_000
export const EXPORT_EVENTS_MAX = 500

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
  /** D-529 상담신청 · 고객 이벤트(최근 500건) */
  events: number
  moduleRows: number
  /** 모듈마다 줄 수 */
  modules: Record<string, number>
  /** 도구 입력값 중 이 브라우저에만 있는 모듈 기록 칸 수 */
  localModuleKeys: number
  /** D-536 직접 만든 업무 항목(예전 파일에는 없을 수 있다) */
  customServices?: number
}

export interface WorkspaceSection {
  mode: 'cloud' | 'local'
  workspaceId: string | null
  summary: WorkspaceSummary
  journal: JournalEntry[]
  /** D-529 상담신청 · 고객 이벤트(고객이 직접 낸 값 — 최근 500건). 예전 3판 파일에는 없을 수 있다 */
  events: CustomerEvent[]
  moduleRows: WorkspaceModuleRow[]
  files: ExportFileRow[]
  /** D-536 직접 만든 업무 항목(보관용 — 되살리기는 하지 않는다) */
  customServices?: CustomService[]
  /** 못 담은 것(쉬운 말) — 비어 있으면 전부 담았다 */
  missing: string[]
  /** D-536 상한 때문에 일부만 담은 것(쉬운 말) — 예전에는 알림 없이 잘랐다 */
  capped?: string[]
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
  events?: readonly CustomerEvent[]
  moduleRows: readonly WorkspaceModuleRow[]
  files: readonly ExportFileRow[]
  toolInputs: Record<string, string>
  customServices?: readonly CustomService[]
}): WorkspaceSummary {
  const modules: Record<string, number> = {}
  for (const row of input.moduleRows) modules[row.moduleKey] = (modules[row.moduleKey] ?? 0) + 1
  const documents = input.records.reduce((n, r) => n + Object.values(r.documents ?? {}).filter((d) => !!d && (d.received || !!d.fileName || !!d.storagePath)).length, 0)
  return {
    clients: input.records.length,
    documents,
    files: input.files.length,
    journal: input.journal.length,
    events: input.events?.length ?? 0,
    moduleRows: input.moduleRows.length,
    modules,
    localModuleKeys: Object.keys(input.toolInputs).filter((k) => k.startsWith(MODULE_DATA_PREFIX)).length,
    customServices: input.customServices?.length ?? 0,
  }
}

/** 파일 한 벌을 만든다(순수 — 시험이 직접 부른다) */
export function buildWorkspaceBackup(input: {
  records: ClientOpsRecord[]
  journal: JournalEntry[]
  events?: CustomerEvent[]
  moduleRows: WorkspaceModuleRow[]
  toolInputs: Record<string, string>
  mode: 'cloud' | 'local'
  workspaceId: string | null
  missing?: string[]
  capped?: string[]
  customServices?: CustomService[]
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
      events: input.events ?? [],
      moduleRows: input.moduleRows,
      files,
      customServices: input.customServices ?? [],
      missing: input.missing ?? [],
      capped: input.capped ?? [],
    },
  }
}

/** 내려받은 뒤 한 줄 — '업체 3곳 · 업무 일기 12건 · 모듈 기록 40줄 · 서류 파일 9개' */
export function workspaceBackupLine(s: WorkspaceSummary): string {
  const parts = [`업체 ${s.clients}곳`, `업무 일기 ${s.journal}건`]
  if ((s.events ?? 0) > 0) parts.push(`상담신청 ${s.events}건`)
  const mod = s.moduleRows + s.localModuleKeys
  if (mod > 0) parts.push(`모듈 기록 ${s.moduleRows > 0 ? `${s.moduleRows}줄` : `${s.localModuleKeys}칸`}`)
  if ((s.customServices ?? 0) > 0) parts.push(`직접 만든 업무 항목 ${s.customServices}개`)
  parts.push(`서류 파일 목록 ${s.files}개`)
  return parts.join(' · ')
}

/**
 * 클라우드 모드 — 이 브라우저의 모듈 기록 칸(`axmvp.module.<모듈>.<갈래>.<작업공간>`) 중 다른 작업공간 것은 빼고 담는다
 * (같은 브라우저로 다른 작업공간을 본 적이 있어도 그 자료가 이 파일에 섞이지 않게). 도구 입력값은 그대로.
 */
export function onlyThisWorkspace(inputs: Record<string, string>, workspaceId: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(inputs)) {
    if (k.startsWith(MODULE_DATA_PREFIX) && !(workspaceId && k.endsWith(`.${workspaceId}`))) continue
    out[k] = v
  }
  return out
}

/**
 * 이 작업공간 자료를 모은다 — 업무 일기 · 모듈 기록은 서버에서 다시 읽는다(화면에 띄운 것만이 아니라 전부).
 * 한쪽을 못 읽어도(인터넷 · 권한) 나머지로 파일을 만들고 missing 에 적는다.
 */
export async function collectWorkspaceBackup(workspaceId: string | null, records: ClientOpsRecord[], cloud: boolean): Promise<WorkspaceBackupFile> {
  const missing: string[] = []
  const capped: string[] = []
  const [journal, rows, events, custom] = await Promise.allSettled([
    listJournal(workspaceId),
    cloud ? listWorkspaceRows(workspaceId) : Promise.resolve(null),
    listEvents(workspaceId),
    listCustomServices(workspaceId),
  ])
  if (journal.status === 'rejected') missing.push('업무 일기')
  if (rows.status === 'rejected') missing.push('모듈 기록(서버)')
  if (events.status === 'rejected') missing.push('상담신청')
  if (custom.status === 'rejected') missing.push('직접 만든 업무 항목')
  // D-536 상한에 닿았으면 '일부만' 이라고 적는다(예전: 알림 없이 잘림)
  if (rows.status === 'fulfilled' && (rows.value?.length ?? 0) >= EXPORT_MODULE_ROWS_MAX) capped.push(`모듈 기록(앞 ${EXPORT_MODULE_ROWS_MAX.toLocaleString('ko-KR')}줄만)`)
  if (events.status === 'fulfilled' && events.value.length >= EXPORT_EVENTS_MAX) capped.push(`상담신청(최근 ${EXPORT_EVENTS_MAX}건만)`)
  return buildWorkspaceBackup({
    records,
    journal: journal.status === 'fulfilled' ? journal.value : [],
    events: events.status === 'fulfilled' ? events.value : [],
    moduleRows: rows.status === 'fulfilled' ? rows.value ?? [] : [],
    toolInputs: cloud ? onlyThisWorkspace(readToolInputs(), workspaceId) : readToolInputs(),
    mode: cloud ? 'cloud' : 'local',
    workspaceId,
    missing,
    capped,
    customServices: custom.status === 'fulfilled' ? custom.value : [],
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

/**
 * D-528 한 길로 — 고객 관리 › 더보기 · 설정 › 데이터 두 곳이 같은 함수를 쓴다.
 * 업체를 이미 읽은 화면은 records 를 넘기고, 안 읽은 화면(설정)은 여기서 읽는다. 받은 뒤 보여 줄 한 줄도 함께 돌려준다.
 */
export async function exportWorkspace(workspaceId: string | null, cloud: boolean, today: string, records?: ClientOpsRecord[]): Promise<{ file: WorkspaceBackupFile; line: string }> {
  const list = records ?? (await listClients(workspaceId))
  const file = await collectWorkspaceBackup(workspaceId, list, cloud)
  downloadWorkspaceBackup(file, today)
  return { file, line: exportResultLine(file) }
}

/** 내려받은 뒤 한 줄(순수 — 시험이 직접 부른다) — 일부만 담은 것 · 못 담은 것 · 되살리기 범위까지(D-536) */
export function exportResultLine(file: WorkspaceBackupFile): string {
  const miss = file.workspace.missing
  const cap = file.workspace.capped ?? []
  return `백업을 내려받았어요 — ${workspaceBackupLine(file.workspace.summary)}${cap.length ? ` · 일부만 담음: ${cap.join(', ')}` : ''}${miss.length ? ` · 못 담은 것: ${miss.join(', ')}(인터넷을 확인하고 한 번 더 받아 주세요)` : ''} · 되살리기는 업체 · 입력값만(나머지는 보관용)`
}
