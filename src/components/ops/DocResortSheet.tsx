/**
 * 서류 다시 분류 (D-146).
 *
 * 이미 올려 둔 파일을 다시 읽어(맨 위 제목 · 없으면 파일 이름) 맞는 칸으로 옮긴다.
 * 예전 판별이 낱말 점수로 칸을 골라 '대표자 신분증 사본' 칸에 졸업증명서가, '중소기업 확인서' 칸에 다른 서류가 들어가
 * 엉뚱한 '만료' 가 뜨던 업체를 정리한다.
 *
 *  - 제목이 칸 이름과 다를 때만 옮기자고 한다. 제목을 못 찾은 파일은 그대로 둔다(사람이 둔 칸을 존중).
 *  - 바로 옮기지 않는다 — 무엇을 어디로 옮기는지 먼저 보이고, 고른 것만 옮긴다.
 *  - 파일 자체는 건드리지 않는다(보관함 경로만 다른 칸으로).
 *
 * 규칙 계산이다 — 외부 호출 없음. 클라우드가 아니면 파일이 없으니 파일 이름으로만 본다.
 */

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { canExtractText, extractTextFromFile } from '../../services/docTextExtract'
import { placeDocument } from '../../services/docClassify'
import { applyResort, resortDecision, type ResortItem } from '../../services/docPlacementApply'
import { allDocumentMetas } from '../../services/clientOpsDocuments'
import { canUploadFiles, documentFileUrl, withDocument, withoutCustomDocument } from '../../services/clientOpsService'
import { analyzeUploadedDocs } from '../../services/docAutoAnalyze'
import type { ReadDoc, ReadMethod } from '../../services/docAutoFill'
import { generateId } from '../../storage/localStore'
import { nowIso, todayLocalDate } from '../../lib/appClock'

interface Read extends ResortItem {
  text: string
  method: ReadMethod
}

/** 보관함 파일 → 글자(못 읽으면 '') */
async function readStored(storagePath: string, fileName: string): Promise<{ text: string; method: ReadMethod }> {
  if (!canUploadFiles() || !storagePath) return { text: '', method: 'none' }
  try {
    const url = await documentFileUrl(storagePath)
    if (!url) return { text: '', method: 'none' }
    const blob = await (await fetch(url)).blob()
    const file = new File([blob], fileName || 'file', { type: blob.type })
    if (!canExtractText(file)) return { text: '', method: 'none' }
    const res = await extractTextFromFile(file)
    return { text: res.text, method: res.method }
  } catch {
    return { text: '', method: 'none' }
  }
}

