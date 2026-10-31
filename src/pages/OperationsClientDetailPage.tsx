import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CLIENT_DETAIL_TABS as DETAIL_TABS, type ClientDetailTab } from '../config/clientDetailTabs'
import { rememberClientNames, rememberClientTab } from '../lib/crumbStore'
import { useIsPilot } from '../auth/osAccess'
import { useOwnerAiAccess } from '../auth/ownerAiAccess'
import { NextStepEditor } from '../components/ops/NextStepEditor'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { LINK_BUTTON } from '../components/sales/salesStyle'
import { ClientAssistButton } from '../components/ai/ClientAssistButton'
import { navFromOf } from '../lib/navFrom'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Archive,
  BriefcaseBusiness,
  Building2,
  Landmark,
  Workflow,
  ChevronRight,
  ArrowRight,
  MoreHorizontal,
  ClipboardCopy,
  FileUp,
  FileWarning,
  Lock,
  Paperclip,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
  Upload,
  Wrench,
  Presentation,
  ArrowRightLeft,
  FileText,
  Sparkles,
} from 'lucide-react'
import { FlaskConical, FolderOpen, ListTree } from 'lucide-react'
import { withoutProvisional } from '../services/marketingTrial'
import { DocFolderView } from '../components/ops/DocFolderView'
import { readDocView, writeDocView, type DocView } from '../lib/docViewPref'
import { useAuth } from '../auth/AuthProvider'
import { getDataModeConfig } from '../data/dataMode'
import {
  canUploadFiles,
  listClients,
  saveClient,
  storeDocumentFile,
  withContract,
  withCustomDocument,
  withCustomField,
  withDocument,
  withArchived,
  deleteClient,
  withFunding,
  withNewFunding,
  withNewNote,
  withNotePinned,
  withNoteText,
  withService,
  withoutCustomDocument,
  withoutCustomField,
  withoutFunding,
  withoutNote,
  normalizeClientOps,
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
  DOCUMENTS,
  SERVICES,
  SERVICE_STATUS_LABEL,
  SERVICE_STATUS_ORDER,
  isServiceStarted,
  servicesNeeding,
  isServiceOpen,
} from '../content/clientOpsCatalog'
import { nowIso, todayLocalDate } from '../lib/appClock'
import { formatFileSize, krwTile } from '../lib/format'
import {
  CONTRACT_KIND_LABEL,
  CONTRACT_STAGE_LABEL,
  contractStageOf,
  statusForStage,
} from '../types/clientOps'
import { contractAgeShort, doneWorks, summarizeContract } from '../services/contractSummary'
import { Fold, FoldAllButton, HintTip, openFold } from '../components/ui/fold'
import { hintFor } from '../content/sectionHints'
import type {
  ClientOpsRecord,
  ContractStage,
  DocumentKey,
  ServiceKey,
  ServiceStatus,
} from '../types/clientOps'
import { Button } from '../components/ui/Button'
import { NotFoundState } from '../components/ui/NotFoundState'
import { Modal } from '../components/ui/Modal'
import { Panel } from '../components/ui/Panel'
import { useToast } from '../components/ui/toastContext'
import { statusTone } from '../components/ops/opsParts'
import {
  DueDateField,
  MessageModal,
  PhoneLink,
  SavedBadge,
} from '../components/ops/opsControls'
import { CompanyProfileCard, NotesSection } from '../components/ops/opsProfile'
import { FactNumbersCard, factNumbersCount } from '../components/ops/ClientFactsCards'
import type { DocBatchSummary } from '../services/docAutoAnalyze'
import { analyzeUploadedDocs } from '../services/docAutoAnalyze'
import { pendingFacts } from '../services/customerFacts'

/** D-144: 맞춤 추천 탭 — 모듈 엔진(정책자금 · 창업감면 …)을 담고 있어 이 탭을 열 때만 불러온다 */
const ClientSmartTab = lazy(() => import('../components/ops/ClientSmartTab'))
// D-190: 개요 맨 위 '이 업체에 먼저 제안할 것' — 판정 엔진(정책자금 · 창업감면 …)은 따로 받아 첫 화면을 무겁게 하지 않는다
const ClientTopPicks = lazy(() => import('../components/ops/ClientTopPicks'))
// 대표 AI 전략실(V1) — 대표 전용 탭(기능 권한). 팀장 화면 · 권한 없는 계정에는 탭 · 더보기 단추 · 주소 모두 없다
const ClientAiTab = lazy(() => import('./ownerAi/ClientAiTab'))
import { factNoteFor, readFact, withFactValue, withProfileFieldEdit, withProfileFieldTyped } from '../services/customerFacts'
import { TodoComposer } from '../components/journal/TodoBoard'
import { createJournalEntry } from '../services/journalService'
import { requestFollowUpText } from '../services/recoRequest'
import { addDaysLocal } from '../services/clientOpsNextAction'
import { FundingSection } from '../components/ops/FundingSection'
import { DocImportModal } from '../components/ops/DocImportModal'
import { BulkDocUploadSheet } from '../components/ops/BulkDocUploadSheet'
import { takeHandedDocs, type HandoffDoc } from '../services/docHandoff'
import { netAmountOf } from '../services/feeMath'
import { fundingFactsOf, isWaiting } from '../services/feeStatus'
import { withActivity } from '../services/clientOpsActivity'
import { CLIENT_TYPE_LABEL, clientTypeOf, rememberClientTypeView, withClientType } from '../services/clientType'
import { allDocumentMetas, emptyDocumentState } from '../services/clientOpsDocuments'
import { placeDocument } from '../services/docClassify'
import { ActivityLog } from '../components/ops/ActivityLog'
import { ClientSalesCard } from '../components/sales/ClientSalesCard'
import { SalesJourneyCard } from '../components/sales/SalesJourneyCard'
import { SALES_SIMPLE } from '../config/salesSimple'
import { withSalesPath } from '../services/salesJourney'
import { isProspect, salesStageOf, withSalesStage } from '../services/salesPipeline'
import { ContractCard } from '../components/ops/ContractCard'
import { ContractPlanSheet } from '../components/ops/ContractPlanSheet'
import { ContractStageMenu } from '../components/ops/ContractStageMenu'
import { FeesPanel } from '../components/ops/FeesPanel'
import { InlineConfirm } from '../components/ui/InlineConfirm'
import { ContractCloseSheet } from '../components/sales/ContractCloseSheet'
import { contractCloseDraft, withContractClose, type ContractCloseDraft } from '../services/salesContract'
import { ScrollHintRow } from '../components/ui/ScrollHintRow'
import { WorkHistoryCard } from '../components/ops/WorkHistoryCard'
import { ToolResultsCard } from '../components/ops/ToolResultsCard'
import { AxProjectsCard } from '../components/ops/AxProjectsCard'
import { ClientToolsCard } from '../components/ops/ClientToolsCard'
import { toolsNeeding } from '../config/toolRegistry'
import { PortalTab } from '../components/ops/PortalTab'
import {
  Badge,
  BottomSheet,
  Disclosure,
  Dot,
  MetricTile,
  Surface,
  type Tone,
} from '../components/ui/primitives'
import { loadCustomServicesIntoCatalog } from '../services/customServiceService'
import { ServiceCatalogModal } from '../components/ops/ServiceCatalogModal'
import { ClientJournalTab } from '../components/ops/ClientJournalTab'
import { ClientSharedFiles } from '../components/ops/FilesTab'
import { DocFileActions } from '../components/ops/DocFileActions'
import { DocResortSheet } from '../components/ops/DocResortSheet'
import { DocKindPicker, DocShelfBar } from '../components/ops/DocShelfBar'
import { docShelfSummary } from '../services/docShelf'
import { withoutDocumentFile } from '../services/docPlacementApply'
import { generateId } from '../storage/localStore'
import { ClientConsultingTab } from '../components/consulting/ClientConsultingTab'
import { listLinksForClient } from '../services/customerBridgeService'
import { buildClientSchedule } from '../services/clientOpsSchedule'
import { brand } from '../brand/brand.config'
import { SERVICE_STATUS_LOOK } from '../components/ops/serviceStatusLook'
import { josa } from '../lib/josa'
import { activeApplications, withApplyDocDone } from '../services/grants/grantApply'
import { usePortalDocRequests } from '../components/grants/usePortalDocRequests'
import { ClientReportSheet } from '../components/ops/ClientReportSheet'
import type { ReportPeriod } from '../services/clientReport'
import { CLIENT_FLOW, flowPosition } from '../content/flowSteps'
import { StepGuide, StepNext } from '../components/ui/StepGuide'



const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.98rem] focus:border-brand-500 focus:outline-none'

/** 계약 정보가 하나라도 적혀 있나 — 계약일 · 방식 · 현금 금액 · 보험 */
function hasContractInfo(r: ClientOpsRecord): boolean {
  return r.contract.signedAt !== '' || r.contract.kind !== '' || (r.contract.cashAmount ?? 0) > 0 || r.contract.policies.length > 0
}

type DetailTab = ClientDetailTab
const PILOT_HIDDEN_TABS = new Set<DetailTab>(['portal', 'consulting', 'ai'])
function isDetailTab(v: string | null): v is DetailTab {
  return DETAIL_TABS.some((t) => t.key === v)
}

