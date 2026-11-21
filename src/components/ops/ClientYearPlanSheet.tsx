/**
 * D-640 업체 1년 자금 일정표 — 이번 달부터 12달, 언제 무엇을 하면 되는지 한 장(미리 보기 · 인쇄 · PDF · 카톡 요약).
 * 맞춤 진단서(D-352)와 같은 틀: 화면은 Modal(달마다 한 줄 → 누르면 그 달 일), 종이는 body 바로 아래 .print-document.print-solo(12달 전부).
 * 계산은 services/yearPlan(규칙 · 새로 판정하지 않음). 고객에게 드리는 종이 — 수수료 · 내부 약속 · 메모는 들어가지 않는다.
 */
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, Copy, ListTodo, Printer } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { Insight } from '../../services/clientInsights'
import type { GrantNotice } from '../../services/grants/grantMatch'
import { matchesFor } from '../../services/grants/grantMatch'
import { profileOfRecord } from '../../services/grants/grantProfile'
import { buildYearPlan, yearItemText, yearPlanKakao, yearTodoChoices, type YearItem, type YearPlan } from '../../services/yearPlan'
import { createJournalEntry, listJournal } from '../../services/journalService'
import { useSenderLine } from '../layout/useCurrentUser'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { copyText } from '../consulting/studioParts'
import { useToast } from '../ui/toastContext'

