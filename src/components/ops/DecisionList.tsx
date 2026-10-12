/**
 * 확인함 줄 (D-158) — 프로그램이 준비한 것에 '맞아요 / 아니에요' 만 고른다.
 * 맞아요: 정보 넣기 · 할 일 걸기 · 도전 체크 · 요청 문구 복사(결정마다 다름). 아니에요: 다시 묻지 않는다.
 */
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, CheckCheck, ChevronDown, ExternalLink, X } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { JournalEntry, PortalClientLink } from '../../types/bridge'
import { DECISION_KIND_LABEL, buildAllDecisions, undoDecision, weekdayOnOrAfter, withDecisionAnswer, type Decision, type DecisionKind } from '../../services/decisions'
import { saveClient } from '../../services/clientOpsService'
import type { GrantNotice } from '../../services/grants/grantMatch'
import type { GrantBrief } from '../../services/grants/grantBrief'
import { createJournalEntry, deleteJournalEntry } from '../../services/journalService'
import { listDocuments, requestDocument } from '../../services/customerBridgeService'
import { addDaysLocal } from '../../services/clientOpsNextAction'
import { nowIso } from '../../lib/appClock'
import { copyText } from '../consulting/studioParts'
import { useToast } from '../ui/toastContext'
import { Button } from '../ui/Button'

const KIND_CLASS: Record<DecisionKind, string> = {
  fact: 'border-cat-client-200 bg-cat-client-50 text-cat-client-700',
  module: 'border-cat-plan-200 bg-cat-plan-50 text-cat-plan-700',
  grant: 'border-cat-fund-200 bg-cat-fund-50 text-cat-fund-700',
  doc: 'border-cat-doc-200 bg-cat-doc-50 text-cat-doc-700',
  money: 'border-cat-money-200 bg-cat-money-50 text-cat-money-700',
  stale: 'border-warning-200 bg-warning-50 text-warning-800',
  next: 'border-brand-200 bg-brand-50 text-brand-700',
  followup: 'border-slate-300 bg-slate-50 text-slate-700',
}

/**
 * 답하기 — 저장 직전의 최신 업체 기록 위에 적고, 할 일 · 복사는 여기서 한다.
 * save 는 기록을 저장하고 저장된 기록을 돌려준다(업체 상세는 commit, 다른 화면은 saveClient).
 */
