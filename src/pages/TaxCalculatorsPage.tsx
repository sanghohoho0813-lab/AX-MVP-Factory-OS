/**
 * 세금 계산기 9종 (D-85) — 정의(`taxCalc.ts`)를 읽어 한 부품이 전부 그린다.
 *
 * 입력은 왼쪽, 결과는 오른쪽, 표는 아래. 원본(배포본 HTML)과 같은 순서·같은 이름·같은 숫자.
 * 적은 값은 계산기마다 이 브라우저에 남는다 — 상담 중에 화면을 옮겨도 다시 적지 않는다.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useToolClient } from '../tools/shared/toolClientContext'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { sharedToolKey } from '../tools/shared/toolStorage'
import { useOutsideTap } from '../lib/useDismissable'
import { BookOpen, Check, ChevronDown, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { ToolResultAttach } from '../tools/shared/ToolResultAttach'
import { Button } from '../components/ui/Button'
import { HelpHeading } from '../components/ui/fold'
import { TaxPlanner } from '../components/tax/TaxPlanner'
import { TaxBasis } from '../components/tax/TaxBasis'
import type { CalcOpen } from '../services/taxPlan'
import { calcPrefill } from '../services/taxCalcPrefill'
import type { ClientOpsRecord } from '../types/clientOps'
import { PrefillNote } from '../tools/shared/PrefillNote'
import { PresetNote } from '../tools/shared/PresetNote'
import { SCENARIO_PRESETS, presetAssumptions, scenarioPreset, type PresetAssumption, type ScenarioPreset } from '../services/scenarioPresets'
import { calcPresetValues } from '../services/calcScenario'
import { todayLocalDate } from '../lib/appClock'
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

/** D-126: 업체마다 따로 기억한다 — 다른 업체로 열면 앞 업체 숫자가 남지 않는다 */
const storeKey = (calc: Calculator, clientId: string | null | undefined) => (clientId ? `${STORAGE_PREFIX}${calc.key}.${clientId}` : sharedToolKey(STORAGE_PREFIX + calc.key))

/** 업체 숫자도 기본값처럼 금액 칸은 쉼표로 보여 준다 — D-243: 주주 표(05 · 06)의 주식 수 칸도 */
function prefillShown(calc: Calculator, values: Values): Values {
  const fields = [...(calc.shared ?? []), ...calc.subs.flatMap((s) => s.groups)].flatMap((g) => g.fields)
  const amount = new Set(fields.filter((f) => !isRowsField(f) && f.type === 'amount').map((f) => f.id))
  const rowAmount = new Map(fields.filter(isRowsField).map((f) => [f.id, f.columns.filter((c) => c.type === 'amount').map((c) => c.key)]))
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => {
      if (!Array.isArray(v)) return [k, amount.has(k) ? withCommas(v) : v]
      const cols = rowAmount.get(k) ?? []
      return [k, v.map((r) => Object.fromEntries(Object.entries(r).map(([c, x]) => [c, cols.includes(c) ? withCommas(x) : x])))]
    }),
  )
}

/** D-243 계산기마다 상황 예시(05 · 06) */
const presetsOf = (calcKey: string): ScenarioPreset[] => SCENARIO_PRESETS.filter((p) => p.calc?.key === calcKey)

/** 처음 여는 계산기면(저장한 값 없음) 업체 숫자로 채운 칸 이름도 함께 — 그 외에는 빈 배열 */
function loadValuesWithPrefill(calc: Calculator, clientId: string | null | undefined, record: ClientOpsRecord | null): { values: Values; prefilled: string[] } {
  try {
    if (clientId && record && !localStorage.getItem(storeKey(calc, clientId))) {
      // D-165: 이 업체에 붙여 둔 이 계산기 결과(새것이 앞)가 있으면 그 입력값으로(다른 기기 · 다른 업체에서 붙인 결과를 '다시 열기')
      const last = (record.toolResults ?? [])
        .filter((r) => r.toolKey === 'tax')
        .map((r) => r.data as { calc?: unknown; values?: unknown } | null)
        .find((d): d is { calc: string; values: Values } => !!d && d.calc === calc.key && !!d.values && typeof d.values === 'object')
      if (last) return { values: { ...displayDefaults(calc), ...last.values }, prefilled: [] }
      const pf = calcPrefill(calc.key, record)
      return { values: { ...displayDefaults(calc), ...prefillShown(calc, pf.values) }, prefilled: pf.names }
    }
  } catch {
    /* 저장소를 못 읽으면 아래 기본 */
  }
  return { values: loadValues(calc, clientId), prefilled: [] }
}

