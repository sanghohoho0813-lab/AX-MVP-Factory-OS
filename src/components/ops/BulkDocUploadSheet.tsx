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
import type { ClientOpsRecord, DocumentKey, DocumentState } from '../../types/clientOps'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useToast } from '../ui/toastContext'
import { canExtractText, extractTextFromFile } from '../../services/docTextExtract'
import { OTHER_DOC_LABEL, placeDocument, type DocPlacement } from '../../services/docClassify'
import { cellForPlacement } from '../../services/docPlacementApply'
import { allDocumentMetas } from '../../services/clientOpsDocuments'
import { canUploadFiles, saveClient, storeDocumentFile, withDocument } from '../../services/clientOpsService'
import { formatFileSize } from '../../lib/format'
import { particle } from '../../lib/josa'
import { generateId } from '../../storage/localStore'
import { nowIso, todayLocalDate } from '../../lib/appClock'
import { analyzeUploadedDocs, type DocBatchSummary } from '../../services/docAutoAnalyze'
import { isSystemFile } from '../../services/docShelf'
import type { ReadDoc, ReadMethod } from '../../services/docAutoFill'

/** '기타 · 확인 필요 · 스캔0003' — 기타 칸을 파일마다 구별하는 짧은 이름 */
function shortName(fileName: string): string {
  return fileName.replace(/\.[A-Za-z0-9]{1,5}$/, '').slice(0, 24)
}

/** '새 칸 만들기' 를 뜻하는 고르는 칸 값 */
const NEW_CELL = '__new__'

interface Item {
  id: string
  file: File
  status: 'queued' | 'reading' | 'ready' | 'uploading' | 'done' | 'error'
  progress: { ratio: number; label: string } | null
  /** D-146: 제목으로 정한 칸(있는 칸 · 새 칸 · 기타) */
  result: DocPlacement | null
  /** 고른 칸. '' 은 아직 안 고름, NEW_CELL 은 새 칸 */
  target: DocumentKey | '' | typeof NEW_CELL
  newLabel: string
  issuedAt: string
  error: string
  /** D-128: 읽은 글자 — 사업자등록증 · 등기부등본 · 인증서면 회사 정보를 찾아 '확인 필요' 로 남긴다(글자는 저장하지 않는다) */
  text: string
  /** D-144: 글자를 어떻게 읽었나 — 사진 · 스캔(OCR)이면 읽은 값을 바로 넣지 않고 묻는다 */
  method: ReadMethod
  /** D-144: 사람이 칸을 직접 바꿨나 — 바꿨으면 서류 종류는 사람이 확인한 것 */
  manual: boolean
}

