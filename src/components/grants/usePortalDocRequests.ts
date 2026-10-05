/**
 * 업체의 고객 플랫폼 연결 · 이미 요청해 둔 서류 (D-152) — 신청 준비 체크 목록에서 '고객 화면에 요청' 에 쓴다.
 * 연결이 없으면 null(단추를 숨긴다). 고객이 올린 파일은 고객 플랫폼 탭의 [서류함에 넣기](D-148)로 서류함에 들어온다.
 */
import { useCallback, useEffect, useState } from 'react'
import { listDocuments, listLinksForClient, publishUpdate, requestDocument } from '../../services/customerBridgeService'

export function usePortalDocRequests(workspaceId: string | null, clientId: string, note: string, enabled = true) {
  const [linkId, setLinkId] = useState<string | null>(null)
  const [requested, setRequested] = useState<string[]>([])
  useEffect(() => {
    let alive = true
    if (!enabled || !clientId) return
    void (async () => {
      try {
        const links = await listLinksForClient(workspaceId, clientId)
        const link = links.find((l) => l.status === 'active') ?? null
        if (!alive) return
        setLinkId(link?.id ?? null)
        if (link) {
          const docs = await listDocuments(workspaceId, link.id)
          if (alive) setRequested(docs.filter((d) => d.status === 'requested').map((d) => d.title))
        }
      } catch {
        // 고객 플랫폼을 못 읽어도 체크 목록은 그대로 쓴다
        if (alive) setLinkId(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [workspaceId, clientId, enabled])

  const request = useCallback(
    async (items: { title: string; documentType: string }[]) => {
      if (!linkId) return 0
      let n = 0
      for (const { title, documentType } of items) {
        await requestDocument(workspaceId, { linkId, operationsClientId: clientId, documentType, title, customerNote: note })
        n += 1
        setRequested((prev) => [...prev, title])
      }
      return n
    },
    [linkId, workspaceId, clientId, note],
  )
  // D-153: 접수 · 결과 소식을 고객 화면에 올린다
  const publish = useCallback(
    async (title: string, body: string, result: boolean) => {
      if (!linkId) return
      await publishUpdate(workspaceId, { linkId, category: result ? 'result' : 'progress', title, body, customerActionRequired: false })
    },
    [linkId, workspaceId],
  )
  return linkId ? { requested, request, publish } : null
}
