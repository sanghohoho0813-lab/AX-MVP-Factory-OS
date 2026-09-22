import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, FilePlus2, Link2 } from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { Badge, ScreenTitle, Section, type Tone } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/toastContext'
import { LinkCustomerModal } from '../components/ops/LinkCustomerModal'
import { listClients } from '../services/clientOpsService'
import { listEvents, updateEvent } from '../services/customerBridgeService'
import { HANDOFF_STATUS_LABEL, VALUE_AREA_LABEL, getPartnerHandoff, isHandoffNotReady, type HandoffEvidence, type HandoffLevel, type PartnerHandoff } from '../services/partnerHandoffService'
import { activityTimeText } from '../services/clientOpsActivity'
import type { ClientOpsRecord } from '../types/clientOps'
import type { CustomerEvent } from '../types/bridge'

const LEVEL_KO: Record<HandoffLevel, string> = { low: '낮음', medium: '보통', high: '높음' }
const LEVEL_TONE: Record<HandoffLevel, Tone> = { low: 'neutral', medium: 'brand', high: 'warning' }
const EVIDENCE: Record<HandoffEvidence, { icon: string; label: string; tone: Tone }> = {
  confirmed: { icon: '✅', label: '확인', tone: 'success' },
  assumed: { icon: '🟡', label: '추정', tone: 'warning' },
  unknown: { icon: '⚪', label: '미확인', tone: 'neutral' },
}
const INDUSTRY_KO: Record<string, string> = { manufacturing: '제조', distribution: '유통', construction: '건설', service: '서비스', food: '외식', logistics: '물류', medical: '의료/웰니스', environment: '환경', other: '기타' }
const TRADE_KO: Record<string, string> = { b2b: 'B2B', b2c: 'B2C', both: 'B2B+B2C', unknown: '미확인' }

/**
 * 파트너가 보낸 2차 AX 제안 요청 상세 — 1차 미팅 패킷을 읽고, [2차 제안 만들기] 로 고객사 운영 화면으로 넘어간다.
 * 여기서는 아무것도 새로 쓰지 않는다. 이벤트 상태(처리 중)만 바꾸면 파트너 화면의 상태가 트리거로 따라온다.
 */
