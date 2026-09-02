/**
 * 고객 운영 데이터 백업·복원.
 *
 * 지금은 브라우저에만 저장되므로, 방문기록을 지우면 데이터가 사라진다.
 * 파일로 내보내고 다시 불러올 수 있게 해 유실을 막는다.
 */

import type { ClientOpsRecord } from '../types/clientOps'
import { normalizeClientOps } from './clientOpsService'
import { nowIso } from '../lib/appClock'

export const BACKUP_FORMAT = 'ax-client-ops'
export const BACKUP_VERSION = 1

export interface BackupFile {
  format: string
  version: number
  exportedAt: string
  count: number
  clients: ClientOpsRecord[]
}

export function buildBackup(records: ClientOpsRecord[]): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    count: records.length,
    clients: records,
  }
}

export class BackupError extends Error {}

/** 파일 내용을 검증해 고객 목록을 꺼낸다 */
export function parseBackup(text: string): ClientOpsRecord[] {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('백업 파일이 아닙니다. JSON 형식이 아닙니다.')
  }
  if (typeof raw !== 'object' || raw === null) throw new BackupError('백업 파일 내용을 읽을 수 없습니다.')
  const file = raw as Partial<BackupFile>
  if (file.format !== BACKUP_FORMAT) {
    throw new BackupError('이 시스템에서 내보낸 백업 파일이 아닙니다.')
  }
  if (!Array.isArray(file.clients)) throw new BackupError('백업 파일에 고객 정보가 없습니다.')
  return file.clients.map((c) => normalizeClientOps(c as Partial<ClientOpsRecord>))
}

export type MergeMode = 'merge' | 'replace'

export interface MergeResult {
  records: ClientOpsRecord[]
  added: number
  updated: number
  kept: number
}

/**
 * 복원 방식
 *  - replace: 백업 내용으로 전부 교체
 *  - merge:   같은 id는 "더 최근에 수정된 쪽"을 남기고, 없는 것은 추가
 */
export function mergeBackup(
  current: ClientOpsRecord[],
  incoming: ClientOpsRecord[],
  mode: MergeMode,
): MergeResult {
  if (mode === 'replace') {
    return { records: incoming, added: incoming.length, updated: 0, kept: 0 }
  }

  const byId = new Map(current.map((r) => [r.id, r]))
  let added = 0
  let updated = 0
  let kept = 0

  for (const inc of incoming) {
    const mine = byId.get(inc.id)
    if (!mine) {
      byId.set(inc.id, inc)
      added += 1
      continue
    }
    if (inc.updatedAt > mine.updatedAt) {
      byId.set(inc.id, inc)
      updated += 1
    } else {
      kept += 1
    }
  }

  return { records: [...byId.values()], added, updated, kept }
}

/**
 * 파일 이름 (YYYY-MM-DD).
 * 한글 파일명은 브라우저가 무시해 확장자 없는 "download"로 저장되므로 영문으로 만든다.
 */
export function backupFileName(today: string): string {
  return `client-ops-backup-${today}.json`
}

/** 브라우저에서 파일로 내려받는다 */
export function downloadBackup(records: ClientOpsRecord[], today: string): void {
  const blob = new Blob([JSON.stringify(buildBackup(records), null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName(today)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