export function useDecisionAnswer({
  workspaceId,
  userId,
  today,
  notices,
  latest,
  save,
  linkOf,
  onTodosRemoved,
}: {
  workspaceId: string | null
  userId: string | null
  today: string
  notices: readonly GrantNotice[]
  latest: (clientId: string) => ClientOpsRecord | undefined
  save: (next: ClientOpsRecord) => Promise<ClientOpsRecord | null>
  /** D-161: 고객 플랫폼 연결 — 있으면 서류 요청을 고객 화면에도 올린다 */
  linkOf?: (clientId: string) => PortalClientLink | null
  /** D-161: 되돌리기로 지운 할 일(화면 목록에서 빼게) */
  onTodosRemoved?: (ids: string[]) => void
}) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  // 되돌리기는 알림이 뜬 뒤에 누른다 — 그때의 최신 기록을 읽어야 한다
  const latestRef = useRef(latest)
  latestRef.current = latest
  const saveRef = useRef(save)
  saveRef.current = save

  /** D-161: 그 답이 바꾼 것만 되돌린다(기록 · 할 일). 복사한 문구 · 고객 화면에 올린 요청은 되돌리지 않는다 */
  const undo = async (steps: { d: Decision; prev: ClientOpsRecord; next: ClientOpsRecord }[], todos: JournalEntry[]) => {
    try {
      const fresh = new Map<string, ClientOpsRecord>()
      for (const st of [...steps].reverse()) {
        const cur = fresh.get(st.d.clientId) ?? latestRef.current(st.d.clientId)
        if (!cur) continue
        const saved = await saveRef.current(undoDecision(cur, st.prev, st.next, st.d.id))
        if (saved) fresh.set(saved.id, saved)
      }
      for (const t of todos) await deleteJournalEntry(t)
      if (todos.length) onTodosRemoved?.(todos.map((t) => t.id))
      showToast(steps.length > 1 ? `${steps.length}건을 되돌렸습니다` : '되돌렸습니다')
    } catch (cause) {
      showToast(cause instanceof Error ? `되돌리지 못했습니다 — ${cause.message}` : '되돌리지 못했습니다')
    }
  }

  /** 고객 화면 '요청받은 서류' 에 올리기 — 이미 요청 중인 서류는 또 올리지 않는다. 올린 개수 */
  const postDocs = async (d: Decision): Promise<number> => {
    if (d.effect.type !== 'copy' || !d.effect.docs?.length) return 0
    const link = linkOf?.(d.clientId)
    if (!link) return 0
    const have = await listDocuments(workspaceId, link.id).catch(() => [])
    let n = 0
    for (const doc of d.effect.docs) {
      if (have.some((x) => x.documentType === doc.key && x.status === 'requested')) continue
      await requestDocument(workspaceId, { linkId: link.id, operationsClientId: d.clientId, documentType: doc.key, title: doc.label, customerNote: '유효기간이 지났거나 곧 끝나 새로 받아야 합니다.' })
      n += 1
    }
    return n
  }

  const makeTodo = (d: Decision) =>
    d.effect.type === 'todo'
      ? createJournalEntry(workspaceId, userId, {
          entryDate: today,
          entryType: 'follow_up',
          content: d.effect.text,
          clientId: d.clientId,
          // D-161: 할 일 기한도 주말을 피한다
          dueDate: weekdayOnOrAfter(addDaysLocal(today, d.effect.dueInDays)),
        })
      : Promise.resolve(null)

  const answer = async (d: Decision, a: 'yes' | 'no'): Promise<JournalEntry | null> => {
    if (!latest(d.clientId) || busy) return null
    setBusy(d.id)
    let made: JournalEntry | null = null
    try {
      // 복사는 먼저(클립보드는 누른 바로 그때만 허락된다)
      if (a === 'yes' && d.effect.type === 'copy') {
        const ok = await copyText(d.effect.text)
        if (!ok) {
          showToast(d.kind === 'doc' ? '복사하지 못했습니다 — 서류 탭의 서류 요청 문구에서 복사해 주세요' : '복사하지 못했습니다 — 다시 눌러 주세요')
          return null
        }
      }
      // D-161: 기록은 복사가 끝난 뒤의 최신 것으로(그 사이 올라간 서류를 덮지 않게)
      const rec = latest(d.clientId)
      if (!rec) return null
      // D-161: 할 일을 먼저 만든다 — 기록부터 저장하면 할 일 만들기가 실패했을 때 질문만 사라졌다
      if (a === 'yes') made = await makeTodo(d)
      const next = withDecisionAnswer(rec, d, a, notices, nowIso())
      let saved: ClientOpsRecord | null = null
      try {
        saved = await save(next)
      } catch (cause) {
        if (made) await deleteJournalEntry(made).catch(() => undefined)
        throw cause
      }
      if (!saved) {
        if (made) await deleteJournalEntry(made).catch(() => undefined)
        return null
      }
      let posted = 0
      if (a === 'yes') {
        try {
          posted = await postDocs(d)
        } catch {
          showToast('고객 화면에 올리지 못했습니다 — 문구는 복사했습니다. 카톡으로 보내 주세요')
          return made
        }
      }
      const text =
        a === 'no'
          ? '다시 묻지 않습니다'
          : posted > 0
            ? `요청 문구를 복사하고 고객 화면에도 서류 ${posted}건을 요청했습니다`
            : d.doneText
              ? d.doneText
              : d.effect.type === 'fact'
                ? '업체 정보에 넣었습니다'
                : d.effect.type === 'todo'
                  ? `할 일로 걸었습니다 — ${weekdayOnOrAfter(addDaysLocal(today, d.effect.dueInDays)).slice(5).replace('-', '/')}`
                  : d.effect.type === 'grant'
                    ? '도전 체크 — 마감을 일정 · 오늘에 띄웁니다'
                    : '서류 요청 문구를 복사했습니다 — 카톡에 붙여 보내세요'
      // 고객 화면에 올린 요청은 되돌리기로 거둘 수 없어 단추를 두지 않는다
      const todos = made ? [made] : []
      showToast(text, posted > 0 ? undefined : { label: '되돌리기', onClick: () => void undo([{ d, prev: rec, next: saved ?? next }], todos) })
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다. 다시 눌러 주세요.')
    } finally {
      setBusy(null)
    }
    return made
  }

  /**
   * D-160: 같은 종류 여러 건을 한 번에 [맞아요] — 복사(카톡 문구)는 하나씩 보내야 하므로 부르는 쪽에서 뺀다.
   * 같은 업체 결정이 여럿이면 앞에서 저장한 기록 위에 이어서 적는다(덮지 않게).
   */
  const answerMany = async (ds: Decision[]): Promise<JournalEntry[]> => {
    if (busy || ds.length === 0) return []
    setBusy('many')
    const fresh = new Map<string, ClientOpsRecord>()
    const made: JournalEntry[] = []
    const steps: { d: Decision; prev: ClientOpsRecord; next: ClientOpsRecord }[] = []
    let ok = 0
    try {
      for (const d of ds) {
        if (d.effect.type === 'copy') continue
        const rec = fresh.get(d.clientId) ?? latest(d.clientId)
        if (!rec) continue
        // 할 일 먼저 — 기록 저장이 실패하면 지운다
        const todo = await makeTodo(d)
        const next = withDecisionAnswer(rec, d, 'yes', notices, nowIso())
        let saved: ClientOpsRecord | null = null
        try {
          saved = await save(next)
        } catch (cause) {
          if (todo) await deleteJournalEntry(todo).catch(() => undefined)
          throw cause
        }
        if (!saved) {
          if (todo) await deleteJournalEntry(todo).catch(() => undefined)
          break
        }
        if (todo) made.push(todo)
        fresh.set(saved.id, saved)
        steps.push({ d, prev: rec, next: saved })
        ok += 1
      }
      showToast(ok === ds.length ? `${ok}건 모두 처리했습니다` : `${ok}건 처리했습니다 — 나머지는 다시 눌러 주세요`, ok > 0 ? { label: '되돌리기', onClick: () => void undo(steps, [...made]) } : undefined)
    } catch (cause) {
      showToast(cause instanceof Error ? `${ok}건 처리 · ${cause.message}` : `${ok}건 처리했습니다 — 나머지는 저장하지 못했습니다`, ok > 0 ? { label: '되돌리기', onClick: () => void undo(steps, [...made]) } : undefined)
    } finally {
      setBusy(null)
    }
    return made
  }
  return { answer, answerMany, busy }
}

