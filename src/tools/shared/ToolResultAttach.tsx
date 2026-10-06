/**
 * 도구 결과를 업체 기록에 붙이는 단추 (D-88 · D-89).
 *
 * 어느 도구든 같은 단추 하나로 끝난다: 누르면 업체 목록이 뜨고, 고르면 그 업체의
 * `toolResults` 에 한 줄 붙고 활동 기록에 남는다. 원하면 같은 자리에서 고객 플랫폼에
 * 요약을 발행한다 — 나가는 것은 도구가 만든 `summary` 글뿐이다.
 *
 * 업체 상세에서 도구를 열었으면(`?client=`) 고르는 단계가 없다 — 단추 한 번이면 그 업체로 간다.
 * 마이그레이션이 없다: 결과는 업체 레코드의 payload 에 들어간다.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Building2, CalendarPlus, Check, Paperclip, Search } from 'lucide-react'
import { useToast } from '../../components/ui/toastContext'
import { Button } from '../../components/ui/Button'
import { BottomSheet } from '../../components/ui/primitives'
import type { ClientOpsRecord, ToolDeadline } from '../../types/clientOps'
import { saveClient, withToolResult, withToolResultPublished } from '../../services/clientOpsService'
import { listLinksForClient, publishUpdate } from '../../services/customerBridgeService'
import { buildToolPublishInput } from '../../services/toolPublish'
import { matchesClientSearch } from '../../services/clientOpsSearch'
import { useToolClient } from './toolClientContext'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { subjectMismatch, type ToolSubject } from './toolSubject'
import { withToolResultDeadline } from '../../services/toolResultGroups'
import { addDaysLocal, friendlyDate, withNextAction } from '../../services/clientOpsNextAction'
import { todayLocalDate } from '../../lib/appClock'

/** D-134: 붙인 뒤 걸 다음 할 일 — 모듈마다 자주 하는 다음 걸음(고칠 수 있다) */
const FOLLOW_UP: Record<string, { text: string; days: number }> = {
  'policy-funding': { text: '정책자금 신청 서류 준비 · 결과 설명', days: 3 },
  employment: { text: '고용지원금 신청 서류 받기', days: 7 },
  labcare: { text: '연구소 설립 서류 준비', days: 7 },
  'startup-tax': { text: '창업감면 결과 설명 · 경정청구 여부 확인', days: 7 },
  cretop: { text: '분석 결과로 다음 미팅', days: 7 },
  tax: { text: '절세 방안 설명 미팅', days: 7 },
}
const FOLLOW_DAYS: { label: string; days: number }[] = [
  { label: '내일', days: 1 },
  { label: '3일 뒤', days: 3 },
  { label: '1주 뒤', days: 7 },
  { label: '2주 뒤', days: 14 },
]

/** 결과를 만든 화면 — 붙일 업체로 client 를 바꿔 둔다(다른 업체에 붙였으면 그 업체로 열리게) */
function openPathFor(pathname: string, search: string, clientId: string): string {
  if (!pathname.startsWith('/tools/')) return ''
  const q = new URLSearchParams(search)
  q.set('client', clientId)
  for (const k of [...q.keys()]) if (!/^[\w-]+$/.test(k)) q.delete(k)
  return `${pathname}?${q.toString()}`
}

export interface ToolResultAttachProps {
  /** D-165: '다시 열기' 주소를 도구가 정한다(없으면 지금 주소 + client) — 세금 계산기는 계산기 · 탭까지 */
  openPathFor?: (clientId: string) => string
  toolKey: string
  title: string
  verdict: string | null
  verdictLabel: string
  summary: string
  data: unknown
  /** 도구가 계산한 기한 — 붙이면 달력·오늘 화면에 뜬다 (D-89) */
  deadlines?: ToolDeadline[]
  /** D-134: 붙인 뒤 걸 다음 할 일(없으면 모듈별 기본) */
  followUp?: { text: string; days: number }
  /** 미리 골라 둘 업체 (주소의 `?client=` 보다 우선한다) */
  presetClientId?: string
  /**
   * 결과가 말하는 회사 (D-94) — 크레탑 보고서처럼 결과 안에 회사가 적혀 있으면 넘긴다.
   * 붙일 업체와 이름·사업자번호가 다르면 한 번 더 묻는다(다른 회사 보고서를 잘못 붙이지 않게).
   */
  subject?: ToolSubject
}

