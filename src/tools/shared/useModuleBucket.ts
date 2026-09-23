/**
 * 모듈 기록 한 갈래를 화면에서 쓰기 (D-91).
 *
 * `moduleData` 는 저장만 안다. 화면은 "읽어 두고, 고치면 바로 반영" 이 필요하다.
 * 모듈마다 같은 코드를 다시 쓰지 않도록 여기 한 번만 적는다.
 *
 * 업체는 만들지 않는다 — 줄마다 `clientId` 로 고객 운영의 업체를 가리킬 뿐이다.
 */

import { useCallback, useEffect, useState } from 'react'
import { deleteRow, listRows, saveRow } from '../../services/moduleData'
import { useToolClient } from './toolClientContext'

export interface BucketRow<T> {
  id: string
  clientId: string
  data: T
  updatedAt: string
}

export interface BucketStore<T> {
  /** 아직 못 읽었으면 null */
  rows: BucketRow<T>[] | null
  reload: () => Promise<void>
  save: (input: { id?: string; clientId?: string; data: T }) => Promise<BucketRow<T>>
  remove: (id: string) => Promise<void>
}

export function useModuleBucket<T extends Record<string, unknown>>(moduleKey: string, bucket: string): BucketStore<T> {
  const { workspaceId } = useToolClient()
  const [rows, setRows] = useState<BucketRow<T>[] | null>(null)

  const read = useCallback(async () => {
    const list = await listRows(workspaceId, moduleKey, bucket)
    setRows(list.map((r) => ({ id: r.id, clientId: r.clientId, data: r.data as T, updatedAt: r.updatedAt })))
  }, [workspaceId, moduleKey, bucket])

  useEffect(() => {
    let alive = true
    void listRows(workspaceId, moduleKey, bucket).then((list) => {
      if (alive) setRows(list.map((r) => ({ id: r.id, clientId: r.clientId, data: r.data as T, updatedAt: r.updatedAt })))
    })
    return () => {
      alive = false
    }
  }, [workspaceId, moduleKey, bucket])

  const save = useCallback(
    async (input: { id?: string; clientId?: string; data: T }) => {
      const row = await saveRow(workspaceId, moduleKey, bucket, {
        id: input.id,
        clientId: input.clientId ?? '',
        data: input.data,
      })
      const next: BucketRow<T> = { id: row.id, clientId: row.clientId, data: row.data as T, updatedAt: row.updatedAt }
      setRows((cur) => {
        const list = cur ?? []
        return list.some((r) => r.id === next.id) ? list.map((r) => (r.id === next.id ? next : r)) : [next, ...list]
      })
      return next
    },
    [workspaceId, moduleKey, bucket],
  )

  const remove = useCallback(
    async (id: string) => {
      await deleteRow(workspaceId, moduleKey, bucket, id)
      setRows((cur) => (cur ?? []).filter((r) => r.id !== id))
    },
    [workspaceId, moduleKey, bucket],
  )

  return { rows, reload: read, save, remove }
}
