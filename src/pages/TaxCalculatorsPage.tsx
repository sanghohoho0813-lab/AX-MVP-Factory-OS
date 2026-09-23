/**
 * 세금 계산기 9종 (D-85) — 정의(`taxCalc.ts`)를 읽어 한 부품이 전부 그린다.
 *
 * 입력은 왼쪽, 결과는 오른쪽, 표는 아래. 원본(배포본 HTML)과 같은 순서·같은 이름·같은 숫자.
 * 적은 값은 계산기마다 이 브라우저에 남는다 — 상담 중에 화면을 옮겨도 다시 적지 않는다.
 */

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { ToolResultAttach } from '../tools/shared/ToolResultAttach'
import { Button } from '../components/ui/Button'
import {
  TAX_CALCULATORS,
  calculatorOf,
  cleanNum,
  defaultValues,
  isRowsField,
  type AnyField,
  type Block,
  type Calculator,
  type Field,
  type RowValues,
  type RowsField,
  type TableOut,
  type Values,
} from '../services/taxCalc'

const STORAGE_PREFIX = 'axmvp.tax.'

/** D-94: 기본값도 금액 칸은 처음부터 쉼표로 (예전에는 칸을 한 번 눌렀다 떼야 쉼표가 붙었다) */
function displayDefaults(calc: Calculator): Values {
  const out = defaultValues(calc)
  const fields = [...(calc.shared ?? []), ...calc.subs.flatMap((s) => s.groups)].flatMap((g) => g.fields)
  for (const f of fields) {
    if (isRowsField(f)) {
      const amountCols = f.columns.filter((c) => c.type === 'amount').map((c) => c.key)
      const rows = out[f.id]
      if (amountCols.length > 0 && Array.isArray(rows)) {
        out[f.id] = rows.map((r) => {
          const next = { ...r }
          for (const k of amountCols) if (typeof next[k] === 'string') next[k] = withCommas(next[k])
          return next
        })
      }
    } else if (f.type === 'amount' && typeof out[f.id] === 'string') {
      out[f.id] = withCommas(out[f.id] as string)
    }
  }
  return out
}

function loadValues(calc: Calculator): Values {
  const base = displayDefaults(calc)
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + calc.key)
    if (!raw) return base
    const saved = JSON.parse(raw) as Values
    // 저장된 것 위에 기본값을 덧대지 않는다 — 없는 칸만 기본값
    for (const k of Object.keys(base)) {
      if (saved[k] === undefined) saved[k] = base[k]
    }
    return saved
  } catch {
    return base
  }
}