/**
 * D-182: 맞는 공고 한 장 핵심 — '자세히' 를 누르면 그 자리에서 펼친다(다른 화면으로 가지 않는다).
 * 금액을 맨 앞 · 크게. 다른 공고까지 보려면 아래 '이 업체 공고 더 보기'.
 */
function GrantBriefPanel({ b, morePath }: { b: GrantBrief; morePath: string | null }) {
  const row = (label: string, value: string, strong = false) =>
    value ? (
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="t-meta font-semibold text-slate-500">{label}</dt>
        <dd className={`break-keep [overflow-wrap:anywhere] ${strong ? 'text-[1.05rem] font-bold text-slate-900' : 't-sub text-slate-800'}`}>{value}</dd>
      </div>
    ) : null
  return (
    <div data-testid="decision-grant-brief" className="flex flex-col gap-3 rounded-(--radius-control) border border-cat-fund-200 bg-cat-fund-50/50 p-3 sm:p-4">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
        <div data-testid="grant-brief-amount">{row('지원 금액', b.amount || '공고에 금액이 안 적혀 있어요', !!b.amount)}</div>
        {row('접수 기간', [b.period, b.deadline].filter(Boolean).join(' · '))}
        {row('선정 규모', b.slots)}
        {row('분야 · 기관', [b.category, b.agency].filter(Boolean).join(' · '))}
      </dl>
      {b.target && (
        <div className="flex flex-col gap-0.5">
          <p className="t-meta font-semibold text-slate-500">지원 대상</p>
          <p className="t-sub break-keep [overflow-wrap:anywhere] text-slate-800">{b.target}</p>
        </div>
      )}
      {(b.fits.length > 0 || b.conditions.length > 0) && (
        <div className="flex flex-col gap-1">
          <p className="t-meta font-semibold text-slate-500">{b.fits.length > 0 ? '이 업체와 맞는 조건' : '공고 조건'}</p>
          <ul className="flex flex-col gap-0.5" data-testid="grant-brief-fits">
            {(b.fits.length > 0 ? b.fits : b.conditions).map((t) => (
              <li key={t} className="t-sub flex items-start gap-1.5 break-keep [overflow-wrap:anywhere] text-slate-800">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-600" />
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {b.checks.length > 0 && (
        <p className="t-sub break-keep [overflow-wrap:anywhere] text-warning-800">더 확인할 것 — {b.checks.join(' · ')}</p>
      )}
      {b.summary && <p className="t-sub break-keep [overflow-wrap:anywhere] text-slate-600">{b.summary}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {b.url && (
          <a href={b.url} target="_blank" rel="noreferrer noopener" data-testid="grant-brief-source" className="tap t-sub inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
            공고 원문 <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        )}
        {morePath && (
          <Link to={morePath} data-testid="grant-brief-more" className="tap t-sub inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-brand-700 hover:underline">
            이 업체 공고 더 보기 <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
    </div>
  )
}

export function DecisionList({
  decisions,
  busy,
  onAnswer,
  showClient = true,
  limit,
  linked,
}: {
  decisions: Decision[]
  busy: string | null
  onAnswer: (d: Decision, a: 'yes' | 'no') => void
  showClient?: boolean
  limit?: number
  /** D-161: 고객 플랫폼이 연결된 업체 — 서류 요청은 고객 화면에도 올라간다고 단추에 밝힌다 */
  linked?: (clientId: string) => boolean
}) {
  const shown = limit ? decisions.slice(0, limit) : decisions
  // D-182: 펼친 공고 하나(다시 누르면 접힌다)
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-panel) border border-slate-200 bg-white" data-testid="decision-list">
      {shown.map((d) => (
        <li key={`${d.clientId}:${d.id}`} className="flex flex-col gap-2 px-4 py-3" data-testid="decision" data-kind={d.kind} data-client={d.clientId}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`t-meta rounded-full border px-2 py-0.5 font-semibold ${KIND_CLASS[d.kind]}`}>{DECISION_KIND_LABEL[d.kind]}</span>
            {showClient && (
              <Link to={`/ops/clients/${d.clientId}?tab=smart`} className="tap t-sub inline-flex items-center font-semibold [overflow-wrap:anywhere] text-slate-700 hover:text-brand-700 hover:underline">
                {d.clientName}
              </Link>
            )}
          </div>
          <p className="t-body font-semibold break-keep [overflow-wrap:anywhere] text-slate-900" data-testid="decision-title">{d.title}</p>
          <p className="t-sub break-keep [overflow-wrap:anywhere] text-slate-600">{d.why}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => onAnswer(d, 'yes')} data-testid="decision-yes">
              <Check aria-hidden="true" className="size-4" /> {d.kind === 'doc' && linked?.(d.clientId) ? '요청 보내기(문구 · 고객 화면)' : d.yesLabel}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => onAnswer(d, 'no')} data-testid="decision-no">
              <X aria-hidden="true" className="size-4" /> {d.noLabel}
            </Button>
            {d.grant ? (
              <button
                type="button"
                aria-expanded={openId === `${d.clientId}:${d.id}`}
                data-testid="decision-more"
                onClick={() => setOpenId((cur) => (cur === `${d.clientId}:${d.id}` ? null : `${d.clientId}:${d.id}`))}
                className="tap t-sub ml-auto inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"
              >
                {openId === `${d.clientId}:${d.id}` ? '접기' : '자세히'}
                <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${openId === `${d.clientId}:${d.id}` ? 'rotate-180' : ''}`} />
              </button>
            ) : (
              d.openPath && (
                <Link to={d.openPath} className="tap t-sub ml-auto inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
                  자세히 <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              )
            )}
          </div>
          {d.grant && openId === `${d.clientId}:${d.id}` && <GrantBriefPanel b={d.grant} morePath={d.openPath} />}
        </li>
      ))}
    </ul>
  )
}

/**
 * 오늘 화면 — 확인할 것 위의 셋(바로 답하기) + 모두 보기. 없으면 칸을 그리지 않는다.
 */
export function TodayDecisions({
  clients,
  today,
  workspaceId,
  userId,
  notices,
  usable,
  onSaved,
  onTodo,
  linkOf,
  onTodosRemoved,
}: {
  linkOf?: (clientId: string) => PortalClientLink | null
  onTodosRemoved?: (ids: string[]) => void
  clients: ClientOpsRecord[]
  today: string
  workspaceId: string | null
  userId: string | null
  notices: readonly GrantNotice[]
  usable: (key: string) => boolean
  onSaved: (r: ClientOpsRecord) => void
  onTodo: (e: JournalEntry) => void
}) {
  const all = useMemo(() => buildAllDecisions(clients, today, notices, usable), [clients, today, notices, usable])
  const { answer, busy } = useDecisionAnswer({
    workspaceId,
    userId,
    today,
    notices,
    latest: (id) => clients.find((c) => c.id === id),
    save: async (next) => {
      const saved = await saveClient(next)
      onSaved(saved)
      return saved
    },
    linkOf,
    onTodosRemoved,
  })
  if (all.length === 0) return null
  return (
    <section aria-labelledby="today-decide-title" data-testid="today-decide" className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="today-decide-title" className="flex items-center gap-2 text-[1.15rem] font-bold text-slate-900">
          <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <CheckCheck className="size-4" />
          </span>
          확인할 것
          <span className="text-[0.95rem] font-semibold text-slate-500">{all.length}</span>
        </h2>
        <Link to="/ops/decide" className="tap inline-flex items-center text-[0.9rem] font-medium text-brand-700 hover:underline" data-testid="today-decide-all">
          모두 보기
        </Link>
      </div>
      <p className="t-sub break-keep text-slate-500">서류 · 업체 기록 · 공고를 읽고 프로그램이 먼저 준비했어요. 맞으면 [맞아요], 아니면 [아니에요] 만 누르세요.</p>
      <DecisionList
        decisions={all}
        busy={busy}
        limit={3}
        linked={(id) => !!linkOf?.(id)}
        onAnswer={(d, a) =>
          void answer(d, a).then((made) => {
            if (made) onTodo(made)
          })
        }
      />
    </section>
  )
}
