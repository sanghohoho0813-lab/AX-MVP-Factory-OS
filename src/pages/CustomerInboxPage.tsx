import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Inbox, RefreshCw, Sparkles } from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { ScreenTitle } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/toastContext'
import { ScrollHintRow } from '../components/ui/ScrollHintRow'
import { EventCard } from '../components/ops/EventCard'
import { LinkCustomerModal } from '../components/ops/LinkCustomerModal'
import { ScreenGuide } from '../components/onboarding/ScreenGuide'
import { listClients } from '../services/clientOpsService'
import { EVENT_TYPE_LABEL, isOpenEvent, listEvents, seedDemoEvents, updateEvent, waitingDays } from '../services/customerBridgeService'
import { todayLocalDate } from '../lib/appClock'
import { getDataModeConfig } from '../data/dataMode'
import { brand } from '../brand/brand.config'
import type { ClientOpsRecord } from '../types/clientOps'
import type { CustomerEvent, CustomerEventStatus, CustomerEventType } from '../types/bridge'

type Filter = 'open' | 'all' | CustomerEventStatus

/** 종류 칩 순서 — 먼저 챙길 것부터. 여기 없는 종류는 뒤에 붙는다. */
const TYPE_ORDER: CustomerEventType[] = [
  'service_order_created',
  'consultation_requested',
  'customer_request_created',
  'document_uploaded',
  'customer_signed_up',
  'diagnosis_completed',
  'customer_action_completed',
]

function isEventType(v: string | null): v is CustomerEventType {
  return v !== null && Object.prototype.hasOwnProperty.call(EVENT_TYPE_LABEL, v)
}

function matchesStatus(e: CustomerEvent, filter: Filter): boolean {
  if (filter === 'open') return isOpenEvent(e)
  if (filter === 'all') return true
  return e.status === filter
}

/** 브릿지 테이블이 아직 없을 때(마이그레이션 미적용) 나는 오류인지 */
function isNotReadyError(cause: unknown): boolean {
  const o = cause as { message?: unknown; code?: unknown; details?: unknown } | null
  const msg = [o?.message, o?.code, o?.details].filter((v) => typeof v === 'string').join(' ') || String(cause)
  return /relation .* does not exist|customer_events|42P01|schema cache/i.test(msg)
}

/**
 * 고객 이벤트함 — miraeailab.com 에서 일어난 일(진단·주문·서류·요청)이 여기로 들어온다.
 * 각 이벤트를 고객사에 연결하고 처리 상태를 남기면, 홈의 Top 3 와 업체 상세에도 반영된다.
 */
