/**
 * U7(D-545 · 2026-11-05 대표 승인 "셋 다 진행") 고객 관리 PC — 업체 상세 왼쪽에 업체 목록.
 *
 * 예전: 업체를 하나 열면 목록이 사라지고, 다른 업체를 보려면 [고객 관리]로 돌아가 다시 찾았다.
 * 지금: 넓은 PC(머리 폭 1024px 이상)에서는 왼쪽에 업체 목록이 남는다 — 누르면 같은 탭 그대로 그 업체로(한 번).
 *   목록은 업체를 바꿔도 다시 그리지 않아 스크롤 자리가 그대로 · 찾기 칸 · [목록 접기](이 기기에 기억).
 *   휴대폰 · 좁은 PC 는 예전 그대로(목록 없음). 업체 · 권한은 고객 관리 화면과 같은 길(listClients — 작업공간 · RLS 그대로).
 */
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { AuthContext } from '../../auth/authContext'
import { listClients } from '../../services/clientOpsService'
import { isContractClient, isProspect } from '../../services/salesPipeline'
import type { ClientOpsRecord } from '../../types/clientOps'

const OPEN_KEY = 'axmvp.clients.sidelist'

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== '0'
  } catch {
    return true
  }
}

interface Row {
  id: string
  name: string
  sub: string
  prospect: boolean
}

function rowsOf(records: ClientOpsRecord[]): Row[] {
  const live = records.filter((r) => !r.archivedAt && (isContractClient(r) || isProspect(r)))
  const byName = (a: ClientOpsRecord, b: ClientOpsRecord) => (a.companyName || '').localeCompare(b.companyName || '', 'ko')
  // 계약 고객 먼저(가나다) · 그다음 잠재고객(가나다) — 고객 관리의 '계약 고객 · 잠재고객' 과 같은 묶음
  const contract = live.filter((r) => isContractClient(r)).sort(byName)
  const prospect = live.filter((r) => !isContractClient(r)).sort(byName)
  return [...contract, ...prospect].map((r) => ({
    id: r.id,
    name: r.companyName || '(이름 없음)',
    sub: r.contactName || '',
    prospect: !isContractClient(r),
  }))
}

