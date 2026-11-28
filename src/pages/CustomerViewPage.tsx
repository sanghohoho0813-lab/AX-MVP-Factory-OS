/**
 * D-683 고객 화면으로 보기 — 대표만.
 *
 * 고객사가 홈페이지(My MIRAE)에 로그인했을 때 보는 화면을 OS 안에서 그대로 본다 — 성장 홈 → 프로젝트(탭) → 보고서.
 * 대표 ↔ 팀장처럼 머리줄 '보는 화면' 에서 오간다(맨 위 띠 [대표 화면으로]). 계약 고객 · 잠재고객 모두.
 *   · 연결 전 업체는 고객이 가입해도 보는 '연결된 프로젝트 없음' 화면 그대로 + [연결되면 보일 화면](연결 직후 모습).
 *   · 계정이 여럿이면 계정마다(열어 봄 · 확인 표시가 계정마다 다르다). 멈춤 · 끊은 계정은 고객에게 '연결 없음' 으로 보이는 그대로.
 *   · 데이터는 고객 투영과 같은 함수(portal_preview_project — 0006 · 0026 허락 문) + 보고서 · 열람 기록 표(0033) — **아무것도 기록하지 않는다**
 *     (고객 방문 · 열어 봄 · 확인 0). 고객 로그인을 대신하지 않는다 — 고객이 누르는 단추(파일 올리기 · 확인했어요 · 보내기)는 눌리지 않는다.
 *   · 말 · 차례 · 칸은 홈페이지 `MyProjectsPage` · `MyProjectDetailPage` · `MyReportPage` 와 같다(그쪽을 바꾸면 여기도 — 아래 MY 표).
 * 대표(full)만 — 팀장 · 대표가 팀장 화면을 보는 중 · 구독 고객은 막힌다(서버도 0026 허락 문 · 작업공간 구성원만).
 */
import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Eye, Search, UserRound } from 'lucide-react'
import { AuthContext } from '../auth/authContext'
import { useCustomerViewAllowed } from './customerViewAccess'
import { brand } from '../brand/brand.config'
import { localDateOf, nowIso } from '../lib/appClock'
import type { ClientOpsRecord } from '../types/clientOps'
import { contractStageOf } from '../types/clientOps'
import type { PortalClientLink, PortalProjection } from '../types/bridge'
import { CUSTOMER_STAGE_LABEL, CUSTOMER_STAGE_ORDER } from '../config/serviceCatalog'
import { listClients } from '../services/clientOpsService'
import { listLinks, previewProjection } from '../services/customerBridgeService'
import { isGrowthOff, listClientReports, listLinkAccounts, listReceipts, listSharedResults, resultReceiptsSince, type PortalReceipt, type PortalReport, type SharedResult } from '../services/portalGrowth'
import { REPORT_KIND_LABEL, newResultIds } from '../services/portalGrowthRules'

/* 고객 화면(홈페이지 src/lib/customerPortal.ts)의 말 — OS 안쪽 말(요청함 · 고객 업로드됨 …)과 다르다 */
const MY = {
  doc: { requested: '올려 주세요', uploaded: '확인 중', verified: '확인 완료', rejected: '다시 올려 주세요' } as Record<string, string>,
  req: { open: '답변 대기', answered: '답변 도착', resolved: '해결됨', closed: '종료' } as Record<string, string>,
  reqType: { document: '서류 문의', schedule: '일정 문의', status: '진행상태 문의', consultation: '추가 상담', info_change: '정보 수정', other: '기타' } as Record<string, string>,
  cat: { progress: '진행 상황', document_request: '서류 요청', result: '결과 안내', notice: '안내', question: '확인 요청' } as Record<string, string>,
  ack: '확인 표시는 보고서를 보셨다는 뜻이에요. 계약 검수 · 대금 승인이 아니에요.',
}
const NOPE = '미리보기 — 고객만 누를 수 있어요'
const kdate = (iso?: string | null) => {
  const d = localDateOf(iso ?? '')
  return d ? d.replace(/-/g, '.') : ''
}
const md = (d?: string | null) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : '')

type View = 'home' | 'project' | 'report'
type Tab = 'todo' | 'reports' | 'progress' | 'documents' | 'updates' | 'requests' | 'results'
const TABS: { key: Tab; label: string }[] = [
  { key: 'todo', label: '지금 해야 할 일' },
  { key: 'reports', label: '보고서' },
  { key: 'progress', label: '진행 상태' },
  { key: 'documents', label: '서류' },
  { key: 'updates', label: '업데이트' },
  { key: 'requests', label: '내 요청' },
  { key: 'results', label: '결과' },
]

interface Loaded {
  links: PortalClientLink[]
  emails: Map<string, string>
  reports: PortalReport[] | null
  receipts: PortalReceipt[]
  projection: PortalProjection | null
  /** D-686 공유한 결과 자료 · 기록을 남기기 시작한 때(0034 없으면 null → '새 결과 자료' 표시 없음 — 고객 화면도 그렇다) */
  results: SharedResult[]
  resultsSince: string | null
}

