import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ClipboardCopy,
  FileWarning,
  Lock,
  Paperclip,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { getDataModeConfig } from '../data/dataMode'
import {
  canUploadFiles,
  listClients,
  saveClient,
  uploadDocumentFile,
  withDocument,
  withFee,
  withNewFee,
  withArchived,
  withFunding,
  withNewFunding,
  withNewNote,
  withNotePinned,
  withNoteText,
  withService,
  withoutFee,
  withoutFunding,
  withoutNote,
} from '../services/clientOpsService'
import {
  buildClientAlerts,
  clientOpsProgress,
  documentStatus,
  dueText,
  missingDocumentsFor,
  daysLeftFrom,
} from '../services/clientOpsAlerts'
import {
  buildDocumentRequestMessage,
  buildStatusReportMessage,
} from '../services/clientOpsMessages'
import {
  ACCENT_CLASS,
  DOCUMENTS,
  FEE_KIND_LABEL,
  FEE_KIND_ORDER,
  SERVICES,
  SERVICE_STATUS_LABEL,
  SERVICE_STATUS_ORDER,
  isServiceStarted,
  servicesNeeding,
} from '../content/clientOpsCatalog'
import { todayLocalDate } from '../lib/appClock'
import { formatKrw } from '../lib/format'
import type {
  ClientOpsRecord,
  ClientOpsStatus,
  DocumentKey,
  FeeKind,
  ServiceKey,
  ServiceStatus,
} from '../types/clientOps'
import { Button } from '../components/ui/Button'
import { NotFoundState } from '../components/ui/NotFoundState'
import { Panel } from '../components/ui/Panel'
import { useToast } from '../components/ui/toastContext'
import { AlertRow, ClientStatusChip, StatTile } from '../components/ops/opsParts'
import {
  DueDateField,
  MessageModal,
  PhoneLink,
  SavedBadge,
} from '../components/ops/opsControls'
import { CompanyProfileCard, NotesSection } from '../components/ops/opsProfile'
import { FundingSection } from '../components/ops/FundingSection'
import { DocImportModal } from '../components/ops/DocImportModal'
import { withActivity } from '../services/clientOpsActivity'
import { ActivityLog } from '../components/ops/ActivityLog'
import { PortalTab } from '../components/ops/PortalTab'
import { ScreenGuide } from '../components/onboarding/ScreenGuide'
import { ClientJournalTab } from '../components/ops/ClientJournalTab'
import { FilesTab } from '../components/ops/FilesTab'
import { listLinksForClient } from '../services/customerBridgeService'
import { buildClientSchedule } from '../services/clientOpsSchedule'
import { brand } from '../brand/brand.config'

const CLIENT_STATUS_ORDER: ClientOpsStatus[] = ['active', 'waiting', 'paused', 'completed']
const CLIENT_STATUS_TEXT: Record<ClientOpsStatus, string> = {
  active: '진행 중',
  waiting: '고객 대기',
  paused: '일시 중지',
  completed: '종료',
}

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.98rem] focus:border-brand-500 focus:outline-none'

type DetailTab = 'overview' | 'work' | 'docs' | 'fees' | 'funding' | 'portal' | 'journal' | 'files'
const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'overview', label: '개요' },
  { key: 'work', label: '업무' },
  { key: 'docs', label: '서류' },
  { key: 'fees', label: '수금' },
  { key: 'funding', label: '자금·지원' },
  { key: 'portal', label: '고객 플랫폼' },
  { key: 'journal', label: '업무 일기' },
  { key: 'files', label: '파일' },
]
function isDetailTab(v: string | null): v is DetailTab {
  return DETAIL_TABS.some((t) => t.key === v)
}