export function DocResortSheet({
  record,
  onClose,
  onApply,
}: {
  record: ClientOpsRecord
  onClose: () => void
  /** 옮긴 뒤의 기록 — 저장은 부르는 쪽 */
  onApply: (next: ClientOpsRecord, movedCount: number) => void
}) {
  const [items, setItems] = useState<Read[]>([])
  const [reading, setReading] = useState<{ done: number; total: number } | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const uploadable = canUploadFiles()

  // 열 때 한 번 — 파일이 있는 칸을 차례로 읽는다(OCR 을 동시에 돌리면 휴대폰이 멈춘다)
  const cells = useMemo(
    () => allDocumentMetas(record).filter((m) => m.needsFile && (record.documents[m.key]?.fileName || record.documents[m.key]?.storagePath)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useEffect(() => {
    let alive = true
    const run = async () => {
      setReading({ done: 0, total: cells.length })
      const metas = allDocumentMetas(record)
      const out: Read[] = []
      for (const [i, meta] of cells.entries()) {
        const state = record.documents[meta.key]
        const { text, method } = await readStored(state.storagePath, state.fileName)
        if (!alive) return
        const placement = placeDocument({ text, fileName: state.fileName }, metas)
        out.push({ ...resortDecision(meta.key, meta.label, state.fileName, placement), text, method })
        setReading({ done: i + 1, total: cells.length })
      }
      setItems(out)
      setPicked(new Set(out.filter((x) => x.move).map((x) => x.fromKey)))
      setReading(null)
    }
    void run()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const moves = items.filter((x) => x.move)
  const stays = items.filter((x) => !x.move)
  const chosen = moves.filter((x) => picked.has(x.fromKey))

  const apply = async () => {
    if (chosen.length === 0) return
    setBusy(true)
    const out = applyResort(record, chosen, { withDoc: withDocument, withoutCustom: withoutCustomDocument })
    let rec = out.record
    // 옮긴 서류에서 회사 정보를 다시 읽는다(제목이 맞는 서류라 이번엔 종류가 확실하다)
    const docs: ReadDoc[] = out.moved.flatMap((mv) => {
      const src = chosen.find((c) => c.fromKey === mv.fromKey)
      if (!src || src.text.replace(/\s/g, '').length < 10) return []
      return [{ key: mv.key, fileName: mv.fileName, text: src.text, method: src.method, docSure: src.placement.sure }]
    })
    if (docs.length) {
      try {
        rec = (await analyzeUploadedDocs(rec, docs, { now: nowIso(), today: todayLocalDate(), makeId: generateId })).record
      } catch {
        // 회사 정보 읽기는 덤이다 — 실패해도 옮긴 것은 저장한다
      }
    }
    setBusy(false)
    onApply(rec, out.moved.length)
  }

  const toggle = (key: string) =>
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <Modal
      open
      size="lg"
      title="서류 다시 분류"
      onClose={busy ? () => undefined : onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            닫기
          </Button>
          <Button variant="primary" onClick={() => void apply()} disabled={busy || reading !== null || chosen.length === 0} data-testid="resort-apply">
            {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {chosen.length > 0 ? `고른 ${chosen.length}개 옮기기` : '옮길 것 없음'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-testid="resort-sheet">
        <p className="t-body break-keep text-slate-700">
          올려 둔 파일의 <b>맨 위 제목</b>을 다시 읽어 칸 이름과 다르면 맞는 칸으로 옮깁니다. 맞는 칸이 없으면 그 제목으로 칸을 새로 만듭니다. 파일은 그대로이고 칸만 바뀝니다.
        </p>
        {!uploadable && (
          <p className="t-sub rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2 break-keep text-slate-600">
            이 브라우저 모드에는 파일이 없어 <b>파일 이름</b>으로만 봅니다.
          </p>
        )}

        {reading && (
          <p className="t-sub inline-flex items-center gap-2 text-slate-600" data-testid="resort-reading">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            파일 읽는 중 {reading.done}/{reading.total}
          </p>
        )}

        {!reading && items.length === 0 && <p className="t-body text-slate-600">올려 둔 파일이 없습니다.</p>}

        {!reading && items.length > 0 && moves.length === 0 && (
          <p className="t-body rounded-(--radius-control) border border-success-200 bg-success-50 px-3 py-2 break-keep text-success-800" data-testid="resort-none">
            {items.length}개 모두 맞는 칸에 있습니다.
          </p>
        )}

        {moves.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="t-sub font-semibold text-slate-800">옮기자는 것 {moves.length}개 — 빼고 싶은 것은 체크를 끄세요</p>
            <ul className="flex flex-col gap-2">
              {moves.map((x) => (
                <li key={x.fromKey}>
                  <label className="flex min-h-11 items-start gap-2.5 rounded-(--radius-control) border border-slate-200 bg-white p-3" data-testid="resort-move">
                    <input type="checkbox" checked={picked.has(x.fromKey)} onChange={() => toggle(x.fromKey)} className="mt-1 size-5 shrink-0 accent-brand-600" aria-label={`${x.fileName} 옮기기`} />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="t-body font-semibold [overflow-wrap:anywhere] text-slate-900">{x.fileName}</span>
                      <span className="t-sub flex flex-wrap items-center gap-1.5 text-slate-600">
                        <span className="break-keep">{x.fromLabel}</span>
                        <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-brand-600" />
                        <b className="break-keep text-brand-700">{x.placement.label}</b>
                        {x.placement.kind === 'new' && <span className="t-meta rounded-full border border-brand-200 bg-brand-50 px-1.5 text-brand-700">새 칸</span>}
                      </span>
                      <span className="t-meta break-keep text-slate-500">{x.placement.reason}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {stays.length > 0 && !reading && (
          <details className="rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2">
            <summary className="tap t-sub cursor-pointer font-medium text-slate-700">그대로 두는 것 {stays.length}개</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {stays.map((x) => (
                <li key={x.fromKey} className="t-sub break-keep text-slate-600">
                  <span className="[overflow-wrap:anywhere]">{x.fileName}</span> — {x.fromLabel} ({x.why})
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Modal>
  )
}
