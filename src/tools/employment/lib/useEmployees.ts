/**
 * 고용지원금 대상 직원 기록을 읽고 쓴다 (D-91).
 *
 * 저장은 모듈 기록 한 곳으로 간다 — `moduleData` 의 `employment` 상자, `employees` 갈래.
 * 업체는 만들지 않는다. 직원 줄이 `clientId` 로 고객 운영의 업체를 가리킬 뿐이다.
 */

import { useCallback, useEffect, useState } from 'react'
import { deleteRow, listRows, saveRow } from '../../../services/moduleData'
import { useToolClient } from '../../shared/toolClientContext'
import { toEmpRecord, type EmpRecord } from './empRecords'

const MODULE = 'employment'
const BUCKET = 'employees'

export interface EmployeesStore {
  /** 아직 못 읽었으면 null — 화면은 '읽는 중' 을 보여 준다 */
  employees: EmpRecord[] | null
  reload: () => Promise<void>
  save: (input: Omit<EmpRecord, 'id'> & { id?: string }) => Promise<EmpRecord>
  remove: (id: string) => Promise<void>
}

export function useEmployees(): EmployeesStore {
  const { workspaceId } = useToolClient()
  const [employees, setEmployees] = useState<EmpRecord[] | null>(null)

  const reload = useCallback(async () => {
    const rows = await listRows(workspaceId, MODULE, BUCKET)
    setEmployees(rows.map((r) => toEmpRecord(r.id, r.clientId, r.data)))
  }, [workspaceId])

  useEffect(() => {
    let alive = true
    void listRows(workspaceId, MODULE, BUCKET).then((rows) => {
      if (alive) setEmployees(rows.map((r) => toEmpRecord(r.id, r.clientId, r.data)))
    })
    return () => {
      alive = false
    }
  }, [workspaceId])

  const save = useCallback(
    async (input: Omit<EmpRecord, 'id'> & { id?: string }) => {
      const { id, clientId, ...rest } = input
      const row = await saveRow(workspaceId, MODULE, BUCKET, {
        id,
        clientId,
        data: rest as unknown as Record<string, unknown>,
      })
      const saved = toEmpRecord(row.id, row.clientId, row.data)
      setEmployees((cur) => {
        const list = cur ?? []
        const at = list.findIndex((e) => e.id === saved.id)
        if (at >= 0) return list.map((e) => (e.id === saved.id ? saved : e))
        return [saved, ...list]
      })
      return saved
    },
    [workspaceId],
  )

  const remove = useCallback(
    async (id: string) => {
      await deleteRow(workspaceId, MODULE, BUCKET, id)
      setEmployees((cur) => (cur ?? []).filter((e) => e.id !== id))
    },
    [workspaceId],
  )

  return { employees, reload, save, remove }
}
