/**
 * 업체 상세 '맞춤 추천' › 상황별 한 장 설계서 (D-242 · 로드맵 7단계).
 *
 * 대표 지시(고도화 목표 3): 계산기는 상황 예시로 — 한 번 누르면 그 업체 숫자로 설계까지.
 * 상황 하나(청년 채용 · 만 60세 이상 채용 · 연구소 만들기 · 창업 5년 안 채용 — D-244)와 사람 수만 고르면
 * 고용지원금 · 세액공제 · 정책자금을 이 업체 숫자로 한 장에 모은다 — 세 화면을 따로 열어 더하지 않는다.
 *  1. 맨 위에 '1년 안에 받을 수 있는 돈'(크게) — 정책자금(대출)은 따로
 *  2. 모듈별 근거(같은 엔진) · 빠진 숫자 · 모듈 화면에서 이어서
 *  3. 이렇게 진행해요 — 고른 것만 업체에 붙일 때 할 일로(달력 · 오늘)
 *  4. 한 장 인쇄 · 요약 복사 · 빠진 숫자 요청 문구
 *  - 맞는지는 상황 예시와 같은 기준 — 묻는 상황은 예 · 아니요 하나만, 안 맞으면 설계를 보이지 않는다.
 *  - 계산은 services/situationPlan.ts. 규칙 계산 — 'AI' 라고 부르지 않는다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { openFold } from '../ui/fold'
import { createPortal, flushSync } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ClipboardCopy, MessageSquareText, Minus, Paperclip, Printer } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { Button } from '../ui/Button'
import { Badge, Section, type Tone } from '../ui/primitives'
import { useToast } from '../ui/toastContext'
import { friendlyDate } from '../../services/clientOpsNextAction'
import { copyText } from '../../services/grants/grantView'
import { manwonText } from '../../services/clientInsights'
import { SCENARIO_QUESTIONS, type QuestionKey } from '../../services/scenarioFit'
import { buildSituationPlan, planSummary, situationChoices, type BlockState, type PlanBlock, type PlanId, type SituationPlan } from '../../services/situationPlan'

const BLOCK_TONE: Record<BlockState, Tone> = { ok: 'success', need: 'warning', none: 'neutral' }
const BLOCK_LABEL: Record<BlockState, string> = { ok: '계산됨', need: '받으면 계산', none: '해당 없음' }
const NONE: ReadonlySet<string> = new Set()

export function ClientSituationPlan({
  record,
  today,
  usable,
  onAnswer,
  onAttach,
  onRequestText,
  focus,
}: {
  record: ClientOpsRecord
  today: string
  usable: (module: string) => boolean
  /** 아래 상황 예시에서 '한 장 설계서로' — 그 상황을 골라 펼치고 이 자리로(n 이 바뀔 때마다) */
  focus?: { id: PlanId; n: number } | null
  /** 대표 답 저장(상황 예시와 같은 칸) — null 이면 지움(답 바꾸기) */
  onAnswer?: (q: QuestionKey, a: 'yes' | 'no' | null) => void | Promise<unknown>
  /** 업체 기록에 붙이기(고른 행동은 할 일로) — 저장되면 새로 건 할 일 수, 못 하면 false */
  onAttach: (plan: SituationPlan, actionIds: string[]) => Promise<number | false>
  onRequestText?: (text: string) => void
}) {
  const { showToast } = useToast()
  const choices = useMemo(() => situationChoices(record, today, usable), [record, today, usable])
  const [picked, setPicked] = useState<PlanId | null>(null)
  const [counts, setCounts] = useState<Partial<Record<PlanId, number>>>({})
  /** 빼 둔 행동(기본은 모두 고름) — 어느 상황 · 사람 수의 것인지 함께(D-244: 바뀌면 저절로 다시 모두 — 답한 뒤 판이 바뀌어도 앞 체크가 따라가지 않게) */
  const [offBy, setOffBy] = useState<{ key: string; ids: ReadonlySet<string> }>({ key: '', ids: new Set() })
  const [busy, setBusy] = useState(false)
  const [attached, setAttached] = useState<{ key: string; todos: number; asked: number } | null>(null)
  const [printing, setPrinting] = useState(false)
  const answering = useRef(false)
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focus) return
    setPicked(focus.id)
    openFold('smart.plan')
    requestAnimationFrame(() => boxRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }, [focus])
  const current =choices.find((c) => c.def.id === picked) ?? choices[0] ?? null
  const def = current?.def ?? null
  const count = def ? (counts[def.id] ?? def.defaultCount) : 0
  const plan = useMemo(() => (def ? buildSituationPlan(def.id, record, today, count) : null), [def, record, today, count])
  if (!def || !plan || !current) return null
  const key = `${plan.id}:${plan.count}`
  const off = offBy.key === key ? offBy.ids : NONE
  const toggleOff = (id: string) =>
    setOffBy((s) => {
      const n = new Set(s.key === key ? s.ids : NONE)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return { key, ids: n }
    })
  const chosen = plan.actions.filter((a) => !off.has(a.id)).map((a) => a.id)
  const fit = plan.fit
  const showPlan = fit.kind !== 'no'

  const pick = (id: PlanId) => setPicked(id)
  const setCount = (n: number) => setCounts((c) => ({ ...c, [def.id]: n }))
  const answer = async (q: QuestionKey, a: 'yes' | 'no' | null) => {
    if (!onAnswer || answering.current) return
    answering.current = true
    // D-244: 답하면 고르는 판 순서가 바뀐다 — 고르지 않은 채 맨 앞 상황에 답해도 그 상황에 머문다(예전엔 다른 상황으로 넘어가 '답 바꾸기' 를 못 봤다)
    setPicked(def.id)
    setBusy(true)
    try {
      await onAnswer(q, a)
    } finally {
      answering.current = false
      setBusy(false)
    }
  }
  const attach = async () => {
    if (busy) return
    setBusy(true)
    try {
      const n = await onAttach(plan, chosen)
      if (n !== false) setAttached({ key, todos: n, asked: chosen.length })
    } finally {
      setBusy(false)
    }
  }
  const print = () => {
    // 인쇄 종이는 찍는 동안만 둔다 — 늘 두면 이 화면의 다른 인쇄(서류 · 보고서)가 이 종이만 찍는다(index.css .print-document)
    // D-244: 휴대폰 크롬은 print() 가 바로 돌아온다 — 다 찍은 뒤(afterprint)에 치운다 · 그 신호가 없는 브라우저는 1분 뒤
    flushSync(() => setPrinting(true))
    let timer = 0
    const done = () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', done)
      setPrinting(false)
    }
    window.addEventListener('afterprint', done)
    timer = window.setTimeout(done, 60_000)
    window.print()
  }
  const copy = async () => {
    showToast((await copyText(planSummary(plan, record.companyName))) ? '설계서 요약을 복사했어요 — 카톡에 붙여 넣으세요' : '복사하지 못했어요 — 다시 눌러 주세요')
  }

  return (
    <div ref={boxRef} className="scroll-mt-36">
    <Section title="상황별 한 장 설계서" fold={{ id: 'smart.plan', summary: '상황 하나 · 사람 수만 고르면 지원금 · 세액공제 · 정책자금을 한 장에' }} testId="situation-plan">
      <div className="flex flex-col gap-3" data-testid="plan-body" data-plan={plan.id} data-count={plan.count} data-fit={fit.kind} data-first={plan.firstWon}>
        <p className="t-sub break-keep text-slate-600">상황 하나와 사람 수만 고르면 고용지원금 · 세액공제 · 정책자금을 이 업체 숫자로 한 장에 모아요.</p>

        {/* 1. 상황 고르기 — 맞는 상황이 먼저 */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="상황 고르기">
          {choices.map((c) => {
            const on = c.def.id === def.id
            return (
              <button
                key={c.def.id}
                type="button"
                aria-pressed={on}
                onClick={() => pick(c.def.id)}
                className={`tap t-sub inline-flex items-center gap-1.5 rounded-full border px-3.5 font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-800 hover:border-brand-400'}`}
                data-testid="plan-pick"
                data-id={c.def.id}
                data-fit={c.fit.kind}
              >
                {c.def.label}
                <span className={`t-meta font-semibold ${on ? 'text-white/85' : c.fit.kind === 'fit' ? 'text-success-700' : c.fit.kind === 'no' ? 'text-slate-400' : 'text-brand-700'}`}>
                  {c.fit.kind === 'fit' ? '맞음' : c.fit.kind === 'no' ? '안 맞음' : c.fit.kind === 'ask' ? '확인' : '자료'}
                </span>
              </button>
            )
          })}
        </div>

        {/* 2. 몇 명? */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={def.id === 'lab-start' ? '연구원 몇 명' : '몇 명 뽑나요'}>
          <span className="t-sub mr-1 font-semibold text-slate-700">{def.id === 'lab-start' ? '연구원' : '몇 명'}</span>
          {def.counts.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={n === plan.count}
              onClick={() => setCount(n)}
              className={`tap t-sub min-w-12 rounded-full border px-3 font-semibold ${n === plan.count ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'}`}
              data-testid="plan-count"
              data-n={n}
            >
              {n}명
            </button>
          ))}
          <span className="t-meta ml-1 break-keep text-slate-500">{def.when}</span>
        </div>

        {/* 3. 맞는지 — 상황 예시와 같은 기준 */}
        {fit.kind === 'fit' && (
          <p className="t-sub flex min-w-0 gap-1.5 break-keep text-success-800 [overflow-wrap:anywhere]" data-testid="plan-fit">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">왜 이 업체에: {fit.why}</span>
          </p>
        )}
        {fit.kind === 'ask' && fit.question && (
          <div className="flex flex-col gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50/50 px-3 py-2.5 sm:flex-row sm:items-center" data-testid="plan-ask">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="t-body font-semibold break-keep text-slate-900">{SCENARIO_QUESTIONS[fit.question]}</span>
              <span className="t-meta break-keep text-slate-600">기록에 없는 계획이에요 — 아래는 '예' 라면 받을 수 있는 설계예요.</span>
            </span>
            {onAnswer && (
              <span className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void answer(fit.question!, 'yes')} data-testid="plan-answer-yes">
                  예
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void answer(fit.question!, 'no')} data-testid="plan-answer-no">
                  아니요
                </Button>
              </span>
            )}
          </div>
        )}
        {fit.kind === 'data' && (
          <p className="t-sub break-keep text-warning-800" data-testid="plan-data">
            {fit.why}
          </p>
        )}
        {fit.kind === 'no' && (
          <div className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2.5" data-testid="plan-nofit">
            <span className="t-sub min-w-0 flex-1 break-keep text-slate-700 [overflow-wrap:anywhere]">이 업체엔 안 맞아요 — {fit.why}</span>
            {fit.answered && onAnswer && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void answer(fit.answered!, null)} data-testid="plan-undo">
                답 바꾸기
              </Button>
            )}
          </div>
        )}

        {showPlan && (
          <>
            {/* 4. 한눈에 — 1년 안에 받을 수 있는 돈 */}
            <div className="flex flex-col gap-1 rounded-(--radius-panel) border border-success-200 bg-success-50 px-4 py-3" data-testid="plan-total">
              <span className="t-sub font-semibold break-keep text-success-800">{plan.title} — 1년 안에 받을 수 있는 돈(1차 추정)</span>
              <span className="t-page font-extrabold break-keep text-success-800 tabular-nums" data-testid="plan-total-amount">
                {plan.totalText || '받을 숫자가 있으면 계산해요'}
              </span>
              {plan.keepWon > plan.firstWon && (
                <span className="t-sub break-keep text-success-900" data-testid="plan-keep">
                  {plan.keepLabel} {plan.keepYears}년 합계 <b className="font-bold">약 {manwonText(plan.keepWon)}</b>
                </span>
              )}
              <span className="t-meta break-keep text-slate-600">
                {plan.blocks
                  .filter((b) => b.state === 'ok' && b.won > 0)
                  .map((b) => `${b.label} ${b.amount}`)
                  .join(' + ') || '계산된 금액이 아직 없어요'}
                {plan.blocks.some((b) => b.key === 'startup' && b.state === 'ok') ? ' · 창업감면은 판정만(금액은 세무사와)' : ''}
                {plan.blocks.some((b) => b.key === 'policy') ? ' · 정책자금(대출)은 따로' : ''}
              </span>
            </div>

            {/* 5. 모듈별 근거 */}
            <ul className="flex flex-col gap-2" data-testid="plan-blocks">
              {plan.blocks.map((b) => (
                <PlanBlockRow key={b.key} b={b} />
              ))}
            </ul>

            {/* 6. 이렇게 진행해요 — 고른 것만 할 일로 */}
            <div className="flex flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-white px-4 py-3" data-testid="plan-actions">
              <p className="t-body font-bold text-slate-900">이렇게 진행해요</p>
              <p className="t-meta break-keep text-slate-500">체크한 것은 업체에 붙일 때 할 일로 걸려요 — 달력에 올라가고, 날이 가까우면 오늘 화면에 떠요.</p>
              <ol className="flex flex-col gap-1.5">
                {plan.actions.map((a, i) => {
                  const on = !off.has(a.id)
                  return (
                    <li key={a.id}>
                      <label className="tap flex min-w-0 cursor-pointer items-start gap-2.5 rounded-(--radius-control) px-1 py-1 hover:bg-slate-50" data-testid="plan-action" data-id={a.id} data-on={on ? '1' : '0'}>
                        <input type="checkbox" checked={on} onChange={() => toggleOff(a.id)} className="mt-1 size-4 shrink-0" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="t-sub break-keep text-slate-900 [overflow-wrap:anywhere]">
                            <b className="mr-1 font-semibold text-slate-500">{i + 1}.</b>
                            <b className="mr-1.5 font-semibold text-brand-700">[{a.when}]</b>
                            {a.text}
                          </span>
                          <span className="t-meta text-slate-500">할 일 날짜 {friendlyDate(a.date)}</span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ol>
            </div>

            {/* 7. 붙이기 · 인쇄 · 복사 · 요청 문구 */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" disabled={busy || attached?.key === key} onClick={() => void attach()} data-testid="plan-attach">
                <Paperclip aria-hidden="true" className="size-4" />
                {attached?.key === key ? '붙였어요' : busy ? '붙이는 중…' : chosen.length ? `업체에 붙이기 · 할 일 ${chosen.length}개` : '업체에 붙이기'}
              </Button>
              <Button variant="secondary" onClick={print} data-testid="plan-print">
                <Printer aria-hidden="true" className="size-4" /> 한 장 인쇄 · PDF
              </Button>
              <Button variant="ghost" onClick={() => void copy()} data-testid="plan-copy">
                <ClipboardCopy aria-hidden="true" className="size-4" /> 요약 복사
              </Button>
              {plan.request && onRequestText && (
                <Button variant="ghost" onClick={() => onRequestText(plan.request)} data-testid="plan-request">
                  <MessageSquareText aria-hidden="true" className="size-4" /> 빠진 숫자 요청 문구
                </Button>
              )}
            </div>
            {attached?.key === key && (
              <p className="t-sub flex flex-wrap items-center gap-x-2 break-keep text-success-800" role="status" data-testid="plan-attached">
                <Check aria-hidden="true" className="size-4 shrink-0" />
                업체 기록에 붙였어요
                {attached.todos ? ` — 할 일 ${attached.todos}개가 달력에 올라갔어요` : attached.asked ? ' — 고른 할 일은 앞서 붙일 때 이미 걸려 있어 다시 걸지 않았어요' : ''}.
                <Link to="?tab=overview#tool-results" className="tap font-semibold text-brand-700 hover:underline" data-testid="plan-attached-go">
                  도구 결과에서 보기
                </Link>
              </p>
            )}
            <p className="t-meta break-keep text-slate-500">{plan.assumptions.join(' · ')}</p>
          </>
        )}
      </div>
      {printing && showPlan && createPortal(<PlanPrintSheet plan={plan} companyName={record.companyName} today={today} />, document.body)}
    </Section>
    </div>
  )
}

function PlanBlockRow({ b }: { b: PlanBlock }) {
  const missing = b.needs.filter((n) => !n.ok)
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-white px-4 py-3" data-testid="plan-block" data-key={b.key} data-state={b.state}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="t-card font-bold text-slate-900">{b.label}</span>
        {/* D-244: 창업감면은 금액 없이 판정만 — '계산됨' 대신 '판정됨' */}
        <Badge tone={BLOCK_TONE[b.state]}>{b.key === 'startup' && b.state === 'ok' ? '판정됨' : BLOCK_LABEL[b.state]}</Badge>
        {b.amount && (
          <span className="t-sub ml-auto font-bold break-keep text-success-700" data-testid="plan-block-amount">
            {b.amount}
          </span>
        )}
      </div>
      <p className="t-body font-semibold break-keep text-slate-800 [overflow-wrap:anywhere]">{b.headline}</p>
      {b.lines.length > 0 && (
        <ul className="flex flex-col gap-1">
          {b.lines.map((l) => (
            <li key={l} className="t-sub flex gap-2 break-keep text-slate-700 [overflow-wrap:anywhere]">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
              <span className="min-w-0">{l}</span>
            </li>
          ))}
        </ul>
      )}
      {missing.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {missing.map((n) => (
            <li key={n.label} className="t-meta inline-flex max-w-full items-center gap-1 rounded-full border border-warning-200 bg-warning-50 px-2.5 py-1 break-keep text-warning-800">
              <Minus aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{n.label} — 없음</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link to={b.openPath} className="tap t-sub inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline" data-testid="plan-block-open">
          {b.openLabel} <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
        {b.assumptions.length > 0 && (
          <details className="min-w-0">
            <summary className="tap t-meta cursor-pointer text-slate-500">계산에 둔 가정 {b.assumptions.length}</summary>
            <ul className="mt-1 flex flex-col gap-0.5">
              {b.assumptions.map((a) => (
                <li key={a} className="t-meta break-keep text-slate-500">
                  {a}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </li>
  )
}

/** 인쇄 종이 — 화면과 같은 내용(대표님께 드릴 한 장) */
function PlanPrintSheet({ plan, companyName, today }: { plan: SituationPlan; companyName: string; today: string }) {
  return (
    <div className="print-document print-solo hidden bg-white text-slate-900 print:block" aria-hidden="true" data-testid="plan-print-sheet">
      <article className="flex flex-col gap-4 px-8 py-6">
        <header className="flex flex-col gap-1 border-b border-slate-300 pb-3">
          <p className="text-[0.85rem] text-slate-500">상황별 설계서 · {today} 기준 · 규칙 계산 1차 추정</p>
          <h1 className="text-[1.5rem] font-bold">
            {companyName} — {plan.title}
          </h1>
        </header>
        {plan.totalText && (
          <section className="avoid-break rounded border border-slate-300 px-4 py-3">
            <p className="text-[0.95rem]">1년 안에 받을 수 있는 돈(1차 추정)</p>
            <p className="text-[1.6rem] font-extrabold">{plan.totalText}</p>
            {plan.keepWon > plan.firstWon && (
              <p className="text-[0.95rem]">
                {plan.keepLabel} {plan.keepYears}년 합계 약 {manwonText(plan.keepWon)}
              </p>
            )}
          </section>
        )}
        {plan.blocks.map((b) => (
          <section key={b.key} className="avoid-break flex flex-col gap-1">
            <h2 className="text-[1.1rem] font-bold">
              {b.label} — {b.headline}
            </h2>
            <ul className="flex flex-col gap-0.5 pl-4 text-[0.95rem]">
              {b.lines.map((l) => (
                <li key={l} className="list-disc">
                  {l}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section className="avoid-break flex flex-col gap-1">
          <h2 className="text-[1.1rem] font-bold">이렇게 진행해요</h2>
          <ol className="flex flex-col gap-0.5 pl-5 text-[0.95rem]">
            {plan.actions.map((a) => (
              <li key={a.id} className="list-decimal">
                [{a.when}] {a.text}
              </li>
            ))}
          </ol>
        </section>
        <footer className="border-t border-slate-300 pt-2 text-[0.8rem] text-slate-500">
          {[...plan.assumptions, ...new Set(plan.blocks.flatMap((b) => b.assumptions))].map((a) => (
            <p key={a}>※ {a}</p>
          ))}
        </footer>
      </article>
    </div>
  )
}