export function ClientSplit({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState(readOpen)
  // D-558 대표: "업체 화면은 내가 고른 폭 그대로, 업체 목록은 폭과 상관없이 왼쪽에" — 목록(15rem) + 사이(1.25rem)만큼 본문 상자를 넓힌다
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    root.style.setProperty('--side-list-extra', '16.25rem')
    return () => {
      root.style.removeProperty('--side-list-extra')
    }
  }, [open])
  const setOpen = (v: boolean) => {
    setOpenState(v)
    try {
      localStorage.setItem(OPEN_KEY, v ? '1' : '0')
    } catch {
      // 기억만 못 한다
    }
  }
  return (
    <div className="@container">
      <div className={open ? '@5xl:grid @5xl:grid-cols-[15rem_minmax(0,1fr)] @5xl:items-start @5xl:gap-5' : ''}>
        {open && <ClientSideList onClose={() => setOpen(false)} />}
        {/* 상세의 탭 줄은 화면 끝까지 칠하려고 양옆으로 40px 넘친다 — 목록과 나란히 있을 때는 그 넘침을 상세 칸 안에서 자른다(목록과 겹침 0) */}
        <div className={open ? 'min-w-0 @5xl:[overflow-x:clip]' : 'min-w-0'}>
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              data-testid="client-sidelist-open"
              className="tap t-sub mb-3 hidden items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 @5xl:inline-flex"
            >
              <PanelLeftOpen aria-hidden="true" className="size-4" />
              업체 목록 펴기
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

function ClientSideList({ onClose }: { onClose: () => void }) {
  // 이 기기에만 저장하는 모드에는 로그인 판이 없다 — 있으면 작업공간, 없으면 null(listClients 가 이 기기 기록을 읽는다)
  const currentWorkspaceId = useContext(AuthContext)?.currentWorkspaceId ?? null
  const { clientId = '' } = useParams()
  const { search } = useLocation()
  const [records, setRecords] = useState<ClientOpsRecord[] | null>(null)
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLUListElement | null>(null)

  // 업체를 바꿀 때마다 새로 읽는다(이름을 고쳤거나 새로 만든 업체) — 읽는 동안은 지난 목록을 그대로 보여 자리가 흔들리지 않게
  useEffect(() => {
    let alive = true
    listClients(currentWorkspaceId)
      .then((rows) => {
        if (alive) setRecords(rows)
      })
      .catch(() => {
        if (alive) setRecords((prev) => prev ?? [])
      })
    return () => {
      alive = false
    }
  }, [currentWorkspaceId, clientId])

  const rows = useMemo(() => rowsOf(records ?? []), [records])
  const q = query.trim().toLowerCase()
  const shown = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q)) : rows
  // 같은 탭으로 옮긴다(서류를 보다가 다른 업체를 누르면 그 업체 서류) — svc 처럼 업체마다 다른 값은 뺀다
  const tab = new URLSearchParams(search).get('tab')
  const hrefOf = (id: string) => `/ops/clients/${id}${tab ? `?tab=${encodeURIComponent(tab)}` : ''}`

  // 처음 열 때 지금 업체가 목록 밖이면 보이게(목록을 직접 내린 뒤에는 건드리지 않는다)
  const scrolled = useRef(false)
  useEffect(() => {
    if (scrolled.current || records === null) return
    scrolled.current = true
    const el = listRef.current?.querySelector('[aria-current="page"]')
    if (el && 'scrollIntoView' in el) (el as HTMLElement).scrollIntoView({ block: 'nearest' })
  }, [records])

  return (
    <aside
      aria-label="업체 목록"
      data-testid="client-sidelist"
      className="no-print sticky top-20 hidden max-h-[calc(100vh-6rem)] flex-col gap-2 rounded-(--radius-panel) border border-slate-200 bg-white p-2.5 @5xl:flex"
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <Link to="/ops/clients" className="tap t-sub font-bold text-slate-900 hover:text-brand-700 hover:underline">
          업체 목록 <span className="t-meta font-semibold text-slate-400 tabular-nums">{rows.length}</span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="업체 목록 접기"
          title="업체 목록 접기 — 상세를 넓게"
          data-testid="client-sidelist-close"
          className="tap inline-flex size-8 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-100"
        >
          <PanelLeftClose aria-hidden="true" className="size-4" />
        </button>
      </div>
      <label className="relative block">
        <Search aria-hidden="true" className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="업체 찾기"
          aria-label="업체 목록에서 찾기"
          data-testid="client-sidelist-search"
          className="t-sub w-full rounded-(--radius-control) border border-slate-200 py-1.5 pr-2 pl-8 focus:border-brand-500 focus:outline-none"
        />
      </label>
      <ul ref={listRef} className="-mx-1 flex min-h-0 flex-col overflow-y-auto px-1">
        {records === null && <li className="t-sub px-2 py-2 text-slate-500">불러오는 중…</li>}
        {records !== null && shown.length === 0 && <li className="t-sub px-2 py-2 text-slate-500">{q ? '찾는 업체가 없어요' : '업체가 없어요'}</li>}
        {shown.map((r) => {
          const on = r.id === clientId
          return (
            <li key={r.id}>
              <Link
                to={hrefOf(r.id)}
                aria-current={on ? 'page' : undefined}
                data-testid="client-sidelist-row"
                data-client={r.id}
                className={`tap flex min-w-0 items-center gap-2 rounded-(--radius-control) px-2 py-1.5 ${on ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <span className="t-sub min-w-0 flex-1 truncate">{r.name}</span>
                {r.prospect && <span className="t-meta shrink-0 text-slate-400">잠재</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
