/**
 * 지원사업 알림 (D-141) — 토스 · 카카오톡의 '마감 임박 정부지원금' 처럼 보이되, 우리 업체 조건에 맞춘다.
 *
 *  공고별: 지역 · 갈래 칩 → 마감 급한 순 목록 → 공고마다 '맞는 업체 N곳(계약 고객 · 잠재고객)'
 *          → 공고를 누르면 맞는 업체 · 이유 · [카톡 문구 복사] · [고객 화면에 올리기]
 *  업체별: 업체마다 맞는 공고 수 · 이번 주 마감 → 누르면 그 업체에 맞는 공고 전부 · 한 통 문구 · 찾기 링크
 *
 * 영업: 잠재고객에게 "대표님 회사 조건으로 지금 신청 가능한 사업 N건" — 연락할 이유가 된다.
 * 가망고객 스스로: 찾기 링크(/grants/find) — 로그인 없이 자기 조건으로 보고 알림을 신청한다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BellRing, Link2, Plus, Search } from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { useToast } from '../components/ui/toastContext'
import { Button } from '../components/ui/Button'
import { Blank, BottomSheet, ScreenTitle } from '../components/ui/primitives'
import { AddNoticeSheet, CategoryChips, NoticeRow } from '../components/grants/GrantParts'
import { ClientGrantPanel, NoticeSheet } from '../components/grants/GrantSheets'
import { useGrantActions, useGrantData } from '../components/grants/useGrants'
import { GrantFeedBar } from '../components/grants/GrantFeedBar'
import { isFeedNotice } from '../services/grants/grantFeed'
import { listClients, saveClient } from '../services/clientOpsService'
import { applicationFor, applyReadiness, withGrantApplication } from '../services/grants/grantApply'
import { todayLocalDate } from '../lib/appClock'
import type { ClientOpsRecord } from '../types/clientOps'
import { SIDO_LIST, deadlineOf, deadlineRank, inRegion, targetsSomeone, type GrantCategory, type GrantMatch, type GrantNotice } from '../services/grants/grantMatch'
import { exampleNotices } from '../services/grants/grantExamples'
import { addNotices, removeNotice, saveNotice, sentAt } from '../services/grants/grantStore'
import { CLIENT_KIND_LABEL, clientsForNotice, fitSummary, grantClients, grantIndex, reachOf, type GrantClient, type NoticeInput } from '../services/grants/grantView'
import { profileLine } from '../services/grants/grantProfile'

type View = 'notices' | 'clients'

/** 한 번에 보여 줄 공고 수 — 1,000건도 화면이 무겁지 않게 '더 보기' 로 이어 본다 */
const PAGE = 50