function HandoffContent({ workspaceId }: { workspaceId: string | null }) {
  const { handoffId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [handoff, setHandoff] = useState<PartnerHandoff | null>(null)
  const [event, setEvent] = useState<CustomerEvent | null>(null)
  const [clients, setClients] = useState<ClientOpsRecord[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'not_ready' | 'missing'>('loading')
  const [linking, setLinking] = useState<'existing' | 'new' | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!handoffId) return
    try {
      setState('loading')
      const h = await getPartnerHandoff(handoffId)
      if (!h) {
        setState('missing')
        return
      }
      setHandoff(h)
      const [c, events] = await Promise.all([listClients(workspaceId), listEvents(workspaceId)])
      setClients(c)
      setEvent(events.find((e) => e.id === h.customerEventId) ?? events.find((e) => e.payload.handoff_id === h.id) ?? null)
      setState('ready')
    } catch (cause) {
      if (isHandoffNotReady(cause)) setState('not_ready')
      else {
        setState('missing')
        showToast(cause instanceof Error ? cause.message : '불러오지 못했습니다.')
      }
    }
  }, [handoffId, workspaceId, showToast])

  useEffect(() => {
    void load()
  }, [load])

  /** 2차 제안 만들기 — 이벤트를 '처리 중' 으로 바꾸고 고객사 운영 화면으로 이동 (연결 전이면 먼저 연결) */
  const startProposal = async () => {
    if (!event) return
    const clientId = event.operationsClientId ?? handoff?.operationsClientId ?? null
    if (!clientId) {
      setLinking('existing')
      return
    }
    setBusy(true)
    try {
      if (event.status !== 'in_progress' && event.status !== 'resolved') {
        const updated = await updateEvent(event, { status: 'in_progress' })
        setEvent(updated)
      }
      navigate(`/ops/clients/${clientId}`)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '상태를 바꾸지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const back = (
    <Link to="/ops/inbox" className="t-sub inline-flex items-center gap-1 text-slate-500 hover:text-slate-800">
      <ArrowLeft aria-hidden="true" className="size-4" /> 고객 이벤트함
    </Link>
  )

  if (state === 'loading') return <p className="py-8 text-center text-[0.95rem] text-slate-500">불러오는 중…</p>
  if (state === 'not_ready') {
    return (
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
        <ScreenTitle title="2차 AX 제안 요청" back={back} />
        <div className="rounded-(--radius-panel) border border-warning-200 bg-warning-50 p-4">
          <p className="text-[0.98rem] font-semibold text-warning-700">Partner OS 연결 준비 중 (READY)</p>
          <p className="mt-1 text-[0.92rem] break-keep text-slate-700">
            <code className="rounded bg-white px-1">partner_handoffs</code> 표가 아직 없습니다. Partner OS 저장소의 <code className="rounded bg-white px-1">supabase/migrations/20260922000001_partner_os.sql</code> 과 <code className="rounded bg-white px-1">…0002_partner_os_bridge.sql</code> 을 적용하면 파트너의 1차 미팅 패킷이 여기에 보입니다.
          </p>
        </div>
      </div>
    )
  }
  if (state === 'missing' || !handoff) {
    return (
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
        <ScreenTitle title="2차 AX 제안 요청" back={back} />
        <p className="text-[0.95rem] text-slate-500">전달 내역을 찾을 수 없습니다. (local 모드에는 Partner OS 패킷이 없습니다)</p>
      </div>
    )
  }

  const p = handoff.payload
  const scope = p.recommendedAxScope ?? {}
  const clientId = event?.operationsClientId ?? handoff.operationsClientId ?? null
  const clientName = clientId ? (clients.find((c) => c.id === clientId)?.companyName ?? null) : null

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
      <ScreenTitle
        title={`${p.company?.name ?? '업체'} · 2차 AX 제안 요청`}
        sub={`담당 ${p.consultant?.name ?? '파트너'} · 미팅 ${p.meetingDate ? activityTimeText(p.meetingDate) : '-'} · ${HANDOFF_STATUS_LABEL[handoff.status]}`}
        back={back}
        actions={
          <Button variant="primary" onClick={() => void startProposal()} disabled={busy || !event}>
            <FilePlus2 aria-hidden="true" className="size-4" /> 2차 제안 만들기
          </Button>
        }
      />

      {/* 연결 상태 — 고객사 연결은 사람이 확정한다 (중복 고객사 방지) */}
      <div className="t-sub flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-control) border border-slate-200 bg-white px-4 py-3">
        {clientId ? (
          <Link to={`/ops/clients/${clientId}`} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
            <Building2 aria-hidden="true" className="size-4" /> {clientName ?? '연결된 고객사'} 열기
          </Link>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Link2 aria-hidden="true" className="size-4" /> 아직 고객사와 연결되지 않음
            </span>
            {event && (
              <>
                <Button size="sm" variant="primary" onClick={() => setLinking('existing')}>
                  고객사와 연결
                </Button>
                <Button size="sm" onClick={() => setLinking('new')}>
                  새 고객사로 만들기
                </Button>
              </>
            )}
          </>
        )}
        {!event && <span className="text-slate-500">· 이벤트함에서 이 건을 찾지 못했습니다 (다른 워크스페이스로 라우팅됐을 수 있음)</span>}
      </div>

      <Section title="핵심 문제 TOP 3 (문제 → 손실 → AX 구조)">
        <ol className="flex flex-col gap-2">
          {(p.painPoints ?? []).map((pp) => (
            <li key={pp.area} className="rounded-(--radius-control) border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-brand-600 text-[0.85rem] font-bold text-white">{pp.rank}</span>
                <span className="text-[1rem] font-semibold text-slate-900">{pp.title}</span>
                <Badge tone={EVIDENCE[pp.status]?.tone ?? 'neutral'}>
                  {EVIDENCE[pp.status]?.icon} {EVIDENCE[pp.status]?.label}
                </Badge>
              </div>
              <p className="t-sub mt-1 text-slate-700">↓ {pp.loss}</p>
              <p className="t-sub text-brand-700">↓ {pp.axStructure}</p>
              <p className="t-meta mt-1 text-slate-500">고객용 표현: {pp.clientSafeTitle}</p>
            </li>
          ))}
          {(p.painPoints ?? []).length === 0 && <li className="t-sub text-slate-500">강한 문제 신호 없음 — 추가 확인 항목을 보세요.</li>}
        </ol>
      </Section>

      <Section title="범위 가설 (분리 평가 — 하나의 점수로 합치지 않음)">
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['AX 필요도', scope.axNeed],
              ['실증 잠재력', scope.validationPotential],
              ['성장자금 활용 준비도', scope.fundingReadiness],
            ] as const
          ).map(([label, lv]) => (
            <div key={label} className="rounded-(--radius-control) bg-slate-50 p-3">
              <p className="t-meta font-semibold text-slate-500">{label}</p>
              <p className="mt-1 text-[1rem] font-semibold">{lv ? <Badge tone={LEVEL_TONE[lv]}>{LEVEL_KO[lv]}</Badge> : '-'}</p>
            </div>
          ))}
          <div className="rounded-(--radius-control) bg-slate-50 p-3">
            <p className="t-meta font-semibold text-slate-500">예상 구축범위</p>
            <p className="mt-1 text-[1rem] font-semibold">
              <Badge tone="brand">LEVEL {scope.scopeLevel ?? '-'}</Badge> {scope.scopeLabel ?? ''}
            </p>
          </div>
        </div>
        {scope.scopeReason && <p className="t-sub mt-2 text-slate-700">{scope.scopeReason}</p>}
        <p className="t-meta mt-1 text-slate-500">정확한 견적과 3년 Value Map 은 여기(운영 OS)에서 만든다. 파트너 앱은 가설까지만 낸다.</p>
      </Section>

      {(p.keyQuotes ?? []).length > 0 && (
        <Section title="대표 핵심발언">
          {(p.keyQuotes ?? []).map((q) => (
            <blockquote key={q} className="rounded-(--radius-control) border-l-4 border-brand-600 bg-slate-50 px-4 py-3 text-[1rem] font-semibold text-slate-900">
              “{q}”
            </blockquote>
          ))}
        </Section>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Section title="가치 가능영역">
          <ul className="t-sub flex flex-col gap-1">
            {Object.entries(p.valuePotential ?? {}).map(([k, lv]) => (
              <li key={k} className="flex items-center justify-between">
                <span>{VALUE_AREA_LABEL[k] ?? k}</span>
                <Badge tone={LEVEL_TONE[lv] ?? 'neutral'}>{LEVEL_KO[lv] ?? lv}</Badge>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="추가 확인 · 자금 관심">
          <ol className="t-sub list-decimal pl-5">
            {(p.followupQuestions ?? []).map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
          <p className="t-sub mt-2 text-slate-700">
            정책자금/정부지원 관심: <b>{p.fundingInterest?.note ?? '미확인'}</b>
          </p>
          {p.similarCases && p.similarCases.length > 0 && (
            <p className="t-sub mt-2 text-slate-700">유사사례: {p.similarCases.map((c) => c.companyName).join(' · ')}</p>
          )}
        </Section>
      </div>

      <Section title="답변 원본 (현장에서 클릭한 그대로)">
        <ul className="t-sub divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200 bg-white">
          {(p.answers ?? []).map((a) => (
            <li key={a.questionId} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
              <span className="text-slate-700">{a.question}</span>
              <span className="font-semibold text-slate-900">
                {a.answerLabel}
                {a.source === 'diagnosis' && <Badge tone="warning">사전진단</Badge>}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="사실 · 추정 · 미확인">
        <div className="grid gap-3 md:grid-cols-3">
          {(
            [
              ['confirmed', p.confirmedFacts ?? []],
              ['assumed', p.assumptions ?? []],
              ['unknown', p.unknownItems ?? []],
            ] as const
          ).map(([s, facts]) => (
            <div key={s}>
              <Badge tone={EVIDENCE[s].tone}>
                {EVIDENCE[s].icon} {EVIDENCE[s].label}
              </Badge>
              <ul className="t-sub mt-2 flex flex-col gap-1">
                {facts.map((f) => (
                  <li key={f.key}>
                    <b>{f.label}</b> · {f.value}
                  </li>
                ))}
                {facts.length === 0 && <li className="text-slate-400">없음</li>}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-5 md:grid-cols-2">
        <Section title="INTERNAL — 파트너 내부 메모">
          <p className="t-sub whitespace-pre-wrap text-slate-700">{p.internalNotes || '없음'}</p>
          <p className="t-meta text-slate-500">고객 문서에 그대로 옮기지 않는다.</p>
        </Section>
        <Section title="CLIENT SAFE — 고객 문서용 문장">
          <ul className="t-sub list-disc pl-5 text-slate-700">
            {(p.clientSafeSummary ?? []).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>
      </div>

      <p className="t-meta text-slate-400">
        기업 기본정보: {p.company ? `${INDUSTRY_KO[p.company.industry ?? ''] ?? p.company.industry ?? ''} · ${p.company.headcount ?? ''} · ${TRADE_KO[p.company.tradeType ?? ''] ?? ''}` : ''}
        {p.usage?.durationSec ? ` · 미팅 ${Math.round(p.usage.durationSec / 60)}분` : ''}
        {typeof p.usage?.skipped === 'number' ? ` · 건너뜀 ${p.usage.skipped}` : ''}
      </p>

      {linking && event && (
        <LinkCustomerModal
          event={event}
          clients={clients}
          workspaceId={workspaceId}
          initialTab={linking}
          onClose={() => setLinking(null)}
          onDone={(updated) => {
            setLinking(null)
            setEvent(updated)
            showToast('고객사에 연결했습니다. 이제 [2차 제안 만들기] 를 누르세요.')
            void load()
          }}
        />
      )}
    </div>
  )
}

export function PartnerHandoffPage() {
  return <WorkspaceScope>{(ctx) => <HandoffContent workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}
