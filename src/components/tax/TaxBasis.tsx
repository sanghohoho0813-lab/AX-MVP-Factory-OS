/**
 * D-321 계산 기준표 — OS 가 계산에 쓰는 세율 · 공제 · 단가(몇 년 · 어떤 법)를 한 화면에.
 * 숫자는 lawBasis 가 계산기 · 모듈 상수에서 읽는다. 규칙 계산이다.
 */
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, ChevronDown } from 'lucide-react'
import { lawBasis } from '../../services/lawBasis'

/** focus — 판정 · 계산 화면에서 '기준표' 를 누르고 왔으면 그 칸(?s=)으로 내려가 펼치고 테두리를 칠한다(D-326) */
export function TaxBasis({ onBack, focus }: { onBack: () => void; focus?: string | null }) {
  const sections = useMemo(() => lawBasis(), [])
  const [open, setOpen] = useState<string | null>(focus ?? null)
  useEffect(() => {
    if (!focus) return
    const t = window.setTimeout(() => document.querySelector(`[data-testid="tax-basis-section"][data-id="${CSS.escape(focus)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80)
    return () => window.clearTimeout(t)
  }, [focus])
  return (
    <section className="flex flex-col gap-4" data-testid="tax-basis" aria-labelledby="tax-basis-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="tax-basis-title" className="t-card flex items-center gap-2 font-bold text-slate-900">
            <BookOpen aria-hidden="true" className="size-5 shrink-0 text-brand-700" /> 계산 기준표 — 2026년
          </h2>
          <p className="t-sub mt-1 break-keep text-slate-600">
            계산기 · 판정 · 설계서가 쓰는 세율과 공제를 그대로 보여 줘요. 이 표의 숫자는 계산에 쓰는 값에서 바로 읽어서, 계산과 어긋나지 않아요. 신고 전에는 담당 세무사와 확인하세요.
          </p>
        </div>
        <button type="button" onClick={onBack} className="tap t-sub inline-flex min-h-11 shrink-0 items-center gap-1 rounded-(--radius-control) border border-slate-200 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50" data-testid="tax-basis-back">
          <ArrowLeft aria-hidden="true" className="size-4" /> 계산기로
        </button>
      </div>
      <ul className="grid gap-3 lg:grid-cols-2">
        {sections.map((s) => {
          const expanded = open === s.id || s.rows.length <= 6
          const rows = expanded ? s.rows : s.rows.slice(0, 5)
          return (
            <li
              key={s.id}
              className={`flex min-w-0 scroll-mt-24 flex-col rounded-(--radius-card) border bg-white p-4 shadow-(--shadow-card) ${focus === s.id ? 'border-brand-400 ring-2 ring-brand-200' : 'border-slate-200'}`}
              data-testid="tax-basis-section"
              data-id={s.id}
              data-focus={focus === s.id ? '1' : undefined}
            >
              <h3 className="t-card font-bold break-keep text-slate-900">{s.title}</h3>
              <p className="t-meta mt-1 break-keep text-brand-800" data-testid="tax-basis-law">
                {s.basis}
              </p>
              <dl className="mt-3 divide-y divide-slate-100">
                {rows.map((r) => (
                  <div key={r.label} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <dt className="t-sub min-w-0 break-keep text-slate-600">{r.label}</dt>
                    <dd className="t-sub min-w-0 break-keep font-semibold text-slate-900 sm:text-right">{r.value}</dd>
                  </div>
                ))}
              </dl>
              {!expanded && (
                <button type="button" onClick={() => setOpen(s.id)} className="tap t-sub mt-1 inline-flex min-h-11 items-center gap-1 self-start rounded-(--radius-control) px-2 font-semibold text-brand-800 hover:bg-brand-50" data-testid="tax-basis-more">
                  <ChevronDown aria-hidden="true" className="size-4" /> {s.rows.length - 5}줄 더 보기
                </button>
              )}
              {s.note && <p className="t-meta mt-2 break-keep text-slate-500">※ {s.note}</p>}
              <p className="t-meta mt-auto break-keep pt-3 text-slate-500">
                <span className="font-semibold text-slate-600">쓰는 곳</span> · {s.usedIn}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