function GrantsContent({ workspaceId }: { workspaceId: string | null }) {
  const today = todayLocalDate()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [params, setParams] = useSearchParams()
  const { notices, setNotices, sent, setSent, linkOf, loaded, error, reload, feed } = useGrantData(workspaceId)
  const actions = useGrantActions({ workspaceId, setSent, linkOf, toast: showToast })
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    listClients(workspaceId)
      .then(setRecords)
      .catch((cause) => setLoadError(cause instanceof Error ? cause.message : '업체를 불러오지 못했습니다.'))
  }, [workspaceId])

  // D-151: 공고 → 이 업체로 신청 준비(업체의 자금 · 지원사업 신청 건). 저장 직전에 업체를 다시 읽어 다른 화면에서 고친 것을 덮지 않는다
  const [applying, setApplying] = useState('')
  const applyFor = async (notice: GrantNotice, record: ClientOpsRecord) => {
    if (applying) return
    setApplying(record.id)
    try {
      const fresh = (await listClients(workspaceId)).find((r) => r.id === record.id) ?? record
      const out = withGrantApplication(fresh, notice)
      const saved = out.record === fresh ? fresh : await saveClient(out.record)
      setRecords((prev) => prev.map((r) => (r.id === saved.id ? saved : r)))
      const app = applicationFor(saved, notice) ?? out.app
      const rd = applyReadiness(saved, app, today)
      showToast(
        out.created
          ? `${saved.companyName} — 신청 준비를 시작했어요 · 서류 ${rd.ready}/${rd.total}`
          : `${saved.companyName} — 이미 신청 준비 중이에요 · 서류 ${rd.ready}/${rd.total}`,
      )
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다. 다시 눌러 주세요.')
    } finally {
      setApplying('')
    }
  }

  const view: View = params.get('view') === 'clients' ? 'clients' : 'notices'
  const region = SIDO_LIST.includes(params.get('r') ?? '') ? (params.get('r') as string) : ''
  const [category, setCategory] = useState<GrantCategory | 'all'>('all')
  const [onlyReach, setOnlyReach] = useState(false)
  const [kindFilter, setKindFilter] = useState<'all' | 'contract' | 'prospect'>('all')
  const [showClosed, setShowClosed] = useState(false)
  const [query, setQuery] = useState('')
  const [paging, setPaging] = useState({ key: '', n: PAGE })
  const [openId, setOpenId] = useState(() => params.get('open') ?? '')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<GrantNotice | null>(null)
  const clientId = params.get('client') ?? ''

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const clients = useMemo(() => grantClients(records, today), [records, today])
  // 업체 × 공고는 한 번만 계산한다(오늘 · 업체 상세 · 고객 관리가 같은 결과를 다시 쓴다)
  const index = useMemo(() => grantIndex(notices, clients, today), [notices, clients, today])
  const reach = index.byNotice

  const regional = useMemo(() => notices.filter((n) => inRegion(n, region, '')), [notices, region])
  const open = useMemo(() => regional.filter((n) => deadlineOf(n, today).state !== 'closed'), [regional, today])
  const closed = useMemo(() => regional.filter((n) => deadlineOf(n, today).state === 'closed'), [regional, today])
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const n of open) c[n.category] = (c[n.category] ?? 0) + 1
    return c
  }, [open])
  const listed = useMemo(
    () =>
      open
        .filter((n) => category === 'all' || n.category === category)
        .filter((n) => !onlyReach || reachOf(reach.get(n.id) ?? []).fit > 0)
        .filter((n) => !query.trim() || `${n.title} ${n.agency} ${n.operator} ${n.target}`.toLowerCase().includes(query.trim().toLowerCase()))
        .map((n) => ({ n, d: deadlineOf(n, today) }))
        .sort((a, b) => deadlineRank(a.d) - deadlineRank(b.d) || a.n.title.localeCompare(b.n.title))
        .map((x) => x.n),
    [open, category, onlyReach, reach, today, query],
  )
  const urgent = open.filter((n) => deadlineOf(n, today).urgent).length
  // 거르기를 바꾸면 처음 50개부터 다시
  const pageKey = `${category}|${onlyReach}|${region}|${query}`
  const limit = paging.key === pageKey ? paging.n : PAGE

  const byClient = useMemo(
    () =>
      clients
        .map((c) => ({ c, ms: index.byClient.get(c.record.id) ?? [] }))
        .filter((x) => kindFilter === 'all' || x.c.kind === kindFilter)
        .map((x) => ({ ...x, sum: fitSummary(x.ms) }))
        .sort((a, b) => b.sum.fit - a.sum.fit || b.sum.check - a.sum.check || a.c.record.companyName.localeCompare(b.c.record.companyName)),
    [clients, index, kindFilter],
  )

  const saveOne = async (v: NoticeInput, id?: string) => {
    const saved = await saveNotice(workspaceId, { ...v, id, ...(editing ? { createdAt: editing.createdAt } : {}) })
    setNotices((prev) => [saved, ...prev.filter((x) => x.id !== saved.id)])
    showToast(id ? '공고를 고쳤습니다' : `공고를 넣었습니다 — 맞는 업체 ${reachOf(clientsForNotice(saved, clients, today)).fit}곳`)
    setAdding(false)
    setEditing(null)
  }
  const saveMany = async (list: NoticeInput[]) => {
    const r = await addNotices(workspaceId, list, notices)
    await reload()
    showToast(`공고 ${r.added}개를 넣었습니다${r.skipped ? ` · 이미 있는 ${r.skipped}개 건너뜀` : ''}`)
    setAdding(false)
  }
  const addExamples = async () => {
    const r = await addNotices(workspaceId, exampleNotices(today), notices)
    await reload()
    showToast(`예시 공고 ${r.added}개를 넣었습니다 — 실제 공고를 넣으면 지워 주세요`)
  }

  const current = notices.find((n) => n.id === openId) ?? null
  const currentClient = clients.find((c) => c.record.id === clientId) ?? null
  const sentForClient = useCallback((cid: string) => (nid: string) => sentAt(sent, cid, nid), [sent])

  return (
    <div className="flex flex-col gap-5">
      <ScreenTitle
        title="지원사업 알림"
        sub={`공고 ${notices.length.toLocaleString()}개 · 접수 중 ${open.length.toLocaleString()}개 · 7일 안에 마감 ${urgent}개`}
        actions={
          <>
            <Button variant="primary" onClick={() => setAdding(true)} data-testid="grant-add-open">
              <Plus aria-hidden="true" className="size-4" /> 공고 넣기
            </Button>
            <Button variant="secondary" onClick={() => void actions.copyLink(null)} data-testid="grant-finder-link">
              <Link2 aria-hidden="true" className="size-4" /> 가망고객용 찾기 링크
            </Button>
          </>
        }
      />

      {(error || loadError) && (
        <p role="alert" className="t-sub rounded-(--radius-control) border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700">
          {error || loadError}
        </p>
      )}

      <GrantFeedBar feed={feed} onRefresh={() => void feed.refresh()} />

      <div role="tablist" className="flex max-w-md rounded-(--radius-control) border border-slate-200 bg-slate-50 p-0.5">
        {(
          [
            ['notices', '공고별'],
            ['clients', '업체별'],
          ] as [View, string][]
        ).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} data-testid={`grant-view-${k}`} onClick={() => setParam('view', k === 'notices' ? '' : k)} className={`tap t-body flex-1 rounded-[8px] px-3 py-2 font-semibold ${view === k ? 'bg-white text-slate-900 shadow-(--shadow-card)' : 'text-slate-500'}`}>
            {l}
          </button>
        ))}
      </div>

      {view === 'notices' && (
        <>
          <section className="flex flex-col gap-3" aria-label="지역 · 갈래">
            <h2 className="t-section break-keep text-slate-900" data-testid="grant-hero">
              <label className="inline-flex items-center">
                <span className="sr-only">지역</span>
                <select value={region} onChange={(e) => setParam('r', e.target.value)} data-testid="grant-region" className="tap mr-1 rounded-(--radius-control) border-0 bg-transparent p-0 pr-1 font-bold text-brand-700 focus:outline-none">
                  <option value="">전국</option>
                  {SIDO_LIST.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              에서 접수 중인 지원사업 <span className="text-brand-700">{open.length}개</span>
            </h2>
            <CategoryChips value={category} counts={counts} onChange={setCategory} />
            <label className="relative flex max-w-md items-center">
              <span className="sr-only">공고 찾기</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="공고 이름 · 기관으로 찾기"
                data-testid="grant-search"
                className="t-body w-full rounded-(--radius-control) border border-slate-300 bg-white py-2.5 pr-3 pl-9 focus:border-brand-500 focus:outline-none"
              />
            </label>
            <label className="tap t-sub inline-flex items-center gap-2 self-start text-slate-700">
              <input type="checkbox" checked={onlyReach} onChange={(e) => setOnlyReach(e.target.checked)} className="size-5 accent-brand-600" data-testid="grant-only-reach" />
              맞는 업체가 있는 공고만
            </label>
          </section>

          {loaded && notices.length === 0 ? (
            <Blank
              icon={<BellRing className="size-8" />}
              title="아직 넣은 공고가 없어요. 기업마당 공고 글을 붙여 넣으면 우리 업체 중 맞는 곳을 바로 찾아 드립니다."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" onClick={() => setAdding(true)}>
                    공고 넣기
                  </Button>
                  <Button variant="secondary" onClick={() => void addExamples()} data-testid="grant-examples">
                    예시 공고 6개 넣어 보기
                  </Button>
                </div>
              }
            />
          ) : listed.length === 0 ? (
            <Blank title={open.length === 0 ? '접수 중인 공고가 없습니다.' : '이 조건에 맞는 공고가 없습니다.'} />
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white" data-testid="grant-list">
              {listed.slice(0, limit).map((n) => {
                const r = reachOf(reach.get(n.id) ?? [])
                return (
                  <NoticeRow
                    key={n.id}
                    notice={n}
                    today={today}
                    onOpen={() => setOpenId(n.id)}
                    extra={
                      <span className="t-sub flex flex-wrap gap-x-2" data-testid="grant-reach">
                        {r.fit > 0 ? (
                          <span className="font-semibold text-success-700">
                            맞는 업체 {r.fit}곳{r.contract && r.prospect ? ` (계약 ${r.contract} · 잠재 ${r.prospect})` : r.prospect ? ' (잠재고객)' : ''}
                          </span>
                        ) : r.check === 0 && !targetsSomeone(n.rules) ? (
                          <span className="text-brand-700">전국 공통 · 누구나</span>
                        ) : (
                          <span className="text-slate-400">맞는 업체 없음</span>
                        )}
                        {r.check > 0 && <span className="text-warning-800">확인 필요 {r.check}곳</span>}
                      </span>
                    }
                  />
                )
              })}
            </ul>
          )}
          {listed.length > limit && (
            <Button variant="secondary" onClick={() => setPaging({ key: pageKey, n: limit + PAGE * 2 })} data-testid="grant-more" className="self-center">
              더 보기 (남은 {(listed.length - limit).toLocaleString()}개)
            </Button>
          )}

          {closed.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowClosed((v) => !v)} className="tap t-sub font-semibold text-slate-500 hover:text-slate-700" aria-expanded={showClosed}>
                마감된 공고 {closed.length}개 {showClosed ? '접기' : '보기'}
              </button>
              {showClosed && (
                <ul className="mt-2 flex flex-col divide-y divide-slate-100 overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white opacity-80">
                  {closed.map((n) => (
                    <NoticeRow key={n.id} notice={n} today={today} onOpen={() => setOpenId(n.id)} />
                  ))}
                </ul>
              )}
            </div>
          )}
          {notices.length > 0 && notices.every((n) => n.source === 'example') && (
            <p className="t-sub text-slate-500">지금은 예시 공고뿐입니다. 실제 공고를 넣으면 예시는 공고를 눌러 지울 수 있어요.</p>
          )}
        </>
      )}

      {view === 'clients' && (
        <section className="flex flex-col gap-3" aria-label="업체별">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['all', '전체'],
                ['contract', '계약 고객'],
                ['prospect', '잠재고객'],
              ] as ['all' | 'contract' | 'prospect', string][]
            ).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={kindFilter === k} onClick={() => setKindFilter(k)} data-testid={`grant-kind-filter-${k}`} className={`tap t-sub rounded-full border px-3 py-1.5 font-semibold ${kindFilter === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>
                {l}
              </button>
            ))}
          </div>
          {byClient.length === 0 ? (
            <Blank title="업체가 없습니다." />
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white" data-testid="grant-client-list">
              {byClient.map(({ c, sum }) => {
                const fit = sum.fit
                const hot = sum.urgentFit
                const last = sent.find((s) => s.clientId === c.record.id)?.at ?? ''
                return (
                  <li key={c.record.id}>
                    <button type="button" onClick={() => setParam('client', c.record.id)} data-testid="grant-client-row" data-client={c.record.id} className="tap flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50 sm:px-5">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="t-body truncate font-semibold text-slate-900">{c.record.companyName}</span>
                        <span className="t-sub truncate text-slate-500">
                          <span className={c.kind === 'prospect' ? 'font-semibold text-cat-client-700' : ''}>{CLIENT_KIND_LABEL[c.kind]}</span>
                          {profileLine(c.profile) ? ` · ${profileLine(c.profile)}` : ' · 업체 정보 비어 있음'}
                          {last ? ` · 알림 ${Number(last.slice(5, 7))}/${Number(last.slice(8, 10))}` : ''}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <span className={`t-body font-semibold tabular-nums ${fit > 0 ? 'text-success-700' : 'text-slate-400'}`} data-testid="grant-client-fit">
                          맞음 {fit}
                        </span>
                        {hot > 0 ? (
                          <span className="t-meta font-semibold text-danger-700">7일 안 마감 {hot}</span>
                        ) : !c.profile.sido || !c.profile.years || !c.profile.industry.trim() ? (
                          <span className="t-meta text-warning-800">정보를 적으면 맞춤</span>
                        ) : sum.check > 0 ? (
                          <span className="t-meta text-warning-800">확인 {sum.check}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {current && (
        <NoticeSheet
          notice={current}
          today={today}
          matches={reach.get(current.id) ?? []}
          sentOf={(cid) => sentAt(sent, cid, current.id)}
          linked={(cid) => linkOf(cid) !== null}
          onCopy={(x) => void actions.copyNotice(x.client, x.match)}
          onPortal={(x) => void actions.toPortal(x.client, [x.match])}
          readOnly={isFeedNotice(current)}
          onApply={(x) => void applyFor(current, x.client.record)}
          onOpenApply={(cid) => navigate(`/ops/clients/${cid}?tab=funding`)}
          onEdit={() => {
            setEditing(current)
            setOpenId('')
          }}
          onTogglePublish={() => void saveOne({ ...current, published: !current.published }, current.id)}
          onDelete={() => {
            void removeNotice(workspaceId, current).then(() => {
              setNotices((prev) => prev.filter((x) => x.id !== current.id))
              setOpenId('')
              showToast('공고를 지웠습니다')
            })
          }}
          onOpenClient={(cid) => {
            setOpenId('')
            setParam('client', cid)
          }}
          onClose={() => setOpenId('')}
        />
      )}

      {currentClient && (
        <ClientSheet
          client={currentClient}
          matches={index.byClient.get(currentClient.record.id) ?? []}
          sentOf={sentForClient(currentClient.record.id)}
          linked={linkOf(currentClient.record.id) !== null}
          actions={actions}
          onPick={(id) => {
            setParam('client', '')
            setOpenId(id)
          }}
          onDetail={() => navigate(`/ops/clients/${currentClient.record.id}`)}
          onClose={() => setParam('client', '')}
        />
      )}

      {(adding || editing) && (
        <AddNoticeSheet
          title={editing ? '공고 고치기' : '공고 넣기'}
          initial={editing ? { ...editing } : undefined}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
          onSave={(v) => saveOne(v, editing?.id)}
          onSaveMany={saveMany}
        />
      )}
    </div>
  )
}

function ClientSheet({
  client,
  matches,
  sentOf,
  linked,
  actions,
  onPick,
  onDetail,
  onClose,
}: {
  client: GrantClient
  matches: GrantMatch[]
  sentOf: (noticeId: string) => string
  linked: boolean
  actions: ReturnType<typeof useGrantActions>
  onPick: (noticeId: string) => void
  onDetail: () => void
  onClose: () => void
}) {
  return (
    <BottomSheet title={client.record.companyName} onClose={onClose}>
      <div className="flex flex-col gap-3" data-testid="client-sheet">
        <p className="t-sub text-slate-500">{CLIENT_KIND_LABEL[client.kind]}</p>
        <ClientGrantPanel
          client={client}
          matches={matches}
          sentOf={sentOf}
          linked={linked}
          onCopyAll={() => void actions.copyAll(client, matches.filter((m) => m.verdict !== 'general'))}
          onCopyLink={() => void actions.copyLink(client)}
          onPortal={() => void actions.toPortal(client, matches.filter((m) => m.verdict !== 'general'))}
          onPick={(m) => onPick(m.notice.id)}
          onFill={onDetail}
        />
        <Button variant="ghost" onClick={onDetail} className="self-start">
          업체 상세 열기
        </Button>
      </div>
    </BottomSheet>
  )
}

export default function GrantsPage() {
  return <WorkspaceScope>{(ctx) => <GrantsContent workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}
