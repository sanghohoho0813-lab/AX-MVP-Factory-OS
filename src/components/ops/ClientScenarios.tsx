/**
 * 업체 상세 '맞춤 추천' › 상황 예시로 바로 설계 (D-199 · 로드맵 5단계 · D-201 기준 바로잡기).
 *
 * 대표 지시(고도화 목표 3): 계산기는 상황 예시로 — 상황 예시를 많이 두고, 한 번 누르면 그 업체 숫자로 설계까지.
 * D-201 대표 지적: "무슨 기준으로 나오는지 모르겠다 · 그냥 갖다 붙인 것 같다" — 이제 맞는지 먼저 따진다.
 *  1. 이 업체에 맞는 상황 — 업체 기록에 근거가 있는 것만 설계한다. 줄마다 '왜' 한 줄(이 업체 숫자).
 *  2. 물어보면 열리는 상황 — 채용 계획 · 계약직 · 설비 투자처럼 기록에 없는 사정은 예/아니요 하나만 묻는다
 *     (같은 질문을 쓰는 상황은 한 번에). 답하면 업체 기록에 남고 그 자리에서 다시 맞춘다.
 *  3. 자료를 받으면 판단 — 영업이익 · 이익잉여금처럼 숫자가 없으면 받을 자료를 한 장의 요청 문구로.
 *  4. 이 업체엔 안 맞는 상황 — 까닭과 함께 접어 둔다(대표 답 때문이면 '답 바꾸기').
 *  - 계산은 services/scenarios.ts(모듈 화면과 같은 엔진) · 기준은 services/scenarioFit.ts. 규칙 계산 — 'AI' 라고 부르지 않는다.
 *  - D-210: 답하는 동안과 바로 뒤에는 다른 답을 받지 않는다(질문 줄이 빠지며 아래 질문이 손가락 밑으로 올라와 두 번 눌림 = 엉뚱한 답).
 *    '예' 로 새로 맞게 된 상황은 펼쳐 그 자리로 옮기고 '방금 열림' 표시 — 위쪽 목록에 조용히 생겨 못 보던 것.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarPlus, Check, ChevronDown, FileStack, MessageSquareText, Minus } from 'lucide-react'
import { SITUATION_PLANS } from '../../services/situationPlan'
import type { ClientOpsRecord } from '../../types/clientOps'
import { Button } from '../ui/Button'
import { Badge, Section, type Tone } from '../ui/primitives'
import { SCENARIO_MODULE_LABEL, type ScenarioModule } from '../../services/scenarioPresets'
import { SCENARIO_STATE_LABEL, fitDataRequest, runScenarios, scenariosRequest, type ScenarioRun, type ScenarioState } from '../../services/scenarios'
import { SCENARIO_QUESTIONS, scenarioAnswer, withScenarioAnswer, type QuestionKey } from '../../services/scenarioFit'
import { nowIso } from '../../lib/appClock'

const STATE_TONE: Record<ScenarioState, Tone> = { ready: 'success', partial: 'brand', need: 'warning' }
const FIRST = 6
/** 질문은 처음에 세 개만 — 한꺼번에 아홉 개를 묻지 않는다(나머지는 '질문 더 보기') */
const FIRST_Q = 3
/** 답한 뒤 목록이 움직이는 동안 다음 누름을 받지 않는 시간 */
const ANSWER_LOCK_MS = 600

/** '회사 정보 · 자산', '회사 정보 · 부채' … → '회사 정보(자산 · 부채 …)' — 같은 출처는 한 번만 */
function tidyFilled(list: readonly string[]): string {
  const groups = new Map<string, string[]>()
  const solo: string[] = []
  for (const f of list) {
    const m = f.match(/^(회사 정보|크레탑 보고서) · (.+)$/)
    if (m) groups.set(m[1], [...(groups.get(m[1]) ?? []), m[2]])
    else solo.push(f)
  }
  return [...[...groups].map(([k, v]) => `${k}(${v.join(' · ')})`), ...solo].join(' / ')
}