export function CustomerViewPage() {
  const allowed = useCustomerViewAllowed()
  const auth = useContext(AuthContext)
  const workspaceId = auth?.currentWorkspaceId ?? null
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const clientId = search.get('client') ?? ''
  const view = (search.get('view') as View | null) ?? 'home'
  const tab = (search.get('tab') as Tab | null) ?? 'todo'
  const reportId = search.get('report') ?? ''
  const asLink = search.get('as') ?? ''
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const [allLinks, setAllLinks] = useState<PortalClientLink[]>([])
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  const [simulate, setSimulate] = useState(false)

  const go = useCallback(
    (patch: Record<string, string | null>) =>
      setSearch((q) => {
        const n = new URLSearchParams(q)
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === '') n.delete(k)
          else n.set(k, v)
        }
        return n
      }),
    [setSearch],
  )

  useEffect(() => {
    if (!allowed) return
    let alive = true
    void Promise.all([listClients(workspaceId), listLinks(workspaceId).catch(() => [] as PortalClientLink[])])
      .then(([cs, ls]) => {
        if (!alive) return
        setClients(cs.filter((c) => !c.archivedAt))
        setAllLinks(ls)
      })
      .catch(() => alive && setError('업체 목록을 읽지 못했어요 — 잠시 뒤 다시 열어 주세요.'))
    return () => {
      alive = false
    }
  }, [allowed, workspaceId])

  const record = clients?.find((c) => c.id === clientId) ?? null

  useEffect(() => {
    setLoaded(null)
    setSimulate(false)
    if (!allowed || !record) return
    let alive = true
    void (async () => {
      const links = allLinks.filter((l) => l.operationsClientId === record.id)
      const emails = await listLinkAccounts(workspaceId, record.id).catch(() => new Map<string, string>())
      let reports: PortalReport[] | null = []
      let receipts: PortalReceipt[] = []
      try {
        ;[reports, receipts] = await Promise.all([listClientReports(workspaceId, record.id), listReceipts(workspaceId, record.id)])
      } catch (cause) {
        reports = isGrowthOff(cause) ? null : []
      }
      const active = links.find((l) => l.status === 'active') ?? null
      const projection = active ? await previewProjection(workspaceId, active, record.companyName).catch(() => null) : null
      const resultsSince = await resultReceiptsSince()
      const results = resultsSince ? await listSharedResults(workspaceId, links.map((l) => ({ id: l.id, operationsClientId: l.operationsClientId })), record.id).catch(() => []) : []
      if (alive) setLoaded({ links, emails, reports, receipts, projection, results, resultsSince })
    })()
    return () => {
      alive = false
    }
  }, [allowed, record, allLinks, workspaceId])

  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl p-6" data-testid="cv-page" data-state="blocked">
        <p className="t-body font-semibold text-slate-900">대표 계정에서만 고객 화면을 볼 수 있어요.</p>
        <Link to="/" className="t-sub mt-3 inline-block font-semibold text-brand-700 hover:underline">오늘로</Link>
      </div>
    )
  }

  const back = () => navigate('/')
  const banner = (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-(--radius-control) border border-navy-900/20 bg-navy-900 px-3 py-2 text-white sm:px-4" data-testid="cv-banner">
      <Eye aria-hidden="true" className="size-4 shrink-0" />
      {/* 휴대폰: 글이 한 줄을 다 쓰고 단추는 다음 줄로(업체 이름이 쪼개지지 않게) */}
      <p className="t-sub min-w-0 flex-1 basis-[12rem] break-keep">
        {record ? <><b>{record.companyName}</b> 고객 화면<span className="hidden sm:inline"> 보는 중</span></> : <b>고객 화면 보기</b>}
        <span className="hidden sm:inline"> — 고객이 My MIRAE 에서 보는 그대로예요(아무것도 기록되지 않아요).</span>
      </p>
      {record && (
        <button type="button" onClick={() => go({ client: null, as: null, view: null, tab: null, report: null })} className="tap t-sub shrink-0 rounded-(--radius-control) border border-white/40 px-3 py-1.5 font-semibold whitespace-nowrap hover:bg-white/10" data-testid="cv-other">
          다른 고객
        </button>
      )}
      <button type="button" onClick={back} className="tap t-sub shrink-0 rounded-(--radius-control) bg-white px-3 py-1.5 font-semibold whitespace-nowrap text-navy-900 hover:bg-slate-100" data-testid="cv-back-owner">
        {brand.ownerTitle}로<span className="hidden sm:inline"> 돌아가기</span>
      </button>
    </div>
  )

  if (error) return <div className="p-4">{banner}<p className="t-sub text-danger-700">{error}</p></div>
  if (!clients) return <div className="p-4">{banner}<p className="t-sub text-slate-500">불러오는 중…</p></div>
  if (!record) {
    return (
      <div className="mx-auto w-full max-w-3xl p-1 sm:p-4" data-testid="cv-page" data-state="picker">
        {banner}
        <ClientPicker clients={clients} links={allLinks} onPick={(id) => go({ client: id })} />
      </div>
    )
  }

  const links = loaded?.links ?? []
  const chosen = links.find((l) => l.id === asLink) ?? links.find((l) => l.status === 'active') ?? links[0] ?? null
  const emailOf = (l: PortalClientLink) => l.profileEmail || loaded?.emails.get(l.id) || ''
  // 고객에게 보이는 것은 활성 연결뿐(0006 portal_link_owned) — 멈춤 · 끊음 계정은 '연결 없음' 화면
  const liveForCustomer = !!chosen && chosen.status === 'active'
  const projection: PortalProjection | null = liveForCustomer
    ? loaded?.projection ?? null
    : simulate
      ? { project: { link_id: 'preview', name: record.companyName, company_name: record.companyName, stage: 'preparing', status: 'active', consultant_name: null, updated_at: nowIso() }, updates: [], documents: [], requests: [] }
      : null
  const seenFor = (rid: string) => (chosen ? loaded?.receipts.find((r) => r.itemKind === 'report' && r.itemId === rid && r.linkId === chosen.id) ?? null : null)
  const reports = (loaded?.reports ?? []).filter((r) => r.status === 'published')
  // D-686 이 계정에 '새 결과 자료'(고객 화면과 같은 규칙 · 기록 0)
  const newResults = chosen && loaded ? newResultIds(loaded.results, loaded.receipts, chosen.id, loaded.resultsSince) : new Set<string>()

  return (
    <div className="mx-auto w-full max-w-5xl p-1 sm:p-4" data-testid="cv-page" data-state="view">
      {banner}
      {!loaded ? (
        <p className="t-sub text-slate-500">불러오는 중…</p>
      ) : (
        <>
          {links.length > 1 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="어느 계정으로 볼까요">
              <span className="t-sub mr-1 text-slate-600">어느 계정으로?</span>
              {links.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={chosen?.id === l.id} onClick={() => go({ as: l.id })} data-testid="cv-account" data-link={l.id} data-on={chosen?.id === l.id ? '1' : '0'}
                  className={`tap t-sub min-h-10 rounded-full border px-3 font-semibold break-all ${chosen?.id === l.id ? 'border-brand-600 bg-white text-brand-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
                  {chosen?.id === l.id && <Check aria-hidden="true" className="mr-1 inline size-4 align-[-3px]" />}
                  {emailOf(l) || '고객 계정'}{l.status !== 'active' ? ` · ${l.status === 'paused' ? '멈춤' : '끊음'}` : ''}
                </button>
              ))}
            </div>
          )}
          {!liveForCustomer && (
            <p className="t-sub mb-3 flex flex-wrap items-center gap-2 break-keep text-slate-700" data-testid={chosen ? 'cv-paused-note' : 'cv-unlinked-note'}>
              {chosen
                ? `이 계정은 연결을 ${chosen.status === 'paused' ? '잠시 멈춰' : '끊어'} 둬서 고객에게는 '연결된 프로젝트 없음' 으로 보여요.`
                : '이 업체는 아직 고객 계정과 연결 전이에요. 고객이 가입해도 연결 전에는 아래 화면이에요.'}
              <button type="button" onClick={() => setSimulate((v) => !v)} className="tap font-semibold text-brand-700 hover:underline" data-testid="cv-simulate" aria-pressed={simulate}>
                {simulate ? '지금 화면으로' : '연결되면 보일 화면'}
              </button>
            </p>
          )}
          <Frame path={view === 'report' ? `/my-projects/reports/${reportId}` : view === 'project' ? '/my-projects/…' : '/my-projects'} view={view} linked={!!projection}>
            {view === 'report' ? (
              <ReportView report={reports.find((r) => r.id === reportId) ?? null} company={record.companyName} consultant={chosen?.consultantName || projection?.project?.consultant_name || ''} seen={seenFor(reportId)} onBack={() => go({ view: 'project', tab: 'reports', report: null })} />
            ) : view === 'project' && projection?.project ? (
              <ProjectView p={projection} reports={loaded.reports === null ? null : reports} seenFor={seenFor} newResults={newResults} tab={tab} onTab={(t) => go({ tab: t })} onHome={() => go({ view: null, tab: null })} onReport={(id) => go({ view: 'report', report: id })} />
            ) : (
              <HomeView p={projection} email={chosen ? emailOf(chosen) : record.contactEmail} reports={loaded.reports === null ? null : reports} seenFor={seenFor} newResults={newResults} onProject={(t) => go({ view: 'project', tab: t ?? null })} onReport={(id) => go({ view: 'report', report: id })} />
            )}
          </Frame>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 업체 고르기 — 계약 고객 · 잠재고객 · 찾기                               */
/* ------------------------------------------------------------------ */

function ClientPicker({ clients, links, onPick }: { clients: ClientOpsRecord[]; links: PortalClientLink[]; onPick: (id: string) => void }) {
  const [group, setGroup] = useState<'signed' | 'pre'>('signed')
  const [q, setQ] = useState('')
  const [all, setAll] = useState(false)
  const linkCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of links) if (l.status === 'active') m.set(l.operationsClientId, (m.get(l.operationsClientId) ?? 0) + 1)
    return m
  }, [links])
  const isPre = (c: ClientOpsRecord) => contractStageOf(c.status) === 'pre'
  const signed = clients.filter((c) => !isPre(c))
  const pre = clients.filter(isPre)
  const word = q.trim()
  const list = (word ? clients.filter((c) => c.companyName.includes(word) || (c.representativeName ?? '').includes(word)) : group === 'signed' ? signed : pre)
    .slice()
    .sort((a, b) => (linkCount.get(b.id) ?? 0) - (linkCount.get(a.id) ?? 0) || a.companyName.localeCompare(b.companyName, 'ko'))
  const shown = all ? list : list.slice(0, 5)
  return (
    <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4" data-testid="cv-picker">
      <h1 className="t-section text-slate-900">어느 고객의 화면을 볼까요?</h1>
      <label className="mt-3 flex min-h-11 items-center gap-2 rounded-(--radius-control) border border-slate-300 px-3">
        <Search aria-hidden="true" className="size-4 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="업체 · 대표 이름" aria-label="고객 찾기" className="t-body min-w-0 flex-1 outline-none" data-testid="cv-search" />
      </label>
      {!word && (
        <div className="mt-3 flex gap-1.5" role="tablist">
          {([['signed', `계약 고객 ${signed.length}`], ['pre', `잠재고객 ${pre.length}`]] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={group === k} onClick={() => { setGroup(k); setAll(false) }} data-testid="cv-group" data-group={k}
              className={`tap t-sub min-h-10 rounded-full border px-3.5 font-semibold ${group === k ? 'border-brand-600 bg-white text-brand-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
              {group === k && <Check aria-hidden="true" className="mr-1 inline size-4 align-[-3px]" />}{label}
            </button>
          ))}
        </div>
      )}
      <ul className="mt-2 divide-y divide-slate-100">
        {shown.map((c) => {
          const n = linkCount.get(c.id) ?? 0
          return (
            <li key={c.id}>
              <button type="button" onClick={() => onPick(c.id)} className="tap flex min-h-12 w-full items-center justify-between gap-3 px-1 py-2 text-left hover:bg-slate-50" data-testid="cv-client-row" data-client={c.id} data-linked={n ? '1' : '0'}>
                <span className="t-body min-w-0 truncate font-semibold text-slate-900">{c.companyName}</span>
                <span className={`t-meta shrink-0 ${n ? 'text-success-700' : 'text-slate-500'}`}>{n ? `연결됨 · 계정 ${n}` : '연결 전'}</span>
              </button>
            </li>
          )
        })}
        {shown.length === 0 && <li className="t-sub py-3 text-slate-500">{word ? '찾는 업체가 없어요.' : '아직 업체가 없어요.'}</li>}
      </ul>
      {list.length > 5 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="tap t-sub mt-1 min-h-10 font-semibold text-brand-700 hover:underline" data-testid="cv-more">
          {all ? '접기' : `${list.length - 5}곳 더 보기`}
        </button>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 홈페이지 모양 틀 — 주소 줄 · 머리줄 · 제목(PageShell)                    */
/* ------------------------------------------------------------------ */

function Frame({ path, view, linked, children }: { path: string; view: View; linked: boolean; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-(--radius-panel) border border-slate-300 bg-white" data-testid="cv-frame" data-view={view} data-linked={linked ? '1' : '0'}>
      <div className="t-meta flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-slate-500">
        <span aria-hidden="true">●●●</span>
        <span className="min-w-0 truncate">{brand.customerPlatformUrl.replace('https://', '')}{path}</span>
      </div>
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
        <span className="font-black tracking-tight text-slate-900">미래에이아이랩</span>
        <span className="t-sub flex items-center gap-2 text-slate-500">홈 <UserRound aria-hidden="true" className="size-5 rounded-full bg-slate-200 p-0.5" /></span>
      </div>
      <div className="bg-slate-50 px-4 py-6 sm:px-8 sm:py-8">{children}</div>
    </div>
  )
}

function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[1.75rem] leading-tight font-black tracking-tight break-keep text-slate-900 [overflow-wrap:anywhere] sm:text-[2.1rem]">{title}</h2>
      {subtitle && <p className="t-body mt-2 break-keep text-slate-600">{subtitle}</p>}
    </div>
  )
}

const Card = ({ children, testid }: { children: ReactNode; testid?: string }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5" data-testid={testid}>{children}</section>
)
const Empty = ({ text }: { text: string }) => <p className="t-sub rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">{text}</p>
const Nope = ({ children }: { children: ReactNode }) => (
  <button type="button" disabled title={NOPE} className="t-sub mt-3 min-h-10 cursor-not-allowed rounded-xl bg-slate-900 px-4 font-bold text-white opacity-60">{children}</button>
)
const stateOf = (seen: PortalReceipt | null) => (!seen ? 'new' : seen.acknowledgedAt ? 'acked' : 'seen')
const stateLabel = { new: '새 보고서', seen: '확인 전', acked: '확인함' } as const
const stateCls = { new: 'bg-danger-50 text-danger-700', seen: 'bg-slate-100 text-slate-600', acked: 'bg-success-50 text-success-700' } as const

/* ------------------------------------------------------------------ */
/* 성장 홈(/my-projects)                                                 */
/* ------------------------------------------------------------------ */

function HomeView({ p, email, reports, seenFor, newResults, onProject, onReport }: {
  p: PortalProjection | null
  email: string
  reports: PortalReport[] | null
  seenFor: (id: string) => PortalReceipt | null
  /** D-686 이 계정의 '새 결과 자료' id */
  newResults: ReadonlySet<string>
  onProject: (tab?: Tab) => void
  onReport: (id: string) => void
}) {
  if (!p?.project) {
    return (
      <>
        <PageTitle title="내 프로젝트" subtitle="미래AI랩과 진행 중인 컨설팅의 진행상태·요청자료·업데이트를 확인합니다." />
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center" data-testid="cv-unlinked">
          <p className="text-lg font-bold text-slate-900">아직 연결된 프로젝트가 없습니다</p>
          <p className="t-sub mx-auto mt-2 max-w-md break-keep text-slate-600">미래AI랩과 진행 중인 컨설팅 프로젝트가 연결되면 이곳에서 진행상태와 요청자료를 확인할 수 있습니다. 연결은 담당 컨설턴트가 회원 이메일로 진행합니다.</p>
          {email && <p className="t-sub mx-auto mt-3 max-w-md rounded-xl border border-slate-200 bg-white px-3 py-2 break-all text-slate-700">가입한 이메일 <b>{email}</b> — 담당 컨설턴트에게 이 이메일을 알려 주세요.</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Nope>컨설팅 서비스 보기</Nope>
            <Nope>무료 사업 진단</Nope>
          </div>
        </div>
      </>
    )
  }
  const pr = p.project
  const reqDocs = p.documents.filter((d) => d.status === 'requested' || d.status === 'rejected').length
  const actions = p.updates.filter((u) => u.action_required && !u.completed_at).length
  const list = reports ?? []
  const todo: { key: string; label: string; sub: string; go: () => void }[] = [
    ...list.filter((r) => !seenFor(r.id)).map((r) => ({ key: `r:${r.id}`, label: `새 보고서 · ${r.title}`, sub: `${pr.name} · ${kdate(r.publishedAt)}`, go: () => onReport(r.id) })),
    ...(newResults.size ? [{ key: 'res', label: `새 결과 자료 ${newResults.size}개`, sub: pr.name, go: () => onProject('results') }] : []),
    ...(reqDocs ? [{ key: 'd', label: `서류 ${reqDocs}개 올려 주세요`, sub: pr.name, go: () => onProject('todo') }] : []),
    ...(actions ? [{ key: 'a', label: `해야 할 일 ${actions}건`, sub: pr.name, go: () => onProject('todo') }] : []),
  ]
  const unseen = list.filter((r) => !seenFor(r.id)).length
  return (
    <div className="flex max-w-3xl flex-col gap-4" data-testid="cv-home">
      <PageTitle title="내 프로젝트" subtitle="미래AI랩과 진행 중인 컨설팅의 진행상태·요청자료·업데이트를 확인합니다." />
      {todo.length > 0 && (
        <Card testid="cv-todo">
          <p className="text-base font-black text-slate-900">지금 할 일 <span className="text-slate-400">{todo.length}</span></p>
          <ul className="mt-2 divide-y divide-slate-100">
            {todo.slice(0, 3).map((t) => (
              <li key={t.key}>
                <button type="button" onClick={t.go} className="tap flex min-h-12 w-full items-center justify-between gap-3 py-2.5 text-left" data-testid="cv-todo-item">
                  <span className="min-w-0">
                    <span className="block text-[0.9375rem] font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{t.label}</span>
                    <span className="t-meta block truncate text-slate-500">{t.sub}</span>
                  </span>
                  <span aria-hidden="true" className="text-slate-400">›</span>
                </button>
              </li>
            ))}
          </ul>
          {todo.length > 3 && <p className="t-meta mt-1 text-slate-500">그 밖에 {todo.length - 3}건은 프로젝트 화면에서 볼 수 있어요.</p>}
        </Card>
      )}
      {list.length > 0 && (
        <Card testid="cv-recent">
          <p className="text-base font-black text-slate-900">최근 보고서</p>
          <ul className="mt-2 divide-y divide-slate-100">
            {list.slice(0, 3).map((r) => {
              const st = stateOf(seenFor(r.id))
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => onReport(r.id)} className="tap flex min-h-12 w-full items-center justify-between gap-3 py-2.5 text-left" data-testid="cv-recent-item" data-state={st}>
                    <span className="min-w-0">
                      <span className="block text-[0.9375rem] font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{r.title}</span>
                      <span className="t-meta block truncate text-slate-500">{REPORT_KIND_LABEL[r.kind]} · {kdate(r.publishedAt)}</span>
                    </span>
                    <span className={`t-meta shrink-0 rounded-full px-2.5 py-0.5 font-black ${stateCls[st]}`}>{stateLabel[st]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
      <button type="button" onClick={() => onProject()} className="tap block rounded-2xl border border-slate-200 bg-white p-5 text-left hover:border-slate-400" data-testid="cv-project-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-black tracking-tight text-slate-900">{pr.name}</p>
            <p className="t-sub mt-0.5 text-slate-500">
              {CUSTOMER_STAGE_LABEL[pr.stage]}{pr.consultant_name ? ` · 담당 ${pr.consultant_name}` : ''}{pr.updated_at ? ` · 업데이트 ${kdate(pr.updated_at)}` : ''}
            </p>
          </div>
          {reqDocs + actions > 0 ? (
            <span className="t-meta rounded-full bg-warning-50 px-3 py-1 font-black text-warning-700">해야 할 일 {reqDocs + actions}</span>
          ) : unseen + newResults.size > 0 ? (
            <span className="t-meta rounded-full bg-brand-50 px-3 py-1 font-black text-brand-700" data-testid="cv-new-pill">새로 온 자료 {unseen + newResults.size}</span>
          ) : (
            <span className="t-meta rounded-full bg-success-50 px-3 py-1 font-black text-success-700">확인할 일 없음</span>
          )}
        </div>
        <div className="t-meta mt-3 flex flex-wrap gap-x-4 gap-y-1 font-semibold text-slate-500">
          <span>요청받은 서류 {p.documents.filter((d) => d.status === 'requested').length}</span>
          <span>내 요청 {p.requests.filter((r) => r.status === 'open' || r.status === 'answered').length}</span>
          {reports !== null && <span>보고서 {list.length}{unseen ? ` · 새 보고서 ${unseen}` : ''}</span>}
          {newResults.size > 0 && <span data-testid="cv-results-new">새 결과 자료 {newResults.size}</span>}
        </div>
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 프로젝트 상세(/my-projects/:linkId)                                     */
/* ------------------------------------------------------------------ */

function ProjectView({ p, reports, seenFor, newResults, tab, onTab, onHome, onReport }: {
  p: PortalProjection
  reports: PortalReport[] | null
  seenFor: (id: string) => PortalReceipt | null
  newResults: ReadonlySet<string>
  tab: Tab
  onTab: (t: Tab) => void
  onHome: () => void
  onReport: (id: string) => void
}) {
  const pr = p.project!
  const actions = p.updates.filter((u) => u.action_required && !u.completed_at)
  const docs = p.documents.filter((d) => d.status === 'requested' || d.status === 'rejected')
  const todoCount = actions.length + docs.length
  const unseen = (reports ?? []).filter((r) => !seenFor(r.id)).length
  // 고객 화면과 같게(D-688) — 해야 할 일은 없어도 새로 온 것이 있으면 '확인할 내용이 없습니다' 라고 하지 않는다
  const newCount = unseen + newResults.size
  const stageIdx = CUSTOMER_STAGE_ORDER.indexOf(pr.stage)
  const cur: Tab = tab === 'reports' && reports === null ? 'todo' : tab
  return (
    <div data-testid="cv-project">
      <PageTitle title={pr.name} subtitle={`${CUSTOMER_STAGE_LABEL[pr.stage]}${pr.consultant_name ? ` · 담당 ${pr.consultant_name}` : ''}${pr.updated_at ? ` · 최근 업데이트 ${kdate(pr.updated_at)}` : ''}`} />
      <button type="button" onClick={onHome} className="tap t-sub inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft aria-hidden="true" className="size-4" /> 내 프로젝트</button>
      <div className={`mt-4 rounded-2xl border p-5 ${todoCount > 0 ? 'border-warning-200 bg-warning-50' : newCount > 0 ? 'border-brand-200 bg-brand-50' : 'border-success-200 bg-success-50'}`} data-testid="cv-project-summary">
        <p className={`text-base font-black ${todoCount > 0 ? 'text-warning-700' : newCount > 0 ? 'text-brand-700' : 'text-success-700'}`}>{todoCount > 0 ? `지금 확인할 내용이 ${todoCount}건 있습니다` : newCount > 0 ? `새로 온 자료가 ${newCount}개 있습니다` : '지금 확인할 내용이 없습니다'}</p>
        <p className="t-sub mt-1 text-slate-600">
          {docs.length > 0 && `서류 ${docs.length}개 요청됨 · `}{actions.length > 0 && `해야 할 일 ${actions.length}건 · `}{unseen > 0 && `새 보고서 ${unseen}개 · `}{newResults.size > 0 && `새 결과 자료 ${newResults.size}개 · `}{p.updates.length > 0 ? `진행 업데이트 ${p.updates.length}건` : '아직 업데이트가 없습니다'}
        </p>
      </div>
      <div className="mt-6 mb-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 [scrollbar-width:none]" role="tablist">
        {TABS.filter((t) => t.key !== 'reports' || reports !== null).map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={cur === t.key} onClick={() => onTab(t.key)} data-testid="cv-tab" data-tab={t.key}
            className={`tap t-sub shrink-0 rounded-lg px-4 py-2 font-bold whitespace-nowrap ${cur === t.key ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
            {t.key === 'todo' && todoCount > 0 && <span className="ml-1 rounded-full bg-warning-500 px-1.5 text-[0.75rem] text-white">{todoCount}</span>}
            {t.key === 'reports' && unseen > 0 && <span className="ml-1 rounded-full bg-danger-500 px-1.5 text-[0.75rem] text-white">새 {unseen}</span>}
            {t.key === 'results' && newResults.size > 0 && <span className="ml-1 rounded-full bg-danger-500 px-1.5 text-[0.75rem] text-white" data-testid="cv-tab-results-new">새 {newResults.size}</span>}
          </button>
        ))}
      </div>
      <div className="flex max-w-3xl flex-col gap-4">
        {cur === 'todo' && (
          <>
            {todoCount === 0 && <Empty text="지금 해야 할 일이 없습니다. 진행 상황은 '업데이트' 탭에서 확인하세요." />}
            {actions.map((u) => (
              <Card key={u.id}>
                <span className="t-meta rounded-full bg-slate-100 px-2 py-0.5 font-black text-slate-600">{MY.cat[u.category] ?? u.category}</span>
                <p className="mt-2 text-base font-black text-slate-900">{u.action_label ?? u.title}</p>
                <p className="t-sub mt-1 text-slate-600">{u.title}{u.body ? ` — ${u.body}` : ''}</p>
                {u.due_date && <p className="t-meta mt-1 font-semibold text-warning-700">{u.due_date}까지</p>}
                <Nope>완료했어요</Nope>
              </Card>
            ))}
            {docs.length > 0 && (
              <Card>
                <p className="text-base font-black text-slate-900">요청받은 서류</p>
                <DocList docs={docs} />
              </Card>
            )}
          </>
        )}
        {cur === 'reports' && reports !== null && (
          (reports.length === 0 ? <Empty text="아직 받은 보고서가 없습니다. 담당자가 경과 보고를 보내면 여기에 쌓입니다." /> : (
            <ol className="flex flex-col gap-3">
              {reports.map((r) => {
                const st = stateOf(seenFor(r.id))
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => onReport(r.id)} className="tap block w-full rounded-2xl border border-slate-200 bg-white p-5 text-left hover:border-slate-400" data-testid="cv-report-item" data-state={st}>
                      <span className="t-meta flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-black text-slate-600">{REPORT_KIND_LABEL[r.kind]}</span>
                        <span className="text-slate-400">{kdate(r.publishedAt)}</span>
                        {r.version > 1 && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-black text-slate-600">정정본</span>}
                        <span className={`rounded-full px-2 py-0.5 font-black ${stateCls[st]}`}>{stateLabel[st]}</span>
                      </span>
                      <span className="mt-2 block text-base font-black break-keep text-slate-900 [overflow-wrap:anywhere]">{r.title}</span>
                      {r.summary && <span className="t-sub mt-1 line-clamp-2 block text-slate-600">{r.summary}</span>}
                    </button>
                  </li>
                )
              })}
            </ol>
          ))
        )}
        {cur === 'progress' && (
          <Card>
            <p className="text-base font-black text-slate-900">진행 상태</p>
            <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CUSTOMER_STAGE_ORDER.map((s, i) => (
                <li key={s} className={`t-sub rounded-xl border px-3 py-2.5 font-bold ${i < stageIdx ? 'border-success-200 bg-success-50 text-success-700' : i === stageIdx ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-400'}`}>
                  <span className="mr-1 text-[0.75rem] opacity-70">{i + 1}</span>{CUSTOMER_STAGE_LABEL[s]}
                </li>
              ))}
            </ol>
            <p className="t-sub mt-4 text-slate-600">{pr.consultant_name ? `담당 컨설턴트: ${pr.consultant_name}` : '담당 컨설턴트가 배정되어 있습니다.'}{pr.updated_at ? ` · 최근 업데이트 ${kdate(pr.updated_at)}` : ''}</p>
          </Card>
        )}
        {cur === 'documents' && (p.documents.length === 0 ? <Empty text="요청받거나 공유된 서류가 없습니다." /> : <Card><DocList docs={p.documents} /></Card>)}
        {cur === 'updates' && (p.updates.length === 0 ? <Empty text="아직 진행 업데이트가 없습니다. 담당자가 진행 상황을 공유하면 여기에 쌓입니다." /> : (
          <ol className="flex flex-col gap-3">
            {p.updates.map((u) => (
              <li key={u.id}>
                <Card>
                  <span className="t-meta flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-black text-slate-600">{MY.cat[u.category] ?? u.category}</span>
                    <span className="text-slate-400">{kdate(u.published_at)}</span>
                  </span>
                  <p className="mt-2 text-base font-black text-slate-900">{u.title}</p>
                  {u.body && <p className="t-sub mt-1 whitespace-pre-wrap text-slate-700">{u.body}</p>}
                </Card>
              </li>
            ))}
          </ol>
        ))}
        {cur === 'requests' && (
          <>
            <Card>
              <p className="text-base font-black text-slate-900">다시 문의 · 추가 요청</p>
              <p className="t-sub mt-1 text-slate-500">담당 컨설턴트에게 바로 전달됩니다.</p>
              <Nope>보내기</Nope>
            </Card>
            {p.requests.length === 0 ? <Empty text="보낸 요청이 없습니다." /> : p.requests.map((r) => (
              <Card key={r.id}>
                <span className="t-meta flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-black text-slate-600">{MY.reqType[r.request_type] ?? r.request_type}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-black text-slate-600">{MY.req[r.status] ?? r.status}</span>
                  <span className="text-slate-400">{kdate(r.created_at)}</span>
                </span>
                <p className="mt-2 text-base font-black text-slate-900">{r.title}</p>
                {r.answer && <p className="t-sub mt-3 rounded-xl border border-slate-200 bg-white p-3 text-slate-800"><b>답변 · </b>{r.answer}</p>}
              </Card>
            ))}
          </>
        )}
        {cur === 'results' && (() => {
          const shared = p.documents.filter((d) => d.visibility === 'shared_with_customer')
          const results = p.updates.filter((u) => u.category === 'result')
          if (shared.length === 0 && results.length === 0) return <Empty text="아직 공개된 결과자료가 없습니다. 담당자가 결과를 공유하면 여기에 나타납니다." />
          return (
            <>
              {results.map((u) => <Card key={u.id}><p className="t-meta text-slate-400">{kdate(u.published_at)}{newResults.has(u.id) && <NewPill />}</p><p className="mt-1 text-base font-black text-slate-900">{u.title}</p></Card>)}
              {shared.length > 0 && <Card><p className="text-base font-black text-slate-900">공유된 자료</p><DocList docs={shared} newIds={newResults} /></Card>}
            </>
          )
        })()}
      </div>
    </div>
  )
}

/** D-686 고객 화면의 '새' 알약(빨강 — 고객 화면과 같은 모양) */
function NewPill() {
  return <span className="ml-2 rounded-full bg-danger-500 px-2 py-0.5 text-[0.75rem] font-black text-white" data-testid="cv-result-new">새</span>
}

function DocList({ docs, newIds }: { docs: PortalProjection['documents']; newIds?: ReadonlySet<string> }) {
  return (
    <ul className="mt-2 divide-y divide-slate-100">
      {docs.map((d) => (
        <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="t-sub font-bold text-slate-900">{d.title} <span className="t-meta ml-1 rounded-full bg-slate-100 px-2 py-0.5 font-black text-slate-600">{MY.doc[d.status] ?? d.status}</span>{newIds?.has(d.id) && <NewPill />}</p>
            <p className="t-meta mt-0.5 text-slate-500">{d.file_name ? `${d.file_name} · ` : ''}{d.requested_at ? `요청일 ${kdate(d.requested_at)}` : ''}</p>
          </div>
          {(d.status === 'requested' || d.status === 'rejected') && <Nope>{d.status === 'rejected' ? '다시 올리기' : '파일 올리기'}</Nope>}
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* 보고서 한 편(/my-projects/reports/:id)                                 */
/* ------------------------------------------------------------------ */

function ReportView({ report, company, consultant, seen, onBack }: { report: PortalReport | null; company: string; consultant: string; seen: PortalReceipt | null; onBack: () => void }) {
  if (!report) return <Empty text="이 보고서는 고객 화면에 없어요(내렸거나 새 판으로 바뀜)." />
  const period = report.periodStart && report.periodEnd ? `${md(report.periodStart)} ~ ${md(report.periodEnd)}` : ''
  return (
    <div className="max-w-3xl" data-testid="cv-report">
      <PageTitle title={report.title} subtitle={`${REPORT_KIND_LABEL[report.kind]}${period ? ` · ${period}` : ''}${consultant ? ` · 담당 ${consultant}` : ''}`} />
      <button type="button" onClick={onBack} className="tap t-sub inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft aria-hidden="true" className="size-4" /> 프로젝트로</button>
      <article className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7" data-testid="cv-report-body">
        <p className="t-meta font-bold text-slate-500">{company} · {kdate(report.publishedAt)} 보냄{report.version > 1 ? ` · 정정본(${report.version}판)` : ''}</p>
        {report.version > 1 && report.correctionNote && <p className="t-sub mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700">고친 곳: {report.correctionNote}</p>}
        {report.summary && <p className="t-body mt-3 whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]">{report.summary}</p>}
        {report.sections.map((s) => (
          <section key={s.key + s.title} className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="text-base font-black text-slate-900">{s.title}</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {s.items.map((i, n) => (
                <li key={n} className="t-body flex gap-2 text-slate-800">
                  <span aria-hidden="true" className="text-slate-400">·</span>
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{i.text}</span>
                  {i.date && <span className="t-sub shrink-0 text-slate-500 tabular-nums">{md(i.date)}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {report.staffNote && (
          <section className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="text-base font-black text-slate-900">담당자 한마디</h3>
            <p className="t-body mt-2 whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]">{report.staffNote}</p>
          </section>
        )}
      </article>
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled title={NOPE} className={`t-sub min-h-11 cursor-not-allowed rounded-xl px-5 font-bold ${seen?.acknowledgedAt ? 'border border-success-200 bg-success-50 text-success-700' : 'bg-slate-900 text-white opacity-60'}`} data-testid="cv-ack" data-acked={seen?.acknowledgedAt ? '1' : '0'}>
            {seen?.acknowledgedAt ? `확인함 · ${kdate(seen.acknowledgedAt)}` : '확인했어요'}
          </button>
          <button type="button" disabled title={NOPE} className="t-sub min-h-11 cursor-not-allowed rounded-xl border border-slate-300 bg-white px-4 font-bold text-slate-700 opacity-60">이 보고서 문의</button>
          <button type="button" disabled title={NOPE} className="t-sub min-h-11 cursor-not-allowed rounded-xl border border-slate-300 bg-white px-4 font-bold text-slate-700 opacity-60">인쇄 · PDF</button>
        </div>
        <p className="t-meta text-slate-500">{MY.ack}</p>
      </div>
    </div>
  )
}
