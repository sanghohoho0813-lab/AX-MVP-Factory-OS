import { useCallback, useEffect, useState } from 'react'
import { FileText, Paperclip } from 'lucide-react'
import type { ClientOpsRecord, DocumentKey } from '../../types/clientOps'
import type { PortalDocument } from '../../types/bridge'
import { allDocumentMetas, documentMetaOf } from '../../services/clientOpsDocuments'
import { DOCUMENT_STATUS_LABEL, listDocuments, listLinksForClient } from '../../services/customerBridgeService'
import { activityTimeText } from '../../services/clientOpsActivity'
import { formatFileSize } from '../../lib/format'
import { DocFileActions } from './DocFileActions'

/**
 * 서류 탭 아래 — 서류 칸 밖의 파일 (D-129, 예전 '파일' 탭).
 *
 *  - 고객과 주고받은 파일: 고객이 고객 플랫폼에 올린 것 · 고객에게 공유한 것
 *  - 칸이 없어진 서류의 파일: 직접 만든 서류 칸을 없앴어도 올린 파일은 남는다
 * 내 서류함 파일은 서류 칸마다 바로 열리므로 여기서 다시 늘어놓지 않는다.
 */
export function ClientSharedFiles({ record, workspaceId }: { record: ClientOpsRecord; workspaceId: string | null }) {
  const [portalDocs, setPortalDocs] = useState<PortalDocument[]>([])

  const load = useCallback(async () => {
    try {
      const links = await listLinksForClient(workspaceId, record.id)
      const all: PortalDocument[] = []
      for (const l of links) all.push(...(await listDocuments(workspaceId, l.id)))
      setPortalDocs(all.filter((d) => d.storagePath))
    } catch {
      setPortalDocs([])
    }
  }, [workspaceId, record.id])

  useEffect(() => {
    void load()
  }, [load])

  const known = new Set(allDocumentMetas(record).map((m) => m.key))
  const orphans = (Object.entries(record.documents) as [DocumentKey, ClientOpsRecord['documents'][DocumentKey]][]).filter(
    ([key, v]) => !known.has(key) && (v.fileName || v.storagePath),
  )

  return (
    <section aria-labelledby="files" className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4" data-testid="client-shared-files">
      <h3 id="files" className="t-card flex items-center gap-2 font-bold text-slate-900">
        <Paperclip aria-hidden="true" className="size-4 text-slate-400" /> 고객과 주고받은 파일 <span className="t-sub font-medium text-slate-500">{portalDocs.length}</span>
      </h3>
      {portalDocs.length === 0 ? (
        <p className="t-sub break-keep text-slate-500">고객이 올렸거나 고객에게 공유한 파일이 없습니다. 고객 플랫폼 탭에서 요청 · 공유할 수 있습니다.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100">
          {portalDocs.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 py-2.5" data-portal-file={d.id}>
              <span className="flex min-w-0 items-start gap-2.5">
                <FileText aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${d.source === 'customer' ? 'text-brand-500' : 'text-slate-400'}`} />
                <span className="min-w-0 flex-1">
                  <span className="t-body block font-semibold break-keep text-slate-800">{d.title}</span>
                  <span className="t-sub block break-keep [overflow-wrap:anywhere] text-slate-500">
                    {d.source === 'customer' ? '고객 업로드' : '고객에게 공유'} · {DOCUMENT_STATUS_LABEL[d.status]} · {d.fileName}
                    {d.fileSize ? ` · ${formatFileSize(d.fileSize)}` : ''}
                    {d.uploadedAt ? ` · ${activityTimeText(d.uploadedAt)}` : ''}
                  </span>
                </span>
              </span>
              {d.storagePath && !d.storagePath.startsWith('demo/') && <DocFileActions label={d.title} storagePath={d.storagePath} fileName={d.fileName} />}
            </li>
          ))}
        </ul>
      )}

      {orphans.length > 0 && (
        <>
          <h3 className="t-card mt-2 font-bold text-slate-900">칸이 없어진 서류의 파일 <span className="t-sub font-medium text-slate-500">{orphans.length}</span></h3>
          <ul className="flex flex-col divide-y divide-slate-100">
            {orphans.map(([key, v]) => (
              <li key={key} className="flex flex-col gap-2 py-2.5">
                <span className="t-sub break-keep [overflow-wrap:anywhere] text-slate-600">
                  <b className="font-semibold text-slate-800">{documentMetaOf(record, key).label}</b> · {v.fileName}
                  {v.fileSize > 0 ? ` · ${formatFileSize(v.fileSize)}` : ''}
                </span>
                {v.storagePath && <DocFileActions label={documentMetaOf(record, key).label} storagePath={v.storagePath} fileName={v.fileName} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
