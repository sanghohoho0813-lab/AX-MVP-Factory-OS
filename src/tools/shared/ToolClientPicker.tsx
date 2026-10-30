/**
 * D-354 모듈 '어느 업체 일인가요?' — 업체 없이 연 모듈 화면 맨 위에서 바로 업체를 고른다.
 * 대표 목표 3 "계산기는 상황 예시로 — 한 번 누르면 그 업체 숫자로 설계까지".
 * 예전에는 상황 예시가 '위에서 업체를 먼저 고르면' 이라고 했지만 모듈 화면 위에는 고르는 곳이 없었다(업체 상세 › 모듈 입구로만 들어올 수 있었다).
 *
 *  - 고르면 같은 화면 · 같은 주소에 ?client= 만 붙인다(각 화면이 이미 읽는 길 — D-89 · D-199). 넣어 둔 상황 예시(?preset=)도 그대로.
 *  - 업체로 열었으면 띠의 [다른 업체] 로 바꾸거나 [업체 없이 쓰기] 로 뺀다.
 *  - 업체 명단은 틀이 한 번 읽은 것을 나눠 쓴다(loadClients). 보관한 업체는 빼고, 최근에 고친 업체가 먼저.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Building2, Search } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { contractStageOf } from '../../types/clientOps'
import { PICK_EVENT, filterPickClients } from './toolClientPick'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'

const STAGE: Record<ReturnType<typeof contractStageOf>, string> = { pre: '잠재고객', signed: '계약 고객', closed: '완료' }

export function ToolClientPicker({
  clientId,
  loadClients,
  mode,
}: {
  clientId: string | null
  loadClients: () => Promise<ClientOpsRecord[]>
  /** bar — 업체 없이 열었을 때 맨 위 한 줄 · switch — 업체 띠 안의 [다른 업체] 단추만 */
  mode: 'bar' | 'switch'
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const on = () => setOpen(true)
    window.addEventListener(PICK_EVENT, on)
    return () => window.removeEventListener(PICK_EVENT, on)
  }, [])
  return (
    <>
      {mode === 'bar' ? (
        <div
          data-testid="tool-client-pick"
          className="no-print flex items-center gap-x-3 gap-y-1 rounded-(--radius-panel) border border-dashed border-brand-300 bg-white px-3 py-2"
        >
          <Building2 aria-hidden="true" className="size-4 shrink-0 text-brand-600" />
          <span className="t-sub min-w-0 flex-1 truncate text-slate-700 sm:whitespace-normal">
            <b className="font-bold text-slate-900">어느 업체 일인가요?</b>
            <span className="max-sm:hidden"> 고르면 그 업체 숫자(직원 · 매출 · 주소 등)로 채워지고, 결과를 그 업체에 붙일 수 있어요.</span>
          </span>
          <Button size="sm" variant="primary" onClick={() => setOpen(true)} data-testid="tool-client-pick-open" className="shrink-0">
            업체 고르기
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="tool-client-switch"
          className="tap t-sub inline-flex shrink-0 items-center gap-1 font-medium text-brand-700 hover:underline"
        >
          다른 업체
        </button>
      )}
      {open && <PickerDialog clientId={clientId} loadClients={loadClients} onClose={() => setOpen(false)} />}
    </>
  )
}

function PickerDialog({ clientId, loadClients, onClose }: { clientId: string | null; loadClients: () => Promise<ClientOpsRecord[]>; onClose: () => void }) {
  const [list, setList] = useState<ClientOpsRecord[] | null>(null)
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    let alive = true
    void loadClients().then((l) => {
      if (alive) setList(l)
    })
    return () => {
      alive = false
    }
  }, [loadClients])
  useEffect(() => {
    // 창이 뜬 뒤 찾기 칸에 — 휴대폰은 자판이 화면을 가려 목록을 못 보니 PC 만
    if (window.matchMedia?.('(min-width: 640px)').matches) window.setTimeout(() => inputRef.current?.focus(), 30)
  }, [])
  const shown = useMemo(() => filterPickClients(list ?? [], q), [list, q])

  const go = (id: string | null) => {
    const params = new URLSearchParams(location.search)
    if (id) params.set('client', id)
    else params.delete('client')
    const s = params.toString()
    onClose()
    navigate(`${location.pathname}${s ? `?${s}` : ''}${location.hash}`)
  }

  return (
    <Modal open title="어느 업체 일인가요?" onClose={onClose}>
      <div className="flex flex-col gap-3" data-testid="tool-client-pick-dialog">
        <label className="flex items-center gap-2 rounded-(--radius-control) border border-slate-300 bg-white px-3 focus-within:border-brand-500">
          <Search aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shown.length === 1) go(shown[0].id)
            }}
            placeholder="이름 · 대표 · 전화로 찾기"
            aria-label="업체 찾기"
            data-testid="tool-client-pick-search"
            className="t-body min-h-11 min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        {list === null ? (
          <p className="t-sub text-slate-500">업체 기록을 읽는 중…</p>
        ) : list.length === 0 ? (
          <p className="t-sub break-keep text-slate-600">
            아직 업체가 없어요 —{' '}
            <Link to="/ops/clients" onClick={onClose} className="font-bold text-brand-700 hover:underline">
              고객 관리
            </Link>
            에서 만들면 여기서 고를 수 있어요.
          </p>
        ) : shown.length === 0 ? (
          <p className="t-sub text-slate-600" data-testid="tool-client-pick-none">
            ‘{q.trim()}’ 와 맞는 업체가 없어요.
          </p>
        ) : (
          <ul className="flex max-h-[min(55vh,26rem)] flex-col gap-1 overflow-y-auto" data-testid="tool-client-pick-list">
            {shown.slice(0, 60).map((c) => {
              const on = c.id === clientId
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => go(c.id)}
                    data-client={c.id}
                    aria-current={on ? 'true' : undefined}
                    className={`tap flex w-full min-w-0 items-center gap-2 rounded-(--radius-control) border px-3 py-2 text-left ${on ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/50'}`}
                  >
                    <Building2 aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="t-body truncate font-semibold text-slate-900">{c.companyName || '이름 없는 업체'}</span>
                      {(c.representativeName || c.industry) && (
                        <span className="t-meta truncate text-slate-500">{[c.representativeName && `대표 ${c.representativeName}`, c.industry].filter(Boolean).join(' · ')}</span>
                      )}
                    </span>
                    <span className="t-meta shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-slate-600">{on ? '지금 업체' : STAGE[contractStageOf(c.status)]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {clientId && (
          <button type="button" onClick={() => go(null)} className="tap t-sub self-start font-medium text-slate-600 hover:text-brand-700 hover:underline" data-testid="tool-client-pick-clear">
            업체 없이 쓰기(예시 가정으로)
          </button>
        )}
      </div>
    </Modal>
  )
}
