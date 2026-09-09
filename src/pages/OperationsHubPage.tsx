import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Archive,
  Building2,
  CalendarDays,
  ChevronRight,
  ListPlus,
  MoreHorizontal,
  CirclePlus,
  ClipboardCheck,
  Download,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { ServiceCatalogModal } from '../components/ops/ServiceCatalogModal'
import { ClientBoardCard } from '../components/ops/ClientBoardCard'
import { ClientMoneySheet, ServiceStatusSheet } from '../components/ops/ClientQuickSheets'
import { BottomSheet, MetricTile, ScreenTitle, type Tone } from '../components/ui/primitives'
import { loadCustomServicesIntoCatalog } from '../services/customServiceService'
import { getDataModeConfig } from '../data/dataMode'
import { CloudUpload } from 'lucide-react'
import {
  createClient,
  dismissLocalMigration,
  listClients,
  pendingLocalClients,
  replaceAllClients,
  saveClient,
} from '../services/clientOpsService'
import { downloadBackup, mergeBackup, parseBackup, type MergeMode } from '../services/clientOpsBackup'
import {
  buildAllAlerts,
  clientOpsProgress,
  daysLeftFrom,
  sortClientsByUrgency,
  summarizeAlerts,
} from '../services/clientOpsAlerts'
import { DUE_SOON_DAYS } from '../content/clientOpsCatalog'
import { todayLocalDate } from '../lib/appClock'
import { krwTile } from '../lib/format'
import { contractStageOf } from '../types/clientOps'
import type { ClientOpsRecord, OpsAlert, AlertSeverity, ServiceKey } from '../types/clientOps'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/toastContext'
import { Modal } from '../components/ui/Modal'
import { AlertRow, SEVERITY_META } from '../components/ops/opsParts'

const SEVERITY_TABS: { key: AlertSeverity | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'critical', label: '지금 처리' },
  { key: 'warning', label: '곧 처리' },
  { key: 'info', label: '참고' },
]

/*
 * 업체 한 장의 급한 정도.
 *
 * 예전에는 경고 건수만 봤는데, 업무 6개 × 서류 10종이라 거의 모든 업체가
 * "지금 N" 이 되어 목록이 통째로 빨갛게 물들었다. 다 빨가면 아무것도 안 빨갛다.
 * 그래서 대표가 실제로 움직이는 기준 — 다음 할 일의 마감과 수금 연체 — 로 세 칸을
 * 나눈다. 목록의 정렬 순서와 색이 같은 방향을 보게 되어 위에서부터 색이 옅어진다.
 */
function clientTone(dLeft: number | null, overduePayments: number, critical: number, warning: number): Tone {
  if ((dLeft !== null && dLeft < 0) || overduePayments > 0) return 'danger'
  if (dLeft !== null && dLeft <= DUE_SOON_DAYS) return 'warning'
  if (critical > 0 || warning > 0) return 'neutral'
  return 'success'
}