const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`

function ItemRow({ x, onGo, todo }: { x: YearItem; onGo?: () => void; todo?: boolean }) {
  return (
    <li className="flex min-w-0 items-start gap-2.5 py-2" data-testid="year-item" data-kind={x.kind} data-hard={x.hard ? '1' : undefined}>
      <span className={`t-meta mt-0.5 w-12 shrink-0 font-bold tabular-nums ${x.late ? 'text-danger-700' : 'text-slate-600'}`}>{x.late ? '늦음' : x.date ? md(x.date) : '이번 달'}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="t-sub font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">
          {x.title}
          {x.hard && <span className="t-meta ml-1.5 font-bold whitespace-nowrap text-danger-700">놓치면 끝</span>}
          {!x.hard && x.approx && <span className="t-meta ml-1.5 font-semibold whitespace-nowrap text-slate-500">확인</span>}
          {todo && <span className="t-meta ml-1.5 font-semibold whitespace-nowrap text-brand-700" data-testid="year-item-todo">할 일 ✓</span>}
        </span>
        {x.detail && <span className="t-meta break-keep text-slate-600 [overflow-wrap:anywhere]">{x.detail}</span>}
      </span>
      {x.path && onGo && (
        <Link to={x.path} onClick={onGo} className="tap t-meta inline-flex shrink-0 items-center gap-0.5 self-center font-semibold text-brand-700 hover:underline" data-testid="year-item-open">
          열기 <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      )}
    </li>
  )
}

/** 종이 — 12달 전부(일 없는 달은 '—') */
function YearPlanDocument({ p, sender }: { p: YearPlan; sender: string }) {
  return (
    <article className="px-8 py-6" data-testid="year-plan-print">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-brand-700 pb-2">
        <div className="min-w-0">
          <p className="text-[0.875rem] font-semibold text-brand-700">앞으로 1년 자금 일정</p>
          <h2 className="text-[1.5rem] font-bold break-keep text-slate-900">{p.companyName} 1년 자금 일정표</h2>
        </div>
        <p className="text-[0.875rem] text-slate-600">{p.range}</p>
      </header>
      <table className="mt-4 w-full border-collapse text-[0.9375rem]">
        <tbody>
          {p.months.map((m) => (
            <tr key={m.key} className="avoid-break border-b border-slate-200 align-top">
              <th className="w-24 py-2 pr-3 text-left font-bold whitespace-nowrap text-slate-800">{m.label}</th>
              <td className="py-2">
                {m.items.length === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {m.items.map((x) => (
                      <li key={x.id} className="break-keep text-slate-800">
                        {yearItemText(x)}
                        {x.detail && <span className="text-[0.8125rem] text-slate-500"> — {x.detail}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer className="mt-6 flex flex-col gap-0.5 border-t border-slate-200 pt-2 text-[0.8rem] text-slate-500">
        {p.notes.map((n) => (
          <p key={n}>※ {n}</p>
        ))}
        {sender && <p className="mt-1 font-semibold text-slate-600">{sender}</p>}
      </footer>
    </article>
  )
}

export function ClientYearPlanSheet({
  record,
  insights,
  notices,
  today,
  onClose,
  todo,
}: {
  record: ClientOpsRecord
  insights: readonly Insight[]
  /** 지원사업 알림을 쓸 수 있는 계정만 — 아니면 빈 목록 */
  notices: readonly GrantNotice[]
  today: string
  onClose: () => void
  /** D-642 고른 일을 업무 일기 할 일로 — 작업공간 · 적는 사람(없으면 단추 없음) */
  todo?: { workspaceId: string | null; userId: string | null }
}) {
  const sender = useSenderLine()
  const { showToast } = useToast()
  const matches = useMemo(() => (notices.length ? matchesFor(notices, profileOfRecord(record, today), today, { includeUpcoming: true }) : []), [notices, record, today])
  const plan = useMemo(() => buildYearPlan(record, insights, matches, today), [record, insights, matches, today])
  // 한 번에 한 달만 펼친다(처음엔 모두 접힌 채 — 달마다 건수 · 놓치면 끝 수만)
  const [open, setOpen] = useState<string | null>(null)
  // D-642 할 일로 걸기 — 고르는 판(같은 창 안 다음 단계)
  const choices = useMemo(() => yearTodoChoices(plan, today), [plan, today])
  const [pick, setPick] = useState<Set<string> | null>(null)
  const [more, setMore] = useState(false)
  const [already, setAlready] = useState<Set<string>>(new Set())
  const [made, setMade] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const startPick = async () => {
    let have = new Set<string>()
    try {
      const js = await listJournal(todo?.workspaceId ?? null)
      have = new Set(js.filter((j) => j.clientId === record.id && !j.completed && j.entryType === 'follow_up').map((j) => j.content.trim()))
    } catch {
      // 못 읽어도 고를 수는 있다(같은 할 일이 두 번 걸릴 수 있음)
    }
    setAlready(have)
    setPick(new Set(choices.filter((c) => c.todo.preselect && !have.has(c.todo.content) && !made.has(c.item.id)).map((c) => c.item.id)))
    setMore(false)
  }
  const save = async () => {
    if (!pick || busy) return
    const list = choices.filter((c) => pick.has(c.item.id))
    if (!list.length) return
    setBusy(true)
    let ok = 0
    const done = new Set(made)
    try {
      for (const c of list) {
        await createJournalEntry(todo?.workspaceId ?? null, todo?.userId ?? null, { entryDate: today, entryType: 'follow_up', content: c.todo.content, clientId: record.id, dueDate: c.todo.dueDate })
        ok += 1
        done.add(c.item.id)
      }
      showToast(`할 일 ${ok}개를 걸었어요 — 오늘 · 일정에 떠요`)
      setPick(null)
    } catch (cause) {
      showToast(`${ok ? `${ok}개는 걸었고, ` : ''}${cause instanceof Error ? cause.message : '할 일을 걸지 못했어요'} — 다시 눌러 주세요`)
    } finally {
      setMade(done)
      setBusy(false)
    }
  }
  const shown = pick ? (more ? choices : choices.slice(0, 5)) : []
  const pickedCount = pick ? choices.filter((c) => pick.has(c.item.id)).length : 0
  return (
    <>
      <Modal
        open
        size="lg"
        title={pick ? '할 일로 걸기' : '1년 자금 일정표'}
        onClose={onClose}
        footer={
          pick ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setPick(null)} data-testid="year-todo-back">
                돌아가기
              </Button>
              <Button variant="primary" disabled={busy || pickedCount === 0} onClick={() => void save()} data-testid="year-todo-save">
                <ListTodo aria-hidden="true" className="size-4" /> {pickedCount ? `${pickedCount}개 할 일로 걸기` : '고른 일이 없어요'}
              </Button>
            </div>
          ) : (
          <div className="flex flex-wrap justify-end gap-2">
            {todo && plan.total > 0 && (
              <Button variant="secondary" data-testid="year-plan-todo" data-guide="fn-year-plan-todo" onClick={() => void startPick()}>
                <ListTodo aria-hidden="true" className="size-4" /> 할 일로 걸기
              </Button>
            )}
            <Button
              variant="secondary"
              data-testid="year-plan-kakao"
              onClick={async () => {
                if (!(await copyText(yearPlanKakao(plan, sender)))) return showToast('복사하지 못했어요 — 다시 눌러 주세요')
                showToast('1년 일정을 복사했어요 — 카톡에 붙여 넣으세요')
              }}
            >
              <Copy aria-hidden="true" className="size-4" /> 카톡 요약
            </Button>
            <Button variant="primary" data-testid="year-plan-print-button" onClick={() => window.print()}>
              <Printer aria-hidden="true" className="size-4" /> 인쇄 · PDF로 저장
            </Button>
          </div>
          )
        }
      >
        {pick ? (
          <div className="flex flex-col gap-3" data-testid="year-todo-pick">
            <p className="t-sub break-keep text-slate-700">놓치면 끝 · 다음 달까지 할 일은 골라 뒀어요.</p>
            <ul className="flex flex-col divide-y divide-slate-200 rounded-(--radius-control) border border-slate-200 bg-white">
              {shown.map((c) => {
                const dup = already.has(c.todo.content) || made.has(c.item.id)
                const on = pick.has(c.item.id)
                return (
                  <li key={c.item.id} data-testid="year-todo-row" data-dup={dup ? '1' : undefined}>
                    <label className={`flex min-h-11 items-center gap-2.5 px-3.5 py-2 ${dup ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        className="size-5 shrink-0"
                        checked={on}
                        disabled={dup}
                        onChange={() =>
                          setPick((cur) => {
                            const n = new Set(cur ?? [])
                            if (n.has(c.item.id)) n.delete(c.item.id)
                            else n.add(c.item.id)
                            return n
                          })
                        }
                        aria-label={`${c.item.title} 할 일로`}
                      />
                      <span className="t-meta w-12 shrink-0 font-bold tabular-nums text-slate-600">{md(c.todo.dueDate)}</span>
                      <span className={`t-sub min-w-0 flex-1 truncate ${dup ? 'text-slate-400' : 'font-semibold text-slate-800'}`}>{c.item.title}</span>
                      {dup ? (
                        <span className="t-meta shrink-0 font-semibold text-slate-500">이미 할 일</span>
                      ) : c.item.hard ? (
                        <span className="t-meta shrink-0 font-bold text-danger-700">놓치면 끝</span>
                      ) : null}
                    </label>
                  </li>
                )
              })}
            </ul>
            {!more && choices.length > 5 && (
              <button type="button" className="tap t-sub self-start font-semibold text-brand-700 hover:underline" onClick={() => setMore(true)} data-testid="year-todo-more">
                {choices.length - 5}개 더 보기
              </button>
            )}
          </div>
        ) : (
        <div className="flex flex-col gap-3" data-testid="year-plan">
          <p className="t-sub break-keep text-slate-700" data-testid="year-plan-summary">
            {plan.range} · 할 일 {plan.total}개{plan.hardCount > 0 && <span className="font-bold text-danger-700"> · 놓치면 끝 {plan.hardCount}개</span>}
          </p>
          {plan.total === 0 && (
            <p className="t-sub rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 break-keep text-slate-600" data-testid="year-plan-empty">
              아직 정해진 기한 · 제안이 없어요 — 서류를 올리면 판정과 일정이 같이 채워져요.
            </p>
          )}
          <ol className="flex flex-col divide-y divide-slate-200 rounded-(--radius-control) border border-slate-200 bg-white" data-testid="year-months">
            {plan.months.map((m) => {
              const on = open === m.key
              return (
                <li key={m.key} data-testid="year-month" data-key={m.key} data-count={m.items.length}>
                  <button
                    type="button"
                    onClick={() => setOpen(on ? null : m.key)}
                    disabled={m.items.length === 0}
                    aria-expanded={m.items.length ? on : undefined}
                    className="tap flex w-full min-w-0 items-center gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className="t-body w-24 shrink-0 font-bold text-slate-900">{m.label}</span>
                    <span className={`t-sub min-w-0 flex-1 truncate ${m.items.length ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>{m.items.length ? `${m.items.length}건` : '—'}</span>
                    {m.hardCount > 0 && <span className="t-meta shrink-0 font-bold text-danger-700">놓치면 끝 {m.hardCount}</span>}
                    {m.items.length > 0 && <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-slate-500 transition-transform ${on ? 'rotate-180' : ''}`} />}
                  </button>
                  {on && (
                    <ul className="divide-y divide-slate-100 px-3.5 pb-1" data-testid="year-month-items">
                      {m.items.map((x) => (
                        <ItemRow key={x.id} x={x} onGo={onClose} todo={made.has(x.id)} />
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>
          <p className="t-meta break-keep text-slate-500">대표님께 드리는 종이예요 — 수수료 · 내부 메모는 들어가지 않아요. &apos;확인&apos; 은 해마다 비슷한 때라 공고 · 세무사와 한 번 더 봐요.</p>
        </div>
        )}
      </Modal>
      {createPortal(
        <div className="print-document print-solo hidden bg-white text-slate-900 print:block" aria-hidden="true">
          <YearPlanDocument p={plan} sender={sender} />
        </div>,
        document.body,
      )}
    </>
  )
}
