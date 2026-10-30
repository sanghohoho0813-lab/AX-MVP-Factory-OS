/**
 * D-352 맞춤 진단서 한 장 — 미리 보고 · 인쇄(PDF) · 카톡 요약. 화면 미리보기와 인쇄 종이는 같은 내용(DiagnosisDocument).
 * 성과 보고서(ClientReportSheet)와 같은 틀: 화면은 Modal, 종이는 body 바로 아래 .print-document.print-solo.
 * 고객에게 드리는 종이 — 수수료 · 영업자 · 메모 · 업무 일기는 들어가지 않는다(clientDiagnosis 가 고른 것만).
 */
import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Printer } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { Insight, InsightTone } from '../../services/clientInsights'
import { buildDiagnosis, diagnosisKakao, type DiagnosisLine, type DiagnosisSheet } from '../../services/clientDiagnosis'
import { useSenderLine } from '../layout/useCurrentUser'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { copyText } from '../consulting/studioParts'
import { useToast } from '../ui/toastContext'

const ymd = (d: string) => (d ? `${d.slice(0, 4)}. ${Number(d.slice(5, 7))}. ${Number(d.slice(8, 10))}.` : '')
const TONE_CLASS: Record<InsightTone, string> = {
  good: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  maybe: 'border-sky-300 bg-sky-50 text-sky-900',
  need: 'border-amber-300 bg-amber-50 text-amber-900',
  done: 'border-slate-300 bg-slate-50 text-slate-700',
  no: 'border-slate-200 bg-white text-slate-500',
}

function ToneTag({ l }: { l: DiagnosisLine }) {
  return <span className={`inline-block shrink-0 rounded-full border px-2 py-0.5 text-[0.8rem] font-bold whitespace-nowrap ${TONE_CLASS[l.tone]}`}>{l.toneLabel}</span>
}