/** 금액 칸은 원본처럼 쉼표를 붙여 보여 준다 — 적는 중에는 그대로, 손을 떼면 정리 */
function withCommas(raw: string): string {
  if (raw.trim() === '') return ''
  const n = cleanNum(raw)
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

/** 결과에서 가장 큰 줄 하나 — 배지에 그대로 쓴다 */
function headlineOf(blocks: Block[]): string {
  for (const b of blocks) {
    const big = b.lines.find((l) => l.cls === 'big') ?? b.lines.find((l) => l.cls === 'highlight')
    if (big) return `${big.k} ${big.v}`
  }
  const first = blocks[0]?.lines.find((l) => l.cls !== 'divider')
  return first ? `${first.k} ${first.v}` : ''
}

/** 업체 기록·카톡에 그대로 붙일 글 — 화면에 보이는 줄을 그대로 옮긴다 */
function summaryOf(title: string, subLabel: string, blocks: Block[]): string {
  const out: string[] = [`[${title}${subLabel ? ` · ${subLabel}` : ''} 계산 결과]`]
  for (const b of blocks) {
    out.push('', `■ ${b.title}`)
    for (const l of b.lines) {
      if (l.cls === 'divider') out.push(`· ${l.k}`)
      else out.push(`  ${l.k}: ${l.v}`)
    }
  }
  out.push('', '기업지원단 배포본과 같은 계산식입니다. 실제 신고·집행 전에는 담당 세무사 검토가 필요합니다.')
  return out.join('\n')
}

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

export function TaxCalculatorsPage() {
  const [params, setParams] = useSearchParams()
  const calcKey = params.get('c') ?? TAX_CALCULATORS[0].key
  const calc = calculatorOf(calcKey) ?? TAX_CALCULATORS[0]
  const subKey = params.get('s') ?? calc.subs[0].key
  const sub = calc.subs.find((s) => s.key === subKey) ?? calc.subs[0]

  const [values, setValues] = useState<Values>(() => loadValues(calc))
  useEffect(() => {
    setValues(loadValues(calc))
  }, [calc])
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + calc.key, JSON.stringify(values))
    } catch {
      /* 저장 못 해도 계산은 된다 */
    }
  }, [calc.key, values])

  const out = useMemo(() => {
    try {
      return sub.compute(values)
    } catch {
      return { blocks: [] as Block[], tables: [] as TableOut[] }
    }
  }, [sub, values])

  const pick = (c: string, s?: string) => {
    const next = new URLSearchParams()
    // D-94: 업체에서 연 계산기면(?client=) 계산기를 바꿔도 그 업체를 놓지 않는다
    const client = params.get('client')
    if (client) next.set('client', client)
    next.set('c', c)
    if (s) next.set('s', s)
    setParams(next)
  }
  const set = (id: string, v: string) => setValues((cur) => ({ ...cur, [id]: v }))
  const setRow = (id: string, i: number, key: string, v: string) =>
    setValues((cur) => {
      const rows = Array.isArray(cur[id]) ? [...(cur[id] as RowValues[])] : []
      rows[i] = { ...rows[i], [key]: v }
      return { ...cur, [id]: rows }
    })
  const addRow = (f: RowsField) =>
    setValues((cur) => ({ ...cur, [f.id]: [...((cur[f.id] as RowValues[]) ?? []), { ...(f.newRow ?? {}) }] }))
  const removeRow = (id: string, i: number) =>
    setValues((cur) => ({ ...cur, [id]: ((cur[id] as RowValues[]) ?? []).filter((_, j) => j !== i) }))
  const reset = () => setValues(displayDefaults(calc))

  const renderField = (f: AnyField) => {
    if (isRowsField(f)) return renderRows(f)
    const v = typeof values[f.id] === 'string' ? (values[f.id] as string) : ''
    return (
      <label key={f.id} className="block">
        <span className="t-sub font-medium text-slate-600">{f.label}</span>
        {f.type === 'select' ? (
          <select id={f.id} aria-label={f.label} value={v} onChange={(e) => set(f.id, e.target.value)} className={`mt-1 ${inputCls}`}>
            {(f.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={f.id}
            aria-label={f.label}
            type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
            inputMode={f.type === 'amount' ? 'decimal' : undefined}
            step={f.step}
            min={f.min}
            max={f.max}
            value={v}
            onChange={(e) => set(f.id, e.target.value)}
            onBlur={f.type === 'amount' ? (e) => set(f.id, withCommas(e.target.value)) : undefined}
            className={`mt-1 ${inputCls} ${f.type === 'amount' || f.type === 'number' ? 'text-right tabular-nums' : ''}`}
          />
        )}
        {f.hint && <span className="t-meta mt-0.5 block text-slate-400">{f.hint}</span>}
      </label>
    )
  }

  const renderRows = (f: RowsField) => {
    const rows = Array.isArray(values[f.id]) ? (values[f.id] as RowValues[]) : []
    return (
      <div key={f.id} className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-[0.9rem]" data-rows={f.id}>
          <thead>
            <tr>
              {f.columns.map((c) => (
                <th key={c.key} className="px-1.5 py-1.5 text-left t-meta font-medium text-slate-500">
                  {c.label}
                </th>
              ))}
              {f.addable && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {f.columns.map((c) => (
                  <td key={c.key} className="px-1 py-1">
                    {c.readonly ? (
                      <span className="block px-1.5 py-1.5 font-semibold text-slate-800">{row[c.key] ?? ''}</span>
                    ) : c.type === 'select' ? (
                      <select
                        aria-label={`${f.label} ${i + 1} ${c.label}`}
                        data-row={i}
                        data-col={c.key}
                        value={row[c.key] ?? ''}
                        onChange={(e) => setRow(f.id, i, c.key, e.target.value)}
                        className={inputCls}
                      >
                        {(c.options ?? []).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        aria-label={`${f.label} ${i + 1} ${c.label}`}
                        data-row={i}
                        data-col={c.key}
                        type={c.type === 'number' ? 'number' : 'text'}
                        inputMode={c.type === 'amount' ? 'decimal' : undefined}
                        step={c.type === 'number' ? '0.01' : undefined}
                        value={row[c.key] ?? ''}
                        onChange={(e) => setRow(f.id, i, c.key, e.target.value)}
                        onBlur={c.type === 'amount' ? (e) => setRow(f.id, i, c.key, withCommas(e.target.value)) : undefined}
                        className={`${inputCls} ${c.type === 'amount' || c.type === 'number' ? 'text-right tabular-nums' : ''}`}
                      />
                    )}
                  </td>
                ))}
                {f.addable && (
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      aria-label={`${f.label} ${i + 1} 지우기`}
                      onClick={() => removeRow(f.id, i)}
                      className="rounded-(--radius-control) p-2 text-slate-400 hover:bg-slate-100 hover:text-danger-600"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {f.addable && (
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => addRow(f)}>
            <Plus aria-hidden="true" className="size-4" />
            {f.label} 추가
          </Button>
        )}
      </div>
    )
  }

  const groups = [...(calc.shared ?? []), ...sub.groups]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="세금 계산기" description="대표이사 급여·퇴직급여·주식·상속·가지급금 등 9종. 규칙 계산이며 참고용입니다 — 실제 신고는 세무사와 상담하세요." />

      {/* 계산기 고르기 — 휴대폰에서는 가로로 넘기는 조각, 넓으면 한 줄 감싸기 */}
      <nav aria-label="계산기 목록" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap">
        {TAX_CALCULATORS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={c.key === calc.key}
            onClick={() => pick(c.key)}
            className={`tap shrink-0 rounded-full border px-3 py-1.5 text-[0.9rem] font-medium whitespace-nowrap ${
              c.key === calc.key ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className={`mr-1.5 tabular-nums ${c.key === calc.key ? 'text-brand-100' : 'text-slate-400'}`}>{c.no}</span>
            {c.title}
          </button>
        ))}
      </nav>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-slate-900 pb-3">
          <div className="min-w-0">
            <p className="t-meta font-bold tracking-wide text-brand-700 uppercase">{calc.eyebrow}</p>
            <h2 className="t-section mt-0.5 text-slate-900">{calc.title}</h2>
            <p className="t-sub mt-1 break-keep text-slate-500">{calc.desc}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={reset} title="이 계산기의 입력을 기본값으로 되돌립니다">
            <RotateCcw aria-hidden="true" className="size-4" />
            기본값으로
          </Button>
        </div>

        {calc.subs.length > 1 && (
          <div role="tablist" aria-label={`${calc.title} 소탭`} className="flex flex-wrap gap-1.5">
            {calc.subs.map((s) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={s.key === sub.key}
                onClick={() => pick(calc.key, s.key)}
                className={`tap rounded-full border px-3.5 py-1.5 text-[0.9rem] font-medium ${
                  s.key === sub.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className={`grid gap-4 ${groups.length > 0 ? 'lg:grid-cols-2' : ''}`}>
          {groups.length > 0 && (
            <div className="flex flex-col gap-4">
              {groups.map((g) => (
                <div key={g.title} className="rounded-(--radius-panel) border border-slate-200 bg-white p-4">
                  <h3 className="mb-3 border-b border-slate-100 pb-2 text-[0.98rem] font-bold text-slate-900">{g.title}</h3>
                  <div className={`grid gap-3 ${g.fields.some(isRowsField) ? '' : 'sm:grid-cols-2'}`}>{g.fields.map(renderField)}</div>
                </div>
              ))}
              {out.hint && <p className="t-sub break-keep text-slate-500">{out.hint}</p>}
            </div>
          )}
          <div className="flex flex-col gap-4">
            {out.blocks.map((b) => (
              <div
                key={b.id}
                data-block={b.id}
                className={`rounded-(--radius-panel) border p-4 ${b.tone === 'light' ? 'border-slate-200 bg-white' : 'border-slate-900 bg-slate-900 text-slate-100'}`}
              >
                <h3 className={`mb-2 border-b pb-2 text-[0.98rem] font-bold ${b.tone === 'light' ? 'border-slate-100 text-slate-900' : 'border-slate-700 text-amber-200'}`}>{b.title}</h3>
                {b.lines.map((l, i) =>
                  l.cls === 'divider' ? (
                    <p key={i} className={`mt-3 mb-1 t-meta font-bold tracking-wide uppercase ${b.tone === 'light' ? 'text-brand-700' : 'text-amber-300'}`}>
                      {l.k}
                    </p>
                  ) : (
                    <div
                      key={i}
                      data-line
                      data-k={l.k}
                      data-v={l.v}
                      className={`flex items-baseline justify-between gap-3 py-1.5 text-[0.9rem] ${
                        l.cls === 'highlight' ? `-mx-2 rounded-(--radius-control) px-2 ${b.tone === 'light' ? 'bg-brand-50' : 'bg-amber-200/15'}` : `border-b border-dashed ${b.tone === 'light' ? 'border-slate-200' : 'border-slate-700'}`
                      }`}
                    >
                      <span className={b.tone === 'light' ? 'text-slate-500' : 'text-slate-300'}>{l.k}</span>
                      <span className={`text-right font-bold tabular-nums ${l.cls === 'big' ? (b.tone === 'light' ? 'text-[1.15rem] text-brand-700' : 'text-[1.15rem] text-amber-200') : ''}`}>{l.v}</span>
                    </div>
                  ),
                )}
              </div>
            ))}
            {sub.note && <p className="t-sub rounded-(--radius-control) border-l-4 border-amber-400 bg-amber-50 px-3 py-2 break-keep text-slate-600">{sub.note}</p>}
            {/* 계산 결과도 업체 기록에 붙는다 (D-89) — 다른 도구와 같은 단추 */}
            {out.blocks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <ToolResultAttach
                  toolKey="tax"
                  title={`${calc.title}${calc.subs.length > 1 ? ` · ${sub.label}` : ''}`}
                  verdict={null}
                  verdictLabel={headlineOf(out.blocks)}
                  summary={summaryOf(calc.title, calc.subs.length > 1 ? sub.label : '', out.blocks)}
                  data={{ calc: calc.key, sub: sub.key, values }}
                />
              </div>
            )}
          </div>
        </div>

        {(out.tables ?? []).map((t) => (
          <div key={t.id} className="rounded-(--radius-panel) border border-slate-200 bg-white p-4">
            <h3 className="mb-3 border-b border-slate-100 pb-2 text-[0.98rem] font-bold text-slate-900">{t.title}</h3>
            <div className="overflow-x-auto">
              <table data-table={t.id} className="w-full min-w-[640px] text-[0.85rem]">
                <thead>
                  <tr>
                    {t.head.map((h, i) => (
                      <th key={i} className={`bg-slate-800 px-2 py-1.5 font-medium text-white ${i === 0 ? 'text-left' : 'text-right'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r, i) => (
                    <tr key={i} className={r.best ? 'bg-amber-100 font-bold' : i % 2 === 1 ? 'bg-slate-50' : ''}>
                      {r.cells.map((c, j) => (
                        <td key={j} className={`border-b border-slate-100 px-2 py-1.5 tabular-nums ${j === 0 ? 'text-left' : 'text-right'}`}>
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {t.note && <p className="t-sub mt-3 break-keep text-slate-500">{t.note}</p>}
          </div>
        ))}

        {calc.note && <p className="t-sub rounded-(--radius-control) border-l-4 border-amber-400 bg-amber-50 px-3 py-2 break-keep text-slate-600">{calc.note}</p>}
      </section>
    </div>
  )
}

export type { Field }
