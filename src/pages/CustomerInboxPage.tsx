import { useCallback, useEffect, useMemo, useState } from 'react'
import { Inbox, RefreshCw, Sparkles } from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { ScreenTitle } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/toastContext'
import { EventCard } from '../components/ops/EventCard'
import { LinkCustomerModal } from '../components/ops/LinkCustomerModal'
import { ScreenGuide } from '../components/onboarding/ScreenGuide'
import { listClients } from '../services/clientOpsService'
import { isOpenEvent, listEvents, seedDemoEvents, updateEvent } from '../services/customerBridgeService'
import { getDataModeConfig } from '../data/dataMode'
import { brand } from '../brand/brand.config'
import type { ClientOpsRecord } from '../types/clientOps'
import type { CustomerEvent, CustomerEventStatus } from '../types/bridge'

type Filter = 'open' | 'all' | CustomerEventStatus

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
  const isLocal = getDataModeConfig().mode === 'local'
  const [events, setEvents] = useState<CustomerEvent[]>([])
  const [clients, setClients] = useState<ClientOpsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [notReady, setNotReady] = useState(false)
  const [filter, setFilter] = useState<Filter>('open')
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
    if (filter === 'open') return events.filter(isOpenEvent)
    if (filter === 'all') return events
    return events.filter((e) => e.status === filter)
  }, [events, filter])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { open: 0, all: events.length, new: 0, linked: 0, in_progress: 0, resolved: 0, ignored: 0 }
    for (const e of events) {
      c[e.status] += 1
      if (isOpenEvent(e)) c.open += 1
    }
    return c
  }, [events])

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
    { key: 'new', label: '새 이벤트' },
    { key: 'in_progress', label: '처리 중' },
    { key: 'resolved', label: '처리 완료' },
    { key: 'ignored', label: '보류' },
    { key: 'all', label: '전체' },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
      <ScreenTitle
        title="고객 이벤트함"
        sub={`${brand.customerPlatformLabel}에서 고객이 한 일이 여기로 들어옵니다.`}
        actions={
          <>
            <span className="hidden lg:inline-flex">
              <ScreenGuide screenKey="inbox" />
            </span>
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">새로고침</span>
            </Button>
          </>
        }
      />

      {notReady && (
        <div className="rounded-(--radius-panel) border border-warning-200 bg-warning-50 p-4">
          <p className="text-[0.98rem] font-semibold text-warning-700">고객 이벤트 연결 준비 중 (READY)</p>
          <p className="mt-1 text-[0.92rem] break-keep text-slate-700">
            클라우드에 브릿지 테이블이 아직 없습니다. <code className="rounded bg-white px-1">supabase/migrations/20260903000006_customer_bridge.sql</code> 을 적용하면
            진단 완료·주문·서류 업로드·요청이 자동으로 이곳에 쌓입니다. 적용 순서는 <code className="rounded bg-white px-1">docs/SETUP.md</code> 에 있습니다.
          </p>
        </div>
      )}

      {/* 한 줄로 유지하고 넘치면 옆으로 민다 — 두 줄이 되면 목록이 화면 밖으로 밀린다 */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            {f.label} <span className={counts[f.key] === 0 ? 'text-slate-300' : 'text-slate-400'}>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-[0.95rem] text-slate-500">불러오는 중…</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-(--radius-panel) border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
          <Inbox aria-hidden="true" className="size-8 text-slate-300" />
          <p className="text-[1rem] font-semibold text-slate-700">{filter === 'open' ? '새 고객 요청이 없습니다.' : '해당하는 이벤트가 없습니다.'}</p>
          <p className="max-w-md text-[0.9rem] break-keep text-slate-500">
            고객이 {brand.customerPlatformLabel}에서 진단을 마치거나, 서비스를 주문하거나, 서류를 올리거나, 요청을 보내면 여기에 나타납니다.
          </p>
          {isLocal && filter === 'open' && (
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
            showToast(link ? '고객사와 고객 계정을 연결했습니다.' : '고객사에 연결했습니다.')
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
