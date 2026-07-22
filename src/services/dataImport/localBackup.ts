/**
 * 로컬 데이터 백업(내보내기) 및 정리.
 *
 * 원칙:
 *   - 정리(clear)는 사용자가 명시적으로 확인한 경우에만 호출한다.
 *   - 정리 전에는 반드시 JSON 백업을 내려받게 한다(호출부에서 강제).
 *   - 스키마 버전 키와 백업 키는 지우지 않는다(도메인 데이터만 정리).
 */

import { STORAGE_KEYS, SCHEMA_VERSION, readRaw, removeKey } from '../../storage/localStore'
import { buildLocalSnapshot } from './localSnapshot'

/** 전체 로컬 도메인 데이터를 하나의 JSON 백업 문자열로 만든다(읽기 전용). */
export function buildLocalBackupJson(): string {
  const data: Record<string, unknown> = {}
  for (const [name, key] of Object.entries(STORAGE_KEYS)) {
    const raw = readRaw(key)
    data[name] = raw ? JSON.parse(raw) : []
  }
  const snapshot = buildLocalSnapshot()
  return JSON.stringify(
    {
      kind: 'axmvp.local-backup',
      schemaVersion: snapshot.schemaVersion,
      expectedSchemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      totalItems: snapshot.totalItems,
      data,
    },
    null,
    2,
  )
}

/** 백업 JSON 을 파일로 내려받는다. */
export function downloadLocalBackup(): void {
  const json = buildLocalBackupJson()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')
  a.href = url
  a.download = `axmvp-local-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 로컬 도메인 데이터를 정리한다(명시적 확인 후에만 호출).
 * 스키마 버전·UI 설정·백업 키는 보존한다.
 */
export function clearLocalDomainData(): void {
  for (const key of Object.values(STORAGE_KEYS)) {
    removeKey(key)
  }
}
