/**
 * 영업 관리 › 상품·제안 (D-114 3단계).
 *
 * 기업컨설팅 OS 의 '상품 관리' · '제안서 초안' · '견적/업무범위서' · '월납 제안' · '계약 준비' 를 고객 관리 한 장부 위로.
 *  - 고객 제안: 고객을 고르면 추천 상품 3이 먼저 골라져 있다 → 더 고르기 → 합계 · 기간 → 문서(제안서 공유용/내부용 · 업무범위서 · 견적 카톡 · 상황별 카톡 · 자료 요청)
 *    → 월납 제안(84개월 단순 시뮬레이션 · 직전년도 순이익 대비 적정성) → 제안 상태 저장 → 계약 준비 체크 → 계약 완료(수금 항목 자동)
 *  - 상품표: 40종 · 8분류 · 원본 가격 그대로(D-114 ④). 가격을 고치면 고친 값만 따로 저장(원본 값 되돌리기 가능).
 * 모두 규칙 계산 · 문구 틀이다(LLM 호출 없음). 문구 · 가격 · 기준 값은 원본 그대로.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, FileSignature, PackageSearch, Search } from 'lucide-react'
import { WorkspaceScope } from '../../components/workspace/WorkspaceScope'
import { useToast } from '../../components/ui/toastContext'
import { Badge, Disclosure, MetricTile, ScreenTitle, Surface, type Tone } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { SalesTabs } from '../../components/sales/SalesTabs'
import { CopyButton, PillList } from '../../components/sales/salesParts'
import { useCurrentUser } from '../../components/layout/useCurrentUser'
import { brand } from '../../brand/brand.config'
import { listClients, saveClient } from '../../services/clientOpsService'
import { listRows, saveRow } from '../../services/moduleData'
import { salesStageOf } from '../../services/salesPipeline'
import { catalogWithPrices, cleanPrices, feeSum, toProposalItem, withContractFromProposal, withContractPrep, withProposal } from '../../services/salesOffer'
import {
  CONTRACT_CHECKLIST,
  PKG_CATEGORIES,
  PROPOSAL_STATES,
  REQUIRED_DOCS,
  affordability,
  buildDocRequestText,
  buildKakaoSet,
  buildProposal,
  buildQuoteText,
  buildScopeDoc,
  getAffordSettings,
  insuranceSim,
  manToText,
  matchPackages,
  pkgDuration,
  scopeKakaoSet,
  type SalesPackage,
} from '../../services/salesProposal'
import { todayLocalDate } from '../../lib/appClock'
import { SALES_STAGE_LABEL, SALES_STAGE_ORDER, type ClientOpsRecord } from '../../types/clientOps'

const CATALOG_MODULE = 'sales-os'
const CATALOG_BUCKET = 'catalog'

const inputClass = 'mt-1 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-[0.95rem] text-slate-800 focus:border-brand-500 focus:outline-none'

type DocKey = 'client' | 'internal' | 'scope' | 'quote' | 'kakao' | 'docs'
const DOCS: { key: DocKey; label: string }[] = [
  { key: 'client', label: '제안서 (대표님 공유용)' },
  { key: 'internal', label: '제안서 (내부용)' },
  { key: 'scope', label: '업무범위서' },
  { key: 'quote', label: '견적 카톡' },
  { key: 'kakao', label: '상황별 카톡' },
  { key: 'docs', label: '자료 요청' },
]

/** 월납 적정성 색 — 초록/노랑/빨강을 운영 OS 의 성공 · 경고 · 위험색으로 */
const AFFORD_TONE: Record<string, Tone> = { green: 'success', yellow: 'warning', red: 'danger', none: 'neutral' }

/* ------------------------------------------------------------------ */
/* 상품표                                                               */
/* ------------------------------------------------------------------ */

