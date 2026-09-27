/**
 * 업체 화면의 사실 두 장 (D-128) — 거대한 대시보드가 아니다.
 *
 *  1. 자료에서 찾은 정보(확인 필요) — 자료를 올렸거나 크레탑을 붙였을 때만 뜬다.
 *     [모두 확인] 한 번이면 끝. 틀린 것만 고치고, 나머지는 [나중에 확인].
 *  2. 숫자 · 인증 — 매출 · 영업이익 · 인증처럼 업체 칸이 없던 사실. 출처와 확인 상태가 한 줄로 붙는다.
 *
 * 여기서 확인한 값을 모든 전문 모듈이 다시 쓴다(services/customerFacts.ts). 확인 전의 값은 어떤 모듈도 쓰지 않는다.
 */

import { useState } from 'react'
import { Check, FileSearch, Pencil } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import {
  FACT_DEFS,
  displayFact,
  factDef,
  hardFactsToConfirm,
  normalizeFactInput,
  pendingFacts,
  readFact,
  withFactConfirmed,
  withFactDecisions,
  withFactValue,
  type FactDecision,
} from '../../services/customerFacts'
import { Button } from '../ui/Button'
import { Badge, Surface } from '../ui/primitives'
import { josa } from '../../lib/josa'

type Commit = (next: ClientOpsRecord, message: string) => void | Promise<void | boolean>

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-[1rem] text-slate-900 focus:border-brand-500 focus:outline-none'

/* ------------------------------------------------------------------ */
/* 1. 자료에서 찾은 정보                                                 */
/* ------------------------------------------------------------------ */

