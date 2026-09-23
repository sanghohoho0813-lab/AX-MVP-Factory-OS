/**
 * 영업 — 고객사·발굴·다음 연락·파이프라인·성과 (D-91).
 *
 * 다섯 화면이 같은 기록(모듈 기록 `sales-kit`/`accounts`)을 본다. 그래서 한 파일에 둔다.
 * 업체는 만들지 않는다 — 고객 운영의 업체를 그대로 쓰고 영업 상태만 얹는다.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SalesReportsScreen } from './SalesCardScreen'
import { toSalesItem } from '../lib/salesItem'
import { followUpKakao, focusCustomersOf, manToText, recontactListOf, riskSignalsOf, todayProposalRows, topicKakao } from '../lib/salesDocs.js'
import { PERIOD_OPTIONS, analyticsFunnel, buildCSV, csvAnalytics, csvCustomers, csvFollowups, csvProducts, deltaInfo, feeMoney, filterDataByPeriod, getGoals, monthCompare, monthLabel, monthlyTrend, periodLabel, periodRange, productMonthlyCompare, productPerformance, salesMetrics, type AnalyticsData } from '../lib/salesAnalytics.js'
import { PKG_CATEGORIES, recommendedStrategiesFor, scoreLead, type SalesItem } from '../lib/salesData.js'
import type { SalesDocsData } from '../lib/salesDocs.js'
import { Building2, Clock, Download, Target } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge, MetricTile, Section, Surface, type Tone } from '../../../components/ui/primitives'
import { useToast } from '../../../components/ui/toastContext'
import { useToolClient } from '../../shared/toolClientContext'
import { useModuleBucket, type BucketRow } from '../../shared/useModuleBucket'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { todayLocalDate } from '../../../lib/appClock'
import { krwTile } from '../../../lib/format'
import {
  PIPE6_ALL,
  SALES_STAGES,
  STAGE_LABEL,
  conversionRate,
  funnelOf,
  pipe6Of,
  type SalesStage,
} from '../lib/pipeline'
import {
  INTERESTS,
  SOURCES,
  accountsCsv,
  emptyAccount,
  followUpOf,
  summarizeAccounts,
  toAccount,
  type AccountData,
} from '../lib/salesAccounts'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

/* ------------------------------------------------------------------ */
/* 공통 — 업체 + 영업 상태를 함께 읽는다                                  */
/* ------------------------------------------------------------------ */

interface SalesData {
  clients: ClientOpsRecord[]
  rows: BucketRow<AccountData>[]
  accountOf: Map<string, { id: string; data: AccountData }>
  today: string
  save: (clientId: string, next: Partial<AccountData>) => Promise<void>
  ready: boolean
}

function useSalesAccounts(): SalesData {
  const { loadClients } = useToolClient()
  const bucket = useModuleBucket<AccountData>('sales-kit', 'accounts')
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)

  useEffect(() => {
    let alive = true
    void loadClients().then((list) => {
      if (alive) setClients(list.filter((c) => c.archivedAt === null))
    })
    return () => {
      alive = false
    }
  }, [loadClients])

  const accountOf = useMemo(() => {
    const map = new Map<string, { id: string; data: AccountData }>()
    for (const r of bucket.rows ?? []) map.set(r.clientId, { id: r.id, data: toAccount(r.data) })
    return map
  }, [bucket.rows])

  const save = async (clientId: string, next: Partial<AccountData>) => {
    const cur = accountOf.get(clientId)
    await bucket.save({ id: cur?.id, clientId, data: { ...(cur?.data ?? emptyAccount()), ...next } })
  }

  return {
    clients: clients ?? [],
    rows: bucket.rows ?? [],
    accountOf,
    today: todayLocalDate(),
    save,
    ready: clients !== null && bucket.rows !== null,
  }
}

function Loading() {
  return <p className="t-sub text-slate-400">영업 기록을 읽는 중…</p>
}

function StageSelect({ value, onChange, label }: { value: SalesStage; onChange: (v: SalesStage) => void; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as SalesStage)} className={inputCls}>
      {SALES_STAGES.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  )
}

/* ------------------------------------------------------------------ */
/* 리포트·제안서 — 업체별 영업 카드 (D-92)                                */
/* ------------------------------------------------------------------ */

export function SalesReportsSection() {
  const d = useSalesAccounts()
  const { clientId } = useToolClient()
  const [params] = useSearchParams()
  const profile = useModuleBucket<SalesDocsData>('sales-kit', 'profile')
  if (!d.ready) return <Loading />
  const docsData: SalesDocsData = profile.rows?.[0]?.data ?? {}
  return <SalesReportsScreen clients={d.clients} accountOf={d.accountOf} saveFor={d.save} data={docsData} initialId={params.get('card') ?? clientId} />
}

/* ------------------------------------------------------------------ */
/* ① 고객사 관리                                                        */
/* ------------------------------------------------------------------ */

