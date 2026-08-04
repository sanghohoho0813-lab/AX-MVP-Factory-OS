import { STORAGE_KEYS, notifyStoreChanged, readJson, writeJson } from '../storage/localStore'

interface OpsCompletedActionRecord {
  actionId: string
  dateKey: string
  completedAt: string
}

function dateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function readRecords(): OpsCompletedActionRecord[] {
  const records = readJson<OpsCompletedActionRecord[]>(STORAGE_KEYS.opsCompletedActions, [])
  return Array.isArray(records) ? records : []
}

function writeRecords(records: OpsCompletedActionRecord[]): void {
  writeJson(STORAGE_KEYS.opsCompletedActions, records)
  notifyStoreChanged()
}

export function getTodayOpsDateKey(): string {
  return dateKey()
}

export function getCompletedOpsActionIds(targetDateKey = dateKey()): string[] {
  return readRecords()
    .filter((record) => record.dateKey === targetDateKey)
    .map((record) => record.actionId)
}

export function setOpsActionCompleted(
  actionId: string,
  completed: boolean,
  targetDateKey = dateKey(),
): void {
  const records = readRecords()
  const withoutCurrent = records.filter(
    (record) => !(record.actionId === actionId && record.dateKey === targetDateKey),
  )
  if (completed) {
    withoutCurrent.push({
      actionId,
      dateKey: targetDateKey,
      completedAt: new Date().toISOString(),
    })
  }
  writeRecords(withoutCurrent)
}

export function clearTodayOpsCompletions(targetDateKey = dateKey()): void {
  writeRecords(readRecords().filter((record) => record.dateKey !== targetDateKey))
}
