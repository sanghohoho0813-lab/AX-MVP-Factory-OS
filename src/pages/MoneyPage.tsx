/**
 * 매출 · 비용 (D-142).
 *
 *  위: 달 넘기기 · 네 숫자(들어온 돈 · 들어올 예정 · 나간 돈 · 남는 돈)
 *  매출 탭    계약 수금 항목에서 자동 — 그 달 입금 · 받을 예정 · 미수금, 앞으로 6달, 시기 미정 예상 매출
 *  비용 탭    그 달 쓴 돈 + 정기 결제 + 영업자 수수료 · 분류별 · 엑셀(CSV)
 *  정기 결제  매월/해마다 며칠 · 다음 결제일 · 한 달 · 1년 합계 · 달러 환율
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Plus, Repeat } from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { useToast } from '../components/ui/toastContext'
import { Button } from '../components/ui/Button'
import { AiSoonButton } from '../components/ui/AiSoonButton'
import { Blank, MetricTile, ScreenTitle, Section } from '../components/ui/primitives'
import { ExpenseSheet, RateSheet, SubscriptionSheet } from '../components/money/MoneySheets'
import { listClients } from '../services/clientOpsService'
import { todayLocalDate } from '../lib/appClock'
import type { ClientOpsRecord } from '../types/clientOps'
import {
  COST_CATEGORY_LABEL,
  DEFAULT_SETTINGS,
  PAY_METHOD_LABEL,
  addMonths,
  costCsv,
  daysBetween,
  isActiveSub,
  krwShort,
  moneyText,
  monthSummary,
  monthlyEquivalent,
  nextCharge,
  outlook,
  undatedRevenue,
  ymOf,
  type Expense,
  type FinanceSettings,
  type PayMethod,
  type Subscription,
} from '../services/finance/financeCore'
import { listExpenses, listSubscriptions, loadSettings, removeExpense, removeSubscription, saveExpense, saveSettings, saveSubscription } from '../services/finance/financeStore'

type Tab = 'revenue' | 'cost' | 'subs'

const ymLabel = (ym: string) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`
const md = (d: string) => (d ? `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일` : '')
const payText = (p: PayMethod) => (p ? PAY_METHOD_LABEL[p as Exclude<PayMethod, ''>] : '')

function MoneyContent({ workspaceId }: { workspaceId: string | null }) {
  const today = todayLocalDate()
  const { showToast } = useToast()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'cost' ? 'cost' : params.get('tab') === 'subs' ? 'subs' : 'revenue'
  const ym = /^\d{4}-\d{2}$/.test(params.get('m') ?? '') ? (params.get('m') as string) : ymOf(today)
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settings, setSettings] = useState<FinanceSettings>(DEFAULT_SETTINGS)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState<{ kind: 'expense'; item?: Expense } | { kind: 'sub'; item?: Subscription } | { kind: 'rate' } | null>(null)
  const [showEnded, setShowEnded] = useState(false)

  const load = useCallback(async () => {
    try {
      const [c, s, e, st] = await Promise.all([listClients(workspaceId), listSubscriptions(workspaceId), listExpenses(workspaceId), loadSettings(workspaceId)])
      setRecords(c)
      setSubs(s)
      setExpenses(e)
      setSettings(st)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '불러오지 못했습니다.')
    }
  }, [workspaceId])
  useEffect(() => {
    void load()
  }, [load])

  const input = useMemo(() => ({ records, subscriptions: subs, expenses, settings }), [records, subs, expenses, settings])
  const sum = useMemo(() => monthSummary(input, ym, today), [input, ym, today])
  const ahead = useMemo(() => outlook(input, today, 6), [input, today])
  const undated = useMemo(() => undatedRevenue(records, today), [records, today])
  const clientName = useCallback((id: string) => records.find((r) => r.id === id)?.companyName ?? '', [records])
  const isPast = ym < ymOf(today)
  const isNow = ym === ymOf(today)

  const activeSubs = subs.filter((s) => isActiveSub(s, today)).sort((a, b) => nextCharge(a, today).localeCompare(nextCharge(b, today)))
  const endedSubs = subs.filter((s) => !isActiveSub(s, today))
  const subMonthly = activeSubs.reduce((s, x) => s + monthlyEquivalent(x, settings), 0)
  const recentNames = useMemo(() => {
    const seen = new Map<string, Expense>()
    for (const e of expenses) if (!seen.has(e.name)) seen.set(e.name, e)
    return [...seen.values()].slice(0, 6).map((e) => ({ name: e.name, category: e.category }))
  }, [expenses])

  const downloadCsv = () => {
    const blob = new Blob([costCsv(sum.cost, clientName)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    // 한글 파일 이름은 일부 브라우저에서 'download' 로 바뀐다 — 어디서나 같은 영문 이름
    a.download = `expenses-${ym}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    // 바로 지우면 내려받기가 시작되기 전에 주소가 사라진다
    window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }

  const maxBar = Math.max(1, ...ahead.map((m) => Math.max(m.revenue.received + m.revenue.expected, m.cost.total)))

  return (
    <div className="flex flex-col gap-5">
      <ScreenTitle
        title="매출 · 비용"
        sub="매출은 업체 계약 · 수금에서 저절로 · 비용은 정기 결제와 쓴 돈"
        actions={
          <>
            <Button variant="primary" onClick={() => setSheet({ kind: 'expense' })} data-testid="expense-open">
              <Plus aria-hidden="true" className="size-4" /> 비용 적기
            </Button>
            <Button variant="secondary" onClick={() => setSheet({ kind: 'sub' })} data-testid="sub-open">
              <Repeat aria-hidden="true" className="size-4" /> 정기 결제 넣기
            </Button>
          </>
        }
      />

      {error && (
        <p role="alert" className="t-sub rounded-(--radius-control) border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2" data-testid="money-month">
        <button type="button" aria-label="이전 달" onClick={() => setParam('m', addMonths(ym, -1))} className="tap flex size-11 items-center justify-center rounded-(--radius-control) border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <h2 className="t-section min-w-[8.5rem] text-center text-slate-900" data-testid="money-month-label">
          {ymLabel(ym)}
        </h2>
        <button type="button" aria-label="다음 달" onClick={() => setParam('m', addMonths(ym, 1))} className="tap flex size-11 items-center justify-center rounded-(--radius-control) border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
        {!isNow && (
          <Button size="sm" variant="ghost" onClick={() => setParam('m', '')}>
            이번 달로
          </Button>
        )}
      </div>

      <section aria-label="이 달 돈" className="grid grid-cols-2 gap-2.5 xl:grid-cols-4" data-testid="money-tiles">
        <MetricTile label="들어온 돈" value={krwShort(sum.revenue.received)} hint="입금 완료(실매출)" hintOnMobile tone={sum.revenue.received > 0 ? 'success' : 'neutral'} onClick={() => setParam('tab', '')} active={tab === 'revenue'} />
        <MetricTile
          label={isPast ? '못 받고 지난 돈' : '들어올 예정'}
          value={krwShort(isPast ? sum.revenue.overdue : sum.revenue.expected)}
          hint={isPast ? '그 달에 받기로 했는데 아직 못 받은 돈' : sum.revenue.overdue > 0 ? `그중 미수금 ${krwShort(sum.revenue.overdue)}` : '받기로 한 날 기준(예상 매출)'}
          hintOnMobile
          tone={sum.revenue.overdue > 0 ? 'warning' : 'neutral'}
          onClick={() => setParam('tab', '')}
        />
        <MetricTile label="나간 돈" value={krwShort(sum.cost.total)} hint={`정기 ${krwShort(sum.cost.subscriptions)} · 쓴 돈 ${krwShort(sum.cost.expenses)}${sum.cost.agent ? ` · 수수료 ${krwShort(sum.cost.agent)}` : ''}`} hintOnMobile onClick={() => setParam('tab', 'cost')} active={tab === 'cost'} />
        <MetricTile
          label={isPast ? '남은 돈' : '남는 돈(예상)'}
          value={krwShort(isPast ? sum.netSoFar : sum.netExpected)}
          hint={isPast ? '들어온 돈 − 나간 돈' : `지금까지 ${krwShort(sum.netSoFar)}`}
          hintOnMobile
          tone={(isPast ? sum.netSoFar : sum.netExpected) < 0 ? 'danger' : 'neutral'}
        />
      </section>

      <div role="tablist" className="flex max-w-xl rounded-(--radius-control) border border-slate-200 bg-slate-50 p-0.5">
        {(
          [
            ['revenue', '매출'],
            ['cost', '비용'],
            ['subs', `정기 결제 ${activeSubs.length}`],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} data-testid={`money-tab-${k}`} onClick={() => setParam('tab', k === 'revenue' ? '' : k)} className={`tap t-body flex-1 rounded-[8px] px-3 py-2 font-semibold ${tab === k ? 'bg-white text-slate-900 shadow-(--shadow-card)' : 'text-slate-500'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'revenue' && (
        <>
          <Section title={`${Number(ym.slice(5, 7))}월 매출`} count={sum.revenue.lines.length}>
            {sum.revenue.lines.length === 0 ? (
              <Blank title={isPast ? '이 달에 들어온 돈이 없습니다.' : '이 달에 받을 돈이 없습니다. 업체 수금 탭에서 계약 · 수금을 적으면 여기 저절로 들어옵니다.'} />
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white" data-testid="revenue-list">
                {sum.revenue.lines.map((l) => (
                  <li key={`${l.clientId}:${l.feeId}`} className="flex items-start gap-3 px-4 py-3 sm:px-5" data-testid="revenue-line" data-kind={l.kind}>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link to={`/ops/clients/${l.clientId}?tab=fees`} className="tap t-body truncate font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                        {l.clientName}
                      </Link>
                      <span className="t-sub text-slate-500">
                        {l.label}
                        {l.date ? ` · ${md(l.date)}` : ' · 지금 청구할 수 있음'}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <strong className="t-body font-semibold text-slate-900 tabular-nums">{l.amount.toLocaleString('ko-KR')}원</strong>
                      <span className={`t-meta rounded-full px-2 py-0.5 font-semibold ${l.kind === 'received' ? 'bg-success-50 text-success-700' : l.kind === 'overdue' ? 'bg-danger-50 text-danger-700' : 'bg-brand-50 text-brand-700'}`}>
                        {l.kind === 'received' ? '입금 완료' : l.kind === 'overdue' ? '미수금' : '받을 예정'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="앞으로 6달 예상">
            <ul className="flex flex-col gap-2 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3 sm:px-5" data-testid="money-outlook">
              {ahead.map((m) => {
                const inn = m.revenue.received + m.revenue.expected
                return (
                  <li key={m.ym}>
                    <button type="button" onClick={() => setParam('m', m.ym)} className="tap grid w-full grid-cols-[4.5rem_1fr] items-center gap-x-3 gap-y-1 text-left">
                      <span className={`t-sub font-semibold ${m.ym === ym ? 'text-brand-700' : 'text-slate-700'}`}>{Number(m.ym.slice(5, 7))}월</span>
                      <span className="flex flex-col gap-1">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 rounded-full bg-success-500" style={{ width: `${Math.max(2, (inn / maxBar) * 100)}%` }} aria-hidden="true" />
                          <span className="t-meta whitespace-nowrap text-slate-600 tabular-nums">들어옴 {krwShort(inn)}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 rounded-full bg-slate-400" style={{ width: `${Math.max(2, (m.cost.total / maxBar) * 100)}%` }} aria-hidden="true" />
                          <span className="t-meta whitespace-nowrap text-slate-600 tabular-nums">나감 {krwShort(m.cost.total)}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="t-sub text-slate-500">미래 달의 나감은 지금 쓰는 정기 결제만 셉니다(그때그때 쓸 돈은 아직 모름).</p>
          </Section>

          {undated.total > 0 && (
            <Section title="받을 시기가 아직 안 정해진 돈" count={undated.byClient.length}>
              <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3 sm:px-5" data-testid="money-undated">
                <p className="t-body font-semibold text-slate-900">{krwShort(undated.total)}</p>
                <p className="t-sub text-slate-500">조건 대기(정책자금 조달 후 등) {krwShort(undated.waiting)} · 받을 날 미정 {krwShort(undated.undated)} · 아직 안 나눈 계약금액 {krwShort(undated.unplanned)}</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {undated.byClient.slice(0, 5).map((c) => (
                    <li key={c.clientId} className="t-sub flex items-baseline gap-2">
                      <Link to={`/ops/clients/${c.clientId}?tab=fees`} className="tap truncate font-semibold text-slate-800 hover:text-brand-700 hover:underline">
                        {c.clientName}
                      </Link>
                      <span className="truncate text-slate-500">{c.why}</span>
                      <span className="ml-auto shrink-0 tabular-nums text-slate-700">{krwShort(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
          )}
        </>
      )}

      {tab === 'cost' && (
        <>
          {sum.cost.byCategory.length > 0 && (
            <Section title="어디에 썼나">
              <ul className="flex flex-col gap-1.5 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3 sm:px-5" data-testid="cost-categories">
                {sum.cost.byCategory.map((c) => (
                  <li key={c.category} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3">
                    <span className="t-sub truncate text-slate-700">{COST_CATEGORY_LABEL[c.category]}</span>
                    <span className="h-2.5 rounded-full bg-brand-400" style={{ width: `${Math.max(3, (c.krw / Math.max(1, sum.cost.byCategory[0].krw)) * 100)}%` }} aria-hidden="true" />
                    <span className="t-sub text-right font-semibold text-slate-800 tabular-nums">{krwShort(c.krw)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section
            title={`${Number(ym.slice(5, 7))}월 나간 돈`}
            count={sum.cost.lines.length}
            action={
              sum.cost.lines.length > 0 ? (
                <Button size="sm" variant="secondary" onClick={downloadCsv} data-testid="cost-csv">
                  <Download aria-hidden="true" className="size-4" /> 엑셀(CSV)
                </Button>
              ) : undefined
            }
          >
            {sum.cost.lines.length === 0 ? (
              <Blank
                title="이 달에 적은 비용이 없습니다."
                action={
                  <Button variant="primary" onClick={() => setSheet({ kind: 'expense' })}>
                    비용 적기
                  </Button>
                }
              />
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white" data-testid="cost-list">
                {sum.cost.lines.map((l) => {
                  const exp = l.source === 'expense' ? expenses.find((e) => `exp:${e.id}` === l.id) : undefined
                  const sub = l.source === 'subscription' ? subs.find((s) => `sub:${s.id}` === l.id) : undefined
                  const open = exp ? () => setSheet({ kind: 'expense', item: exp }) : sub ? () => setSheet({ kind: 'sub', item: sub }) : undefined
                  return (
                    <li key={l.id} data-testid="cost-line" data-source={l.source}>
                      <button type="button" onClick={open} disabled={!open} className="tap flex w-full items-start gap-3 px-4 py-3 text-left enabled:hover:bg-slate-50 sm:px-5">
                        <span className="t-sub w-12 shrink-0 pt-0.5 text-slate-500 tabular-nums">{Number(l.date.slice(5, 7))}/{Number(l.date.slice(8, 10))}</span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="t-body break-keep font-semibold text-slate-900">{l.name}</span>
                          <span className="t-sub text-slate-500">
                            {COST_CATEGORY_LABEL[l.category]}
                            {l.source === 'subscription' ? ' · 정기 결제' : l.source === 'agent' ? ' · 영업자 정산' : ''}
                            {payText(l.payMethod) ? ` · ${payText(l.payMethod)}` : ''}
                            {l.clientId && l.source === 'expense' ? ` · ${clientName(l.clientId)}` : ''}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end">
                          <strong className="t-body font-semibold text-slate-900 tabular-nums">{l.krw.toLocaleString('ko-KR')}원</strong>
                          {l.currency === 'USD' && <span className="t-meta text-slate-500">{moneyText(l.amount, 'USD')}</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>
          <div className="flex flex-wrap gap-2">
            <AiSoonButton label="이 달 비용 정리해 보기" what="이 달 비용을 분류별로 요약하고 줄일 수 있는 구독을 짚어 줍니다" />
          </div>
        </>
      )}

      {tab === 'subs' && (
        <>
          <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-4" aria-label="정기 결제 합계" data-testid="subs-summary">
            <MetricTile label="매달 나가는 돈" value={krwShort(subMonthly)} hint={`쓰는 중 ${activeSubs.length}개 · 연 결제는 12로 나눔`} hintOnMobile />
            <MetricTile label="1년이면" value={krwShort(subMonthly * 12)} hint="지금 쓰는 것 그대로라면" hintOnMobile />
          </section>
          <button type="button" onClick={() => setSheet({ kind: 'rate' })} className="tap t-sub self-start text-slate-600 hover:text-brand-700" data-testid="rate-open">
            1달러 = {settings.usdKrw.toLocaleString('ko-KR')}원{settings.rateSet ? '' : ' (가정)'} · <span className="font-semibold text-brand-700 underline">환율 바꾸기</span>
          </button>
          {activeSubs.length === 0 ? (
            <Blank
              title="정기 결제가 없습니다. ChatGPT · Claude 처럼 매달 나가는 것을 넣으면 결제일 전에 오늘 화면에서 알려 드려요."
              action={
                <Button variant="primary" onClick={() => setSheet({ kind: 'sub' })}>
                  정기 결제 넣기
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white" data-testid="subs-list">
              {activeSubs.map((s) => {
                const next = nextCharge(s, today)
                const left = next ? daysBetween(today, next) : null
                return (
                  <li key={s.id} data-testid="sub-row">
                    <button type="button" onClick={() => setSheet({ kind: 'sub', item: s })} className="tap flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50 sm:px-5">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="t-body truncate font-semibold text-slate-900">{s.name}</span>
                        <span className="t-sub text-slate-500">
                          {s.cycle === 'monthly' ? `매월 ${s.billingDay}일` : `해마다 ${s.billingMonth}월 ${s.billingDay}일`} · {COST_CATEGORY_LABEL[s.category]}
                          {payText(s.payMethod) ? ` · ${payText(s.payMethod)}` : ''}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <strong className="t-body font-semibold text-slate-900 tabular-nums">{moneyText(s.amount, s.currency)}</strong>
                        {s.currency === 'USD' && <span className="t-meta text-slate-500 tabular-nums">≈ {Math.round(s.amount * settings.usdKrw).toLocaleString('ko-KR')}원</span>}
                        {next && (
                          <span className={`t-meta font-semibold ${left !== null && left <= 3 ? 'text-danger-700' : 'text-slate-500'}`} data-testid="sub-next">
                            다음 {md(next)}
                            {left === 0 ? ' · 오늘' : left !== null && left <= 7 ? ` · D-${left}` : ''}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {endedSubs.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowEnded((v) => !v)} className="tap t-sub font-semibold text-slate-500" aria-expanded={showEnded}>
                해지한 것 {endedSubs.length}개 {showEnded ? '접기' : '보기'}
              </button>
              {showEnded && (
                <ul className="mt-2 flex flex-col divide-y divide-slate-100 rounded-(--radius-panel) border border-slate-200 bg-white opacity-80">
                  {endedSubs.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => setSheet({ kind: 'sub', item: s })} className="tap flex w-full items-center gap-3 px-4 py-3 text-left">
                        <span className="t-body flex-1 truncate text-slate-700">{s.name}</span>
                        <span className="t-sub text-slate-500">{md(s.endDate)} 해지</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {sheet?.kind === 'expense' && (
        <ExpenseSheet
          initial={sheet.item}
          today={today}
          settings={settings}
          recentNames={recentNames}
          clients={records.filter((r) => !r.archivedAt).map((r) => ({ id: r.id, name: r.companyName }))}
          onClose={() => setSheet(null)}
          onSave={async (v) => {
            // D-149: 달러 비용은 적는 순간의 환율을 함께 남긴다(고칠 때는 처음 환율 그대로 — 통화를 바꿨으면 지금 환율)
            const rate = v.currency === 'USD' ? (sheet.item?.currency === 'USD' && sheet.item.usdKrw ? sheet.item.usdKrw : settings.usdKrw) : undefined
            const saved = await saveExpense(workspaceId, { ...v, ...(rate ? { usdKrw: rate } : {}), id: sheet.item?.id, createdAt: sheet.item?.createdAt })
            setExpenses((prev) => [saved, ...prev.filter((x) => x.id !== saved.id)].sort((a, b) => b.date.localeCompare(a.date)))
            setSheet(null)
            if (ymOf(saved.date) !== ym) setParam('m', ymOf(saved.date))
            showToast(`${saved.name} ${moneyText(saved.amount, saved.currency)} 적었습니다`)
          }}
          onDelete={
            sheet.item
              ? async () => {
                  const it = sheet.item as Expense
                  await removeExpense(workspaceId, it.id)
                  setExpenses((prev) => prev.filter((x) => x.id !== it.id))
                  setSheet(null)
                  showToast('비용을 지웠습니다')
                }
              : undefined
          }
        />
      )}
      {sheet?.kind === 'sub' && (
        <SubscriptionSheet
          initial={sheet.item}
          today={today}
          settings={settings}
          onClose={() => setSheet(null)}
          onSave={async (v) => {
            const saved = await saveSubscription(workspaceId, { ...v, id: sheet.item?.id, createdAt: sheet.item?.createdAt })
            setSubs((prev) => [saved, ...prev.filter((x) => x.id !== saved.id)])
            setSheet(null)
            const n = nextCharge(saved, today)
            showToast(saved.endDate ? `${saved.name} 해지로 적었습니다` : `${saved.name} — 다음 결제 ${md(n)}`)
          }}
          onDelete={
            sheet.item
              ? async () => {
                  const it = sheet.item as Subscription
                  await removeSubscription(workspaceId, it.id)
                  setSubs((prev) => prev.filter((x) => x.id !== it.id))
                  setSheet(null)
                  showToast('정기 결제를 지웠습니다')
                }
              : undefined
          }
        />
      )}
      {sheet?.kind === 'rate' && (
        <RateSheet
          settings={settings}
          onClose={() => setSheet(null)}
          onSave={async (s) => {
            setSettings(await saveSettings(workspaceId, s))
            setSheet(null)
            showToast(`1달러 = ${s.usdKrw.toLocaleString('ko-KR')}원으로 셉니다`)
          }}
        />
      )}
    </div>
  )
}

export default function MoneyPage() {
  return <WorkspaceScope>{(ctx) => <MoneyContent workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}
