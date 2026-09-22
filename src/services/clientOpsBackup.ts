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
/**
 * 2 판부터 도구함 입력값(`axmvp.tools.*`)도 함께 담는다 (D-89).
 * 1 판 파일(도구 입력값이 없는 것)도 그대로 읽힌다 — 없으면 없는 대로 둔다.
 */
export const BACKUP_VERSION = 2

/** 도구 입력값이 사는 곳 — 창업감면 폼, 크레탑 붙여넣기, 연구소 체크 … */
export const TOOL_INPUT_PREFIX = 'axmvp.tools.'

export interface BackupFile {
  format: string
  version: number
  exportedAt: string
  count: number
  clients: ClientOpsRecord[]
  /** 도구함 입력값 (키 → 저장된 글자). 2 판부터 */
  toolInputs?: Record<string, string>
}

/** 이 브라우저에 남아 있는 도구 입력값을 모은다 */
export function readToolInputs(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(TOOL_INPUT_PREFIX)) continue
      const value = localStorage.getItem(key)
      if (typeof value === 'string') out[key] = value
    }
  } catch {
    // 사생활 보호 모드 등으로 못 읽으면 도구 입력값 없이 백업한다
  }
  return out
}

/** 백업에서 꺼낸 도구 입력값을 이 브라우저에 되돌린다. 돌려준 수만큼 실제로 썼다. */
export function writeToolInputs(inputs: Record<string, string> | undefined): number {
  if (!inputs) return 0
  let count = 0
  try {
    for (const [key, value] of Object.entries(inputs)) {
      if (!key.startsWith(TOOL_INPUT_PREFIX) || typeof value !== 'string') continue
      localStorage.setItem(key, value)
      count += 1
    }
  } catch {
    return count
  }
  return count
}

export function buildBackup(records: ClientOpsRecord[], toolInputs: Record<string, string> = readToolInputs()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    count: records.length,
    clients: records,
    toolInputs,
  }
}

export class BackupError extends Error {}

function readBackupFile(text: string): Partial<BackupFile> {
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
  return file
}

/** 파일 내용을 검증해 고객 목록을 꺼낸다 */
export function parseBackup(text: string): ClientOpsRecord[] {
  return (readBackupFile(text).clients ?? []).map((c) => normalizeClientOps(c as Partial<ClientOpsRecord>))
}

/**
 * 백업에 담긴 도구 입력값 (1 판 파일이면 빈 것).
 * 도구 입력값만 따로 꺼내는 이유: 복원 화면에서 "고객 N곳 · 도구 입력값 M개" 로 먼저 보여 주기 때문이다.
 */
export function parseBackupToolInputs(text: string): Record<string, string> {
  const inputs = readBackupFile(text).toolInputs
  if (!inputs || typeof inputs !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(inputs)) {
    if (key.startsWith(TOOL_INPUT_PREFIX) && typeof value === 'string') out[key] = value
  }
  return out
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