export function FactInboxCard({ record, now, onCommit }: { record: ClientOpsRecord; now: string; onCommit: Commit }) {
  const pending = pendingFacts(record)
  const [later, setLater] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [wrong, setWrong] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  // 다른 업체로 바뀌면 처음 상태로
  const [seen, setSeen] = useState(record.id)
  if (seen !== record.id) {
    setSeen(record.id)
    setLater(false)
    setFixing(false)
    setEdits({})
    setWrong({})
  }
  if (pending.length === 0) return null

  if (later) {
    return (
      <p className="t-body flex flex-wrap items-center gap-x-2 gap-y-1 break-keep text-slate-600" data-testid="fact-inbox-later">
        <FileSearch aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
        자료에서 찾은 정보 {pending.length}건 — 아직 확인하지 않았습니다.
        <button type="button" onClick={() => setLater(false)} className="tap inline-flex items-center font-semibold text-brand-700 hover:underline">
          지금 확인하기
        </button>
      </p>
    )
  }

  const acceptAll = async () => {
    const decisions: FactDecision[] = pending.map((p) => ({ id: p.id, action: 'accept' }))
    await onCommit(withFactDecisions(record, decisions, now), `자료에서 찾은 정보 ${pending.length}건을 확인했습니다. 모든 전문 모듈이 이 값을 씁니다.`)
  }

  const saveFixes = async () => {
    const decisions: FactDecision[] = []
    for (const p of pending) {
      if (wrong[p.id]) {
        decisions.push({ id: p.id, action: 'reject' })
        continue
      }
      const typed = edits[p.id]
      if (typed === undefined || typed.trim() === p.display.trim()) {
        decisions.push({ id: p.id, action: 'accept' })
        continue
      }
      const v = normalizeFactInput(p.key, typed)
      if (v === null || v === '') {
        setError(`${josa(p.label, '을/를')} 읽지 못했습니다. ${factDef(p.key)?.kind === 'won' ? '예: 12억 5,000만' : factDef(p.key)?.kind === 'date' ? '예: 2019-03-02' : '다시 적어 주세요'}`)
        return
      }
      decisions.push({ id: p.id, action: 'fix', value: v })
    }
    setError('')
    const fixed = decisions.filter((d) => d.action === 'fix').length
    const rejected = decisions.filter((d) => d.action === 'reject').length
    await onCommit(
      withFactDecisions(record, decisions, now),
      `확인했습니다${fixed ? ` · 고친 것 ${fixed}건` : ''}${rejected ? ` · 뺀 것 ${rejected}건` : ''}.`,
    )
    setFixing(false)
    setEdits({})
    setWrong({})
  }

  return (
    <Surface edge="brand" showEdge>
      <div className="flex flex-col gap-3" data-testid="fact-inbox">
        <div className="flex flex-wrap items-center gap-2">
          <FileSearch aria-hidden="true" className="size-5 shrink-0 text-brand-600" />
          <h2 className="t-card font-bold break-keep text-slate-900">자료에서 다음 정보를 찾았습니다</h2>
          <Badge tone="brand">{pending.length}건</Badge>
        </div>
        <p className="t-sub break-keep text-slate-600">확인하면 모든 전문 모듈이 이 값을 씁니다. 확인하기 전에는 어디에도 쓰지 않습니다.</p>
        <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200">
          {pending.map((p) => (
            <li key={p.id} className="flex flex-col gap-1.5 px-3 py-2.5" data-fact={p.key}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="t-sub w-24 shrink-0 text-slate-500">{p.label}</span>
                {fixing ? null : <span className={`t-body min-w-0 font-bold break-keep [overflow-wrap:anywhere] ${wrong[p.id] ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{p.display}</span>}
                <span className="t-meta text-slate-500">{p.sourceLabel}</span>
              </div>
              {p.current && !fixing && <span className="t-sub break-keep text-amber-800">지금 적힌 값: {p.current}</span>}
              {fixing && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label={`${p.label} 고치기`}
                    className={`${inputCls} min-w-0 flex-1 basis-[12rem] ${wrong[p.id] ? 'opacity-50' : ''}`}
                    value={edits[p.id] ?? p.display}
                    disabled={wrong[p.id]}
                    onChange={(e) => setEdits((m) => ({ ...m, [p.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    aria-pressed={Boolean(wrong[p.id])}
                    onClick={() => setWrong((m) => ({ ...m, [p.id]: !m[p.id] }))}
                    className={`tap t-sub inline-flex shrink-0 items-center rounded-(--radius-control) border px-3 font-medium ${wrong[p.id] ? 'border-danger-300 bg-danger-50 text-danger-700' : 'border-slate-300 bg-white text-slate-700'}`}
                  >
                    {wrong[p.id] ? '빼기로 함' : '이건 빼기'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {error && <p className="t-sub text-danger-700" role="alert">{error}</p>}
        {fixing ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void saveFixes()} data-testid="fact-save-fixes">
              <Check aria-hidden="true" className="size-4" /> 고친 대로 확인
            </Button>
            <Button variant="ghost" onClick={() => { setFixing(false); setEdits({}); setWrong({}); setError('') }}>
              그만두기
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void acceptAll()} data-testid="fact-accept-all">
              <Check aria-hidden="true" className="size-4" /> 모두 확인
            </Button>
            <Button variant="secondary" onClick={() => setFixing(true)} data-testid="fact-fix">
              <Pencil aria-hidden="true" className="size-4" /> 틀린 것만 고치기
            </Button>
            <Button variant="ghost" onClick={() => setLater(true)} data-testid="fact-later">
              나중에 확인
            </Button>
          </div>
        )}
      </div>
    </Surface>
  )
}

/* ------------------------------------------------------------------ */
/* 2. 숫자 · 인증                                                        */
/* ------------------------------------------------------------------ */

const STORE_FACTS = FACT_DEFS.filter((d) => !d.field)

export function FactNumbersCard({ record, now, onCommit }: { record: ClientOpsRecord; now: string; onCommit: Commit }) {
  const facts = STORE_FACTS.map((d) => readFact(record, d.key)!)
  const filled = facts.filter((f) => f.status !== 'missing')
  const empty = facts.filter((f) => f.status === 'missing')
  const [showEmpty, setShowEmpty] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [asOf, setAsOf] = useState('')
  const [estimated, setEstimated] = useState(false)
  const [error, setError] = useState('')
  const toConfirm = hardFactsToConfirm(record).filter((f) => f.status === 'entered')
  const missingHard = hardFactsToConfirm(record).filter((f) => f.status === 'missing')

  const start = (key: string) => {
    const f = readFact(record, key)!
    setEditing(key)
    setDraft(f.status === 'missing' ? '' : f.display)
    setAsOf(f.asOf)
    setEstimated(f.status === 'estimated' || (f.status === 'missing' && factDef(key)?.defaultStatus === 'estimated'))
    setError('')
  }
  const save = async (key: string) => {
    const def = factDef(key)!
    const v = normalizeFactInput(key, draft)
    if (v === null) {
      setError(def.kind === 'won' ? '금액을 읽지 못했습니다. 예: 12억 5,000만' : '다시 적어 주세요')
      return
    }
    await onCommit(
      withFactValue(record, key, v, { source: 'manual', status: estimated ? 'estimated' : 'entered', asOf: asOf.trim(), now }),
      v === '' ? `${josa(def.label, '을/를')} 비웠습니다.` : `${josa(def.label, '을/를')} 적었습니다.`,
    )
    setEditing(null)
  }
  const confirmAll = async () => {
    let next = record
    for (const f of toConfirm) next = withFactConfirmed(next, f.key, now)
    await onCommit(next, `${toConfirm.map((f) => f.label).join(' · ')} — 맞다고 확인했습니다.`)
  }

  const row = (key: string) => {
    const f = readFact(record, key)!
    const def = factDef(key)!
    if (editing === key) {
      return (
        <li key={key} className="flex flex-col gap-2 py-2.5" data-fact-row={key}>
          <label className="t-sub font-medium text-slate-700" htmlFor={`fact-${key}`}>{f.label}</label>
          <input id={`fact-${key}`} className={inputCls} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={def.kind === 'won' ? '예: 12억 5,000만' : ''} autoFocus />
          {def.kind === 'won' && (
            <div className="flex flex-wrap items-center gap-2">
              <input aria-label="기준 연도" className={`${inputCls} w-28`} value={asOf} onChange={(e) => setAsOf(e.target.value.replace(/[^\d]/g, '').slice(0, 4))} placeholder="기준 연도" inputMode="numeric" />
              <label className="tap t-sub inline-flex items-center gap-2 text-slate-700">
                <input type="checkbox" className="size-5" checked={estimated} onChange={(e) => setEstimated(e.target.checked)} />
                예상값(확정 아님)
              </label>
            </div>
          )}
          {error && <p className="t-sub text-danger-700" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => void save(key)}>저장</Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>취소</Button>
          </div>
        </li>
      )
    }
    return (
      <li key={key} className="flex flex-wrap items-start gap-x-3 gap-y-0.5 py-2" data-fact-row={key}>
        {/* 휴대폰 · 큰 글자에서는 이름 한 줄, 값 · 출처 아래 — 한 줄에 몰면 값이 한 글자씩 쪼개진다 */}
        <span className="t-sub w-full shrink-0 pt-0.5 text-slate-500 sm:w-28">{f.label}</span>
        <span className="flex min-w-0 flex-1 basis-[10rem] flex-col">
          <span className="t-body font-semibold break-keep text-slate-900">{f.display}</span>
          <span className={`t-meta break-keep ${f.status === 'confirmed' ? 'text-success-700' : f.status === 'estimated' ? 'text-amber-800' : 'text-slate-500'}`}>{f.sourceLabel}</span>
        </span>
        <button type="button" onClick={() => start(key)} className="tap t-sub inline-flex shrink-0 items-center gap-1 font-medium text-brand-700 hover:underline">
          <Pencil aria-hidden="true" className="size-3.5" /> 고치기
        </button>
      </li>
    )
  }

  return (
    <section aria-labelledby="fact-numbers" className="flex flex-col gap-2" data-testid="fact-numbers">
      <h2 id="fact-numbers" className="t-section text-slate-900">숫자 · 인증</h2>
      {filled.length > 0 ? (
        <ul className="flex flex-col divide-y divide-slate-100">{filled.map((f) => row(f.key))}</ul>
      ) : (
        <p className="t-sub break-keep text-slate-500">아직 적은 숫자가 없습니다. 크레탑 보고서를 붙이면 자료에서 읽어 확인만 받습니다.</p>
      )}
      {empty.length > 0 && (
        showEmpty || editing && empty.some((f) => f.key === editing) ? (
          <ul className="flex flex-col divide-y divide-slate-100 border-t border-slate-100">
            {empty.map((f) =>
              editing === f.key ? row(f.key) : (
                <li key={f.key} className="py-1">
                  <button type="button" onClick={() => start(f.key)} className="tap t-sub inline-flex items-center gap-1 font-medium text-slate-600 hover:text-brand-700">
                    + {f.label} 적기
                  </button>
                </li>
              ),
            )}
          </ul>
        ) : (
          <button type="button" onClick={() => setShowEmpty(true)} className="tap t-sub inline-flex w-fit items-center text-left font-medium break-keep text-slate-600 hover:text-brand-700" data-testid="fact-show-empty">
            + {empty.map((f) => f.label).slice(0, 3).join(' · ')}{empty.length > 3 ? ` 외 ${empty.length - 3}개` : ''} 적기
          </button>
        )
      )}
      {(toConfirm.length > 0 || missingHard.length > 0) && (
        <div className="t-sub mt-1 flex flex-col gap-1.5 rounded-(--radius-control) bg-slate-50 px-3 py-2.5 break-keep text-slate-700" data-testid="fact-hard">
          <p>
            <b className="font-semibold">신청 · 제출 전에만 확인하면 됩니다.</b> 지금 상담에는 그대로 씁니다.
          </p>
          {toConfirm.length > 0 && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>적어 둔 값 — {toConfirm.map((f) => `${f.label} ${displayFact(factDef(f.key), f.value)}`).join(' · ')}</span>
              <Button variant="secondary" size="sm" onClick={() => void confirmAll()} data-testid="fact-confirm-entered">
                <Check aria-hidden="true" className="size-4" /> 모두 맞음
              </Button>
            </p>
          )}
          {missingHard.length > 0 && <p className="text-slate-500">아직 없음 — {missingHard.map((f) => f.label).join(' · ')}</p>}
        </div>
      )}
    </section>
  )
}