function InboxContent({ workspaceId }: { workspaceId: string | null }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const isLocal = getDataModeConfig().mode === 'local'
  const [events, setEvents] = useState<CustomerEvent[]>([])
  const [clients, setClients] = useState<ClientOpsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [notReady, setNotReady] = useState(false)
  const [filter, setFilter] = useState<Filter>('open')
  // 종류는 주소에 남긴다 — 오늘 화면·성과 지표에서 "회원가입만" 으로 바로 들어올 수 있게.
  const [params, setParams] = useSearchParams()
  const typeParam = params.get('type')
  const typeFilter: CustomerEventType | 'all' = isEventType(typeParam) ? typeParam : 'all'
  // D-111: 오래 기다린 것 먼저 — 들어온 지 오래된 열린 신청부터. 이것도 주소에 남긴다.
  const waitingFirst = params.get('sort') === 'waiting'
  const setWaitingFirst = (on: boolean) => {
    const next = new URLSearchParams(params)
    if (on) next.set('sort', 'waiting')
    else next.delete('sort')
    setParams(next, { replace: true })
  }
  const setTypeFilter = (t: CustomerEventType | 'all') => {
    const next = new URLSearchParams(params)
    if (t === 'all') next.delete('type')
    else next.set('type', t)
    setParams(next, { replace: true })
  }
  const [linking, setLinking] = useState<{ event: CustomerEvent; tab: 'existing' | 'new' } | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const c = await listClients(workspaceId)
      setClients(c)
      try {
        const e = await listEvents(workspaceId)
        setEvents(e)
        setNotReady(false)
      } catch (cause) {
        if (isNotReadyError(cause)) {
          setNotReady(true)
          setEvents([])
        } else {
          throw cause
        }
      }
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const clientNames = useMemo(() => new Map(clients.map((c) => [c.id, c.companyName])), [clients])

  const visible = useMemo(() => {
    const list = events.filter((e) => matchesStatus(e, filter) && (typeFilter === 'all' || e.eventType === typeFilter))
    if (!waitingFirst) return list
    // 열린 것 중 오래된 것 → 열린 것 중 새것 → 닫힌 것(원래 순서). 같은 날이면 원래 순서(급한 것 먼저)
    const today = todayLocalDate()
    return list
      .map((e, i) => ({ e, i, w: waitingDays(e, today) }))
      .sort((a, b) => (b.w ?? -1) - (a.w ?? -1) || a.i - b.i)
      .map((x) => x.e)
  }, [events, filter, typeFilter, waitingFirst])

  // 상태 칩 숫자는 고른 종류 안에서, 종류 칩 숫자는 고른 상태 안에서 센다 — 누르면 그 숫자만큼 나온다.
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { open: 0, all: 0, new: 0, linked: 0, in_progress: 0, resolved: 0, ignored: 0 }
    for (const e of events) {
      if (typeFilter !== 'all' && e.eventType !== typeFilter) continue
      c.all += 1
      c[e.status] += 1
      if (isOpenEvent(e)) c.open += 1
    }
    return c
  }, [events, typeFilter])

  const typeChips = useMemo(() => {
    const present = new Set(events.map((e) => e.eventType))
    if (typeFilter !== 'all') present.add(typeFilter)
    const inStatus = events.filter((e) => matchesStatus(e, filter))
    const types = [...present].sort((a, b) => {
      const ia = TYPE_ORDER.indexOf(a)
      const ib = TYPE_ORDER.indexOf(b)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
    return {
      total: inStatus.length,
      items: types.map((t) => ({ key: t, label: EVENT_TYPE_LABEL[t], count: inStatus.filter((e) => e.eventType === t).length })),
    }
  }, [events, filter, typeFilter])

  const setStatus = async (event: CustomerEvent, status: CustomerEventStatus) => {
    try {
      const updated = await updateEvent(event, { status })
      setEvents((list) => list.map((e) => (e.id === updated.id ? updated : e)))
      showToast(status === 'resolved' ? '처리 완료로 표시했습니다.' : status === 'ignored' ? '보류했습니다.' : '상태를 바꿨습니다.')
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    }
  }

  const filters: { key: Filter; label: string }[] = [
    { key: 'open', label: '열린 것' },
    { key: 'new', label: '새 신청' },
    { key: 'in_progress', label: '처리 중' },
    { key: 'resolved', label: '처리 완료' },
    { key: 'ignored', label: '보류' },
    { key: 'all', label: '전체' },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
      <ScreenTitle
        title="잠재고객 상담신청"
        sub={`${brand.customerPlatformLabel}에서 고객이 한 일이 여기로 들어옵니다.`}
        actions={
          <>
            <span className="hidden lg:inline-flex">
              <ScreenGuide screenKey="inbox" />
            </span>
            {/* 이 줄에 단추가 이것뿐이라 글자를 줄일 이유가 없다 — 아이콘만 있으면 무엇인지 모른다 */}
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw aria-hidden="true" className="size-4" />
              새로고침
            </Button>
          </>
        }
      />

      {notReady && (
        <div className="rounded-(--radius-panel) border border-warning-200 bg-warning-50 p-4">
          {/* D-122: 개발자 말(READY · 브릿지 · 마이그레이션 · 파일 경로)을 앞에 두지 않는다 */}
          <p className="text-[0.98rem] font-semibold text-warning-700">홈페이지 상담신청 연결을 아직 켜지 않았습니다</p>
          <p className="mt-1 text-[0.92rem] break-keep text-slate-700">
            연결이 켜지면 홈페이지에서 들어온 상담신청 · 주문 · 서류 업로드가 여기 저절로 쌓입니다. 관리자에게 '상담신청 연결을 켜 달라' 고 알려 주세요.
          </p>
          <details className="mt-2 text-[0.85rem] text-slate-500">
            <summary className="cursor-pointer">관리자용 안내</summary>
            <p className="mt-1 break-keep">클라우드에 브릿지 테이블이 없습니다. supabase/migrations/20260903000006_customer_bridge.sql 을 적용하세요(순서는 docs/SETUP.md).</p>
          </details>
        </div>
      )}

      {/* 한 줄로 유지하고 넘치면 옆으로 민다 — 두 줄이 되면 목록이 화면 밖으로 밀린다 */}
      {/* D-122: 오른쪽에 더 있으면 '›' */}
      <ScrollHintRow className="-mx-4 sm:mx-0" innerClassName="flex gap-1.5 px-4 sm:flex-wrap sm:px-0">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`tap t-sub shrink-0 rounded-full border px-3.5 py-2 font-medium whitespace-nowrap ${
              filter === f.key
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.label} <span className={counts[f.key] === 0 ? 'text-slate-400' : 'text-slate-500'}>{counts[f.key]}</span>
          </button>
        ))}
      </ScrollHintRow>

      {/* 종류가 두 가지 이상일 때만 — 한 가지뿐이면 고를 것이 없다 */}
      {typeChips.items.length >= 2 && (
        <div
          role="group"
          aria-label="종류별 보기"
          data-testid="inbox-type-filter"
          className="-mx-4 -mt-2 flex items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <span className="t-meta shrink-0 pr-0.5 text-slate-400">종류</span>
          {[{ key: 'all' as const, label: '전부', count: typeChips.total }, ...typeChips.items].map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={typeFilter === t.key}
              onClick={() => setTypeFilter(t.key)}
              className={`tap t-meta shrink-0 rounded-full border px-3 py-1.5 font-medium whitespace-nowrap ${
                typeFilter === t.key
                  ? 'border-navy-800 bg-navy-800 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}{' '}
              <span className={typeFilter === t.key ? 'text-white/70' : t.count === 0 ? 'text-slate-400' : 'text-slate-500'}>{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* D-111: 정렬 — 기본은 급한 것 · 새것 먼저, 켜면 오래 기다린 것 먼저 */}
      {!loading && visible.length > 1 && (
        <div className="-mt-2 flex items-center justify-end gap-1" role="group" aria-label="정렬">
          {[
            { on: false, label: '새것 먼저' },
            { on: true, label: '오래 기다린 것 먼저' },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={waitingFirst === o.on}
              data-testid={o.on ? 'inbox-sort-waiting' : 'inbox-sort-new'}
              onClick={() => setWaitingFirst(o.on)}
              className={`tap t-meta rounded-full px-2.5 py-1 font-medium ${
                waitingFirst === o.on ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-[0.95rem] text-slate-500">불러오는 중…</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-(--radius-panel) border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
          <Inbox aria-hidden="true" className="size-8 text-slate-300" />
          <p className="text-[1rem] font-semibold text-slate-700">{typeFilter !== 'all'
              ? `${EVENT_TYPE_LABEL[typeFilter]} 중에 해당하는 것이 없습니다.`
              : filter === 'open'
                ? '새 고객 요청이 없습니다.'
                : '해당하는 상담신청이 없습니다.'}</p>
          <p className="max-w-md text-[0.9rem] break-keep text-slate-500">
            고객이 {brand.customerPlatformLabel}에서 진단을 마치거나, 서비스를 주문하거나, 서류를 올리거나, 요청을 보내면 여기에 나타납니다.
          </p>
          {typeFilter !== 'all' && (
            <button type="button" onClick={() => setTypeFilter('all')} className="t-sub mt-1 font-medium text-brand-700 hover:underline">
              모든 종류 보기
            </button>
          )}
          {isLocal && filter === 'open' && typeFilter === 'all' && (
            <button
              type="button"
              onClick={() => {
                const created = seedDemoEvents()
                showToast(created.length ? `샘플 이벤트 ${created.length}건을 만들었습니다 (DEMO).` : '샘플 이벤트가 이미 있습니다.')
                void load()
              }}
              className="tap t-sub mt-2 inline-flex h-11 items-center gap-1.5 rounded-(--radius-control) border border-dashed border-slate-300 bg-white px-4 font-medium text-slate-600 hover:bg-slate-50 sm:h-10"
            >
              <Sparkles aria-hidden="true" className="size-4" /> 샘플 이벤트 만들기 (로컬 데모)
            </button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((e) => (
            <li key={e.id}>
              <EventCard
                event={e}
                clientName={e.operationsClientId ? (clientNames.get(e.operationsClientId) ?? null) : null}
                onLink={() => setLinking({ event: e, tab: 'existing' })}
                onCreateClient={() => setLinking({ event: e, tab: 'new' })}
                onStatus={(status) => void setStatus(e, status)}
              />
            </li>
          ))}
        </ul>
      )}

      {linking && (
        <LinkCustomerModal
          event={linking.event}
          clients={clients}
          workspaceId={workspaceId}
          initialTab={linking.tab}
          onClose={() => setLinking(null)}
          onDone={(updated, link) => {
            setLinking(null)
            setEvents((list) => list.map((e) => (e.id === updated.id ? updated : e)))
            // D-122: 다음 걸음 — 미팅 준비(1차 = 크레탑 분석기)로 바로
            const cid = updated.operationsClientId
            showToast(link ? '업체와 고객 계정을 연결했습니다.' : '업체에 연결했습니다.', cid ? { label: '미팅 준비 →', onClick: () => navigate(`/sales/meeting?client=${cid}&round=1`) } : undefined)
            void load()
          }}
        />
      )}
    </div>
  )
}

export function CustomerInboxPage() {
  return <WorkspaceScope>{(ctx) => <InboxContent workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}
