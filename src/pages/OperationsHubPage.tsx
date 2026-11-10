import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMoneyWords } from '../components/ops/useMoneyWords'
import { AiAssist } from '../components/ai/AiAssist'
import { clientsBundle } from '../services/aiAssist/builders'
import { useSerialSave } from '../lib/useSerialSave'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryInUrl } from '../lib/useQueryInUrl'
import {
  Archive,
  BriefcaseBusiness,
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
  SlidersHorizontal,
  AlarmClock,
  Clock,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useIsPilot } from '../auth/osAccess'
import { ServiceCatalogModal } from '../components/ops/ServiceCatalogModal'
// D-159: 기본 정렬을 '요즘 챙기는 순' 으로 바꾸며 새 이름에 기억한다(예전에 기억해 둔 '급한 순' 에 묶이지 않게)
const SORT_KEY = 'axmvp.clients.sort.v2'
const FILTER_KEY = 'axmvp.clients.filter'
const SEGMENT_KEY = 'axmvp.clients.segment'

import { ClientBoardCard } from '../components/ops/ClientBoardCard'
import { matchesClientSearch, searchHit } from '../services/clientOpsSearch'
import {
  CLIENT_FILTER_LABEL,
  CLIENT_FILTER_ORDER,
  isClientFilterKey,
  matchesClientFilter,
  type ClientFilterKey,
} from '../services/clientOpsFilter'
import {
  CLIENT_SORT_HINT,
  CLIENT_SORT_LABEL,
  CLIENT_SORT_ORDER,
  isClientSortKey,
  sortClients,
  type ClientSortKey,
} from '../services/clientOpsSort'
import { ClientMoneySheet, ServiceStatusSheet } from '../components/ops/ClientQuickSheets'
import { BottomSheet, ScreenTitle, type Tone } from '../components/ui/primitives'
import { SummaryChip } from '../components/ui/SummaryChip'
import { usePageLayout, visibilityOf } from '../lib/pageLayout'
import { ArrangeArea, ArrangeItem } from '../components/ui/arrange'
import { loadCustomServicesIntoCatalog } from '../services/customServiceService'
import { withNewProspect } from '../services/salesPipeline'
import { findClientForCretop } from '../services/salesCretop'
import { getDataModeConfig } from '../data/dataMode'
import { CloudUpload, Handshake } from 'lucide-react'
import {
  createClient,
  dismissLocalMigration,
  findForeignClientIds,
  listClients,
  pendingLocalClients,
  replaceAllClients,
  saveClient,
  normalizeClientOps,
} from '../services/clientOpsService'
import { downloadBackup, MODULE_DATA_PREFIX, parseBackup, parseBackupToolInputs, writeToolInputs, type MergeMode } from '../services/clientOpsBackup'
import { allowedModes, backupSourceWorkspace, checkRestoreSource, planRestore, removedNamesLine, restoreErrorLine, restoreSourceLine, type RestorePlan } from '../services/restoreGuard'
import { exportWorkspace, workspaceSectionOf, type WorkspaceSummary } from '../services/workspaceExport'
import { BackupScopeNote } from '../components/data/BackupScopeNote'
import {
  buildAllAlerts,
  clientOpsProgress,
  daysLeftFrom,
  summarizeAlerts,
} from '../services/clientOpsAlerts'
import { DUE_SOON_DAYS } from '../content/clientOpsCatalog'
import { todayLocalDate } from '../lib/appClock'
import { krwTile } from '../lib/format'
import { contractStageOf } from '../types/clientOps'
import { isContractClient, isProspect } from '../services/salesPipeline'
import type { ClientOpsRecord, OpsAlert, AlertSeverity, ServiceKey } from '../types/clientOps'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/toastContext'
import { Modal } from '../components/ui/Modal'
import { AlertRow, SEVERITY_META } from '../components/ops/opsParts'
import { useBackToClose } from '../lib/backToClose'
import { useClientGrantSummaries } from '../components/grants/useGrants'
import { useClientReco } from '../components/ops/useClientReco'
import { useGrowingCount } from '../lib/useGrowingCount'
import { CLIENT_TYPE_LABEL, CLIENT_TYPE_VIEW_KEY, CLIENT_TYPES, clientTypeOf, isClientType, rememberClientTypeView, type ClientType } from '../services/clientType'
import { ClientTypePicker } from '../components/ops/ClientTypePicker'
import { NewClientDocDrop } from '../components/ops/NewClientDocDrop'
import { EMPTY_DOCS_READ, applyNewClientGuess, type NewClientDocsRead, type NewClientField, type NewClientGuess } from '../services/newClientFromDocs'
import { clearNewClientDocs, handDocsTo, peekNewClientDocs } from '../services/docHandoff'
import { HintTip } from '../components/ui/fold'
import { hintFor } from '../content/sectionHints'
import { FirstClientSteps } from '../components/ops/FirstClientSteps'

// D-481 서류 한꺼번에 올리기 창(글자 읽기 · 서류 분석 엔진)은 카드에서 누를 때 받는다 — 목록 첫 화면이 이것 때문에 무거웠다
const BulkDocUploadSheet = lazy(() => import('../components/ops/BulkDocUploadSheet').then((m) => ({ default: m.BulkDocUploadSheet })))

/** D-181: 처음 열 때 고객 종류 — 주소(?type=consultant)가 먼저, 없으면 지난번에 보던 쪽 */
function initialClientType(): ClientType {
  if (typeof window === 'undefined') return 'sme'
  const fromUrl = new URLSearchParams(window.location.search).get('type')
  if (isClientType(fromUrl)) return fromUrl
  try {
    const v = localStorage.getItem(CLIENT_TYPE_VIEW_KEY)
    return isClientType(v) ? v : 'sme'
  } catch {
    return 'sme'
  }
}

type ClientSegment = 'contract' | 'prospect' | 'all'
const SEGMENTS: { key: ClientSegment; label: string }[] = [
  { key: 'contract', label: '계약 고객' },
  { key: 'prospect', label: '잠재고객' },
  { key: 'all', label: '전체' },
]

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

