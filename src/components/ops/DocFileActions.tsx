/**
 * 첨부 파일 한 개로 할 수 있는 것 (D-129) — 서류 탭 · 고객과 주고받은 파일이 같은 단추를 쓴다.
 *
 *   [미리보기]        PDF · 사진은 OS 안에서 바로(창을 옮기지 않는다)
 *   [새 창에서 열기]  모든 파일
 *   [내려받기]        원래 파일 이름으로
 *   [파일 교체]       내 서류함 파일만
 *
 * 저장소는 비공개(private) 그대로다 — 누를 때마다 몇 분짜리 서명 주소를 새로 받는다(documentFileUrl).
 * HWP · 압축 파일처럼 브라우저가 못 여는 것은 억지로 미리 보지 않는다 — 새 창 · 내려받기로 안내.
 */

import { useEffect, useState } from 'react'
import { Download, Eye, ExternalLink, Upload } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/toastContext'
import { canUploadFiles, documentFileUrl, downloadDocumentFile } from '../../services/clientOpsService'
import { previewKindOf } from '../../lib/filePreview'

export function DocFileActions({
  label,
  storagePath,
  fileName,
  onReplace,
}: {
  /** 서류 이름 — 단추 이름에 붙는다('사업자등록증 미리보기') */
  label: string
  storagePath: string
  fileName: string
  /** 있으면 [파일 교체] */
  onReplace?: () => void
}) {
  const { showToast } = useToast()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const uploadable = canUploadFiles()
  const kind = previewKindOf(fileName)
  const hasFile = storagePath !== ''
  const off = !uploadable
  const offTitle = off ? '클라우드를 연결하면 열 수 있습니다.' : undefined

  const signed = async (): Promise<string | null> => {
    try {
      const url = await documentFileUrl(storagePath)
      if (!url) throw new Error('파일 주소를 만들지 못했습니다.')
      return url
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '파일을 열지 못했습니다.')
      return null
    }
  }

  const preview = async () => {
    const url = await signed()
    if (url) setPreviewUrl(url)
  }
  const openNew = async () => {
    // 휴대폰 팝업 차단을 피하려고 창을 먼저 열고 주소를 넣는다
    const w = window.open('', '_blank')
    const url = await signed()
    if (!url) {
      w?.close()
      return
    }
    if (w) {
      w.opener = null
      w.location.href = url
    } else {
      window.location.href = url
    }
  }
  const download = async () => {
    try {
      await downloadDocumentFile({ storagePath, fileName })
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '파일을 내려받지 못했습니다.')
    }
  }

  return (
    <>
      <span className="flex flex-wrap items-center gap-1.5" data-file-actions={label}>
        {hasFile && kind && (
          <Button variant="secondary" size="sm" aria-label={`${label} 미리보기`} disabled={off} title={offTitle} onClick={() => void preview()}>
            <Eye aria-hidden="true" className="size-3.5" /> 미리보기
          </Button>
        )}
        {hasFile && (
          <Button variant="secondary" size="sm" aria-label={`${label} 새 창에서 열기`} disabled={off} title={offTitle} onClick={() => void openNew()}>
            <ExternalLink aria-hidden="true" className="size-3.5" /> 새 창에서 열기
          </Button>
        )}
        {hasFile && (
          <Button variant="secondary" size="sm" aria-label={`${label} 내려받기`} disabled={off} title={offTitle} onClick={() => void download()}>
            <Download aria-hidden="true" className="size-3.5" /> 내려받기
          </Button>
        )}
        {onReplace && (
          <Button variant="ghost" size="sm" aria-label={`${label} ${fileName ? '파일 교체' : '파일 첨부'}`} disabled={off} onClick={onReplace}>
            <Upload aria-hidden="true" className="size-3.5" /> {fileName ? '파일 교체' : '파일 첨부'}
          </Button>
        )}
      </span>
      {hasFile && !kind && !off && (
        <span className="t-meta block break-keep text-slate-500">이 형식(HWP · 압축 등)은 여기서 미리 볼 수 없습니다 — 새 창에서 열거나 내려받으세요.</span>
      )}
      {previewUrl && <FilePreviewModal label={label} fileName={fileName} url={previewUrl} onClose={() => setPreviewUrl(null)} onOpenNew={() => void openNew()} onDownload={() => void download()} />}
    </>
  )
}

function FilePreviewModal({
  label,
  fileName,
  url,
  onClose,
  onOpenNew,
  onDownload,
}: {
  label: string
  fileName: string
  url: string
  onClose: () => void
  onOpenNew: () => void
  onDownload: () => void
}) {
  const kind = previewKindOf(fileName)
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])
  return (
    <Modal
      open
      size="lg"
      title={`${label} — 미리보기`}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onOpenNew}>
            <ExternalLink aria-hidden="true" className="size-4" /> 새 창에서 열기
          </Button>
          <Button variant="secondary" onClick={onDownload}>
            <Download aria-hidden="true" className="size-4" /> 내려받기
          </Button>
          <Button variant="primary" onClick={onClose}>
            닫기
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2" data-testid="file-preview" data-kind={kind ?? ''}>
        <p className="t-sub truncate text-slate-500">{fileName}</p>
        {failed ? (
          <p className="t-body break-keep text-slate-700">미리 보지 못했습니다. 새 창에서 열거나 내려받아 주세요.</p>
        ) : kind === 'image' ? (
          <img src={url} alt={`${label} 미리보기`} onError={() => setFailed(true)} className="max-h-[70vh] w-full rounded-(--radius-control) border border-slate-200 object-contain" />
        ) : (
          <iframe src={url} title={`${label} 미리보기`} className="h-[70vh] w-full rounded-(--radius-control) border border-slate-200 bg-white" />
        )}
        {kind === 'pdf' && <p className="t-meta break-keep text-slate-500">휴대폰에서 첫 장만 보이면 ‘새 창에서 열기’ 로 전체를 보세요.</p>}
      </div>
    </Modal>
  )
}
