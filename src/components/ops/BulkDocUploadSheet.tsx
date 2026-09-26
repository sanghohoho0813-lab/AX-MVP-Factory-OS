/**
 * 서류 한꺼번에 올리기 (D-84).
 *
 * 폴더째, 파일 여러 개를 한 번에 넣는다. 파일마다 글자를 읽고(PDF 글자 · 사진 OCR · 글자 파일)
 * 어느 칸인지 판별한다. 확실한 것은 그대로 올리고, 확인이 필요한 것은 사람이 칸을 고른다.
 * 칸이 없는 서류(법인인감증명서 같은)는 그 이름으로 칸을 만들면서 올린다.
 *
 * 규칙 계산이다 — 외부 호출 없음. 사진·스캔본은 처음 한 번 한글 인식 준비가 걸린다.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, FileUp, FolderUp, Loader2, X } from 'lucide-react'
import type { ClientOpsRecord, DocumentKey } from '../../types/clientOps'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useToast } from '../ui/toastContext'
import { canExtractText, extractTextFromFile } from '../../services/docTextExtract'
import { CONFIDENCE_LABEL, classifyDocument, type ClassifyResult } from '../../services/docClassify'
import { allDocumentMetas } from '../../services/clientOpsDocuments'
import { canUploadFiles, saveClient, storeDocumentFile, withCustomDocument, withDocument } from '../../services/clientOpsService'
import { formatFileSize } from '../../lib/format'

/** '새 칸 만들기' 를 뜻하는 고르는 칸 값 */
const NEW_CELL = '__new__'

interface Item {
  id: string
  file: File
  status: 'queued' | 'reading' | 'ready' | 'uploading' | 'done' | 'error'
  progress: { ratio: number; label: string } | null
  result: ClassifyResult | null
  /** 고른 칸. '' 은 아직 안 고름, NEW_CELL 은 새 칸 */
  target: DocumentKey | '' | typeof NEW_CELL
  newLabel: string
  issuedAt: string
  error: string
}