function OperationsHubContent({ workspaceId }: { workspaceId: string | null }) {
  const navigate = useNavigate()
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [tab, setTab] = useState<AlertSeverity | 'all'>('all')
  // 현황표를 먼저 보고 싶다는 요청이 있어 이 목록은 기본으로 접어 둔다.
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  /** 자주 쓰지 않는 도구(백업·일정·항목관리)를 담는 시트 */
  const [moreOpen, setMoreOpen] = useState(false)
  /**
   * 목록에서 바로 고치는 시트 — 업무 상태 / 수금.
   * 업체 id 만 들고 있고 기록은 records 에서 다시 찾는다. 저장하면 records 가
   * 갱신되므로 시트가 열린 채로도 늘 최신 값을 그린다.
   */
  const [quick, setQuick] = useState<{ id: string; kind: 'service'; serviceKey: ServiceKey } | { id: string; kind: 'money' } | null>(null)
  const quickRecord = quick ? (records.find((r) => r.id === quick.id) ?? null) : null
  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const [form, setForm] = useState({ companyName: '', contactName: '', contactPhone: '', businessNumber: '' })
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [leftover, setLeftover] = useState<ClientOpsRecord[]>([])
  const [migrating, setMigrating] = useState(false)
  /** 백업 파일을 읽은 뒤 합칠지/바꿀지 묻는 단계 */
  const [restorePrompt, setRestorePrompt] = useState<ClientOpsRecord[] | null>(null)
  const { showToast } = useToast()
  const restoreRef = useRef<HTMLInputElement>(null)

  const today = todayLocalDate()

  const load = useCallback(async () => {
    try {
      setLoading(true)
      // 직접 만든 업무 항목을 먼저 목록에 올린 뒤 업체를 읽는다
      await loadCustomServicesIntoCatalog(workspaceId)
      setRecords(await listClients(workspaceId))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '고객 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    void load()
  }, [load])

  /*
   * 옮기기 안내는 "아직 클라우드에 없는" 기록이 있을 때만 뜬다.
   *
   * 예전에는 로컬에 기록이 있기만 하면 무조건 띄웠다. 옮기고 나서도 브라우저
   * 원본은 일부러 남겨 두므로(백업), 새로고침할 때마다 같은 안내가 다시 떴다.
   * 이제는 records(클라우드 목록)와 대조하므로 옮기고 나면 저절로 사라진다.
   */
  useEffect(() => {
    if (getDataModeConfig().mode !== 'supabase') return
    try {
      setLeftover(pendingLocalClients(records))
    } catch {
      setLeftover([])
    }
  }, [records])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records.filter((r) => {
      if (!showArchived && r.archivedAt !== null) return false
      if (showArchived && r.archivedAt === null) return false
      if (q === '') return true
      return [r.companyName, r.contactName, r.businessNumber, r.industry, r.businessAddress]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [records, query, showArchived])
  const archivedCount = records.filter((r) => r.archivedAt !== null).length

  const ordered = useMemo(() => sortClientsByUrgency(visible, today), [visible, today])
  const alerts = useMemo(() => buildAllAlerts(records, today), [records, today])
  const summary = useMemo(() => summarizeAlerts(alerts), [alerts])
  const visibleAlerts = useMemo(
    () => (tab === 'all' ? alerts : alerts.filter((a) => a.severity === tab)),
    [alerts, tab],
  )
  const shownAlerts = showAllAlerts ? visibleAlerts : visibleAlerts.slice(0, 8)

  const money = useMemo(() => {
    let unpaid = 0
    let overdueCount = 0
    for (const r of records) {
      const p = clientOpsProgress(r, today)
      unpaid += p.unpaidAmount
      overdueCount += p.overduePayments
    }
    return { unpaid, overdueCount }
  }, [records, today])

  // 계약 종료만 뺀다 — 계약 전도 챙겨야 할 업체다
  const activeCount = records.filter((r) => contractStageOf(r.status) !== 'closed').length

  const openAlert = (a: OpsAlert) =>
    navigate(a.serviceKey ? `/ops/clients/${a.clientId}?tab=work&svc=${a.serviceKey}` : `/ops/clients/${a.clientId}`)

  /**
   * 목록 시트에서 고친 값을 저장한다.
   * 먼저 화면을 바꾸고(기다림 없음) 저장에 실패하면 서버 값으로 되돌린다.
   */
  const quickSave = useCallback(
    async (next: ClientOpsRecord) => {
      setRecords((prev) => prev.map((r) => (r.id === next.id ? next : r)))
      try {
        const saved = await saveClient(next)
        setRecords((prev) => prev.map((r) => (r.id === saved.id ? saved : r)))
      } catch (cause) {
        showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
        void load()
      }
    },
    [showToast, load],
  )

  const onRestoreFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      setRestorePrompt(parseBackup(await file.text()))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '백업을 불러오지 못했습니다.')
    } finally {
      if (restoreRef.current) restoreRef.current.value = ''
    }
  }

  const applyRestore = async (mode: MergeMode) => {
    const incoming = restorePrompt
    if (!incoming) return
    setRestoring(true)
    setError('')
    try {
      const result = mergeBackup(records, incoming, mode)
      await replaceAllClients(workspaceId, result.records)
      await load()
      setRestorePrompt(null)
      showToast(
        mode === 'merge'
          ? `복원했습니다. 추가 ${result.added}곳 · 갱신 ${result.updated}곳 · 유지 ${result.kept}곳`
          : `백업 내용으로 바꿨습니다. 고객 ${result.records.length}곳`,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '백업을 불러오지 못했습니다.')
    } finally {
      setRestoring(false)
    }
  }

  const migrateLocal = async () => {
    if (leftover.length === 0) return
    setMigrating(true)
    setError('')
    try {
      const result = mergeBackup(records, leftover, 'merge')
      await replaceAllClients(workspaceId, result.records)
      await load()
      setLeftover([])
      showToast(`이 브라우저에 있던 고객 ${leftover.length}곳을 클라우드로 옮겼습니다. 추가 ${result.added}곳 · 갱신 ${result.updated}곳. 브라우저 원본은 그대로 남아 있습니다.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '옮기지 못했습니다.')
    } finally {
      setMigrating(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.companyName.trim()) return
    try {
      setSaving(true)
      const record = await createClient(workspaceId, form)
      navigate(`/ops/clients/${record.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '고객을 등록하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ScreenTitle
        title="고객 운영"
        sub={`${today} · 관리 중인 업체 ${activeCount}곳`}
        actions={
          <>
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              <CirclePlus aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">새 업체 등록</span>
              <span className="sm:hidden">등록</span>
            </Button>
            <Button variant="ghost" onClick={() => setMoreOpen(true)} aria-label="더보기">
              <MoreHorizontal aria-hidden="true" className="size-5" />
            </Button>
          </>
        }
      />

      {moreOpen && (
        <BottomSheet title="고객 운영 도구" onClose={() => setMoreOpen(false)}>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" className="w-full justify-start" onClick={() => { setMoreOpen(false); navigate('/ops/calendar') }}>
              <CalendarDays aria-hidden="true" className="size-4" />
              일정 보기
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              disabled={records.length === 0}
              onClick={() => { downloadBackup(records, today); setError(''); setMoreOpen(false) }}
            >
              <Download aria-hidden="true" className="size-4" />
              백업 내려받기
            </Button>
            <Button variant="secondary" className="w-full justify-start" onClick={() => restoreRef.current?.click()} disabled={restoring}>
              <Upload aria-hidden="true" className="size-4" />
              {restoring ? '복원 중…' : '백업 불러오기'}
            </Button>
            <Button variant="secondary" className="w-full justify-start" onClick={() => { setCatalogOpen(true); setMoreOpen(false) }}>
              <ListPlus aria-hidden="true" className="size-4" />
              업무 항목 관리
            </Button>
            <Button variant="secondary" className="w-full justify-start" onClick={() => { void load(); setMoreOpen(false) }} disabled={loading}>
              <RefreshCw aria-hidden="true" className="size-4" />
              새로고침
            </Button>
          </div>
        </BottomSheet>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-(--radius-control) border border-danger-200 bg-danger-50 px-4 py-3 text-[0.95rem] text-danger-700"
        >
          {error}
        </div>
      )}

      {/*
        옮기기 안내 — 휴대폰에서는 글자 줄 → 버튼 줄로 쌓는다.
        예전에는 한 줄짜리 flex 안에 글자(flex-1)와 버튼(shrink-0)을 같이 두었는데,
        flex-1 의 기준폭이 0 이라 줄바꿈이 일어나지 않고 글자 칸만 20px 로 눌렸다.
        그래서 360px 화면에서 한 줄에 한 글자씩 세로로 흘렀다.
      */}
      {leftover.length > 0 && (
        <div className="rounded-(--radius-panel) border border-brand-200 bg-brand-50/70 px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <CloudUpload aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-600" />
            <p className="min-w-0 flex-1 text-[0.98rem] break-keep text-slate-800">
              이 브라우저에 예전에 입력한 고객 <strong>{leftover.length}곳</strong>이 남아 있습니다. 클라우드로
              옮기면 휴대폰·다른 PC에서도 볼 수 있습니다.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" className="flex-1 sm:flex-none" onClick={() => void migrateLocal()} disabled={migrating}>
              <CloudUpload aria-hidden="true" className="size-4" />
              {migrating ? '옮기는 중…' : '클라우드로 옮기기'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                // 화면만 끄면 다음 접속에 되살아난다 — 미룬 것을 기억해 둔다
                dismissLocalMigration(leftover.map((r) => r.id))
                setLeftover([])
              }}
            >
              나중에
            </Button>
          </div>
        </div>
      )}

      <input
        ref={restoreRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void onRestoreFile(e.target.files?.[0])}
      />

      <Modal
        open={restorePrompt !== null}
        title="백업 불러오기"
        onClose={() => { if (!restoring) setRestorePrompt(null) }}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRestorePrompt(null)} disabled={restoring}>취소</Button>
            <Button variant="secondary" onClick={() => void applyRestore('replace')} disabled={restoring}>백업 내용으로 전부 바꾸기</Button>
            <Button variant="primary" onClick={() => void applyRestore('merge')} disabled={restoring}>{restoring ? '복원 중…' : '지금 데이터와 합치기'}</Button>
          </>
        }
      >
        <p className="text-[0.98rem] break-keep text-slate-700">백업에 고객 {restorePrompt?.length ?? 0}곳이 들어 있습니다.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[0.92rem] break-keep text-slate-600">
          <li><strong>합치기</strong> — 같은 업체는 최근에 수정한 쪽을 남기고, 없던 업체는 추가합니다.</li>
          <li><strong>전부 바꾸기</strong> — 지금 목록을 지우고 백업 내용으로 채웁니다. 되돌릴 수 없습니다.</li>
        </ul>
      </Modal>

      {/* 검색 · 보관 */}
      {records.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {/* 휴대폰에서는 검색칸이 한 줄을 다 쓴다 — 보관함 단추와 나눠 쓰면
              안내 문구가 '…번호로' 에서 잘렸다 */}
          <div className="relative w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-md">
            <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="업체명·대표자·사업자번호로 찾기"
              aria-label="업체 검색"
              className="w-full rounded-(--radius-control) border border-slate-300 py-2.5 pr-3 pl-9 text-[0.98rem] focus:border-brand-500 focus:outline-none sm:py-2"
            />
          </div>
          {/* 보관한 업체가 하나도 없으면 단추도 두지 않는다 — 빈 서랍을 여는 단추는 자리만 먹는다 */}
          {(archivedCount > 0 || showArchived) && (
            <button
              type="button"
              aria-pressed={showArchived}
              onClick={() => setShowArchived((v) => !v)}
              className={`tap inline-flex items-center gap-1.5 rounded-(--radius-control) border px-3 py-2 text-[0.92rem] font-medium ${
                showArchived
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Archive aria-hidden="true" className="size-4" />
              보관함 {archivedCount}
            </button>
          )}
          {query !== '' && (
            <span className="text-[0.9rem] text-slate-500">{visible.length}곳 찾음</span>
          )}
        </div>
      )}

      {/* 요약 — 0 일 때는 색을 쓰지 않는다 */}
      <section aria-label="요약" className="ax-stagger grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <MetricTile
          label="지금 처리할 일"
          value={`${summary.critical}건`}
          tone={summary.critical > 0 ? 'danger' : 'neutral'}
          hint="마감 지남 · 서류 없음"
          onClick={() => { setTab('critical'); setAlertsOpen(true) }}
        />
        <MetricTile
          label="곧 처리할 일"
          value={`${summary.warning}건`}
          tone={summary.warning > 0 ? 'warning' : 'neutral'}
          hint={`${DUE_SOON_DAYS}일 이내 마감·만료`}
          onClick={() => { setTab('warning'); setAlertsOpen(true) }}
        />
        <MetricTile label="관리 중인 업체" value={`${activeCount}곳`} hint={`전체 ${records.length}곳`} />
        <MetricTile
          label="아직 못 받은 돈"
          value={krwTile(money.unpaid)}
          tone={money.overdueCount > 0 ? 'danger' : 'neutral'}
          hint={money.overdueCount > 0 ? `예정일 지난 건 ${money.overdueCount}건` : '연체 없음'}
        />
      </section>

      {/* B. 업체별 현황표 */}
      <section aria-labelledby="ops-matrix" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="ops-matrix" className="t-section text-slate-900">
            업체별 현황표
          </h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCatalogOpen(true)}
              className="tap t-sub shrink-0 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 font-medium whitespace-nowrap text-slate-600 hover:bg-slate-50"
            >
              업무 항목 추가
            </button>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-12 text-center">
            <Building2 aria-hidden="true" className="mx-auto size-9 text-brand-400" />
            <p className="mt-3 text-[1.25rem] font-bold text-slate-900">첫 업체를 등록해 보세요</p>
            <p className="mx-auto mt-2 max-w-xl text-[1rem] break-keep text-slate-600">
              업체를 만들면 법인설립·업종추가·특허·벤처인증·AX 개발·정책자금 6가지 업무와 서류 10종이 자동으로 준비됩니다.
              이후에는 마감이 지났거나 서류가 빠진 것을 이 화면이 알아서 찾아 올려 드립니다.
            </p>
            <Button variant="primary" className="mt-5" onClick={() => setFormOpen(true)}>
              <CirclePlus aria-hidden="true" className="size-4" />첫 업체 등록
            </Button>
          </div>
        ) : (
          <>
          {/*
            표를 버리고 카드로 간다.
            업무가 6개일 때도 표는 가로 900px 를 넘겨 옆으로 밀어야 했고, 앞으로
            15개까지 늘면 미는 거리만 길어진다. 카드 안에서 업무를 작은 조각으로
            줄바꿈시키면 몇 개가 되든 가로로는 넘치지 않는다.
            휴대폰과 데스크톱이 같은 부품을 쓴다 — 한쪽만 어긋날 일이 없다.
          */}
          <ul className="ax-stagger flex flex-col gap-2.5 xl:grid xl:grid-cols-2">
            {ordered.map((record) => {
              const p = clientOpsProgress(record, today)
              const critical = summary.criticalByClient[record.id] ?? 0
              const warning = summary.warningByClient[record.id] ?? 0
              const dLeft = record.nextActionDueDate ? daysLeftFrom(today, record.nextActionDueDate) : null
              return (
                <ClientBoardCard
                  key={record.id}
                  record={record}
                  today={today}
                  dueSoonDays={DUE_SOON_DAYS}
                  tone={clientTone(dLeft, p.overduePayments, critical, warning)}
                  criticalCount={critical}
                  warningCount={warning}
                  onOpen={() => navigate(`/ops/clients/${record.id}`)}
                  onChip={(key) => setQuick({ id: record.id, kind: 'service', serviceKey: key })}
                  onMoney={() => setQuick({ id: record.id, kind: 'money' })}
                />
              )
            })}
          </ul>
          </>
        )}

        {/*
          색 설명을 적어 두지 않는다.
          조각에 이미 '7일 지남' 이라고 글자로 쓰여 있으므로 빨강이 무슨 뜻인지 물어볼 일이 없다.
          범례가 필요하다는 것은 화면이 스스로 설명하지 못한다는 뜻이다.
        */}
        <p className="t-sub text-slate-500">업무 조각을 누르면 상태가 바로 바뀝니다.</p>
      </section>

      {/* A. 지금 챙길 것 */}
      <section
        aria-labelledby="ops-alerts"
        className={`flex-col gap-3 ${records.length === 0 ? 'hidden' : 'flex'}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            id="ops-alerts"
            aria-expanded={alertsOpen}
            onClick={() => setAlertsOpen((v) => !v)}
            className="flex items-center gap-2 text-[1.3rem] font-bold text-slate-900"
          >
            <ChevronRight
              aria-hidden="true"
              className={`size-5 text-slate-400 transition-transform ${alertsOpen ? 'rotate-90' : ''}`}
            />
            지금 챙길 것
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.85rem] font-semibold text-slate-600">
              {alerts.length}
            </span>
          </button>
          <div className={`flex-wrap gap-1 ${alertsOpen ? 'flex' : 'hidden'}`}>
            {SEVERITY_TABS.map((t) => {
              const count =
                t.key === 'all'
                  ? alerts.length
                  : alerts.filter((a) => a.severity === t.key).length
              return (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={tab === t.key}
                  onClick={() => {
                    setTab(t.key)
                    setShowAllAlerts(false)
                  }}
                  className={`rounded-(--radius-control) border px-3 py-1.5 text-[0.9rem] font-medium ${
                    tab === t.key
                      ? 'border-brand-300 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t.label} {count}
                </button>
              )
            })}
          </div>
        </div>

        {alertsOpen && (
          <>
          {loading ? (
            <p className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-8 text-[0.95rem] text-slate-500">
              불러오는 중…
            </p>
          ) : visibleAlerts.length === 0 ? (
            <div className="rounded-(--radius-panel) border border-success-200 bg-success-50/60 px-5 py-8 text-center">
              <ClipboardCheck aria-hidden="true" className="mx-auto size-8 text-success-600" />
              <p className="mt-2 text-[1.05rem] font-semibold text-slate-800">
                {tab === 'all' ? '지금 급하게 챙길 일이 없습니다' : '이 분류에는 항목이 없습니다'}
              </p>
              <p className="mt-1 text-[0.95rem] break-keep text-slate-600">
                {tab === 'all'
                  ? '마감이 지난 일, 빠진 서류, 못 받은 돈이 모두 없습니다.'
                  : '다른 분류를 눌러 확인해 보세요.'}
              </p>
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {shownAlerts.map((a) => (
                  <AlertRow key={a.id} alert={a} onOpen={openAlert} />
                ))}
              </ul>
              {visibleAlerts.length > shownAlerts.length && (
                <button
                  type="button"
                  onClick={() => setShowAllAlerts(true)}
                  className="self-start rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-[0.92rem] font-medium text-slate-600 hover:bg-slate-50"
                >
                  {visibleAlerts.length - shownAlerts.length}건 더 보기
                </button>
              )}
            </>
          )}
          </>
        )}
      </section>

      {/*
        목록에서 바로 고치기.
        저장은 상세 화면과 같은 함수를 쓰므로 여기서 바꾼 값이 업체 기록에 그대로
        들어간다 — 목록용 사본을 따로 두지 않는다.
      */}
      {quick?.kind === 'service' && quickRecord && (
        <ServiceStatusSheet
          record={quickRecord}
          serviceKey={quick.serviceKey}
          onSave={(next) => void quickSave(next)}
          onOpenClient={() => navigate(`/ops/clients/${quickRecord.id}?tab=work&svc=${quick.serviceKey}`)}
          onClose={() => setQuick(null)}
        />
      )}
      {quick?.kind === 'money' && quickRecord && (
        <ClientMoneySheet
          record={quickRecord}
          today={today}
          onSave={(next) => void quickSave(next)}
          onOpenClient={() => navigate(`/ops/clients/${quickRecord.id}?tab=fees`)}
          onClose={() => setQuick(null)}
        />
      )}

      {catalogOpen && (
        <ServiceCatalogModal
          workspaceId={workspaceId}
          onClose={() => setCatalogOpen(false)}
          onChanged={() => void load()}
        />
      )}

      {/* 새 업체 등록 */}
      {formOpen && (
        <div className="ax-fade fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-4 sm:items-center">
          <form
            onSubmit={submit}
            className="ax-pop w-full max-w-lg rounded-(--radius-panel) bg-white p-6 shadow-(--shadow-overlay)"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[1.3rem] font-bold text-slate-900">새 업체 등록</h2>
              <button
                type="button"
                className="text-[0.95rem] text-slate-500 hover:text-slate-800"
                onClick={() => setFormOpen(false)}
              >
                닫기
              </button>
            </div>
            <p className="mt-1 text-[0.95rem] break-keep text-slate-500">
              업체명만 넣어도 됩니다. 나머지는 나중에 채울 수 있습니다.
            </p>
            <div className="mt-5 grid gap-4">
              <label className="text-[0.95rem] font-medium text-slate-700">
                업체명
                <input
                  autoFocus
                  required
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  className="mt-1.5 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-[0.95rem] font-medium text-slate-700">
                  대표자·담당자
                  <input
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    className="mt-1.5 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]"
                  />
                </label>
                <label className="text-[0.95rem] font-medium text-slate-700">
                  휴대폰번호
                  <input
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="010-0000-0000"
                    className="mt-1.5 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]"
                  />
                </label>
              </div>
              <label className="text-[0.95rem] font-medium text-slate-700">
                사업자등록번호
                <input
                  value={form.businessNumber}
                  onChange={(e) => setForm({ ...form, businessNumber: e.target.value })}
                  placeholder="000-00-00000"
                  className="mt-1.5 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
                취소
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? '등록 중…' : '등록하고 열기'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 판단 기준은 '지금 챙길 것' 을 펼쳤을 때만 — 매일 보는 화면에 각주가 늘 떠 있을 이유가 없다 */}
      {alertsOpen && (
        <p className="pb-2 text-[0.85rem] text-slate-500">
          {SEVERITY_META.critical.label}·{SEVERITY_META.warning.label} 판단 기준: 마감 {DUE_SOON_DAYS}일 이내, 서류 유효기간 30일 이내,
          고객 회신 7일 이상 대기.
        </p>
      )}
    </div>
  )
}

function CloudOperationsHub() {
  const { currentWorkspaceId } = useAuth()
  return <OperationsHubContent workspaceId={currentWorkspaceId} />
}

export function OperationsHubPage() {
  return getDataModeConfig().mode === 'supabase' ? (
    <CloudOperationsHub />
  ) : (
    <OperationsHubContent workspaceId={null} />
  )
}