export function ClientScenarios({
  record,
  today,
  usable,
  onRequestText,
  onSetNext,
  onAnswer,
  onPlan,
}: {
  record: ClientOpsRecord
  today: string
  usable: (module: ScenarioModule) => boolean
  onRequestText?: (text: string) => void
  onSetNext: (text: string) => void
  /** D-242: 이 상황을 '상황별 한 장 설계서' 로(여러 모듈을 한 장에) — 설계서가 있는 상황만 단추가 생긴다 */
  onPlan?: (presetId: string) => void
  /** 대표 답 저장(null 이면 지움 — 답 바꾸기). 없으면 질문만 보여 준다. 약속을 돌려주면 저장이 끝날 때까지 다른 답을 막는다 */
  onAnswer?: (q: QuestionKey, a: 'yes' | 'no' | null) => void | Promise<unknown>
}) {
  const runs = useMemo(() => runScenarios(record, today, usable, true), [record, today, usable])
  const fits = useMemo(() => runs.filter((r) => r.fit.kind === 'fit'), [runs])
  const asks = useMemo(() => runs.filter((r) => r.fit.kind === 'ask'), [runs])
  const datas = useMemo(() => runs.filter((r) => r.fit.kind === 'data'), [runs])
  const nos = useMemo(() => runs.filter((r) => r.fit.kind === 'no'), [runs])
  const [mod, setMod] = useState<ScenarioModule | 'all'>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [moreQ, setMoreQ] = useState(false)
  /** 저장 중인 답(그동안 예 · 아니요 · 답 바꾸기 모두 막음) */
  const [busy, setBusy] = useState<QuestionKey | null>(null)
  const lockUntil = useRef(0)
  /** '예' 로 새로 맞게 된 상황 — 펼쳐 그 자리로 옮기고 잠깐 표시 */
  const [flash, setFlash] = useState<string[]>([])
  const scrolledFor = useRef<string | null>(null)
  /** '예' 로 답했는데 새로 맞는 상황이 없을 때 한 줄로 알림 */
  const [note, setNote] = useState('')
  const answer = async (q: QuestionKey, a: 'yes' | 'no' | null) => {
    if (!onAnswer || busy !== null || Date.now() < lockUntil.current) return
    // 답한 뒤 맞게 될 상황을 같은 엔진으로 미리 셈 — 저장 순서와 상관없이 무엇이 새로 열리는지 안다
    const before = new Set(fits.map((r) => r.id))
    let opened: string[] = []
    try {
      opened = runScenarios(withScenarioAnswer(record, q, a, nowIso()), today, usable, true)
        .filter((r) => r.fit.kind === 'fit' && !before.has(r.id))
        .map((r) => r.id)
    } catch {
      opened = []
    }
    setBusy(q)
    setNote('')
    try {
      await onAnswer(q, a)
    } finally {
      lockUntil.current = Date.now() + ANSWER_LOCK_MS
      setBusy(null)
    }
    if (opened.length > 0) {
      scrolledFor.current = null
      setFlash(opened)
    } else if (a === 'yes') {
      setNote('답을 반영했어요 — 새로 맞게 된 상황은 없어요(자료가 더 필요하거나 다른 조건이 걸려 있어요).')
    }
  }
  const modules = useMemo(() => [...new Set(fits.map((r) => r.module))], [fits])
  // D-209: 고른 모듈이 '맞는 상황' 에서 빠지면(답을 바꿈) 전체로 — 예전에는 빈 목록에 갇혀 '전체' 칩도 사라졌다
  const active: ScenarioModule | 'all' = mod !== 'all' && modules.includes(mod) && modules.length > 1 ? mod : 'all'
  // 빠진 모듈을 기억해 두지 않는다 — 나중에 그 모듈이 다시 맞아도 거른 목록으로 갑자기 돌아가지 않게
  useEffect(() => {
    if (mod !== active) setMod(active)
  }, [mod, active])
  const shown = active === 'all' ? fits : fits.filter((r) => r.module === active)
  const list = more || active !== 'all' ? shown : shown.slice(0, FIRST)
  // 새로 열린 상황이 거른 목록 밖이거나 '더 보기' 뒤에 있으면 보이게 — 펼쳐서 그 줄로
  const flashKey = flash.join(',')
  useEffect(() => {
    if (!flash.length || scrolledFor.current === flashKey) return
    const first = fits.find((r) => flash.includes(r.id))
    if (!first) return
    if (active !== 'all' && first.module !== active) {
      setMod('all')
      return
    }
    if (!more && active === 'all' && fits.indexOf(first) >= FIRST) {
      setMore(true)
      return
    }
    scrolledFor.current = flashKey
    setOpen(first.id)
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-testid="scenario-row"][data-id="${CSS.escape(first.id)}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }, [flash, flashKey, fits, active, more])
  // 표시는 잠깐만
  useEffect(() => {
    if (!flash.length) return
    const t = window.setTimeout(() => setFlash([]), 6000)
    return () => window.clearTimeout(t)
  }, [flash])
  const ready = fits.filter((r) => r.state === 'ready').length
  const allRequest = useMemo(() => scenariosRequest(record, fits.filter((r) => r.state === 'need')), [record, fits])
  const dataRequest = useMemo(() => fitDataRequest(record, datas), [record, datas])
  // 같은 질문을 쓰는 상황은 한 줄로(한 번 답하면 같이 열린다)
  const questions = useMemo(() => {
    const m = new Map<QuestionKey, { why: string; titles: string[] }>()
    for (const r of asks) {
      const q = r.fit.question!
      const cur = m.get(q)
      if (cur) cur.titles.push(r.title)
      else m.set(q, { why: r.fit.why, titles: [r.title] })
    }
    return [...m]
  }, [asks])
  if (runs.length === 0) return null
  return (
    <Section title="상황 예시로 바로 설계" count={fits.length} fold={{ id: 'smart.scenarios', open: true }}>
      <div
        className="flex flex-col gap-3"
        data-testid="smart-scenarios"
        data-count={fits.length}
        data-ready={ready}
        data-ask={questions.length}
        data-data={datas.length}
        data-no={nos.length}
      >
        <p className="t-sub break-keep text-slate-600">
          업체 기록에 <b className="font-semibold text-slate-900">근거가 있는 상황만</b> 이 업체 숫자로 설계해요. 줄마다 '왜 이 업체에' 가 붙어요 — 기록에 없는 사정은 아래에서 예 · 아니요로 물어봐요.
          <span className="ml-1 font-semibold text-success-700" data-testid="scenario-ready-count">
            맞는 상황 {fits.length}가지 · 바로 설계됨 {ready}가지
          </span>
        </p>

        {fits.length === 0 ? (
          <p className="t-sub rounded-(--radius-control) border border-dashed border-slate-300 px-3 py-3 break-keep text-slate-600" data-testid="scenario-fit-empty">
            지금 기록으로는 이 업체에 맞다고 말할 수 있는 상황이 없어요. 아래 질문에 답하거나 자료를 받으면 맞는 상황이 열려요.
          </p>
        ) : (
          <>
            {modules.length > 1 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="모듈로 거르기">
                {(['all', ...modules] as const).map((m) => {
                  const n = m === 'all' ? fits.length : fits.filter((r) => r.module === m).length
                  const on = active === m
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setMod(m)
                        setOpen(null)
                      }}
                      className={`tap t-sub inline-flex items-center gap-1 rounded-full border px-3 font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400'}`}
                      data-testid="scenario-filter"
                      data-module={m}
                    >
                      {m === 'all' ? '전체' : SCENARIO_MODULE_LABEL[m]} <span className={on ? 'text-white/80' : 'text-slate-400'}>{n}</span>
                    </button>
                  )
                })}
              </div>
            )}
            <ul className="flex flex-col gap-2" data-testid="scenario-list">
              {list.map((r) => (
                <ScenarioRow
                  key={r.id}
                  r={r}
                  open={open === r.id}
                  onToggle={() => setOpen((x) => (x === r.id ? null : r.id))}
                  onRequestText={onRequestText}
                  onSetNext={onSetNext}
                  onUndo={r.fit.answered && onAnswer ? () => void answer(r.fit.answered!, null) : undefined}
                  onPlan={onPlan && SITUATION_PLANS.some((d) => d.preset === r.id) ? () => onPlan(r.id) : undefined}
                  fresh={flash.includes(r.id)}
                  busy={busy !== null}
                />
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {active === 'all' && !more && shown.length > FIRST && (
                <Button size="sm" variant="secondary" onClick={() => setMore(true)} data-testid="scenario-more">
                  <ChevronDown aria-hidden="true" className="size-4" /> 맞는 상황 더 보기 ({shown.length - FIRST})
                </Button>
              )}
              {allRequest && onRequestText && (
                <Button size="sm" variant="ghost" onClick={() => onRequestText(allRequest)} data-testid="scenario-request-all">
                  <MessageSquareText aria-hidden="true" className="size-4" /> 설계에 빠진 숫자 요청 문구
                </Button>
              )}
            </div>
          </>
        )}

        {questions.length > 0 && (
          <div className="flex flex-col gap-2 rounded-(--radius-card) border border-brand-200 bg-brand-50/40 px-3 py-3" data-testid="scenario-questions">
            <p className="t-body font-bold break-keep text-slate-900">
              물어보면 열리는 상황 <span className="text-slate-500">{asks.length}</span>
            </p>
            <p className="t-meta break-keep text-slate-600">기록에 없는 사정이에요. '예' 를 누르면 그 상황을 이 업체 숫자로 설계해요.</p>
            {note && (
              <p className="t-meta break-keep text-slate-700" role="status" data-testid="scenario-answer-note">
                {note}
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {(moreQ ? questions : questions.slice(0, FIRST_Q)).map(([q, v]) => (
                <li key={q} className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5 sm:flex-row sm:items-center" data-testid="scenario-question" data-q={q}>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="t-body font-semibold break-keep text-slate-900">{SCENARIO_QUESTIONS[q]}</span>
                    {v.why !== SCENARIO_QUESTIONS[q] && <span className="t-meta break-keep text-slate-500">{v.why.replace(`${SCENARIO_QUESTIONS[q]} — `, '')}</span>}
                    <span className="t-meta break-keep text-slate-500">예 → {v.titles.join(' · ')}</span>
                  </span>
                  {onAnswer && (
                    <span className="flex shrink-0 gap-1.5">
                      <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void answer(q, 'yes')} data-testid="scenario-answer-yes">
                        예
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void answer(q, 'no')} data-testid="scenario-answer-no">
                        아니요
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {!moreQ && questions.length > FIRST_Q && (
              <div>
                <Button size="sm" variant="ghost" onClick={() => setMoreQ(true)} data-testid="scenario-questions-more">
                  <ChevronDown aria-hidden="true" className="size-4" /> 질문 더 보기 ({questions.length - FIRST_Q})
                </Button>
              </div>
            )}
          </div>
        )}

        {datas.length > 0 && (
          <details className="group rounded-(--radius-card) border border-slate-200 bg-white" data-testid="scenario-data">
            <summary className="tap flex cursor-pointer list-none items-center gap-2 px-3 py-2.5">
              <span className="t-body min-w-0 flex-1 font-semibold break-keep text-slate-900">
                자료를 받으면 판단 <span className="text-slate-500">{datas.length}</span>
              </span>
              <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5">
              <ul className="flex flex-col gap-1.5">
                {datas.map((r) => (
                  <li key={r.id} className="t-sub break-keep text-slate-700 [overflow-wrap:anywhere]" data-testid="scenario-data-row" data-id={r.id}>
                    <b className="font-semibold text-slate-900">{r.title}</b> — {r.fit.why}
                  </li>
                ))}
              </ul>
              {dataRequest && onRequestText && (
                <div>
                  <Button size="sm" variant="secondary" onClick={() => onRequestText(dataRequest)} data-testid="scenario-data-request">
                    <MessageSquareText aria-hidden="true" className="size-4" /> 받을 자료 요청 문구
                  </Button>
                </div>
              )}
            </div>
          </details>
        )}

        {nos.length > 0 && (
          <details className="group rounded-(--radius-card) border border-slate-200 bg-white" data-testid="scenario-nofit">
            <summary className="tap flex cursor-pointer list-none items-center gap-2 px-3 py-2.5">
              <span className="t-body min-w-0 flex-1 font-semibold break-keep text-slate-700">
                이 업체엔 안 맞는 상황 <span className="text-slate-500">{nos.length}</span>
              </span>
              <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="flex flex-col gap-1.5 border-t border-slate-100 px-3 py-2.5">
              {nos.map((r) => (
                <li key={r.id} className="t-sub flex flex-wrap items-baseline gap-x-2 break-keep text-slate-600 [overflow-wrap:anywhere]" data-testid="scenario-no-row" data-id={r.id}>
                  <span className="min-w-0">
                    <b className="font-semibold text-slate-800">{r.title}</b> — {r.fit.why}
                  </span>
                  {r.fit.answered && onAnswer && scenarioAnswer(record, r.fit.answered) !== null && (
                    <button type="button" disabled={busy !== null} onClick={() => void answer(r.fit.answered!, null)} className="tap t-meta font-semibold text-brand-700 hover:underline disabled:opacity-50" data-testid="scenario-undo">
                      답 바꾸기
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Section>
  )
}

function ScenarioRow({
  r,
  open,
  onToggle,
  onRequestText,
  onSetNext,
  onUndo,
  onPlan,
  fresh = false,
  busy = false,
}: {
  r: ScenarioRun
  open: boolean
  onToggle: () => void
  onRequestText?: (text: string) => void
  onSetNext: (text: string) => void
  onUndo?: () => void
  onPlan?: () => void
  /** 방금 '예' 로 열린 상황 */
  fresh?: boolean
  busy?: boolean
}) {
  // 머리글과 같은 줄은 펼친 곳에서 다시 쓰지 않는다
  const lines = r.lines.filter((l) => l !== r.headline)
  return (
    <li
      className={`flex min-w-0 scroll-mt-32 flex-col rounded-(--radius-card) border bg-white transition-shadow ${fresh ? 'border-success-400 ring-2 ring-success-300' : 'border-slate-200'}`}
      data-testid="scenario-row"
      data-id={r.id}
      data-module={r.module}
      data-state={r.state}
      data-fit={r.fit.kind}
      data-fresh={fresh ? '1' : undefined}
    >
      <button type="button" onClick={onToggle} aria-expanded={open} className="tap flex w-full min-w-0 items-start gap-3 px-4 py-3 text-left hover:bg-slate-50" data-testid="scenario-toggle">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {fresh && (
              <Badge tone="success">
                <span data-testid="scenario-fresh">방금 열림</span>
              </Badge>
            )}
            <Badge tone="neutral">{r.moduleLabel}</Badge>
            <span className="t-body min-w-0 font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{r.title}</span>
          </span>
          {/* D-201: 왜 이 업체에 — 이 업체 기록의 근거 한 줄 */}
          <span className="t-meta flex min-w-0 gap-1 break-keep text-success-800 [overflow-wrap:anywhere]" data-testid="scenario-why">
            <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0">왜 이 업체에: {r.fit.why}</span>
          </span>
          <span className="t-sub line-clamp-2 break-keep text-slate-700 [overflow-wrap:anywhere]" data-testid="scenario-headline">
            {r.headline}
          </span>
          {r.amount && (
            <span className="t-sub font-bold break-keep text-success-700" data-testid="scenario-amount">
              {r.amount}
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={STATE_TONE[r.state]}>
            <span data-testid="scenario-state">{SCENARIO_STATE_LABEL[r.state]}</span>
          </Badge>
          <ChevronDown aria-hidden="true" className={`size-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3" data-testid="scenario-detail">
          <p className="t-meta break-keep text-slate-500">{r.when}</p>
          {lines.length > 0 && (
            <ul className="flex flex-col gap-1" data-testid="scenario-lines">
              {lines.map((l) => (
                <li key={l} className="t-sub flex gap-2 break-keep text-slate-800 [overflow-wrap:anywhere]">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
                  <span className="min-w-0">{l}</span>
                </li>
              ))}
            </ul>
          )}
          {r.needs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="t-sub font-semibold text-slate-900">이 상황에 필요한 숫자</p>
              <ul className="flex flex-wrap gap-1.5" data-testid="scenario-needs">
                {r.needs.map((n) => (
                  <li
                    key={n.label}
                    className={`t-meta inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 break-keep ${n.ok ? 'border-success-200 bg-success-50 text-success-800' : 'border-warning-200 bg-warning-50 text-warning-800'}`}
                    data-testid="scenario-need"
                    data-ok={n.ok ? '1' : '0'}
                  >
                    {n.ok ? <Check aria-hidden="true" className="size-3.5 shrink-0" /> : <Minus aria-hidden="true" className="size-3.5 shrink-0" />}
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {n.label}
                      {n.ok && n.value ? <b className="ml-1 font-semibold">{n.value}</b> : !n.ok ? <span className="ml-1">— 없음</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.filledFrom.length > 0 && (
            <p className="t-meta break-keep text-slate-500" data-testid="scenario-filled">
              업체 기록에서 채움 · {tidyFilled(r.filledFrom)}
            </p>
          )}
          {r.assumptions.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {r.assumptions.map((a) => (
                <li key={a} className="t-meta break-keep text-slate-500">
                  {a}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Link to={r.openPath} className="tap t-sub inline-flex items-center gap-1 rounded-(--radius-control) bg-brand-600 px-3 font-semibold text-white hover:bg-brand-700" data-testid="scenario-open">
              {r.moduleLabel}에서 이어서 <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            {onPlan && (
              <Button size="sm" variant="secondary" onClick={onPlan} data-testid="scenario-plan">
                <FileStack aria-hidden="true" className="size-4" /> 한 장 설계서로(지원금 · 세액공제 · 정책자금)
              </Button>
            )}
            {r.request && onRequestText && (
              <Button size="sm" variant="secondary" onClick={() => onRequestText(r.request)} data-testid="scenario-request">
                <MessageSquareText aria-hidden="true" className="size-4" /> 빠진 것 요청 문구
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onSetNext(`${r.moduleLabel} — ${r.title} 설계 보여 드리기`)} data-testid="scenario-next">
              <CalendarPlus aria-hidden="true" className="size-4" /> 다음 약속으로
            </Button>
            {onUndo && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={onUndo} data-testid="scenario-undo">
                답 바꾸기
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}