export function BulkDocUploadSheet({
  record,
  onClose,
  onSaved,
}: {
  record: ClientOpsRecord
  onClose: () => void
  /** 올린 뒤의 최신 기록 */
  onSaved: (next: ClientOpsRecord) => void
}) {
  const { showToast } = useToast()
  const uploadable = canUploadFiles()
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const metas = allDocumentMetas(record).filter((m) => m.needsFile)

  /* 폴더 고르기는 표준 속성이 아니라 ref 로 붙인다 */
  useEffect(() => {
    folderRef.current?.setAttribute('webkitdirectory', '')
    folderRef.current?.setAttribute('directory', '')
  }, [])

  const patch = (id: string, p: Partial<Item>) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)))

  /** 파일을 넣으면 하나씩 읽고 판별한다 — 동시에 여러 OCR 을 돌리면 휴대폰이 멈춘다 */
  const addFiles = async (files: File[]) => {
    const picked = files.filter((f) => f.size > 0 && !f.name.startsWith('.'))
    if (picked.length === 0) return
    const fresh: Item[] = picked.map((file) => ({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      status: 'queued',
      progress: null,
      result: null,
      target: '',
      newLabel: '',
      issuedAt: '',
      error: '',
    }))
    setItems((list) => [...list, ...fresh])
    setBusy(true)
    for (const it of fresh) {
      patch(it.id, { status: 'reading', progress: { ratio: 0, label: '읽는 중' } })
      let text = ''
      try {
        if (canExtractText(it.file)) {
          const res = await extractTextFromFile(it.file, (ratio, label) => patch(it.id, { progress: { ratio, label } }))
          text = res.text
        }
      } catch {
        // 못 읽어도 멈추지 않는다 — 파일 이름으로 판별한다
        text = ''
      }
      const result = classifyDocument({ text, fileName: it.file.name }, metas)
      patch(it.id, {
        status: 'ready',
        progress: null,
        result,
        target: result.key ?? (result.suggestedLabel ? NEW_CELL : ''),
        newLabel: result.suggestedLabel ?? '',
        issuedAt: result.issuedAt ?? '',
      })
    }
    setBusy(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    void addFiles(Array.from(e.dataTransfer.files ?? []))
  }

  const readyItems = items.filter((it) => it.status === 'ready')
  const sureItems = readyItems.filter((it) => it.result?.confidence === 'sure' && it.target !== '' && it.target !== NEW_CELL)
  const assignedItems = readyItems.filter((it) => it.target !== '' && !(it.target === NEW_CELL && it.newLabel.trim() === ''))

  /** 고른 것을 차례로 올린다. 새 칸은 만들면서 올린다 */
  const upload = async (targets: Item[]) => {
    if (targets.length === 0) return
    setBusy(true)
    let rec = record
    let okCount = 0
    for (const it of targets) {
      patch(it.id, { status: 'uploading', error: '' })
      try {
        let key: DocumentKey
        if (it.target === NEW_CELL) {
          rec = withCustomDocument(rec, { label: it.newLabel })
          key = rec.customDocuments[rec.customDocuments.length - 1].key
        } else {
          key = it.target
        }
        if (uploadable) {
          // D-120: 파일만 올리고, 기록 저장은 끝에 한 번(파일마다 저장하던 것을 줄였다)
          rec = withDocument(rec, key, await storeDocumentFile(rec, key, it.file))
        } else {
          // 이 브라우저 모드에는 파일 보관이 없다 — 받았다는 사실과 이름·발급일만 남긴다
          rec = withDocument(rec, key, { received: true, fileName: it.file.name, fileSize: it.file.size })
        }
        if (it.issuedAt) rec = withDocument(rec, key, { received: true, issuedAt: it.issuedAt })
        patch(it.id, { status: 'done' })
        okCount += 1
      } catch (cause) {
        patch(it.id, { status: 'error', error: cause instanceof Error ? cause.message : '올리지 못했습니다.' })
      }
    }
    try {
      const saved = await saveClient(rec)
      onSaved(saved)
      showToast(uploadable ? `서류 ${okCount}건을 올렸습니다.` : `서류 ${okCount}건을 기록했습니다. 파일 자체는 클라우드 연결 후 보관됩니다.`)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const existingFile = (key: string) => record.documents[key]?.fileName ?? ''

  return (
    <Modal
      open
      size="lg"
      title={`${record.companyName} — 서류 한꺼번에 올리기`}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="t-sub mr-auto text-slate-500">
            {readyItems.length > 0 && `${readyItems.length}개 중 확실 ${sureItems.length} · 고른 것 ${assignedItems.length}`}
          </span>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            닫기
          </Button>
          <Button variant="secondary" disabled={busy || sureItems.length === 0} onClick={() => void upload(sureItems)}>
            확실한 것만 올리기{sureItems.length > 0 ? ` (${sureItems.length})` : ''}
          </Button>
          <Button variant="primary" disabled={busy || assignedItems.length === 0} onClick={() => void upload(assignedItems)}>
            고른 것 전부 올리기{assignedItems.length > 0 ? ` (${assignedItems.length})` : ''}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {!uploadable && (
          <p className="rounded-(--radius-control) border border-slate-200 bg-slate-50 px-4 py-3 text-[0.92rem] break-keep text-slate-600">
            지금은 이 브라우저에만 저장되는 모드입니다. 종류 판별과 받음·발급일·파일 이름은 기록되고, 파일 자체는 클라우드(Supabase)를
            연결하면 보관됩니다.
          </p>
        )}

        {/* 넣는 곳 — 끌어다 놓기 · 파일 고르기 · 폴더 고르기 */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="flex flex-col items-center gap-2 rounded-(--radius-panel) border-2 border-dashed border-slate-300 px-5 py-6 text-center"
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            aria-label="서류 파일 고르기"
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />
          <input
            ref={folderRef}
            type="file"
            multiple
            className="hidden"
            aria-label="서류 폴더 고르기"
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />
          <FileUp aria-hidden="true" className="size-7 text-brand-500" />
          <p className="text-[1.02rem] font-semibold text-slate-800">여기에 파일을 끌어다 놓거나</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
              <FileUp aria-hidden="true" className="size-4" />
              파일 고르기
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => folderRef.current?.click()}>
              <FolderUp aria-hidden="true" className="size-4" />
              폴더째 고르기
            </Button>
          </div>
          <p className="text-[0.88rem] break-keep text-slate-500">
            PDF·사진·글자 파일은 내용을 읽어 어느 칸인지 가립니다. 그 밖의 파일(한글·워드·압축)은 파일 이름으로만 가립니다.
            사진과 스캔본은 처음 한 번 한글 인식 준비가 걸립니다.
          </p>
        </div>

        {items.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-(--radius-panel) border border-slate-200">
            {items.map((it) => {
              const conf = it.result?.confidence ?? null
              const targetLabel = it.target === NEW_CELL ? `새 칸: ${it.newLabel || '(이름)'}` : (metas.find((m) => m.key === it.target)?.label ?? '')
              const replacing = it.target !== '' && it.target !== NEW_CELL ? existingFile(it.target) : ''
              return (
                <li key={it.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {it.status === 'done' ? (
                      <Check aria-hidden="true" className="size-4 shrink-0 text-success-600" />
                    ) : it.status === 'reading' || it.status === 'uploading' ? (
                      <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-brand-600" />
                    ) : it.status === 'error' ? (
                      <X aria-hidden="true" className="size-4 shrink-0 text-danger-600" />
                    ) : (
                      <span aria-hidden="true" className="size-4 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[0.98rem] font-semibold text-slate-900">{it.file.name}</span>
                    <span className="t-meta shrink-0 text-slate-400">{formatFileSize(it.file.size)}</span>
                    {conf && it.status !== 'done' && (
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 t-meta font-bold ${
                          conf === 'sure'
                            ? 'border-success-200 bg-success-50 text-success-700'
                            : conf === 'maybe'
                              ? 'border-warning-200 bg-warning-50 text-warning-700'
                              : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                      >
                        {CONFIDENCE_LABEL[conf]}
                      </span>
                    )}
                    {it.status === 'done' && (
                      <span className="shrink-0 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 t-meta font-bold text-success-700">
                        올림 · {targetLabel}
                      </span>
                    )}
                  </div>

                  {it.status === 'reading' && it.progress && (
                    <p className="t-sub text-slate-500">{it.progress.label}</p>
                  )}
                  {it.status === 'error' && <p className="t-sub text-danger-700">{it.error}</p>}

                  {it.status === 'ready' && it.result && (
                    <>
                      <p className="t-sub break-keep text-slate-600">{it.result.reason}</p>
                      {/* 칸 고르기 — 판별이 틀렸으면 여기서 바꾼다. 확실해도 바꿀 수 있다 */}
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="w-full text-[0.85rem] font-medium text-slate-600 sm:w-auto sm:flex-1 sm:max-w-xs">
                          어느 칸에
                          <select
                            aria-label={`${it.file.name} 칸 고르기`}
                            value={it.target}
                            onChange={(e) => patch(it.id, { target: e.target.value as Item['target'] })}
                            className={`mt-1 block w-full rounded-(--radius-control) border bg-white px-2 py-2 text-[0.95rem] ${
                              it.target === '' ? 'border-warning-300' : 'border-slate-300'
                            }`}
                          >
                            <option value="">— 아직 안 고름 —</option>
                            {metas.map((m) => (
                              <option key={m.key} value={m.key}>
                                {m.label}
                              </option>
                            ))}
                            <option value={NEW_CELL}>새 칸 만들어 올리기…</option>
                          </select>
                        </label>
                        {it.target === NEW_CELL && (
                          <label className="w-full text-[0.85rem] font-medium text-slate-600 sm:w-48">
                            새 칸 이름
                            <input
                              aria-label={`${it.file.name} 새 칸 이름`}
                              value={it.newLabel}
                              onChange={(e) => patch(it.id, { newLabel: e.target.value })}
                              placeholder="예: 법인인감증명서"
                              className="mt-1 block w-full rounded-(--radius-control) border border-slate-300 px-2 py-2 text-[0.95rem]"
                            />
                          </label>
                        )}
                        <label className="text-[0.85rem] font-medium text-slate-600">
                          발급일
                          <input
                            type="date"
                            aria-label={`${it.file.name} 발급일`}
                            value={it.issuedAt}
                            onChange={(e) => patch(it.id, { issuedAt: e.target.value })}
                            className="mt-1 block rounded-(--radius-control) border border-slate-300 px-2 py-2 text-[0.95rem]"
                          />
                        </label>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy || it.target === '' || (it.target === NEW_CELL && it.newLabel.trim() === '')}
                          onClick={() => void upload([it])}
                        >
                          이것만 올리기
                        </Button>
                      </div>
                      {replacing && (
                        <p className="t-sub text-warning-700">
                          그 칸에 이미 <strong className="font-semibold">{replacing}</strong> 이(가) 있습니다 — 올리면 바뀝니다.
                        </p>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}
