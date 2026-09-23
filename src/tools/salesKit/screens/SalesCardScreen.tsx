/**
 * 영업 카드 — 업체 한 곳의 영업 일 전부 (D-92).
 *
 * 원본(기업컨설팅 세일즈 OS)의 고객 상세 + 방문용 리포트 + 제안서 초안 + 업무범위서·견적 + 제안 상태 +
 * 계약 체크리스트 + 계약 준비팩 + 영업 프로세스 허브(1장 요약·녹취 분석·2차 자료·월납 시뮬·계약/보류 분기·
 * 필수서류·로드맵·장기관리·타임라인) + 제안거리 를 한 화면에 모았다.
 *
 * 글은 전부 원본 규칙(salesDocs.js)이 만든다 — 이 화면은 고르고, 보여 주고, 저장만 한다.
 * 업체는 고객 운영의 업체다. 이 카드는 그 업체 위에 영업 기록(모듈 기록 `sales-kit/accounts`)을 얹는다.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, Copy, Printer } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge, Section, Surface } from '../../../components/ui/primitives'
import { useToast } from '../../../components/ui/toastContext'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { CUST_FLAGS, CUST_SECTIONS, HOLD_REASONS, MANAGE_CYCLES, financeSignal, holdReasonAdvice, holdReasonMessage, manageMessage, missedConsultItems, referralAdvice, referralMessage, buildMeetingPlan, stageOf } from '../lib/salesData.js'
import type { SalesItem, SalesPackage } from '../lib/salesData.js'
import {
  CONTACT_TYPES,
  CONTRACT_CHECKLIST,
  DEAL_RESULTS,
  DOC_STATUSES,
  MANAGE_MSG_KINDS,
  MONTHLY_QUICK,
  NEXT_ACTIONS,
  PREP_DOC_STATES,
  PREP_NEXT_ACTIONS,
  PROPOSAL_STATES,
  REQUIRED_DOCS,
  affordability,
  analyzeTranscript,
  buildDocRequestText,
  buildKakaoSet,
  buildMeetingReport,
  buildOnePager,
  buildProposal,
  buildQuoteText,
  buildScopeDoc,
  buildSecondMeetingDoc,
  buildTimeline,
  buildVisitKakaoSet,
  buildVisitReport,
  bundleReason,
  currentIssueSummary,
  custNetIncomeMan,
  customerShareSummary,
  defaultRoadmap,
  extraCheckItems,
  followUpKakao,
  getAffordSettings,
  getPackages,
  getReportProfile,
  insuranceSim,
  manToText,
  matchPackages,
  pkgDuration,
  prepBriefing,
  prepDiagText,
  prepDocs,
  prepKakaos,
  prepPoints,
  prepQuestions,
  prepSufficiency,
  relatedTopicsForCustomer,
  scopeItems,
  scopeKakaoSet,
  topRecommendations,
  topicKakao,
  topicPackages,
  visitReasonText,
  visitRequestDocs,
  wonFromMillion,
} from '../lib/salesDocs.js'
import type { RoadmapStep, SalesDocsData, TranscriptAnalysis } from '../lib/salesDocs.js'
import { STAGE_LABEL, type SalesStage } from '../lib/pipeline'
import type { AccountData } from '../lib/salesAccounts'
import { todayLocalDate } from '../../../lib/appClock'
import { addDays, toSalesItem, type DocRow, type SalesContact } from '../lib/salesItem'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

/* 원본 방문용 리포트 색 (App.jsx VisitReport `R`) */
const R = { bg: '#FBF9F3', text: '#222730', sub: '#5C6470', bd: '#E3DCCB', accent: '#9A7B2E', card: '#FFFFFF' }

/* 원본 제안 상태 색 (PROPOSAL_STATE_STYLE) */
const PROPOSAL_STYLE: Record<string, [string, string]> = {
  '제안 전': ['#64748B', '#EEF2F7'],
  '제안서 작성': ['#2563EB', '#E8F1FE'],
  '제안 완료': ['#0284C7', '#E0F2FE'],
  '견적 전달': ['#7C3AED', '#F2ECFE'],
  '검토 중': ['#D97706', '#FDF1E1'],
  '조건 조율': ['#D97706', '#FDF1E1'],
  '계약 예정': ['#B45309', '#FCEFDA'],
  '계약 완료': ['#059669', '#E7F6EF'],
  보류: ['#64748B', '#EEF2F7'],
}
const DOC_STYLE: Record<string, string> = { 미요청: '#64748B', 요청완료: '#2563EB', 수령완료: '#059669', 보완필요: '#D97706' }
const ROAD_STYLE: Record<string, string> = { 예정: '#64748B', 진행중: '#2563EB', 완료: '#059669', 보류: '#D97706' }

/* ------------------------------------------------------------------ */
/* 작은 조각                                                             */
/* ------------------------------------------------------------------ */

function useCopy() {
  const { showToast } = useToast()
  return async (text: string, msg = '복사되었습니다.') => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(msg)
    } catch {
      showToast('복사하지 못했습니다. 글을 길게 눌러 복사하세요.')
    }
  }
}

function CopyBtn({ text, label = '복사', testId }: { text: string; label?: string; testId?: string }) {
  const [done, setDone] = useState(false)
  const copy = useCopy()
  return (
    <Button
      size="sm"
      variant="ghost"
      data-testid={testId}
      onClick={() => {
        void copy(text).then(() => {
          setDone(true)
          window.setTimeout(() => setDone(false), 1400)
        })
      }}
    >
      {done ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
      {done ? '복사됨' : label}
    </Button>
  )
}

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-(--radius-control) border border-slate-200 bg-white p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="t-sub font-bold text-slate-800">{title}</span>
        <CopyBtn text={text} />
      </div>
      <p className="t-sub break-keep whitespace-pre-wrap text-slate-600">{text}</p>
    </div>
  )
}

