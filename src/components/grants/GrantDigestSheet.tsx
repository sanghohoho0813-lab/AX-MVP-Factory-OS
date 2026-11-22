/**
 * D-645 맞는 공고 '한 장' — [골라서 보내기] 에서 고른 공고 · 한 줄 의견을 업체 대표님께 드릴 종이 한 장으로(인쇄 · PDF).
 * 같은 판 안의 다음 단계(창을 겹치지 않는다). 화면은 공고마다 한 줄(마감 · 서류 n/m)만, 종이 그대로는 [종이 그대로 보기] 로 펼친다.
 * 종이는 body 바로 아래 .print-document.print-solo — 1년 일정표 · 맞춤 진단서와 같은 틀. 글은 services/grants/grantDigest(digestSheet).
 * 고객에게 드리는 종이 — 수수료 · 내부 메모 · 판정 점수는 넣지 않는다.
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '../ui/Button'
import type { DigestSheet, DigestSheetItem } from '../../services/grants/grantDigest'
import { useSenderLine } from '../layout/useCurrentUser'

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-0.5">
      <dt className="w-20 shrink-0 font-semibold text-slate-600">{k}</dt>
      <dd className="min-w-0 flex-1 break-keep text-slate-800 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

function SheetItem({ x }: { x: DigestSheetItem }) {
  return (
    <section className="avoid-break border-b border-slate-200 py-3" data-testid="digest-sheet-item">
      <h3 className="text-[1.0625rem] font-bold break-keep text-slate-900">
        {x.no} {x.title}
      </h3>
      <dl className="mt-1.5 text-[0.9375rem]">
        {x.agency && <Row k="소관">{x.agency}</Row>}
        <Row k="마감">{x.deadline}</Row>
        {x.amount && <Row k="지원">{x.amount}</Row>}
        {x.ok.length > 0 && <Row k="맞는 조건">{x.ok.join(', ')}</Row>}
        {x.unknown.length > 0 && <Row k="확인할 것">{x.unknown.join(', ')}</Row>}
        {x.comment && <Row k="제 의견">{x.comment}</Row>}
        <Row k="신청 방법">
          <span className="flex flex-col gap-0.5">
            {x.docsHave.length > 0 && <span data-testid="digest-sheet-have">이미 받은 서류: {x.docsHave.join(', ')}</span>}
            {x.docsNeed.length > 0 && <span data-testid="digest-sheet-need">더 준비할 서류: {x.docsNeed.join(', ')}</span>}
            {x.writePlan && <span>신청서 · 사업계획서는 저희가 같이 씁니다.</span>}
            {x.url && <span className="text-[0.8125rem] text-slate-600">공고: {x.url}</span>}
          </span>
        </Row>
      </dl>
    </section>
  )
}

/** 종이 — 화면 [종이 그대로 보기] 와 인쇄가 같은 부품 */
export function DigestSheetDocument({ s, sender }: { s: DigestSheet; sender: string }) {
  return (
    <article className="px-8 py-6" data-testid="digest-sheet-doc">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-brand-700 pb-2">
        <div className="min-w-0">
          <p className="text-[0.875rem] font-semibold text-brand-700">{s.to}</p>
          <h2 className="text-[1.5rem] font-bold break-keep text-slate-900">{s.title}</h2>
        </div>
        <p className="text-[0.875rem] text-slate-600">{s.date}</p>
      </header>
      {s.note && <p className="mt-3 text-[0.9375rem] break-keep text-slate-800">{s.note}</p>}
      <div className="mt-2">
        {s.items.map((x) => (
          <SheetItem key={x.no} x={x} />
        ))}
      </div>
      <footer className="mt-4 flex flex-col gap-0.5 text-[0.8125rem] text-slate-600">
        <p className="font-semibold text-slate-800">{s.closing[0]}</p>
        {s.closing.slice(1).map((n) => (
          <p key={n}>※ {n}</p>
        ))}
        {sender && <p className="mt-1 font-semibold text-slate-700">{sender}</p>}
      </footer>
    </article>
  )
}

const docLine = (x: DigestSheetItem) => {
  const all = x.docsHave.length + x.docsNeed.length
  return all ? `서류 ${x.docsHave.length}/${all}` : ''
}

export function GrantDigestSheetStep({ sheet, onPrint, onBack }: { sheet: DigestSheet; onPrint: () => Promise<void>; onBack: () => void }) {
  const sender = useSenderLine()
  const [paper, setPaper] = useState(false)
  const [busy, setBusy] = useState(false)
  // 같은 판에서 여러 번 눌러도 보낸 기록은 한 번만
  const [recorded, setRecorded] = useState(false)
  const print = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (!recorded) {
        await onPrint()
        setRecorded(true)
      }
    } finally {
      setBusy(false)
    }
    window.print()
  }
  return (
    <div className="flex flex-col gap-3" data-testid="digest-sheet">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack} data-testid="digest-sheet-back">
          <ArrowLeft aria-hidden="true" className="size-4" /> 고르기로
        </Button>
        <h3 className="t-body font-semibold text-slate-900">대표님께 드릴 한 장</h3>
      </div>
      <p className="t-sub break-keep text-slate-700" data-testid="digest-sheet-lead">
        공고 {sheet.items.length}건 · 인쇄하거나 PDF로 저장해 카톡으로 보내요.
      </p>
      <ol className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200 bg-white" data-testid="digest-sheet-list">
        {sheet.items.map((x) => (
          <li key={x.no} className="flex min-w-0 items-center gap-2 px-3 py-2.5" data-testid="digest-sheet-row">
            <span className="t-sub min-w-0 flex-1 truncate font-semibold text-slate-900">
              {x.no} {x.title}
            </span>
            <span className="t-meta shrink-0 text-slate-600">{x.deadline.split(' (')[0]}</span>
            {docLine(x) && <span className="t-meta shrink-0 font-semibold text-slate-700">{docLine(x)}</span>}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={() => void print()} disabled={busy || sheet.items.length === 0} data-testid="digest-sheet-print">
          <Printer aria-hidden="true" className="size-4" /> 인쇄 · PDF로 저장
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setPaper((v) => !v)} aria-expanded={paper} data-testid="digest-sheet-paper-toggle">
          {paper ? '종이 접기' : '종이 그대로 보기'}
        </Button>
        {recorded && (
          <span className="t-meta text-slate-600" data-testid="digest-sheet-recorded">
            보낸 기록에 남겼어요
          </span>
        )}
      </div>
      {paper && (
        <div className="overflow-auto rounded-(--radius-control) border border-slate-200 bg-white" data-testid="digest-sheet-paper">
          <DigestSheetDocument s={sheet} sender={sender} />
        </div>
      )}
      {createPortal(
        <div className="print-document print-solo hidden bg-white text-slate-900 print:block" aria-hidden="true">
          <DigestSheetDocument s={sheet} sender={sender} />
        </div>,
        document.body,
      )}
    </div>
  )
}
