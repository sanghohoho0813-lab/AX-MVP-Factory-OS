/**
 * 영업 — 고객사·발굴·다음 연락·파이프라인·성과 (D-91).
 *
 * 다섯 화면이 같은 기록(모듈 기록 `sales-kit`/`accounts`)을 본다. 그래서 한 파일에 둔다.
 * 업체는 만들지 않는다 — 고객 운영의 업체를 그대로 쓰고 영업 상태만 얹는다.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
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
                        <Link to={`/ops/clients/${c.id}`} className="t-meta text-brand-700 hover:underline">
                          업체 기록 보기
                        </Link>
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
                  </Surface>
                </li>
              ))}
            </ul>
          </Section>
        ))}

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

  const download = () => {
    const csv = accountsCsv(rows.map((r) => ({ name: r.name, data: r.data })))
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `영업현황-${d.today}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('영업 현황을 CSV 로 내보냈습니다.')
  }

  return (
    <div className="flex flex-col gap-5" data-testid="sales-analytics">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="영업 중" value={`${sum.live}곳`} />
        <MetricTile label="계약 전환율" value={`${rate}%`} tone={rate >= 20 ? 'success' : 'neutral'} hint="보류·이탈 제외" />
        <MetricTile label="예상 수수료" value={krwTile(sum.pipelineFee)} />
        <MetricTile label="계약 완료" value={`${sum.contracted}곳`} tone={sum.contracted > 0 ? 'success' : 'neutral'} />
      </div>

      <Section
        title="퍼널"
        action={
          <Button size="sm" variant="ghost" onClick={download} data-testid="sales-csv">
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

      <Section title="유입 경로" count={bySource.size}>
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
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4" data-testid="sales-dashboard-extra">
      <MetricTile label="영업 중" value={`${sum.live}곳`} tone="brand" />
      <MetricTile label="오늘 연락" value={`${sum.today}곳`} tone={sum.today > 0 ? 'warning' : 'neutral'} />
      <MetricTile label="지난 연락" value={`${sum.overdue}곳`} tone={sum.overdue > 0 ? 'danger' : 'neutral'} />
      <MetricTile label="예상 수수료" value={krwTile(sum.pipelineFee)} />
    </div>
  )
}
