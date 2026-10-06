/**
 * 업체 성과 보고서 한 장 (D-154) — 미리 보고 · 기간 고르고 · 인쇄(PDF) · 카톡 요약.
 * 화면 미리보기와 인쇄 종이는 같은 내용(ReportDocument). 인쇄할 때는 .print-document 만 찍힌다(index.css).
 */
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Printer } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { buildClientReport, reportKakao, REPORT_PERIOD_LABEL, type ClientReport, type ReportPeriod } from '../../services/clientReport'
import { brand } from '../../brand/brand.config'
import { formatKrwCompact } from '../../lib/format'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { copyText } from '../consulting/studioParts'
import { useToast } from '../ui/toastContext'

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
const ymd = (d: string) => (d ? `${d.slice(0, 4)}. ${Number(d.slice(5, 7))}. ${Number(d.slice(8, 10))}.` : '')
const md = (d: string) => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : '')

function ReportDocument({ r, printing }: { r: ClientReport; printing?: boolean }) {
  const tiles: [string, string][] = [
    [r.headline.securedBasis === 'selected' ? '선정된 지원금' : '확보한 자금', r.headline.securedBasis === 'none' ? '—' : formatKrwCompact(r.headline.securedTotal)],
    ['지원사업 선정', `${r.headline.selectedCount}건`],
    ['끝낸 업무', `${r.headline.doneCount}건`],
    ['정리된 서류', `${r.headline.documentsReady}가지`],
  ]
  const H = ({ children }: { children: string }) => <h3 className="mt-5 mb-2 border-b border-slate-300 pb-1 text-[1.05rem] font-bold text-slate-900">{children}</h3>
  const Empty = ({ children }: { children: string }) => <p className="text-[0.95rem] text-slate-500">{children}</p>
  return (
    <article className={printing ? 'px-8 py-6' : ''} data-testid={printing ? 'report-print' : 'report-preview'}>
      <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-brand-700 pb-2">
        <div className="min-w-0">
          <p className="text-[0.9rem] font-semibold text-brand-700">{REPORT_PERIOD_LABEL[r.period]} 함께 만든 성과</p>
          <h2 className="text-[1.5rem] font-bold break-keep [overflow-wrap:anywhere] text-slate-900">{r.companyName} 성과 보고서</h2>
        </div>
        <p className="text-[0.9rem] text-slate-600">
          {ymd(r.from)} ~ {ymd(r.to)}
        </p>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 avoid-break">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2">
            <dt className="text-[0.85rem] text-slate-600">{k}</dt>
            <dd className="text-[1.15rem] font-bold break-keep text-slate-900" data-testid={`report-tile-${k}`}>{v}</dd>
          </div>
        ))}
      </dl>

      <H>확보한 자금</H>
      {r.money.length === 0 ? (
        <Empty>이 기간에 선정 · 입금된 자금은 아직 없습니다.</Empty>
      ) : (
        <table className="w-full text-[0.95rem]">
          <tbody>
            {r.money.map((m, i) => (
              <tr key={i} className="border-b border-slate-100 avoid-break">
                <td className="w-16 py-1.5 align-top text-slate-600">{md(m.date)}</td>
                <td className="py-1.5 align-top break-keep [overflow-wrap:anywhere] text-slate-900">
                  {m.name}
                  <span className="block text-[0.85rem] text-slate-500">{m.kind === 'executed' ? `${m.selectedAt ? `선정 ${md(m.selectedAt)} → ` : ''}입금` : '선정 · 입금 전'}</span>
                </td>
                <td className="py-1.5 text-right align-top font-semibold whitespace-nowrap text-slate-900">{won(m.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <H>끝낸 업무</H>
      {r.done.length === 0 ? <Empty>이 기간에 끝낸 업무는 아직 없습니다.</Empty> : (
        <ul className="flex flex-col gap-1 text-[0.95rem]">
          {r.done.map((d, i) => (
            <li key={i} className="avoid-break"><span className="inline-block w-16 text-slate-600">{md(d.date)}</span>{d.label}</li>
          ))}
        </ul>
      )}

      {r.inProgress.length > 0 && (
        <>
          <H>진행 중인 업무</H>
          <ul className="flex flex-col gap-1.5 text-[0.95rem]">
            {r.inProgress.map((d, i) => (
              <li key={i} className="avoid-break [overflow-wrap:anywhere]">
                <b className="font-semibold">{d.label}</b> <span className="text-slate-500">· {d.status}</span>
                {d.nextStep ? (
                  <span className="block text-slate-700">다음: {d.nextStep}{d.dueDate ? ` (목표 ${md(d.dueDate)})` : ''}</span>
                ) : d.dueDate ? (
                  <span className="block text-slate-700">목표 {md(d.dueDate)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {r.tools.length > 0 && (
        <>
          <H>분석 · 판정 요약</H>
          <ul className="flex flex-col gap-2 text-[0.95rem]">
            {r.tools.map((t, i) => (
              <li key={i} className="avoid-break [overflow-wrap:anywhere]">
                <b className="font-semibold">{t.title}</b> <span className="text-slate-600">· {t.verdict} ({md(t.date)})</span>
                {t.summary && <span className="block whitespace-pre-line text-slate-700">{t.summary}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      <H>다음에 챙길 것(60일)</H>
      {r.next.length === 0 ? <Empty>60일 안에 챙길 마감은 없습니다.</Empty> : (
        <ul className="flex flex-col gap-1 text-[0.95rem]">
          {r.next.map((n, i) => (
            <li key={i} className="avoid-break [overflow-wrap:anywhere]"><span className="inline-block w-16 font-semibold text-slate-800">{md(n.date)}</span>{n.text}</li>
          ))}
        </ul>
      )}

      <footer className="mt-6 border-t border-slate-200 pt-2 text-[0.8rem] text-slate-500">
        {brand.brandNameKo} · {brand.ownerName} {brand.ownerTitle} — 업체 기록을 바탕으로 정리했습니다. 금액은 실제로 확인된 것만 담았습니다.
      </footer>
    </article>
  )
}

export function ClientReportSheet({ record, today, onClose }: { record: ClientOpsRecord; today: string; onClose: () => void }) {
  const { showToast } = useToast()
  const [period, setPeriod] = useState<ReportPeriod>('year')
  const r = useMemo(() => buildClientReport(record, today, period), [record, today, period])
  return (
    <>
      <Modal
        open
        size="lg"
        title="성과 보고서 한 장"
        onClose={onClose}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" data-testid="report-kakao" onClick={async () => showToast((await copyText(reportKakao(r))) ? '카톡 요약을 복사했습니다' : '복사하지 못했습니다')}>
              <Copy aria-hidden="true" className="size-4" /> 카톡 요약
            </Button>
            <Button variant="primary" data-testid="report-print-button" onClick={() => window.print()}>
              <Printer aria-hidden="true" className="size-4" /> 인쇄 · PDF로 저장
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="기간">
            {(Object.keys(REPORT_PERIOD_LABEL) as ReportPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                data-testid={`report-period-${p}`}
                onClick={() => setPeriod(p)}
                className={`tap t-sub min-h-11 rounded-full border px-3.5 font-semibold ${period === p ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {REPORT_PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          <p className="t-sub break-keep text-slate-600">고객에게 드리는 종이입니다 — 수수료 · 영업자 · 메모 · 업무 일기는 들어가지 않습니다.</p>
          <div className="rounded-(--radius-control) border border-slate-200 bg-white p-4">
            <ReportDocument r={r} />
          </div>
        </div>
      </Modal>
      {/* 인쇄 종이는 화면 맨 바깥(body 바로 아래)에 — 인쇄할 때 나머지 화면을 통째로 빼서 빈 쪽이 생기지 않게(index.css .print-solo) */}
      {createPortal(
        <div className="print-document print-solo hidden bg-white text-slate-900 print:block" aria-hidden="true">
          <ReportDocument r={r} printing />
        </div>,
        document.body,
      )}
    </>
  )
}
