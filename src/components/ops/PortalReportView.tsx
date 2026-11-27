/**
 * D-681 고객이 보는 보고서 모양(내부 미리보기용) — 홈페이지 My MIRAE 보고서 화면과 같은 차례:
 * 종류 · 제목 · 기간 · 정정 표시 → 한 줄 요약 → 칸(지금 진행 중 · 끝낸 일 · 확보한 자금 · 부탁드릴 것 · 다음 계획) → 담당자 한마디.
 * 받은 글은 글자로만 그린다(HTML 해석 0).
 */
import { REPORT_KIND_LABEL, type PortalReportKind } from '../../services/portalGrowthRules'

export interface PortalReportViewModel {
  kind: PortalReportKind
  title: string
  periodStart: string | null
  periodEnd: string | null
  summary: string
  sections: { key: string; title: string; items: { text: string; date?: string | null }[] }[]
  staffNote: string | null
  version: number
  correctionNote: string | null
  publishedAt: string | null
}

const md = (d?: string | null) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : '')

export function PortalReportView({ report }: { report: PortalReportViewModel }) {
  const period = report.periodStart && report.periodEnd ? `${md(report.periodStart)} ~ ${md(report.periodEnd)}` : ''
  return (
    <article className="flex flex-col gap-3" data-testid="report-view">
      <header>
        <p className="t-meta font-semibold text-brand-700">
          {REPORT_KIND_LABEL[report.kind]}
          {period ? ` · ${period}` : ''}
          {report.version > 1 ? ` · 정정본(${report.version}판)` : ''}
        </p>
        <h3 className="t-section mt-0.5 break-keep text-slate-900 [overflow-wrap:anywhere]">{report.title || '(제목 없음)'}</h3>
        {report.version > 1 && report.correctionNote && <p className="t-sub mt-1 break-keep text-slate-700">고친 곳: {report.correctionNote}</p>}
      </header>
      {report.summary && <p className="t-body break-keep whitespace-pre-wrap text-slate-800">{report.summary}</p>}
      {report.sections.map((s) => (
        <section key={s.key + s.title} className="border-t border-slate-100 pt-2">
          <h4 className="t-sub font-bold text-slate-900">{s.title}</h4>
          <ul className="mt-1 flex flex-col gap-1">
            {s.items.map((i, n) => (
              <li key={n} className="t-sub flex gap-2 break-keep text-slate-800 [overflow-wrap:anywhere]">
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span className="min-w-0 flex-1">{i.text}</span>
                {i.date && <span className="shrink-0 text-slate-500 tabular-nums">{md(i.date)}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {report.staffNote && (
        <section className="border-t border-slate-100 pt-2">
          <h4 className="t-sub font-bold text-slate-900">담당자 한마디</h4>
          <p className="t-sub mt-1 break-keep whitespace-pre-wrap text-slate-800">{report.staffNote}</p>
        </section>
      )}
      <p className="t-meta break-keep text-slate-500">확인 표시는 보고서를 보셨다는 뜻이에요. 계약 검수 · 대금 승인이 아니에요.</p>
    </article>
  )
}