export function SalesCompaniesScreen() {
  const d = useSalesAccounts()
  const [open, setOpen] = useState<string | null>(null)
  if (!d.ready) return <Loading />

  const sum = summarizeAccounts(
    [...d.accountOf.entries()].map(([clientId, v]) => ({ clientId, data: v.data })),
    d.today,
  )

  return (
    <div className="flex flex-col gap-5" data-testid="sales-companies">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="업체" value={`${d.clients.length}곳`} hint="고객 운영에 있는 업체" />
        <MetricTile label="영업 중" value={`${sum.live}곳`} tone={sum.live > 0 ? 'brand' : 'neutral'} />
        <MetricTile label="계약 완료" value={`${sum.contracted}곳`} tone={sum.contracted > 0 ? 'success' : 'neutral'} />
        <MetricTile label="예상 수수료" value={krwTile(sum.pipelineFee)} hint="진행 중인 건" />
      </div>

      <Section title="업체" count={d.clients.length}>
        <ul className="flex flex-col gap-2" data-testid="sales-company-list">
          {d.clients.map((c) => {
            const acc = d.accountOf.get(c.id)?.data ?? emptyAccount()
            const has = d.accountOf.has(c.id)
            const editing = open === c.id
            return (
              <li key={c.id}>
                <Surface as="div" edge={has ? 'brand' : 'neutral'} showEdge={has}>
                  <div className="flex flex-col gap-2" data-client={c.id}>
                    <button type="button" onClick={() => setOpen(editing ? null : c.id)} className="tap flex flex-wrap items-center gap-x-3 gap-y-1 text-left">
                      <Building2 aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                      <span className="t-sub font-bold text-slate-900">{c.companyName}</span>
                      <Badge tone={acc.stage === 'contracted' ? 'success' : has ? 'brand' : 'neutral'}>{STAGE_LABEL[acc.stage]}</Badge>
                      {acc.interests.length > 0 && <span className="t-meta text-slate-500">{acc.interests.join(' · ')}</span>}
                      {acc.expectedFee > 0 && <span className="t-meta text-slate-500">{krwTile(acc.expectedFee)}</span>}
                      <span className="t-meta ml-auto text-slate-400">{editing ? '접기' : '펼치기'}</span>
                    </button>

                    {editing && (
                      <div className="flex flex-col gap-2 border-t border-slate-100 pt-2">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <StageSelect label={`${c.companyName} 단계`} value={acc.stage} onChange={(v) => void d.save(c.id, { stage: v })} />
                          <select
                            aria-label={`${c.companyName} 유입`}
                            value={acc.source}
                            onChange={(e) => void d.save(c.id, { source: e.target.value })}
                            className={inputCls}
                          >
                            <option value="">유입 경로</option>
                            {SOURCES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <input
                            aria-label={`${c.companyName} 예상 수수료`}
                            inputMode="numeric"
                            defaultValue={acc.expectedFee || ''}
                            onBlur={(e) => void d.save(c.id, { expectedFee: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
                            placeholder="예상 수수료(원)"
                            className={`${inputCls} text-right tabular-nums`}
                          />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="block">
                            <span className="t-meta text-slate-500">마지막 연락</span>
                            <input
                              type="date"
                              aria-label={`${c.companyName} 마지막 연락`}
                              defaultValue={acc.lastContactedAt}
                              onBlur={(e) => void d.save(c.id, { lastContactedAt: e.target.value })}
                              className={inputCls}
                            />
                          </label>
                          <label className="block">
                            <span className="t-meta text-slate-500">다음 연락</span>
                            <input
                              type="date"
                              aria-label={`${c.companyName} 다음 연락`}
                              defaultValue={acc.nextContactAt}
                              onBlur={(e) => void d.save(c.id, { nextContactAt: e.target.value })}
                              className={inputCls}
                            />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {INTERESTS.map((it) => {
                            const on = acc.interests.includes(it)
                            return (
                              <button
                                key={it}
                                type="button"
                                aria-pressed={on}
                                onClick={() => void d.save(c.id, { interests: on ? acc.interests.filter((x) => x !== it) : acc.interests.concat([it]) })}
                                className={`tap rounded-full border px-2.5 py-1 t-meta ${
                                  on ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-500'
                                }`}
                              >
                                {it}
                              </button>
                            )
                          })}
                        </div>
                        <textarea
                          aria-label={`${c.companyName} 메모`}
                          rows={2}
                          defaultValue={acc.memo}
                          onBlur={(e) => void d.save(c.id, { memo: e.target.value })}
                          placeholder="통화 내용·다음에 할 말"
                          className={inputCls}
                        />
                        <div className="flex flex-wrap gap-3">
                          <Link to={`/tools/sales-kit/reports?card=${c.id}`} className="t-sub font-bold text-brand-700 hover:underline" data-testid="sales-open-card">
                            영업 카드 열기 — 방문 리포트·제안서·견적·계약 준비
                          </Link>
                          <Link to={`/ops/clients/${c.id}`} className="t-meta text-brand-700 hover:underline">
                            업체 기록 보기
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </Surface>
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ② 신규 고객 발굴 — 아직 영업을 시작하지 않은 업체                       */
/* ------------------------------------------------------------------ */

export function ProspectingScreen() {
  const d = useSalesAccounts()
  const { showToast } = useToast()
  if (!d.ready) return <Loading />

  const fresh = d.clients.filter((c) => !d.accountOf.has(c.id))

  return (
    <div className="flex flex-col gap-5" data-testid="sales-prospecting">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <MetricTile label="아직 안 만난 업체" value={`${fresh.length}곳`} tone={fresh.length > 0 ? 'warning' : 'success'} />
        <MetricTile label="영업 시작한 업체" value={`${d.accountOf.size}곳`} tone="brand" />
        <MetricTile label="전체" value={`${d.clients.length}곳`} hint="고객 운영 기준" />
      </div>

      {fresh.length === 0 ? (
        <Surface edge="success" showEdge>
          <p className="t-sub break-keep text-slate-600">고객 운영의 업체는 모두 영업이 시작됐습니다.</p>
        </Surface>
      ) : (
        <Section title="발굴 대상" count={fresh.length}>
          <ul className="flex flex-col gap-2" data-testid="sales-prospect-list">
            {fresh.map((c) => (
              <li key={c.id}>
                <Surface as="div" edge="warning" showEdge>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Target aria-hidden="true" className="size-4 shrink-0 text-amber-500" />
                    <span className="t-sub font-bold text-slate-900">{c.companyName}</span>
                    {c.industry && <span className="t-meta text-slate-500">{c.industry}</span>}
                    {c.employeeCount && <span className="t-meta text-slate-500">직원 {c.employeeCount}</span>}
                    <span className="ml-auto flex gap-2">
                      <Link to={`/tools/sales-kit/meeting?client=${c.id}`} className="t-meta text-brand-700 hover:underline">
                        미팅 대본 만들기
                      </Link>
                      <Button
                        size="sm"
                        data-start={c.id}
                        onClick={async () => {
                          await d.save(c.id, { stage: 'contacted', lastContactedAt: d.today })
                          showToast(`${c.companyName} 영업을 시작했습니다.`)
                        }}
                      >
                        영업 시작
                      </Button>
                    </span>
                  </div>
                </Surface>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ③ 다음 연락 관리                                                     */
/* ------------------------------------------------------------------ */

export function FollowUpScreen() {
  const d = useSalesAccounts()
  if (!d.ready) return <Loading />

  const rows = [...d.accountOf.entries()]
    .map(([clientId, v]) => ({
      clientId,
      name: d.clients.find((c) => c.id === clientId)?.companyName ?? '업체',
      data: v.data,
      follow: followUpOf(clientId, v.data, d.today),
    }))
    .filter((r) => pipe6Of(r.data.stage) !== 'hold' && r.data.stage !== 'contracted')

  const groups: { key: string; label: string; tone: Tone; items: typeof rows }[] = [
    { key: 'over', label: '지난 연락', tone: 'danger', items: rows.filter((r) => r.follow.kind === '지남') },
    { key: 'today', label: '오늘 연락', tone: 'warning', items: rows.filter((r) => r.follow.kind === '오늘') },
    { key: 'soon', label: '예정', tone: 'brand', items: rows.filter((r) => r.follow.kind === '예정') },
    { key: 'none', label: '날짜를 안 잡은 곳', tone: 'neutral', items: rows.filter((r) => r.follow.kind === '날짜 없음') },
  ]

  return (
    <div className="flex flex-col gap-5" data-testid="sales-followup">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {groups.map((g) => (
          <MetricTile key={g.key} label={g.label} value={`${g.items.length}곳`} tone={g.items.length > 0 ? g.tone : 'neutral'} />
        ))}
      </div>

      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <Section key={g.key} title={g.label} count={g.items.length}>
            <ul className="flex flex-col gap-2" data-group={g.key}>
              {g.items.map((r) => (
                <li key={r.clientId}>
                  <Surface as="div" edge={g.tone} showEdge={g.tone !== 'neutral'}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Clock aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                      <span className="t-sub font-bold text-slate-900">{r.name}</span>
                      <Badge tone="neutral">{STAGE_LABEL[r.data.stage]}</Badge>
                      <span className="t-sub min-w-0 flex-1 break-keep text-slate-600">{r.data.memo || '메모 없음'}</span>
                      <input
                        type="date"
                        aria-label={`${r.name} 다음 연락`}
                        defaultValue={r.data.nextContactAt}
                        onBlur={(e) => void d.save(r.clientId, { nextContactAt: e.target.value })}
                        className="rounded-(--radius-control) border border-slate-300 bg-white px-2 py-1 t-meta text-slate-700"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void d.save(r.clientId, { lastContactedAt: d.today, nextContactAt: '' })}
                      >
                        오늘 연락함
                      </Button>
                    </div>
                    {(() => {
                      const client = d.clients.find((c) => c.id === r.clientId)
                      if (!client) return null
                      const it = toSalesItem(client, r.data)
                      return (
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="t-meta text-slate-500">
                            점수 {scoreLead(it)} · {(it.interests ?? []).slice(0, 2).join(', ') || '니즈 미입력'} · 다음 액션: {String(it.nextAction || recommendedStrategiesFor(it)[0]?.name || '점검')}
                          </span>
                          <button type="button" className="t-meta font-bold text-brand-700 hover:underline" onClick={() => void navigator.clipboard?.writeText(followUpKakao(it)).catch(() => undefined)}>
                            💬 다음 연락 문구 복사
                          </button>
                          <Link to={`/tools/sales-kit/reports?card=${r.clientId}`} className="t-meta text-brand-700 hover:underline">
                            영업 카드
                          </Link>
                        </div>
                      )
                    })()}
                  </Surface>
                </li>
              ))}
            </ul>
          </Section>
        ))}

      {(() => {
        const recent = [...d.accountOf.entries()]
          .map(([clientId, v]) => ({ clientId, name: d.clients.find((c) => c.id === clientId)?.companyName ?? '업체', contacts: (v.data.contacts as Array<{ date: string; type: string; memo: string }> | undefined) ?? [] }))
          .filter((x) => x.contacts.length > 0)
          .sort((a, b) => (b.contacts[0]?.date ?? '').localeCompare(a.contacts[0]?.date ?? ''))
          .slice(0, 12)
        if (!recent.length) return null
        return (
          <Section title="📒 최근 연락 이력 있는 고객" count={recent.length}>
            <ul className="flex flex-col gap-1.5" data-group="recent">
              {recent.map((x) => (
                <li key={x.clientId} className="t-sub flex flex-wrap gap-2 text-slate-700">
                  <Link to={`/tools/sales-kit/reports?card=${x.clientId}`} className="font-bold text-slate-900 hover:underline">
                    {x.name}
                  </Link>
                  <span className="text-slate-500">
                    {x.contacts[0].date.replace(/-/g, '.')} · {x.contacts[0].type}
                    {x.contacts[0].memo ? ` — ${x.contacts[0].memo}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )
      })()}

      {rows.length === 0 && (
        <Surface>
          <p className="t-sub break-keep text-slate-600">
            아직 영업을 시작한 업체가 없습니다.{' '}
            <Link to="/tools/sales-kit/prospecting" className="font-bold text-brand-700 hover:underline">
              신규 고객 발굴
            </Link>{' '}
            에서 시작하세요.
          </p>
        </Surface>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ④ 영업 진행 현황 (6단계 보드)                                         */
/* ------------------------------------------------------------------ */

export function PipelineScreen() {
  const d = useSalesAccounts()
  if (!d.ready) return <Loading />

  const rows = [...d.accountOf.entries()].map(([clientId, v]) => ({
    clientId,
    name: d.clients.find((c) => c.id === clientId)?.companyName ?? '업체',
    data: v.data,
  }))
  const sum = summarizeAccounts(rows.map((r) => ({ clientId: r.clientId, data: r.data })), d.today)

  return (
    <div className="flex flex-col gap-5" data-testid="sales-pipeline">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="진행 중" value={`${sum.live}곳`} tone={sum.live > 0 ? 'brand' : 'neutral'} />
        <MetricTile label="계약 완료" value={`${sum.contracted}곳`} tone={sum.contracted > 0 ? 'success' : 'neutral'} />
        <MetricTile label="예상 수수료" value={krwTile(sum.pipelineFee)} />
        <MetricTile label="지난 연락" value={`${sum.overdue}곳`} tone={sum.overdue > 0 ? 'danger' : 'neutral'} />
      </div>

      {rows.length === 0 ? (
        <Surface>
          <p className="t-sub break-keep text-slate-600">보드에 올라온 업체가 없습니다. 신규 고객 발굴에서 영업을 시작하세요.</p>
        </Surface>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {PIPE6_ALL.map((col) => {
            const items = rows.filter((r) => pipe6Of(r.data.stage) === col.key)
            return (
              <div key={col.key} className="flex w-[16rem] shrink-0 flex-col gap-2" data-column={col.key}>
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="t-sub font-bold text-slate-800">{col.label}</span>
                  <span className="t-meta rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{items.length}</span>
                </div>
                <p className="t-meta break-keep px-1 text-slate-400">{col.desc}</p>
                <div className="flex flex-col gap-2">
                  {items.map((r) => (
                    <Surface key={r.clientId} as="div">
                      <div className="flex flex-col gap-1.5">
                        <span className="t-sub font-bold text-slate-900">{r.name}</span>
                        <span className="t-meta text-slate-500">{STAGE_LABEL[r.data.stage]}</span>
                        {r.data.expectedFee > 0 && <span className="t-meta text-slate-500">{krwTile(r.data.expectedFee)}</span>}
                        <StageSelect label={`${r.name} 단계 옮기기`} value={r.data.stage} onChange={(v) => void d.save(r.clientId, { stage: v })} />
                      </div>
                    </Surface>
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-(--radius-panel) border border-dashed border-slate-200 px-3 py-4 text-center t-meta text-slate-300">없음</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ⑤ 성과 분석                                                          */
/* ------------------------------------------------------------------ */

export function AnalyticsScreen() {
  const d = useSalesAccounts()
  const { showToast } = useToast()
  const profile = useModuleBucket<SalesDocsData>('sales-kit', 'profile')
  const [period, setPeriod] = useState('all')
  const [cs, setCs] = useState('')
  const [ce, setCe] = useState('')
  const [applied, setApplied] = useState({ s: '', e: '' })
  const [sortBy, setSortBy] = useState<'contFee' | 'propFee' | 'conv' | 'proposed'>('contFee')
  const [catF, setCatF] = useState('전체')
  if (!d.ready) return <Loading />

  const rows = [...d.accountOf.entries()].map(([clientId, v]) => ({
    clientId,
    name: d.clients.find((c) => c.id === clientId)?.companyName ?? '업체',
    data: v.data,
  }))
  const stages = rows.map((r) => r.data.stage)
  const funnel = funnelOf(stages)
  const rate = conversionRate(stages)
  const sum = summarizeAccounts(rows.map((r) => ({ clientId: r.clientId, data: r.data })), d.today)

  const bySource = new Map<string, number>()
  for (const r of rows) bySource.set(r.data.source || '미입력', (bySource.get(r.data.source || '미입력') ?? 0) + 1)

  // 원본 성과 분석 — 영업을 시작한 업체만 (D-92)
  const profRow = profile.rows?.[0]
  const profData: SalesDocsData = profRow?.data ?? {}
  const list = d.clients.filter((c) => d.accountOf.has(c.id)).map((c) => toSalesItem(c, d.accountOf.get(c.id)!.data))
  const all: AnalyticsData = { list, goals: (profData.goals as AnalyticsData['goals']) ?? undefined }
  const range = period === 'custom' ? periodRange('custom', applied.s, applied.e) : periodRange(period)
  const fdata = filterDataByPeriod(all, range)
  const m = salesMetrics(fdata)
  const funnel11 = analyticsFunnel(fdata)
  const maxCount = Math.max(1, ...funnel11.map((f) => f.count))
  const goals = getGoals(all)
  const cmp = monthCompare(all)
  const trend = monthlyTrend(all, 6)
  const maxFee = Math.max(1, ...trend.map((t) => t.contractFee))
  const pmc = productMonthlyCompare(all)
  let perf = productPerformance(fdata).filter((p) => catF === '전체' || p.cat === catF)
  perf = perf.sort((a, b) => (sortBy === 'contFee' ? b.contFee - a.contFee : sortBy === 'propFee' ? b.propFee - a.propFee : sortBy === 'conv' ? b.conv - a.conv : b.proposed - a.proposed))
  const perfShown = perf.filter((p) => p.proposed > 0)
  const focus = focusCustomersOf(fdata.list, scoreLead)
  const risks = riskSignalsOf(fdata.list, scoreLead)
  const pct = (cur: number, goal: number) => (goal > 0 ? Math.min(100, Math.round((cur / goal) * 100)) : 0)
  const saveGoal = (k: 'feeGoal' | 'contractGoal' | 'proposalGoal', v: number) => {
    void profile.save({ id: profRow?.id, clientId: '', data: { ...profData, goals: { ...goals, [k]: v } } }).then(() => showToast('목표를 저장했습니다.'))
  }
  const dl = (name: string, t: { headers: string[]; rows: Array<Array<string | number>> }) => {
    if (!t.rows.length) {
      showToast('내보낼 데이터가 없습니다.')
      return
    }
    const blob = new Blob([buildCSV(t.headers, t.rows)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `corp-sales-${name}-${d.today.replace(/-/g, '')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('CSV 파일을 내려받습니다.')
  }
  const cmpRows = [
    { label: '신규 고객', cur: cmp.cur.newCust, prev: cmp.prev.newCust, unit: '곳', col: '#2563EB', inverse: false },
    { label: '제안', cur: cmp.cur.proposed, prev: cmp.prev.proposed, unit: '곳', col: '#0284C7', inverse: false },
    { label: '견적', cur: cmp.cur.quote, prev: cmp.prev.quote, unit: '곳', col: '#7C3AED', inverse: false },
    { label: '계약', cur: cmp.cur.contracted, prev: cmp.prev.contracted, unit: '건', col: '#059669', inverse: false },
    { label: '계약 수임료', cur: cmp.cur.contractFee, prev: cmp.prev.contractFee, unit: 'fee', col: '#B45309', inverse: false },
    { label: '다음 연락 지연', cur: cmp.cur.followLate, prev: cmp.prev.followLate, unit: '건', col: '#DC2626', inverse: true },
  ]
  const metricCards: Array<[string, string, string]> = [
    ['전체 고객', `${m.total}곳`, '#0F172A'],
    ['이번 주 다음 연락', `${m.thisWeek}곳`, '#2563EB'],
    ['다음 연락 지연', `${m.overdue}곳`, '#DC2626'],
    ['제안 완료', `${m.proposed}곳`, '#0284C7'],
    ['견적 전달', `${m.quoteSent}곳`, '#7C3AED'],
    ['조건 조율', `${m.negotiating}곳`, '#D97706'],
    ['계약 예정', `${m.preContract}곳`, '#B45309'],
    ['계약 완료', `${m.done}곳`, '#059669'],
    ['보류', `${m.onhold}곳`, '#64748B'],
    ['예상 수임료 합계', feeMoney(m.feeSum), '#B45309'],
    ['제안 수임료 합계', feeMoney(m.proposedFeeSum), '#0284C7'],
    ['계약 수임료 합계', feeMoney(m.contractedFeeSum), '#059669'],
  ]
  const monthlyCards: Array<[string, string, string]> = [
    ['월납 제안 고객', `${m.monthlyPropCount}곳`, '#2563EB'],
    ['월납 제안액 합계(월)', feeMoney(m.monthlyPremiumSum), '#2563EB'],
    ['84개월 목적자금 합계', manToText(m.projectedSum), '#B45309'],
  ]

  return (
    <div className="flex flex-col gap-5" data-testid="sales-analytics">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="영업 중" value={`${sum.live}곳`} />
        <MetricTile label="계약 전환율" value={`${rate}%`} tone={rate >= 20 ? 'success' : 'neutral'} hint="보류·이탈 제외" />
        <MetricTile label="예상 수수료" value={krwTile(sum.pipelineFee)} />
        <MetricTile label="계약 완료" value={`${sum.contracted}곳`} tone={sum.contracted > 0 ? 'success' : 'neutral'} />
      </div>

      <Section title="🗓️ 기간 · 내보내기" action={<span className="t-meta text-slate-500">{periodLabel(range)}</span>}>
        <Surface className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" data-testid="sales-period">
            {PERIOD_OPTIONS.map(([k, l]) => (
              <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)} className={`tap t-meta rounded-full border px-3 py-1 font-bold ${period === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>
                {l}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex flex-wrap items-end gap-2">
              <input type="date" aria-label="시작일" value={cs} onChange={(e) => setCs(e.target.value)} className={`${inputCls} w-auto`} />
              <input type="date" aria-label="종료일" value={ce} onChange={(e) => setCe(e.target.value)} className={`${inputCls} w-auto`} />
              <Button size="sm" onClick={() => setApplied({ s: cs, e: ce })}>
                적용
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
            <span className="t-meta self-center font-bold text-slate-500">엑셀로 내보내기(CSV)</span>
            <Button size="sm" variant="ghost" onClick={() => dl('customers', csvCustomers(fdata))}>
              <Download aria-hidden="true" className="size-4" /> 고객 목록
            </Button>
            <Button size="sm" variant="ghost" onClick={() => dl('analytics', csvAnalytics(fdata))}>
              <Download aria-hidden="true" className="size-4" /> 성과 분석
            </Button>
            <Button size="sm" variant="ghost" onClick={() => dl('products', csvProducts(fdata))}>
              <Download aria-hidden="true" className="size-4" /> 상품별 성과
            </Button>
            <Button size="sm" variant="ghost" onClick={() => dl('followups', csvFollowups(fdata))}>
              <Download aria-hidden="true" className="size-4" /> 다음 연락 대상
            </Button>
          </div>
        </Surface>
      </Section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-testid="sales-metrics">
        {metricCards.map(([l, v, c]) => (
          <Surface key={l} className="p-3">
            <div className="t-meta font-bold text-slate-500">{l}</div>
            <div className="t-card mt-1 font-black" style={{ color: c }}>
              {v}
            </div>
          </Surface>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <span className="t-sub font-bold text-[#2563EB]">📅 월납 보험료 제안 지표 <span className="t-meta font-medium text-slate-500">(컨설팅 수임료와 구분된 지표입니다)</span></span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {monthlyCards.map(([l, v, c]) => (
            <Surface key={l} className="p-3">
              <div className="t-meta font-bold text-slate-500">{l}</div>
              <div className="t-card mt-1 font-black" style={{ color: c }}>
                {v}
              </div>
            </Surface>
          ))}
          <Surface className="p-3">
            <div className="t-meta font-bold text-slate-500">적정성 초록/노랑/빨강</div>
            <div className="t-card mt-1 font-black">
              <span className="text-[#059669]">{m.affordN.green}</span> / <span className="text-[#D97706]">{m.affordN.yellow}</span> / <span className="text-[#DC2626]">{m.affordN.red}</span>
            </div>
          </Surface>
        </div>
      </div>

      <Section title="📊 이번 달 vs 지난 달">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="sales-month-compare">
          {cmpRows.map((r) => {
            const dI = deltaInfo(r.cur, r.prev)
            const dcol = r.inverse ? (dI.col === '#059669' ? '#DC2626' : dI.col === '#DC2626' ? '#059669' : dI.col) : dI.col
            const txt = (v: number) => (r.unit === 'fee' ? feeMoney(v) : `${v}${r.unit}`)
            return (
              <Surface key={r.label} className="p-3">
                <div className="t-meta font-bold text-slate-500">{r.label}</div>
                <div className="t-card mt-1 font-black" style={{ color: r.col }}>
                  {txt(r.cur)}
                </div>
                <div className="t-meta mt-1 text-slate-500">
                  지난달 {txt(r.prev)} · <b style={{ color: dcol }}>{dI.txt}</b>
                </div>
              </Surface>
            )
          })}
        </div>
        <p className="t-meta mt-2 text-slate-500">
          현재 시점 기준 · 위험 신호 <b className="text-danger-700">{riskSignalsOf(all.list, scoreLead).length}건</b> · 이번 주 집중 고객 <b className="text-brand-700">{focusCustomersOf(all.list, scoreLead).length}곳</b>
        </p>
      </Section>

      <Section title="📈 월별 추이 (최근 6개월)">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="sales-trend">
          {trend.map((t) => (
            <Surface key={t.mkey} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <b className="t-sub">{monthLabel(t.mkey)}</b>
                <Badge tone={t.contracted > 0 ? 'success' : 'neutral'}>{t.contracted}건</Badge>
              </div>
              <div className="t-card mt-1 font-black text-[#B45309]">{feeMoney(t.contractFee)}</div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#B45309]" style={{ width: `${Math.round((t.contractFee / maxFee) * 100)}%` }} />
              </div>
              <div className="t-meta mt-1.5 text-slate-500">
                신규 {t.newCust} · 제안 {t.proposed} · 견적 {t.quote}
              </div>
            </Surface>
          ))}
        </div>
      </Section>

      <Section title="🎯 이번 달 목표">
        <div className="grid gap-2 sm:grid-cols-3" data-testid="sales-goals">
          {(
            [
              ['feeGoal', '계약 수임료 목표(만원)', cmp.cur.contractFee, feeMoney(cmp.cur.contractFee), '#B45309'],
              ['contractGoal', '계약 건수 목표', cmp.cur.contracted, `${cmp.cur.contracted}건`, '#059669'],
              ['proposalGoal', '제안 건수 목표', cmp.cur.proposed, `${cmp.cur.proposed}건`, '#0284C7'],
            ] as const
          ).map(([k, label, cur, curTxt, col]) => (
            <Surface key={k} className="flex flex-col gap-1.5 p-3">
              <span className="t-meta font-bold text-slate-500">{label}</span>
              <input aria-label={label} inputMode="numeric" defaultValue={String(goals[k])} onBlur={(e) => saveGoal(k, Number(e.target.value) || 0)} className={inputCls} />
              <span className="t-sub font-bold" style={{ color: col }}>
                {curTxt} · {pct(cur, goals[k])}%
              </span>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${pct(cur, goals[k])}%`, background: col }} />
              </div>
            </Surface>
          ))}
        </div>
      </Section>

      <Section title="🔻 단계 퍼널 (11단계)">
        <Surface>
          <ul className="flex flex-col gap-2" data-testid="sales-funnel11">
            {funnel11.map((f) => (
              <li key={f.key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="t-sub w-36 shrink-0 font-medium text-slate-700">{f.label}</span>
                <span className="h-3 min-w-1 rounded-full bg-[#2563EB]" style={{ width: `${Math.max(2, Math.round((f.count / maxCount) * 60))}%` }} aria-hidden="true" />
                <span className="t-meta tabular-nums text-slate-500">
                  {f.count}곳 · {f.share}%{f.conv !== null ? ` · 전환 ${f.conv}%` : ''} · {feeMoney(f.fee)}
                </span>
              </li>
            ))}
          </ul>
        </Surface>
      </Section>

      <Section
        title="퍼널"
        action={
          <Button size="sm" variant="ghost" onClick={() => {
            const csv = accountsCsv(rows.map((r) => ({ name: r.name, data: r.data })))
            const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `영업현황-${d.today}.csv`
            a.click()
            URL.revokeObjectURL(url)
            showToast('영업 현황을 CSV 로 내보냈습니다.')
          }} data-testid="sales-csv">
            <Download aria-hidden="true" className="size-4" /> CSV
          </Button>
        }
      >
        <Surface>
          <ul className="flex flex-col gap-2" data-testid="sales-funnel">
            {funnel.map((f) => (
              <li key={f.column.key} className="flex items-center gap-3">
                <span className="t-sub w-28 shrink-0 font-medium text-slate-700">{f.column.label}</span>
                <span className="h-3 min-w-1 rounded-full bg-brand-500" style={{ width: `${Math.max(2, f.rate)}%` }} aria-hidden="true" />
                <span className="t-meta tabular-nums text-slate-500">
                  {f.count}곳 · {f.rate}%
                </span>
              </li>
            ))}
          </ul>
        </Surface>
      </Section>

      <Section title="📦 상품별 성과" action={<span className="t-meta text-slate-500">제안 기록 기준</span>}>
        <div className="flex flex-wrap gap-1.5">
          {(['전체', ...PKG_CATEGORIES] as string[]).map((c) => (
            <button key={c} type="button" aria-pressed={catF === c} onClick={() => setCatF(c)} className={`tap t-meta rounded-full border px-2.5 py-1 ${catF === c ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>
              {c}
            </button>
          ))}
          <select aria-label="상품 정렬" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="t-meta ml-auto rounded border border-slate-300 bg-white px-2 py-1">
            <option value="contFee">계약 수임료순</option>
            <option value="propFee">제안 수임료순</option>
            <option value="conv">계약 준비율순</option>
            <option value="proposed">제안 건수순</option>
          </select>
        </div>
        {perfShown.length === 0 ? (
          <p className="t-sub mt-2 text-slate-500">아직 제안 기록이 없습니다. 영업 카드에서 '제안 기록 남기기' 를 누르면 여기 쌓입니다.</p>
        ) : (
          <Surface className="mt-2 overflow-x-auto p-0">
            <table className="w-full min-w-[40rem] t-sub" data-testid="sales-products">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2">상품</th>
                  <th className="px-3 py-2">제안</th>
                  <th className="px-3 py-2">견적</th>
                  <th className="px-3 py-2">계약</th>
                  <th className="px-3 py-2">제안 수임료</th>
                  <th className="px-3 py-2">계약 수임료</th>
                  <th className="px-3 py-2">계약 준비율</th>
                </tr>
              </thead>
              <tbody>
                {perfShown.map((p) => (
                  <tr key={p.name} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 tabular-nums">{p.proposed}</td>
                    <td className="px-3 py-2 tabular-nums">{p.quote}</td>
                    <td className="px-3 py-2 tabular-nums">{p.contracted}</td>
                    <td className="px-3 py-2 tabular-nums">{feeMoney(p.propFee)}</td>
                    <td className="px-3 py-2 tabular-nums">{feeMoney(p.contFee)}</td>
                    <td className="px-3 py-2 tabular-nums">{p.conv}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>
        )}
        {pmc.length > 0 && (
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {pmc.map((r) => (
              <li key={r.name} className="t-sub flex flex-wrap items-center gap-2 rounded-(--radius-control) bg-slate-50 px-3 py-2">
                <b>{r.name}</b>
                {r.badge && (
                  <span className="t-meta rounded-md px-1.5 font-bold" style={{ color: r.badge.col, background: r.badge.bg }}>
                    {r.badge.t}
                  </span>
                )}
                <span className="t-meta text-slate-500">
                  제안 {r.propPrev}→{r.propCur} · 계약 {r.contPrev}→{r.contCur}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {(focus.length > 0 || risks.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="🎯 이번 주 집중 고객" count={focus.length}>
            <ul className="flex flex-col gap-1.5">
              {focus.map((f) => (
                <li key={String(f.c.id)} className="t-sub">
                  <Link to={`/tools/sales-kit/reports?card=${String(f.c.id)}`} className="font-bold text-slate-900 hover:underline">
                    {f.c.companyName}
                  </Link>{' '}
                  <span className="t-meta text-slate-500">{f.why}</span>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="⚠️ 위험 신호" count={risks.length}>
            <ul className="flex flex-col gap-1.5">
              {risks.map((r) => (
                <li key={String(r.c.id)} className="t-sub">
                  <Link to={`/tools/sales-kit/reports?card=${String(r.c.id)}`} className="font-bold text-slate-900 hover:underline">
                    {r.c.companyName}
                  </Link>{' '}
                  <span className="text-danger-700">{r.reason}</span> <span className="t-meta text-slate-500">→ {r.action}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      <Section title="유입 경로">
        <Surface>
          <ul className="flex flex-col gap-1.5">
            {[...bySource.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([source, n]) => (
                <li key={source} className="flex items-center justify-between gap-3">
                  <span className="t-sub text-slate-700">{source}</span>
                  <span className="t-meta tabular-nums text-slate-500">{n}곳</span>
                </li>
              ))}
          </ul>
        </Surface>
      </Section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 대시보드에 얹는 영업 칸                                                */
/* ------------------------------------------------------------------ */

export function SalesDashboardExtra(): ReactNode {
  const d = useSalesAccounts()
  if (!d.ready) return null

  const rows = [...d.accountOf.entries()].map(([clientId, v]) => ({ clientId, data: v.data }))
  if (rows.length === 0) {
    return (
      <Surface>
        <p className="t-sub break-keep text-slate-600">
          아직 영업을 시작한 업체가 없습니다.{' '}
          <Link to="/tools/sales-kit/prospecting" className="font-bold text-brand-700 hover:underline">
            신규 고객 발굴
          </Link>{' '}
          에서 한 곳을 시작하면 여기 모입니다.
        </p>
      </Surface>
    )
  }

  const sum = summarizeAccounts(rows, d.today)
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4" data-testid="sales-dashboard-extra">
        <MetricTile label="영업 중" value={`${sum.live}곳`} tone="brand" />
        <MetricTile label="오늘 연락" value={`${sum.today}곳`} tone={sum.today > 0 ? 'warning' : 'neutral'} />
        <MetricTile label="지난 연락" value={`${sum.overdue}곳`} tone={sum.overdue > 0 ? 'danger' : 'neutral'} />
        <MetricTile label="예상 수수료" value={krwTile(sum.pipelineFee)} />
      </div>
      <BriefingBlocks clients={d.clients} accountOf={d.accountOf} />
    </div>
  )
}

/** 원본 '오늘의 브리핑' 의 네 칸 — 오늘의 제안거리 · 집중 고객 · 위험 신호 · 재접촉 명분 (D-92) */
function BriefingBlocks({ clients, accountOf }: { clients: ClientOpsRecord[]; accountOf: Map<string, { id: string; data: AccountData }> }) {
  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t)
    } catch {
      /* 화면에서 긁는다 */
    }
  }
  const items = clients.map((c) => toSalesItem(c, accountOf.get(c.id)?.data ?? emptyAccount()))
  const rows = todayProposalRows(items)
  const focus = focusCustomersOf(items.filter((x) => accountOf.has(String(x.id))), scoreLead)
  const risks = riskSignalsOf(items.filter((x) => accountOf.has(String(x.id))), scoreLead)
  const recontact = recontactListOf(items.filter((x) => accountOf.has(String(x.id))))
  const cardLink = (it: SalesItem) => (
    <Link to={`/tools/sales-kit/reports?card=${String(it.id)}`} className="t-sub font-bold text-slate-900 hover:underline">
      {it.companyName}
    </Link>
  )
  return (
    <div className="flex flex-col gap-4" data-testid="sales-briefing-blocks">
      {rows.length > 0 && (
        <Section title="💡 오늘의 제안거리" action={<span className="t-meta text-slate-500">콘텐츠·교육·법령·절세전략 기반</span>}>
          <ul className="flex flex-col gap-2" data-testid="sales-today-ideas">
            {rows.map((r) => (
              <li key={r.key}>
                <Surface className="flex flex-col gap-1 p-3">
                  <span className="t-sub text-slate-800">
                    <b className="text-[#2563EB]">{r.name}</b> 점검 주제와 관련 가능성 있는 고객 <b>{r.list.length}</b>곳
                  </span>
                  <span className="t-meta text-slate-500">우선 연락: {r.list.slice(0, 3).map((x) => x.c.companyName).join(', ')}</span>
                  <span className="flex flex-wrap gap-2">
                    {r.list.slice(0, 3).map((x) => (
                      <Link key={String(x.c.id)} to={`/tools/sales-kit/reports?card=${String(x.c.id)}`} className="t-meta text-brand-700 hover:underline">
                        {x.c.companyName} 영업 카드
                      </Link>
                    ))}
                    <button type="button" className="t-meta text-slate-500 hover:underline" onClick={() => void copy(topicKakao(r.list[0].c, r.tp))}>
                      카톡 복사
                    </button>
                  </span>
                </Surface>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {focus.length > 0 && (
        <Section title="🎯 이번 주 집중 고객" count={focus.length}>
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="sales-focus">
            {focus.map((f) => (
              <li key={String(f.c.id)}>
                <Surface className="flex flex-col gap-0.5 p-3">
                  {cardLink(f.c)}
                  <span className="t-meta text-slate-500">{f.why}</span>
                </Surface>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {risks.length > 0 && (
        <Section title="⚠️ 놓치면 안 되는 신호" count={risks.length}>
          <ul className="flex flex-col gap-2" data-testid="sales-risks">
            {risks.map((r) => (
              <li key={String(r.c.id)}>
                <Surface edge="danger" showEdge className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                  {cardLink(r.c)}
                  <span className="t-sub text-danger-700">{r.reason}</span>
                  <span className="t-meta text-slate-500">마지막 활동 {r.last} · 할 일: {r.action}</span>
                </Surface>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {recontact.length > 0 && (
        <Section title="📞 재접촉 명분" count={recontact.length}>
          <ul className="flex flex-col gap-2" data-testid="sales-recontact">
            {recontact.map((r) => (
              <li key={String(r.c.id)}>
                <Surface className="flex flex-col gap-1 p-3">
                  {cardLink(r.c)}
                  <span className="t-meta break-keep text-slate-600">{r.reasons.join(' ')}</span>
                  <button type="button" className="t-meta w-fit text-brand-700 hover:underline" onClick={() => void copy(r.ment)}>
                    연락 문구 복사
                  </button>
                </Surface>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
