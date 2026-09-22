/**
 * 도구 결과를 업체 기록에 붙이는 단추 (D-88).
 *
 * 어느 도구든 같은 단추 하나로 끝난다: 누르면 업체 목록이 뜨고, 고르면 그 업체의
 * `toolResults` 에 한 줄 붙고 활동 기록에 남는다. 원하면 같은 자리에서 고객 플랫폼에
 * 요약을 발행한다 — 나가는 것은 도구가 만든 `summary` 글뿐이다.
 *
 * 마이그레이션이 없다: 결과는 업체 레코드의 payload 에 들어간다.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Check, Paperclip, Search } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { getDataModeConfig } from '../../data/dataMode'
import { useToast } from '../../components/ui/toastContext'
import { Button } from '../../components/ui/Button'
import { BottomSheet } from '../../components/ui/primitives'
import type { ClientOpsRecord } from '../../types/clientOps'
import { listClients, saveClient, withToolResult, withToolResultPublished } from '../../services/clientOpsService'
import { listLinksForClient, publishUpdate } from '../../services/customerBridgeService'
import { matchesClientSearch } from '../../services/clientOpsSearch'

export interface ToolResultAttachProps {
  toolKey: string
  title: string
  verdict: string | null
  verdictLabel: string
  summary: string
  data: unknown
  /** 미리 골라 둘 업체 (업체 화면에서 도구를 열었을 때) */
  presetClientId?: string
}

/**
 * 로컬 모드에는 AuthProvider 가 없다 — 다른 화면(OperationsHubPage)처럼 모드에 따라 나눠 부른다.
 * useAuth 를 로컬에서 부르면 화면이 통째로 죽는다.
 */
export function ToolResultAttach(props: ToolResultAttachProps) {
  return getDataModeConfig().mode === 'supabase' ? <CloudAttach {...props} /> : <AttachInner {...props} workspaceId={null} />
}

function CloudAttach(props: ToolResultAttachProps) {
  const { currentWorkspaceId } = useAuth()
  return <AttachInner {...props} workspaceId={currentWorkspaceId} />
}

function AttachInner(props: ToolResultAttachProps & { workspaceId: string | null }) {
  const currentWorkspaceId = props.workspaceId
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState<ClientOpsRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [pickedId, setPickedId] = useState<string>(props.presetClientId ?? '')
  const [publish, setPublish] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    listClients(currentWorkspaceId)
      .then((list) => {
        if (alive) setClients(list.filter((c) => !c.archivedAt))
      })
      .catch(() => {
        if (alive) setClients([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [open, currentWorkspaceId])

  const filtered = useMemo(() => {
    const q = query.trim()
    const list = q ? clients.filter((c) => matchesClientSearch(c, q)) : clients
    return list.slice(0, 30)
  }, [clients, query])

  const attach = async () => {
    const target = clients.find((c) => c.id === pickedId)
    if (!target) return
    setBusy(true)
    try {
      let next = withToolResult(target, {
        toolKey: props.toolKey,
        title: props.title,
        verdict: props.verdict,
        verdictLabel: props.verdictLabel,
        summary: props.summary,
        data: props.data,
      })
      const saved = await saveClient(next)
      next = saved
      let publishedNote = ''
      if (publish) {
        const links = await listLinksForClient(currentWorkspaceId, target.id)
        const link = links.find((l) => l.status === 'active') ?? links[0]
        if (link) {
          const update = await publishUpdate(currentWorkspaceId, {
            linkId: link.id,
            category: 'result',
            title: `${props.title} 결과`,
            body: props.summary,
            customerActionRequired: false,
          })
          const resultId = next.toolResults[0]?.id
          if (resultId) next = await saveClient(withToolResultPublished(next, resultId, update.id))
          publishedNote = ' · 고객 플랫폼에도 발행했습니다'
        } else {
          publishedNote = ' · 연결된 고객 계정이 없어 발행은 건너뛰었습니다'
        }
      }
      setDone({ id: target.id, name: target.companyName })
      setOpen(false)
      showToast(`${target.companyName} 기록에 붙였습니다${publishedNote}`)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '붙이지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} data-testid="tool-attach-open">
        <Paperclip aria-hidden="true" className="size-4" /> 업체 기록에 붙이기
      </Button>
      {done && (
        <Link to={`/ops/clients/${done.id}?tab=files`} className="t-sub inline-flex items-center gap-1 self-center font-medium text-brand-700 hover:underline">
          <Check aria-hidden="true" className="size-4" /> {done.name} 에 붙음 — 보러 가기
        </Link>
      )}
      {open && (
        <BottomSheet
          title="어느 업체에 붙일까요?"
          onClose={() => setOpen(false)}
          footer={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="t-sub flex items-center gap-2 text-slate-600">
                <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="size-4" />
                고객 플랫폼에 요약도 발행 (연결된 고객 계정이 있을 때만)
              </label>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  닫기
                </Button>
                <Button size="sm" variant="primary" disabled={!pickedId || busy} onClick={attach} data-testid="tool-attach-confirm">
                  {busy ? '붙이는 중…' : '이 업체에 붙이기'}
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <label className="relative block">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="업체 찾기"
                placeholder="업체명 · 사업자번호 · 담당자"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-(--radius-control) border border-slate-300 bg-white py-2 pr-3 pl-9 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none"
              />
            </label>
            {loading ? (
              <p className="t-sub text-slate-500">업체를 불러오는 중…</p>
            ) : filtered.length === 0 ? (
              <p className="t-sub text-slate-500">{clients.length === 0 ? '아직 업체가 없습니다. 고객 운영에서 먼저 만들어 주세요.' : '맞는 업체가 없습니다.'}</p>
            ) : (
              <ul className="flex max-h-[50vh] flex-col divide-y divide-slate-100 overflow-y-auto rounded-(--radius-panel) border border-slate-200">
                {filtered.map((c) => {
                  const on = c.id === pickedId
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setPickedId(c.id)}
                        className={`tap flex w-full items-center gap-3 px-3 py-2.5 text-left ${on ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
                      >
                        <Building2 aria-hidden="true" className={`size-4 shrink-0 ${on ? 'text-brand-600' : 'text-slate-300'}`} />
                        <span className="min-w-0 flex-1">
                          <span className="t-body block truncate font-medium text-slate-800">{c.companyName}</span>
                          <span className="t-meta block truncate text-slate-500">
                            {[c.representativeName, c.industry].filter(Boolean).join(' · ') || '정보 없음'}
                          </span>
                        </span>
                        {on && <Check aria-hidden="true" className="size-4 shrink-0 text-brand-600" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="t-meta break-keep text-slate-400">
              붙는 것은 판정 요약과 입력값입니다. 내부 메모·수수료는 고객에게 나가지 않습니다.
            </p>
          </div>
        </BottomSheet>
      )}
    </>
  )
}