function OperationsHubContent({ workspaceId, myWorkspaces = [] }: { workspaceId: string | null; myWorkspaces?: { id: string; name: string }[] }) {
  const navigate = useNavigate()
  const pilot = useIsPilot()
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // D-162: 오늘 화면의 '첫 업체 등록' 이 ?new=1 로 등록 창을 바로 연다
  const [formOpen, setFormOpen] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1')
  // D-498 오늘 대화창에서 [새 업체로 등록] — 거기서 읽은 서류가 등록 창에 미리 들어온다(한 번만 꺼냄)
  const [preDocs] = useState(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1' ? peekNewClientDocs() : []))
  /** D-125: 이번 등록에서 이미 만든 업체(영업 칸 저장만 실패한 경우 다시 쓰려고) */
  const createdRef = useRef<ClientOpsRecord | null>(null)
  /** D-187: 등록 창에 넣은 서류 — 읽은 글자 · 찾은 값. 등록하면 업체 상세로 넘긴다 */
  const [docsRead, setDocsRead] = useState<NewClientDocsRead>(EMPTY_DOCS_READ)
  /** D-187: 서류로 채운 칸(그 값 그대로일 때만 '서류에서' 표시) · 사람이 적은 값과 서류 값이 다른 칸 */
  const [docFilled, setDocFilled] = useState<NewClientGuess>({})
  const [docDiffers, setDocDiffers] = useState<NewClientGuess>({})
  const docFilledRef = useRef<NewClientGuess>({})
  docFilledRef.current = docFilled
  /** D-187: 사람이 손댄 칸 — 서류가 저절로 채우지 않는다([서류 값으로] 를 누르면 다시 맡긴다) */
  const touchedRef = useRef<Set<NewClientField>>(new Set())
  const touch = (field: NewClientField) => touchedRef.current.add(field)
  useEffect(() => {
    if (formOpen) return
    createdRef.current = null
    touchedRef.current = new Set()
    // D-187: 창을 닫으면 넣은 서류는 버린다 — 서류로 채운 그대로인 칸도 비운다(사람이 적은 것은 둔다)
    setDocsRead(EMPTY_DOCS_READ)
    setDocDiffers({})
    const filled = docFilledRef.current
    if (Object.keys(filled).length > 0) {
      setForm((f) => applyNewClientGuess(f, {}, filled).form)
      setDocFilled({})
    }
  }, [formOpen])
  useBackToClose(formOpen, () => setFormOpen(false))
  const [tab, setTab] = useState<AlertSeverity | 'all'>('all')
  // 현황표를 먼저 보고 싶다는 요청이 있어 이 목록은 기본으로 접어 둔다.
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  /** 자주 쓰지 않는 도구(백업·일정·항목관리)를 담는 시트 */
  // D-95: 저장 공간 가득 참 띠의 '백업 내려받기' 가 ?more=1 로 이 창을 바로 연다
  const [moreOpen, setMoreOpen] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('more') === '1')
  /**
   * 목록에서 바로 고치는 시트 — 업무 상태 / 수금.
   * 업체 id 만 들고 있고 기록은 records 에서 다시 찾는다. 저장하면 records 가
   * 갱신되므로 시트가 열린 채로도 늘 최신 값을 그린다.
   */
  const [quick, setQuick] = useState<{ id: string; kind: 'service'; serviceKey: ServiceKey } | { id: string; kind: 'money' } | null>(null)
  const quickRecord = quick ? (records.find((r) => r.id === quick.id) ?? null) : null
  /** 서류 한꺼번에 올리기 시트 — 업체 id 만 든다 (D-84) */
  const [bulkDocsFor, setBulkDocsFor] = useState<string | null>(null)
  const bulkRecord = bulkDocsFor ? (records.find((r) => r.id === bulkDocsFor) ?? null) : null
  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const [form, setForm] = useState({ companyName: '', contactName: '', contactPhone: '', businessNumber: '' })
  // D-187: 서류에서 값을 찾을 때마다 빈 칸을 채운다(사람이 적은 칸은 덮지 않고 '다름' 으로)
  useEffect(() => {
    const res = applyNewClientGuess(form, docsRead.guess, docFilledRef.current, touchedRef.current)
    setForm(res.form)
    setDocFilled(res.filled)
    setDocDiffers(res.differs)
    // 찾은 값이 바뀔 때만 — 사람이 칸을 고칠 때마다 다시 채우지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docsRead.guess])
  /** 칸 밑 한 줄 — 서류에서 채움 · 한 번 봐 주세요 · 서류 값과 다름 */
  const docLine = (field: NewClientField) => {
    const f = docFilled[field]
    // D-255: 번호를 확실히 못 읽었으면 칸은 비우고 후보만 — 원본과 비교해 하나를 누른다(숫자 하나 틀리면 치명적)
    const g = f && f.value === '' ? f : docDiffers[field]?.value === '' ? docDiffers[field] : undefined
    if (g && (g.choices?.length || g.note)) {
      const pick = (v: string) => {
        touchedRef.current.delete(field)
        setForm((cur) => ({ ...cur, [field]: v }))
        setDocFilled((cur) => ({ ...cur, [field]: { ...g, value: v, note: '', choices: undefined } }))
        setDocDiffers((cur) => {
          const next = { ...cur }
          delete next[field]
          return next
        })
      }
      return (
        <span data-testid={`new-client-choices-${field}`} className="t-meta mt-1 flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-2.5 py-2 font-normal break-keep text-warning-900">
          <span className="font-semibold">⚠ {g.note}</span>
          {g.choices?.length ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span>{g.docLabel} 원본과 비교해 맞는 번호를 누르세요:</span>
              {g.choices.map((c) => (
                <button key={c} type="button" onClick={() => pick(c)} className="tap t-sub rounded-(--radius-control) border border-warning-400 bg-white px-2.5 font-bold tracking-wide text-slate-900 tabular-nums hover:bg-warning-100" data-testid="new-client-choice">
                  {c}
                </button>
              ))}
            </span>
          ) : null}
        </span>
      )
    }
    if (f && form[field] === f.value) {
      return (
        <span data-testid={`new-client-from-doc-${field}`} className={`t-meta mt-1 block break-keep font-normal ${f.note ? 'text-warning-800' : 'text-success-700'}`}>
          {f.note ? `⚠ ${f.note}` : `✓ ${f.docLabel}에서 채움`}
        </span>
      )
    }
    const d = docDiffers[field]
    if (d) {
      return (
        <span data-testid={`new-client-differs-${field}`} className="t-meta mt-1 flex flex-wrap items-center gap-x-2 font-normal break-keep text-slate-600">
          <span>{d.docLabel}에는 ‘{d.value}’</span>
          <button
            type="button"
            className="tap font-semibold text-brand-700 underline"
            onClick={() => {
              touchedRef.current.delete(field)
              setForm((cur) => ({ ...cur, [field]: d.value }))
              setDocFilled((cur) => ({ ...cur, [field]: d }))
              setDocDiffers((cur) => {
                const next = { ...cur }
                delete next[field]
                return next
              })
            }}
          >
            서류 값으로
          </button>
        </span>
      )
    }
    return null
  }
  /** D-122: 새로 넣는 업체는 기본 잠재고객 — 예전에는 계약 고객으로 들어가 계약 숫자가 부풀고 영업 보드 '계약 완료' 칸에 떴다 */
  const [asProspect, setAsProspect] = useState(true)
  /** D-181: 새로 넣는 고객의 종류 — 보고 있던 쪽(대표만 고른다) */
  const [newType, setNewType] = useState<ClientType>(initialClientType)
  // D-124: 찾던 말은 주소(?q=)에 — 업체를 열었다가 뒤로 와도 그대로
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  useQueryInUrl(query, searchParams, setSearchParams)
  const [showArchived, setShowArchived] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [leftover, setLeftover] = useState<ClientOpsRecord[]>([])
  const [migrating, setMigrating] = useState(false)
  /** 백업 파일을 읽은 뒤 합칠지/바꿀지 묻는 단계 */
  const [restorePrompt, setRestorePrompt] = useState<{ clients: ClientOpsRecord[]; toolInputs: Record<string, string>; workspace: WorkspaceSummary | null; sourceWs: string | null } | null>(null)
  /** D-530 '전부 바꾸기' 로 지워질 업체를 보여 준 뒤 한 번 더 묻는 단계 */
  const [replaceConfirm, setReplaceConfirm] = useState<RestorePlan | null>(null)
  /** D-530 막았거나 건너뛴 까닭(창 안에 빨간 한 줄) */
  const [restoreNote, setRestoreNote] = useState('')
  /** D-521 작업공간 전체 내보내기 — 업무 일기 · 모듈 기록을 서버에서 모으는 중 */
  const [exporting, setExporting] = useState(false)
  const { showToast } = useToast()
  const restoreRef = useRef<HTMLInputElement>(null)

  const today = todayLocalDate()
  // D-143: 업체마다 맞는 지원사업 수 — 기업마당 공고는 한 번 받아 모든 화면이 같이 쓴다
  const grantSums = useClientGrantSummaries(workspaceId, records, today)
  // D-190: 카드 추천 띠 · '추천 많은 순' — 맞춤 추천과 같은 판정(지원사업은 위에서 센 맞는 공고 수)
  const grantFit = useCallback((id: string) => grantSums.get(id)?.fit ?? 0, [grantSums])
  const reco = useClientReco(records, today, grantFit)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      // D-122: 업체를 먼저 읽고, 직접 만든 업무 항목을 목록에 올린 '바로 그 자리에서' 새 칸까지 채워 넣는다.
      // 예전 순서(목록 먼저 → 업체 읽기)는 그 사이에 화면이 다시 그려지면 새 칸이 없는 예전 기록을 읽다 멈출 수 있었다.
      const all = await listClients(workspaceId)
      await loadCustomServicesIntoCatalog(workspaceId)
      setRecords(all.map((r) => normalizeClientOps(r)))
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
    // D-162: Pilot 은 이 브라우저의 예전 로컬 자료를 옮겨 받지 않는다(처음부터 0)
    if (pilot) return
    try {
      setLeftover(pendingLocalClients(records))
    } catch {
      setLeftover([])
    }
  }, [records, pilot])

  /*
   * 보기 조건도 기억한다(D-79). '못 받은 돈 있음' 으로 두고 수금 전화를 도는 날은
   * 하루 종일 그 보기로 일한다 — 새로고침마다 되돌아가면 결국 안 쓴다.
   */
  // D-126: 오늘 화면 숫자 칸에서 ?filter= 로 들어오면 그 보기로 연다(기억해 둔 보기보다 우선)
  const urlFilter = searchParams.get('filter')
  const [filterKey, setFilterKey] = useState<ClientFilterKey>(() => {
    if (isClientFilterKey(urlFilter)) return urlFilter
    try {
      const v = localStorage.getItem(FILTER_KEY)
      return isClientFilterKey(v) ? v : 'all'
    } catch {
      return 'all'
    }
  })
  /** 휴대폰에서 보기 · 정렬은 '거르기' 를 눌러야 펼쳐진다 — 첫 업체 카드가 조건 줄 넉 줄 아래에 있었다 */
  const [filtersOpen, setFiltersOpen] = useState(() => {
    if (isClientFilterKey(urlFilter)) return true
    // 기억해 둔 보기 · 정렬이 기본이 아니면 펼쳐 둔다 — 왜 목록이 짧은지 보여야 한다
    try {
      const f = localStorage.getItem(FILTER_KEY)
      const so = localStorage.getItem(SORT_KEY)
      return (isClientFilterKey(f) && f !== 'all') || (so !== null && so !== 'active')
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, filterKey)
    } catch {
      /* 저장 못 해도 화면은 돈다 */
    }
  }, [filterKey])

  /*
   * D-181: 고객 종류 — 중소기업 고객 · 컨설턴트 고객을 따로 본다(대표만).
   * 이 화면의 숫자 · 목록 · 경고는 고른 쪽만 센다. 팀장(Pilot) 화면은 구분 없이 전부(고르는 칸도 없다).
   */
  const [ctype, setCtype] = useState<ClientType>(initialClientType)
  useEffect(() => {
    rememberClientTypeView(ctype)
  }, [ctype])
  const switchType = (t: ClientType) => {
    setCtype(t)
    // 주소에 ?type= 이 남아 있으면 지운다 — 새로 열 때 방금 고른 쪽이 그대로 보이게
    if (searchParams.has('type')) {
      const next = new URLSearchParams(searchParams)
      next.delete('type')
      setSearchParams(next, { replace: true })
    }
  }
  const typed = useMemo(() => (pilot ? records : records.filter((r) => clientTypeOf(r) === ctype)), [records, pilot, ctype])
  const typeCount = useMemo(() => {
    const n: Record<ClientType, number> = { sme: 0, consultant: 0 }
    for (const r of records) if (r.archivedAt === null) n[clientTypeOf(r)] += 1
    return n
  }, [records])
  const openForm = () => {
    setNewType(pilot ? 'sme' : ctype)
    setFormOpen(true)
  }

  /*
   * D-114: 계약 고객 · 잠재고객 · 전체. 메뉴 옆 숫자는 계약 고객만 세고, 잠재고객은 여기 들어와서 본다.
   * 보관함을 볼 때는 구분 없이 보관한 업체 전부.
   */
  const [segment, setSegment] = useState<ClientSegment>(() => {
    // ?filter= 로 들어오면 구분 없이 전체에서 거른다(잠재고객 보기로 기억돼 있으면 계약 고객 결과가 안 보인다)
    if (isClientFilterKey(urlFilter)) return 'all'
    try {
      const v = localStorage.getItem(SEGMENT_KEY)
      return v === 'contract' || v === 'prospect' ? v : 'all'
    } catch {
      return 'all'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(SEGMENT_KEY, segment)
    } catch {
      /* 저장 못 해도 화면은 돈다 */
    }
  }, [segment])
  const assistBuild = useCallback(() => clientsBundle(typed, today, reco, segment), [typed, today, reco, segment])
  // U3(D-543) 꾸미기 'AI 도우미'(clients:assist) 를 숨겼으면 머리 단추도 숨긴다
  const hubLayout = usePageLayout('clients')
  const assistShown = visibilityOf(hubLayout, 'assist') === 'show'
  const contractCount = typed.filter(isContractClient).length
  const prospectCount = typed.filter(isProspect).length
  const moneyWords = useMoneyWords()

  const visible = useMemo(() => {
    return typed.filter((r) => {
      if (!showArchived && r.archivedAt !== null) return false
      if (showArchived && r.archivedAt === null) return false
      if (!showArchived && segment === 'contract' && !isContractClient(r)) return false
      if (!showArchived && segment === 'prospect' && !isProspect(r)) return false
      if (!matchesClientFilter(r, filterKey, today)) return false
      // 회사명뿐 아니라 담당자·번호·직접 만든 칸·영업자 이름까지 (D-76)
      return matchesClientSearch(r, query)
    })
  }, [typed, query, showArchived, filterKey, today, segment])
  const archivedCount = typed.filter((r) => r.archivedAt !== null).length

  /*
   * 정렬 기준은 기억한다 — 매번 다시 고르게 하면 결국 기본값만 쓰게 된다.
   * 전화를 받으면 가나다순, 정책자금을 보면 업력순으로 두고 그대로 일한다.
   */
  const [sortKey, setSortKey] = useState<ClientSortKey>(() => {
    // D-238: 오늘 화면 '먼저 제안할 업체 n곳' 처럼 주소로 정렬을 정해 오면 그것 먼저(고르면 다시 기억)
    const fromUrl = searchParams.get('sort')
    if (isClientSortKey(fromUrl)) return fromUrl
    try {
      const v = localStorage.getItem(SORT_KEY)
      return isClientSortKey(v) ? v : 'active'
    } catch {
      return 'active'
    }
  })
  // D-238: 주소로 정해 온 정렬은 기억해 둔 정렬을 덮지 않는다 — 사람이 직접 고르면 그때부터 기억
  const sortFromUrl = useRef(isClientSortKey(searchParams.get('sort')))
  useEffect(() => {
    if (sortFromUrl.current) {
      sortFromUrl.current = false
      return
    }
    try {
      localStorage.setItem(SORT_KEY, sortKey)
    } catch {
      /* 저장을 막아 둔 브라우저도 화면은 돌아가야 한다 */
    }
  }, [sortKey])
  const recoScores = sortKey === 'reco' ? reco.scores : undefined
  const ordered = useMemo(() => sortClients(visible, sortKey, today, recoScores), [visible, sortKey, today, recoScores])
  // D-479 업체가 많으면 카드는 처음 40장 · 아래로 내리면 이어서(보기 · 정렬 · 찾기가 바뀌면 처음부터)
  const [shownCount, moreRef] = useGrowingCount(ordered.length, `${sortKey}|${filterKey}|${segment}|${query}`)
  const alerts = useMemo(() => buildAllAlerts(typed, today), [typed, today])
  const summary = useMemo(() => summarizeAlerts(alerts), [alerts])
  const visibleAlerts = useMemo(
    () => (tab === 'all' ? alerts : alerts.filter((a) => a.severity === tab)),
    [alerts, tab],
  )
  const shownAlerts = showAllAlerts ? visibleAlerts : visibleAlerts.slice(0, 8)

  const money = useMemo(() => {
    let unpaid = 0
    let unpaidGross = 0
    let overdueCount = 0
    // D-150: 보관한 업체는 빼고 센다(오늘 · 보드 · KPI 와 같은 기준)
    for (const r of typed) {
      if (r.archivedAt) continue
      const p = clientOpsProgress(r, today)
      unpaid += p.unpaidNet
      unpaidGross += p.unpaidAmount
      overdueCount += p.overduePayments
    }
    return { unpaid, unpaidGross, overdueCount }
  }, [typed, today])

  // 계약 완료(끝남)만 뺀다 — 계약 전도 챙겨야 할 업체다
  const activeCount = typed.filter((r) => !r.archivedAt && contractStageOf(r.status) !== 'closed').length

  const openAlert = (a: OpsAlert) =>
    navigate(a.serviceKey ? `/ops/clients/${a.clientId}?tab=work&svc=${a.serviceKey}` : `/ops/clients/${a.clientId}`)

  /**
   * 목록 시트에서 고친 값을 저장한다.
   * 먼저 화면을 바꾸고(기다림 없음) 저장에 실패하면 서버 값으로 되돌린다.
   */
  // D-120: 금액처럼 글자마다 저장하는 칸 — 늦게 온 예전 응답이 새 값을 덮지 않게 차례로 저장한다
  const serialSave = useSerialSave<ClientOpsRecord>(
    saveClient,
    (saved) => setRecords((prev) => prev.map((r) => (r.id === saved.id ? saved : r))),
    (cause) => {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
      void load()
    },
  )
  const quickSave = useCallback(
    async (next: ClientOpsRecord): Promise<boolean> => {
      setRecords((prev) => prev.map((r) => (r.id === next.id ? next : r)))
      return serialSave(next)
    },
    [serialSave],
  )

  const onRestoreFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      const text = await file.text()
      const clients = parseBackup(text)
      // 더보기 판은 닫는다 — 불러오기 창 뒤에 판이 하나 더 겹쳐 보이지 않게
      setMoreOpen(false)
      setReplaceConfirm(null)
      setRestoreNote('')
      setRestorePrompt({ clients, toolInputs: parseBackupToolInputs(text), workspace: workspaceSectionOf(text), sourceWs: backupSourceWorkspace(text, clients) })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '백업을 불러오지 못했습니다.')
    } finally {
      if (restoreRef.current) restoreRef.current.value = ''
    }
  }

  /**
   * D-521 [백업 내려받기] = 작업공간 전체 — 업체 · 도구 입력값(예전 그대로) + 업무 일기 · 모듈 기록(서버에서 전부) · 서류 파일 목록.
   * 일부를 못 읽으면 나머지로 받고 못 담은 것을 알린다. 모으기 자체가 실패하면 예전 백업(업체 · 도구 입력값)이라도 받는다.
   */
  const onExport = async () => {
    setExporting(true)
    setError('')
    try {
      const { line } = await exportWorkspace(workspaceId, getDataModeConfig().mode === 'supabase', today, records)
      showToast(line)
      setMoreOpen(false)
    } catch {
      downloadBackup(records, today)
      showToast('업무 일기 · 모듈 기록을 모으지 못해 업체 · 입력값만 내려받았어요.')
      setMoreOpen(false)
    } finally {
      setExporting(false)
    }
  }

  const cloudMode = getDataModeConfig().mode === 'supabase'
  const restoreSource = checkRestoreSource({ cloud: cloudMode, targetWs: workspaceId, sourceWs: restorePrompt?.sourceWs ?? null, myWorkspaceIds: myWorkspaces.map((w) => w.id) })
  const restoreAllowed = allowedModes(restoreSource)
  const restoreSourceName = myWorkspaces.find((w) => w.id === restorePrompt?.sourceWs)?.name
  const closeRestore = () => {
    setRestorePrompt(null)
    setReplaceConfirm(null)
    setRestoreNote('')
  }

  /**
   * D-530 불러오기 — 파일이 나온 작업공간 확인 → 다른 작업공간에 이미 있는 업체는 넣지 않음(옮기지 않음)
   * → '전부 바꾸기' 는 지워질 업체를 보여 주고 한 번 더 → 그다음에야 저장. 막히면 아무것도 바꾸지 않는다.
   */
  const applyRestore = async (mode: MergeMode, confirmed = false) => {
    const incoming = restorePrompt?.clients
    if (!incoming) return
    setRestoring(true)
    setError('')
    setRestoreNote('')
    try {
      // D-120: 화면을 연 뒤 다른 곳에서 만든 업체가 지워지지 않게 — 합치기 직전에 가장 새 목록을 다시 읽는다
      const fresh = await listClients(workspaceId)
      const foreignIds = await findForeignClientIds(workspaceId, incoming.map((c) => c.id))
      const plan = planRestore({ current: fresh, incoming, mode, source: restoreSource, foreignIds })
      if (plan.blocked) {
        setRestoreNote(plan.blocked)
        return
      }
      if (mode === 'replace' && plan.removed.length > 0 && !confirmed) {
        setReplaceConfirm(plan)
        return
      }
      const result = plan.result
      await replaceAllClients(workspaceId, result.records)
      // 도구함 입력값도 되돌린다 (D-89) — 창업감면 폼·크레탑 붙여넣기 같은 것
      const toolCount = writeToolInputs(restorePrompt?.toolInputs)
      await load()
      const hadModuleKeys = Object.keys(restorePrompt?.toolInputs ?? {}).some((k) => k.startsWith(MODULE_DATA_PREFIX))
      closeRestore()
      const toolNote = toolCount > 0 ? ` · 도구·모듈 기록 ${toolCount}개` : ''
      const skipNote = plan.skipped.length > 0 ? ` · 다른 작업공간에 있는 업체 ${plan.skipped.length}곳은 넣지 않았어요` : ''
      showToast(
        mode === 'merge'
          ? `복원했습니다. 추가 ${result.added}곳 · 갱신 ${result.updated}곳 · 유지 ${result.kept}곳${toolNote}${skipNote}`
          : `백업 내용으로 바꿨습니다. 고객 ${result.records.length}곳 · 지운 업체 ${plan.removed.length}곳${toolNote}${skipNote}`,
      )
      // D-94: 모듈 기록까지 되돌렸으면 한 번 새로 연다 — 열려 있던 모듈이 옛 기록을 들고 있다가 덮어쓰지 않게
      if (hadModuleKeys) {
        window.setTimeout(() => window.location.reload(), 1500)
      }
    } catch (cause) {
      setRestoreNote(restoreErrorLine(cause))
    } finally {
      setRestoring(false)
    }
  }

  const migrateLocal = async () => {
    if (leftover.length === 0) return
    setMigrating(true)
    setError('')
    try {
      const fresh = await listClients(workspaceId)
      // D-530 다른 작업공간에 이미 올린 업체(같은 id)는 이쪽으로 옮기지 않는다
      const foreignIds = await findForeignClientIds(workspaceId, leftover.map((c) => c.id))
      const plan = planRestore({ current: fresh, incoming: leftover, mode: 'merge', source: 'unknown', foreignIds })
      const result = plan.result
      await replaceAllClients(workspaceId, result.records)
      await load()
      setLeftover([])
      const skipNote = plan.skipped.length > 0 ? ` 다른 작업공간에 이미 있는 ${plan.skipped.length}곳은 옮기지 않았어요.` : ''
      showToast(`이 브라우저에 있던 고객 ${leftover.length}곳을 클라우드로 옮겼습니다. 추가 ${result.added}곳 · 갱신 ${result.updated}곳. 브라우저 원본은 그대로 남아 있습니다.${skipNote}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '옮기지 못했습니다.')
    } finally {
      setMigrating(false)
    }
  }

  /** D-122: 같은 업체(사업자번호 · 이름)가 이미 있으면 알려 준다 — 크레탑 등록과 같은 규칙 */
  const dupe = form.companyName.trim() === '' && form.businessNumber.trim() === '' ? null : findClientForCretop(records, { name: form.companyName, bizNo: form.businessNumber })

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.companyName.trim()) return
    try {
      setSaving(true)
      // D-125: 업체는 만들어졌는데 영업 칸 저장이 실패하면, 다시 눌러도 새로 만들지 않고 그 업체로 다시 한다(중복 업체 방지)
      const asConsultant = !pilot && newType === 'consultant'
      const created =
        createdRef.current ??
        (await createClient(workspaceId, { ...form, ...(asProspect ? { status: 'waiting' as const } : {}), ...(asConsultant ? { clientType: 'consultant' as const } : {}) }))
      createdRef.current = created
      const record = asProspect ? await saveClient(withNewProspect(created, '')) : created
      createdRef.current = null
      // D-181: 업체 화면에서 뒤로 오면 방금 넣은 고객이 있는 쪽이 보이게
      if (!pilot) rememberClientTypeView(newType)
      // D-187: 등록 창에 넣은 서류 — 업체를 열자마자 서류함에 올리고 회사 정보 · 크레탑 · 명부까지 분석한다
      handDocsTo(record.id, docsRead.docs)
      clearNewClientDocs()
      navigate(`/ops/clients/${record.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '고객을 등록하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/*
        U3(D-543) 머리 한 줄 — 날짜만(계약 · 잠재 숫자는 바로 아래 고르개 줄에 있다 · 같은 숫자 두 번 0) · 휴대폰은 위쪽 띠가 날짜를 말하니 단추만 한 줄.
        AI 도우미는 예전 띠 대신 머리 단추 하나(질문 단추는 누르면 열리는 판 안에 그대로) — 꾸미기에서 'AI 도우미' 를 숨기면 단추도 숨는다.
      */}
      <ScreenTitle
        title="고객 관리"
        sub={today}
        subOnPhone={false}
        actions={
          <>
            {assistShown && typed.length > 0 && (
              <AiAssist
                variant="button"
                page="clients"
                scope={`clients:${segment}`}
                title={segment === 'prospect' ? '고객 관리 · 잠재고객' : segment === 'contract' ? '고객 관리 · 계약 고객' : '고객 관리'}
                presets={segment === 'prospect' ? ['clients.convert', 'clients.quiet', 'clients.reco'] : segment === 'contract' ? ['clients.care', 'clients.reco', 'clients.quiet'] : ['clients.quiet', 'clients.convert', 'clients.reco', 'clients.care']}
                build={assistBuild}
              />
            )}
            <Button variant="primary" onClick={openForm} data-testid="clients-add" data-guide="fn-clients-add">
              <CirclePlus aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">{!pilot && ctype === 'consultant' ? '새 컨설턴트 고객 등록' : '새 업체 등록'}</span>
              <span className="sm:hidden">등록</span>
            </Button>
            {/* D-122: 점 세 개만 두지 않는다 — 백업 · 일정 · 정산이 여기 숨어 있었다 */}
            <Button variant="ghost" onClick={() => setMoreOpen(true)} data-guide="fn-clients-tools">
              <MoreHorizontal aria-hidden="true" className="size-5" />
              더보기
            </Button>
          </>
        }
      />
      {moreOpen && (
        <BottomSheet title="고객 관리 도구" onClose={() => setMoreOpen(false)}>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" className="w-full justify-start" onClick={() => { setMoreOpen(false); navigate('/ops/calendar') }}>
              <CalendarDays aria-hidden="true" className="size-4" />
              일정 보기
            </Button>
            {!pilot && (
              <Button variant="secondary" className="w-full justify-start" onClick={() => { setMoreOpen(false); navigate('/ops/agents') }}>
                <Handshake aria-hidden="true" className="size-4" />
                영업자 정산
              </Button>
            )}
            <Button
              variant="secondary"
              className="w-full justify-start"
              disabled={records.length === 0 || exporting}
              onClick={() => void onExport()}
              data-testid="clients-export"
            >
              <Download aria-hidden="true" className="size-4 shrink-0" />
              <span className="flex min-w-0 flex-col items-start text-left">
                <span>{exporting ? '모으는 중…' : '백업 내려받기'}</span>
                <span className="text-xs font-normal break-keep text-slate-500">업체 · 서류 파일 목록 · 업무 일기 · 모듈 기록까지 한 파일</span>
              </span>
            </Button>
            <Button variant="secondary" className="w-full justify-start" onClick={() => restoreRef.current?.click()} disabled={restoring}>
              <Upload aria-hidden="true" className="size-4" />
              {restoring ? '복원 중…' : '백업 불러오기'}
            </Button>
            {/* D-536 백업이 보장하는 것(접어 둠) — '백업' 이라는 말만 보고 모두 되살아난다고 오해하지 않게 */}
            <BackupScopeNote />
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
          className="rounded-(--radius-control) border border-slate-200 bg-white px-4 py-3 text-[0.9375rem] text-danger-700"
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
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <CloudUpload aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-600" />
            <p className="min-w-0 flex-1 text-[1rem] break-keep text-slate-800">
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
        onClose={() => { if (!restoring) closeRestore() }}
        footer={
          replaceConfirm ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setReplaceConfirm(null)} disabled={restoring}>돌아가기</Button>
              <Button variant="danger" data-testid="restore-replace-confirm" onClick={() => void applyRestore('replace', true)} disabled={restoring}>
                {restoring ? '바꾸는 중…' : `정말 바꾸기(${replaceConfirm.removed.length}곳 지움)`}
              </Button>
            </div>
          ) : (
            // 단추 셋이 창 폭을 넘으면 다음 줄로(예전에는 [취소] 가 창 밖으로 삐져나왔다)
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={closeRestore} disabled={restoring}>취소</Button>
              <Button variant="secondary" data-testid="restore-replace" onClick={() => void applyRestore('replace')} disabled={restoring || !restoreAllowed.replace}>백업 내용으로 전부 바꾸기</Button>
              <Button variant="primary" data-testid="restore-merge" onClick={() => void applyRestore('merge')} disabled={restoring || !restoreAllowed.merge}>{restoring ? '복원 중…' : '지금 데이터와 합치기'}</Button>
            </div>
          )
        }
      >
        <p className="text-[1rem] break-keep text-slate-700">
          백업에 고객 {restorePrompt?.clients.length ?? 0}곳
          {Object.keys(restorePrompt?.toolInputs ?? {}).length > 0 && ` · 도구·모듈 기록 ${Object.keys(restorePrompt?.toolInputs ?? {}).length}개`} 가 들어 있습니다.
        </p>
        {restoreSourceLine(restoreSource, restoreSourceName) && (
          <p data-testid="restore-source" data-source={restoreSource} className="mt-2 rounded-(--radius-control) border border-red-200 bg-white px-3 py-2 text-[0.9375rem] font-semibold break-keep text-red-700">
            {restoreSourceLine(restoreSource, restoreSourceName)}
          </p>
        )}
        {restoreNote && (
          <p data-testid="restore-note" role="alert" className="mt-2 text-[0.9375rem] font-semibold break-keep text-red-700">{restoreNote}</p>
        )}
        {replaceConfirm ? (
          <div data-testid="restore-removed" className="mt-3 rounded-(--radius-control) border border-red-200 bg-white px-3 py-2 text-[0.9375rem] break-keep text-slate-700">
            <p className="font-semibold text-red-700">지금 목록에서 {replaceConfirm.removed.length}곳이 지워져요 — 되돌릴 수 없어요.</p>
            <p className="mt-1">{removedNamesLine(replaceConfirm.removed)}</p>
            {replaceConfirm.skipped.length > 0 && <p className="mt-1 text-slate-600">다른 작업공간에 있는 업체 {replaceConfirm.skipped.length}곳은 넣지 않아요.</p>}
            <p className="mt-1 text-slate-600">지우기 전에 [백업 내려받기] 로 지금 목록을 한 번 받아 두면 안전해요.</p>
          </div>
        ) : (
          <>
            {restorePrompt?.workspace && (restorePrompt.workspace.journal > 0 || restorePrompt.workspace.moduleRows > 0) && (
              <p data-testid="restore-ws-note" className="mt-2 text-[0.9375rem] break-keep text-slate-600">
                이 파일의 업무 일기 {restorePrompt.workspace.journal}건{restorePrompt.workspace.moduleRows > 0 ? ` · 서버 모듈 기록 ${restorePrompt.workspace.moduleRows}줄` : ''}은 보관용이에요 — 불러오기는 업체 · 도구 입력값만 되살리고, 지금 있는 업무 일기 · 모듈 기록은 건드리지 않아요.
              </p>
            )}
            <BackupScopeNote open />
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[0.9375rem] break-keep text-slate-600">
              <li><strong>합치기</strong> — 같은 업체는 최근에 수정한 쪽을 남기고, 없던 업체는 추가합니다.</li>
              <li><strong>전부 바꾸기</strong> — 지금 목록에서 백업에 없는 업체를 지우고 백업 내용으로 채웁니다. 지워질 업체를 먼저 보여 드려요.</li>
              <li>다른 작업공간에 이미 있는 업체는 넣지 않아요(그 작업공간에서 옮겨 오지 않아요).</li>
            </ul>
          </>
        )}
      </Modal>

      {/* D-287 화면 꾸미기 — AI 도우미 · 업체 목록(고르개 · 찾기 · 요약 · 현황표) · 지금 챙길 것 */}
      <ArrangeArea page="clients" title="고객 관리" className="flex flex-col gap-6">
        {/* D-239 고객 관리 AI 도우미 — U3(D-543) 띠 대신 머리 [AI 도우미] 단추. 칸 자리는 비워 두고 꾸미기 줄(clients:assist)은 남긴다(숨기면 단추도 숨음) */}
        <ArrangeItem id="assist" label="AI 도우미" hint="머리 오른쪽 [AI 도우미] 단추 — 숨기면 단추도 숨어요">
          {null}
        </ArrangeItem>
        <ArrangeItem id="list" label="업체 목록" hint="고객 종류 · 계약/잠재 · 찾기 · 요약 숫자 · 업체별 현황표">
          <div className="flex flex-col gap-6">
            {/*
              U3(D-543) 고르개 한 줄 — 예전엔 '고객 종류' 탭 줄 · '계약 고객 · 잠재고객 · 전체' 줄 · 찾기 줄이 따로였다.
              PC: [중소기업 · 컨설턴트] [계약 · 잠재 · 전체] 한 줄 → 찾기 · 보기 · 정렬 한 줄.
              휴대폰: [계약 · 잠재 · 전체] → 찾기 → [거르기 · 보관함 … 중소기업 · 컨설턴트]. 고르는 것 · 숫자 · 누르면 하는 일은 그대로.
            */}
            {(typed.length > 0 || (!pilot && (records.length > 0 || ctype === 'consultant'))) && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-3" data-testid="client-pickers">
                {/* D-114: 계약 고객 · 잠재고객 · 전체 */}
                {typed.length > 0 && !showArchived && (
                  <div role="group" aria-label="고객 구분" data-testid="client-segment" className="order-1 grid w-full grid-cols-3 gap-1 rounded-(--radius-control) border border-slate-200 bg-white p-1 sm:order-2 sm:inline-flex sm:w-auto">
                    {SEGMENTS.map((sg) => {
                      const n = sg.key === 'contract' ? contractCount : sg.key === 'prospect' ? prospectCount : contractCount + prospectCount
                      const on = segment === sg.key
                      return (
                        <button
                          key={sg.key}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setSegment(sg.key)}
                          className={`tap flex items-center justify-center gap-1.5 rounded-[8px] px-2 py-2 font-semibold break-keep sm:px-4 ${on ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          <span className="text-[0.875rem]">{sg.label}</span>
                          <span className={`t-meta tabular-nums ${on ? 'text-white/85' : 'text-slate-400'}`}>{n}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {/* PC 는 위 두 고르개 다음에 줄을 바꾼다 */}
                <span aria-hidden="true" className="hidden h-0 basis-full sm:order-3 sm:block" />
                {typed.length > 0 && (
                  <>
                {/* 휴대폰에서는 검색칸이 한 줄을 다 쓴다 — 보관함 단추와 나눠 쓰면
                    안내 문구가 '…번호로' 에서 잘렸다 */}
                <div className="relative order-2 w-full min-w-0 sm:order-4 sm:w-auto sm:flex-1 sm:max-w-md">
                  <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="업체명·담당자·번호·직접 만든 칸으로 찾기"
                    aria-label="업체 검색"
                    className="w-full rounded-(--radius-control) border border-slate-300 py-2.5 pr-3 pl-9 text-[1rem] focus:border-brand-500 focus:outline-none sm:py-2"
                  />
                </div>
                {/* 보관한 업체가 하나도 없으면 단추도 두지 않는다 — 빈 서랍을 여는 단추는 자리만 먹는다 */}
                {(archivedCount > 0 || showArchived) && (
                  <button
                    type="button"
                    aria-pressed={showArchived}
                    onClick={() => setShowArchived((v) => !v)}
                    className={`tap order-3 inline-flex items-center gap-1.5 rounded-(--radius-control) border px-3 py-2 text-[0.9375rem] font-medium sm:order-5 ${
                      showArchived
                        ? 'border-brand-300 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Archive aria-hidden="true" className="size-4" />
                    보관함 {archivedCount}
                  </button>
                )}
                {/* D-126: 휴대폰에서는 '거르기' 단추 하나 — 누르면 보기 · 정렬이 펼쳐진다 */}
                <button
                  type="button"
                  aria-expanded={filtersOpen}
                  data-testid="client-filters-toggle"
                  onClick={() => setFiltersOpen((v) => !v)}
                  className={`tap order-3 inline-flex items-center gap-1.5 rounded-(--radius-control) border px-3 py-2 text-[0.9375rem] font-medium sm:hidden ${
                    filterKey !== 'all' || sortKey !== 'active' ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <SlidersHorizontal aria-hidden="true" className="size-4" />
                  거르기{filterKey !== 'all' ? ` · ${CLIENT_FILTER_LABEL[filterKey]}` : ''}
                </button>
                  </>
                )}
                {/* D-181: 고객 종류 — 중소기업 고객 · 컨설턴트 고객(대표만 · 팀장 화면에는 없다) · 휴대폰은 거르기 줄 오른쪽 끝에 작게 */}
                {!pilot && (records.length > 0 || ctype === 'consultant') && (
                  <div role="tablist" aria-label="고객 종류" data-testid="client-type-tabs" className="order-3 ml-auto inline-flex gap-1 rounded-(--radius-control) border border-slate-200 bg-white p-1 sm:order-1 sm:ml-0">
                    {CLIENT_TYPES.map((t) => {
                      const on = ctype === t
                      const Icon = t === 'sme' ? Building2 : BriefcaseBusiness
                      return (
                        <button
                          key={t}
                          type="button"
                          role="tab"
                          aria-selected={on}
                          aria-label={`${CLIENT_TYPE_LABEL[t]} ${typeCount[t]}`}
                          title={CLIENT_TYPE_LABEL[t]}
                          data-testid={`client-type-${t}`}
                          onClick={() => switchType(t)}
                          className={`tap inline-flex shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 py-2 text-[0.875rem] font-semibold whitespace-nowrap sm:px-3 ${
                            on ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Icon aria-hidden="true" className="size-4" />
                          <span className="max-sm:sr-only">{CLIENT_TYPE_LABEL[t]}</span>
                          <span className={`t-meta tabular-nums ${on ? 'text-white/85' : 'text-slate-400'}`}>{typeCount[t]}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {typed.length > 0 && (
                  <>
                <div className={`${filtersOpen ? 'flex' : 'hidden'} order-4 w-full flex-wrap items-center gap-2 sm:order-6 sm:flex sm:w-auto`}>
                {/* 보기 — 무엇을 보일지. 정렬은 그 다음에 순서를 정한다 (D-79) */}
                <label className="flex shrink-0 items-center gap-1.5">
                  <span className="t-sub text-slate-500">보기</span>
                  <select
                    value={filterKey}
                    aria-label="업체 보기 조건"
                    onChange={(e) => setFilterKey(isClientFilterKey(e.target.value) ? e.target.value : 'all')}
                    className={`rounded-(--radius-control) border bg-white px-2 py-2 text-[0.9375rem] font-medium focus:border-brand-500 focus:outline-none sm:py-1.5 ${
                      filterKey === 'all' ? 'border-slate-300 text-slate-700' : 'border-brand-300 text-brand-700'
                    }`}
                  >
                    {CLIENT_FILTER_ORDER.map((k) => (
                      <option key={k} value={k}>
                        {k === 'unpaid' ? moneyWords.unpaidFilter : CLIENT_FILTER_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex shrink-0 items-center gap-1.5">
                  <span className="t-sub text-slate-500">정렬</span>
                  <select
                    value={sortKey}
                    aria-label="업체 정렬 기준"
                    onChange={(e) => setSortKey(isClientSortKey(e.target.value) ? e.target.value : 'active')}
                    className="rounded-(--radius-control) border border-slate-300 bg-white px-2 py-2 text-[0.9375rem] font-medium text-slate-700 focus:border-brand-500 focus:outline-none sm:py-1.5"
                  >
                    {CLIENT_SORT_ORDER.map((k) => (
                      <option key={k} value={k}>
                        {CLIENT_SORT_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="t-sub shrink-0 text-slate-500">{CLIENT_SORT_HINT[sortKey]}</span>
                </div>
                {(query !== '' || filterKey !== 'all') && (
                  <span className="order-5 text-[0.875rem] text-slate-500 sm:order-7">{visible.length}곳 찾음</span>
                )}
                  </>
                )}
              </div>
            )}

            {/*
              요약 — U3(D-543) 큰 칸 다섯 → 한 줄 칩(오늘 화면과 같은 모양). 0 일 때는 색을 쓰지 않는다.
              '잠재고객 n곳' 칸은 뺐다 — 바로 위 고르개 [잠재고객 n] 과 같은 숫자 · 같은 일(누르면 잠재고객만)이었다.
              못 받은 내 돈은 누르면 '받을 돈 남음' 으로 거른다(예전엔 누를 수 없었다).
            */}
            {typed.length > 0 && (
              <section aria-label="요약" data-testid="clients-summary" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <SummaryChip
                  testId="clients-kpi-critical"
                  icon={AlarmClock}
                  label="지금 처리할 일"
                  value={`${summary.critical}건`}
                  urgency={summary.critical > 0 ? 'danger' : 'neutral'}
                  hint="마감 지남 · 서류 없음"
                  onClick={() => { setTab('critical'); setAlertsOpen(true) }}
                />
                <SummaryChip
                  testId="clients-kpi-warning"
                  icon={Clock}
                  label="곧 처리할 일"
                  value={`${summary.warning}건`}
                  urgency={summary.warning > 0 ? 'warning' : 'neutral'}
                  hint={`${DUE_SOON_DAYS}일 이내 마감·만료`}
                  onClick={() => { setTab('warning'); setAlertsOpen(true) }}
                />
                <SummaryChip testId="clients-kpi-active" icon={Users} label="관리 중인 업체" value={`${activeCount}곳`} hint={`전체 ${typed.length}곳 · 계약 끝난 곳 · 보관한 곳 빼고`} />
                <SummaryChip
                  testId="clients-kpi-unpaid"
                  icon={Wallet}
                  label={moneyWords.unpaid}
                  value={krwTile(money.unpaid)}
                  urgency={money.overdueCount > 0 ? 'danger' : 'neutral'}
                  hint={
                    // 연체 건수와 청구 기준은 둘 다 사실이라 둘 다 적는다 — 하나만 고르면 다른 하나를 잃는다
                    [
                      money.overdueCount > 0 ? `예정일 지난 건 ${money.overdueCount}건` : '',
                      money.unpaidGross !== money.unpaid ? `청구 기준 ${krwTile(money.unpaidGross)}` : '',
                    ]
                      .filter((v) => v !== '')
                      .join(' · ') || '연체 없음'
                  }
                  onClick={money.unpaid > 0 ? () => setFilterKey('unpaid') : undefined}
                />
              </section>
            )}

            {/* B. 업체별 현황표 */}
            <section aria-labelledby="ops-matrix" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <HintTip tip={hintFor('업체별 현황표')} label="업체별 현황표">
                  <h2 id="ops-matrix" className="t-section text-slate-900">
                    업체별 현황표
                  </h2>
                </HintTip>
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

              {typed.length === 0 && !pilot && ctype === 'consultant' ? (
                // D-181: 컨설턴트 고객이 아직 없을 때 — 새로 넣거나, 이미 넣은 업체를 옮기는 길을 알려 준다
                <div data-testid="clients-empty-consultant" className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-12 text-center">
                  <BriefcaseBusiness aria-hidden="true" className="mx-auto size-9 text-brand-400" />
                  <p className="mt-3 text-[1.2rem] font-bold text-slate-900">아직 컨설턴트 고객이 없습니다</p>
                  <Button variant="primary" className="mt-4" onClick={openForm} data-testid="clients-empty-consultant-add">
                    <CirclePlus aria-hidden="true" className="size-4" />컨설턴트 고객 등록
                  </Button>
                  <p className="mx-auto mt-4 max-w-xl text-[1rem] break-keep text-slate-600">
                    이미 등록한 고객이 컨설턴트라면 그 고객 화면 › 더보기 › <strong>컨설턴트 고객으로 옮기기</strong> 를 누르세요. 중소기업 고객 목록에서 빠지고 여기로 옵니다.
                  </p>
                </div>
              ) : typed.length === 0 ? (
                // D-162: 빈 화면 자체가 다음 행동을 알려 준다 — 안내 창을 따로 띄우지 않는다
                <div data-testid="clients-empty" className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-12 text-center">
                  <Building2 aria-hidden="true" className="mx-auto size-9 text-brand-400" />
                  <p className="mt-3 text-[1.2rem] font-bold text-slate-900">등록된 업체가 없습니다</p>
                  <Button variant="primary" className="mt-4" onClick={openForm} data-testid="clients-empty-add">
                    <CirclePlus aria-hidden="true" className="size-4" />첫 업체 등록
                  </Button>
                  <p className="mx-auto mt-4 max-w-xl text-[1rem] break-keep text-slate-600">
                    업체를 등록하면 일정 · 서류 · 업무 · 수금을 한곳에서 관리할 수 있습니다.
                  </p>
                  <div className="mt-5">
                    <FirstClientSteps />
                  </div>
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
                {/* D-120: 고른 보기 · 검색에 맞는 업체가 없으면 빈 화면 대신 알려 주고 바로 풀 수 있게 */}
                {ordered.length === 0 && (
                  <div data-testid="clients-empty-filter" className="flex flex-col items-center gap-3 rounded-(--radius-panel) border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
                    <p className="text-[1.2rem] font-bold text-slate-800">조건에 맞는 업체가 없습니다</p>
                    <p className="t-body break-keep text-slate-600">
                      {query.trim() ? `'${query.trim()}' 로 찾은 업체가 없습니다. ` : ''}보기 · 검색 조건을 풀면 전체 {typed.length}곳이 보입니다.
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setQuery('')
                        setFilterKey('all')
                        setSegment('all')
                      }}
                    >
                      조건 모두 풀기
                    </Button>
                  </div>
                )}
                <ul className="ax-stagger flex flex-col gap-2.5 xl:grid xl:grid-cols-2">
                  {ordered.slice(0, shownCount).map((record, i) => {
                    const p = clientOpsProgress(record, today)
                    const critical = summary.criticalByClient[record.id] ?? 0
                    const warning = summary.warningByClient[record.id] ?? 0
                    const dLeft = record.nextActionDueDate ? daysLeftFrom(today, record.nextActionDueDate) : null
                    return (
                      <ClientBoardCard
                        key={record.id}
                        rank={i + 1}
                        record={record}
                        today={today}
                        dueSoonDays={DUE_SOON_DAYS}
                        tone={clientTone(dLeft, p.overduePayments, critical, warning)}
                        criticalCount={critical}
                        warningCount={warning}
                        onOpen={() => navigate(`/ops/clients/${record.id}`)}
                        onChip={(key) => setQuick({ id: record.id, kind: 'service', serviceKey: key })}
                        onMoney={() => setQuick({ id: record.id, kind: 'money' })}
                        onBulkDocs={() => setBulkDocsFor(record.id)}
                        onDocs={() => navigate(`/ops/clients/${record.id}?tab=docs`)}
                        hit={query.trim() !== '' ? searchHit(record, query) : null}
                        grants={grantSums.get(record.id) ?? null}
                        reco={reco.chips.get(record.id) ?? []}
                        onGrants={() => navigate(`/grants?view=clients&client=${record.id}`)}
                      />
                    )
                  })}
                </ul>
                {shownCount < ordered.length && (
                  <div ref={moreRef} className="t-sub py-3 text-center text-slate-500" data-testid="clients-more" aria-live="polite">
                    아래로 내리면 {ordered.length - shownCount}곳 더 보여요
                  </div>
                )}
                </>
              )}

              {/*
                색 설명을 적어 두지 않는다.
                조각에 이미 '7일 지남' 이라고 글자로 쓰여 있으므로 빨강이 무슨 뜻인지 물어볼 일이 없다.
                범례가 필요하다는 것은 화면이 스스로 설명하지 못한다는 뜻이다.
              */}
              <p className="t-sub text-slate-500">업무 조각을 누르면 상태를 고르는 창이 열립니다.</p>
            </section>

          </div>
        </ArrangeItem>
        <ArrangeItem id="alerts" label="지금 챙길 것" hint="서류 · 기한 · 돈 경고(업체가 있을 때)">
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
                className="flex min-h-10 items-center gap-2 text-[1.2rem] font-bold text-slate-900"
              >
                <ChevronRight
                  aria-hidden="true"
                  className={`size-5 text-slate-400 transition-transform ${alertsOpen ? 'rotate-90' : ''}`}
                />
                지금 챙길 것
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.875rem] font-semibold text-slate-600">
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
                      className={`tap rounded-(--radius-control) border px-3 py-1.5 text-[0.875rem] font-medium ${
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
                <p className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-8 text-[0.9375rem] text-slate-500">
                  불러오는 중…
                </p>
              ) : visibleAlerts.length === 0 ? (
                <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-8 text-center">
                  <ClipboardCheck aria-hidden="true" className="mx-auto size-8 text-success-600" />
                  <p className="mt-2 text-[1rem] font-semibold text-slate-800">
                    {tab === 'all' ? '지금 급하게 챙길 일이 없습니다' : '이 분류에는 항목이 없습니다'}
                  </p>
                  <p className="mt-1 text-[0.9375rem] break-keep text-slate-600">
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
                      className="self-start rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-[0.9375rem] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {visibleAlerts.length - shownAlerts.length}건 더 보기
                    </button>
                  )}
                </>
              )}
              </>
            )}
          </section>

        </ArrangeItem>
      </ArrangeArea>
      {/*
        목록에서 바로 고치기.
        저장은 상세 화면과 같은 함수를 쓰므로 여기서 바꾼 값이 업체 기록에 그대로
        들어간다 — 목록용 사본을 따로 두지 않는다.
      */}
      {bulkRecord && (
        <Suspense fallback={null}>
          <BulkDocUploadSheet
            record={bulkRecord}
            onClose={() => setBulkDocsFor(null)}
            onSaved={(saved) => setRecords((list) => list.map((r) => (r.id === saved.id ? saved : r)))}
          />
        </Suspense>
      )}

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
          onSave={quickSave}
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
            className="ax-pop max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-(--radius-panel) bg-white p-6 shadow-(--shadow-overlay)"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[1.2rem] font-bold text-slate-900">{!pilot && newType === 'consultant' ? '새 컨설턴트 고객 등록' : '새 업체 등록'}</h2>
              <button
                type="button"
                className="tap text-[0.9375rem] text-slate-500 hover:text-slate-800"
                onClick={() => setFormOpen(false)}
              >
                닫기
              </button>
            </div>
            <p className="mt-1 text-[0.9375rem] break-keep text-slate-500">
              {!pilot && newType === 'consultant' ? '이름(회사명)만 넣어도 됩니다.' : '업체명만 넣어도 됩니다.'} 나머지는 나중에 채울 수 있습니다.
            </p>
            <div className="mt-5 grid gap-4">
              {/* D-181: 고객 종류 — 대표만 고른다(팀장 화면은 늘 중소기업 고객) */}
              {!pilot && <ClientTypePicker value={newType} onChange={setNewType} />}
              {/* D-187: 서류만 넣어도 — 사업자등록증 · 크레탑 · 등기부등본을 읽어 아래 칸을 채운다 */}
              <NewClientDocDrop onChange={setDocsRead} preload={preDocs} />
              <label className="text-[0.9375rem] font-medium text-slate-700">
                {!pilot && newType === 'consultant' ? '이름(회사명)' : '업체명'}
                <input
                  autoFocus
                  required
                  value={form.companyName}
                  onChange={(e) => {
                    touch('companyName')
                    setForm({ ...form, companyName: e.target.value })
                  }}
                  className="mt-1.5 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]"
                />
                {docLine('companyName')}
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-[0.9375rem] font-medium text-slate-700">
                  대표자·담당자
                  <input
                    value={form.contactName}
                    onChange={(e) => {
                      touch('contactName')
                      setForm({ ...form, contactName: e.target.value })
                    }}
                    className="mt-1.5 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]"
                  />
                  {docLine('contactName')}
                </label>
                <label className="text-[0.9375rem] font-medium text-slate-700">
                  휴대폰번호
                  <input
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="010-0000-0000"
                    className="mt-1.5 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]"
                  />
                </label>
              </div>
              <label className="text-[0.9375rem] font-medium text-slate-700">
                사업자등록번호
                <input
                  value={form.businessNumber}
                  onChange={(e) => {
                    touch('businessNumber')
                    setForm({ ...form, businessNumber: e.target.value })
                  }}
                  placeholder="000-00-00000"
                  className="mt-1.5 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]"
                />
                {docLine('businessNumber')}
              </label>
              <fieldset>
                <legend className="text-[0.9375rem] font-medium text-slate-700">{!pilot && newType === 'consultant' ? '계약했나요' : '어떤 업체인가요'}</legend>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {[
                    { on: true, label: '잠재고객', hint: '아직 계약 전 — 영업 보드로' },
                    { on: false, label: '계약 고객', hint: '이미 계약함' },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      aria-pressed={asProspect === o.on}
                      onClick={() => setAsProspect(o.on)}
                      className={`tap flex flex-col items-start rounded-(--radius-control) border px-3 py-2 text-left ${asProspect === o.on ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    >
                      <span className="text-[1rem] font-bold text-slate-900">{o.label}</span>
                      <span className="t-meta text-slate-500">{o.hint}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              {dupe && (
                <p role="status" data-testid="new-client-dupe" className="t-sub rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 break-keep text-slate-800">
                  같은 업체가 이미 있습니다 —{' '}
                  {/* D-187: 넣은 서류가 있으면 그 업체 서류함으로 함께 넘긴다 */}
                  <Link to={`/ops/clients/${dupe.id}`} onClick={() => handDocsTo(dupe.id, docsRead.docs)} className="font-semibold text-brand-700 underline">
                    {dupe.companyName} 열기{docsRead.docs.length > 0 ? `(넣은 서류 ${docsRead.docs.length}개도 그 업체로)` : ''}
                  </Link>
                  . 다른 업체면 그대로 등록하세요.
                </p>
              )}
            </div>
            {/* D-187: 서류를 넣으면 창이 길어진다 — 등록 단추는 늘 보이게 바닥에 붙인다 */}
            <div className="sticky -bottom-6 -mx-6 mt-6 -mb-6 border-t border-slate-200 bg-white px-6 pt-3 pb-6">
            {docsRead.reading && (
              <p role="status" data-testid="new-client-docs-reading" className="t-meta mb-2 break-keep text-slate-600">
                서류를 읽는 중이에요 — 지금 등록해도 남은 서류는 업체를 연 뒤 마저 읽어 서류함에 넣어요.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
                취소
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? '등록 중…' : '등록하고 열기'}
              </Button>
            </div>
            </div>
          </form>
        </div>
      )}

      {/* 판단 기준은 '지금 챙길 것' 을 펼쳤을 때만 — 매일 보는 화면에 각주가 늘 떠 있을 이유가 없다 */}
      {alertsOpen && (
        <p className="pb-2 text-[0.875rem] text-slate-500">
          {SEVERITY_META.critical.label}·{SEVERITY_META.warning.label} 판단 기준: 마감 {DUE_SOON_DAYS}일 이내, 서류 유효기간 30일 이내,
          고객 회신 7일 이상 대기.
        </p>
      )}
    </div>
  )
}

function CloudOperationsHub() {
  const { currentWorkspaceId, workspaces } = useAuth()
  // D-530 백업 불러오기가 '파일이 나온 작업공간이 내 다른 작업공간인지' 를 알도록
  const mine = workspaces.map((w) => ({ id: w.workspaceId, name: w.workspace?.name ?? '' }))
  return <OperationsHubContent workspaceId={currentWorkspaceId} myWorkspaces={mine} />
}

export function OperationsHubPage() {
  return getDataModeConfig().mode === 'supabase' ? (
    <CloudOperationsHub />
  ) : (
    <OperationsHubContent workspaceId={null} />
  )
}