function CatalogView({ catalog, prices, onSavePrice }: { catalog: SalesPackage[]; prices: Record<string, number>; onSavePrice: (id: string, fee: number | null) => void }) {
  const [cat, setCat] = useState<string>('전체')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const list = catalog.filter((p) => (cat === '전체' || p.cat === cat) && (q.trim() === '' || `${p.name} ${p.desc} ${p.fit}`.includes(q.trim())))
  return (
    <div className="flex flex-col gap-3" data-testid="catalog">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="상품 분류">
        {['전체', ...PKG_CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cat === c}
            onClick={() => setCat(c)}
            className={`t-meta rounded-full border px-2.5 py-1 font-semibold ${cat === c ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {c} <span className="tabular-nums opacity-75">{c === '전체' ? catalog.length : catalog.filter((p) => p.cat === c).length}</span>
          </button>
        ))}
      </div>
      <div className="relative w-full sm:max-w-md">
        <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품 이름 · 설명으로 찾기" aria-label="상품 검색" className="w-full rounded-(--radius-control) border border-slate-300 bg-white py-2 pr-3 pl-9 text-[0.95rem] focus:border-brand-500 focus:outline-none" />
      </div>
      <ul className="grid gap-2 lg:grid-cols-2">
        {list.map((p) => {
          const changed = prices[p.id] !== undefined
          return (
            <li key={p.id} className="flex flex-col gap-1 rounded-(--radius-control) border border-slate-200 bg-white p-3.5">
              <div className="flex items-start justify-between gap-2">
                <span className="t-body min-w-0 font-bold text-slate-900">{p.name}</span>
                {editing === p.id ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <input value={draft} inputMode="numeric" aria-label={`${p.name} 가격(만원)`} onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))} className="w-20 rounded-(--radius-control) border border-slate-300 px-2 py-1 text-right text-[0.9rem] tabular-nums focus:border-brand-500 focus:outline-none" />
                    <span className="t-meta text-slate-500">만원</span>
                    <Button size="sm" variant="primary" onClick={() => { onSavePrice(p.id, draft === '' ? null : Number(draft)); setEditing(null) }}>저장</Button>
                  </span>
                ) : (
                  <button type="button" onClick={() => { setEditing(p.id); setDraft(String(p.fee)) }} className="t-sub shrink-0 font-semibold text-slate-800 tabular-nums hover:text-brand-700" aria-label={`${p.name} 가격 고치기`}>
                    {p.fee.toLocaleString('ko-KR')}만원{changed ? ' ·고침' : ''}
                  </button>
                )}
              </div>
              <p className="t-meta text-slate-500">{p.cat} · 기간 {pkgDuration(p)}</p>
              <p className="t-sub break-keep text-slate-700">{p.desc}</p>
              <p className="t-meta break-keep text-slate-500">맞는 고객 — {p.fit}</p>
              {changed && editing !== p.id && (
                <button type="button" onClick={() => onSavePrice(p.id, null)} className="t-meta self-start text-slate-500 hover:text-brand-700 hover:underline">
                  원본 가격으로 되돌리기
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="t-meta break-keep text-slate-400">가격 · 설명은 기업컨설팅 OS 원본 그대로입니다(대표 결정 D-114). 가격을 누르면 고칠 수 있고, 고친 값만 따로 저장됩니다.</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 고객 제안                                                            */
/* ------------------------------------------------------------------ */

function ProposalWork({ record, catalog, onSave }: { record: ClientOpsRecord; catalog: SalesPackage[]; onSave: (next: ClientOpsRecord, msg: string) => void }) {
  const me = useCurrentUser()
  const profile = { consultant: me.name, title: me.title, org: brand.companyName }
  const item = useMemo(() => toProposalItem(record), [record])
  const saved = record.sales?.proposal
  const recommended = useMemo(() => matchPackages(item, catalog), [item, catalog])

  // 고른 상품 — 저장된 제안이 있으면 그것, 없으면 추천 3
  const initial = useMemo(() => {
    const names = saved?.packages?.length ? saved.packages : recommended.map((r) => r.pkg.name)
    return {
      names,
      status: saved?.status ?? '제안 전',
      premium: saved?.monthly ? String(saved.monthly.premium) : '',
      months: saved?.monthly ? String(saved.monthly.months) : '84',
      rate: saved?.monthly ? String(saved.monthly.rate) : '100',
      net: saved?.monthly?.netIncome ? String(saved.monthly.netIncome) : '',
    }
  }, [saved, recommended])
  const [d, setD] = useState(initial)
  // 저장된 제안이 바뀌었을 때만 칸을 새로 채운다 — 계약 준비 체크처럼 다른 것을 저장해도 고르던 상품은 그대로
  const savedKey = JSON.stringify(saved ?? null)
  const [seenKey, setSeenKey] = useState(savedKey)
  if (seenKey !== savedKey) {
    setSeenKey(savedKey)
    setD(initial)
  }
  const [doc, setDoc] = useState<DocKey>('client')
  const [scopePkg, setScopePkg] = useState(0)
  const [addOpen, setAddOpen] = useState(false)

  // 고른 순서대로 (추천 1이 제안서 첫 줄)
  const picked = d.names.map((n) => catalog.find((p) => p.name === n)).filter((p): p is SalesPackage => p !== undefined)
  const sum = feeSum(picked)
  const toggle = (name: string) => setD((prev) => ({ ...prev, names: prev.names.includes(name) ? prev.names.filter((n) => n !== name) : [...prev.names, name] }))

  const premium = Number(d.premium) || 0
  const months = Number(d.months) || 84
  const rate = d.rate === '' ? 100 : Number(d.rate)
  const net = Number(d.net) || null
  const sim = premium > 0 ? insuranceSim(premium, months, rate) : null
  const aff = premium > 0 ? affordability(premium, net, getAffordSettings(null)) : null
  const docItem = { ...item, ...(premium > 0 ? { proposalMonthlyPremium: premium, proposalMonths: months, proposalRefundRate: rate } : {}), ...(net ? { netIncome: net } : {}) }

  const docText = (() => {
    if (picked.length === 0 && doc !== 'kakao' && doc !== 'docs') return ''
    switch (doc) {
      case 'client':
        return buildProposal(docItem, picked, 'client', profile)
      case 'internal':
        return buildProposal(docItem, picked, 'internal', profile)
      case 'scope':
        return buildScopeDoc(docItem, picked[Math.min(scopePkg, picked.length - 1)], profile)
      case 'quote':
        return buildQuoteText(docItem, picked[Math.min(scopePkg, picked.length - 1)])
      case 'kakao':
        return [...buildKakaoSet(docItem), ...(picked[0] ? scopeKakaoSet(docItem, picked[0]) : [])].map(([t, x]) => `[${t}]\n${x}`).join('\n\n')
      case 'docs':
        return buildDocRequestText(docItem)
    }
  })()

  const save = () =>
    onSave(
      withProposal(record, {
        packages: picked.map((p) => p.name),
        feeManwon: sum,
        status: d.status,
        monthly: premium > 0 ? { premium, months, rate, netIncome: net } : null,
      }),
      '제안을 저장했습니다. 예상 수임료도 합계로 맞췄습니다.',
    )

  const prep = new Set(record.sales?.contractPrep ?? [])
  const prepDone = CONTRACT_CHECKLIST.filter((c) => prep.has(c)).length
  const docsDone = REQUIRED_DOCS.filter((c) => prep.has(`서류:${c}`)).length
  const stage = salesStageOf(record)

  return (
    <div className="flex flex-col gap-4">
      {/* 고른 상품 */}
      <Surface className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="t-section text-slate-900">제안 상품</h2>
          <p className="t-sub text-slate-500">
            <span data-testid="proposal-count">{picked.length}개</span> · 합계 <strong data-testid="proposal-sum" className="font-bold text-slate-900 tabular-nums">{sum.toLocaleString('ko-KR')}만원</strong>
          </p>
        </div>
        <ul className="grid gap-2 lg:grid-cols-3" data-testid="recommended">
          {recommended.map(({ pkg, reason }, i) => {
            const on = d.names.includes(pkg.name)
            return (
              <li key={pkg.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(pkg.name)}
                  className={`flex h-full w-full flex-col gap-1 rounded-(--radius-control) border p-3 text-left ${on ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <span className="t-meta font-semibold text-brand-700">추천 {i + 1}</span>
                  <span className="t-sub font-bold text-slate-900">{pkg.name}</span>
                  <span className="t-meta tabular-nums text-slate-600">{pkg.fee.toLocaleString('ko-KR')}만원 · {pkgDuration(pkg)}</span>
                  <span className="t-meta break-keep text-slate-500">{reason}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {picked.filter((p) => !recommended.some((r) => r.pkg.id === p.id)).length > 0 && (
          <div>
            <p className="t-meta font-semibold text-slate-500">더 고른 것</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {picked.filter((p) => !recommended.some((r) => r.pkg.id === p.id)).map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => toggle(p.name)} className="t-meta rounded-full border border-brand-400 bg-brand-50 px-2.5 py-1 font-medium text-brand-700" aria-label={`${p.name} 빼기`}>
                    {p.name} · {p.fee}만원 ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <Button variant="secondary" size="sm" onClick={() => setAddOpen((v) => !v)} aria-expanded={addOpen}>
            {addOpen ? '상품 고르기 닫기' : '상품 더 고르기 (40종)'}
          </Button>
          {addOpen && (
            <div className="mt-2 flex flex-col gap-3 rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3">
              {PKG_CATEGORIES.map((c) => (
                <fieldset key={c}>
                  <legend className="t-meta font-semibold text-slate-600">{c}</legend>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {catalog.filter((p) => p.cat === c).map((p) => {
                      const on = d.names.includes(p.name)
                      return (
                        <button key={p.id} type="button" aria-pressed={on} onClick={() => toggle(p.name)} className={`t-meta rounded-full border px-2.5 py-1 font-medium ${on ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                          {p.name} · {p.fee}만
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
        </div>
      </Surface>

      {/* 문서 */}
      <Surface className="flex flex-col gap-3">
        <h2 className="t-section text-slate-900">문서 · 문구</h2>
        <div role="group" aria-label="문서 종류" data-testid="proposal-docs" className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
          {DOCS.map((x) => (
            <button key={x.key} type="button" aria-pressed={doc === x.key} onClick={() => setDoc(x.key)} className={`tap rounded-(--radius-control) border px-2 py-2 text-[0.85rem] font-semibold break-keep ${doc === x.key ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
              {x.label}
            </button>
          ))}
        </div>
        {(doc === 'scope' || doc === 'quote') && picked.length > 1 && (
          <label className="block max-w-md text-[0.85rem] text-slate-500">
            상품
            <select value={Math.min(scopePkg, picked.length - 1)} onChange={(e) => setScopePkg(Number(e.target.value))} className={inputClass}>
              {picked.map((p, i) => <option key={p.id} value={i}>{p.name}</option>)}
            </select>
          </label>
        )}
        {docText ? (
          <div className="relative rounded-(--radius-control) border border-slate-200 bg-slate-50">
            <div className="absolute top-2 right-2">
              <CopyButton text={docText} />
            </div>
            <pre data-testid="proposal-doc" className="t-sub max-h-[28rem] overflow-auto p-3.5 pr-20 font-[inherit] break-keep whitespace-pre-wrap text-slate-700">{docText}</pre>
          </div>
        ) : (
          <p className="t-sub text-slate-400">상품을 하나 이상 고르면 문서가 만들어집니다.</p>
        )}
        {doc === 'internal' && <p className="t-meta text-warning-700">내부용 — 수임료 · 영업 포인트가 들어 있어 고객에게 보내지 않습니다.</p>}
      </Surface>

      {/* 월납 제안 */}
      <Surface className="flex flex-col gap-3" >
        <h2 className="t-section text-slate-900">월납 보험료 제안</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block text-[0.85rem] text-slate-500">
            월납 (만원)
            <input value={d.premium} inputMode="numeric" onChange={(e) => setD({ ...d, premium: e.target.value.replace(/[^0-9]/g, '') })} className={inputClass} />
          </label>
          <label className="block text-[0.85rem] text-slate-500">
            납입 기간 (개월)
            <input value={d.months} inputMode="numeric" onChange={(e) => setD({ ...d, months: e.target.value.replace(/[^0-9]/g, '') })} className={inputClass} />
          </label>
          <label className="block text-[0.85rem] text-slate-500">
            환급률 (%)
            <input value={d.rate} inputMode="numeric" onChange={(e) => setD({ ...d, rate: e.target.value.replace(/[^0-9]/g, '') })} className={inputClass} />
          </label>
          <label className="block text-[0.85rem] text-slate-500">
            직전년도 순이익 (만원)
            <input value={d.net} inputMode="numeric" onChange={(e) => setD({ ...d, net: e.target.value.replace(/[^0-9]/g, '') })} className={inputClass} />
          </label>
        </div>
        {sim && aff ? (
          <div data-testid="monthly-result" className="flex flex-col gap-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <MetricTile label={`${sim.months}개월 총 납입`} value={manToText(sim.total)} />
              <MetricTile label={`${sim.rate}% 기준 목적자금`} value={manToText(sim.base)} />
              <MetricTile label="직전년도 이익 대비" value={aff.label} tone={AFFORD_TONE[aff.level]} hint={aff.hasBase ? `초록 ${aff.greenLimit.toLocaleString('ko-KR')}만 · 노랑 ${aff.yellowLimit.toLocaleString('ko-KR')}만까지` : undefined} />
            </div>
            <p className="t-sub break-keep text-slate-600">{aff.msg}</p>
            {aff.note && <p className="t-meta break-keep text-slate-400">{aff.note}</p>}
          </div>
        ) : (
          <p className="t-sub text-slate-400">월납 금액을 넣으면 총 납입 · 목적자금 · 적정성(순이익 1억당 초록 300만 · 노랑 600만 기준)이 나옵니다. 제안서 · 업무범위서에도 들어갑니다.</p>
        )}
      </Surface>

      {/* 제안 상태 · 저장 */}
      <Surface className="flex flex-wrap items-end gap-3">
        <label className="block min-w-44 flex-1 text-[0.85rem] text-slate-500 sm:max-w-xs">
          제안 상태
          <select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })} aria-label="제안 상태" className={inputClass}>
            {PROPOSAL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <p className="t-sub flex-1 pb-2 break-keep text-slate-500">
          {saved ? `마지막 저장 ${saved.at} · ${saved.status}` : '아직 저장한 제안이 없습니다.'}
        </p>
        <Button variant="primary" onClick={save} disabled={picked.length === 0}>
          제안 저장
        </Button>
      </Surface>

      {/* 계약 준비 */}
      <Disclosure title="계약 준비" hint={`체크 ${prepDone}/${CONTRACT_CHECKLIST.length} · 서류 ${docsDone}/${REQUIRED_DOCS.length}`} defaultOpen={stage === 'closing'}>
        <div className="flex flex-col gap-4" data-testid="contract-prep">
          <fieldset>
            <legend className="t-sub font-semibold text-slate-700">계약 전 확인 {prepDone}/{CONTRACT_CHECKLIST.length}</legend>
            <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
              {CONTRACT_CHECKLIST.map((c) => (
                <li key={c}>
                  <label className="t-sub flex items-center gap-2 text-slate-700">
                    <input type="checkbox" checked={prep.has(c)} onChange={(e) => onSave(withContractPrep(record, c, e.target.checked), e.target.checked ? `체크 — ${c}` : `체크 해제 — ${c}`)} className="size-4 accent-brand-600" />
                    {c}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <fieldset>
            <legend className="t-sub font-semibold text-slate-700">받을 서류 {docsDone}/{REQUIRED_DOCS.length}</legend>
            <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {REQUIRED_DOCS.map((c) => (
                <li key={c}>
                  <label className="t-sub flex items-center gap-2 text-slate-700">
                    <input type="checkbox" checked={prep.has(`서류:${c}`)} onChange={(e) => onSave(withContractPrep(record, `서류:${c}`, e.target.checked), e.target.checked ? `서류 — ${c}` : `서류 해제 — ${c}`)} className="size-4 accent-brand-600" />
                    {c}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p className="t-sub break-keep text-slate-600">
              {stage === 'contracted'
                ? '이미 계약 완료입니다.'
                : `계약 완료로 넘기면 계약 고객이 되고, 고른 상품 ${picked.length}개가 수금 항목(계약금 · 상품표 가격)으로 들어갑니다.`}
            </p>
            <Button
              variant="primary"
              disabled={stage === 'contracted' || picked.length === 0}
              onClick={() => onSave(withContractFromProposal(record, picked), `${record.companyName} — 계약 완료. 수금 항목 ${picked.length}개를 만들었습니다.`)}
            >
              <FileSignature aria-hidden="true" className="size-4" />
              계약 완료로
            </Button>
          </div>
        </div>
      </Disclosure>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 화면                                                                 */
/* ------------------------------------------------------------------ */

function ProposalContent({ workspaceId }: { workspaceId: string | null }) {
  const { showToast } = useToast()
  const today = todayLocalDate()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'catalog' ? 'catalog' : 'client'
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [priceRowId, setPriceRowId] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [list, rows] = await Promise.all([listClients(workspaceId), listRows(workspaceId, CATALOG_MODULE, CATALOG_BUCKET).catch(() => [])])
      setRecords(list)
      const row = rows.find((r) => r.data.key === 'prices')
      setPriceRowId(row?.id)
      setPrices(cleanPrices((row?.data.value as Record<string, unknown>) ?? {}))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '업체 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])
  useEffect(() => {
    void load()
  }, [load])

  const catalog = useMemo(() => catalogWithPrices(prices), [prices])
  const live = useMemo(() => records.filter((r) => r.archivedAt === null), [records])
  const grouped = useMemo(
    () => SALES_STAGE_ORDER.map((st) => ({ st, list: live.filter((r) => salesStageOf(r) === st).sort((a, b) => a.companyName.localeCompare(b.companyName, 'ko')) })).filter((g) => g.list.length > 0),
    [live],
  )
  const firstPick = grouped.find((g) => g.st === 'm2' || g.st === 'closing')?.list[0] ?? grouped[0]?.list[0] ?? null
  const clientId = params.get('client') ?? firstPick?.id ?? ''
  const record = live.find((r) => r.id === clientId) ?? null

  const setView = (v: 'client' | 'catalog') => setParams((p) => { const n = new URLSearchParams(p); if (v === 'catalog') n.set('view', 'catalog'); else n.delete('view'); return n }, { replace: true })
  const pick = (id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('client', id); return n }, { replace: true })

  const persist = async (next: ClientOpsRecord, msg: string) => {
    if (next === record) {
      showToast(msg)
      return
    }
    setRecords((list) => list.map((r) => (r.id === next.id ? next : r)))
    try {
      const saved = await saveClient(next)
      setRecords((list) => list.map((r) => (r.id === saved.id ? saved : r)))
      showToast(msg)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
      void load()
    }
  }

  const savePrice = async (id: string, fee: number | null) => {
    const next = { ...prices }
    if (fee === null) delete next[id]
    else next[id] = fee
    const clean = cleanPrices(next)
    setPrices(clean)
    try {
      const row = await saveRow(workspaceId, CATALOG_MODULE, CATALOG_BUCKET, { id: priceRowId, clientId: '', data: { key: 'prices', value: clean } })
      setPriceRowId(row.id)
      showToast(fee === null ? '원본 가격으로 되돌렸습니다.' : '가격을 고쳤습니다.')
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '가격을 저장하지 못했습니다.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ScreenTitle title="영업 관리" sub={`${today} · 상품·제안 — 추천 상품 · 제안서 · 업무범위서 · 월납 · 계약 준비`} />
      <SalesTabs />

      <div role="group" aria-label="상품·제안 보기" data-testid="proposal-view" className="grid grid-cols-2 gap-1 rounded-(--radius-control) border border-slate-200 bg-white p-1 sm:inline-flex sm:self-start">
        {([['client', '고객 제안'], ['catalog', `상품표 ${catalog.length}`]] as const).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={`tap rounded-[8px] px-3 py-2 text-[0.9rem] font-semibold sm:px-4 ${view === k ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-(--radius-control) border border-danger-200 bg-danger-50 px-4 py-3 text-[0.95rem] text-danger-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="t-sub text-slate-500">불러오는 중…</p>
      ) : view === 'catalog' ? (
        <CatalogView catalog={catalog} prices={prices} onSavePrice={(id, fee) => void savePrice(id, fee)} />
      ) : live.length === 0 ? (
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-12 text-center">
          <PackageSearch aria-hidden="true" className="mx-auto size-9 text-brand-400" />
          <p className="mt-3 text-[1.2rem] font-bold text-slate-900">제안할 업체가 없습니다</p>
          <Link to="/sales/board" className="mt-4 inline-flex font-semibold text-brand-700 hover:underline">영업 보드에서 잠재고객 등록 →</Link>
        </div>
      ) : (
        <>
          <label className="flex max-w-xl flex-col gap-1 text-[0.85rem] text-slate-500">
            고객
            <select value={record?.id ?? ''} onChange={(e) => pick(e.target.value)} aria-label="제안할 고객" className={`${inputClass} !mt-0 font-semibold`}>
              {grouped.map((g) => (
                <optgroup key={g.st} label={SALES_STAGE_LABEL[g.st]}>
                  {g.list.map((r) => <option key={r.id} value={r.id}>{r.companyName}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          {record && (
            <>
              <p className="flex flex-wrap items-center gap-2">
                <Link to={`/ops/clients/${record.id}`} className="t-card inline-flex items-center gap-1 font-bold text-slate-900 hover:text-brand-700 hover:underline">
                  {record.companyName}
                  <ChevronRight aria-hidden="true" className="size-4 text-slate-400" />
                </Link>
                <Badge>{SALES_STAGE_LABEL[salesStageOf(record)]}</Badge>
                {record.sales?.proposal && <Badge tone="brand">{record.sales.proposal.status}</Badge>}
                {(record.sales?.interests?.length ?? 0) > 0 && <PillList items={record.sales?.interests ?? []} />}
              </p>
              <ProposalWork key={record.id} record={record} catalog={catalog} onSave={(n, m) => void persist(n, m)} />
            </>
          )}
        </>
      )}
    </div>
  )
}

export function ProposalPage() {
  return <WorkspaceScope>{(ctx) => <ProposalContent workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}