function DiagnosisDocument({ d, sender, printing }: { d: DiagnosisSheet; sender: string; printing?: boolean }) {
  const H = ({ children }: { children: string }) => <h3 className="mt-5 mb-2 border-b border-slate-300 pb-1 text-[1.05rem] font-bold text-slate-900">{children}</h3>
  return (
    <article className={printing ? 'px-8 py-6' : ''} data-testid={printing ? 'diagnosis-print' : 'diagnosis-preview'}>
      <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-brand-700 pb-2">
        <div className="min-w-0">
          <p className="text-[0.9rem] font-semibold text-brand-700">우리 회사 맞춤 진단</p>
          <h2 className="text-[1.5rem] font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{d.companyName} 맞춤 진단서</h2>
        </div>
        <p className="text-[0.9rem] text-slate-600">{ymd(d.today)} 기준</p>
      </header>

      {d.snapshot.length > 0 && (
        <dl className="avoid-break mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="diagnosis-snapshot">
          {d.snapshot.map((x) => (
            <div key={x.label} className="min-w-0 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2">
              <dt className="text-[0.85rem] text-slate-600">{x.label}</dt>
              <dd className="text-[1rem] font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{x.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <H>먼저 제안드리는 것</H>
      {d.picks.length === 0 ? (
        <p className="text-[0.95rem] text-slate-600" data-testid="diagnosis-no-picks">
          지금 자료로는 바로 제안드릴 것이 아직 없습니다 — 아래 자료를 받으면 바로 다시 진단해 드립니다.
        </p>
      ) : (
        <ol className="flex flex-col gap-2" data-testid="diagnosis-picks">
          {d.picks.map((p, i) => (
            <li key={p.key} className="avoid-break flex min-w-0 gap-3 rounded-[10px] border border-brand-200 bg-brand-50/40 px-3 py-2.5" data-testid="diagnosis-pick" data-key={p.key}>
              <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[0.95rem] font-bold text-white">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-[1.05rem] text-slate-900">{p.label}</b>
                  <ToneTag l={p} />
                </span>
                <span className="text-[0.95rem] break-keep text-slate-800 [overflow-wrap:anywhere]">{p.text}</span>
                {p.amount && <span className="text-[1rem] font-bold break-keep text-emerald-800 [overflow-wrap:anywhere]">{p.amount}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      {d.others.length > 0 && (
        <>
          <H>함께 살펴본 것</H>
          <table className="w-full text-[0.95rem]" data-testid="diagnosis-others">
            <tbody>
              {d.others.map((o) => (
                <tr key={o.key} className="avoid-break border-b border-slate-100">
                  <td className="w-28 py-1.5 pr-2 align-top font-semibold break-keep text-slate-900">{o.label}</td>
                  <td className="w-px py-1.5 pr-2 align-top whitespace-nowrap">
                    <ToneTag l={o} />
                  </td>
                  <td className="py-1.5 align-top break-keep text-slate-700 [overflow-wrap:anywhere]">
                    {o.text}
                    {o.amount && <b className="ml-1 text-emerald-800">{o.amount}</b>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {(d.requests.length > 0 || d.ours.length > 0) && (
        <>
          <H>보내 주실 자료</H>
          {d.requests.length > 0 && (
            <ul className="flex flex-col gap-1" data-testid="diagnosis-requests">
              {d.requests.map((r) => (
                <li key={r.label} className="avoid-break text-[0.95rem] break-keep text-slate-800 [overflow-wrap:anywhere]">
                  ☐ <b>{r.label}</b>
                  {r.where && <span className="text-slate-600"> — {r.where}</span>}
                  <span className="text-[0.85rem] text-slate-500"> · {r.for.join(' · ')} 진단에 씁니다</span>
                </li>
              ))}
            </ul>
          )}
          {d.ours.length > 0 && <p className="mt-1 text-[0.9rem] text-slate-600">저희가 직접 조회할 것: {d.ours.join(' · ')}</p>}
        </>
      )}

      <H>이렇게 진행합니다</H>
      <ol className="flex flex-col gap-1 pl-5" data-testid="diagnosis-steps">
        {d.steps.map((s) => (
          <li key={s} className="list-decimal text-[0.95rem] break-keep text-slate-800">
            {s}
          </li>
        ))}
      </ol>

      <footer className="mt-6 flex flex-col gap-0.5 border-t border-slate-200 pt-2 text-[0.8rem] text-slate-500">
        {d.notes.map((n) => (
          <p key={n}>※ {n}</p>
        ))}
        {sender && <p className="mt-1 font-semibold text-slate-600">{sender}</p>}
      </footer>
    </article>
  )
}

export function ClientDiagnosisSheet({ record, insights, today, onClose }: { record: ClientOpsRecord; insights: readonly Insight[]; today: string; onClose: () => void }) {
  const sender = useSenderLine()
  const { showToast } = useToast()
  const d = useMemo(() => buildDiagnosis(record, insights, today), [record, insights, today])
  return (
    <>
      <Modal
        open
        size="lg"
        title="맞춤 진단서 한 장"
        onClose={onClose}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" data-testid="diagnosis-kakao" onClick={async () => showToast((await copyText(diagnosisKakao(d, sender))) ? '진단 요약을 복사했어요 — 카톡에 붙여 넣으세요' : '복사하지 못했어요 — 다시 눌러 주세요')}>
              <Copy aria-hidden="true" className="size-4" /> 카톡 요약
            </Button>
            <Button variant="primary" data-testid="diagnosis-print-button" onClick={() => window.print()}>
              <Printer aria-hidden="true" className="size-4" /> 인쇄 · PDF로 저장
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="t-sub break-keep text-slate-600">대표님께 드리는 종이예요 — 맞춤 추천 판정 그대로 · 수수료 · 영업자 · 메모 · 업무 일기는 들어가지 않아요.</p>
          <div className="rounded-(--radius-control) border border-slate-200 bg-white p-4">
            <DiagnosisDocument d={d} sender={sender} />
          </div>
        </div>
      </Modal>
      {/* 인쇄 종이는 화면 맨 바깥(body 바로 아래)에 — 인쇄할 때 나머지 화면을 통째로 빼서 빈 쪽이 생기지 않게(index.css .print-solo) */}
      {createPortal(
        <div className="print-document print-solo hidden bg-white text-slate-900 print:block" aria-hidden="true">
          <DiagnosisDocument d={d} sender={sender} printing />
        </div>,
        document.body,
      )}
    </>
  )
}