function ClientDetailContent({ workspaceId, userId }: { workspaceId: string | null; userId: string | null }) {
  const { clientId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  // D-129: 예전 '파일' 탭 주소는 서류로 — 고객과 주고받은 파일도 서류 탭 아래에 있다
  // D-162: Pilot 에게는 고객 플랫폼(대표 공개 사이트와 이어짐) · 컨설팅(특허·MVP) 탭이 없다 — 주소로 와도 개요로
  const pilot = useIsPilot()
  const requested: DetailTab = tabParam === 'files' ? 'docs' : isDetailTab(tabParam) ? tabParam : 'overview'
  const ownerAi = useOwnerAiAccess()
  const tab: DetailTab = (pilot && PILOT_HIDDEN_TABS.has(requested)) || (requested === 'ai' && ownerAi === 'no') ? 'overview' : requested
  /** 개요에서 항목을 누르면 그 항목이 열린 채로 업무 탭이 뜨도록 svc 를 함께 싣는다 */
  const location = useLocation()
  /** D-124: 영업에서 왔으면 돌아갈 곳 — 탭을 바꿔도 잃지 않게 state 를 함께 싣는다 */
  const navFrom = navFromOf(location.state)
  const setTab = (next: DetailTab, svc?: ServiceKey) =>
    setSearchParams(next === 'overview' ? {} : svc ? { tab: next, svc } : { tab: next }, { replace: true, state: location.state })
  const goBack = () => {
    if (!navFrom) {
      navigate('/ops/clients')
      return
    }
    // 앱 안에서 왔으면 한 칸 뒤로(보던 자리 그대로), 주소로 바로 열었으면 그 화면으로
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(navFrom.path)
  }
  const focusedService = searchParams.get('svc')
  // D-235: 업체 일 순서 — 팀장 화면에 없는 탭(고객 플랫폼)은 순서에서도 뺀다
  const flowPos = flowPosition(CLIENT_FLOW, tab, (k) => !(pilot && PILOT_HIDDEN_TABS.has(k as DetailTab)))
  const [portalLinked, setPortalLinked] = useState<boolean | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const { showToast } = useToast()
  // D-152: 지원사업 신청 탭에서만 고객 플랫폼 연결 · 요청해 둔 서류를 읽는다
  const portalReq = usePortalDocRequests(workspaceId, clientId, '지원사업 신청에 필요한 서류입니다', tab === 'funding')
  const [record, setRecord] = useState<ClientOpsRecord | null>(null)
  // D-235: 경로 줄 — 이 업체 이름 · 지금 탭을 기억(이 업체의 모듈로 가면 '고객 관리 › 업체 › 맞춤 추천 › 모듈' 로 잇는다)
  const recordName = record?.companyName ?? ''
  useEffect(() => {
    if (clientId && recordName) rememberClientNames([{ id: clientId, companyName: recordName }])
  }, [clientId, recordName])
  useEffect(() => {
    if (clientId) rememberClientTab(clientId, tab)
  }, [clientId, tab])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState<{ title: string; description: string; text: string } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  /** 개요에서 눌러 들어온 업무 카드로 화면을 옮긴다 */
  const focusedCardRef = useRef<HTMLDivElement | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  /** 모바일에서 부가 행동을 담는 시트 */
  const [moreOpen, setMoreOpen] = useState(false)
  // D-154: 성과 보고서 한 장
  // D-155: 오늘 '안부 챙길 계약 고객' 의 [성과 보고서] 는 ?report=1 로 들어와 바로 연다
  const [reportOpen, setReportOpen] = useState(() => searchParams.get('report') === '1')
  // 같은 화면이 떠 있는 채 다른 업체의 ?report=1 로 와도 연다
  const reportParam = searchParams.get('report') === '1'
  const reportPeriodParam: ReportPeriod = (['year', 'last12', 'contract'] as const).find((p) => p === searchParams.get('period')) ?? 'year'
  useEffect(() => {
    if (reportParam) setReportOpen(true)
  }, [reportParam, clientId])
  /** D-140: 계약 · 수금 한 번에 (개요의 계약 카드에서) */
  const [planOpen, setPlanOpen] = useState(false)
  /**
   * 삭제 확인 단계 — 0 닫힘 / 1 첫 번째 물음 / 2 두 번째 물음.
   * 되돌릴 수 없는 일이라 두 번 묻는다. 두 번째에서는 업체 이름을 그대로 적게 해
   * "예" 를 습관적으로 누르는 것을 막는다.
   */
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  /** D-129: 두 번째 확인은 이름 타이핑이 아니라 체크 — 휴대폰 키보드 · 붙여넣기에서 자꾸 막혔다 */
  const [deleteChecked, setDeleteChecked] = useState(false)
  /* 직접 만든 서류 칸 (D-82) — 적는 중인 새 칸과, 이름을 고치는 중인 칸 */
  const [newDocLabel, setNewDocLabel] = useState('')
  const [newDocMonths, setNewDocMonths] = useState('')
  /** D-122: 서류 탭에서 펼쳐 둔 줄 — 받았고 문제없는 서류는 한 줄로 접는다 */
  const [openDocs, setOpenDocs] = useState<Set<string>>(() => new Set())
  // D-204: 서류함 보기 — 목차(서류 칸) · 폴더(올린 그대로). 이 브라우저에 기억
  const [docView, setDocView] = useState<DocView>(() => readDocView())
  const changeDocView = (v: DocView) => {
    setDocView(v)
    writeDocView(v)
  }
  const [renamingDoc, setRenamingDoc] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  /* 서류 한꺼번에 올리기 시트 (D-84) · D-144 머리줄 '서류 올리기'(읽자마자 저절로) */
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkShow, setBulkShow] = useState(0)
  /* D-146: 올려 둔 파일 다시 읽어 칸 옮기기 */
  const [resortOpen, setResortOpen] = useState(false)
  const [autoUploadOpen, setAutoUploadOpen] = useState(false)
  // D-157: 창을 숨기고 뒤에서 올리는 중에 [서류 올리기] 를 또 누르면 그 창을 다시 보인다
  const [uploadShow, setUploadShow] = useState(0)
  const openUpload = () => {
    setAutoUploadOpen(true)
    setUploadShow((n) => n + 1)
  }
  /** D-187: 새 업체 등록 창에서 넣은 서류 — 업체를 열자마자 서류함에 올리고 분석한다 */
  const [handedDocs, setHandedDocs] = useState<HandoffDoc[]>([])
  /** D-144: 방금 올린 서류에서 읽은 것 — 맞춤 추천 맨 위에 보여 준다 */
  const [lastBatch, setLastBatch] = useState<DocBatchSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const today = todayLocalDate()
  const contractAge = contractAgeShort(record?.contract.signedAt ?? '', today)

  /**
   * D-120 저장 순서 — 칸마다 바로 저장하는데, 응답이 늦게 오면 예전 값이 새 값을 덮던 문제를 막는다.
   * latestRef 는 화면에 보이는 가장 새 기록. 저장 중에 또 고치면 끝난 뒤 가장 새 기록으로 한 번 더 저장하고,
   * 늦게 온 예전 응답은 화면에 되돌려 쓰지 않는다.
   */
  const latestRef = useRef<ClientOpsRecord | null>(null)
  /** D-209: 이 업체 화면이 아직 떠 있나 — 다른 업체로 옮긴 뒤 끝난 올리기가 그 화면의 탭을 바꾸지 않게 */
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])
  /** 지금 돌고 있는 저장 — 그동안 또 고친 사람도 이 저장이 끝난 결과(됐는지)를 기다린다(D-122) */
  const loopRef = useRef<Promise<boolean> | null>(null)
  /** 업체를 빨리 옮겨 다닐 때 늦게 온 예전 업체 응답을 버린다(D-122) */
  const loadSeq = useRef(0)

  const load = useCallback(
    async (quiet = false) => {
      const seq = ++loadSeq.current
      try {
        // 저장 실패 뒤 다시 읽을 때는 화면을 '불러오는 중' 으로 바꾸지 않는다 — 열어 둔 칸 · 적던 글이 사라지지 않게
        if (!quiet) setLoading(true)
        const all = await listClients(workspaceId)
        // D-122: 업체를 읽은 뒤 직접 만든 업무 항목을 올리고, 같은 자리에서 새 칸을 채운다(목록 · 기록이 어긋나는 틈을 없앤다)
        await loadCustomServicesIntoCatalog(workspaceId)
        if (seq !== loadSeq.current) return
        const hit = all.find((r) => r.id === clientId)
        const found = hit ? normalizeClientOps(hit) : null
        latestRef.current = found
        setRecord(found)
        setNotFound(found === null)
      } catch (cause) {
        showToast(cause instanceof Error ? cause.message : '불러오지 못했습니다.')
      } finally {
        if (!quiet && seq === loadSeq.current) setLoading(false)
      }
    },
    [workspaceId, clientId, showToast],
  )

  useEffect(() => {
    void load()
  }, [load])

  /*
   * D-210: 다른 기기 · 다른 창에서 고친 것을 덮지 않게 — 이 화면을 한동안 떠났다가 돌아오면(탭 · 앱 전환)
   * 저장된 기록을 다시 읽어 더 새 것이면 바꿔 둔다. 예전에는 PC 에 열어 둔 화면이 휴대폰에서 한 입금 확인을
   * 모른 채 다음 약속을 고치며 통째로 저장해, 입금 확인이 말없이 되돌아갔다. 저장 중일 때는 건드리지 않는다.
   */
  useEffect(() => {
    let hiddenAt = 0
    const onVisible = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt === 0 || Date.now() - hiddenAt < 5000) return
      hiddenAt = 0
      void (async () => {
        try {
          const mine = latestRef.current
          const all = await listClients(workspaceId)
          const hit = all.find((r) => r.id === clientId)
          if (!hit || !mine || loopRef.current || !aliveRef.current) return
          // 읽는 사이 이 화면에서 고친 것이 있으면 덮지 않는다 — 그 저장 결과가 최신이다
          if (latestRef.current !== mine) return
          if ((hit.updatedAt ?? '') > (mine.updatedAt ?? '')) {
            const fresh = normalizeClientOps(hit)
            latestRef.current = fresh
            setRecord(fresh)
            showToast('다른 곳에서 고친 내용이 있어 새로 불러왔습니다.')
          }
        } catch {
          // 못 읽어도 화면은 그대로 둔다(다음에 돌아올 때 다시)
        }
      })()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [workspaceId, clientId, showToast])

  // D-187: 등록 창에서 넘겨받은 서류가 있으면 업체를 읽은 뒤 바로 '서류 올리기' 를 연다(한 번만 꺼낸다)
  useEffect(() => {
    if (!record || record.id !== clientId) return
    const docs = takeHandedDocs(clientId)
    if (docs.length === 0) return
    setHandedDocs(docs)
    setAutoUploadOpen(true)
    setUploadShow((n) => n + 1)
  }, [record, clientId])

  // 고객 플랫폼 연결 여부 — 헤더 칩용. 브릿지 미적용이면 null(표시 안 함)
  useEffect(() => {
    let alive = true
    listLinksForClient(workspaceId, clientId)
      .then((links) => { if (alive) setPortalLinked(links.some((l) => l.status === 'active')) })
      .catch(() => { if (alive) setPortalLinked(null) })
    return () => { alive = false }
  }, [workspaceId, clientId, tab])

  const commit = useCallback(
    (next: ClientOpsRecord): Promise<boolean> => {
      latestRef.current = next
      setRecord(next)
      // 이미 저장 중이면 그 저장이 끝난 뒤 가장 새 기록으로 이어서 저장한다(아래 반복).
      // D-122: 기다린 사람에게도 '됐다' 를 미리 말하지 않는다 — 같은 결과를 기다려 받는다(실패하면 적던 칸이 남는다)
      if (loopRef.current) return loopRef.current
      const run = (async (): Promise<boolean> => {
        await Promise.resolve() // loopRef 에 먼저 걸고 시작한다
        try {
          for (;;) {
            const target: ClientOpsRecord | null = latestRef.current
            if (!target) break
            const saved: ClientOpsRecord = await saveClient(target)
            if (latestRef.current === target) {
              latestRef.current = saved
              setRecord(saved)
              setSavedAt(Date.now())
              break
            }
          }
          return true
        } catch (cause) {
          showToast(cause instanceof Error ? `${cause.message} — 저장된 내용으로 다시 불러왔습니다.` : '저장하지 못했습니다. 저장된 내용으로 다시 불러왔습니다.')
          void load(true)
          return false
        } finally {
          loopRef.current = null
        }
      })()
      loopRef.current = run
      return run
    },
    [showToast, load],
  )

  /** 지금 화면의 가장 새 기록 — 기다린 뒤(파일 올리기 등) 이것에 얹어 저장한다 */
  const current = useCallback((): ClientOpsRecord | null => latestRef.current ?? record, [record])

  /** D-122: 계약 완료 확인 시트 — 영업 카드 · 계약 단계에서 '계약 완료' 를 고르면 */
  const [closing, setClosing] = useState<ContractCloseDraft | null>(null)
  const [allRecords, setAllRecords] = useState<ClientOpsRecord[]>([])
  const openClose = async () => {
    if (!record) return
    // D-210: 다른 업체 기록을 먼저 읽고 초안을 만든다 — 소개자가 늘 받던 영업자 수수료가 처음 열 때도 채워지게
    // (예전에는 목록을 읽기 전에 창이 열려 처음 한 번은 비어 있었다. 보드에서는 채워졌다)
    let all = allRecords
    if (all.length === 0) {
      try {
        all = await listClients(workspaceId)
        setAllRecords(all)
      } catch {
        all = []
      }
    }
    setClosing(contractCloseDraft(record, { today, records: all.length > 0 ? all : [record] }))
  }

  /**
   * 계약 단계 변경 — 인라인 select 와 더보기 시트가 함께 쓴다.
   * D-122: 영업 단계도 함께 맞춘다. 예전에는 여기서 계약 완료로 바꿔도 영업 보드에는 3차 클로징으로 남아
   * 같은 업체가 계약 고객이면서 '진행 중' 으로 세였다. 계약 전으로 되돌리면 영업은 클로징으로.
   */
  const changeStage = (stage: ContractStage, direct = false) => {
    if (!record) return
    const before = contractStageOf(record.status)
    if (before === stage) return
    if (stage === 'signed' && before === 'pre' && !direct) {
      openClose()
      return
    }
    // D-210: '단계만 옮기기' 로 계약 완료가 되어도 계약일이 비지 않게(오늘) — 보드에서 옮길 때와 같게.
    // 계약일이 없으면 머리줄 · 목록의 계약 기간 · 계약 1주년 안부가 빠졌다
    const signedAt = stage === 'signed' && before === 'pre' && !record.contract.signedAt ? today : record.contract.signedAt
    let next = withActivity(
      { ...record, status: statusForStage(stage), contract: { ...record.contract, signedAt } },
      'profile',
      `계약 단계 · ${CONTRACT_STAGE_LABEL[before]} → ${CONTRACT_STAGE_LABEL[stage]}`,
    )
    const sales = salesStageOf(next)
    if (stage !== 'pre' && sales !== 'contracted' && record.sales) next = withSalesStage(next, 'contracted')
    if (stage === 'pre' && record.sales?.stage === 'contracted') next = withSalesStage(next, 'closing')
    void commit(next)
  }

  // D-144: 급한 것 먼저(심각 → 주의 → 남은 날)
  const alerts = useMemo(() => {
    const SEV: Record<string, number> = { critical: 0, warning: 1, info: 2 }
    return (record ? buildClientAlerts(record, today) : []).sort((a, b) => (SEV[a.severity] ?? 3) - (SEV[b.severity] ?? 3) || (a.daysLeft ?? 999) - (b.daysLeft ?? 999))
  }, [record, today])
  /** D-192: 접힌 목차 옆 숫자 · 한 줄 요약 */
  const factCount = useMemo(() => (record ? factNumbersCount(record) : { filled: 0, toConfirm: 0 }), [record])
  const contractLine = useMemo(() => {
    if (!record) return ''
    const c = summarizeContract(record.contract, today)
    return [c.kindLabel, c.moneyText, c.ageText].filter((v) => v !== '').join(' · ')
  }, [record, today])

  /** 다음 행동이 늦었는지 — 늦었을 때만 색을 쓴다 */
  const nextActionDaysLeft = record?.nextActionDueDate ? daysLeftFrom(today, record.nextActionDueDate) : null
  const nextActionTone: Tone =
    nextActionDaysLeft === null ? 'neutral' : nextActionDaysLeft < 0 ? 'danger' : nextActionDaysLeft <= 3 ? 'warning' : 'brand'

  /** 지금 손대고 있는 업무 (완료·보류 제외) */
  const startedServices = useMemo(
    () =>
      record
        ? SERVICES.filter(
            (m) => isServiceStarted(record.services[m.key].status) && record.services[m.key].status !== 'done',
          )
        : [],
    [record],
  )

  /** 가장 급한 업무 하나 — 업무 탭에서 이것만 펼친 채로 시작한다 */
  const firstUrgentKey = useMemo(() => {
    if (!record) return null
    for (const m of SERVICES) {
      const st = record.services[m.key]
      if (!isServiceOpen(st.status)) continue
      const blocked = isServiceStarted(st.status) && missingDocumentsFor(record, m.key, today).length > 0
      const left = st.dueDate ? daysLeftFrom(today, st.dueDate) : null
      if (blocked || (left !== null && left < 0)) return m.key
    }
    return null
  }, [record, today])

  const paidAmount = useMemo(
    // 받은 돈도 내 몫으로 센다 (D-74)
    () => (record ? record.fees.filter((f) => f.receivedAt !== null).reduce((s, f) => s + netAmountOf(f), 0) : 0),
    [record],
  )
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
  const [todoOpen, setTodoOpen] = useState(false)
  const prospect = record ? isProspect(record) : false
  const nearest = useMemo(() => {
    if (!record) return null
    // 다음 약속은 바로 아래 '지금 할 일' 에 있으므로 여기서는 마감만
    const upcoming = buildClientSchedule(record, today).filter((e) => !e.done && e.kind !== 'next')
    return upcoming.sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  }, [record, today])

  useEffect(() => {
    if (!focusedService) return
    focusedCardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusedService, tab])

  if (loading) return <p className="px-1 py-10 text-[0.98rem] text-slate-500">불러오는 중…</p>
  if (notFound || !record || !progress) {
    return (
      <NotFoundState
        title="업체를 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제된 업체입니다."
        backTo="/ops/clients"
        backLabel="고객 관리 현황으로"
      />
    )
  }

  const uploadable = canUploadFiles()

  const onPickFile = async (key: DocumentKey, file: File | undefined) => {
    if (!file) return
    try {
      // D-120: 파일을 올리는 동안 고친 것이 있어도 덮지 않게 — 올린 뒤의 가장 새 기록에 얹는다
      const patch = await storeDocumentFile(record, key, file)
      const base = current() ?? record
      // D-209: 파일을 '바꾸면' 옛 발급일 · 유효기간 끝을 물려받지 않는다(새 서류가 옛 만료일로 '만료됨' 이 됐다).
      // 파일 없이 적어 둔 발급일에 스캔본을 처음 붙일 때는 그대로 둔다. 새 파일에서 날짜를 읽으면 아래에서 다시 넣는다.
      const hadFile = Boolean(base.documents[key]?.fileName || base.documents[key]?.storagePath)
      // D-204: 칸에서 파일 하나를 고르면 폴더 정보는 그대로 둔다(같은 서류를 새 파일로 바꾼 것 — 폴더로 보기에서 제자리)
      const ok = await commit(withDocument(base, key, hadFile ? { ...patch, issuedAt: '', validUntil: undefined } : patch))
      // D-209: 저장에 실패하면 '보관했습니다' 라고 하지 않는다(실패 알림은 저장 쪽이 띄운다)
      if (!ok) return
      showToast(hadFile ? '새 파일로 바꿨습니다 — 발급일은 새 서류에서 다시 읽거나 적어 주세요.' : '파일을 보관했습니다.')
      // D-144: 올린 서류를 읽어 — 확실한 회사 정보는 바로 넣고, 애매한 것은 까닭과 함께 묻는다 · 크레탑 · 명부는 그 엔진이 읽는다
      const reader = ok ? await import('../services/docTextExtract') : null
      if (reader && reader.canExtractText(file)) {
        // D-432 못 읽은 까닭이 사람 말이면(아이폰 HEIC · 암호 문서) 알린다 — 파일은 이미 칸에 보관됨
        const res = await reader.extractTextFromFile(file).catch((e: unknown) => {
          if (e instanceof reader.OfficeReadError) showToast(`파일은 보관했어요. ${e.message}`)
          return null
        })
        if (res?.note) showToast(res.note)
        if (res && res.text.trim()) {
          // D-209: 새 서류에 찍힌 발급일 · 유효기간 끝을 그 칸에(사람이 그새 적었으면 그대로)
          const dated = placeDocument({ text: res.text, fileName: file.name }, allDocumentMetas(current() ?? record).filter((m) => m.needsFile))
          const now0 = current() ?? record
          if ((dated.issuedAt || dated.validUntil) && !now0.documents[key]?.issuedAt && !now0.documents[key]?.validUntil) {
            await commit(withDocument(now0, key, { ...(dated.issuedAt ? { issuedAt: dated.issuedAt } : {}), ...(dated.validUntil ? { validUntil: dated.validUntil } : {}) }))
          }
          const latest = current() ?? record
          const out = await analyzeUploadedDocs(latest, [{ key, fileName: file.name, text: res.text, method: res.method, docSure: true }], { now: nowIso(), today: todayLocalDate(), makeId: generateId })
          const sm = out.summary
          if ((sm.entered.length || sm.flagged.length || sm.cretop || sm.roster) && (await commit(out.record))) {
            // D-345 판정 비교는 칸에 파일을 넣기 전 기록과
            setLastBatch({ ...sm, before: base })
            showToast(
              [sm.entered.length ? `바로 넣은 정보 ${sm.entered.length}건` : '', sm.flagged.length ? `확인할 정보 ${sm.flagged.length}건` : '', sm.cretop ? '크레탑 분석 붙임' : '', sm.roster ? '명부 진단 붙임' : '']
                .filter(Boolean)
                .join(' · ') + ' — 맞춤 추천에서 보세요.',
            )
          }
          for (const w of sm.warnings) showToast(w)
        }
      }
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '파일을 보관하지 못했습니다.')
    }
  }

  const cardOpen = (key: ServiceKey, auto: boolean) => openCards[key] ?? (key === focusedService ? true : auto)
  const toggleCard = (key: ServiceKey, auto: boolean) =>
    setOpenCards((s) => ({ ...s, [key]: !(s[key] ?? auto) }))

  return (
    <div className="flex flex-col gap-5">
      <SavedBadge savedAt={savedAt} />

      {/* 헤더 */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          data-testid="client-back"
          onClick={goBack}
          className="tap inline-flex w-fit items-center gap-1.5 text-[0.95rem] font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {navFrom ? `${navFrom.label}로` : '고객 관리 현황'}
        </button>
        {/*
          머리말은 세 줄로 끝낸다 — 회사명 / 연락처 / 다음 행동.
          상태 변경·보고 문구·보관·가이드는 모바일에서 '더보기' 안으로 넣는다.
        */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="t-page min-w-0 break-keep text-slate-900 [overflow-wrap:anywhere]">{record.companyName || '(이름 없음)'}</h1>
              {/* D-140: 회사명 옆에서 바로 계약 상태 바꾸기 (계약 전 · 계약 중 · 계약 완료) */}
              <ContractStageMenu status={record.status} onChange={(s) => changeStage(s)} />
              {/* D-181: 컨설턴트 고객 표시 — 대표 화면만 */}
              {!pilot && clientTypeOf(record) === 'consultant' && (
                <span data-testid="client-type-badge" className="t-meta inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 font-semibold whitespace-nowrap text-brand-700">
                  <BriefcaseBusiness aria-hidden="true" className="size-3.5" />
                  {CLIENT_TYPE_LABEL.consultant}
                </span>
              )}
              {/* D-220: 마케팅 도구에서 가상으로 만들어 보다 임시등록한 기록 */}
              {record.provisional && (
                <span
                  data-testid="client-provisional-badge"
                  title={`마케팅 도구(홈페이지 · 홍보 글)에서 임시등록${record.provisional.requestedBy ? ` · 부탁한 사람 ${record.provisional.requestedBy}` : ''} — 더보기에서 표시를 지울 수 있어요`}
                  className="t-meta inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold whitespace-nowrap text-amber-800"
                >
                  <FlaskConical aria-hidden="true" className="size-3.5" />
                  임시등록
                </span>
              )}
            </div>
            <p className="t-sub mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500">
              <PhoneLink phone={record.contactPhone} />
              {record.contactName && <span>{record.contactName}</span>}
              {/* 계약한 지 얼마나 됐는지 — 계약 카드까지 내려가지 않아도 머리말에서 보인다 */}
              {contractAge !== '' && (
                <button type="button" onClick={() => setTab('overview')} className="tap inline-flex items-center font-medium text-brand-700">
                  {record.contract.kind !== '' ? `${CONTRACT_KIND_LABEL[record.contract.kind]} · ` : '계약 · '}
                  {contractAge}
                </button>
              )}
              {portalLinked !== null && !pilot && (
                <button
                  type="button"
                  onClick={() => setTab('portal')}
                  className={`tap inline-flex items-center ${portalLinked ? 'text-success-700' : 'text-slate-500'}`}
                >
                  {brand.customerPlatformLabel} {portalLinked ? '연결됨' : '미연결'}
                </button>
              )}
            </p>
            {nearest && (
              <p className="t-sub mt-0.5 text-slate-500">
                가장 임박 · {nearest.title} · {nearest.date}
                {nearest.daysLeft !== null && (
                  <span className={nearest.daysLeft < 0 ? ' font-semibold text-danger-700' : ' text-slate-600'}>
                    {' '}
                    {dueText(nearest.daysLeft)}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* 주요 행동 — 한 화면에 강조 버튼은 하나만 둔다. D-126: 잠재고객은 서류보다 미팅이 먼저 */}
        <div className="flex flex-wrap items-center gap-2">
          {prospect && (
            <Link to={`/sales/meeting?client=${record.id}`} data-testid="client-primary-meeting" className={LINK_BUTTON.primary}>
              <Presentation aria-hidden="true" className="size-4" />
              미팅 준비
            </Link>
          )}
          {/* D-144: 서류 올리기 — 파일 · 폴더째. 읽자마자 확실한 것은 바로 넣고, 모듈 판정은 맞춤 추천에 */}
          <Button variant={prospect ? 'secondary' : 'primary'} onClick={openUpload} data-testid="client-upload">
            <FileUp aria-hidden="true" className="size-4" />
            서류 올리기
          </Button>
          {/* D-295 대표: 업체를 등록하고 바로 AI 전략실로(반대로 AI 전략실 → 고객 관리처럼) — 머리 단추라 어느 탭에서든 · 휴대폰에서도. 이어 둔 작업실이 없으면 그 탭에서 한 번에 이어 만든다 · 팀장에게는 없다 */}
          {!pilot && ownerAi !== 'no' && tab !== 'ai' && (
            <Button variant="secondary" onClick={() => setTab('ai')} data-testid="client-open-ai">
              <Sparkles aria-hidden="true" className="size-4 text-violet-600" />
              AI 전략실
            </Button>
          )}
          {/* D-166: 휴대폰은 머리 단추를 줄인다 — 서류 요청 문구는 '더보기' 안에(PC 는 그대로) */}
          <Button
            variant="secondary"
            className="hidden sm:inline-flex"
            onClick={() =>
              setMessage({
                title: '서류 요청 문구',
                description: '지금 진행 중인 업무에 필요한데 아직 없는 서류만 골라 정리했습니다.',
                text: buildDocumentRequestMessage(record, today),
              })
            }
          >
            <Send aria-hidden="true" className="size-4" />
            서류 요청 문구
          </Button>
          <Button
            variant="secondary"
            className="hidden sm:inline-flex"
            onClick={() =>
              setMessage({
                title: '진행 상황 보고 문구',
                description: '업무별 현재 상태와 다음 단계를 정리했습니다.',
                text: buildStatusReportMessage(record, today),
              })
            }
          >
            <ClipboardCopy aria-hidden="true" className="size-4" />
            진행 상황 보고
          </Button>
          {/* D-239: 이 업체 AI 도우미 — 대표 계정에서만(팀장 화면 · 팀장 보기에는 없음) */}
          <ClientAssistButton record={record} today={today} />
          <Button variant="ghost" onClick={() => setMoreOpen(true)}>
            <MoreHorizontal aria-hidden="true" className="size-4" />
            더보기
          </Button>
        </div>

        {record.archivedAt && (
          <p className="rounded-(--radius-control) border border-slate-200 bg-slate-50 px-4 py-2.5 text-[0.92rem] break-keep text-slate-600">
            보관된 업체입니다. 현황표·경고·일정에 나타나지 않습니다. 데이터는 그대로 있습니다.
          </p>
        )}
      </div>

      {/* 탭 — 개요는 요약, 나머지는 각 영역 */}
      {/* 탭은 화면 위에 붙여 둔다 — 아래로 내려가도 지금 어느 영역인지 잃지 않는다 */}
      {/* D-122: 오른쪽에 탭이 더 있으면 '›' — 휴대폰에서 수금 · 자금 · 고객 플랫폼 탭이 있는 줄 몰랐다 */}
      <ScrollHintRow
        role="tablist"
        ariaLabel="업체 상세"
        activeKey={tab}
        className="sticky top-16 z-20 -mx-4 bg-slate-50/95 backdrop-blur sm:-mx-6 lg:-mx-10"
        innerClassName="flex gap-1 border-b border-slate-200 px-4 sm:px-6 lg:px-10"
      >
        {DETAIL_TABS.filter((t) => !(pilot && PILOT_HIDDEN_TABS.has(t.key)) && (!t.hidden || t.key === tab || (t.key === 'funding' && activeApplications(record).length > 0))).map((t) => {
          // D-236: 맞춤 추천 숫자 = 탭 안 · 개요 줄과 같은 것(확인할 정보 + 지금 챙길 것). 예전에는 '심각' 만 세어 개요 줄 숫자와 달랐다 — 빨간색은 확인할 정보 · 심각이 있을 때만
          const smartRed = t.key === 'smart' && pendingFacts(record).length + alerts.filter((a) => a.severity === 'critical').length > 0
          const badge =
            t.key === 'smart' ? pendingFacts(record).length + alerts.length
              : t.key === 'overview' ? 0
              : t.key === 'docs' ? urgentDocs.size
                : t.key === 'fees' ? record.fees.filter((f) => !f.receivedAt && !isWaiting(f, fundingFactsOf(record.fundingApplications))).length
                  : t.key === 'funding' ? record.fundingApplications.filter((a) => a.status === 'watching' || a.status === 'preparing').length
                    : 0
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`t-body -mb-px flex min-h-12 shrink-0 items-center gap-1.5 border-b-2 px-3 font-semibold whitespace-nowrap ${
                tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
              {badge > 0 && (
                <span className={`t-meta rounded-full px-1.5 font-semibold ${smartRed ? 'bg-danger-50 text-danger-700' : 'bg-slate-100 text-slate-600'}`}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </ScrollHintRow>

      {/* D-235: 지금 몇 번째 단계 · 무엇을 위한 것인지 · 이전/다음(탭 순서는 그대로 — 처음 쓰는 사람이 따라갈 순서만) */}
      <StepGuide pos={flowPos} onGo={(k) => setTab(k as DetailTab)} />

      {tab === 'smart' && (
        <Suspense fallback={<p className="t-sub text-slate-500">맞춤 추천을 계산하는 중…</p>}>
          <ClientSmartTab
            record={record}
            today={today}
            workspaceId={workspaceId}
            alerts={alerts}
            lastBatch={lastBatch}
            onUpload={openUpload}
            onCommit={async (next, msg) => {
              if (await commit(next)) showToast(msg)
            }}
            userId={userId}
            onCommitQuiet={commit}
            onRequestText={(text, meta) =>
            setMessage({
              title: meta?.title ?? '받을 자료 요청 문구',
              description: meta?.description ?? '아직 판정하지 못한 모듈에 필요한 자료만 골라, 어디서 떼는지와 함께 정리했습니다. 크레탑 보고서처럼 저희가 조회하는 것은 뺐습니다.',
              text,
            })}
            onAlertOpen={(a) => setTab('work', a.serviceKey ?? undefined)}
            onFill={() => {
              setTab('overview')
              setInfoOpen(true)
              // D-237 비어 있는 첫 칸(주소 → 업종 → 설립일 → 직원 수)으로 바로 — 예전에는 업체 정보 제목까지만 내려가 어느 칸인지 찾아야 했다
              const empty = (['businessAddress', 'businessCategory', 'establishedAt', 'employeeCount'] as const).find((k) => !(k === 'businessCategory' ? `${record.businessCategory}${record.businessItem}${record.industry}` : record[k]).trim())
              window.setTimeout(() => {
                const input = empty ? document.querySelector<HTMLInputElement>(`section[aria-labelledby="info"] input[data-field="${empty}"]`) : null
                if (!input) return document.getElementById('info')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                input.scrollIntoView({ behavior: 'smooth', block: 'center' })
                input.focus({ preventScroll: true })
              }, 80)
            }}
          />
        </Suspense>
      )}

      {tab === 'overview' && (
        <>
      {/*
        D-190: 맨 위는 '이 업체에 먼저 제안할 것' — 대표 지시(고도화 목표 2) "서류가 다 들어오면 모듈 추천이 먼저, 눈에 잘 띄게".
        좋은 판정 3개만 크게, 누르면 그 모듈. 모든 판정은 맞춤 추천 탭에.
      */}
      <Suspense fallback={null}>
        <ClientTopPicks
          record={record}
          today={today}
          workspaceId={workspaceId}
          onUpload={openUpload}
          onCommitQuiet={commit}
          onRequestText={(text, meta) =>
          setMessage({
            title: meta?.title ?? '받을 자료 요청 문구',
            description: meta?.description ?? '아직 판정하지 못한 모듈에 필요한 자료만 골라, 어디서 떼는지와 함께 정리했습니다. 크레탑 보고서처럼 저희가 조회하는 것은 뺐습니다.',
            text,
          })}
          onShowAll={() => {
            openFold('smart.verdicts')
            setTab('smart')
            window.setTimeout(() => document.getElementById('module-verdicts')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350)
          }}
        />
      </Suspense>
      {/*
        D-144: 그다음 회사 정보 — 업체를 여는 이유의 절반은 "사업자번호가 뭐였지 · 설립이 몇 년도지" 다.
        지금 챙길 것 · 맞는 지원사업 · 확인할 정보는 '맞춤 추천' 탭으로 옮겼다(여기는 한 줄로 알려만 준다).
      */}
      <FoldAllButton className="-my-2 self-end" />
      {/* D-192: 카드마다 접는 목차 — 제목 줄(▸ · 숫자 · 한 줄 요약)만 보이고, 마우스를 올리면 무슨 칸인지. 회사 정보만 펼친 채로 */}
      <div data-testid="overview-company" className="flex flex-col gap-3">
        {/* D-357 화면 원칙 — 첫 화면은 단순하게: 접힌 채로도 사업자번호 · 대표 · 설립은 한 줄로(펼친 것은 기억) */}
        <Fold
          panel
          id="overview.company"
          title="회사 기본 정보"
          testId="fold-company"
          summary={[record.businessNumber && `사업자 ${record.businessNumber}`, record.representativeName && `대표 ${record.representativeName}`, record.establishedAt && `설립 ${record.establishedAt}`].filter(Boolean).join(' · ') || '아직 적은 정보가 없어요 — 누르면 채우는 칸'}
        >
          <CompanyProfileCard
            record={record}
            today={today}
            onImport={() => setImportOpen(true)}
            factNote={(key) => factNoteFor(record, key)}
            onEdit={(key, value) => void commit(withProfileFieldEdit(record, key, value, nowIso()))}
            onCustomField={(field) => void commit(withCustomField(record, field))}
            onRemoveCustomField={(id) => void commit(withoutCustomField(record, id))}
            // D-309 직접 만든 '사업자등록번호' 칸 → 비어 있는 기본 칸으로 한 번에(지우기 + 넣기를 한 번 저장)
            onMoveCustomField={(id, key) => {
              const c = record.customFields.find((x) => x.id === id)
              if (c) void commit(withProfileFieldEdit(withoutCustomField(record, id), key, c.value.trim(), nowIso()))
            }}
            bare
            hideTitle
          />
        </Fold>
        {/* D-128: 업체 칸이 없던 사실(매출 · 영업이익 · 인증 …) — 출처와 확인 상태가 한 줄로 */}
        <Fold
          panel
          id="overview.numbers"
          title="숫자 · 인증"
          testId="fold-numbers"
          count={factCount.filled}
          countTone={factCount.toConfirm > 0 ? 'warning' : 'neutral'}
          summary={factCount.toConfirm > 0 ? `확인할 숫자 ${factCount.toConfirm}개` : undefined}
        >
          <FactNumbersCard record={record} now={nowIso()} hideTitle onCommit={async (next, msg) => { if (await commit(next)) showToast(msg) }} />
        </Fold>
      </div>

      {(pendingFacts(record).length > 0 || alerts.length > 0) && (
        <button
          type="button"
          onClick={() => setTab('smart')}
          data-testid="overview-smart-link"
          className="tap t-sub flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-control) border border-slate-200 bg-white px-4 py-3 text-left font-medium text-brand-800 hover:bg-brand-100/60"
        >
          <span className="font-bold">맞춤 추천</span>
          {pendingFacts(record).length > 0 && <span>확인할 정보 {pendingFacts(record).length}건</span>}
          {alerts.length > 0 && <span>지금 챙길 것 {alerts.length}건</span>}
          <span className="ml-auto inline-flex items-center gap-1 font-semibold">
            보기 <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        </button>
      )}

      {/*
        개요는 세 단계로만 말한다.
          1단계  지금 할 일
          2단계  막힘·돈·고객 연결
          3단계  나머지는 접어 둔다
      */}

      {/* 1단계 — 지금 할 일 */}
      <Surface showEdge edge={nextActionTone} className="!p-0">
        <div className="px-4 py-4 sm:px-5">
          {/* D-126: '지금 할 일 → 다음 약속 → 할 일 적기' 세 겹이던 것을 '다음 약속' 하나로 */}
          <p className="t-meta font-semibold tracking-wide text-slate-500 uppercase">다음 약속</p>
          {/* D-120: 여기서 바로 고친다(예전에는 고칠 곳이 없었다). 적은 날짜는 일정 · 오늘 화면에 뜬다 */}
          <div className="mt-1.5">
            <NextStepEditor
              record={record}
              today={today}
              hideLabel
              label="다음 약속"
              onSave={async (n, msg) => {
                const ok = await commit(n)
                if (ok) showToast(msg)
                return ok
              }}
            />
          </div>
        </div>
        {startedServices.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
            <p className="t-meta font-semibold text-slate-500">진행 중인 업무</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {startedServices.map((m) => (
                <li key={m.key}>
                  <button
                    type="button"
                    onClick={() => setTab('work', m.key)}
                    // D-129: 현황 카드와 같은 상태 조각(글자 + 바탕색)
                    data-chip-status={record.services[m.key].status}
                    className={`tap t-meta inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 font-medium hover:border-brand-500 ${SERVICE_STATUS_LOOK[record.services[m.key].status]}`}
                  >
                    <span className="font-semibold">{m.shortLabel}</span> {SERVICE_STATUS_LABEL[record.services[m.key].status]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Surface>

      {/*
        통화 중에 적는 자리.
        상담하다 "그럼 다음 주에 서류 주세요" 가 나오면 그 자리에서 적어야 한다.
        일기 화면으로 옮겨 가면 십중팔구 안 적는다. 이 업체가 자동으로 붙는다.
      */}
      {/* D-126: 늘 열려 있던 두 번째 입력 칸을 접는다 — 필요할 때만 '내 할 일에도 넣기' */}
      {!todoOpen ? (
        <button
          type="button"
          data-testid="client-todo-open"
          onClick={() => setTodoOpen(true)}
          className="tap t-sub inline-flex w-fit items-center gap-1.5 self-start rounded-(--radius-control) border border-dashed border-slate-300 bg-white px-3.5 py-2 font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700"
        >
          <Plus aria-hidden="true" className="size-4" />
          오늘 내 할 일에도 넣기
        </button>
      ) : (
      <TodoComposer
        date={today}
        clients={[]}
        compact
        onAdd={(draft) =>
          createJournalEntry(workspaceId, userId, {
            entryDate: today,
            entryType: 'follow_up',
            content: draft.content,
            clientId: record.id,
            dueDate: draft.dueDate,
          })
            .then(() => {
              showToast('오늘 할 일에 넣었습니다.')
              return true
            })
            .catch((cause: unknown) => {
              showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
              return false
            })
        }
      />
      )}

      {/*
        2단계 — 계약과 해 드린 일.
        "이 회사 언제 계약했지, 얼마짜리였지, 우리가 뭘 해 줬더라" 는 상담 중에
        가장 자주 나오는 질문이다. 접어 두면 매번 카톡을 뒤지게 된다.
      */}
      {/* D-114: 영업 — 잠재고객이면 펼쳐서, 계약 고객이면 접어서 */}
      {/* D-119: 영업 흐름 — 1차 준비 → 1·2·3차 → 계약 → 계약 뒤 추가 제안, 걸음마다 할 일 · 작업실 도구 */}
      {/* D-167: 숨김(대표: 영업 흐름은 오히려 헷갈린다) — config/salesSimple 에서 다시 켤 수 있다 */}
      {SALES_SIMPLE.showJourney && <SalesJourneyCard record={record} today={today} compact foldable onPathChange={(path) => void commit(withSalesPath(record, path))} />}

      <ClientSalesCard record={record} onSave={(next) => void commit(next)} onContract={openClose} />

      {/* D-124: 계약 전(잠재고객)이고 적힌 계약 정보도 없으면 빈 계약 카드를 띄우지 않는다 — 계약은 영업 카드의 '계약 완료' 에서 */}
      {(!isProspect(record) || hasContractInfo(record)) && (
        <Fold panel id="overview.contract" title="계약" testId="fold-contract" summary={contractLine || '아직 적은 계약 정보가 없습니다'}>
          <ContractCard record={record} today={today} hideTitle onSave={(next) => commit(withContract(record, next))} onPlan={() => setPlanOpen(true)} />
        </Fold>
      )}
      {planOpen && <ContractPlanSheet record={record} today={today} onSave={commit} onClose={() => setPlanOpen(false)} />}

      <Fold panel id="overview.history" title="해 드린 일" testId="fold-history" count={doneWorks(record).length} countTone="brand">
        <WorkHistoryCard record={record} hideTitle onOpen={(key) => setTab('work', key)} />
      </Fold>

      {/* 도구함에서 붙인 결과 — 창업감면 판정·크레탑 분석·정책자금 진단 … (D-88) */}
      <ToolResultsCard record={record} fold={{ id: 'overview.results', panel: true }} onChange={(next) => void commit(next)} />

      {/* 이 업체로 도구 열기 — 결과가 다시 여기로 돌아온다 (D-89). 없는 서류는 여기서 빨갛게 (D-90) */}
      <ClientToolsCard record={record} today={today} fold={{ id: 'overview.tools', panel: true }} onOpenDocs={() => setTab('docs')} />

      {/* D-135: 이 업체와 이어진 AX 스튜디오 프로젝트 */}
      <AxProjectsCard record={record} fold={{ id: 'overview.ax', panel: true }} />

      {/* 3단계 — 나머지는 접어 둔다 */}
      <Disclosure
        title="진행 요약"
        hint={`업무 ${progress.servicesDone}/${progress.servicesTotal} · 서류 ${progress.documentsUsable}/${progress.documentsTotal}`}
      >
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <MetricTile
            label="완료한 업무"
            value={`${progress.servicesDone}/${progress.servicesTotal}`}
            tone={progress.servicesDone === progress.servicesTotal ? 'success' : 'neutral'}
          />
          <MetricTile
            label="확보한 서류"
            value={`${progress.documentsUsable}/${progress.documentsTotal}`}
            tone={progress.documentsUsable < progress.documentsTotal ? 'warning' : 'success'}
          />
          <MetricTile label="받은 내 돈" value={krwTile(paidAmount)} />
        </div>
      </Disclosure>

      <Disclosure title="활동 기록" hint={`${record.activity.length}건`}>
        <ActivityLog entries={record.activity} bare />
      </Disclosure>
        </>
      )}

      {tab === 'work' && (
      <section aria-labelledby="svc" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <HintTip tip={hintFor('진행 업무')} label="진행 업무">
            <h2 id="svc" className="t-section text-slate-900">
              진행 업무
            </h2>
          </HintTip>
          <button
            type="button"
            onClick={() => setCatalogOpen(true)}
            className="tap t-sub flex items-center gap-1 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 font-medium text-slate-600 hover:bg-slate-50"
          >
            <Plus aria-hidden="true" className="size-4" />
            업무 항목 추가
          </button>
        </div>
        {/*
          업무 카드를 넓은 화면에서는 2열로 놓는다.
          한 카드에 들어가는 것은 제목 한 줄 + 다음 할 일 한 줄 + 상태 칸이 전부라
          1600px 폭을 가로로 다 쓰면 글자 사이가 텅 비어 오히려 읽기 어렵다.
          펼친 카드는 내용이 길어지므로 두 열을 다 쓰게 한다(아래 col-span).
        */}
        {/* D-188: 팀장 화면은 기본 6종이 없다 — 처음에는 상품표에서 골라 넣게 안내 */}
        {SERVICES.length === 0 && (
          <div data-testid="work-empty" className="flex flex-col items-start gap-3 rounded-(--radius-panel) border border-dashed border-slate-300 bg-slate-50/60 px-5 py-5">
            <p className="text-[1rem] font-semibold break-keep text-slate-800">아직 업무 항목이 없습니다</p>
            <p className="t-sub break-keep text-slate-600">
              [업무 항목 추가]를 누르면 상품표 40가지(기업부설연구소 설립 · 정책자금 컨설팅 · 가업승계 사전점검 …)에서 골라 바로 넣을 수 있어요.
            </p>
            <Button variant="primary" onClick={() => setCatalogOpen(true)} data-testid="work-empty-add">
              <Plus aria-hidden="true" className="size-4" />
              업무 항목 추가
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2 xl:items-start">
          {SERVICES.map((meta) => {
            const state = record.services[meta.key]
            const missing = missingDocumentsFor(record, meta.key, today)
            const started = isServiceStarted(state.status)
            const blocked = started && missing.length > 0
            const open = isServiceOpen(state.status)
            const dLeft = state.dueDate ? daysLeftFrom(today, state.dueDate) : null
            const overdue = open && dLeft !== null && dLeft < 0
            const dueSoon = open && dLeft !== null && dLeft >= 0 && dLeft <= 7
            // 자동으로 펼치는 것은 딱 하나 — 가장 급한 업무(또는 눌러서 들어온 업무).
            // 급한 것이 셋이면 셋 다 펼치는 대신 맨 위 하나만 펼친다.
            const auto = meta.key === focusedService || meta.key === firstUrgentKey
            const expanded = cardOpen(meta.key, auto)

            return (
              <div
                key={meta.key}
                id={meta.key}
                ref={meta.key === focusedService ? focusedCardRef : undefined}
                className={`relative overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white ${
                  meta.key === focusedService ? 'ring-2 ring-brand-400 ring-offset-2' : ''
                } ${expanded ? 'xl:col-span-2' : ''}`}
              >
                {/* 급한 카드도 배경을 칠하지 않는다 — 왼쪽 3px 선으로만 말한다.
                    서류가 없는 것은 급한 것이 아니라 '아직 안 받은 것' 이라 여기서 뺐다 */}
                {(overdue || dueSoon) && (
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-[3px] ${overdue ? 'bg-danger-500' : 'bg-warning-500'}`}
                  />
                )}
                {/*
                  머리 부분은 두 줄이다.
                    1줄 — 펼치기 단추: 점 · 이름 · 급한 배지
                    2줄 — 다음 할 일(왼쪽) · 상태 고르는 칸(오른쪽)
                  예전에는 한 줄에 다 넣었는데, 상태 칸의 한글 문구가 자리를 다 먹어
                  360px 에서 이름이 60px 로 눌리고 글자가 세로로 흘렀다.
                  또 "완료" 를 요약과 상태 칸이 나란히 두 번 말하던 것도 없앴다.
                */}
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 py-3">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggleCard(meta.key, auto)}
                    className="flex w-full min-w-0 items-center gap-2 text-left sm:w-auto sm:flex-1"
                  >
                    <ChevronDown
                      aria-hidden="true"
                      className={`size-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                      <Dot tone={statusTone(state.status)} />
                      <span
                        className={`t-card break-keep ${
                          state.status === 'not_applicable'
                            ? 'text-slate-400 line-through decoration-slate-300'
                            : 'text-slate-900'
                        }`}
                      >
                        {meta.label}
                      </span>
                      {/* 서류는 경고가 아니라 상태다 — 회색으로 조용히 */}
                      {blocked && (
                        <Badge tone="neutral">
                          <Lock aria-hidden="true" className="size-3" />
                          서류 {missing.length}
                        </Badge>
                      )}
                      {open && dLeft !== null && (dLeft < 0 || dLeft <= 7) && (
                        <Badge tone={dLeft < 0 ? 'danger' : 'warning'}>{dueText(dLeft)}</Badge>
                      )}
                    </span>
                  </button>

                  {/* 다음 할 일은 제목 아래에 붙이고, 상태 칸은 넓은 화면에서 제목 옆으로 간다 */}
                  {(state.nextStep || meta.recurring) && (
                    <p className="t-sub w-full min-w-0 truncate pl-6 text-slate-500 sm:order-3 sm:pl-6">
                      {state.nextStep ? `다음: ${state.nextStep}` : ''}
                      {state.nextStep && meta.recurring ? ' · ' : ''}
                      {meta.recurring ? '반복' : ''}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pl-6 sm:pl-0">
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
                </div>

                {expanded && (
                  <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3.5">
                    <p className="text-[0.92rem] break-keep text-slate-500">{meta.description}</p>

                    {/* 서류는 경고가 아니라 상태다 — 빨간 판이 아니라 회색 판으로 알린다 */}
                    {blocked && (
                      <div className="rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="flex items-start gap-1.5 text-[0.95rem] font-semibold break-keep text-slate-700">
                          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                          아직 안 받은 서류
                        </p>
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {missing.map((m) => (
                            <li
                              key={m.key}
                              className="rounded-full border border-danger-200 bg-white px-2 py-0.5 text-[0.875rem] font-medium text-danger-700"
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
                      <span className="text-[0.875rem] text-slate-500">필요 서류</span>
                      {meta.requiredDocuments.map((k) => {
                        const v = documentStatus(k, record.documents[k], today)
                        return (
                          <span
                            key={k}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.875rem] font-medium ${
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
                      {/* D-129: 서류가 아니라 회사 기본 정보로 있어야 하는 것 — 값이 있으면 됨 */}
                      {(meta.requiredFacts ?? []).map((k) => {
                        const f = readFact(record, k)
                        const ok = !!f && f.status !== 'missing'
                        return (
                          <span
                            key={`fact-${k}`}
                            data-required-fact={k}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.875rem] font-medium ${ok ? 'border-success-200 bg-success-50 text-success-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
                          >
                            {ok ? <Check aria-hidden="true" className="size-3" /> : <span aria-hidden="true" className="text-[0.9em]">○</span>}
                            회사 정보 · {f?.label ?? k}
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
          {/* D-192: '발급일을 넣으면 유효기간…' 설명은 목차 설명(ⓘ)으로 */}
          <HintTip tip={hintFor('서류함')} label="서류함">
            <h2 id="docs" className="text-[1.3rem] font-bold text-slate-900">
              서류함
            </h2>
          </HintTip>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setBulkOpen(true); setBulkShow((n) => n + 1) }}>
              <FileUp aria-hidden="true" className="size-3.5" />
              한꺼번에 올리기
            </Button>
            {/* D-146: 예전 판별로 엉뚱한 칸에 들어간 파일을 제목으로 다시 가른다 */}
            {allDocumentMetas(record).some((m) => m.needsFile && record.documents[m.key]?.fileName) && (
              <Button variant="secondary" size="sm" data-testid="doc-resort" onClick={() => setResortOpen(true)}>
                <ArrowRightLeft aria-hidden="true" className="size-3.5" />
                서류 다시 분류
              </Button>
            )}
          </div>
        </div>

        {resortOpen && (
          <DocResortSheet
            record={record}
            onClose={() => setResortOpen(false)}
            onApply={(next, moved) => {
              setResortOpen(false)
              void commit(next).then((ok) => {
                if (ok) showToast(`서류 ${moved}개를 맞는 칸으로 옮겼습니다.`)
              })
            }}
          />
        )}

        {!uploadable && (
          <p className="rounded-(--radius-control) border border-slate-200 bg-slate-50 px-4 py-3 text-[0.92rem] break-keep text-slate-600">
            이 브라우저에만 저장 중 — 받음 · 발급일은 기록되고, 파일 첨부는 클라우드 연결 뒤에 켜집니다.
          </p>
        )}

        {/* D-147: 손볼 것만 한 줄 — 누르면 그 칸으로 */}
        <DocShelfBar
          summary={docShelfSummary(record, today, urgentDocs)}
          onJump={(key) => {
            setOpenDocs((cur) => new Set(cur).add(key))
            requestAnimationFrame(() => {
              const el = document.getElementById(`doc-card-${key}`)
              el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
              el?.focus({ preventScroll: true })
            })
          }}
        />

        {/* D-204: 보기 방식 — 목차(서류 칸)와 폴더(올린 그대로)를 같이 쓴다 */}
        <div role="group" aria-label="서류함 보기" className="flex flex-wrap items-center gap-2" data-testid="doc-view-switch">
          {(
            [
              ['list', '목차로 보기', ListTree],
              ['folder', '폴더로 보기', FolderOpen],
            ] as const
          ).map(([v, name, Icon]) => (
            <button
              key={v}
              type="button"
              aria-pressed={docView === v}
              onClick={() => changeDocView(v)}
              data-testid={`doc-view-${v}`}
              className={`tap t-body flex min-h-11 items-center gap-2 rounded-full border px-4 font-semibold ${docView === v ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}
            >
              <Icon aria-hidden="true" className="size-4" />
              {name}
            </button>
          ))}
        </div>

        {docView === 'folder' ? (
          <DocFolderView
            record={record}
            cloud={uploadable}
            onMove={(next, to) => {
              void commit(next).then((ok) => {
                if (ok) showToast(`'${to}' 칸으로 옮겼습니다.`)
              })
            }}
            onShowInList={(key) => {
              changeDocView('list')
              setOpenDocs((cur) => new Set(cur).add(key))
              window.setTimeout(() => {
                const el = document.getElementById(`doc-card-${key}`)
                el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                el?.focus({ preventScroll: true })
              }, 80)
            }}
          />
        ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {docOrder(allDocumentMetas(record), urgentDocs)
            .map((meta) => {
              const state = record.documents[meta.key] ?? emptyDocumentState()
              const view = documentStatus(meta.key, state, today, meta)
              const needed = servicesNeeding(meta.key)
              const urgent = urgentDocs.has(meta.key)
              /* 직접 만든 칸이면 이름을 고치고 없앨 수 있다 (D-82) */
              const custom = record.customDocuments.find((d) => d.key === meta.key)
              // D-122: 받았고(파일이 필요하면 파일까지) 만료 · 곧 만료 · 지금 필요가 아니면 한 줄로 — 서류 탭이 휴대폰에서 3,700px 이었다
              // D-377 받았는데 파일만 없는 칸도 한 줄로(메모 · 설명까지 다 펼쳐 서류 탭이 휴대폰 4.5화면이었다) — 한 줄에 '파일 없음' · [파일 첨부]는 그대로
              const compact = state.received && !view.expired && !view.expiringSoon && !urgent && !openDocs.has(meta.key)
              // 아직 안 받았지만 지금 필요하지 않은 서류 — 설명 줄은 빼고 이름 · 쓰는 도구만
              const later = !state.received && !urgent && !view.expired && !openDocs.has(meta.key)
              return (
                <div
                  key={meta.key}
                  id={`doc-card-${meta.key}`}
                  data-doc-card={meta.key}
                  tabIndex={-1}
                  // D-375 박스 색은 하나로 — 만료 · 지금 필요 · 곧 만료는 칸 안 알약(빨강 · 남은 날)이 말한다(분홍 · 노랑 바탕 없앰)
                  className="flex scroll-mt-24 flex-col gap-2.5 rounded-(--radius-panel) border border-slate-200 bg-white p-4 outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  {meta.needsFile && (
                    <input
                      ref={(el) => {
                        fileInputs.current[meta.key] = el
                      }}
                      type="file"
                      aria-hidden="true"
                      tabIndex={-1}
                      /* 형식을 제한하지 않는다 — 한글(HWP)·워드·엑셀·압축파일도 그대로 올린다.
                         휴대폰에서는 카메라로 찍은 사진도 여기서 바로 선택된다. */
                      className="hidden"
                      data-file-input={meta.key}
                      onChange={(e) => void onPickFile(meta.key, e.target.files?.[0])}
                    />
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <label className="flex min-h-11 min-w-0 items-start gap-2.5 py-1">
                      <input
                        type="checkbox"
                        aria-label={`${meta.label} 받음`}
                        checked={state.received}
                        onChange={(e) => {
                          if (e.target.checked) setOpenDocs((cur) => new Set(cur).add(meta.key))
                          void commit(withDocument(record, meta.key, { received: e.target.checked }))
                        }}
                        className="mt-1 size-5 shrink-0 accent-brand-600"
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {/*
                            아직 안 받은 서류에 작은 빨간 점 하나.
                            경고 목록에 올리지 않는 대신, 업체를 열었을 때 여기서
                            한눈에 보이면 된다 — 서류는 '해야 할 일' 이 아니라 '상태' 다.
                          */}
                          {/* D-122: 점만으로는 뜻을 모른다 — '안 받음' 글자로 */}
                          {!state.received && (
                            <span className="t-meta inline-flex shrink-0 items-center gap-1 rounded-full border border-danger-200 bg-danger-50 px-1.5 py-0.5 font-semibold text-danger-700">
                              <span aria-hidden="true" className="size-1.5 rounded-full bg-danger-500" />
                              안 받음
                            </span>
                          )}
                          <span className="text-[1.05rem] font-bold break-keep text-slate-900">{meta.label}</span>
                          {urgent && (
                            <span className="rounded-full border border-danger-200 bg-danger-100 px-1.5 py-0.5 t-meta font-bold text-danger-700">
                              지금 필요
                            </span>
                          )}
                          {meta.sensitive && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 t-meta font-medium text-slate-500">
                              <ShieldAlert aria-hidden="true" className="size-3" />
                              민감
                            </span>
                          )}
                          {custom && (
                            <span className="rounded-full border border-brand-200 bg-brand-50 px-1.5 py-0.5 t-meta font-medium text-brand-700">
                              직접 만든 칸
                            </span>
                          )}
                        </span>
                        {!compact && !later && <span className="mt-0.5 block text-[0.88rem] break-keep text-slate-500">{meta.hint}</span>}
                      </span>
                    </label>
                    {view.expired && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-danger-200 bg-danger-100 px-2 py-0.5 text-[0.875rem] font-bold text-danger-700">
                        <FileWarning aria-hidden="true" className="size-3.5" />
                        만료됨
                      </span>
                    )}
                    {!view.expired && view.expiringSoon && (
                      <span className="shrink-0 rounded-full border border-warning-200 bg-warning-100 px-2 py-0.5 text-[0.875rem] font-bold text-warning-800">
                        {dueText(view.daysLeft)}
                      </span>
                    )}
                  </div>

                  {compact ? (
                    <div data-doc-compact={meta.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-[1.9rem]">
                      <span className="t-sub font-medium text-success-700">받음</span>
                      {meta.needsFile && !state.fileName && <span className="t-sub text-slate-500" data-testid={`doc-compact-nofile-${meta.key}`}>파일 없음</span>}
                      {view.expiresOn && (
                        <span data-testid={`doc-compact-expiry-${meta.key}`} className="t-sub text-slate-600">
                          {view.expiresOn}까지 유효{state.validUntil ? ' · 서류에 적힌 날짜' : ''}
                        </span>
                      )}
                      {state.fileName && (
                        <span className="t-sub inline-flex min-w-0 items-center gap-1 text-slate-600">
                          <Paperclip aria-hidden="true" className="size-3.5 shrink-0" />
                          <span className="max-w-[12rem] truncate">{state.fileName}</span>
                        </span>
                      )}
                      {/* D-129: 파일이 있으면 여기서 바로 — 미리보기 · 새 창 · 내려받기 · 교체(예전 '파일' 탭이 하던 일) */}
                      {(state.storagePath !== '' || meta.needsFile) && (
                        <DocFileActions
                          label={meta.label}
                          storagePath={state.storagePath}
                          fileName={state.fileName}
                          onReplace={meta.needsFile ? () => fileInputs.current[meta.key]?.click() : undefined}
                        />
                      )}
                      {meta.needsFile && state.fileName && (
                        <InlineConfirm
                          label="파일 지우기"
                          testId={`doc-remove-${meta.key}`}
                          question={custom ? `'${meta.label}' 칸과 파일을 지울까요?` : `'${meta.label}' 파일을 지울까요?`}
                          onConfirm={() => {
                            void commit(withoutDocumentFile(record, meta.key, { withDoc: withDocument, withoutCustom: withoutCustomDocument })).then((ok) => {
                              if (ok) showToast(`${meta.label} 파일을 서류함에서 지웠습니다.`)
                            })
                          }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenDocs((cur) => new Set(cur).add(meta.key))}
                        className="tap t-sub font-semibold text-brand-700 hover:underline"
                      >
                        자세히 · 고치기
                      </button>
                    </div>
                  ) : (
                    <>
                  {state.received && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(meta.validMonths !== null || !!state.validUntil) && (
                        <label className="text-[0.88rem] font-medium text-slate-600">
                          발급일
                          <input
                            type="date"
                            value={state.issuedAt}
                            // D-181: 발급일을 손으로 고치면 서류에서 읽은 유효기간 끝은 지운다(새 서류일 수 있다)
                            onChange={(e) => void commit(withDocument(record, meta.key, { issuedAt: e.target.value, validUntil: undefined }))}
                            className={`mt-1 ${inputCls}`}
                          />
                          <span data-testid={`doc-expiry-${meta.key}`} className="mt-1 block text-[0.875rem] text-slate-500">
                            {state.validUntil && view.expiresOn
                              ? `${view.expiresOn}까지 유효 (서류에 적힌 유효기간)`
                              : view.expiresOn
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
                    <div className="flex flex-col gap-1.5">
                      {state.fileName && (
                        <span className="t-sub inline-flex min-w-0 items-center gap-1 text-slate-600">
                          <Paperclip aria-hidden="true" className="size-3.5 shrink-0" />
                          <span className="truncate">{state.fileName}</span>
                          {state.fileSize > 0 && <span className="shrink-0 text-slate-400">{formatFileSize(state.fileSize)}</span>}
                        </span>
                      )}
                      <span className="flex flex-wrap items-center gap-1.5">
                        <DocFileActions
                          label={meta.label}
                          storagePath={state.storagePath}
                          fileName={state.fileName}
                          onReplace={() => fileInputs.current[meta.key]?.click()}
                        />
                        {state.fileName && (
                          <InlineConfirm
                            label="파일 지우기"
                            testId={`doc-remove-${meta.key}`}
                            question={custom ? `'${meta.label}' 칸과 파일을 지울까요?` : `'${meta.label}' 파일을 지울까요?`}
                            onConfirm={() => {
                              void commit(withoutDocumentFile(record, meta.key, { withDoc: withDocument, withoutCustom: withoutCustomDocument })).then((ok) => {
                                if (ok) showToast(`${meta.label} 파일을 서류함에서 지웠습니다.`)
                              })
                            }}
                          />
                        )}
                      </span>
                      {!uploadable && !state.fileName && (
                        <span className="t-meta break-keep text-slate-500">파일 첨부는 클라우드를 연결하면 켜집니다.</span>
                      )}
                    </div>
                  )}

                  {needed.length > 0 && !later && (
                    <p className="text-[0.875rem] break-keep text-slate-500">
                      필요한 업무: {needed.map((s) => s.shortLabel).join(', ')}
                    </p>
                  )}

                  {/* 이 서류를 쓰는 도구 (D-90) — 올려 두면 그 도구가 바로 돈다 */}
                  {toolsNeeding(meta.key).length > 0 && (
                    <p className="text-[0.875rem] break-keep text-brand-700" data-testid={`doc-tools-${meta.key}`}>
                      <Wrench aria-hidden="true" className="mr-1 inline size-3.5 align-[-2px]" />
                      이 서류를 쓰는 도구: {toolsNeeding(meta.key).map((t) => t.label).join(' · ')}
                    </p>
                  )}

                    </>
                  )}

                  {/* D-147: 기타 칸 — 무슨 서류인지 고르면 맞는 칸으로 */}
                  <DocKindPicker
                    record={record}
                    docKey={meta.key}
                    onMove={(next, to) => {
                      void commit(next).then((ok) => {
                        if (ok) showToast(`'${to}' 칸으로 옮겼습니다.`)
                      })
                    }}
                  />

                  {custom &&
                    (renamingDoc === custom.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          autoFocus
                          aria-label={`${meta.label} 이름 고치기`}
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          className={inputCls}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={renameDraft.trim() === ''}
                          onClick={() => {
                            void commit(withCustomDocument(record, { id: custom.id, label: renameDraft }))
                            setRenamingDoc(null)
                          }}
                        >
                          저장
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRenamingDoc(null)}>
                          취소
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingDoc(custom.id)
                            setRenameDraft(custom.label)
                          }}
                          className="tap t-sub inline-flex items-center font-medium text-slate-500 hover:text-brand-700 hover:underline"
                        >
                          이름 고치기
                        </button>
                        {/* D-122: 칸을 없애기 전에 한 번 묻는다(업체 정보의 직접 만든 칸과 같게) · D-146: 파일이 있으면 '파일 지우기' 하나로 */}
                        {!state.fileName && <InlineConfirm
                          label="칸 없애기"
                          question={`'${custom.label}' 칸을 없앨까요?`}
                          confirmLabel="없애기"
                          onConfirm={() => {
                            void commit(withoutCustomDocument(record, custom.id)).then((ok) => {
                              if (ok) showToast('서류 칸을 없앴습니다. 올린 파일은 아래 ‘칸이 없어진 서류의 파일’ 에 남아 있습니다.')
                            })
                          }}
                        />}
                      </div>
                    ))}
                </div>
              )
            })}
        </div>
        )}

        {/*
          서류 칸 직접 만들기 (D-82).
          기본 10종으로 안 되는 서류가 늘 있다 — 법인인감증명서·국세완납증명서·재무제표.
          만든 칸은 기본 서류와 똑같이 받았는지·발급일·메모·파일을 쓴다.
        */}
        <div className="flex flex-wrap items-end gap-2 rounded-(--radius-panel) border border-dashed border-slate-300 bg-white p-4">
          {/* 휴대폰에서는 이름 칸이 한 줄을 다 쓴다 — 유효기간·단추와 나눠 쓰면 이름 칸이 짜부라진다(화면 규칙 §9) */}
          <label className="w-full text-[0.88rem] font-medium text-slate-600 sm:w-auto sm:max-w-xs sm:flex-1">
            서류 이름
            <input
              aria-label="새 서류 칸 이름"
              value={newDocLabel}
              onChange={(e) => setNewDocLabel(e.target.value)}
              placeholder="예: 법인인감증명서"
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="w-28 text-[0.88rem] font-medium text-slate-600">
            유효기간(개월)
            <input
              aria-label="새 서류 칸 유효기간"
              value={newDocMonths}
              onChange={(e) => setNewDocMonths(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="없음"
              className={`mt-1 ${inputCls}`}
            />
          </label>
          {/* D-192: '기본 서류에 없는 서류를…' 설명은 단추 옆 ⓘ 로 */}
          <HintTip tip="기본 서류에 없는 서류 칸을 만듭니다. 유효기간을 넣으면 발급일 기준으로 만료를 알려 드립니다." label="서류 칸 추가">
          <Button
            variant="secondary"
            disabled={newDocLabel.trim() === ''}
            onClick={() => {
              // D-125: 저장이 된 뒤에만 칸을 비우고 알린다(실패하면 적은 이름이 남는다)
              void commit(
                withCustomDocument(record, {
                  label: newDocLabel,
                  validMonths: newDocMonths === '' ? null : Number(newDocMonths),
                }),
              ).then((ok) => {
                if (!ok) return
                setNewDocLabel('')
                setNewDocMonths('')
                showToast('서류 칸을 만들었습니다.')
              })
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            서류 칸 추가
          </Button>
          </HintTip>
        </div>

        {/* D-129: 예전 '파일' 탭 — 고객과 주고받은 파일 · 칸이 없어진 서류의 파일도 서류 탭 아래에서 */}
        <ClientSharedFiles record={record} workspaceId={workspaceId} onCommit={commit} latest={() => current() ?? record} />
      </section>

      )}

      {tab === 'funding' && (
        <FundingSection
          record={record}
          today={today}
          onAdd={(input) => commit(withNewFunding(record, input))}
          onChange={(id, patch) => void commit(withFunding(record, id, patch))}
          onRemove={(id) => void commit(withoutFunding(record, id))}
          onToggleDoc={(id, label, done) => void commit(withApplyDocDone(current() ?? record, id, label, done))}
          docsHref={`/ops/clients/${record.id}?tab=docs`}
          onUpdate={(change, message) => void commit(change(current() ?? record)).then((ok) => ok && showToast(message))}
          feesHref={`/ops/clients/${record.id}?tab=fees`}
          portal={portalReq}
        />
      )}

      {tab === 'consulting' && <ClientConsultingTab record={record} workspaceId={workspaceId} />}

      {tab === 'fees' && <FeesPanel record={record} onChange={commit} today={today} />}

      {tab === 'ai' && (
        <Suspense fallback={<p className="t-sub text-slate-500">AI 전략실을 여는 중…</p>}>
          <ClientAiTab record={record} />
        </Suspense>
      )}

      {tab === 'portal' && <PortalTab record={record} workspaceId={workspaceId} onRecordChange={commit} latest={() => current() ?? record} />}

      {tab === 'journal' && (
        <>
          <ClientJournalTab record={record} workspaceId={workspaceId} userId={userId} />
          <NotesSection
            record={record}
            allowAdd={false}
            onAdd={(text) => commit(withNewNote(record, text))}
            onEdit={(id, text) => commit(withNoteText(record, id, text))}
            onPin={(id, pinned) => commit(withNotePinned(record, id, pinned))}
            onDelete={(id) => commit(withoutNote(record, id))}
          />
        </>
      )}

      <StepNext pos={flowPos} onGo={(k) => setTab(k as DetailTab)} />


      {reportOpen && (
        <ClientReportSheet
          record={record}
          today={today}
          initialPeriod={reportPeriodParam}
          onClose={() => {
            setReportOpen(false)
            if (searchParams.has('report')) {
              const next = new URLSearchParams(searchParams)
              next.delete('report')
              next.delete('period')
              setSearchParams(next, { replace: true, state: location.state })
            }
          }}
        />
      )}

      {moreOpen && (
        <BottomSheet title="이 업체에서 할 수 있는 것" onClose={() => setMoreOpen(false)}>
          <div className="flex flex-col gap-4">

            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                className="w-full justify-start sm:hidden"
                data-testid="more-doc-request"
                onClick={() => {
                  setMoreOpen(false)
                  setMessage({
                    title: '서류 요청 문구',
                    description: '지금 진행 중인 업무에 필요한데 아직 없는 서류만 골라 정리했습니다.',
                    text: buildDocumentRequestMessage(record, today),
                  })
                }}
              >
                <Send aria-hidden="true" className="size-4" />
                서류 요청 문구
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start sm:hidden"
                onClick={() => {
                  setMoreOpen(false)
                  setMessage({
                    title: '진행 상황 보고 문구',
                    description: '업무별 현재 상태와 다음 단계를 정리했습니다.',
                    text: buildStatusReportMessage(record, today),
                  })
                }}
              >
                <ClipboardCopy aria-hidden="true" className="size-4" />
                진행 상황 보고 문구
              </Button>
              {/* D-154: 고객 미팅 · 재계약 때 드리는 '함께 만든 성과' 한 장 */}
              <Button
                variant="secondary"
                className="w-full justify-start"
                data-testid="more-report"
                onClick={() => {
                  setMoreOpen(false)
                  setReportOpen(true)
                }}
              >
                <FileText aria-hidden="true" className="size-4" />
                성과 보고서 한 장(인쇄 · PDF)
              </Button>
              {/* D-157: 업체 홈 더보기에서도 서류 한꺼번에 올리기(대표 요청) */}
              <Button
                variant="secondary"
                className="w-full justify-start"
                data-testid="more-upload"
                onClick={() => {
                  setMoreOpen(false)
                  openUpload()
                }}
              >
                <FileUp aria-hidden="true" className="size-4" />
                서류 한꺼번에 올리기(파일 · 폴더)
              </Button>
              {/* D-129: 기본 탭 줄에서 뺀 두 영역 — 기능과 기록은 그대로, 여기서 연다 */}
              {!pilot && (
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="more-consulting"
                  onClick={() => {
                    setMoreOpen(false)
                    setTab('consulting')
                  }}
                >
                  <Workflow aria-hidden="true" className="size-4" />
                  컨설팅 프로젝트(특허·MVP) 보기
                </Button>
              )}
              {!pilot && ownerAi !== 'no' && (
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="more-ai"
                  onClick={() => {
                    setMoreOpen(false)
                    setTab('ai')
                  }}
                >
                  <Sparkles aria-hidden="true" className="size-4" />
                  AI 전략실(대표 전용)
                </Button>
              )}
              <Button
                variant="secondary"
                className="w-full justify-start"
                data-testid="more-funding"
                onClick={() => {
                  setMoreOpen(false)
                  setTab('funding')
                }}
              >
                <Landmark aria-hidden="true" className="size-4" />
                자금 · 지원사업 보기{record.fundingApplications.length > 0 ? ` (${record.fundingApplications.length}건)` : ''}
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() => {
                  setMoreOpen(false)
                  setImportOpen(true)
                }}
              >
                <Upload aria-hidden="true" className="size-4" />
                서류에서 회사 정보 불러오기
              </Button>
              {/* D-181: 고객 종류 옮기기 — 대표만(팀장 화면에는 없다). 기록은 그대로, 고객 관리에서 보이는 쪽만 바뀐다 */}
              {!pilot && (
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="more-client-type"
                  onClick={() => {
                    const to = clientTypeOf(record) === 'consultant' ? 'sme' : 'consultant'
                    const next = withActivity(withClientType(record, to), 'profile', `고객 종류 → ${CLIENT_TYPE_LABEL[to]}`)
                    setMoreOpen(false)
                    void commit(next).then((ok) => {
                      if (!ok) return
                      // 고객 관리로 돌아가면 옮긴 쪽이 보이게
                      rememberClientTypeView(to)
                      showToast(`${CLIENT_TYPE_LABEL[to]}으로 옮겼습니다. 고객 관리 › ${CLIENT_TYPE_LABEL[to]}에서 봅니다.`)
                    })
                  }}
                >
                  {clientTypeOf(record) === 'consultant' ? <Building2 aria-hidden="true" className="size-4" /> : <BriefcaseBusiness aria-hidden="true" className="size-4" />}
                  {clientTypeOf(record) === 'consultant' ? '중소기업 고객으로 되돌리기' : '컨설턴트 고객으로 옮기기'}
                </Button>
              )}
              {/* D-220: 임시등록 표시 지우기 — 기록은 그대로, 보통 고객 기록이 된다 */}
              {record.provisional && (
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="more-clear-provisional"
                  onClick={() => {
                    const next = withActivity(withoutProvisional(record), 'profile', '임시등록 표시 지움 — 정식 고객 기록으로')
                    setMoreOpen(false)
                    void commit(next).then((ok) => ok && showToast('임시등록 표시를 지웠어요. 이제 보통 고객 기록이에요.'))
                  }}
                >
                  <FlaskConical aria-hidden="true" className="size-4" />
                  임시등록 표시 지우기(정식으로)
                </Button>
              )}
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() => {
                  const next = withArchived(record, record.archivedAt === null)
                  setMoreOpen(false)
                  // D-120: 저장이 된 뒤에 알린다(실패하면 commit 이 따로 알린다)
                  void commit(next).then((ok) => {
                    if (ok) showToast(next.archivedAt ? '보관 처리했습니다. 목록·경고에서 빠집니다.' : '보관을 해제했습니다.')
                  })
                }}
              >
                <Archive aria-hidden="true" className="size-4" />
                {record.archivedAt ? '보관 해제' : '보관하기'}
              </Button>
              <Button
                variant="danger"
                className="w-full justify-start"
                onClick={() => {
                  setMoreOpen(false)
                  setDeleteStep(1)
                }}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                업체 삭제
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/*
        업체 삭제 — 두 번 묻는다.
        1) 무엇이 함께 사라지는지 숫자로 보여 준다.
        2) '영구 삭제를 확인했습니다' 체크를 해야 단추가 눌린다 — D-129: 예전엔 이름을 다시 적게 했는데 휴대폰 키보드에서 불편했다.
        되돌릴 수 없으므로 지우기 전에 백업을 권한다.
      */}
      {deleteStep > 0 && (
        <Modal
          open
          title={deleteStep === 1 ? '이 업체를 삭제할까요?' : '정말 지웁니다 — 마지막 확인'}
          onClose={() => {
            setDeleteStep(0)
            setDeleteChecked(false)
          }}
        >
          {deleteStep === 1 ? (
            <>
              <p className="t-body break-keep text-slate-800">
                <strong className="font-semibold">{record.companyName || '(이름 없음)'}</strong> 와(과) 함께 아래가 모두
                사라집니다. <strong className="font-semibold text-danger-700">되돌릴 수 없습니다.</strong>
              </p>
              <ul className="t-sub mt-3 flex flex-col gap-1 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
                <li>업무 {SERVICES.length}개의 진행 상태·마감·메모</li>
                <li>서류 {progress.documentsUsable}/{progress.documentsTotal}건의 기록{canUploadFiles() ? ' (첨부 파일 포함)' : ''}</li>
                <li>수금 {record.fees.length}건 · 자금 신청 {record.fundingApplications.length}건</li>
                <li>메모 {record.notes_list.length}건 · 활동 기록 {record.activity.length}건</li>
              </ul>
              <p className="t-sub mt-3 break-keep text-slate-600">
                지우는 대신 <strong className="font-semibold">보관하기</strong>를 쓰면 목록·경고에서만 빠지고 기록은
                남습니다. 정말 지워야 한다면 먼저 백업(더보기 → 백업 내려받기)을 받아 두세요.
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setDeleteStep(0)}>
                  취소
                </Button>
                {/* 지우기보다 보관이 먼저다 — 목록 · 경고에서만 빠지고 기록은 남는다 */}
                {record.archivedAt === null && (
                  <Button
                    variant="primary"
                    data-testid="delete-archive-instead"
                    onClick={() => {
                      setDeleteStep(0)
                      void commit(withArchived(record, true)).then((ok) => {
                        if (ok) showToast('보관 처리했습니다. 목록 · 경고에서 빠지고 기록은 남습니다.')
                      })
                    }}
                  >
                    <Archive aria-hidden="true" className="size-4" />
                    대신 보관하기
                  </Button>
                )}
                <Button variant="danger" onClick={() => setDeleteStep(2)}>
                  네, 다음으로
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="t-body break-keep text-slate-800">
                마지막으로 확인합니다. 지우면 <strong className="font-semibold text-danger-700">되돌릴 수 없습니다.</strong>
              </p>
              <label className="tap mt-3 flex cursor-pointer items-start gap-3 rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 accent-danger-600"
                  checked={deleteChecked}
                  onChange={(e) => setDeleteChecked(e.target.checked)}
                  data-testid="delete-confirm-check"
                />
                <span className="t-body break-keep text-slate-800">
                  <strong className="font-semibold">{record.companyName || '(이름 없음)'}</strong> 업체를 영구 삭제하는 것을 확인했습니다.
                </span>
              </label>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => { setDeleteStep(1); setDeleteChecked(false) }}>
                  뒤로
                </Button>
                <Button
                  variant="danger"
                  disabled={deleting || !deleteChecked}
                  onClick={() => {
                    setDeleting(true)
                    void deleteClient(record)
                      .then(() => {
                        showToast(`${josa(record.companyName, '을/를')} 삭제했습니다.`)
                        navigate('/ops/clients')
                      })
                      .catch((cause: unknown) => {
                        showToast(cause instanceof Error ? cause.message : '삭제하지 못했습니다.')
                        setDeleting(false)
                      })
                  }}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  {deleting ? '지우는 중…' : '이 업체 영구 삭제'}
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}

      {catalogOpen && (
        <ServiceCatalogModal
          workspaceId={workspaceId}
          onClose={() => setCatalogOpen(false)}
          onChanged={() => void load(true)}
        />
      )}

      {/* 업체 정보 — 개요 아래에 접어 둔다 */}
      {tab === 'overview' && (
      <section aria-labelledby="info" className="flex flex-col gap-3">
        {/* D-192: 목차에 마우스를 올리면 무슨 칸인지 */}
        <HintTip tip={hintFor('업체 정보 수정')} label="업체 정보 수정">
          <h2 id="info" className="t-section text-slate-900">
            <button
              type="button"
              onClick={() => setInfoOpen((v) => !v)}
              aria-expanded={infoOpen}
              className="tap inline-flex min-h-11 items-center gap-1.5"
            >
              <ChevronRight
                aria-hidden="true"
                className={`size-5 text-slate-400 transition-transform duration-200 ${infoOpen ? 'rotate-90' : ''}`}
              />
              업체 정보 수정
            </button>
          </h2>
        </HintTip>
        {/* 펼쳤을 때만 그린다 — 늘 펼쳐 두면 개요 화면이 입력폼으로 뒤덮인다 */}
        {infoOpen && (
        <Panel>
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            <TextField label="업체명" value={record.companyName} onChange={(v) => void commit(withProfileFieldTyped(record, 'companyName', v, nowIso()))} />
            <TextField label="설립일(개업일)" field="establishedAt" value={record.establishedAt} onChange={(v) => void commit(withProfileFieldTyped(record, 'establishedAt', v, nowIso()))} placeholder="2019-03-05" />
            <TextField label="사업자등록번호" value={record.businessNumber} onChange={(v) => void commit(withProfileFieldTyped(record, 'businessNumber', v, nowIso()))} placeholder="000-00-00000" />
            <TextField label="법인등록번호" value={record.corporateNumber} onChange={(v) => void commit(withProfileFieldTyped(record, 'corporateNumber', v, nowIso()))} />
            <TextField label="업태" field="businessCategory" value={record.businessCategory} onChange={(v) => void commit(withProfileFieldTyped(record, 'businessCategory', v, nowIso()))} placeholder="예: 제조업" />
            <TextField label="종목" value={record.businessItem} onChange={(v) => void commit(withProfileFieldTyped(record, 'businessItem', v, nowIso()))} placeholder="예: 간판 및 광고물 제조업" />
            <TextField label="종목(그 외)" value={record.businessItemsExtra} onChange={(v) => void commit({ ...record, businessItemsExtra: v })} placeholder="여러 개면 · 로 이어서" />
            <TextField label="업종(분류)" value={record.industry} onChange={(v) => void commit({ ...record, industry: v })} />
            <TextField label="본점 주소" field="businessAddress" value={record.businessAddress} onChange={(v) => void commit(withProfileFieldTyped(record, 'businessAddress', v, nowIso()))} />

            {/* 대표자와 담당자는 다른 사람일 수 있다 — 대표는 김대표인데 실무는 이과장이 하는 경우 */}
            <TextField label="대표자 이름" value={record.representativeName} onChange={(v) => void commit(withProfileFieldTyped(record, 'representativeName', v, nowIso()))} placeholder="비우면 담당자 이름을 씁니다" />
            <TextField label="대표자 생년월일" value={record.representativeBirth} onChange={(v) => void commit(withProfileFieldTyped(record, 'representativeBirth', v, nowIso()))} placeholder="1980-12-31" />
            <TextField label="담당자 이름" value={record.contactName} onChange={(v) => void commit({ ...record, contactName: v })} />
            <TextField label="담당자 직급" value={record.contactTitle} onChange={(v) => void commit({ ...record, contactTitle: v })} placeholder="예: 대표이사, 부장" />
            <TextField label="상시근로자 수" field="employeeCount" value={record.employeeCount} onChange={(v) => void commit(withProfileFieldTyped(record, 'employeeCount', v, nowIso()))} placeholder="예: 5명(대표 포함)" />
            <TextField label="주주·임원 구성" value={record.shareholders} onChange={(v) => void commit({ ...record, shareholders: v })} placeholder="예: 대표 60% · 배우자 40% / 등기임원 2명" />

            <TextField label="담당자 휴대폰" value={record.contactPhone} onChange={(v) => void commit({ ...record, contactPhone: v })} placeholder="010-0000-0000" />
            <TextField label="회사 대표번호" value={record.companyPhone} onChange={(v) => void commit({ ...record, companyPhone: v })} />
            <TextField label="이메일" value={record.contactEmail} onChange={(v) => void commit({ ...record, contactEmail: v })} />
            <TextField label="홈페이지" value={record.homepage} onChange={(v) => void commit({ ...record, homepage: v })} />
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
          <p className="mt-3 flex items-start gap-1.5 text-[0.875rem] break-keep text-slate-400">
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            공동인증서 비밀번호와 주민등록번호는 이 시스템에 저장하지 않습니다. 인증서는 "받았는지"와 "어디에 보관 중인지"만 기록하세요.
          </p>
        </Panel>
        )}
      </section>

      )}

      {importOpen && (
        <DocImportModal
          currentValues={{
            companyName: record.companyName,
            businessNumber: record.businessNumber,
            corporateNumber: record.corporateNumber,
            representativeName: record.representativeName || record.contactName,
            representativeBirth: record.representativeBirth,
            establishedAt: record.establishedAt,
            address: record.businessAddress,
            businessCategory: record.businessCategory,
            businessItem: record.businessItem,
            businessItemsExtra: record.businessItemsExtra,
          }}
          onClose={() => setImportOpen(false)}
          onApply={({ picked, source }) => {
            // D-128: 서류에서 읽고 대표가 확인한 값 — 출처(사업자등록증 · 등기부등본)와 '확인됨' 을 함께 남긴다
            const from = source === 'corporate_registry' ? 'corporateRegistry' : 'businessRegistration'
            const now = nowIso()
            let next = { ...record }
            const put = (key: string, value: string | undefined) => {
              if (value) next = withFactValue(next, key, value, { source: from, status: 'confirmed', now })
            }
            put('companyName', picked.companyName)
            put('businessNumber', picked.businessNumber)
            put('corporateNumber', picked.corporateNumber)
            // 서류에서 읽은 대표자 이름은 대표자 칸으로 — 담당자 칸을 덮어쓰지 않는다
            put('representativeName', picked.representativeName)
            put('representativeBirth', picked.representativeBirth)
            put('establishedAt', picked.establishedAt)
            put('businessAddress', picked.address)
            put('businessCategory', picked.businessCategory)
            put('businessItem', picked.businessItem)
            if (picked.businessItemsExtra) next.businessItemsExtra = picked.businessItemsExtra
            const filled = Object.values(picked).filter((v) => typeof v === 'string' && v.trim() !== '').length
            void commit(withActivity(next, 'profile', `서류에서 기업 정보 ${filled}개 항목 반영`))
            setImportOpen(false)
            showToast('서류에서 읽은 정보를 반영했습니다.')
          }}
        />
      )}

      {closing && (
        <ContractCloseSheet
          record={record}
          draft={closing}
          onClose={() => setClosing(null)}
          onSubmit={async (d) => {
            const ok = await commit(withContractClose(record, d))
            if (ok) showToast(`${record.companyName} — 계약 완료. 수금 항목 · 계약 정보를 넣었습니다.`)
            return ok
          }}
          onStageOnly={async () => {
            changeStage('signed', true)
            return true
          }}
        />
      )}

      {/* D-209: 서류 탭의 '한꺼번에 올리기' 도 화면 맨 바깥에 — 서류 탭 안에 있으면 다른 탭으로 가는 순간 창이 없어져 읽어 둔 파일이 사라졌다 */}
      {bulkOpen && (
        <BulkDocUploadSheet
          showSignal={bulkShow}
          record={record}
          latest={() => latestRef.current ?? record}
          onClose={() => setBulkOpen(false)}
          onSaved={(saved, summary) => {
            latestRef.current = saved
            setRecord(saved)
            setSavedAt(Date.now())
            setLastBatch(summary)
          }}
        />
      )}

      {/* D-144: 머리줄 '서류 올리기' — 읽자마자 확실한 것은 저절로 올리고 분석 → 맞춤 추천으로 */}
      {autoUploadOpen && (
        <BulkDocUploadSheet
          auto
          showSignal={uploadShow}
          record={record}
          latest={() => latestRef.current ?? record}
          initialDocs={handedDocs}
          onClose={() => {
            setAutoUploadOpen(false)
            setHandedDocs([])
          }}
          onSaved={(saved, summary) => {
            latestRef.current = saved
            setRecord(saved)
            setSavedAt(Date.now())
            setLastBatch(summary)
            // D-209: 올리는 동안 다른 업체로 옮겨 갔으면 그 화면을 맞춤 추천으로 바꾸지 않는다
            if (aliveRef.current) setTab('smart')
          }}
        />
      )}

      {message && (
        <MessageModal
          title={message.title}
          description={message.description}
          text={message.text}
          onClose={() => setMessage(null)}
          followUp={(() => {
            // D-314 요청 문구(받을 자료 · 서류 요청 · 정책자금 신청 서류)를 보냈으면 — 3일 뒤 '받았는지 확인' 할 일(오늘 · 일정). 다음 약속은 덮지 않는다
            const follow = /요청/.test(message.title) ? requestFollowUpText(message.text) : ''
            if (!follow) return undefined
            return {
              label: '보냈어요 · 3일 뒤 받았는지 확인',
              run: async () => {
                const due = addDaysLocal(today, 3)
                await createJournalEntry(workspaceId, userId, { entryType: 'follow_up', entryDate: today, content: follow, clientId: record.id, dueDate: due })
                return `할 일에 넣었어요 · 기한 ${due.slice(5).replace('-', '/')} — 오늘 · 일정에 떠요`
              },
            }
          })()}
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
  field,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** D-237 맞춤 추천 [회사 정보 적기] 가 비어 있는 칸을 찾아 커서를 둔다 */
  field?: string
}) {
  return (
    <label className="block py-1.5 text-[0.9rem] font-medium text-slate-600">
      {label}
      <input
        value={value}
        data-field={field}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 ${inputCls}`}
      />
    </label>
  )
}

function CloudClientDetail() {
  const { currentWorkspaceId, session } = useAuth()
  const { clientId = '' } = useParams()
  // D-209: 업체마다 새로 — 같은 화면을 다른 업체로 다시 쓰면 열어 둔 창 · 올리기 · 고르던 칸이 다음 업체로 넘어갔다
  return <ClientDetailContent key={clientId} workspaceId={currentWorkspaceId} userId={session?.user.id ?? null} />
}

function LocalClientDetail() {
  const { clientId = '' } = useParams()
  return <ClientDetailContent key={clientId} workspaceId={null} userId={null} />
}

/** D-146: 서류 칸 순서 — 지금 필요한 것 먼저, 같은 이름 칸('사업자등록증 (2)')은 원래 칸 바로 뒤에(나란히 보고 하나 지운다) */
function docOrder<T extends { key: string; label: string }>(metas: T[], urgent: ReadonlySet<string>): T[] {
  const base = (l: string) => l.replace(/\s*\(\d+\)$/, '').replace(/\s/g, '')
  const first = new Map<string, number>()
  metas.forEach((m, i) => {
    if (!first.has(base(m.label))) first.set(base(m.label), i)
  })
  const groupUrgent = new Set(metas.filter((m) => urgent.has(m.key)).map((m) => base(m.label)))
  return metas
    .map((m, i) => ({ m, i, g: first.get(base(m.label)) ?? i }))
    .sort((a, b) => Number(groupUrgent.has(base(b.m.label))) - Number(groupUrgent.has(base(a.m.label))) || a.g - b.g || a.i - b.i)
    .map((x) => x.m)
}

export function OperationsClientDetailPage() {
  return getDataModeConfig().mode === 'supabase' ? (
    <CloudClientDetail />
  ) : (
    <LocalClientDetail />
  )
}
