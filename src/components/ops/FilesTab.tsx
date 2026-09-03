import { useCallback, useEffect, useState } from 'react'
import { Download, FileText, Paperclip } from 'lucide-react'
import type { ClientOpsRecord, DocumentKey } from '../../types/clientOps'
import type { PortalDocument } from '../../types/bridge'
import { useToast } from '../ui/toastContext'
import { DOCUMENTS } from '../../content/clientOpsCatalog'
import { canUploadFiles, documentFileUrl } from '../../services/clientOpsService'
import { DOCUMENT_STATUS_LABEL, listDocuments, listLinksForClient } from '../../services/customerBridgeService'
import { activityTimeText } from '../../services/clientOpsActivity'

/**
 * 업체 상세 > 파일 탭 — 이 업체와 관련된 실제 파일을 한곳에서.
 * 내 서류함 첨부 파일 + 고객이 올린 파일 + 고객에게 공유한 파일.
 */
export function FilesTab({ record, workspaceId }: { record: ClientOpsRecord; workspaceId: string | null }) {
  const { showToast } = useToast()
  const uploadable = canUploadFiles()
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

  const internal = (Object.entries(record.documents) as [DocumentKey, ClientOpsRecord['documents'][DocumentKey]][]).filter(([, v]) => v.fileName || v.storagePath)

  const open = async (path: string) => {
    try {
      const url = await documentFileUrl(path)
      if (!url) throw new Error('파일 주소를 만들지 못했습니다.')
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '파일을 열지 못했습니다.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!uploadable && (
        <p className="rounded-(--radius-control) border border-slate-200 bg-slate-50 px-4 py-3 text-[0.92rem] break-keep text-slate-600">
          지금은 이 브라우저에만 저장되는 모드입니다. 파일 첨부·다운로드는 클라우드(Supabase)를 연결하면 켜집니다.
        </p>
      )}
      <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)">
        <h3 className="flex items-center gap-2 text-[1.05rem] font-bold text-slate-900">
          <Paperclip aria-hidden="true" className="size-4 text-slate-400" /> 내 서류함 파일 <span className="text-slate-400">{internal.length}</span>
        </h3>
        {internal.length === 0 ? (
          <p className="mt-2 text-[0.92rem] text-slate-500">첨부된 파일이 없습니다. 서류 탭에서 파일을 올릴 수 있습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {internal.map(([key, v]) => (
              <li key={key} className="flex items-center gap-3 py-2.5">
                <FileText aria-hidden="true" className="size-5 shrink-0 text-cat-doc-500" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.95rem] font-semibold text-slate-800">{DOCUMENTS.find((d) => d.key === key)?.label ?? key}</span>
                  <span className="block truncate text-[0.85rem] text-slate-500">{v.fileName}{v.issuedAt ? ` · 발급 ${v.issuedAt}` : ''}</span>
                </span>
                {v.storagePath && uploadable && (
                  <button type="button" onClick={() => void open(v.storagePath)} className="inline-flex h-9 items-center gap-1 rounded-(--radius-control) border border-slate-200 px-3 text-[0.88rem] font-medium text-slate-700 hover:bg-slate-50">
                    <Download aria-hidden="true" className="size-4" /> 열기
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)">
        <h3 className="text-[1.05rem] font-bold text-slate-900">고객과 주고받은 파일 <span className="text-slate-400">{portalDocs.length}</span></h3>
        {portalDocs.length === 0 ? (
          <p className="mt-2 text-[0.92rem] text-slate-500">고객이 올렸거나 고객에게 공유한 파일이 없습니다. 고객 플랫폼 탭에서 요청·공유할 수 있습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {portalDocs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <FileText aria-hidden="true" className={`size-5 shrink-0 ${d.source === 'customer' ? 'text-cat-client-500' : 'text-cat-money-500'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.95rem] font-semibold text-slate-800">{d.title}</span>
                  <span className="block truncate text-[0.85rem] text-slate-500">
                    {d.source === 'customer' ? '고객 업로드' : '고객에게 공유'} · {DOCUMENT_STATUS_LABEL[d.status]} · {d.fileName}
                    {d.uploadedAt ? ` · ${activityTimeText(d.uploadedAt)}` : ''}
                  </span>
                </span>
                {uploadable && d.storagePath && !d.storagePath.startsWith('demo/') && (
                  <button type="button" onClick={() => void open(d.storagePath)} className="inline-flex h-9 items-center gap-1 rounded-(--radius-control) border border-slate-200 px-3 text-[0.88rem] font-medium text-slate-700 hover:bg-slate-50">
                    <Download aria-hidden="true" className="size-4" /> 열기
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
