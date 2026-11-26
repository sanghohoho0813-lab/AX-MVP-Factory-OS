/**
 * D-657 고객이 올리고 아직 칸에 안 넣은 서류 — 작업공간 전체(업체 id → 개수).
 * 오늘 · 고객 관리가 같이 쓴다. 첫 화면을 막지 않게 한가할 때 읽고, 화면으로 돌아오거나 · 넣기/빼기를 하면 다시 읽는다.
 * 0031 전 · 로컬 모드 · 쓸 수 없는 사람은 빈 표(아무것도 안 그린다).
 */
import { useEffect, useState } from 'react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { UPLOAD_CHANGED, loadUploadInbox } from '../../services/uploadLink'

const EMPTY: ReadonlyMap<string, number> = new Map()

export function useUploadInbox(workspaceId: string | null | undefined, enabled = true): ReadonlyMap<string, number> {
  const [inbox, setInbox] = useState<ReadonlyMap<string, number>>(EMPTY)
  useEffect(() => {
    if (!enabled || !workspaceId) return
    let alive = true
    const read = () => {
      void loadUploadInbox(workspaceId).then((m) => {
        if (alive) setInbox(m.size ? m : EMPTY)
      })
    }
    const idle = window.setTimeout(read, 1200)
    const onVisible = () => {
      if (document.visibilityState === 'visible') read()
    }
    window.addEventListener(UPLOAD_CHANGED, read)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      window.clearTimeout(idle)
      window.removeEventListener(UPLOAD_CHANGED, read)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [workspaceId, enabled])
  return enabled && workspaceId ? inbox : EMPTY
}

/** 업체 서류함을 '고객이 올린 서류' 판이 열린 채로 여는 주소 */
export const uploadInboxHref = (clientId: string): string => `/ops/clients/${clientId}?tab=docs&inbox=1`

export interface UploadInboxRow {
  clientId: string
  companyName: string
  waiting: number
}

/** 보관한 업체 · 모르는 업체는 빼고 · 많이 올린 곳부터 */
export function uploadInboxRows(clients: readonly ClientOpsRecord[], inbox: ReadonlyMap<string, number>): UploadInboxRow[] {
  const out: UploadInboxRow[] = []
  for (const c of clients) {
    const waiting = inbox.get(c.id) ?? 0
    if (waiting > 0 && !c.archivedAt) out.push({ clientId: c.id, companyName: c.companyName || '(이름 없음)', waiting })
  }
  return out.sort((a, b) => b.waiting - a.waiting || a.companyName.localeCompare(b.companyName, 'ko'))
}