export function ToolResultAttach(props: ToolResultAttachProps) {
  const { clientId, clientName, workspaceId, loadClients, replaceClient } = useToolClient()
  const presetId = props.presetClientId ?? clientId ?? ''
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState<ClientOpsRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [pickedId, setPickedId] = useState<string>(presetId)
  const [publish, setPublish] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ id: string; name: string; resultId: string } | null>(null)
  const location = useLocation()
  const follow = props.followUp ?? FOLLOW_UP[props.toolKey] ?? { text: `${props.title} 결과 설명`, days: 7 }
  const [followText, setFollowText] = useState(follow.text)
  const [followDays, setFollowDays] = useState(follow.days)
  const [followState, setFollowState] = useState<'ask' | 'done' | 'skip'>('ask')

  useEffect(() => {
    setPickedId((prev) => prev || presetId)
  }, [presetId])

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    loadClients()
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
  }, [open, loadClients])

  const filtered = useMemo(() => {
    const q = query.trim()
    const list = q ? clients.filter((c) => matchesClientSearch(c, q)) : clients
    return list.slice(0, 30)
  }, [clients, query])

  const [mismatch, setMismatch] = useState<{ target: ClientOpsRecord; alsoPublish: boolean } | null>(null)

  /** 실제로 붙이는 일 — 시트에서 고른 업체든, 주소로 물고 온 업체든 같은 길을 쓴다 */
  const attachTo = async (targetId: string, alsoPublish: boolean, confirmed = false) => {
    // D-165: 늘 지금 기록을 다시 읽는다 — 시트를 처음 열 때 받아 둔 목록으로 저장하면 그 뒤에 붙인 결과 · 할 일이 지워졌다
    const list = await loadClients()
    const target = list.find((c) => c.id === targetId)
    if (!target) {
      showToast('업체를 찾지 못했습니다.')
      return
    }
    if (!confirmed && subjectMismatch(props.subject, target)) {
      setMismatch({ target, alsoPublish })
      return
    }
    setBusy(true)
    try {
      let next = withToolResult(target, {
        toolKey: props.toolKey,
        title: props.title,
        verdict: props.verdict,
        verdictLabel: props.verdictLabel,
        summary: props.summary,
        data: props.data,
        deadlines: props.deadlines ?? [],
        openPath: props.openPathFor ? props.openPathFor(target.id) : openPathFor(location.pathname, location.search, target.id),
      })
      const saved = await saveClient(next)
      next = saved
      replaceClient(saved)
      let publishedNote = ''
      if (alsoPublish) {
        const links = await listLinksForClient(workspaceId, target.id)
        const link = links.find((l) => l.status === 'active') ?? links[0]
        if (link) {
          // 고객에게 나가는 것은 이 함수 하나가 정한다 (D-89) — 제목과 요약 글뿐
          const update = await publishUpdate(workspaceId, buildToolPublishInput(link.id, { title: props.title, summary: props.summary }))
          const resultId = next.toolResults[0]?.id
          if (resultId) {
            next = await saveClient(withToolResultPublished(next, resultId, update.id))
            replaceClient(next)
          }
          publishedNote = ' · 고객 플랫폼에도 발행했습니다'
        } else {
          publishedNote = ' · 연결된 고객 계정이 없어 발행은 건너뛰었습니다'
        }
      }
      const deadlineNote = (props.deadlines?.length ?? 0) > 0 ? ` · 기한 ${props.deadlines?.length}건이 달력에 올라갔습니다` : ''
      setDone({ id: target.id, name: target.companyName, resultId: next.toolResults[0]?.id ?? '' })
      setFollowState('ask')
      setOpen(false)
      showToast(`${target.companyName} 기록에 붙였습니다${deadlineNote}${publishedNote}`)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '붙이지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  /** D-134: 붙인 결과에 다음 할 일을 건다 — 달력 · 오늘 화면에 뜬다. 업체의 다음 할 일이 비어 있으면 거기에도 */
  const hangFollowUp = async () => {
    if (!done) return
    const text = followText.trim()
    if (!text) {
      showToast('할 일을 적어 주세요.')
      return
    }
    setBusy(true)
    try {
      const list = await loadClients()
      const target = list.find((c) => c.id === done.id)
      if (!target) throw new Error('업체를 찾지 못했습니다.')
      const date = addDaysLocal(todayLocalDate(), followDays)
      let next = withToolResultDeadline(target, done.resultId, { date, title: text, note: `${props.title} 결과에서` })
      const setNext = !target.nextAction.trim()
      if (setNext) next = withNextAction(next, text, date)
      const saved = await saveClient(next)
      replaceClient(saved)
      setFollowState('done')
      showToast(`'${text}' 을 ${friendlyDate(date)} 할 일로 걸었습니다 — 달력에 올라갔습니다${setNext ? ' · 업체의 다음 할 일에도 적었습니다' : ''}`)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '걸지 못했습니다 — 다시 눌러 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const quickName = clientName || '이 업체'

  return (
    <>
      <ConfirmModal
        open={mismatch !== null}
        title="다른 회사 결과 같습니다"
        message={`이 결과는 '${props.subject?.name || '다른 회사'}' 의 것으로 보입니다. 그래도 '${mismatch?.target.companyName ?? ''}' 기록에 붙일까요?`}
        warning="회사명·사업자번호가 붙일 업체와 다릅니다. 보고서를 잘못 올리지 않았는지 확인하세요."
        confirmLabel="그래도 붙이기"
        onCancel={() => setMismatch(null)}
        onConfirm={() => {
          const m = mismatch
          setMismatch(null)
          if (m) void attachTo(m.target.id, m.alsoPublish, true)
        }}
      />
      {presetId ? (
        <>
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void attachTo(presetId, false)} data-testid="tool-attach-quick">
            <Paperclip aria-hidden="true" className="size-4" /> {busy ? '붙이는 중…' : `${quickName} 기록에 붙이기`}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)} data-testid="tool-attach-open">
            다른 업체 · 발행까지
          </Button>
        </>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)} data-testid="tool-attach-open">
          <Paperclip aria-hidden="true" className="size-4" /> 업체 기록에 붙이기
        </Button>
      )}
      {done && (
        <Link to={`/ops/clients/${done.id}#tool-results`} className="t-sub inline-flex items-center gap-1 self-center font-medium text-brand-700 hover:underline" data-testid="tool-attach-go">
          <Check aria-hidden="true" className="size-4" /> {done.name} 에 붙음 — 보러 가기
        </Link>
      )}
      {done && done.resultId && followState === 'ask' && (
        <div className="flex w-full basis-full flex-col gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50 p-3" data-testid="tool-followup">
          <p className="t-sub font-semibold text-slate-800">다음 할 일도 걸까요? — 달력에 올라가고, 날이 가까우면 오늘 화면에 뜹니다</p>
          <label className="block">
            <span className="sr-only">다음 할 일</span>
            <input
              value={followText}
              onChange={(e) => setFollowText(e.target.value)}
              className="w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-[1rem] text-slate-900 focus:border-brand-500 focus:outline-none"
              aria-label="다음 할 일"
            />
          </label>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="언제">
            {FOLLOW_DAYS.map((d) => (
              <button
                key={d.days}
                type="button"
                aria-pressed={followDays === d.days}
                onClick={() => setFollowDays(d.days)}
                className={`tap t-sub rounded-full border px-3 py-1 font-medium ${followDays === d.days ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-500'}`}
              >
                {d.label}
              </button>
            ))}
            <span className="t-sub text-slate-600">{friendlyDate(addDaysLocal(todayLocalDate(), followDays))}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void hangFollowUp()} data-testid="tool-followup-hang">
              <CalendarPlus aria-hidden="true" className="size-4" /> {busy ? '거는 중…' : '할 일로 걸기'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFollowState('skip')}>
              괜찮습니다
            </Button>
          </div>
        </div>
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
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!pickedId || busy}
                  onClick={() => void attachTo(pickedId, publish)}
                  data-testid="tool-attach-confirm"
                >
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
              <p className="t-sub text-slate-500">{clients.length === 0 ? '아직 업체가 없습니다. 고객 관리에서 먼저 만들어 주세요.' : '맞는 업체가 없습니다.'}</p>
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
