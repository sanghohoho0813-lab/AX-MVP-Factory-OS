/**
 * /ai — 대표 AI 전략실 첫 화면.
 *  - 빠른 등록: 회사명 · 홈페이지 · 요청자 · 관계 · 업종 · 메모(최소 회사명만). 같은 업체가 있으면 새로 만들기 전에 잇기를 먼저 권한다.
 *  - Partner OS 요청(ax_proposal_requested): 주소(?event=…) 또는 붙여넣은 JSON 으로 칸을 채운다.
 *  - 목록: 검색 · 관계 거르기 · 최근 작업 순.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart3, Brain, Building2, CalendarClock, Link2, Plus, Search, Sparkles } from 'lucide-react'
import { IconTile, KpiCard } from '../../components/ui/visual'
import { NextActionBar, PageHero, PageStack, SummaryStrip, WorkPanel } from '../../components/ui/pageFrame'
import { ArrangeArea, ArrangeItem } from '../../components/ui/arrange'
import { useIsPhone } from '../../lib/useIsPhone'
import { todayLocalDate } from '../../lib/appClock'
import { findDuplicates, normalizeCompany, relationForClient, type DuplicateHit } from '../../services/ownerAi/caseUtil'
import { parsePartnerHandoff, PARTNER_EVENT } from '../../services/ownerAi/partnerBridge'
import { OwnerAiSetupError } from '../../services/ownerAi/repo'
import { CASE_RELATIONS, RELATION_LABEL, type CaseMaterial, type CaseRelation, type CompanyCase } from '../../services/ownerAi/types'
import { registerCase } from '../../services/ownerAi/workflow'
import { useToast } from '../../components/ui/toastContext'
import { Badge, ListRow, Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { AiSetupBanner, OwnerAiGate, fmtDateTime, useAiSetup, useClientList, useOwnerAiIdentity, useOwnerAiRepo } from './shared'
import { CaseQuickStart } from './parts/CaseQuickStart'

export default function OwnerAiHomePage() {
  return (
    <OwnerAiGate>
      <Home />
    </OwnerAiGate>
  )
}

interface Draft {
  companyName: string
  homepageUrl: string
  bizNo: string
  requester: string
  relation: CaseRelation
  industry: string
  memo: string
  origin: string
}

const EMPTY: Draft = { companyName: '', homepageUrl: '', bizNo: '', requester: '', relation: 'reviewed', industry: '', memo: '', origin: '' }

function Home() {
  const repo = useOwnerAiRepo()
  const ident = useOwnerAiIdentity()
  const { clients } = useClientList()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { pathname } = useLocation()
  const { showToast } = useToast()
  const { setup } = useAiSetup()
  const [cases, setCases] = useState<CompanyCase[] | null>(null)
  const [dbSetup, setDbSetup] = useState(false)
  const [q, setQ] = useState('')
  const [rel, setRel] = useState<CaseRelation | 'all'>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const draftNow = draft
  const [saving, setSaving] = useState(false)
  const [partnerText, setPartnerText] = useState('')

  useEffect(() => {
    let alive = true
    repo
      .listCases()
      .then((l) => alive && setCases(l))
      .catch((e) => {
        if (!alive) return
        if (e instanceof OwnerAiSetupError) setDbSetup(true)
        setCases([])
      })
    return () => {
      alive = false
    }
  }, [repo])

  // Partner OS 주소로 왔으면 빠른 등록 칸을 채워 연다(/ai/new 도 여기로) — 한 번만
  const handoffDone = useRef(false)
  useEffect(() => {
    if (handoffDone.current) return
    if (params.get('event') !== PARTNER_EVENT && pathname !== '/ai/new') return
    handoffDone.current = true
    const h = parsePartnerHandoff(params)
    if (h) {
      setDraft({ ...EMPTY, companyName: h.companyName, homepageUrl: h.homepageUrl, bizNo: h.bizNo, requester: h.requester, memo: h.memo, relation: 'peer_request', origin: `partner:${PARTNER_EVENT}` })
      showToast('Partner OS 요청을 칸에 채웠습니다. 같은 업체가 있는지 먼저 확인해 주세요.')
    }
    setFormOpen(true)
    if (params.toString()) setParams({}, { replace: true })
  }, [params, setParams, showToast, pathname])

  const dups: DuplicateHit[] = useMemo(() => (draft.companyName.trim().length >= 2 || draft.bizNo || draft.homepageUrl ? findDuplicates({ name: draft.companyName, bizNo: draft.bizNo, url: draft.homepageUrl }, cases ?? [], clients) : []), [draft, cases, clients])

  const list = useMemo(() => {
    const nq = normalizeCompany(q)
    return (cases ?? [])
      .filter((c) => (showArchived ? !!c.archivedAt : !c.archivedAt))
      .filter((c) => rel === 'all' || c.relation === rel)
      .filter((c) => !nq || normalizeCompany(c.companyName).includes(nq) || (c.requester ?? '').includes(q.trim()))
  }, [cases, q, rel, showArchived])

  // D-255 서류로 시작했는데 이름을 못 찾아 직접 적는 경우 — 읽은 글을 자료로 들고 간다
  const [pendingMaterials, setPendingMaterials] = useState<CaseMaterial[]>([])
  const create = async (opts: { clientId?: string | null; from?: Partial<Draft>; materials?: CaseMaterial[] } = {}) => {
    const linked = opts.clientId ? clients.find((c) => c.id === opts.clientId) : null
    const draft = { ...draftNow, ...(opts.from ?? {}) }
    if (saving || !(linked?.companyName ?? draft.companyName).trim()) return
    setSaving(true)
    try {
      const c = await registerCase(repo, {
        ...draft,
        companyName: linked?.companyName ?? draft.companyName,
        bizNo: draft.bizNo || linked?.businessNumber || '',
        industry: draft.industry || linked?.industry || '',
        relation: linked && draft.relation === 'reviewed' ? relationForClient(linked) : draft.relation,
        clientId: opts.clientId ?? null,
        origin: draft.origin,
        materials: opts.materials ?? (pendingMaterials.length ? pendingMaterials : undefined),
        workspaceId: ident.workspaceId,
        userId: ident.userId,
      })
      setPendingMaterials([])
      showToast(`${c.companyName} — AI 전략실을 만들었습니다.`)
      navigate(`/ai/cases/${c.id}`)
    } catch (e) {
      if (e instanceof OwnerAiSetupError) setDbSetup(true)
      showToast(e instanceof Error ? e.message : '만들지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 사업자번호 · 홈페이지가 같은 작업실이 있으면 새로 만들지 않는다(이름만 같으면 확인 뒤 만들 수 있다)
  const strongCase = dups.find((d) => d.kind === 'case' && /사업자번호|홈페이지/.test(d.reason))

  // UXS-1 요약 줄 · 지금 할 일 — 목록이 이미 가진 값만 센다(새 데이터 없음)
  const active = (cases ?? []).filter((c) => !c.archivedAt)
  const weekAgo = (() => {
    const d = new Date(`${todayLocalDate()}T00:00:00`)
    d.setDate(d.getDate() - 7)
    return d.toISOString()
  })()
  const latest = [...active].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const phone = useIsPhone()

  return (
    <PageStack>
      <PageHero
        art="ai"
        title="AI 전략실"
        sub="대표 전용 · 업체마다 기억이 이어지는 AI 작업 · 결과는 채택한 것만 다음 작업에 씁니다"
        actions={
          <>
            <Button variant="primary" onClick={() => setFormOpen((v) => !v)} data-testid="case-new">
              <Plus aria-hidden="true" className="size-4" />
              업체 등록
            </Button>
            <Link to="/ai/usage" className="tap t-body inline-flex h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50 sm:h-10">
              <BarChart3 aria-hidden="true" className="size-4" />
              사용량
            </Link>
          </>
        }
        notice={<AiSetupBanner setup={setup} strip />}
      />
      {dbSetup && (
        <Surface>
          <p className="t-body font-semibold text-slate-900" data-testid="owner-ai-db-setup">AI 전략실 DB 설정이 필요합니다.</p>
          <p className="t-sub mt-1 break-keep text-slate-600">Supabase 에 0021 마이그레이션을 실행하면 업체 · 기억 · 실행 기록을 저장할 수 있습니다(docs/OWNER_AI_WORKSPACE_V1.md).</p>
        </Surface>
      )}

      {formOpen && (
        <Surface className="flex flex-col gap-3" >
          <h2 className="t-section text-slate-900">빠른 등록</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="case-form">
            <Field label="회사명 *" value={draft.companyName} onChange={(v) => setDraft({ ...draft, companyName: v })} placeholder="예: (주)한솔정밀" testId="case-name" />
            <Field label="홈페이지 · URL" value={draft.homepageUrl} onChange={(v) => setDraft({ ...draft, homepageUrl: v })} placeholder="www.example.co.kr" testId="case-url" />
            <Field label="요청자" value={draft.requester} onChange={(v) => setDraft({ ...draft, requester: v })} placeholder="예: 김○○ 컨설턴트" testId="case-requester" />
            <Field label="업종" value={draft.industry} onChange={(v) => setDraft({ ...draft, industry: v })} placeholder="예: 정밀기계 제조" testId="case-industry" />
            <Field label="사업자번호(선택)" value={draft.bizNo} onChange={(v) => setDraft({ ...draft, bizNo: v })} placeholder="000-00-00000" testId="case-bizno" />
            <label className="flex flex-col gap-1">
              <span className="t-sub font-semibold text-slate-700">관계</span>
              <select value={draft.relation} onChange={(e) => setDraft({ ...draft, relation: e.target.value as CaseRelation })} className="t-body min-h-11 rounded-(--radius-control) border border-slate-300 bg-white px-3" data-testid="case-relation-new">
                {CASE_RELATIONS.map((r) => (
                  <option key={r} value={r}>{RELATION_LABEL[r]}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="t-sub font-semibold text-slate-700">메모</span>
              <textarea value={draft.memo} onChange={(e) => setDraft({ ...draft, memo: e.target.value })} rows={3} maxLength={4000} placeholder="예: 동료가 AX 제안 가능성을 봐 달라고 함" className="t-body w-full rounded-(--radius-control) border border-slate-300 px-3 py-2" data-testid="case-memo" />
            </label>
          </div>

          {dups.length > 0 && (
            <div className="rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-3" data-testid="case-dups">
              <p className="t-sub font-semibold break-keep text-warning-700">같은 업체일 수 있습니다 — 새로 만들기 전에 확인해 주세요</p>
              <ul className="mt-2 flex flex-col gap-2">
                {dups.slice(0, 5).map((d) => (
                  <li key={`${d.kind}-${d.id}`} className="flex flex-wrap items-center gap-2">
                    <span className="t-body min-w-0 font-semibold break-words text-slate-900">{d.name}</span>
                    <Badge tone={d.strong ? 'warning' : 'neutral'}>{d.kind === 'case' ? 'AI 전략실' : '고객 관리'} · {d.reason}</Badge>
                    {d.kind === 'case' ? (
                      <Button size="sm" variant="primary" onClick={() => navigate(`/ai/cases/${d.id}`)} data-testid="dup-open-case">이 작업실 열기</Button>
                    ) : d.caseId ? (
                      <Button size="sm" variant="primary" onClick={() => navigate(`/ai/cases/${d.caseId}`)}>이어 둔 작업실 열기</Button>
                    ) : (
                      <Button size="sm" variant="primary" disabled={saving} onClick={() => void create({ clientId: d.id })} data-testid="dup-link-client">이 고객과 이어 만들기</Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => { setFormOpen(false); setDraft(EMPTY) }}>닫기</Button>
            <Button variant={dups.length ? 'secondary' : 'primary'} disabled={saving || !draft.companyName.trim() || !!strongCase} onClick={() => void create()} data-testid="case-create">
              {strongCase ? '같은 업체가 있어 새로 만들 수 없음' : dups.length ? '그래도 새로 만들기' : 'AI 전략실 만들기'}
            </Button>
          </div>

          <details className="t-sub text-slate-600">
            <summary className="tap min-h-11 cursor-pointer py-2 font-semibold">Partner OS 요청 붙여넣기</summary>
            <div className="flex flex-col gap-2 pb-1">
              <textarea value={partnerText} onChange={(e) => setPartnerText(e.target.value)} rows={4} placeholder={'{"event":"ax_proposal_requested","company":{"name":"…","url":"…"},"requester":{"name":"…"},"memo":"…"}'} className="t-body w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 font-mono text-[0.8125rem]" data-testid="partner-text" />
              <Button
                size="sm"
                variant="secondary"
                className="self-start"
                onClick={() => {
                  const h = parsePartnerHandoff(partnerText)
                  if (!h) {
                    showToast('Partner OS 요청 모양이 아닙니다(event: ax_proposal_requested · 회사 이름 필요).')
                    return
                  }
                  setDraft({ ...EMPTY, companyName: h.companyName, homepageUrl: h.homepageUrl, bizNo: h.bizNo, requester: h.requester, memo: h.memo, relation: 'peer_request', origin: `partner:${PARTNER_EVENT}` })
                  setPartnerText('')
                }}
                data-testid="partner-apply"
              >
                칸 채우기
              </Button>
            </div>
          </details>
        </Surface>
      )}

      {/* D-287 화면 꾸미기 — 요약 · 이어서 하기 · 바로 시작 · 업체 목록(휴대폰 기본은 이어서 하기가 요약 위 — UXS-1) */}
      <ArrangeArea page="ai-home" title="AI 전략실" className="flex flex-col gap-4 sm:gap-5" pairGap="gap-4 sm:gap-5">
        {phone && (
          <ArrangeItem id="next" label="이어서 하기" hint="가장 최근 업체 · 작업실 열기">
          {cases !== null && !dbSetup && !formOpen && (
            latest ? (
              <NextActionBar
                tone="purple"
                label="이어서 하기"
                title={latest.companyName}
                detail={[RELATION_LABEL[latest.relation], latest.contextVersion ? `기억 v${latest.contextVersion}` : '기억 없음', `${fmtDateTime(latest.updatedAt).slice(0, 10)} 마지막 작업`].join(' · ')}
                action={
                  <Button variant="primary" onClick={() => navigate(`/ai/cases/${latest.id}`)} data-testid="ai-next-open">
                    작업실 열기
                  </Button>
                }
                testId="ai-next"
              />
            ) : (
              <NextActionBar
                tone="purple"
                title="고객 관리에 있는 업체를 골라 바로 시작하세요"
                detail="회사 정보 · 서류 · 관계를 그대로 써서 작업실을 엽니다 — 타자 없이"
                testId="ai-next"
              />
            )
          )}
          </ArrangeItem>
        )}
        <ArrangeItem id="summary" label="한눈에 숫자" hint="검토 중 · 고객 관리와 이어짐 · 기억 · 이번 주 작업">
        {cases !== null && !dbSetup && (
          <SummaryStrip label="AI 전략실 한눈에" testId="ai-summary">
            <KpiCard icon={Building2} tone="purple" label="검토 중인 업체" value={`${active.length}곳`} hint={`보관 ${(cases ?? []).length - active.length}곳 따로`} testId="ai-kpi-active" />
            <KpiCard icon={Link2} tone="blue" label="고객 관리와 이어짐" value={`${active.filter((c) => c.clientId).length}곳`} hint="회사 정보 · 서류를 같이 씀" />
            <KpiCard icon={Brain} tone="purple" label="기억이 쌓인 곳" value={`${active.filter((c) => (c.contextVersion ?? 0) > 0).length}곳`} hint="채택한 결과를 다음 작업에" />
            <KpiCard icon={CalendarClock} tone="teal" label="이번 주 작업" value={`${active.filter((c) => c.updatedAt >= weekAgo).length}곳`} hint="지난 7일 안에 손댄 곳" />
          </SummaryStrip>
        )}
        </ArrangeItem>
        {!phone && (
          <ArrangeItem id="next" label="이어서 하기" hint="가장 최근 업체 · 작업실 열기">
          {cases !== null && !dbSetup && !formOpen && (
            latest ? (
              <NextActionBar
                tone="purple"
                label="이어서 하기"
                title={latest.companyName}
                detail={[RELATION_LABEL[latest.relation], latest.contextVersion ? `기억 v${latest.contextVersion}` : '기억 없음', `${fmtDateTime(latest.updatedAt).slice(0, 10)} 마지막 작업`].join(' · ')}
                action={
                  <Button variant="primary" onClick={() => navigate(`/ai/cases/${latest.id}`)} data-testid="ai-next-open">
                    작업실 열기
                  </Button>
                }
                testId="ai-next"
              />
            ) : (
              <NextActionBar
                tone="purple"
                title="고객 관리에 있는 업체를 골라 바로 시작하세요"
                detail="회사 정보 · 서류 · 관계를 그대로 써서 작업실을 엽니다 — 타자 없이"
                testId="ai-next"
              />
            )
          )}
          </ArrangeItem>
        )}
        <ArrangeItem id="quick" label="바로 시작 — 타자 없이" hint="고객 관리에서 고르기 · 서류 한 장으로">
        {cases !== null && !dbSetup && !formOpen && (
          <CaseQuickStart
            cases={cases}
            clients={clients}
            busy={saving}
            onPickClient={(id, materials) => void create({ clientId: id, materials })}
            onStartDocs={(d) => void create({ from: { companyName: d.companyName, bizNo: d.bizNo, memo: d.contactName ? `대표 ${d.contactName}` : '', origin: 'docs' }, materials: d.materials })}
            onOpenCase={(id) => navigate(`/ai/cases/${id}`)}
            onTypeIt={(materials) => {
              setPendingMaterials(materials)
              setFormOpen(true)
            }}
          />
        )}
        </ArrangeItem>
        <ArrangeItem id="list" label="업체 목록" hint="찾기 · 관계 · 보관">
        {/* UXS-1 본문 작업 판 — 검색 · 거르기는 판 첫 줄, 목록은 판 안 줄로(상자 안 상자 없음) */}
        <WorkPanel
          title="업체 목록"
          count={cases === null ? undefined : list.length}
          testId="case-list-panel"
          bodyClassName=""
          toolbar={
            <>
              <label className="relative min-w-0 flex-1 basis-56">
                <span className="sr-only">업체 찾기</span>
                <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="회사명 · 요청자" className="t-body min-h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white pr-3 pl-9" data-testid="case-search" />
              </label>
              <select value={rel} onChange={(e) => setRel(e.target.value as CaseRelation | 'all')} className="t-body min-h-11 rounded-(--radius-control) border border-slate-300 bg-white px-3" aria-label="관계 거르기">
                <option value="all">관계 전체</option>
                {CASE_RELATIONS.map((r) => (
                  <option key={r} value={r}>{RELATION_LABEL[r]}</option>
                ))}
              </select>
              <label className="tap t-sub flex min-h-11 items-center gap-2 text-slate-600">
                <input type="checkbox" className="size-5 accent-brand-600" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                보관한 것
              </label>
            </>
          }
        >
          {cases === null ? (
            <p className="t-sub px-4 pb-4 text-slate-500 sm:px-5" role="status">불러오는 중…</p>
          ) : list.length === 0 ? (
            <div className="border-t border-slate-100 px-4 py-8 text-center sm:px-5">
              <Sparkles aria-hidden="true" className="mx-auto size-6 text-brand-500" />
              <p className="t-body mt-2 break-keep text-slate-600">{(cases ?? []).length ? '조건에 맞는 업체가 없습니다.' : '아직 등록한 업체가 없습니다. 검토할 회사를 하나 등록해 보세요 — 회사명만 있어도 됩니다.'}</p>
              {!(cases ?? []).length && (
                <Button variant="primary" className="mt-3" onClick={() => setFormOpen(true)}>업체 등록</Button>
              )}
            </div>
          ) : (
            <div data-testid="case-list" className="divide-y divide-slate-100 border-t border-slate-100">
              {list.map((c) => (
                <ListRow
                  key={c.id}
                  leading={<IconTile icon={Building2} tone={c.clientId ? 'blue' : 'slate'} size="sm" />}
                  title={c.companyName}
                  badge={<Badge tone={c.relation === 'contracted' ? 'success' : c.relation === 'proposing' ? 'brand' : 'neutral'}>{RELATION_LABEL[c.relation]}</Badge>}
                  meta={[c.requester && `요청 ${c.requester}`, c.clientId && '고객 관리와 이어짐', c.contextVersion ? `기억 v${c.contextVersion}` : '기억 없음', `${fmtDateTime(c.updatedAt).slice(0, 10)} 작업`].filter(Boolean).join(' · ')}
                  onClick={() => navigate(`/ai/cases/${c.id}`)}
                />
              ))}
            </div>
          )}
        </WorkPanel>
        </ArrangeItem>
      </ArrangeArea>
    </PageStack>
  )
}

function Field({ label, value, onChange, placeholder, testId }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; testId?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="t-sub font-semibold text-slate-700">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={200} className="t-body min-h-11 w-full rounded-(--radius-control) border border-slate-300 px-3" data-testid={testId} />
    </label>
  )
}
