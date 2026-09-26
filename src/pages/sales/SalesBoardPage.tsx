/**
 * 영업 관리 › 영업 보드 (D-114).
 *
 * 기업컨설팅 OS(영업 도구 모음)의 '영업 진행 현황' 을 고객 관리 한 장부 위로 옮겼다.
 *  - 업체는 고객 관리와 같은 기록이다. 여기서 만든 잠재고객도 고객 관리 '잠재고객' 에 그대로 보인다.
 *  - 단계: 잠재 고객 → 1차 미팅 예정 → 1차 미팅 완료 → 2차 미팅 → 3차 클로징 → 계약 완료, 그리고 보류 · 이탈.
 *  - '계약 완료' 로 옮기면 고객 관리의 계약 단계도 '계약함' 이 된다(메뉴 옆 계약 고객 숫자에 들어간다).
 *  - 화면을 열면 영업 도구 모음에 쌓인 업체별 영업 기록을 한 번 옮겨 온다(원본은 그대로 둔다).
 * 모양은 운영 OS 규칙을 따른다 — 원본의 여러 색 단계 표시 대신 테마색 하나와 회색, 급한 것만 경고색.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { fromState } from '../../lib/navFrom'
import { useQueryInUrl } from '../../lib/useQueryInUrl'
import { ChevronRight, CirclePlus, KanbanSquare, Presentation, ScanSearch, Search } from 'lucide-react'
import { WorkspaceScope } from '../../components/workspace/WorkspaceScope'
import { useToast } from '../../components/ui/toastContext'
import { Badge, Disclosure, MetricTile, ScreenTitle } from '../../components/ui/primitives'
import { CopyButton } from '../../components/sales/salesParts'
import { stageColor } from '../../components/sales/salesColor'
import { salesActionPath, salesRecontacts, salesRisks } from '../../services/salesSignals'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { SalesTabs } from '../../components/sales/SalesTabs'
import { LINK_BUTTON } from '../../components/sales/salesStyle'
import { createClient, listClients, saveClient } from '../../services/clientOpsService'
import { contractCloseDraft, withContractClose, type ContractCloseDraft } from '../../services/salesContract'
import { ContractCloseSheet } from '../../components/sales/ContractCloseSheet'
import { matchesClientSearch } from '../../services/clientOpsSearch'
import { listRows } from '../../services/moduleData'
import {
  daysInStage,
  groupBySalesStage,
  importLegacySalesAccounts,
  salesInFlow,
  salesStageOf,
  stageReached,
  withNewProspect,
  withSalesInfo,
  withSalesStage,
} from '../../services/salesPipeline'
import { SALES_SOURCES, SALES_STALE_DAYS } from '../../content/salesCatalog'
import { formatKrwCompact, krwTile } from '../../lib/format'
import { todayLocalDate, localDateOf } from '../../lib/appClock'
import {
  SALES_FLOW_STAGES,
  SALES_STAGE_HINT,
  SALES_STAGE_LABEL,
  SALES_STAGE_ORDER,
  type ClientOpsRecord,
  type SalesStage,
} from '../../types/clientOps'

const PICK_KEY = 'axmvp.sales.board.stage'

/** 계약 완료 · 보류 · 이탈은 '오래 머묾' 을 따지지 않는다 */
const QUIET_STAGES: SalesStage[] = ['contracted', 'hold', 'lost']

function StageSelect({ record, onMove }: { record: ClientOpsRecord; onMove: (r: ClientOpsRecord, s: SalesStage) => void }) {
  const stage = salesStageOf(record)
  return (
    <select
      value={stage}
      aria-label={`${record.companyName} 영업 단계`}
      onChange={(e) => onMove(record, e.target.value as SalesStage)}
      className="t-meta w-full min-w-0 rounded-(--radius-control) border border-slate-200 bg-white px-2 py-1.5 font-medium text-slate-700 focus:border-brand-500 focus:outline-none"
    >
      {SALES_STAGE_ORDER.map((s) => (
        <option key={s} value={s}>
          {SALES_STAGE_LABEL[s]}
        </option>
      ))}
    </select>
  )
}