export function BulkDocUploadSheet({
  record,
  onClose,
  onSaved,
  auto = false,
  latest,
  showSignal,
}: {
  /** D-157: 숨긴 창을 다시 보이게 — 바뀔 때마다(같은 업체에서 [서류 올리기] 를 또 누름) */
  showSignal?: number
  record: ClientOpsRecord
  onClose: () => void
  /** 올린 뒤의 최신 기록 · 이번에 읽어 반영한 것 */
  onSaved: (next: ClientOpsRecord, summary: DocBatchSummary) => void
  /**
   * D-144: 업체 머리줄 '서류 올리기' — 읽자마자 종류가 확실한 것은 저절로 올리고 분석한다.
   * 종류가 애매한 것만 남겨 칸을 고르게 한다. 남은 것이 없으면 창을 닫는다.
   */
  auto?: boolean
  /** D-148: 저장할 때의 최신 업체 기록(페이지가 들고 있는 것) — 없으면 받은 record */
  latest?: () => ClientOpsRecord
}) {
  const { showToast } = useToast()
  const uploadable = canUploadFiles()
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const [autoNote, setAutoNote] = useState('')
  /*
   * D-147: 무엇을 하는 중인가 — 읽는 중에 창을 닫으면 남은 파일을 올리지 않고 멈춘다.
   * 올리는 중에는 닫지 않는다(보관함에는 올라갔는데 업체 기록에 안 적힌 파일이 생긴다).
   */
  const [phase, setPhase] = useState<'idle' | 'reading' | 'uploading'>('idle')
  const stoppedRef = useRef(false)
  /*
   * D-157: 창을 닫아도(X · Esc · 뒤로가기) 읽기 · 올리기는 뒤에서 계속한다 — 40% 올리다 바깥을 눌렀더니 없었던 일이 됐다(대표).
   * 창만 숨기고 화면 위에 '서류 올리는 중 n/m' 을 띄워 다시 열 수 있게 한다. 멈추는 것은 [읽기 멈추기] 를 눌렀을 때만.
   */
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    if (showSignal) setHidden(false)
  }, [showSignal])
  /* D-147: 저장은 '그때의 최신 기록' 위에 — 오래 읽는 동안 다른 데서 고친 것을 덮지 않게 */
  const recordRef = useRef(record)
  useEffect(() => {
    recordRef.current = record
  }, [record])
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
    const picked = files.filter((f) => f.size > 0 && !isSystemFile(f))
    const skipped = files.length - picked.length
    if (skipped > 0) showToast(`서류가 아닌 컴퓨터 파일 ${skipped}개(빈 파일 · Thumbs.db 같은 것)는 뺐습니다.`)
    if (picked.length === 0) return
    stoppedRef.current = false
    setPhase('reading')
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
      text: '',
      method: 'none',
      manual: false,
    }))
    setItems((list) => [...list, ...fresh])
    setBusy(true)
    const read: Item[] = []
    for (const it of fresh) {
      if (stoppedRef.current) return
      patch(it.id, { status: 'reading', progress: { ratio: 0, label: '읽는 중' } })
      let text = ''
      let method: ReadMethod = 'none'
      try {
        if (canExtractText(it.file)) {
          const res = await extractTextFromFile(it.file, (ratio, label) => patch(it.id, { progress: { ratio, label } }))
          text = res.text
          method = res.method
        }
      } catch {
        // 못 읽어도 멈추지 않는다 — 파일 이름으로 판별한다
        text = ''
      }
      // D-146: 서류 맨 위 제목으로 칸을 정한다 — 맞는 칸이 없으면 그 이름으로 새 칸, 모르면 '기타 · 확인 필요'(남는 파일 없음)
      const result = placeDocument({ text, fileName: it.file.name }, metas)
      const next: Partial<Item> = {
        text,
        method,
        status: 'ready',
        progress: null,
        result,
        target: result.kind === 'existing' ? result.key : NEW_CELL,
        newLabel: result.kind === 'new' ? (result.label === OTHER_DOC_LABEL ? `${OTHER_DOC_LABEL} · ${shortName(it.file.name)}` : result.label) : '',
        issuedAt: result.issuedAt ?? '',
      }
      patch(it.id, next)
      read.push({ ...it, ...next } as Item)
    }
    setBusy(false)
    setPhase('idle')
    if (stoppedRef.current) return
    if (auto) {
      // D-146: 하나도 남기지 않고 전부 올린다 — 칸은 제목으로, 모르면 '기타 · 확인 필요'. 사람은 나중에 서류 탭에서 열어 보고 고친다
      const others = read.filter((it) => it.newLabel.startsWith(OTHER_DOC_LABEL)).length
      setAutoNote(`${read.length}개를 모두 서류함에 올립니다${others ? ` · 무슨 서류인지 모르는 ${others}개는 '${OTHER_DOC_LABEL}' 칸으로` : ''}.`)
      await upload(read, { closeWhenDone: true })
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    // D-148: 읽거나 올리는 중에 또 넣으면 두 묶음이 서로의 저장을 덮을 수 있다 — 끝난 뒤에 넣게 한다
    if (phase !== 'idle') {
      showToast('지금 넣은 서류를 처리하는 중입니다 — 끝난 뒤에 더 넣어 주세요.')
      return
    }
    void addFiles(Array.from(e.dataTransfer.files ?? []))
  }

  const readyItems = items.filter((it) => it.status === 'ready')
  // D-148: 이름 없는 새 칸은 '확실' 에도 넣지 않는다(고른 것 전부와 같은 기준)
  const sureItems = readyItems.filter((it) => it.result?.sure && it.target !== '' && !(it.target === NEW_CELL && it.newLabel.trim() === ''))
  const assignedItems = readyItems.filter((it) => it.target !== '' && !(it.target === NEW_CELL && it.newLabel.trim() === ''))

  /** 고른 것을 차례로 올린다. 새 칸은 만들면서 올린다 */
  const upload = async (targets: Item[], opts: { closeWhenDone?: boolean } = {}) => {
    if (targets.length === 0) return
    setBusy(true)
    setPhase('uploading')
    let okCount = 0
    const doneIds: string[] = []
    /*
     * D-148: 두 단계로 — (1) 파일만 보관함에 올린다 (2) 다 올린 뒤 '그때의 최신 기록' 위에 칸을 정해 적는다.
     * 예전에는 시작할 때 기록을 들고 칸부터 만들었다 — 그 사이 다른 데서 저장한 것(카드 하나 올리기 · 다른 묶음)을 덮었고,
     * 올리기에 실패한 파일의 빈 칸이 남았다.
     */
    const stored: { it: Item; placement: DocPlacement; patch: Partial<DocumentState> }[] = []
    for (const it of targets) {
      patch(it.id, { status: 'uploading', error: '' })
      try {
        const label = it.newLabel.trim()
        // D-148: 이름 없는 '새 칸' 은 기타 칸으로 — 예전에는 다른 직접 만든 칸에 들어가 그 파일을 덮었다
        const placement: DocPlacement =
          it.target === NEW_CELL || it.target === ''
            ? { kind: 'new', label: label || `${OTHER_DOC_LABEL} · ${shortName(it.file.name)}`, sure: true, reason: '', issuedAt: null }
            : { kind: 'existing', key: it.target as DocumentKey, label: metas.find((m) => m.key === it.target)?.label ?? '', sure: true, reason: '', issuedAt: null }
        const pathKey: DocumentKey = placement.kind === 'existing' ? placement.key : 'customdoc_new'
        const filePatch: Partial<DocumentState> = uploadable
          ? // D-120: 파일만 올리고, 기록 저장은 끝에 한 번
            await storeDocumentFile(recordRef.current, pathKey, it.file)
          : // 이 브라우저 모드에는 파일 보관이 없다 — 받았다는 사실과 이름·발급일만 남긴다
            { received: true, fileName: it.file.name, fileSize: it.file.size }
        stored.push({ it, placement, patch: it.issuedAt ? { ...filePatch, received: true, issuedAt: it.issuedAt } : filePatch })
        patch(it.id, { status: 'done' })
        doneIds.push(it.id)
        okCount += 1
      } catch (cause) {
        patch(it.id, { status: 'error', error: cause instanceof Error ? cause.message : '올리지 못했습니다.' })
      }
    }
    // (2) 최신 기록 위에 칸을 정해 적는다 — 이번 묶음에서 이미 넣은 칸은 '(2)' 칸으로(덮지 않는다)
    let rec = latest ? latest() : recordRef.current
    /** D-147: 이미 서류함에 있던 파일(이름 · 크기 같음) — 겹친 줄 알도록 표시만 한다(올리기는 그대로) */
    const seen = new Set(Object.values(rec.documents).filter((d) => d?.fileName).map((d) => `${d.fileName}|${d.fileSize}`))
    const readDocs: ReadDoc[] = []
    const placed: NonNullable<DocBatchSummary['placed']> = []
    const used = new Set<string>()
    for (const { it, placement, patch: filePatch } of stored) {
      const cell = cellForPlacement(rec, placement, used)
      rec = withDocument(cell.record, cell.key, filePatch)
      const sig = `${it.file.name}|${it.file.size}`
      placed.push({ fileName: it.file.name, label: cell.label, other: cell.label.startsWith(OTHER_DOC_LABEL), numbered: cell.numbered, same: seen.has(sig) })
      seen.add(sig)
      // D-144: 읽은 글자는 끝에 한 번에 — 회사 정보 · 크레탑 · 명부.
      // D-148: '사업자등록증 (2)' 칸에 들어가도 사업자등록증으로 읽는다(칸 키가 아니라 서류 종류로)
      const factKey: DocumentKey = placement.kind === 'existing' ? placement.key : cell.key
      readDocs.push({ key: factKey, fileName: it.file.name, text: it.text, method: it.method, docSure: Boolean(it.result?.sure) || it.manual })
    }
    // D-122: 하나도 못 올렸으면 저장하지 않는다('0건을 올렸습니다' 라고 하지 않게)
    if (okCount === 0) {
      showToast('올린 서류가 없습니다. 빨간 줄의 까닭을 확인하고 다시 올려 주세요.')
      setBusy(false)
      setPhase('idle')
      return
    }
    try {
      const analyzed = await analyzeUploadedDocs(rec, readDocs, { now: nowIso(), today: todayLocalDate(), makeId: generateId })
      const saved = await saveClient(analyzed.record)
      onSaved(saved, { ...analyzed.summary, placed })
      const sm = analyzed.summary
      const others = placed.filter((x) => x.other).length
      const tail = [
        sm.entered.length ? `바로 넣은 정보 ${sm.entered.length}건` : '',
        sm.flagged.length ? `확인할 정보 ${sm.flagged.length}건` : '',
        sm.cretop ? '크레탑 분석 붙임' : '',
        sm.roster ? `명부 진단(후보 지원금 ${sm.roster.candidates}건)` : '',
      ].filter(Boolean)
      showToast(
        (uploadable ? `서류 ${okCount}건을 서류함에 올렸습니다.` : `서류 ${okCount}건을 서류함에 기록했습니다. 파일 자체는 클라우드 연결 후 보관됩니다.`) +
          (others ? ` 무슨 서류인지 모르는 ${others}건은 '${OTHER_DOC_LABEL}' 칸에 있습니다.` : '') +
          (tail.length ? ` ${tail.join(' · ')} — 맞춤 추천에서 보세요.` : ''),
      )
      if (opts.closeWhenDone) onClose()
    } catch (cause) {
      // D-122: 파일은 올라갔는데 업체 기록 저장이 실패했다 — 초록 체크로 두면 다시 올릴 수 없으니 '다시 올리기' 로 되돌린다
      for (const id of doneIds) patch(id, { status: 'ready', error: '업체 기록에 저장하지 못했습니다 — 다시 올려 주세요' })
      showToast(cause instanceof Error ? `${cause.message} — 서류를 다시 올려 주세요.` : '저장하지 못했습니다. 서류를 다시 올려 주세요.')
    } finally {
      setBusy(false)
      setPhase('idle')
    }
  }

  /** 아직 올리지 않은 읽은 서류(고르던 것) */
  const pending = items.filter((it) => it.status === 'ready' || it.status === 'error').length
  /**
   * D-157: X · Esc · 뒤로가기 — 하던 일이 있으면 지우지 않고 창만 숨긴다(뒤에서 계속). 하던 일이 없으면 닫는다.
   */
  const closeSheet = () => {
    if (phase !== 'idle' || pending > 0) {
      setHidden(true)
      showToast(phase !== 'idle' ? '창만 닫았습니다 — 서류는 뒤에서 계속 올립니다. 화면 위 \'서류 올리는 중\' 을 누르면 다시 볼 수 있어요.' : '고르던 서류는 그대로 둡니다 — 화면 위 \'올릴 서류\' 를 누르면 이어서 할 수 있어요.')
      return
    }
    onClose()
  }
  /** [읽기 멈추기] — 일부러 멈출 때만. 이번 파일은 하나도 올리지 않는다 */
  const stopReading = () => {
    stoppedRef.current = true
    showToast('읽기를 멈췄습니다 — 이번 파일은 하나도 올리지 않았습니다.')
    onClose()
  }
  const doneCount = items.filter((it) => it.status === 'done').length
  const readCount = items.filter((it) => it.status !== 'queued' && it.status !== 'reading').length

  const existingFile = (key: string) => record.documents[key]?.fileName ?? ''

  return (
    <>
    {hidden && (
      <button
        type="button"
        onClick={() => setHidden(false)}
        data-testid="bulk-minimized"
        data-phase={phase}
        className="tap t-sub fixed top-20 left-1/2 z-40 inline-flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-brand-300 bg-white px-4 py-2.5 font-semibold text-brand-800 shadow-(--shadow-overlay)"
      >
        <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${phase === 'idle' ? 'bg-warning-500' : 'animate-pulse bg-brand-600'}`} />
        <span className="truncate">
          {phase === 'reading'
            ? `서류 읽는 중 ${readCount}/${items.length}`
            : phase === 'uploading'
              ? `서류함에 올리는 중 ${doneCount}/${items.length}`
              : `올릴 서류 ${pending}개 — 이어서 하기`}
        </span>
      </button>
    )}
    <Modal
      open={!hidden}
      size="lg"
      title={`${record.companyName} — 서류 한꺼번에 올리기`}
      onClose={closeSheet}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="t-sub mr-auto text-slate-500">
            {readyItems.length > 0 && `${readyItems.length}개 중 확실 ${sureItems.length} · 고른 것 ${assignedItems.length}`}
          </span>
          {phase === 'reading' && (
            <Button variant="ghost" onClick={stopReading} data-testid="bulk-stop">
              읽기 멈추기
            </Button>
          )}
          {phase === 'idle' && pending > 0 && (
            <Button variant="ghost" onClick={onClose} data-testid="bulk-discard">
              안 올리고 닫기
            </Button>
          )}
          <Button variant="ghost" onClick={closeSheet} data-testid="bulk-close">
            {phase !== 'idle' ? '창 닫기(뒤에서 계속)' : pending > 0 ? '나중에 하기' : '닫기'}
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
        {autoNote && (
          <p role="status" data-testid="bulk-auto-note" className="rounded-(--radius-control) border border-warning-200 bg-warning-50 px-4 py-3 t-sub break-keep text-warning-800">
            {autoNote}
          </p>
        )}
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
              const conf = it.result ? (it.result.sure ? 'sure' : 'maybe') : null
              const targetLabel = it.target === NEW_CELL ? `새 칸: ${it.newLabel || '(이름)'}` : (metas.find((m) => m.key === it.target)?.label ?? '')
              const replacing = it.target !== '' && it.target !== NEW_CELL ? existingFile(it.target) : ''
              return (
                <li key={it.id} className="flex flex-col gap-2 px-4 py-3" data-testid="bulk-item" data-status={it.status}>
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
                        {conf === 'sure' ? '확실' : '확인 필요'}
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
                  {(it.status === 'error' || (it.status === 'ready' && it.error !== '')) && <p className="t-sub text-danger-700">{it.error}</p>}

                  {it.status === 'ready' && it.result && (
                    <>
                      <p className="t-sub break-keep text-slate-600">{it.result.reason}</p>
                      {/* 칸 고르기 — 판별이 틀렸으면 여기서 바꾼다. 확실해도 바꿀 수 있다 */}
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="w-full text-[0.875rem] font-medium text-slate-600 sm:w-auto sm:flex-1 sm:max-w-xs">
                          어느 칸에
                          <select
                            aria-label={`${it.file.name} 칸 고르기`}
                            value={it.target}
                            onChange={(e) => patch(it.id, { target: e.target.value as Item['target'], manual: true })}
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
                          <label className="w-full text-[0.875rem] font-medium text-slate-600 sm:w-48">
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
                        <label className="text-[0.875rem] font-medium text-slate-600">
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
                        <p className="t-sub text-slate-600">
                          그 칸에 이미 <strong className="font-semibold">{replacing}</strong>{particle(replacing, '이/가')} 있어요 — 덮지 않고 번호 붙은 칸에 따로 올려요(서류 탭에서 보고 오래된 것을 지우세요).
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
    </>
  )
}