function ClientDetailContent({ workspaceId, userId }: { workspaceId: string | null; userId: string | null }) {
  const { clientId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: DetailTab = isDetailTab(tabParam) ? tabParam : 'overview'
  const setTab = (next: DetailTab) => setSearchParams(next === 'overview' ? {} : { tab: next }, { replace: true })
  const [portalLinked, setPortalLinked] = useState<boolean | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const { showToast } = useToast()
  const [record, setRecord] = useState<ClientOpsRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState<{ title: string; description: string; text: string } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  const today = todayLocalDate()

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const all = await listClients(workspaceId)
      const found = all.find((r) => r.id === clientId) ?? null
      setRecord(found)
      setNotFound(found === null)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, clientId, showToast])

  useEffect(() => {
    void load()
  }, [load])

  // 고객 플랫폼 연결 여부 — 헤더 칩용. 브릿지 미적용이면 null(표시 안 함)
  useEffect(() => {
    let alive = true
    listLinksForClient(workspaceId, clientId)
      .then((links) => { if (alive) setPortalLinked(links.some((l) => l.status === 'active')) })
      .catch(() => { if (alive) setPortalLinked(null) })
    return () => { alive = false }
  }, [workspaceId, clientId, tab])

  const commit = useCallback(
    async (next: ClientOpsRecord) => {
      setRecord(next)
      try {
        const saved = await saveClient(next)
        setRecord(saved)
        setSavedAt(Date.now())
      } catch (cause) {
        showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
        void load()
      }
    },
    [showToast, load],
  )

  const alerts = useMemo(() => (record ? buildClientAlerts(record, today) : []), [record, today])
  const progress = useMemo(() => (record ? clientOpsProgress(record, today) : null), [record, today])

  /** 지금 착수한 업무가 필요로 하는데 없는 서류 (서류함 상단 고정) */
  const urgentDocs = useMemo(() => {
    if (!record) return new Set<DocumentKey>()
    const set = new Set<DocumentKey>()
    for (const s of SERVICES) {
      if (!isServiceStarted(record.services[s.key].status)) continue
      for (const d of missingDocumentsFor(record, s.key, today)) set.add(d.key)
    }
    return set
  }, [record, today])

  /** 가장 임박한 마감 (헤더 표시) */
  const nearest = useMemo(() => {
    if (!record) return null
    const upcoming = buildClientSchedule(record, today).filter((e) => !e.done)
    return upcoming.sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  }, [record, today])

  if (loading) return <p className="px-1 py-10 text-[0.98rem] text-slate-500">불러오는 중…</p>
  if (notFound || !record || !progress) {
    return (
      <NotFoundState
        title="업체를 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제된 업체입니다."
        backTo="/ops/clients"
        backLabel="고객 운영 현황으로"
      />
    )
  }

  const uploadable = canUploadFiles()

  const onPickFile = async (key: DocumentKey, file: File | undefined) => {
    if (!file) return
    try {
      const saved = await uploadDocumentFile(record, key, file)
      setRecord(saved)
      setSavedAt(Date.now())
      showToast('파일을 보관했습니다.')
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '파일을 보관하지 못했습니다.')
    }
  }

  const cardOpen = (key: ServiceKey, auto: boolean) => openCards[key] ?? auto
  const toggleCard = (key: ServiceKey, auto: boolean) =>
    setOpenCards((s) => ({ ...s, [key]: !(s[key] ?? auto) }))

  return (
    <div className="flex flex-col gap-5">
      <SavedBadge savedAt={savedAt} />

      {/* 헤더 */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => navigate('/ops/clients')}
          className="inline-flex w-fit items-center gap-1.5 text-[0.95rem] font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          고객 운영 현황
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[1.75rem] leading-tight font-bold break-keep text-slate-900">
                {record.companyName || '(이름 없음)'}
              </h1>
              <ClientStatusChip status={record.status} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem] text-slate-500">
              <PhoneLink phone={record.contactPhone} />
              {record.contactName && <span>{record.contactName}</span>}
              {record.businessNumber && <span>사업자 {record.businessNumber}</span>}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.92rem]">
              <span className="text-slate-700"><span className="text-slate-400">다음 행동 · </span>{record.nextAction || '미정'}{record.nextActionDueDate ? ` (${record.nextActionDueDate})` : ''}</span>
              {nearest && (
                <span className={nearest.daysLeft !== null && nearest.daysLeft < 0 ? 'font-semibold text-danger-700' : 'text-slate-700'}>
                  <span className="text-slate-400">가장 임박 · </span>{nearest.title} {nearest.date}
                </span>
              )}
              {portalLinked !== null && (
                <button type="button" onClick={() => setTab('portal')} className={`rounded-full px-2 py-0.5 text-[0.82rem] font-semibold ${portalLinked ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}>
                  {brand.customerPlatformLabel} {portalLinked ? '연결됨' : '미연결'}
                </button>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
          <ScreenGuide screenKey="client_detail" />
          <label className="text-[0.92rem] font-medium text-slate-600">
            업체 상태
            <select
              value={record.status}
              onChange={(e) => {
                const status = e.target.value as ClientOpsStatus
                void commit(
                  withActivity(
                    { ...record, status },
                    'profile',
                    `업체 상태 · ${CLIENT_STATUS_TEXT[record.status]} → ${CLIENT_STATUS_TEXT[status]}`,
                  ),
                )
              }}
              className="mt-1 block rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.98rem]"
            >
              {CLIENT_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {CLIENT_STATUS_TEXT[s]}
                </option>
              ))}
            </select>
          </label>
          </div>
        </div>

        {/* 고객에게 보낼 문구 */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() =>
              setMessage({
                title: '서류 요청 문구',
                description: '지금 진행 중인 업무에 필요한데 아직 없는 서류만 골라 정리했습니다.',
                text: buildDocumentRequestMessage(record, today),
              })
            }
          >
            <Send aria-hidden="true" className="size-4" />
            서류 요청 문구 만들기
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              setMessage({
                title: '진행 상황 보고 문구',
                description: '업무별 현재 상태와 다음 단계를 정리했습니다.',
                text: buildStatusReportMessage(record, today),
              })
            }
          >
            <ClipboardCopy aria-hidden="true" className="size-4" />
            진행 상황 보고 문구
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const next = withArchived(record, record.archivedAt === null)
              void commit(next)
              showToast(next.archivedAt ? '보관 처리했습니다. 목록·경고에서 빠집니다.' : '보관을 해제했습니다.')
            }}
          >
            {record.archivedAt ? '보관 해제' : '보관하기'}
          </Button>
        </div>
        {record.archivedAt && (
          <p className="rounded-(--radius-control) border border-slate-200 bg-slate-50 px-4 py-2.5 text-[0.92rem] break-keep text-slate-600">
            보관된 업체입니다. 현황표·경고·일정에 나타나지 않습니다. 데이터는 그대로 있습니다.
          </p>
        )}
      </div>

      {/* 탭 — 개요는 요약, 나머지는 각 영역 */}
      <div role="tablist" aria-label="업체 상세" className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {DETAIL_TABS.map((t) => {
          const badge =
            t.key === 'overview' ? alerts.filter((a) => a.severity === 'critical').length
              : t.key === 'docs' ? urgentDocs.size
                : t.key === 'fees' ? record.fees.filter((f) => !f.receivedAt).length
                  : t.key === 'funding' ? record.fundingApplications.filter((a) => a.status === 'watching' || a.status === 'preparing').length
                    : 0
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[0.95rem] font-semibold whitespace-nowrap ${
                tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
              {badge > 0 && <span className={`rounded-full px-1.5 text-[0.75rem] ${t.key === 'overview' ? 'bg-danger-50 text-danger-700' : 'bg-slate-100 text-slate-600'}`}>{badge}</span>}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && (
        <>
      {/* NOW → 진행 중 업무 → 막힘 → 돈 → 고객 */}
      <section aria-label="지금" className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)">
          <p className="text-[0.85rem] font-semibold tracking-wide text-slate-400 uppercase">지금</p>
          <p className="mt-1 text-[1.05rem] font-bold break-keep text-slate-900">{record.nextAction || '다음 행동이 정해지지 않았습니다.'}</p>
          {record.nextActionDueDate && <p className="text-[0.9rem] text-slate-500">{record.nextActionDueDate}까지</p>}
          <div className="mt-3">
            <p className="text-[0.85rem] font-semibold text-slate-500">진행 중인 업무</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {SERVICES.filter((m) => isServiceStarted(record.services[m.key].status) && record.services[m.key].status !== 'done').map((m) => (
                <li key={m.key}>
                  <button type="button" onClick={() => setTab('work')} className={`rounded-full border px-2.5 py-1 text-[0.85rem] font-medium ${ACCENT_CLASS[m.accent].chip}`}>
                    {m.shortLabel} · {SERVICE_STATUS_LABEL[record.services[m.key].status]}
                  </button>
                </li>
              ))}
              {SERVICES.every((m) => !isServiceStarted(record.services[m.key].status) || record.services[m.key].status === 'done') && (
                <li className="text-[0.9rem] text-slate-400">진행 중인 업무가 없습니다.</li>
              )}
            </ul>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <button type="button" onClick={() => setTab('docs')} className={`rounded-(--radius-panel) border p-4 text-left shadow-(--shadow-card) ${urgentDocs.size > 0 ? 'border-danger-200 bg-danger-50/60' : 'border-slate-200 bg-white'}`}>
            <p className="text-[0.85rem] font-semibold text-slate-500">막힘 · 없는 서류</p>
            <p className={`text-[1.2rem] font-bold ${urgentDocs.size > 0 ? 'text-danger-700' : 'text-slate-900'}`}>{urgentDocs.size}건</p>
          </button>
          <button type="button" onClick={() => setTab('fees')} className={`rounded-(--radius-panel) border p-4 text-left shadow-(--shadow-card) ${progress.overduePayments > 0 ? 'border-danger-200 bg-danger-50/60' : 'border-slate-200 bg-white'}`}>
            <p className="text-[0.85rem] font-semibold text-slate-500">돈 · 아직 못 받음</p>
            <p className={`text-[1.2rem] font-bold ${progress.overduePayments > 0 ? 'text-danger-700' : 'text-slate-900'}`}>{formatKrw(progress.unpaidAmount)}</p>
          </button>
          <button type="button" onClick={() => setTab('portal')} className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 text-left shadow-(--shadow-card)">
            <p className="text-[0.85rem] font-semibold text-slate-500">고객 · {brand.customerPortalLabel}</p>
            <p className="text-[1.2rem] font-bold text-slate-900">{portalLinked === null ? '준비 중' : portalLinked ? '연결됨' : '미연결'}</p>
          </button>
        </div>
      </section>

      {/* 이 업체에서 지금 챙길 것 */}
      {alerts.length > 0 && (
        <section aria-labelledby="client-alerts" className="flex flex-col gap-2">
          <h2 id="client-alerts" className="text-[1.15rem] font-bold text-slate-900">
            이 업체에서 지금 챙길 것 {alerts.length}건
          </h2>
          <ul className="flex flex-col gap-2">
            {alerts.slice(0, 6).map((a) => (
              <AlertRow key={a.id} alert={a} onOpen={() => undefined} />
            ))}
          </ul>
        </section>
      )}

      {/* 요약 */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          label="완료한 업무"
          value={`${progress.servicesDone}/${progress.servicesTotal}`}
          icon={Check}
          tone={progress.servicesDone === progress.servicesTotal ? 'success' : 'neutral'}
        />
        <StatTile
          label="확보한 서류"
          value={`${progress.documentsUsable}/${progress.documentsTotal}`}
          icon={Paperclip}
          tone={progress.documentsUsable < progress.documentsTotal ? 'warning' : 'success'}
        />
        <StatTile
          label="아직 못 받은 돈"
          value={formatKrw(progress.unpaidAmount)}
          icon={Wallet}
          tone={progress.overduePayments > 0 ? 'danger' : 'neutral'}
          hint={progress.overduePayments > 0 ? `예정일 지난 건 ${progress.overduePayments}건` : undefined}
        />
      </section>

      <ActivityLog entries={record.activity} />

      {/* 회사 기본 정보 — 자주 찾는 값 */}
      <CompanyProfileCard record={record} today={today} onImport={() => setImportOpen(true)} />
        </>
      )}

      {tab === 'work' && (
      <section aria-labelledby="svc" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="svc" className="text-[1.3rem] font-bold text-slate-900">
            진행 업무
          </h2>
          <p className="text-[0.9rem] text-slate-500">제목을 누르면 자세한 내용이 열립니다.</p>
        </div>
        <div className="flex flex-col gap-2.5">
          {SERVICES.map((meta) => {
            const state = record.services[meta.key]
            const missing = missingDocumentsFor(record, meta.key, today)
            const started = isServiceStarted(state.status)
            const blocked = started && missing.length > 0
            const open = state.status !== 'done' && state.status !== 'not_applicable'
            const dLeft = state.dueDate ? daysLeftFrom(today, state.dueDate) : null
            const overdue = open && dLeft !== null && dLeft < 0
            const dueSoon = open && dLeft !== null && dLeft >= 0 && dLeft <= 7
            // 손댈 필요가 있는 업무는 기본으로 펼친다
            const auto = started || overdue || blocked
            const expanded = cardOpen(meta.key, auto)

            return (
              <div
                key={meta.key}
                id={meta.key}
                className={`overflow-hidden rounded-(--radius-panel) border ${
                  blocked || overdue
                    ? 'border-danger-200 bg-danger-50/40'
                    : dueSoon
                      ? 'border-warning-200 bg-warning-50/40'
                      : 'border-slate-200 bg-white'
                }`}
              >
                <div className={`h-1 w-full ${ACCENT_CLASS[meta.accent].bar}`} />
                <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggleCard(meta.key, auto)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <ChevronDown
                      aria-hidden="true"
                      className={`size-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${ACCENT_CLASS[meta.accent].dot}`} />
                        <span className="text-[1.08rem] font-bold break-keep text-slate-900">{meta.label}</span>
                        {meta.recurring && (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.75rem] font-medium text-slate-500">
                            반복
                          </span>
                        )}
                        {blocked && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-danger-200 bg-danger-100 px-1.5 py-0.5 text-[0.78rem] font-bold text-danger-700">
                            <Lock aria-hidden="true" className="size-3" />
                            서류 {missing.length}건 부족
                          </span>
                        )}
                        {open && dLeft !== null && (
                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[0.78rem] font-bold ${
                              dLeft < 0
                                ? 'border-danger-200 bg-danger-100 text-danger-700'
                                : dLeft <= 7
                                  ? 'border-warning-200 bg-warning-100 text-warning-800'
                                  : 'border-slate-200 bg-slate-50 text-slate-500'
                            }`}
                          >
                            {dueText(dLeft)}
                          </span>
                        )}
                      </span>
                      {!expanded && state.nextStep && (
                        <span className="mt-0.5 block truncate text-[0.9rem] text-slate-500">
                          다음: {state.nextStep}
                        </span>
                      )}
                    </span>
                  </button>
                  <select
                    aria-label={`${meta.label} 상태`}
                    value={state.status}
                    onChange={(e) =>
                      void commit(withService(record, meta.key, { status: e.target.value as ServiceStatus }))
                    }
                    className="shrink-0 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-1.5 text-[0.92rem] font-medium"
                  >
                    {SERVICE_STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {SERVICE_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>

                {expanded && (
                  <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3.5">
                    <p className="text-[0.92rem] break-keep text-slate-500">{meta.description}</p>

                    {blocked && (
                      <div className="rounded-(--radius-control) border border-danger-200 bg-danger-50 px-3 py-2.5">
                        <p className="flex items-start gap-1.5 text-[0.95rem] font-semibold break-keep text-danger-700">
                          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                          아래 서류가 없어 진행이 막혔습니다
                        </p>
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {missing.map((m) => (
                            <li
                              key={m.key}
                              className="rounded-full border border-danger-200 bg-white px-2 py-0.5 text-[0.85rem] font-medium text-danger-700"
                            >
                              {m.label}
                              {m.expired ? ' (만료)' : ''}
                            </li>
                          ))}
                        </ul>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-2.5"
                          onClick={() =>
                            setMessage({
                              title: `${meta.label} — 서류 요청 문구`,
                              description: '이 업무에 필요한 서류만 정리했습니다.',
                              text: buildDocumentRequestMessage(record, today, [meta.key]),
                            })
                          }
                        >
                          <Send aria-hidden="true" className="size-3.5" />이 업무 서류 요청 문구
                        </Button>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <DueDateField
                        label="마감·목표일"
                        value={state.dueDate}
                        today={today}
                        onChange={(v) => void commit(withService(record, meta.key, { dueDate: v }))}
                      />
                      <label className="text-[0.9rem] font-medium text-slate-600">
                        다음에 할 일
                        <input
                          value={state.nextStep}
                          onChange={(e) => void commit(withService(record, meta.key, { nextStep: e.target.value }))}
                          placeholder="예: 선행기술 조사 결과 검토"
                          className={`mt-1 ${inputCls}`}
                        />
                      </label>
                    </div>

                    <label className="text-[0.9rem] font-medium text-slate-600">
                      메모
                      <textarea
                        value={state.note}
                        onChange={(e) => void commit(withService(record, meta.key, { note: e.target.value }))}
                        rows={2}
                        className={`mt-1 ${inputCls}`}
                      />
                    </label>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[0.85rem] text-slate-500">필요 서류</span>
                      {meta.requiredDocuments.map((k) => {
                        const v = documentStatus(k, record.documents[k], today)
                        return (
                          <span
                            key={k}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.82rem] font-medium ${
                              v.usable
                                ? 'border-success-200 bg-success-50 text-success-700'
                                : 'border-slate-200 bg-slate-50 text-slate-500'
                            }`}
                          >
                            {v.usable ? (
                              <Check aria-hidden="true" className="size-3" />
                            ) : (
                              <span aria-hidden="true" className="text-[0.9em]">
                                ○
                              </span>
                            )}
                            {DOCUMENTS.find((d) => d.key === k)?.label}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      )}

      {tab === 'docs' && (
      <section aria-labelledby="docs" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="docs" className="text-[1.3rem] font-bold text-slate-900">
            서류함
          </h2>
          <p className="text-[0.9rem] text-slate-500">발급일을 넣으면 유효기간이 지났는지 자동으로 알려드립니다.</p>
        </div>

        {!uploadable && (
          <p className="rounded-(--radius-control) border border-slate-200 bg-slate-50 px-4 py-3 text-[0.92rem] break-keep text-slate-600">
            지금은 이 브라우저에만 저장되는 모드입니다. 받았는지 여부·발급일·보관 위치는 지금도 기록되고, 실제 파일 첨부는 Supabase 클라우드를 연결하면 켜집니다.
          </p>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          {[...DOCUMENTS]
            .sort((a, b) => Number(urgentDocs.has(b.key)) - Number(urgentDocs.has(a.key)))
            .map((meta) => {
              const state = record.documents[meta.key]
              const view = documentStatus(meta.key, state, today)
              const needed = servicesNeeding(meta.key)
              const urgent = urgentDocs.has(meta.key)
              return (
                <div
                  key={meta.key}
                  className={`flex flex-col gap-2.5 rounded-(--radius-panel) border p-4 ${
                    view.expired
                      ? 'border-danger-200 bg-danger-50/40'
                      : urgent
                        ? 'border-danger-200 bg-white'
                        : view.expiringSoon
                          ? 'border-warning-200 bg-warning-50/40'
                          : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <label className="flex min-w-0 items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={state.received}
                        onChange={(e) => void commit(withDocument(record, meta.key, { received: e.target.checked }))}
                        className="mt-1 size-5 shrink-0 accent-brand-600"
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[1.05rem] font-bold break-keep text-slate-900">{meta.label}</span>
                          {urgent && (
                            <span className="rounded-full border border-danger-200 bg-danger-100 px-1.5 py-0.5 text-[0.75rem] font-bold text-danger-700">
                              지금 필요
                            </span>
                          )}
                          {meta.sensitive && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.75rem] font-medium text-slate-500">
                              <ShieldAlert aria-hidden="true" className="size-3" />
                              민감
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[0.88rem] break-keep text-slate-500">{meta.hint}</span>
                      </span>
                    </label>
                    {view.expired && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-danger-200 bg-danger-100 px-2 py-0.5 text-[0.8rem] font-bold text-danger-700">
                        <FileWarning aria-hidden="true" className="size-3.5" />
                        만료됨
                      </span>
                    )}
                    {!view.expired && view.expiringSoon && (
                      <span className="shrink-0 rounded-full border border-warning-200 bg-warning-100 px-2 py-0.5 text-[0.8rem] font-bold text-warning-800">
                        {dueText(view.daysLeft)}
                      </span>
                    )}
                  </div>

                  {state.received && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {meta.validMonths !== null && (
                        <label className="text-[0.88rem] font-medium text-slate-600">
                          발급일
                          <input
                            type="date"
                            value={state.issuedAt}
                            onChange={(e) => void commit(withDocument(record, meta.key, { issuedAt: e.target.value }))}
                            className={`mt-1 ${inputCls}`}
                          />
                          <span className="mt-1 block text-[0.8rem] text-slate-500">
                            {view.expiresOn
                              ? `${view.expiresOn}까지 유효 (${meta.validMonths}개월)`
                              : `유효 ${meta.validMonths}개월 — 발급일을 넣어주세요`}
                          </span>
                        </label>
                      )}
                      <label className="text-[0.88rem] font-medium text-slate-600">
                        {meta.key === 'jointCertificate' ? '보관 위치 (비밀번호는 적지 마세요)' : '메모'}
                        <input
                          value={state.note}
                          onChange={(e) => void commit(withDocument(record, meta.key, { note: e.target.value }))}
                          placeholder={
                            meta.key === 'jointCertificate'
                              ? '예: 대표님 USB / 회사 PC 바탕화면'
                              : meta.needsFile
                                ? '예: 8월 갱신본'
                                : '값을 적어 두세요'
                          }
                          className={`mt-1 ${inputCls}`}
                        />
                      </label>
                    </div>
                  )}

                  {meta.needsFile && state.received && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={(el) => {
                          fileInputs.current[meta.key] = el
                        }}
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => void onPickFile(meta.key, e.target.files?.[0])}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!uploadable}
                        onClick={() => fileInputs.current[meta.key]?.click()}
                      >
                        <Upload aria-hidden="true" className="size-3.5" />
                        {state.fileName ? '파일 교체' : '파일 첨부'}
                      </Button>
                      {state.fileName && (
                        <span className="inline-flex min-w-0 items-center gap-1 text-[0.88rem] text-slate-600">
                          <Paperclip aria-hidden="true" className="size-3.5 shrink-0" />
                          <span className="truncate">{state.fileName}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {needed.length > 0 && (
                    <p className="text-[0.82rem] break-keep text-slate-400">
                      필요한 업무: {needed.map((s) => s.shortLabel).join(', ')}
                    </p>
                  )}
                </div>
              )
            })}
        </div>
      </section>

      )}

      {tab === 'funding' && (
        <FundingSection
          record={record}
          today={today}
          onAdd={(input) => void commit(withNewFunding(record, input))}
          onChange={(id, patch) => void commit(withFunding(record, id, patch))}
          onRemove={(id) => void commit(withoutFunding(record, id))}
        />
      )}

      {tab === 'fees' && <FeesSection record={record} onChange={commit} today={today} />}

      {tab === 'portal' && <PortalTab record={record} workspaceId={workspaceId} />}

      {tab === 'journal' && (
        <>
          <ClientJournalTab record={record} workspaceId={workspaceId} userId={userId} />
          <NotesSection
            record={record}
            onAdd={(text) => void commit(withNewNote(record, text))}
            onEdit={(id, text) => void commit(withNoteText(record, id, text))}
            onPin={(id, pinned) => void commit(withNotePinned(record, id, pinned))}
            onDelete={(id) => void commit(withoutNote(record, id))}
          />
        </>
      )}

      {tab === 'files' && <FilesTab record={record} workspaceId={workspaceId} />}

      {/* 업체 정보 — 개요 아래에 접어 둔다 */}
      {tab === 'overview' && (
      <section aria-labelledby="info" className="flex flex-col gap-3">
        <h2 id="info" className="text-[1.3rem] font-bold text-slate-900">
          <button type="button" onClick={() => setInfoOpen((v) => !v)} aria-expanded={infoOpen} className="inline-flex items-center gap-2">
            업체 정보 수정 <span className="text-[0.85rem] font-medium text-slate-400">{infoOpen ? '접기' : '펼치기'}</span>
          </button>
        </h2>
        <Panel>
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            <TextField label="업체명" value={record.companyName} onChange={(v) => void commit({ ...record, companyName: v })} />
            <TextField label="대표자·담당자" value={record.contactName} onChange={(v) => void commit({ ...record, contactName: v })} />
            <TextField label="휴대폰번호" value={record.contactPhone} onChange={(v) => void commit({ ...record, contactPhone: v })} placeholder="010-0000-0000" />
            <TextField label="이메일" value={record.contactEmail} onChange={(v) => void commit({ ...record, contactEmail: v })} />
            <TextField label="사업자등록번호" value={record.businessNumber} onChange={(v) => void commit({ ...record, businessNumber: v })} placeholder="000-00-00000" />
            <TextField label="법인번호" value={record.corporateNumber} onChange={(v) => void commit({ ...record, corporateNumber: v })} />
            <TextField label="담당자 직급" value={record.contactTitle} onChange={(v) => void commit({ ...record, contactTitle: v })} placeholder="예: 대표이사, 부장" />
            <TextField label="대표자 생년월일" value={record.representativeBirth} onChange={(v) => void commit({ ...record, representativeBirth: v })} placeholder="1980-12-31" />
            <TextField label="설립일(개업일)" value={record.establishedAt} onChange={(v) => void commit({ ...record, establishedAt: v })} placeholder="2019-03-05" />
            <TextField label="업태" value={record.businessCategory} onChange={(v) => void commit({ ...record, businessCategory: v })} placeholder="예: 제조업" />
            <TextField label="종목" value={record.businessItem} onChange={(v) => void commit({ ...record, businessItem: v })} placeholder="예: 자동차부품" />
            <TextField label="업종(분류)" value={record.industry} onChange={(v) => void commit({ ...record, industry: v })} />
            <TextField label="회사 대표번호" value={record.companyPhone} onChange={(v) => void commit({ ...record, companyPhone: v })} />
            <TextField label="홈페이지" value={record.homepage} onChange={(v) => void commit({ ...record, homepage: v })} />
            <TextField label="사업장 주소" value={record.businessAddress} onChange={(v) => void commit({ ...record, businessAddress: v })} />
          </div>
          <label className="mt-3 block text-[0.9rem] font-medium text-slate-600">
            메모
            <textarea
              value={record.notes}
              onChange={(e) => void commit({ ...record, notes: e.target.value })}
              rows={3}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <p className="mt-3 flex items-start gap-1.5 text-[0.85rem] break-keep text-slate-400">
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            공동인증서 비밀번호와 주민등록번호는 이 시스템에 저장하지 않습니다. 인증서는 "받았는지"와 "어디에 보관 중인지"만 기록하세요.
          </p>
        </Panel>
      </section>

      )}

      {importOpen && (
        <DocImportModal
          currentValues={{
            companyName: record.companyName,
            businessNumber: record.businessNumber,
            corporateNumber: record.corporateNumber,
            representativeName: record.contactName,
            representativeBirth: record.representativeBirth,
            establishedAt: record.establishedAt,
            address: record.businessAddress,
            businessCategory: record.businessCategory,
            businessItem: record.businessItem,
          }}
          onClose={() => setImportOpen(false)}
          onApply={({ picked }) => {
            const next = { ...record }
            if (picked.companyName) next.companyName = picked.companyName
            if (picked.businessNumber) next.businessNumber = picked.businessNumber
            if (picked.corporateNumber) next.corporateNumber = picked.corporateNumber
            if (picked.representativeName) next.contactName = picked.representativeName
            if (picked.representativeBirth) next.representativeBirth = picked.representativeBirth
            if (picked.establishedAt) next.establishedAt = picked.establishedAt
            if (picked.address) next.businessAddress = picked.address
            if (picked.businessCategory) next.businessCategory = picked.businessCategory
            if (picked.businessItem) next.businessItem = picked.businessItem
            const filled = Object.values(picked).filter((v) => typeof v === 'string' && v.trim() !== '').length
            void commit(withActivity(next, 'profile', `서류에서 기업 정보 ${filled}개 항목 반영`))
            setImportOpen(false)
            showToast('서류에서 읽은 정보를 반영했습니다.')
          }}
        />
      )}

      {message && (
        <MessageModal
          title={message.title}
          description={message.description}
          text={message.text}
          onClose={() => setMessage(null)}
        />
      )}
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="block py-1.5 text-[0.9rem] font-medium text-slate-600">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 ${inputCls}`}
      />
    </label>
  )
}

function FeesSection({
  record,
  onChange,
  today,
}: {
  record: ClientOpsRecord
  onChange: (next: ClientOpsRecord) => void
  today: string
}) {
  const [kind, setKind] = useState<FeeKind>('deposit')
  const [serviceKey, setServiceKey] = useState<ServiceKey | ''>('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')

  const unpaid = record.fees.filter((f) => f.receivedAt === null)
  const unpaidTotal = unpaid.reduce((s, f) => s + (f.amount ?? 0), 0)
  const paidTotal = record.fees.filter((f) => f.receivedAt !== null).reduce((s, f) => s + (f.amount ?? 0), 0)

  const add = () => {
    const numeric = Number(amount.replace(/[^0-9]/g, ''))
    onChange(
      withNewFee(record, {
        kind,
        serviceKey: serviceKey === '' ? null : serviceKey,
        amount: Number.isFinite(numeric) && numeric > 0 ? numeric : null,
        dueDate,
      }),
    )
    setAmount('')
    setDueDate('')
  }

  return (
    <section aria-labelledby="fees" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="fees" className="text-[1.3rem] font-bold text-slate-900">
          계약금 · 성공보수
        </h2>
        <p className="text-[0.95rem] text-slate-600">
          받은 돈 <strong className="text-slate-900">{formatKrw(paidTotal)}</strong> · 못 받은 돈{' '}
          <strong className={unpaidTotal > 0 ? 'text-danger-700' : 'text-slate-900'}>{formatKrw(unpaidTotal)}</strong>
        </p>
      </div>

      <Panel flush>
        {record.fees.length === 0 ? (
          <p className="px-5 py-6 text-[0.95rem] text-slate-500">
            아직 등록한 수금 항목이 없습니다. 아래에서 계약금·중도금·성공보수를 추가하세요.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {record.fees.map((fee) => {
              const left = fee.dueDate ? daysLeftFrom(today, fee.dueDate) : null
              const overdue = fee.receivedAt === null && left !== null && left < 0
              return (
                <li key={fee.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={fee.receivedAt !== null}
                      onChange={(e) =>
                        onChange(withFee(record, fee.id, { receivedAt: e.target.checked ? today : null }))
                      }
                      className="size-5 accent-brand-600"
                    />
                    <span className="sr-only">입금 완료</span>
                  </label>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[1rem] font-semibold break-keep text-slate-900">{fee.label}</span>
                      {fee.serviceKey && (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.78rem] text-slate-500">
                          {SERVICES.find((s) => s.key === fee.serviceKey)?.shortLabel}
                        </span>
                      )}
                      {overdue && (
                        <span className="rounded-full border border-danger-200 bg-danger-100 px-1.5 py-0.5 text-[0.78rem] font-bold text-danger-700">
                          {dueText(left)}
                        </span>
                      )}
                      {fee.receivedAt && (
                        <span className="rounded-full border border-success-200 bg-success-50 px-1.5 py-0.5 text-[0.78rem] font-semibold text-success-700">
                          {fee.receivedAt} 입금
                        </span>
                      )}
                    </span>
                  </span>
                  <input
                    type="date"
                    aria-label={`${fee.label} 받기로 한 날`}
                    value={fee.dueDate}
                    onChange={(e) => onChange(withFee(record, fee.id, { dueDate: e.target.value }))}
                    className="rounded-(--radius-control) border border-slate-300 px-2 py-1.5 text-[0.92rem]"
                  />
                  <span
                    className={`w-32 shrink-0 text-right text-[1rem] font-semibold ${
                      fee.receivedAt ? 'text-slate-500 line-through' : 'text-slate-900'
                    }`}
                  >
                    {formatKrw(fee.amount)}
                  </span>
                  <button
                    type="button"
                    aria-label={`${fee.label} 삭제`}
                    onClick={() => onChange(withoutFee(record, fee.id))}
                    className="rounded-(--radius-control) p-2 text-slate-400 hover:bg-slate-100 hover:text-danger-600"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 px-5 py-4">
          <label className="text-[0.88rem] font-medium text-slate-600">
            종류
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as FeeKind)}
              className="mt-1 block rounded-(--radius-control) border border-slate-300 px-2 py-2 text-[0.95rem]"
            >
              {FEE_KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {FEE_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[0.88rem] font-medium text-slate-600">
            관련 업무
            <select
              value={serviceKey}
              onChange={(e) => setServiceKey(e.target.value as ServiceKey | '')}
              className="mt-1 block rounded-(--radius-control) border border-slate-300 px-2 py-2 text-[0.95rem]"
            >
              <option value="">전체 계약</option>
              {SERVICES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.shortLabel}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[0.88rem] font-medium text-slate-600">
            금액(원)
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder="3000000"
              className="mt-1 block w-36 rounded-(--radius-control) border border-slate-300 px-2 py-2 text-[0.95rem]"
            />
          </label>
          <label className="text-[0.88rem] font-medium text-slate-600">
            받기로 한 날
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 block rounded-(--radius-control) border border-slate-300 px-2 py-2 text-[0.95rem]"
            />
          </label>
          <Button variant="secondary" onClick={add}>
            <Plus aria-hidden="true" className="size-4" />
            추가
          </Button>
        </div>
      </Panel>
    </section>
  )
}

function CloudClientDetail() {
  const { currentWorkspaceId, session } = useAuth()
  return <ClientDetailContent workspaceId={currentWorkspaceId} userId={session?.user.id ?? null} />
}

export function OperationsClientDetailPage() {
  return getDataModeConfig().mode === 'supabase' ? (
    <CloudClientDetail />
  ) : (
    <ClientDetailContent workspaceId={null} userId={null} />
  )
}