/** 보드 카드 한 장 — 이름 · 누구 · 어디서 왔나 · 예상 수임료 · 머문 날 · 다음 할 일 */
function SalesCard({ record, today, onOpen, onMove }: { record: ClientOpsRecord; today: string; onOpen: () => void; onMove: (r: ClientOpsRecord, s: SalesStage) => void }) {
  const s = record.sales
  const stage = salesStageOf(record)
  const days = daysInStage(record)
  const stale = days !== null && days >= SALES_STALE_DAYS && !QUIET_STAGES.includes(stage)
  const who = record.representativeName.trim() || record.contactName.trim()
  const overdue = record.nextActionDueDate !== '' && record.nextActionDueDate < today
  return (
    <li data-testid="sales-card" className="relative flex flex-col gap-1.5 overflow-hidden rounded-(--radius-control) border border-slate-200 bg-white p-3">
      {stale && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-warning-500" />}
      <button type="button" onClick={onOpen} className="tap flex min-w-0 items-center gap-1 text-left">
        <span className="t-body min-w-0 truncate font-bold text-slate-900 hover:text-brand-700 hover:underline">{record.companyName || '(이름 없음)'}</span>
        <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-slate-400" />
      </button>
      {(who || s?.source) && (
        <p className="t-meta truncate text-slate-500">{[who, s?.source, s?.referrer ? `소개 ${s.referrer}` : ''].filter(Boolean).join(' · ')}</p>
      )}
      {s && s.interests.length > 0 && stageReached(record, 'm1done') && (
        <p className="t-meta truncate text-slate-600">{s.interests.slice(0, 3).join(' · ')}{s.interests.length > 3 ? ` 외 ${s.interests.length - 3}` : ''}</p>
      )}
      <p className="t-meta flex flex-wrap items-baseline gap-x-2 text-slate-500">
        {s?.expectedFee ? <span className="font-semibold text-slate-800 tabular-nums">{formatKrwCompact(s.expectedFee)}</span> : null}
        {days !== null && <span className={stale ? 'font-semibold text-warning-700' : ''}>{days === 0 ? '오늘 옮김' : `${days}일째`}</span>}
        {record.nextActionDueDate && (
          <span className={overdue ? 'font-semibold text-danger-700' : ''}>다음 {record.nextActionDueDate.slice(5).replace('-', '.')}</span>
        )}
      </p>
      <StageSelect record={record} onMove={onMove} />
      {/* D-122: 아이콘만 두지 않는다 — '미팅 준비' 글자로 */}
      {!QUIET_STAGES.includes(stage) && (
        <Link
          to={`/sales/meeting?client=${record.id}`}
          aria-label={`${record.companyName} 미팅 준비`}
          className="tap t-meta inline-flex items-center gap-1 self-start rounded-(--radius-control) px-1 font-semibold text-brand-700 hover:underline"
        >
          <Presentation aria-hidden="true" className="size-3.5" />
          미팅 준비
        </Link>
      )}
    </li>
  )
}

interface ProspectForm {
  companyName: string
  contactName: string
  contactPhone: string
  source: string
  referrer: string
  interests: string[]
  concern: string
  feeManwon: string
}

const EMPTY_FORM: ProspectForm = { companyName: '', contactName: '', contactPhone: '', source: '', referrer: '', interests: [], concern: '', feeManwon: '' }

const inputClass = 'mt-1 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-[0.95rem] text-slate-800 focus:border-brand-500 focus:outline-none'

function NewProspectModal({ open, busy, onClose, onSubmit }: { open: boolean; busy: boolean; onClose: () => void; onSubmit: (f: ProspectForm) => void }) {
  const [f, setF] = useState<ProspectForm>(EMPTY_FORM)
  useEffect(() => {
    if (open) setF(EMPTY_FORM)
  }, [open])
  const set = <K extends keyof ProspectForm>(k: K, v: ProspectForm[K]) => setF((prev) => ({ ...prev, [k]: v }))
  return (
    <Modal
      open={open}
      title="새 잠재고객"
      size="lg"
      onClose={() => { if (!busy) onClose() }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>취소</Button>
          <Button variant="primary" onClick={() => onSubmit(f)} disabled={busy || f.companyName.trim() === ''}>
            {busy ? '등록 중…' : '잠재고객 등록'}
          </Button>
        </>
      }
    >
      <p className="t-sub break-keep text-slate-500">계약 전 업체로 등록됩니다. 고객 관리 '잠재고객' 에도 같이 보이고, 계약하면 계약 고객으로 넘어갑니다.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-[0.85rem] text-slate-500">
          회사명 *
          <input value={f.companyName} onChange={(e) => set('companyName', e.target.value)} className={inputClass} />
        </label>
        <label className="block text-[0.85rem] text-slate-500">
          대표자·담당자
          <input value={f.contactName} onChange={(e) => set('contactName', e.target.value)} className={inputClass} />
        </label>
        <label className="block text-[0.85rem] text-slate-500">
          휴대폰번호
          <input value={f.contactPhone} inputMode="tel" onChange={(e) => set('contactPhone', e.target.value)} placeholder="010-" className={inputClass} />
        </label>
        <label className="block text-[0.85rem] text-slate-500">
          유입 경로
          <select value={f.source} onChange={(e) => set('source', e.target.value)} className={inputClass}>
            <option value="">선택</option>
            {SALES_SOURCES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className="block text-[0.85rem] text-slate-500">
          소개한 사람
          <input value={f.referrer} onChange={(e) => set('referrer', e.target.value)} className={inputClass} />
        </label>
        <label className="block text-[0.85rem] text-slate-500">
          예상 수임료 (만원)
          <input value={f.feeManwon} inputMode="numeric" onChange={(e) => set('feeManwon', e.target.value.replace(/[^0-9]/g, ''))} placeholder="예) 300" className={inputClass} />
        </label>
        <label className="block text-[0.85rem] text-slate-500 sm:col-span-2">
          대표 고민 한 줄
          <input value={f.concern} onChange={(e) => set('concern', e.target.value)} placeholder="예) 가지급금이 쌓여 정리 방법을 찾는 중" className={inputClass} />
        </label>
      </div>
      <p className="t-meta mt-3 break-keep text-slate-500">관심사는 1차 미팅을 마친 뒤 미팅 기록에서 확인합니다.</p>
    </Modal>
  )
}

function BoardContent({ workspaceId }: { workspaceId: string | null }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const today = todayLocalDate()
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // D-119: 크레탑 등록 화면의 '크레탑 없이 직접 입력' → ?new=1 로 들어오면 바로 연다
  const [searchParams, setSearchParams] = useSearchParams()
  // D-124: 찾던 말은 주소(?q=)에 — 업체를 열었다가 뒤로 와도 그대로
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  useQueryInUrl(query, searchParams, setSearchParams)
  const [formOpen, setFormOpen] = useState(() => searchParams.get('new') === '1')
  // D-124: ?new=1 은 한 번만 — 주소에 남으면 뒤로가기로 돌아올 때마다 빈 등록 창이 다시 떴다
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('new'); return n }, { replace: true })
    }
  }, [searchParams, setSearchParams])
  const [busy, setBusy] = useState(false)
  // 좁은 화면에서는 한 번에 한 칸만 — 고른 칸을 기억한다
  const [picked, setPicked] = useState<SalesStage>(() => {
    try {
      const v = localStorage.getItem(PICK_KEY)
      return v && (SALES_STAGE_ORDER as string[]).includes(v) ? (v as SalesStage) : 'lead'
    } catch {
      return 'lead'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(PICK_KEY, picked)
    } catch {
      /* 저장 못 해도 화면은 돈다 */
    }
  }, [picked])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      let list = await listClients(workspaceId)
      // 영업 도구 모음에 쌓인 영업 기록 — 영업 칸이 아직 없는 업체만 한 번 옮긴다(원본은 그대로)
      const legacy = await listRows(workspaceId, 'sales-kit', 'accounts').catch(() => [])
      const moved = importLegacySalesAccounts(list, legacy)
      if (moved.length > 0) {
        const saved = await Promise.all(moved.map((r) => saveClient(r)))
        const byId = new Map(saved.map((r) => [r.id, r]))
        list = list.map((r) => byId.get(r.id) ?? r)
        showToast(`영업 도구 모음에 있던 영업 기록 ${saved.length}곳을 옮겨 왔습니다. 원래 기록은 그대로 있습니다.`)
      }
      setRecords(list)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '업체 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => records.filter((r) => matchesClientSearch(r, query) || (r.sales?.source ?? '').includes(query.trim())), [records, query])
  const groups = useMemo(() => groupBySalesStage(visible), [visible])
  const all = useMemo(() => groupBySalesStage(records), [records])

  const stats = useMemo(() => {
    const month = today.slice(0, 7)
    const { list: inFlow, fee } = salesInFlow(records)
    const wonThisMonth = all.contracted.filter((r) => localDateOf(r.sales?.movedAt).slice(0, 7) === month).length
    const stale = inFlow.filter((r) => {
      const d = daysInStage(r)
      return d !== null && d >= SALES_STALE_DAYS
    }).length
    return { inFlow: inFlow.length, fee, wonThisMonth, stale, parked: all.hold.length + all.lost.length }
  }, [all, records, today])

  const risks = useMemo(() => salesRisks(records, today), [records, today])
  const recontacts = useMemo(() => salesRecontacts(records), [records])

  /** D-122: '계약 완료' 로 옮기면 확인 시트 — 수금 항목 · 받을 날 · 영업자 · 계약 방식까지 한 번에 */
  const [closing, setClosing] = useState<{ record: ClientOpsRecord; draft: ContractCloseDraft } | null>(null)
  const saveClose = async (record: ClientOpsRecord, d: ContractCloseDraft): Promise<boolean> => {
    const next = withContractClose(record, d)
    setRecords((list) => list.map((r) => (r.id === next.id ? next : r)))
    try {
      const saved = await saveClient(next)
      setRecords((list) => list.map((r) => (r.id === saved.id ? saved : r)))
      showToast(`${record.companyName} — 계약 완료. 수금 항목 · 계약 정보를 넣었습니다. 업체 상세의 수금 탭에서 이어 갑니다.`)
      return true
    } catch (cause) {
      showToast(cause instanceof Error ? `${cause.message} — 다시 눌러 주세요.` : '저장하지 못했습니다. 다시 눌러 주세요.')
      void load()
      return false
    }
  }

  const move = useCallback(
    async (record: ClientOpsRecord, stage: SalesStage, direct = false) => {
      if (stage === 'contracted' && !direct && salesStageOf(record) !== 'contracted') {
        setClosing({ record, draft: contractCloseDraft(record, { today, records }) })
        return
      }
      const next = withSalesStage(record, stage)
      if (next === record) return
      setRecords((list) => list.map((r) => (r.id === next.id ? next : r)))
      try {
        const saved = await saveClient(next)
        setRecords((list) => list.map((r) => (r.id === saved.id ? saved : r)))
        // D-122: 작은 고르는 칸이라 휴대폰에서 잘못 스치기 쉽다 — 옮긴 뒤 8초 동안 '되돌리기'
        const undo = async () => {
          setRecords((list) => list.map((r) => (r.id === record.id ? record : r)))
          try {
            const back = await saveClient(record)
            setRecords((list) => list.map((r) => (r.id === back.id ? back : r)))
            showToast(`${record.companyName} — ${SALES_STAGE_LABEL[salesStageOf(record)]}(으)로 되돌렸습니다.`)
          } catch (e) {
            showToast(e instanceof Error ? e.message : '되돌리지 못했습니다.')
            void load()
          }
        }
        showToast(
          stage === 'contracted' && record.status === 'waiting'
            ? `${record.companyName} — 계약 완료. 고객 관리에서 계약 고객으로 넘어갔습니다.`
            : `${record.companyName} — ${SALES_STAGE_LABEL[stage]}`,
          { label: '되돌리기', onClick: () => void undo() },
        )
      } catch (cause) {
        showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
        void load()
      }
    },
    [showToast, load, today, records],
  )

  const create = async (f: ProspectForm) => {
    if (!f.companyName.trim()) return
    setBusy(true)
    let created: ClientOpsRecord | null = null
    try {
      created = await createClient(workspaceId, {
        companyName: f.companyName,
        contactName: f.contactName,
        contactPhone: f.contactPhone,
        status: 'waiting',
      })
      const fee = parseInt(f.feeManwon, 10)
      const next = withSalesInfo(withNewProspect(created, f.source), {
        referrer: f.referrer,
        interests: f.interests,
        concern: f.concern,
        expectedFee: Number.isFinite(fee) && fee > 0 ? fee * 10_000 : null,
      })
      const saved = await saveClient(next)
      setRecords((list) => [saved, ...list])
      setFormOpen(false)
      setPicked('lead')
      showToast(`${saved.companyName} — 잠재고객으로 등록했습니다.`)
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : '등록하지 못했습니다.'
      if (created) {
        // D-120: 업체는 만들어졌는데 영업 칸 저장만 실패 — 다시 누르면 같은 업체가 두 번 생기므로 창을 닫고 목록에 넣는다
        const made = created
        setRecords((list) => (list.some((r) => r.id === made.id) ? list : [made, ...list]))
        setFormOpen(false)
        showToast(`${made.companyName} 은(는) 만들어졌지만 영업 칸을 저장하지 못했습니다 — 카드에서 다시 고쳐 주세요. (${msg})`)
      } else {
        showToast(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  const open = (r: ClientOpsRecord) => navigate(`/ops/clients/${r.id}`, { state: fromState(location) })
  const liveCount = records.filter((r) => r.archivedAt === null).length

  const column = (stage: SalesStage, list: ClientOpsRecord[]) => {
    const c = stageColor(stage)
    return (
    <section key={stage} aria-label={SALES_STAGE_LABEL[stage]} data-sales-col={stage} className="relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-slate-50 p-2 pt-3">
      {/* D-118: 칸 머리 위 3px 띠 + 옅은 머리 바탕 — 단계 구분색(테마를 따라간다). 칸 전체는 칠하지 않는다 */}
      <span aria-hidden="true" data-stage-bar className={`absolute inset-x-0 top-0 h-[3px] ${c.bar}`} style={c.style} />
      <div data-stage-head className={`-mx-2 -mt-3 flex flex-col gap-0.5 px-3 pt-3.5 pb-2 ${c.soft}`} style={c.style}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className={`t-sub min-w-0 truncate font-bold ${c.text}`} style={c.style}>{SALES_STAGE_LABEL[stage]}</h2>
          <span className={`t-meta shrink-0 rounded-full bg-white px-2 font-semibold tabular-nums ${list.length > 0 ? c.text : 'text-slate-400'}`} style={list.length > 0 ? c.style : undefined}>{list.length}</span>
        </div>
        <p className="t-meta break-keep text-slate-500">{SALES_STAGE_HINT[stage]}</p>
      </div>
      {list.length === 0 ? (
        <p className="t-meta rounded-(--radius-control) border border-dashed border-slate-200 px-2 py-4 text-center text-slate-400">없음</p>
      ) : (
        <ul className={`grid gap-2 ${stage === 'hold' || stage === 'lost' ? 'sm:grid-cols-2 2xl:grid-cols-3' : ''}`}>
          {list.map((r) => (
            <SalesCard key={r.id} record={r} today={today} onOpen={() => open(r)} onMove={(rec, s) => void move(rec, s)} />
          ))}
        </ul>
      )}
    </section>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <ScreenTitle
        title="영업 관리"
        sub={`${today} · 진행 중 ${stats.inFlow}곳 · 계약 완료 ${all.contracted.length}곳`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* D-119: 크레탑 보고서 한 번으로 등록 · 기본 정보 · 1차 미팅 전략까지 */}
            <Link to="/sales/new" data-testid="board-cretop-intake" className={LINK_BUTTON.primary}>
              <ScanSearch aria-hidden="true" className="size-4" />
              크레탑으로 등록
            </Link>
            <Button variant="secondary" onClick={() => setFormOpen(true)}>
              <CirclePlus aria-hidden="true" className="size-4" />
              새 잠재고객
            </Button>
          </div>
        }
      />
      <SalesTabs />

      {error && (
        <p role="alert" className="rounded-(--radius-control) border border-danger-200 bg-danger-50 px-4 py-3 text-[0.95rem] text-danger-700">
          {error}
        </p>
      )}

      <section aria-label="영업 요약" className="ax-stagger grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <MetricTile label="진행 중" value={`${stats.inFlow}곳`} hint="잠재 고객 ~ 3차 클로징" />
        <MetricTile label="예상 수임료" value={krwTile(stats.fee)} hint="진행 중인 곳 합계" />
        <MetricTile label="이번 달 계약" value={`${stats.wonThisMonth}곳`} tone={stats.wonThisMonth > 0 ? 'success' : 'neutral'} hint="계약 완료로 옮긴 곳" />
        <MetricTile
          label={`${SALES_STALE_DAYS}일 넘게 멈춤`}
          value={`${stats.stale}곳`}
          tone={stats.stale > 0 ? 'warning' : 'neutral'}
          hint={`보류·이탈 ${stats.parked}곳은 따로`}
        />
      </section>

      {/* D-114 4단계: 원본 '영업 위험 신호' · '재접촉 명분' — 있을 때만, 접어서 */}
      {(risks.length > 0 || recontacts.length > 0) && (
        <div className="grid gap-2.5 xl:grid-cols-2" data-testid="sales-signals">
          {risks.length > 0 && (
            <Disclosure title="지금 챙길 영업" hint={`${risks.length}곳 · ${risks[0].record.companyName} — ${risks[0].reason}`} badge={<Badge tone="warning">{risks.length}</Badge>}>
              <ul className="flex flex-col divide-y divide-slate-100">
                {risks.map((r) => (
                  <li key={r.record.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <button type="button" onClick={() => open(r.record)} className="t-sub font-bold text-slate-900 hover:text-brand-700 hover:underline">{r.record.companyName}</button>
                    <span className="t-sub text-warning-700">{r.reason}</span>
                    <Link to={salesActionPath(r.action, r.record.id)} className="t-meta ml-auto font-semibold text-brand-700 hover:underline">{r.action} →</Link>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
          {recontacts.length > 0 && (
            <Disclosure title="다시 연락할 곳" hint={`${recontacts.length}곳 · 오래 조용하거나 보류가 길어진 곳`} badge={<Badge>{recontacts.length}</Badge>}>
              <ul className="flex flex-col divide-y divide-slate-100">
                {recontacts.map((r) => (
                  <li key={r.record.id} className="flex flex-col gap-1 py-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => open(r.record)} className="t-sub font-bold text-slate-900 hover:text-brand-700 hover:underline">{r.record.companyName}</button>
                      <span className="t-meta text-slate-400">{r.days >= 999 ? '기록 없음' : `${r.days}일 조용함`}</span>
                      <span className="ml-auto"><CopyButton text={r.ment} label="연락 문구" /></span>
                    </span>
                    {r.reasons.map((x) => <span key={x} className="t-meta break-keep text-slate-500">· {x}</span>)}
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </div>
      )}

      {liveCount > 0 && (
        <div className="relative w-full min-w-0 sm:max-w-md">
          <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="업체명·담당자·유입 경로로 찾기"
            aria-label="영업 업체 검색"
            className="w-full rounded-(--radius-control) border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-[0.98rem] focus:border-brand-500 focus:outline-none sm:py-2"
          />
        </div>
      )}

      {loading ? (
        <p className="t-sub text-slate-500">불러오는 중…</p>
      ) : liveCount === 0 ? (
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-12 text-center">
          <KanbanSquare aria-hidden="true" className="mx-auto size-9 text-brand-400" />
          <p className="mt-3 text-[1.2rem] font-bold text-slate-900">아직 영업 중인 업체가 없습니다</p>
          <p className="mx-auto mt-2 max-w-xl text-[1rem] break-keep text-slate-600">
            처음 연락한 업체를 <strong className="font-semibold">새 잠재고객</strong>으로 등록하면 여기서 미팅 · 제안 · 계약까지 단계를 옮기며 봅니다.
            홈페이지 상담신청에서 만든 업체도 자동으로 '잠재 고객' 칸에 들어옵니다.
          </p>
          <Button variant="primary" className="mt-5" onClick={() => setFormOpen(true)}>
            <CirclePlus aria-hidden="true" className="size-4" />첫 잠재고객 등록
          </Button>
        </div>
      ) : (
        <>
          {/* 넓은 화면 — 여섯 칸이 한눈에 */}
          <div data-testid="sales-board" className="hidden gap-2.5 xl:grid xl:grid-cols-6">
            {SALES_FLOW_STAGES.map((s) => column(s, groups[s]))}
          </div>
          <div className="hidden gap-2.5 xl:grid xl:grid-cols-2">
            {column('hold', groups.hold)}
            {column('lost', groups.lost)}
          </div>

          {/* 좁은 화면 — 칸을 골라 한 칸씩 (옆으로 밀지 않는다) */}
          <div className="flex flex-col gap-3 xl:hidden">
            <div role="group" aria-label="영업 단계 고르기" data-testid="sales-stage-picker" className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {SALES_STAGE_ORDER.map((s) => {
                const on = picked === s
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPicked(s)}
                    className={`tap flex flex-col items-start gap-0.5 rounded-(--radius-control) border px-2.5 py-2 text-left ${
                      on ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="t-meta flex w-full min-w-0 items-start gap-1.5 font-semibold">
                      <span aria-hidden="true" className={`mt-[0.4em] size-2 shrink-0 rounded-full ${on ? 'bg-white' : stageColor(s).dot}`} style={on ? undefined : stageColor(s).style} />
                      {/* 좁으면 두 줄로 — '1차 미팅 예정' · '1차 미팅 완료' 가 둘 다 '1차 미팅 …' 으로 잘리면 구별이 안 된다 */}
                      <span className="min-w-0 break-keep leading-tight">{SALES_STAGE_LABEL[s]}</span>
                    </span>
                    <span className={`t-body font-bold tabular-nums ${on ? 'text-white' : 'text-slate-900'}`}>{groups[s].length}</span>
                  </button>
                )
              })}
            </div>
            <p className="t-sub break-keep text-slate-500">{SALES_STAGE_LABEL[picked]} — {SALES_STAGE_HINT[picked]}</p>
            {groups[picked].length === 0 ? (
              <p className="t-sub rounded-(--radius-panel) border border-dashed border-slate-200 bg-white px-3 py-8 text-center text-slate-400">이 단계에 있는 업체가 없습니다</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {groups[picked].map((r) => (
                  <SalesCard key={r.id} record={r} today={today} onOpen={() => open(r)} onMove={(rec, s) => void move(rec, s)} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <NewProspectModal open={formOpen} busy={busy} onClose={() => setFormOpen(false)} onSubmit={(f) => void create(f)} />
      {closing && (
        <ContractCloseSheet
          record={closing.record}
          draft={closing.draft}
          onClose={() => setClosing(null)}
          onSubmit={(d) => saveClose(closing.record, d)}
          onStageOnly={async () => {
            await move(closing.record, 'contracted', true)
            return true
          }}
        />
      )}
    </div>
  )
}

export function SalesBoardPage() {
  return <WorkspaceScope>{(ctx) => <BoardContent workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}