function Hub({ title, sub, open, onToggle, children, color = '#B45309', testId }: { title: string; sub?: string; open: boolean; onToggle: () => void; children: ReactNode; color?: string; testId?: string }) {
  return (
    <div className="overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white" data-testid={testId}>
      <button type="button" aria-expanded={open} onClick={onToggle} className="tap flex w-full items-center gap-2 px-4 py-3 text-left">
        <ChevronRight aria-hidden="true" className={`size-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="t-card font-black" style={{ color }}>
          {title}
        </span>
        {sub && <span className="t-meta text-slate-500">· {sub}</span>}
      </button>
      {open && <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3">{children}</div>}
    </div>
  )
}

function Pill({ on, onClick, children, color = '#2563EB' }: { on: boolean; onClick: () => void; children: ReactNode; color?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="tap t-meta rounded-full border px-2.5 py-1 font-bold"
      style={{ borderColor: on ? color : '#CBD5E1', background: on ? color : '#fff', color: on ? '#fff' : '#475569' }}
    >
      {on ? '✓ ' : ''}
      {children}
    </button>
  )
}

/** 인쇄용 글 — 화면에 펼쳐 두고 브라우저 인쇄 */
function PrintText({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <Surface className="flex flex-col gap-2 p-4" data-testid="sales-print">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="t-card font-bold text-slate-900">{title}</span>
        <span className="flex gap-2">
          <CopyBtn text={text} />
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            <Printer aria-hidden="true" className="size-4" /> 인쇄
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </span>
      </div>
      <pre className="t-sub max-h-[32rem] overflow-auto rounded-(--radius-control) border border-slate-200 bg-white p-4 break-keep whitespace-pre-wrap text-slate-800" id="visitReport">
        {text}
      </pre>
    </Surface>
  )
}

/* ------------------------------------------------------------------ */
/* 방문용 리포트 — 원본 모양 그대로                                        */
/* ------------------------------------------------------------------ */

function VisitReportView({ item, mode, data }: { item: SalesItem; mode: 'customer' | 'internal'; data: SalesDocsData }) {
  const p = getReportProfile(data)
  const name = item.companyName || item.name || ''
  const recos = topRecommendations(item)
  const extra = extraCheckItems(item)
  const docs = visitRequestDocs(item)
  const dateK = todayLocalDate().replace(/-/g, '.')
  const contacts = (item.contacts as SalesContact[] | undefined) ?? []
  const sec = (title: string, children: ReactNode) => (
    <div className="mb-3 rounded-xl border p-4" style={{ background: R.card, borderColor: R.bd, breakInside: 'avoid' }}>
      <div className="t-card mb-2 font-black" style={{ color: R.accent }}>
        {title}
      </div>
      {children}
    </div>
  )
  return (
    <div id="visitReport" className="mx-auto w-full max-w-[760px] rounded-2xl p-5 sm:p-7" style={{ background: R.bg, color: R.text }} data-testid="sales-visit-report">
      <div className="mb-4 border-b-2 pb-3.5" style={{ borderColor: R.accent }}>
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <div className="t-meta font-black tracking-[2px]" style={{ color: R.accent }}>
              {p.org}
            </div>
            <h2 className="mt-1.5 text-[1.45rem] font-black" style={{ color: R.text }}>
              법인컨설팅 사전 점검 리포트
            </h2>
          </div>
          <div className="t-sub text-right" style={{ color: R.sub }}>
            <div>
              {p.consultant} {p.title}
            </div>
            <div>작성일 {dateK}</div>
          </div>
        </div>
        <div className="t-body mt-3 flex flex-wrap gap-4">
          <div>
            <b>고객사</b> {name}
          </div>
          <div>
            <b>상담 단계</b> {stageOf(String(item.stage ?? '')).label}
          </div>
          <div style={{ color: R.sub }}>{mode === 'customer' ? '대표님 공유용' : '내부 검토용'}</div>
        </div>
      </div>
      {sec(
        '1. 회사 현황 요약',
        <div className="t-body break-keep">
          {String(item.industry || '-')} · 매출 {wonFromMillion(item.revenue)} · 직원 {String(item.empCount || '-')}명 · 업력 {String(item.estYears || '-')}년 · 상담 단계 {stageOf(String(item.stage ?? '')).label}
          {item.concern && <div className="mt-1.5" style={{ color: R.sub }}>주요 고민: {item.concern}</div>}
        </div>,
      )}
      {sec('2. 지금 점검이 필요한 이유', <div className="t-body break-keep">{visitReasonText(item, mode)}</div>)}
      {sec(
        '3. 우선 검토 후보 TOP 3',
        <div className="grid gap-2.5">
          {recos.map((r, i) => (
            <div key={r.name} className="border-l-[3px] pl-3" style={{ borderColor: R.accent }}>
              <div className="t-body font-extrabold">
                {i + 1}. {r.name}
              </div>
              <div className="t-sub mt-0.5 break-keep" style={{ color: R.sub }}>
                · 점검 포인트: {mode === 'internal' ? r.reason : '대표님 상황에서 한 번 확인해보면 좋은 부분입니다.'}
              </div>
              <div className="t-sub break-keep" style={{ color: R.sub }}>
                · 필요 자료: {r.docs.join(', ')}
              </div>
              <div className="t-sub break-keep" style={{ color: '#9A4A2E' }}>
                · 유의: {r.risk}
              </div>
            </div>
          ))}
        </div>,
      )}
      {mode === 'internal' &&
        sec(
          '3-1. [내부] 영업 포인트 · 리스크 · 다음 액션',
          <div className="t-sub grid gap-1 break-keep">
            <div>
              · 핵심 영업 포인트: <b>{recos[0]?.name}</b>
              {recos.length > 1 ? ` → ${recos.slice(1).map((r) => r.name).join(' / ')} 확장` : ''}
            </div>
            <div>· 예상 리스크: {recos[0]?.risk}</div>
            <div>· 조심할 표현: 효과·수급·인증 단정 금지 → “검토 가능성 · 자료 확인 후 판단 · 세무사 검토 권장”</div>
            <div>· 다음 액션: {String(item.nextAction || '자료 요청')} → 자료 확인 후 2차 미팅 제안</div>
            {Number(item.expectedFee) > 0 && <div>· 예상 수임료(내부): {Number(item.expectedFee).toLocaleString()}만원</div>}
            <div>· 추천 상품/패키지: {matchPackages(item, getPackages(data)).map((m) => m.pkg.name).join(' / ')}</div>
          </div>,
        )}
      {mode === 'internal' &&
        contacts.length > 0 &&
        sec(
          '3-2. [내부] 최근 연락 이력',
          <div className="t-sub grid gap-1">
            {contacts.slice(0, 5).map((ct) => (
              <div key={ct.id}>
                {ct.date.replace(/-/g, '.')} · {ct.type}
                {ct.memo ? ` — ${ct.memo}` : ''}
                {ct.nextAction ? ` (다음: ${ct.nextAction})` : ''}
              </div>
            ))}
          </div>,
        )}
      {sec(
        '4. 추가로 확인하면 좋은 항목',
        <div className="flex flex-wrap gap-1.5">
          {extra.map((x) => (
            <span key={x} className="t-sub rounded-full px-3 py-1 font-bold" style={{ background: '#F0EADA', color: R.text }}>
              {x}
            </span>
          ))}
        </div>,
      )}
      {sec(
        '5. 요청 자료 체크리스트',
        <div className="t-body grid gap-1.5">
          {docs.map((d) => (
            <div key={d}>☐ {d}</div>
          ))}
        </div>,
      )}
      {sec('6. 다음 미팅 제안', <div className="t-body break-keep">자료 확인 후 실제 적용 가능성이 있는 부분만 추려서 다시 정리드리겠습니다. 부담 없이 현재 상황과 우선순위만 함께 확인하는 자리로 봐주시면 됩니다.</div>)}
      <div className="rounded-[10px] border p-3.5" style={{ background: '#F3EEE0', borderColor: R.bd }}>
        <div className="t-sub mb-2 break-keep" style={{ color: R.text }}>
          ※ {p.footer}
        </div>
        <div className="t-sub" style={{ color: R.sub }}>
          {p.consultant} {p.title} · {p.org}
          {p.phone ? ` · ${p.phone}` : ''}
          {p.email ? ` · ${p.email}` : ''}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 영업 카드                                                             */
/* ------------------------------------------------------------------ */

export interface SalesCardProps {
  client: ClientOpsRecord
  account: AccountData
  save: (next: Partial<AccountData>) => Promise<void>
  /** 설정 화면에서 적은 리포트 담당자·월납 기준 */
  data: SalesDocsData
}

export function SalesCard({ client, account, save, data }: SalesCardProps) {
  const { showToast } = useToast()
  const copy = useCopy()
  const item = useMemo(() => toSalesItem(client, account), [client, account])
  const today = todayLocalDate()
  const [open, setOpen] = useState<Record<string, boolean>>({ info: true, visit: true })
  const tog = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }))
  const [visitMode, setVisitMode] = useState<'customer' | 'internal'>('customer')
  const [propMode, setPropMode] = useState<'customer' | 'internal'>('customer')
  const [print, setPrint] = useState<{ title: string; text: string } | null>(null)
  const packages = useMemo(() => getPackages(data), [data])
  const matched = useMemo(() => matchPackages(item, packages), [item, packages])
  const [pickPkgs, setPickPkgs] = useState<string[]>(() => ((account.proposedPackages as string[] | undefined) ?? []).length ? (account.proposedPackages as string[]) : matched.map((m) => m.pkg.name))
  const [scopePkg, setScopePkg] = useState<string>(() => matched[0]?.pkg.name ?? packages[0]?.name ?? '')
  const [tr, setTr] = useState<string>((account.transcript as string | undefined) ?? '')
  const [sim, setSim] = useState({ monthlyMan: Number(account.simMonthly) || 200, months: 84, rate: 100 })
  const [contact, setContact] = useState({ date: today, type: CONTACT_TYPES[0], memo: '', nextAction: '' })
  const [prepNext, setPrepNext] = useState({ date: '', action: PREP_NEXT_ACTIONS[0], memo: '' })

  const profile = getReportProfile(data)
  const affordSet = getAffordSettings(data)
  const sig = financeSignal(item)
  const recos = topRecommendations(item)
  const flags = (account.flags as Record<string, boolean> | undefined) ?? {}
  const contacts = (account.contacts as SalesContact[] | undefined) ?? []
  const docList = (account.docChecklist as DocRow[] | undefined) ?? []
  const roadmap = (account.roadmap as RoadmapStep[] | undefined) ?? []
  const contractChecks = (account.contractChecks as Record<string, boolean> | undefined) ?? {}
  const prepDocState = (account.prepDocState as Record<string, string> | undefined) ?? {}
  const ta = account.transcriptAnalysis as TranscriptAnalysis | undefined
  const proposalStatus = (account.proposalStatus as string | undefined) || '제안 전'
  const chosen = packages.filter((p) => pickPkgs.includes(p.name))
  const scopeP: SalesPackage | undefined = packages.find((p) => p.name === scopePkg)
  const timeline = buildTimeline(item)
  const net = custNetIncomeMan(item)
  const aff = affordability(sim.monthlyMan, net, affordSet)
  const simR = insuranceSim(sim.monthlyMan, sim.months, sim.rate)
  const suff = prepSufficiency(item)

  const setNum = (k: string, v: string) => void save({ [k]: v === '' ? '' : Number(v.replace(/[^\d.-]/g, '')) || 0 })

  const setProposal = (st: string) => {
    if (proposalStatus === st) return
    const history = ((account.stageHistory as unknown[] | undefined) ?? []).concat([{ date: today, from: `[제안] ${proposalStatus}`, to: `[제안] ${st}` }])
    const extra: Partial<AccountData> = {}
    if (st === '견적 전달' && !account.quotedAt) extra.quotedAt = today
    if (st === '계약 완료' && !account.contractedAt) extra.contractedAt = today
    void save({ proposalStatus: st, stageHistory: history, ...extra })
    showToast(`제안 상태: ${st}`)
  }
  const recordProposal = () => {
    const fee = chosen.reduce((s, x) => s + (Number(x.fee) || 0), 0)
    void save({ proposedPackages: chosen.map((x) => x.name), proposedAt: today, proposedFee: fee, proposalStatus: '제안 완료' })
    showToast('제안 기록을 남겼습니다.')
  }
  const setResult = (r: string) => {
    const patch: Partial<AccountData> = { dealResult: r }
    if (r === '계약') {
      patch.proposalStatus = '계약 완료'
      patch.stage = 'contracted' as SalesStage
      if (!account.contractedAt) patch.contractedAt = today
      if (!roadmap.length) patch.roadmap = defaultRoadmap(item)
      if (!docList.length) patch.docChecklist = REQUIRED_DOCS.map((n) => ({ name: n, status: '미요청', requestedAt: '', receivedAt: '', memo: '', location: '' }))
      showToast('계약 완료로 처리하고 로드맵·필수서류를 준비했습니다.')
    } else if (r === '보류') {
      patch.proposalStatus = '보류'
      patch.stage = 'hold' as SalesStage
      if (!account.nextContactAt) patch.nextContactAt = addDays(today, 30)
      showToast('보류로 처리했습니다. 사유와 다음 연락일을 정리해주세요.')
    } else if (r === '거절') {
      showToast('거절로 처리했습니다. 사유와 재접촉 시점을 정리해주세요.')
    } else if (r === '장기관리') {
      if (!account.manageCycle) patch.manageCycle = 60
      if (!account.nextContactAt) patch.nextContactAt = addDays(today, 60)
      showToast('장기관리로 전환했습니다.')
    }
    void save(patch)
  }
  const setDoc = (idx: number, key: keyof DocRow, val: string) => {
    const list = docList.slice()
    if (!list[idx]) return
    list[idx] = { ...list[idx], [key]: val }
    if (key === 'status' && val === '요청완료' && !list[idx].requestedAt) list[idx].requestedAt = today
    if (key === 'status' && val === '수령완료' && !list[idx].receivedAt) list[idx].receivedAt = today
    void save({ docChecklist: list })
  }
  const setRoad = (idx: number, status: string) => {
    const list = roadmap.slice()
    if (!list[idx]) return
    list[idx] = { ...list[idx], status }
    void save({ roadmap: list })
  }
  const addContact = () => {
    const c: SalesContact = { id: `c${Date.now().toString(36)}`, ...contact }
    void save({ contacts: [c, ...contacts], lastContactedAt: c.date, ...(c.nextAction ? { nextAction: c.nextAction } : {}) })
    setContact({ date: today, type: CONTACT_TYPES[0], memo: '', nextAction: '' })
    showToast('이력을 추가했습니다.')
  }
  const trAnalyze = () => {
    if (!tr.trim()) {
      showToast('녹취록/스크립트 텍스트를 붙여넣어 주세요.')
      return
    }
    const a = analyzeTranscript(tr)
    void save({ transcript: tr.slice(0, 20000), transcriptAnalysis: a })
    showToast('녹취록을 분석해 저장했습니다. 결과를 확인해주세요.')
  }

  const visitText = buildVisitReport(item, visitMode, profile)
  const proposalText = buildProposal(item, chosen, propMode, profile)
  const docProgress = docList.length ? `${docList.filter((d) => d.status === '수령완료').length}/${docList.length} 수령` : ''

  return (
    <div className="flex flex-col gap-3" data-testid="sales-card" data-client={client.id}>
      {/* 재무 신호등 */}
      <div className="rounded-(--radius-panel) border px-4 py-3" style={{ background: sig.bg, borderColor: `${sig.color ?? '#64748B'}40` }} data-testid="sales-signal">
        <div className="t-card font-black" style={{ color: sig.color }}>
          {sig.label}
        </div>
        <div className="t-sub mt-1 break-keep text-slate-700">
          {sig.advice}
          {sig.reasons.length ? ` · ${sig.reasons.slice(0, 2).join(' / ')}` : ''}
          {sig.opportunities?.length ? ` · 기회: ${sig.opportunities[0]}` : ''}
        </div>
        <p className="t-meta mt-1 break-keep text-slate-500">{currentIssueSummary(item)}</p>
      </div>

      {print && <PrintText title={print.title} text={print.text} onClose={() => setPrint(null)} />}

      <Hub title="🏢 영업 정보" sub={`${STAGE_LABEL[account.stage]} · ${String(item.industry || '업종 미입력')}`} open={!!open.info} onToggle={() => tog('info')} color="#0F172A" testId="sales-card-info">
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="t-meta text-slate-500">업종</span>
            <input aria-label="업종" defaultValue={String(item.industry ?? '')} onBlur={(e) => void save({ industry: e.target.value })} className={inputCls} />
          </label>
          <label className="block">
            <span className="t-meta text-slate-500">매출 (백만원)</span>
            <input aria-label="매출 백만원" inputMode="numeric" defaultValue={String(account.revenue ?? '')} onBlur={(e) => setNum('revenue', e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="t-meta text-slate-500">직전년도 당기순이익 (만원)</span>
            <input aria-label="당기순이익 만원" inputMode="numeric" defaultValue={String(account.netIncome ?? '')} onBlur={(e) => setNum('netIncome', e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="t-meta text-slate-500">직원 수</span>
            <input aria-label="직원 수" inputMode="numeric" defaultValue={String(item.empCount ?? '')} onBlur={(e) => setNum('empCount', e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="t-meta text-slate-500">업력 (년)</span>
            <input aria-label="업력" inputMode="numeric" defaultValue={String(item.estYears ?? '')} onBlur={(e) => setNum('estYears', e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="t-meta text-slate-500">대표 나이</span>
            <input aria-label="대표 나이" inputMode="numeric" defaultValue={String(item.ceoAge ?? '')} onBlur={(e) => setNum('ceoAge', e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="block">
          <span className="t-meta text-slate-500">대표 고민</span>
          <input aria-label="대표 고민" defaultValue={String(account.concern ?? '')} onBlur={(e) => void save({ concern: e.target.value })} className={inputCls} placeholder="예: 승계 준비, 가지급금 정리" />
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="t-meta text-slate-500">다음 액션</span>
          {NEXT_ACTIONS.map((a) => (
            <Pill key={a} on={account.nextAction === a} onClick={() => void save({ nextAction: a })}>
              {a}
            </Pill>
          ))}
        </div>
        {CUST_SECTIONS.map((sec) => (
          <div key={sec} className="flex flex-col gap-1">
            <span className="t-meta font-bold text-slate-600">{sec}</span>
            <div className="flex flex-wrap gap-1.5">
              {CUST_FLAGS.filter((f) => f[2] === sec).map(([k, label]) => (
                <Pill key={k} on={!!flags[k]} onClick={() => void save({ flags: { ...flags, [k]: !flags[k] } })} color="#7C3AED">
                  {label}
                </Pill>
              ))}
            </div>
          </div>
        ))}
        {missedConsultItems(item).length > 0 && (
          <p className="t-sub break-keep text-slate-600">
            놓치기 쉬운 점검 항목: <b>{missedConsultItems(item).join(', ')}</b>
          </p>
        )}
      </Hub>

      <Hub title="🎯 제안 우선순위 TOP 3 · 추천 상품 · 후속 카톡" open={!!open.top} onToggle={() => tog('top')} testId="sales-card-top">
        <ol className="grid gap-2" data-testid="sales-top3">
          {recos.map((r, i) => (
            <li key={r.name} className="rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3">
              <div className="t-body font-bold text-slate-900">
                {i + 1}. {r.name} {r.needTaxPro && <Badge tone="warning">세무사 검토 권장</Badge>}
              </div>
              <p className="t-sub mt-0.5 break-keep text-slate-600">· 이유: {r.reason}</p>
              <p className="t-sub break-keep text-slate-600">· 필요 자료: {r.docs.join(', ')}</p>
              <p className="t-sub break-keep text-[#9A4A2E]">· 유의: {r.risk}</p>
              <p className="t-sub break-keep text-slate-700">· 한마디: {r.pitch}</p>
            </li>
          ))}
        </ol>
        <div>
          <p className="t-sub mb-1 font-bold text-slate-800">추천 상품 (원본 패키지 매칭)</p>
          <ul className="grid gap-1.5 sm:grid-cols-3">
            {matched.map((m) => (
              <li key={m.pkg.id} className="rounded-(--radius-control) border border-slate-200 p-2.5">
                <div className="t-sub font-bold text-slate-900">{m.pkg.name}</div>
                <div className="t-meta text-slate-500">
                  {m.pkg.cat} · {m.pkg.fee}만원 · {pkgDuration(m.pkg)}
                </div>
                <div className="t-meta mt-0.5 break-keep text-slate-600">{m.reason}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-2">
          {buildKakaoSet(item).map(([t, x]) => (
            <TextBlock key={t} title={t} text={x} />
          ))}
          <TextBlock title="자료 요청 문구" text={buildDocRequestText(item)} />
          <TextBlock title="다음 연락 문구 (고객 유형별)" text={followUpKakao(item)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setPrint({ title: '미팅 준비 리포트', text: buildMeetingReport(item) })}>
            📄 미팅 준비 리포트
          </Button>
        </div>
      </Hub>

      <Hub title="📋 방문용 리포트" sub={visitMode === 'customer' ? '대표님 공유용' : '내부 검토용'} open={!!open.visit} onToggle={() => tog('visit')} testId="sales-card-visit">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <Pill on={visitMode === 'customer'} onClick={() => setVisitMode('customer')}>
              대표님 공유용
            </Pill>
            <Pill on={visitMode === 'internal'} onClick={() => setVisitMode('internal')}>
              내부 검토용
            </Pill>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <CopyBtn text={buildVisitReport(item, 'customer', profile)} label="대표님용 복사" testId="sales-visit-copy" />
            <CopyBtn text={buildVisitReport(item, 'internal', profile)} label="내부용 복사" />
            <CopyBtn text={visitRequestDocs(item).map((d) => `☐ ${d}`).join('\n')} label="요청자료 복사" />
            <CopyBtn text={customerShareSummary(item, profile)} label="대표님께 요약 보내기" />
            <Button size="sm" variant="primary" onClick={() => window.print()}>
              <Printer aria-hidden="true" className="size-4" /> PDF 저장/인쇄
            </Button>
          </div>
        </div>
        <VisitReportView item={item} mode={visitMode} data={data} />
        <p className="t-card font-black text-[#B45309]">💬 후속 카톡 문구 (상황별 3종)</p>
        <div className="grid gap-2">
          {buildVisitKakaoSet(item).map(([t, x]) => (
            <TextBlock key={t} title={t} text={x} />
          ))}
        </div>
        <span className="hidden">{visitText.length}</span>
      </Hub>

      <Hub title="📨 제안서 초안 · 제안 상태" sub={proposalStatus} open={!!open.prop} onToggle={() => tog('prop')} testId="sales-card-proposal">
        <div className="flex flex-wrap gap-1.5" data-testid="sales-proposal-states">
          {PROPOSAL_STATES.map((st) => {
            const [c, b] = PROPOSAL_STYLE[st] ?? ['#64748B', '#EEF2F7']
            const on = proposalStatus === st
            return (
              <button key={st} type="button" aria-pressed={on} onClick={() => setProposal(st)} className="tap t-meta rounded-full border px-2.5 py-1 font-bold" style={{ color: on ? '#fff' : c, background: on ? c : b, borderColor: c }}>
                {st}
              </button>
            )
          })}
        </div>
        <p className="t-sub font-bold text-slate-800">제안할 패키지 고르기</p>
        <div className="flex max-h-48 flex-wrap gap-1.5 overflow-auto">
          {packages.map((p) => (
            <Pill key={p.id} on={pickPkgs.includes(p.name)} onClick={() => setPickPkgs((w) => (w.includes(p.name) ? w.filter((x) => x !== p.name) : [...w, p.name]))} color="#B45309">
              {p.name}
            </Pill>
          ))}
        </div>
        {bundleReason(pickPkgs) && <p className="t-meta break-keep text-slate-500">함께 검토 이유: {bundleReason(pickPkgs)}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill on={propMode === 'customer'} onClick={() => setPropMode('customer')}>
            대표님 공유용
          </Pill>
          <Pill on={propMode === 'internal'} onClick={() => setPropMode('internal')}>
            내부 검토용
          </Pill>
          <span className="t-meta text-slate-500">
            합계 {chosen.reduce((s, x) => s + (Number(x.fee) || 0), 0).toLocaleString()}만원 (기준가)
          </span>
        </div>
        <pre className="t-sub max-h-80 overflow-auto rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3 break-keep whitespace-pre-wrap text-slate-700" data-testid="sales-proposal-text">
          {proposalText}
        </pre>
        <div className="flex flex-wrap gap-2">
          <CopyBtn text={proposalText} label="제안서 복사" />
          <Button size="sm" onClick={() => setPrint({ title: '제안서 초안', text: proposalText })}>
            <Printer aria-hidden="true" className="size-4" /> 보기·인쇄
          </Button>
          <Button size="sm" variant="primary" onClick={recordProposal} disabled={!chosen.length} data-testid="sales-proposal-record">
            제안 기록 남기기
          </Button>
        </div>
        {account.proposedAt ? (
          <p className="t-meta text-slate-500">
            마지막 제안 {String(account.proposedAt)} · {((account.proposedPackages as string[] | undefined) ?? []).join(', ')}
          </p>
        ) : null}
      </Hub>

      <Hub title="🧾 견적 · 업무범위서" sub={scopeP ? `${scopeP.name} · ${pkgDuration(scopeP)}` : ''} open={!!open.scope} onToggle={() => tog('scope')} testId="sales-card-scope">
        <select aria-label="업무범위서 패키지" value={scopePkg} onChange={(e) => setScopePkg(e.target.value)} className={inputCls}>
          {packages.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name} ({p.cat})
            </option>
          ))}
        </select>
        {scopeP && (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="block">
                <span className="t-meta text-slate-500">월납 제안 (만원)</span>
                <input aria-label="월납 제안" inputMode="numeric" defaultValue={String(account.proposalMonthlyPremium ?? '')} onBlur={(e) => {
                    const mo = Number(e.target.value.replace(/[^\d.]/g, '')) || 0
                    const lv = affordability(mo, net, affordSet)
                    void save({ proposalMonthlyPremium: mo, proposalAffordabilityStatus: lv.level, proposalNetIncomeBase: net ?? '', proposalProjectedValue: insuranceSim(mo, account.proposalMonths ?? 84, account.proposalRefundRate ?? 100).base })
                  }} className={inputCls} />
              </label>
              <label className="block">
                <span className="t-meta text-slate-500">납입 기간 (개월)</span>
                <input aria-label="납입 기간" inputMode="numeric" defaultValue={String(account.proposalMonths ?? 84)} onBlur={(e) => setNum('proposalMonths', e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="t-meta text-slate-500">환급률 (%)</span>
                <input aria-label="환급률" inputMode="numeric" defaultValue={String(account.proposalRefundRate ?? 100)} onBlur={(e) => setNum('proposalRefundRate', e.target.value)} className={inputCls} />
              </label>
            </div>
            <ul className="t-sub list-disc pl-5 text-slate-700">
              {scopeItems(scopeP).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <pre className="t-sub max-h-72 overflow-auto rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3 break-keep whitespace-pre-wrap text-slate-700" data-testid="sales-scope-text">
              {buildScopeDoc(item, scopeP, profile)}
            </pre>
            <div className="flex flex-wrap gap-2">
              <CopyBtn text={buildScopeDoc(item, scopeP, profile)} label="업무범위서 복사" />
              <CopyBtn text={buildQuoteText(item, scopeP)} label="견적 문구 복사" />
              <Button size="sm" onClick={() => setPrint({ title: '업무범위서 초안', text: buildScopeDoc(item, scopeP, profile) })}>
                <Printer aria-hidden="true" className="size-4" /> 보기·인쇄
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setProposal('견적 전달')}>
                견적 전달로 표시
              </Button>
            </div>
            <div className="grid gap-2">
              {scopeKakaoSet(item, scopeP).map(([t, x]) => (
                <TextBlock key={t} title={t} text={x} />
              ))}
            </div>
          </>
        )}
      </Hub>

      <Hub title="✅ 계약 준비 체크리스트" sub={`${CONTRACT_CHECKLIST.filter((c) => contractChecks[c]).length}/${CONTRACT_CHECKLIST.length}`} open={!!open.check} onToggle={() => tog('check')} testId="sales-card-checklist">
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {CONTRACT_CHECKLIST.map((c) => (
            <li key={c}>
              <label className="t-sub flex items-center gap-2 text-slate-700">
                <input type="checkbox" checked={!!contractChecks[c]} onChange={() => void save({ contractChecks: { ...contractChecks, [c]: !contractChecks[c] } })} className="size-4" />
                {c}
              </label>
            </li>
          ))}
        </ul>
      </Hub>

      <Hub title="🎁 계약 준비팩" sub={`정보 ${suff.level}`} open={!!open.prep} onToggle={() => tog('prep')} testId="sales-card-prep">
        <span className="t-meta w-fit rounded-md px-2 py-0.5 font-bold" style={{ color: suff.color, background: suff.bg }}>
          정보 충분도 {suff.level} ({suff.pts}/7)
        </span>
        <pre className="t-sub rounded-(--radius-control) bg-slate-50 p-3 break-keep whitespace-pre-wrap text-slate-700">{prepBriefing(item)}</pre>
        <p className="t-sub font-bold text-slate-800">미팅 질문 10</p>
        <ol className="t-sub grid gap-1 text-slate-700">
          {prepQuestions(item).map(([cat, q], i) => (
            <li key={cat}>
              {i + 1}. <b>[{cat}]</b> {q}
            </li>
          ))}
        </ol>
        <p className="t-sub font-bold text-slate-800">제안 포인트</p>
        <div className="grid gap-2">
          {prepPoints(item).map((p) => (
            <div key={p.name} className="rounded-(--radius-control) border border-slate-200 p-2.5">
              <div className="t-sub font-bold">{p.name}</div>
              <div className="t-meta break-keep text-slate-600">왜: {p.why}</div>
              <div className="t-meta break-keep text-slate-700">멘트: {p.ment}</div>
              <div className="t-meta break-keep text-[#9A4A2E]">유의: {p.caution}</div>
            </div>
          ))}
        </div>
        <p className="t-sub font-bold text-slate-800">준비 자료</p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {prepDocs(item).map((d) => (
            <li key={d} className="flex items-center justify-between gap-2 rounded-(--radius-control) bg-slate-50 px-2.5 py-1.5">
              <span className="t-sub text-slate-700">{d}</span>
              <select aria-label={`${d} 상태`} value={prepDocState[d] ?? PREP_DOC_STATES[0]} onChange={(e) => void save({ prepDocState: { ...prepDocState, [d]: e.target.value } })} className="t-meta rounded border border-slate-300 bg-white px-1 py-0.5">
                {PREP_DOC_STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>
        <div className="grid gap-2">
          {prepKakaos(item).map(([t, x]) => (
            <TextBlock key={t} title={t} text={x} />
          ))}
          <TextBlock title="대표용 1페이지 진단" text={prepDiagText(item)} />
        </div>
        <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="t-meta text-slate-500">다음 연락일</span>
            <input type="date" aria-label="준비팩 다음 연락일" value={prepNext.date} onChange={(e) => setPrepNext((s) => ({ ...s, date: e.target.value }))} className={inputCls} />
          </label>
          <select aria-label="준비팩 다음 액션" value={prepNext.action} onChange={(e) => setPrepNext((s) => ({ ...s, action: e.target.value }))} className={inputCls}>
            {PREP_NEXT_ACTIONS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <input aria-label="준비팩 메모" value={prepNext.memo} onChange={(e) => setPrepNext((s) => ({ ...s, memo: e.target.value }))} placeholder="메모" className={inputCls} />
          <Button
            size="sm"
            onClick={() => {
              void save({ nextContactAt: prepNext.date || addDays(today, 7), nextAction: prepNext.action, memo: prepNext.memo ? `${account.memo ? `${account.memo}\n` : ''}[준비팩] ${prepNext.memo}` : account.memo })
              showToast('다음 연락에 저장했습니다.')
            }}
          >
            다음 연락에 저장
          </Button>
        </div>
      </Hub>

      <Hub title="📝 1차 미팅 한 장 요약" open={!!open.one} onToggle={() => tog('one')} testId="sales-card-onepager">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={() => setPrint({ title: '1차 미팅 한 장 요약', text: buildOnePager(item, profile) })}>
            📄 요약 보기 / 인쇄
          </Button>
          <CopyBtn text={buildOnePager(item, profile)} label="요약 복사" />
          <CopyBtn text={buildMeetingPlan(item, 'm1').questions.slice(0, 6).map((q, i) => `${i + 1}) ${q}`).join('\n')} label="미팅 질문 복사" />
        </div>
      </Hub>

      <Hub title="🎙️ 1차 미팅 녹취록 분석" sub={ta ? `분석됨 ${ta.analyzedAt.replace(/-/g, '.')}` : ''} open={!!open.tr} onToggle={() => tog('tr')} testId="sales-card-transcript">
        <p className="t-meta break-keep text-slate-500">녹음 파일의 직접 음성 변환은 지원하지 않습니다. 클로바노트·다글로 등에서 변환한 텍스트를 붙여넣어 주세요.</p>
        <textarea aria-label="녹취록" rows={4} value={tr} onChange={(e) => setTr(e.target.value)} placeholder="1차 미팅 녹취록/스크립트 텍스트를 붙여넣어 주세요." className={inputCls} />
        <div className="flex flex-wrap gap-2">
          <label className="tap t-sub inline-flex cursor-pointer items-center rounded-(--radius-control) border border-slate-300 px-3 py-1.5">
            📎 TXT 첨부
            <input
              type="file"
              accept=".txt,text/plain"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                void file.text().then((t) => setTr((s) => (s ? `${s}\n` : '') + t))
              }}
            />
          </label>
          <Button size="sm" variant="primary" onClick={trAnalyze} data-testid="sales-transcript-run">
            🔍 녹취록 분석
          </Button>
        </div>
        {ta && (
          <div className="t-sub grid gap-1 rounded-(--radius-control) border border-slate-200 p-3 break-keep text-slate-700" data-testid="sales-transcript-result">
            <div>
              <b>요약</b> · {ta.summary}
            </div>
            <div>
              <b>대표 반응</b> · {ta.reaction}
            </div>
            {ta.interested.length > 0 && (
              <div>
                <b>관심</b> · {ta.interested.join(', ')}
              </div>
            )}
            {ta.hesitant.length > 0 && (
              <div>
                <b>부담</b> · {ta.hesitant.join(', ')}
              </div>
            )}
            {ta.newInfo.length > 0 && (
              <div>
                <b>새 정보</b> · {ta.newInfo.join(', ')}
              </div>
            )}
            <div>
              <b>2차 미팅 전략</b> · {ta.strategy}
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              <CopyBtn text={['[전략노트]', ta.summary, '', '■ 2차 미팅 때 다시 짚을 내용', ...ta.secondPoints.map((x) => `· ${x}`), '', '■ 다음 요청자료', ...ta.nextDocs.map((x) => `· ${x}`), '', '■ 후속 카톡', ta.kakao].join('\n')} label="전략노트 복사" />
              <CopyBtn text={ta.kakao} label="후속 카톡 복사" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void save({ nextContactAt: addDays(today, 7), nextAction: '2차 미팅 준비' })
                  setOpen((o) => ({ ...o, second: true }))
                  showToast('다음 연락일을 7일 후로 설정했습니다.')
                }}
              >
                다음 연락 일정 만들기
              </Button>
            </div>
          </div>
        )}
      </Hub>

      <Hub title="📑 2차 미팅 전략자료 · 월납 시뮬레이터" open={!!open.second} onToggle={() => tog('second')} testId="sales-card-second">
        <div className="flex flex-wrap gap-1.5">
          {MONTHLY_QUICK.map((m) => (
            <Pill key={m} on={Number(sim.monthlyMan) === m} onClick={() => setSim((s) => ({ ...s, monthlyMan: m }))}>
              {manToText(m)}
            </Pill>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="t-meta text-slate-500">월납(만원)</span>
            <input aria-label="월납 만원" inputMode="numeric" value={sim.monthlyMan} onChange={(e) => setSim((s) => ({ ...s, monthlyMan: Number(e.target.value) || 0 }))} className={inputCls} />
          </label>
          <label className="block">
            <span className="t-meta text-slate-500">납입기간(개월)</span>
            <input aria-label="납입기간" inputMode="numeric" value={sim.months} onChange={(e) => setSim((s) => ({ ...s, months: Number(e.target.value) || 0 }))} className={inputCls} />
          </label>
          <label className="block">
            <span className="t-meta text-slate-500">예상 환급률(%)</span>
            <input aria-label="예상 환급률" inputMode="numeric" value={sim.rate} onChange={(e) => setSim((s) => ({ ...s, rate: Number(e.target.value) || 0 }))} className={inputCls} />
          </label>
        </div>
        <div className="t-sub rounded-(--radius-control) bg-slate-50 px-3 py-2.5 text-slate-700" data-testid="sales-sim">
          월납 <b>{manToText(sim.monthlyMan)}</b> × {sim.months}개월 = 총 납입액 <b className="text-[#2563EB]">{manToText(simR.total)}</b>
          <br />
          환급률 {sim.rate}% 기준 시 {sim.months}개월 후 기준액 <b className="text-[#B45309]">{manToText(simR.base)}</b>
          <div className="t-meta mt-1.5 text-slate-500">※ 본 계산은 2차 미팅 설명용 단순 시뮬레이션입니다. 상품별 실제 환급률·조건은 달라질 수 있으며, 청약 전 상품설명서와 전문가 설명이 필요합니다.</div>
        </div>
        <div className="t-sub rounded-(--radius-control) border px-3 py-2.5 break-keep" style={{ background: aff.bg, borderColor: `${aff.color}55`, color: '#334155' }} data-testid="sales-afford">
          <b style={{ color: aff.color }}>월납 적정성 · {aff.label}</b>
          {aff.hasBase && (
            <span className="t-meta ml-2 text-slate-500">
              (직전년도 순이익 {manToText(net)} 기준 · 초록 {manToText(aff.greenLimit)} 이하 · 노랑 {manToText(aff.yellowLimit)} 이하)
            </span>
          )}
          <div className="mt-1">{aff.msg}</div>
          {aff.note && <div className="t-meta mt-1 text-slate-500">{aff.note}</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              void save({ simMonthly: Number(sim.monthlyMan) || 0 })
              setPrint({ title: '2차 미팅 전략자료', text: buildSecondMeetingDoc(item, profile, sim) })
            }}
          >
            📄 2차 자료 보기 / 인쇄
          </Button>
          <CopyBtn text={buildSecondMeetingDoc(item, profile, sim)} label="2차 자료 복사" />
        </div>
      </Hub>

      <Hub title="🧭 계약 / 보류 분기" sub={account.dealResult && account.dealResult !== '미정' ? String(account.dealResult) : ''} open={!!open.result} onToggle={() => tog('result')} testId="sales-card-result">
        <div className="flex flex-wrap gap-1.5">
          {DEAL_RESULTS.filter((r) => r !== '미정').map((r) => {
            const col = r === '계약' ? '#059669' : r === '보류' ? '#D97706' : r === '거절' ? '#DC2626' : '#2563EB'
            return (
              <Pill key={r} on={account.dealResult === r} onClick={() => setResult(r)} color={col}>
                {r}
              </Pill>
            )
          })}
        </div>
        {(account.dealResult === '보류' || account.dealResult === '거절' || account.dealResult === '장기관리') && (
          <div className="flex flex-col gap-2">
            <span className="t-meta text-slate-500">{String(account.dealResult)} 사유</span>
            <div className="flex flex-wrap gap-1.5">
              {HOLD_REASONS.map((h) => (
                <Pill key={h} on={account.dealReason === h} onClick={() => void save({ dealReason: h })}>
                  {h}
                </Pill>
              ))}
            </div>
            {typeof account.dealReason === 'string' && account.dealReason && <p className="t-sub rounded-(--radius-control) bg-slate-50 px-3 py-2 break-keep text-slate-700">{holdReasonAdvice(account.dealReason)}</p>}
            <div className="flex flex-wrap items-end gap-2">
              <label className="block">
                <span className="t-meta text-slate-500">다음 연락일</span>
                <input type="date" aria-label="보류 다음 연락일" value={account.nextContactAt} onChange={(e) => void save({ nextContactAt: e.target.value })} className={inputCls} />
              </label>
              <CopyBtn text={holdReasonMessage(item)} label="재접촉 메시지 복사" />
            </div>
          </div>
        )}
      </Hub>

      <Hub title="🗂️ 계약업체 필수서류" sub={docProgress} open={!!open.docs} onToggle={() => tog('docs')} testId="sales-card-docs">
        {!docList.length ? (
          <div className="flex flex-col gap-2">
            <p className="t-sub text-slate-500">필수서류 체크리스트가 아직 없습니다.</p>
            <Button size="sm" variant="primary" className="w-fit" onClick={() => void save({ docChecklist: REQUIRED_DOCS.map((n) => ({ name: n, status: '미요청', requestedAt: '', receivedAt: '', memo: '', location: '' })) })}>
              필수서류 체크리스트 만들기
            </Button>
          </div>
        ) : (
          <>
            <p className="t-meta break-keep text-slate-500">파일은 업체 서류함에 올립니다. 여기는 상태·메모·위치만 적습니다.</p>
            <ul className="grid gap-1.5">
              {docList.map((d, idx) => (
                <li key={d.name} className="flex flex-wrap items-center gap-2 rounded-(--radius-control) bg-slate-50 px-3 py-2">
                  <b className="t-sub min-w-[9rem]">{d.name}</b>
                  <select aria-label={`${d.name} 상태`} value={d.status} onChange={(e) => setDoc(idx, 'status', e.target.value)} className="t-sub rounded border border-slate-300 bg-white px-2 py-1 font-bold" style={{ color: DOC_STYLE[d.status] }}>
                    {DOC_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <input aria-label={`${d.name} 위치`} defaultValue={d.location} onBlur={(e) => setDoc(idx, 'location', e.target.value)} placeholder="PC 폴더 위치/메모" className={`${inputCls} min-w-0 flex-1`} />
                </li>
              ))}
            </ul>
            <CopyBtn text={`대표님, 진행을 위해 아래 서류를 준비 부탁드립니다.\n${docList.filter((d) => d.status !== '수령완료').map((d) => `☐ ${d.name}`).join('\n')}\n자료 준비 상황에 따라 일정은 조정될 수 있습니다.`} label="서류 요청 문구 복사" />
          </>
        )}
      </Hub>

      <Hub title="🗺️ 진행 로드맵" sub={roadmap.length ? `${roadmap.length}단계` : ''} open={!!open.road} onToggle={() => tog('road')} testId="sales-card-roadmap">
        {!roadmap.length ? (
          <Button size="sm" variant="primary" className="w-fit" onClick={() => void save({ roadmap: defaultRoadmap(item) })} data-testid="sales-roadmap-make">
            추천 로드맵 자동 생성
          </Button>
        ) : (
          <>
            <ul className="grid gap-1.5">
              {roadmap.map((r, idx) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-control) border-l-[3px] bg-slate-50 px-3 py-2" style={{ borderColor: ROAD_STYLE[r.status] ?? '#64748B' }}>
                  <div>
                    <b className="t-sub">
                      {r.month} · {r.task}
                    </b>
                    <div className="t-meta text-slate-500">
                      {r.purpose}
                      {r.docs ? ` · 자료: ${r.docs}` : ''}
                    </div>
                  </div>
                  <select aria-label={`${r.task} 상태`} value={r.status} onChange={(e) => setRoad(idx, e.target.value)} className="t-sub rounded border border-slate-300 bg-white px-2 py-1">
                    {['예정', '진행중', '완료', '보류'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <CopyBtn text={`[진행 로드맵]\n${roadmap.map((r) => `· ${r.month}: ${r.task} (${r.status})`).join('\n')}`} label="로드맵 복사" />
          </>
        )}
      </Hub>

      <Hub title="🔁 장기관리 / 추가제안" open={!!open.manage} onToggle={() => tog('manage')} testId="sales-card-manage">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="t-meta text-slate-500">관리 주기</span>
            <select
              aria-label="관리 주기"
              value={String(account.manageCycle ?? '')}
              onChange={(e) => {
                const days = Number(e.target.value) || 0
                void save({ manageCycle: days, nextContactAt: days ? addDays(today, days) : account.nextContactAt })
              }}
              className={inputCls}
            >
              <option value="">선택</option>
              {MANAGE_CYCLES.map(([l, d]) => (
                <option key={d} value={d}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className="t-meta text-slate-500">보낼 관리 메시지</span>
        <div className="flex flex-wrap gap-1.5">
          {MANAGE_MSG_KINDS.map((k) => (
            <Button key={k} size="sm" variant="ghost" onClick={() => void copy(manageMessage(item, k), '관리 메시지를 복사했습니다.')}>
              {k}
            </Button>
          ))}
        </div>
        <p className="t-sub break-keep text-slate-700">추가계약/소개 추천: {referralAdvice(item)}</p>
        <CopyBtn text={referralMessage(item)} label="소개 요청 문구 복사" />
      </Hub>

      <Hub title="📞 연락 이력" sub={`${contacts.length}건`} open={!!open.contacts} onToggle={() => tog('contacts')} testId="sales-card-contacts">
        <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr_1fr_auto] sm:items-end">
          <input type="date" aria-label="연락일" value={contact.date} onChange={(e) => setContact((s) => ({ ...s, date: e.target.value }))} className={inputCls} />
          <select aria-label="연락 종류" value={contact.type} onChange={(e) => setContact((s) => ({ ...s, type: e.target.value }))} className={inputCls}>
            {CONTACT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input aria-label="연락 메모" value={contact.memo} onChange={(e) => setContact((s) => ({ ...s, memo: e.target.value }))} placeholder="무슨 이야기를 했나" className={inputCls} />
          <input aria-label="연락 다음 액션" value={contact.nextAction} onChange={(e) => setContact((s) => ({ ...s, nextAction: e.target.value }))} placeholder="다음 액션" className={inputCls} />
          <Button size="sm" variant="primary" onClick={addContact} data-testid="sales-contact-add">
            추가
          </Button>
        </div>
        <ul className="grid gap-1" data-testid="sales-contacts">
          {contacts.map((c) => (
            <li key={c.id} className="t-sub flex flex-wrap items-center gap-2 text-slate-700">
              <span className="text-slate-500">{c.date.replace(/-/g, '.')}</span>
              <b>{c.type}</b>
              {c.memo && <span>— {c.memo}</span>}
              {c.nextAction && <span className="text-slate-500">(다음: {c.nextAction})</span>}
              <button type="button" className="t-meta ml-auto text-slate-400 hover:text-danger-700" onClick={() => void save({ contacts: contacts.filter((x) => x.id !== c.id) })}>
                지우기
              </button>
            </li>
          ))}
        </ul>
      </Hub>

      <Hub title="💡 제안거리 · 연락거리" open={!!open.ideas} onToggle={() => tog('ideas')} testId="sales-card-ideas">
        {relatedTopicsForCustomer(item).length === 0 ? (
          <p className="t-sub text-slate-500">관련 제안거리가 아직 분류되지 않았습니다. 관심사·직원 수·메모를 추가하면 자동으로 연결됩니다.</p>
        ) : (
          relatedTopicsForCustomer(item)
            .slice(0, 5)
            .map((x) => (
              <div key={x.topic.key} className="rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="t-body text-[#2563EB]">{x.topic.name}</b>
                  <Badge tone="warning">제안거리</Badge>
                </div>
                <p className="t-sub mt-1 break-keep text-slate-700">· 관련 이유: {x.reason}</p>
                <p className="t-meta break-keep text-slate-500">· 연결 상품: {topicPackages(x.topic, data).map((p) => p.name).join(', ') || '관련 상품 확인 필요'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <CopyBtn text={topicKakao(item, x.topic)} label="카톡 복사" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void save({ nextContactAt: account.nextContactAt || addDays(today, 3), nextAction: x.topic.action, memo: `${account.memo ? `${account.memo}\n` : ''}[제안거리] ${x.topic.name} — ${x.topic.action}` })
                      showToast('다음 연락에 저장했습니다.')
                    }}
                  >
                    📌 다음 연락에 저장
                  </Button>
                </div>
              </div>
            ))
        )}
      </Hub>

      <Hub title="🕒 진행 타임라인" sub={`${timeline.length}건`} open={!!open.tl} onToggle={() => tog('tl')} testId="sales-card-timeline">
        {timeline.length === 0 ? (
          <p className="t-sub text-slate-500">아직 기록된 진행 이력이 없습니다.</p>
        ) : (
          <ul className="grid gap-1">
            {timeline.map((e, i) => (
              <li key={i} className="t-sub flex gap-2 text-slate-700">
                <span className="min-w-[5.5rem] text-slate-500">{e.date.replace(/-/g, '.')}</span>
                <span>
                  <b className="text-slate-900">{e.type}</b>
                  {e.memo ? ` · ${e.memo}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Hub>

      <Link to={`/ops/clients/${client.id}`} className="t-meta text-brand-700 hover:underline">
        업체 기록 보기
      </Link>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 목차의 '리포트·제안서' — 업체를 골라 영업 카드를 연다                   */
/* ------------------------------------------------------------------ */

export function SalesReportsScreen({
  clients,
  accountOf,
  saveFor,
  data,
  initialId,
}: {
  clients: ClientOpsRecord[]
  accountOf: Map<string, { id: string; data: AccountData }>
  saveFor: (clientId: string, next: Partial<AccountData>) => Promise<void>
  data: SalesDocsData
  initialId: string | null
}) {
  const [picked, setPicked] = useState<string>(() => initialId ?? '')
  const id = picked || initialId || clients[0]?.id || ''
  const client = clients.find((c) => c.id === id) ?? null
  const acc = client ? accountOf.get(client.id)?.data : undefined
  return (
    <Section title="업체별 영업 카드" action={<span className="t-meta text-slate-500">방문 리포트 · 제안서 · 견적 · 계약 준비</span>}>
      <div className="flex flex-col gap-3">
        <select aria-label="영업 카드 업체" value={id} onChange={(e) => setPicked(e.target.value)} className={inputCls} data-testid="sales-card-pick">
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
              {accountOf.has(c.id) ? ` · ${STAGE_LABEL[accountOf.get(c.id)!.data.stage]}` : ''}
            </option>
          ))}
        </select>
        {client ? (
          <SalesCard key={client.id} client={client} account={acc ?? emptyAccountLike()} save={(next) => saveFor(client.id, next)} data={data} />
        ) : (
          <p className="t-sub text-slate-500">고객 운영에 업체가 없습니다. 업체를 먼저 등록하면 여기서 영업 카드를 씁니다.</p>
        )}
      </div>
    </Section>
  )
}

function emptyAccountLike(): AccountData {
  return { stage: 'lead', source: '', interests: [], nextContactAt: '', lastContactedAt: '', expectedFee: 0, memo: '' }
}
