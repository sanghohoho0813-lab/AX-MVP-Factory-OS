/**
 * 고객용 '기업인증 진단 요약' (P2) — 미리보기 · 복사 · 인쇄(PDF). 내용은 Core clientSummary 가 만든다.
 * 인쇄는 성과 보고서(ClientReportSheet)와 같은 틀: 화면은 Modal, 종이는 body 바로 아래 .print-document.print-solo.
 */
import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Printer } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { copyText } from '../../components/consulting/studioParts'
import { useSenderLine } from '../../components/layout/useCurrentUser'
import { buildClientSummary, clientSummaryText, type ClientCertSummary } from '../core/clientSummary'
import type { Roadmap } from '../core/roadmap'
import type { CertificationAssessment, CertificationClientContext } from '../core/types'

function SummaryDocument({ s, sender, printing }: { s: ClientCertSummary; sender: string; printing?: boolean }) {
  return (
    <article className={printing ? 'px-8 py-6' : ''} data-testid={printing ? 'cert-summary-print' : 'cert-summary-preview'}>
      <header className="border-b border-slate-300 pb-2">
        <h2 className="text-[1.35rem] font-bold text-slate-900">{s.title}</h2>
        <p className="t-sub text-slate-600">
          {s.companyName || '대표님 회사'} · {s.date}
        </p>
      </header>
      {s.sections.map((x) => (
        <section key={x.id} className="mt-3 break-inside-avoid" data-testid="cert-summary-section" data-id={x.id}>
          <h3 className="t-body font-bold text-slate-900">{x.title}</h3>
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {x.lines.map((l) => (
              <li key={l} className="t-sub break-keep whitespace-pre-wrap text-slate-800">
                {l}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <footer className="mt-5 border-t border-slate-200 pt-2 text-[0.8rem] text-slate-500">{sender}</footer>
    </article>
  )
}

export function ClientSummarySheet({ list, ctx, roadmap, onClose }: { list: CertificationAssessment[]; ctx: CertificationClientContext; roadmap: Roadmap; onClose: () => void }) {
  const sender = useSenderLine()
  const { showToast } = useToast()
  const s = useMemo(() => buildClientSummary(list, ctx, roadmap), [list, ctx, roadmap])
  return (
    <>
      <Modal
        open
        size="lg"
        title="기업인증 진단 요약(고객용)"
        onClose={onClose}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" data-testid="cert-summary-copy" onClick={async () => showToast((await copyText(clientSummaryText(s, sender))) ? '진단 요약을 복사했습니다' : '복사하지 못했습니다')}>
              <Copy aria-hidden="true" className="size-4" /> 복사
            </Button>
            <Button variant="primary" data-testid="cert-summary-print-button" onClick={() => window.print()}>
              <Printer aria-hidden="true" className="size-4" /> 인쇄 · PDF로 저장
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="t-sub break-keep text-slate-600">고객에게 드리는 종이입니다 — 실사 질문 · 답변 가이드 · 대표 답 · 내부 메모 · 체납 같은 민감 정보는 들어가지 않습니다.</p>
          <div className="rounded-(--radius-control) border border-slate-200 bg-white p-4">
            <SummaryDocument s={s} sender={sender} />
          </div>
        </div>
      </Modal>
      {createPortal(
        <div className="print-document print-solo hidden bg-white text-slate-900 print:block" aria-hidden="true">
          <SummaryDocument s={s} sender={sender} printing />
        </div>,
        document.body,
      )}
    </>
  )
}