function loadValues(calc: Calculator, clientId?: string | null): Values {
  const base = displayDefaults(calc)
  try {
    const raw = localStorage.getItem(storeKey(calc, clientId))
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

  const { clientId, clientRecord } = useToolClient()
  /** D-134: 업체 기록이 아직 안 왔으면 기다린다 — 그 사이 예시값을 저장하면 업체 숫자로 채울 기회를 잃는다 */
  const recordReady = !clientId || !!clientRecord
  // D-225: 다른 화면(크레탑 주식가치)이 이동에 실어 보낸 값 — 받으면 이 계산기 칸에 넣고(아래 저장 효과가 작업공간 칸에 저장) 이동 기록에서 지운다
  const location = useLocation()
  const navigate = useNavigate()
  const handoff = location.state as { calcKey?: string; calcValues?: Record<string, string> } | null
  const [first] = useState(() => {
    const base = loadValuesWithPrefill(calc, clientId, clientRecord)
    return handoff?.calcKey === calc.key && handoff.calcValues ? { values: { ...base.values, ...handoff.calcValues }, prefilled: [] } : base
  })
  useEffect(() => {
    if (handoff?.calcValues) navigate(location.pathname + location.search, { replace: true, state: null })
    // 처음 한 번 — 새로고침해도 받은 값으로 다시 덮지 않게
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [prefilled, setPrefilled] = useState<string[]>(first.prefilled)
  const [values, setValues] = useState<Values>(first.values)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  // D-111: 펼친 목록은 Esc · 바깥을 누르면 닫는다 (고르지 않고 다시 보고 싶을 때)
  // D-124: 바깥을 '눌렀을 때만' — 화면을 밀어 스크롤할 때 닫히면 목록 높이만큼 화면이 튀었다
  useOutsideTap(pickerRef, () => setPickerOpen(false), pickerOpen)
  useEffect(() => {
    if (!pickerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pickerOpen])
  // 계산기 · 업체가 바뀌면 그 칸의 값을 읽는다 — 읽기 전에는 저장하지 않는다(앞 업체 숫자가 뒤 업체 칸에 들어가지 않게)
  // D-165: 절세 설계(plan) 화면에서는 계산기 칸을 읽지도 저장하지도 않는다 — 전에는 업체 기록이 비어 있을 때
  // 계산기 01 예시 숫자가 업체 칸에 저장돼, 절세 설계에서 급여를 적은 뒤 계산기를 열어도 예시가 남았다
  // D-321 m=basis — 계산 기준표(계산기 · 판정이 쓰는 세율 · 공제)
  const mode: 'plan' | 'calc' | 'basis' = params.get('m') === 'basis' ? 'basis' : params.get('m') === 'plan' || (params.get('client') && !params.get('c') && params.get('m') !== 'calc') ? 'plan' : 'calc'
  const loadKey = `${mode}|${calc.key}|${clientId ?? ''}|${recordReady ? 'ok' : 'wait'}`
  const loadedFor = useRef(loadKey)
  /** D-244: 지금 values 가 어느 읽기(loadKey)의 값인지 — 읽은 바로 그 커밋에는 아직 앞 값이라 저장하지 않는다
   *  (예전엔 업체 기록이 늦게 오면 예시값을 한 번 저장해, 상황 예시의 '넣기 전 값' 이 계산기 예시가 됐다) */
  const [valuesKey, setValuesKey] = useState(loadKey)
  useEffect(() => {
    if (mode === 'plan') return
    if (loadedFor.current === loadKey) return
    loadedFor.current = loadKey
    const r = loadValuesWithPrefill(calc, clientId, clientRecord)
    setValues(r.values)
    setValuesKey(loadKey)
    setPrefilled(r.prefilled)
  }, [calc, clientId, clientRecord, loadKey, mode])
  useEffect(() => {
    if (mode === 'plan' || !recordReady || loadedFor.current !== loadKey || valuesKey !== loadKey) return
    try {
      localStorage.setItem(storeKey(calc, clientId), JSON.stringify(values))
    } catch {
      /* 저장 못 해도 계산은 된다 */
    }
  }, [values, calc, clientId, recordReady, loadKey, mode, valuesKey])

  /*
   * D-243 상황 예시(?preset=) — 05 · 06 계산기: 이 업체 숫자(주주명부 · 순이익 · 1주 가치)에 상황 값(빌려준 돈 · 누가 몇 주)을 넣어 바로 계산.
   * 넣은 상황 값만 칩으로 · [가정 빼기]는 아직 그 값 그대로인 칸만 넣기 전 값으로. 주소의 preset 은 한 번 쓰고 지운다(새로고침해도 다시 덮지 않게).
   */
  const presetId = params.get('preset')
  const [presetUsed, setPresetUsed] = useState<{ calcKey: string; title: string; applied: Values; before: Values; chips: PresetAssumption[]; missing: string[]; cleared: boolean } | null>(null)
  useEffect(() => {
    if (!presetId || mode !== 'calc' || !recordReady) return
    const preset = scenarioPreset(presetId)
    const next = new URLSearchParams(params)
    next.delete('preset')
    setParams(next, { replace: true })
    if (!preset?.calc || preset.calc.key !== calc.key) return
    const pv = calcPresetValues(preset, clientRecord, todayLocalDate())
    // 지금 칸(저장한 값 · 업체 숫자) 위에 — 위 읽기 효과와 같은 값에서 시작한다
    const base = loadValuesWithPrefill(calc, clientId, clientRecord).values
    const nextValues: Values = { ...base, ...prefillShown(calc, pv.values) }
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
    // D-244: 상황 값 + 업체 숫자로 다시 채워 바뀐 칸(예전에 직접 적은 순이익 · 시가 등)도 [가정 빼기]로 돌아오게 —
    // 같은 상황을 두 번 눌러도 '넣기 전 값' 은 처음 것(지금 칸이 아직 앞서 넣은 값 그대로일 때)
    const prev = presetUsed && presetUsed.calcKey === calc.key && !presetUsed.cleared ? presetUsed : null
    const keys = [...new Set([...Object.keys(prefillShown(calc, pv.applied)), ...Object.keys(nextValues).filter((k) => !same(nextValues[k], base[k]))])]
    const applied: Values = Object.fromEntries(keys.map((k) => [k, nextValues[k]]))
    const before: Values = Object.fromEntries(keys.map((k) => [k, prev && k in prev.before && same(base[k], prev.applied[k]) ? prev.before[k] : base[k]]))
    loadedFor.current = loadKey
    setValues(nextValues)
    setValuesKey(loadKey)
    setPrefilled(pv.filled)
    setPresetUsed({ calcKey: calc.key, title: preset.title, applied, before, chips: presetAssumptions(preset), missing: pv.missing, cleared: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, mode, recordReady, calc.key])
  /** 상황 예시가 넣은 칸 중 아직 그 값 그대로인 칸 — 그 뒤에 직접 고친 칸은 대표 값이라 빼지 않는다 */
  // 다른 계산기로 옮기면 그 계산기에는 넣은 가정이 없다
  const presetShown = presetUsed && presetUsed.calcKey === calc.key ? presetUsed : null
  const presetKept = presetShown ? Object.keys(presetShown.applied).filter((k) => JSON.stringify(values[k]) === JSON.stringify(presetShown.applied[k])) : []
  const calcPresets = clientId ? presetsOf(calc.key) : []
  const applyPreset = (p: ScenarioPreset) => {
    if (!p.calc) return
    const next = new URLSearchParams()
    const client = params.get('client')
    if (client) next.set('client', client)
    next.set('m', 'calc')
    next.set('c', p.calc.key)
    next.set('s', p.calc.sub)
    next.set('preset', p.id)
    setParams(next)
  }

  const out = useMemo(() => {
    try {
      return sub.compute(values)
    } catch {
      return { blocks: [] as Block[], tables: [] as TableOut[] }
    }
  }, [sub, values])

  /*
   * D-130: 업체로 열면(?client=) 먼저 '원하는 결과로 찾기'. 계산기를 고르면(?c=) 예전 그대로.
   * 업체 없이 열면 예전처럼 계산기부터(원본 대조 qa:tax 가 이 화면을 연다) — 위 두 칸으로 오갈 수 있다.
   */
  const setMode = (m: 'plan' | 'calc' | 'basis') => {
    const next = new URLSearchParams()
    const client = params.get('client')
    if (client) next.set('client', client)
    next.set('m', m)
    if (m === 'calc') next.set('c', calc.key)
    setParams(next)
  }
  /** 절세 설계에서 찾은 숫자 그대로 그 계산기를 연다 — 그 계산기에 적어 둔 값은 이 숫자로 바뀐다 */
  const openCalc = (o: CalcOpen) => {
    const target = calculatorOf(o.calc)
    if (!target) return
    const merged: Values = { ...loadValuesWithPrefill(target, clientId, clientRecord).values, ...o.values }
    try {
      localStorage.setItem(storeKey(target, clientId), JSON.stringify(merged))
    } catch {
      /* 저장 못 하면 아래에서 바로 넣는다 */
    }
    loadedFor.current = `calc|${target.key}|${clientId ?? ''}|${recordReady ? 'ok' : 'wait'}`
    setValues(merged)
    setValuesKey(loadedFor.current)
    setPrefilled([])
    const next = new URLSearchParams()
    const client = params.get('client')
    if (client) next.set('client', client)
    next.set('m', 'calc')
    next.set('c', o.calc)
    if (target.subs.length > 1) next.set('s', o.sub)
    setParams(next)
    window.scrollTo({ top: 0 })
  }

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
  const reset = () => {
    setValues(displayDefaults(calc))
    setPrefilled([])
  }
  /** D-134: 이 업체 숫자(절세 설계 현황 · 주주명부)로 다시 채우기 — 이율 · 공제 같은 계산기 기본값은 그대로 */
  const clientFill = clientId && clientRecord ? calcPrefill(calc.key, clientRecord) : null
  const fillFromClient = () => {
    if (!clientFill || clientFill.names.length === 0) return
    setValues((cur) => ({ ...cur, ...prefillShown(calc, clientFill.values) }))
    setPrefilled(clientFill.names)
  }

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

      {/* D-130: 두 가지 쓰는 법 — 원하는 결과부터(절세 설계) · 계산기 하나씩 */}
      <div role="tablist" aria-label="세금 계산기 쓰는 법" className="no-print grid grid-cols-2 gap-1 rounded-(--radius-card) border border-slate-200 bg-slate-50 p-1">
        {(
          [
            ['plan', '원하는 결과로 찾기'],
            ['calc', `계산기 ${TAX_CALCULATORS.length}종`],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            data-mode={m}
            onClick={() => mode !== m && setMode(m)}
            className={`tap rounded-(--radius-control) px-3 py-2 text-[0.98rem] font-semibold break-keep ${mode === m ? 'bg-white text-brand-800 shadow-(--shadow-card)' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* D-321 계산 기준표 — 몇 년 · 어떤 법으로 계산하는지 */}
      {mode !== 'basis' && (
        <button type="button" onClick={() => setMode('basis')} className="no-print tap t-sub -mt-2 inline-flex min-h-11 items-center gap-1.5 self-start rounded-(--radius-control) px-2 font-semibold text-brand-800 hover:bg-brand-50" data-testid="tax-basis-open">
          <BookOpen aria-hidden="true" className="size-4" /> 계산 기준표 보기 — 2026년 세율 · 공제
        </button>
      )}

      {mode === 'basis' ? (
        <TaxBasis onBack={() => setMode('calc')} />
      ) : mode === 'plan' ? (
        <TaxPlanner onOpenCalc={openCalc} />
      ) : (
      <>

      {/* 계산기 고르기 — 휴대폰에서는 가로로 넘기는 조각, 넓으면 한 줄 감싸기 */}
      {/* D-109: 휴대폰에서는 9개를 옆으로 밀어 찾지 않는다 — 지금 계산기 한 줄을 누르면 목록이 펼쳐지고, 고르면 닫힌다 */}
      <div ref={pickerRef} className="no-print sm:hidden">
        <button
          type="button"
          data-testid="tax-picker"
          aria-expanded={pickerOpen}
          aria-controls="tax-picker-list"
          onClick={() => setPickerOpen((o) => !o)}
          className="tap flex w-full items-center gap-3 rounded-(--radius-card) border border-slate-200 bg-white px-4 py-3 text-left shadow-(--shadow-card)"
        >
          <span className="t-meta shrink-0 rounded-full bg-navy-900 px-2 py-0.5 font-bold text-white tabular-nums">{calc.no}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1rem] font-semibold text-slate-900">{calc.title}</span>
            <span className="t-meta block text-slate-500">계산기 {TAX_CALCULATORS.length}종 · 눌러서 바꾸기</span>
          </span>
          <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-slate-400 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
        </button>
        {pickerOpen && (
          <ul id="tax-picker-list" aria-label="계산기 목록" className="mt-2 overflow-hidden rounded-(--radius-card) border border-slate-200 bg-white shadow-(--shadow-card)">
            {TAX_CALCULATORS.map((c, i) => {
              const on = c.key === calc.key
              return (
                <li key={c.key} className={i ? 'border-t border-slate-100' : ''}>
                  <button
                    type="button"
                    aria-current={on ? 'true' : undefined}
                    onClick={() => {
                      setPickerOpen(false)
                      if (!on) pick(c.key)
                    }}
                    className={`tap flex w-full items-center gap-3 px-4 py-3 text-left ${on ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
                  >
                    <span className={`t-meta w-6 shrink-0 font-bold tabular-nums ${on ? 'text-brand-700' : 'text-slate-400'}`}>{c.no}</span>
                    <span className={`min-w-0 flex-1 text-[0.95rem] break-keep ${on ? 'font-semibold text-brand-700' : 'font-medium text-slate-800'}`}>{c.title}</span>
                    {on && <Check aria-hidden="true" className="size-4 shrink-0 text-brand-600" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <nav aria-label="계산기 목록" className="no-print hidden flex-wrap gap-1.5 sm:flex">
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

      {/* D-102: 예전에는 짙은 남색(slate-900)을 박아 두어 테마를 바꿔도 그대로였다 — 테마의 짙은 색(navy-900·800, 사이드바와 같은 색)으로 */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-navy-900 pb-3">
          <div className="min-w-0">
            <p className="t-meta font-bold tracking-wide text-brand-700 uppercase">{calc.eyebrow}</p>
            <h2 className="t-section mt-0.5 text-slate-900">{calc.title}</h2>
            <p className="t-sub mt-1 break-keep text-slate-500">{calc.desc}</p>
          </div>
          <div className="no-print flex flex-wrap gap-1.5">
            {clientFill && clientFill.names.length > 0 && (
              <Button variant="secondary" size="sm" onClick={fillFromClient} data-testid="calc-fill-client" title="이 업체의 절세 설계 현황 · 주주명부 숫자로 칸을 채웁니다">
                업체 숫자로 채우기
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={reset} title="이 계산기의 입력을 기본값으로 되돌립니다">
              <RotateCcw aria-hidden="true" className="size-4" />
              기본값으로
            </Button>
          </div>
        </div>
        {prefilled.length > 0 && <PrefillNote note={`이 업체 기록(절세 설계 현황 · 주주명부)에서 채웠습니다: ${prefilled.join(' · ')}`} />}
        {presetShown && (
          <PresetNote
            testId="calc-preset-note"
            title={presetShown.title}
            done={presetShown.missing.length > 0 ? `${presetShown.missing.join(' · ')}이(가) 없어 상황 값만 넣었어요 — 받으면 이 업체 숫자로 계산해요` : '이 업체 숫자로 바로 계산했어요(아래 칸을 바꾸면 다시 계산)'}
            chips={presetShown.chips.filter((c) => !c.field || presetKept.includes(c.field)).map((c) => c.text)}
            cleared={presetShown.cleared}
            clearedText="상황 값을 넣기 전 값으로 돌렸어요(직접 고친 칸은 그대로)."
            onClear={() => {
              setValues((cur) => ({ ...cur, ...Object.fromEntries(presetKept.map((k) => [k, presetShown.before[k]])) }))
              setPresetUsed({ ...presetShown, cleared: true })
            }}
          />
        )}
        {calcPresets.length > 0 && (
          <div className="no-print flex flex-col gap-1.5 rounded-(--radius-control) border border-brand-100 bg-brand-50/60 px-3 py-2.5" data-testid="calc-presets">
            <p className="t-sub font-semibold break-keep text-brand-900">상황 예시로 바로 — 누르면 이 업체 숫자(주주명부 · 순이익 · 1주 가치)로 계산</p>
            <div className="flex flex-wrap gap-1.5">
              {calcPresets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-testid="calc-preset"
                  data-id={p.id}
                  title={p.when}
                  onClick={() => applyPreset(p)}
                  className="tap max-w-full rounded-full border border-brand-200 bg-white px-3 py-1.5 text-left text-[0.92rem] font-medium break-keep text-brand-800 hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        )}

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
                  s.key === sub.key ? 'border-navy-900 bg-navy-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
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
                  <HelpHeading as="h3" tight wrapClassName="mb-3 border-b border-slate-100 pb-2" className="text-[0.98rem] font-bold text-slate-900">{g.title}</HelpHeading>
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
                className={`rounded-(--radius-panel) border p-4 ${b.tone === 'light' ? 'border-slate-200 bg-white' : 'border-navy-900 bg-navy-900 text-slate-100'}`}
              >
                <HelpHeading as="h3" tight onDark={b.tone !== 'light'} wrapClassName={`mb-2 border-b pb-2 ${b.tone === 'light' ? 'border-slate-100' : 'border-white/15'}`} className={`text-[0.98rem] font-bold ${b.tone === 'light' ? 'text-slate-900' : 'text-amber-200'}`}>{b.title}</HelpHeading>
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
                        l.cls === 'highlight' ? `-mx-2 rounded-(--radius-control) px-2 ${b.tone === 'light' ? 'bg-brand-50' : 'bg-amber-200/15'}` : `border-b border-dashed ${b.tone === 'light' ? 'border-slate-200' : 'border-white/15'}`
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
              <div className="no-print flex flex-wrap items-center gap-2">
                <ToolResultAttach
                  toolKey="tax"
                  title={`${calc.title}${calc.subs.length > 1 ? ` · ${sub.label}` : ''}`}
                  verdict={null}
                  verdictLabel={headlineOf(out.blocks)}
                  summary={summaryOf(calc.title, calc.subs.length > 1 ? sub.label : '', out.blocks)}
                  data={{ calc: calc.key, sub: sub.key, values }}
                  openPathFor={(cid) => `/tools/tax?client=${encodeURIComponent(cid)}&m=calc&c=${calc.key}${calc.subs.length > 1 ? `&s=${sub.key}` : ''}`}
                />
              </div>
            )}
          </div>
        </div>

        {(out.tables ?? []).map((t) => (
          <div key={t.id} className="rounded-(--radius-panel) border border-slate-200 bg-white p-4">
            <HelpHeading as="h3" tight wrapClassName="mb-3 border-b border-slate-100 pb-2" className="text-[0.98rem] font-bold text-slate-900">{t.title}</HelpHeading>
            {/* D-102: 인쇄하면 오른쪽 칸이 잘렸다 — 종이에서는 가로 넘김 대신 글자를 줄여 한 폭에 */}
            <div className="overflow-x-auto print:overflow-visible">
              <table data-table={t.id} className="w-full min-w-[640px] text-[0.875rem] print:min-w-0 print:text-[7pt]">
                <thead>
                  <tr>
                    {t.head.map((h, i) => (
                      <th key={i} className={`bg-navy-800 px-2 py-1.5 font-medium text-white print:px-1 ${i === 0 ? 'text-left' : 'text-right'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r, i) => (
                    <tr key={i} className={r.best ? 'bg-amber-100 font-bold' : i % 2 === 1 ? 'bg-slate-50' : ''}>
                      {r.cells.map((c, j) => (
                        <td key={j} className={`border-b border-slate-100 px-2 py-1.5 tabular-nums print:px-1 print:whitespace-nowrap ${j === 0 ? 'text-left' : 'text-right'}`}>
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
      </>
      )}
    </div>
  )
}

export type { Field }
