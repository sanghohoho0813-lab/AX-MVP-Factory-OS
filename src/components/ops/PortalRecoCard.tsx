/**
 * D-689 업체 상세 › 고객 플랫폼 탭 — 고객에게 추천(고객 화면 '담당자가 추천해요').
 *
 * 담당자가 고른 것만 고객에게 보인다 — 저절로 나가는 것 0. 업체마다 3개까지(서버도 막는다).
 *  [추천 고르기] → 후보(맞는 공고 · 먼저 제안할 것 — 판정은 그 모듈 그대로) 또는 [직접 적기] → 제목 · 근거 한 줄 · 마감 · 공고 주소 고치기
 *  → 미리 보기(고객이 보는 모양) → [고객 화면에 올리기]. 금액 · 점수는 고객 화면에 쓰지 않는다(올리기 단추를 막는다).
 * 올라간 추천마다 고객 계정이 누른 [관심 있어요] · [연락했어요](업체 기록의 안부 연락 날) · [내리기](지우지 않음).
 * 0036 을 아직 넣지 않았거나 되돌렸으면 아무것도 그리지 않는다. 연습 모드에는 고객 관심 기록이 없다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Lightbulb, PencilLine, PhoneCall, Plus, Undo2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { BottomSheet } from '../ui/primitives'
import { HelpHeading } from '../ui/fold'
import { useToast } from '../ui/toastContext'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { PortalClientLink } from '../../types/bridge'
import { generateId } from '../../storage/localStore'
import { localDateOf } from '../../lib/appClock'
import { featureUsable, useEntitlements } from '../../lib/entitlementsStore'
import { useGrantData } from '../grants/useGrants'
import { grantClients } from '../../services/grants/grantView'
import { matchesFor } from '../../services/grants/grantMatch'
import { isRecoOff, listClientRecos, listRecoInterests, recoErrorText, showReco, withdrawReco, type PortalReco, type PortalRecoInterest } from '../../services/portalReco'
import {
  RECO_KIND_LABEL,
  RECO_LIMIT,
  RECO_REASON_MAX,
  RECO_TITLE_MAX,
  cleanLink,
  grantCandidates,
  pendingInterests,
  recoDeadlineText,
  recoInputProblem,
  refKey,
  taskCandidates,
  type RecoCandidate,
  type RecoKind,
  type RecoSourceRef,
} from '../../services/portalRecoRules'

const md = (iso?: string | null) => {
  const d = localDateOf(iso ?? '')
  return d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : ''
}

interface Draft {
  kind: RecoKind
  title: string
  reason: string
  deadline: string
  linkUrl: string
  sourceRef: RecoSourceRef | null
}

export function PortalRecoCard({
  record,
  workspaceId,
  links,
  readOnly,
  today,
  onContacted,
}: {
  record: ClientOpsRecord
  workspaceId: string | null
  links: readonly PortalClientLink[]
  readOnly?: boolean
  today: string
  /** [연락했어요] — 업체 기록의 안부 연락 날을 오늘로(관심 줄이 빠진다) */
  onContacted?: () => Promise<boolean>
}) {
  const { showToast } = useToast()
  // failed = 잠깐 끊겨 못 읽음(D-691 — 0036 이 없는 것과 갈라 [다시 읽기] 한 줄)
  const [state, setState] = useState<{ off: boolean; failed?: boolean; recos: PortalReco[]; interests: PortalRecoInterest[] } | null>(null)
  const [picking, setPicking] = useState(false)
  const [withdrawing, setWithdrawing] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [recos, interests] = await Promise.all([listClientRecos(workspaceId, record.id), listRecoInterests(workspaceId, record.id)])
      setState({ off: false, recos, interests })
    } catch (cause) {
      setState({ off: true, failed: !isRecoOff(cause), recos: [], interests: [] })
    }
  }, [workspaceId, record.id])

  useEffect(() => {
    void load()
  }, [load])

  if (state?.failed)
    return (
      <section className="flex flex-wrap items-center gap-2 rounded-(--radius-panel) border border-slate-200 bg-white p-4" role="status" data-testid="reco-failed">
        <p className="t-sub min-w-0 flex-1 basis-56 break-keep text-danger-700">고객에게 추천 — 기록을 읽지 못했어요. 인터넷 연결을 확인하고 다시 읽어 주세요.</p>
        <Button variant="secondary" size="sm" onClick={() => void load()} data-testid="reco-retry">
          다시 읽기
        </Button>
      </section>
    )
  if (!state || state.off) return null
  const shown = state.recos.filter((r) => r.status === 'shown')
  const full = shown.length >= RECO_LIMIT
  const emailOf = (linkId: string) => links.find((l) => l.id === linkId)?.profileEmail || '고객 계정'
  const pending = pendingInterests(shown, state.interests, record.care?.lastContactAt)
  const pendingIds = new Set(pending.map((p) => `${p.recId}|${p.interestedAt}`))

  const doWithdraw = async (id: string) => {
    if (busy) return
    setBusy(true)
    try {
      await withdrawReco(id)
      setWithdrawing('')
      showToast('고객 화면에서 내렸어요. 기록은 남아 있어요.')
      await load()
    } catch (cause) {
      showToast(recoErrorText(cause, '내리지 못했어요 — 잠시 뒤 다시 눌러 주세요.'))
    } finally {
      setBusy(false)
    }
  }

  const doContacted = async () => {
    if (busy || !onContacted) return
    setBusy(true)
    try {
      if (await onContacted()) showToast('연락한 것으로 적었어요 — 오늘 화면에서 빠져요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)" data-testid="portal-recos" data-count={shown.length}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <HelpHeading as="h3" tight label="고객에게 추천" className="text-[1rem] font-bold text-slate-900">
          고객에게 추천 <span className="text-slate-400">{shown.length}/{RECO_LIMIT}</span>
        </HelpHeading>
        {!readOnly && (
          <Button variant="secondary" disabled={full} onClick={() => setPicking(true)} data-testid="reco-pick-open" data-guide="fn-portal-reco">
            <Lightbulb aria-hidden="true" className="size-4" /> 추천 고르기
          </Button>
        )}
      </div>
      {full && !readOnly && <p className="t-meta mt-1 text-slate-500" data-testid="reco-full">{RECO_LIMIT}개까지 올려요 — 하나를 내리면 다시 고를 수 있어요.</p>}
      {shown.length === 0 ? (
        <p className="mt-2 text-[0.9375rem] break-keep text-slate-500" data-testid="reco-empty">
          아직 올린 추천이 없어요. 맞는 공고 · 먼저 제안할 것 가운데 골라 고객 화면에 올려요 — 고른 것만 보여요.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {shown.map((r) => {
            const ints = state.interests.filter((i) => i.recId === r.id)
            const dl = recoDeadlineText(r.deadline, today)
            return (
              <li key={r.id} className="rounded-(--radius-card) border border-slate-200 p-3" data-testid="reco-row" data-kind={r.kind}>
                <div className="flex flex-wrap items-center gap-2 text-[0.875rem]">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{RECO_KIND_LABEL[r.kind]}</span>
                  <span className="text-slate-500">{md(r.shownAt)} 올림</span>
                  {dl && <span className={dl === '마감' ? 'font-semibold text-danger-700' : 'text-slate-600'}>{dl}</span>}
                </div>
                <p className="mt-1 text-[1rem] font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">{r.title}</p>
                {r.reason && <p className="t-sub break-keep text-slate-600 [overflow-wrap:anywhere]">{r.reason}</p>}
                <p className="t-sub mt-1 flex flex-col gap-0.5">
                  {ints.length === 0 ? (
                    <span className="text-slate-500" data-testid="reco-interest" data-state="none">아직 관심 표시 없음</span>
                  ) : (
                    ints.map((i) => {
                      const hot = pendingIds.has(`${i.recId}|${i.interestedAt}`)
                      return (
                        <span key={`${i.linkId}${i.interestedAt}`} className={hot ? 'font-semibold text-danger-700' : 'text-slate-700'} data-testid="reco-interest" data-state={hot ? 'pending' : 'done'}>
                          {emailOf(i.linkId)} · 관심 있어요 {md(i.interestedAt)}{hot ? ' — 연락드려 주세요' : ''}
                        </span>
                      )
                    })
                  )}
                </p>
                {!readOnly &&
                  (withdrawing === r.id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="reco-withdraw-confirm">
                      <span className="t-sub text-slate-700">고객 화면에서 내릴까요? 기록은 남아요.</span>
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => void doWithdraw(r.id)} data-testid="reco-withdraw-go">내리기</Button>
                      <Button size="sm" variant="ghost" onClick={() => setWithdrawing('')}>취소</Button>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setWithdrawing(r.id)} data-testid="reco-withdraw">
                        <Undo2 aria-hidden="true" className="size-4" /> 내리기
                      </Button>
                    </div>
                  ))}
              </li>
            )
          })}
        </ul>
      )}
      {pending.length > 0 && !readOnly && onContacted && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3" data-testid="reco-pending">
          <span className="t-sub min-w-0 flex-1 basis-56 break-keep text-danger-700">관심 있다고 하신 추천이 {pending.length}개 있어요 — 연락드린 뒤 눌러 주세요.</span>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void doContacted()} data-testid="reco-contacted">
            <PhoneCall aria-hidden="true" className="size-4" /> 연락했어요
          </Button>
        </div>
      )}
      {picking && (
        <RecoPickSheet
          record={record}
          workspaceId={workspaceId}
          today={today}
          shown={shown}
          onClose={() => setPicking(false)}
          onDone={() => {
            setPicking(false)
            void load()
          }}
        />
      )}
    </section>
  )
}

function RecoPickSheet({
  record,
  workspaceId,
  today,
  shown,
  onClose,
  onDone,
}: {
  record: ClientOpsRecord
  workspaceId: string | null
  today: string
  shown: readonly PortalReco[]
  onClose: () => void
  onDone: () => void
}) {
  const { showToast } = useToast()
  const { ent } = useEntitlements()
  const grantsOn = featureUsable(ent, 'grants')
  const { notices, loaded } = useGrantData(grantsOn ? workspaceId : null)
  const [picks, setPicks] = useState<{ key: string; label: string }[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  // 이 초안의 올리기 번호 — 두 번 눌러도 · 실패 뒤 다시 눌러도 같은 번호(서버가 한 건으로)
  const clientKey = useRef('')

  // 먼저 제안할 것 — 맞춤 추천 카드와 같은 판정 · 같은 순서(D-618 판정은 한 곳)
  useEffect(() => {
    let alive = true
    import('../../services/clientInsights')
      .then(({ buildInsights, topPicks }) => {
        const list = topPicks(buildInsights(record, today, grantsOn ? notices : [], (k) => featureUsable(ent, k)), 3).filter((i) => i.key !== 'grants')
        if (alive) setPicks(list.map((i) => ({ key: i.key, label: i.label })))
      })
      .catch(() => alive && setPicks([]))
    return () => {
      alive = false
    }
  }, [record, today, notices, ent, grantsOn])

  const shownRefs = useMemo(() => new Set(shown.map((r) => refKey(r.sourceRef)).filter(Boolean)), [shown])
  const grantList = useMemo(() => {
    if (!grantsOn) return []
    const client = grantClients([record], today)[0]
    return client ? grantCandidates(matchesFor(notices, client.profile, today), shownRefs) : []
  }, [grantsOn, record, today, notices, shownRefs])
  const taskList = useMemo(() => (picks ? taskCandidates(picks, shownRefs) : []), [picks, shownRefs])

  const start = (c: RecoCandidate | null) => {
    clientKey.current = `reco-${generateId()}`
    setDraft(
      c
        ? { kind: c.kind, title: c.title, reason: c.reason, deadline: c.deadline ?? '', linkUrl: c.linkUrl ?? '', sourceRef: c.sourceRef }
        : { kind: 'task', title: '', reason: '', deadline: '', linkUrl: '', sourceRef: null },
    )
  }

  const problem = draft ? recoInputProblem(draft) : null
  const submit = async () => {
    if (!draft || busy || problem) return
    setBusy(true)
    try {
      const out = await showReco(workspaceId, record.id, {
        clientKey: clientKey.current,
        kind: draft.kind,
        title: draft.title.trim(),
        reason: draft.reason.trim(),
        deadline: /^\d{4}-\d{2}-\d{2}$/.test(draft.deadline) ? draft.deadline : null,
        linkUrl: cleanLink(draft.linkUrl),
        sourceRef: draft.sourceRef,
      })
      showToast(out.created ? '고객 화면에 올렸어요 — 고객 홈 \'담당자가 추천해요\' 에 보여요.' : '이미 올라가 있는 추천이에요.')
      onDone()
    } catch (cause) {
      showToast(recoErrorText(cause, '올리지 못했어요 — 잠시 뒤 다시 눌러 주세요.'))
    } finally {
      setBusy(false)
    }
  }

  if (draft) {
    const dl = recoDeadlineText(/^\d{4}-\d{2}-\d{2}$/.test(draft.deadline) ? draft.deadline : null, today)
    return (
      <BottomSheet
        title="고객에게 이렇게 보여요"
        onClose={onClose}
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" className="w-full sm:w-auto" disabled={busy || !!problem} onClick={() => void submit()} data-testid="reco-show-go">
              고객 화면에 올리기
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)} data-testid="reco-back">
              다른 것 고르기
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3" data-testid="reco-edit">
          <div className="rounded-(--radius-card) border border-slate-200 bg-white p-3" data-testid="reco-preview">
            <p className="t-meta text-slate-500">{RECO_KIND_LABEL[draft.kind]}{dl ? ` · ${dl}` : ''}</p>
            <p className="t-body font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{draft.title.trim() || '(제목)'}</p>
            {draft.reason.trim() && <p className="t-sub break-keep text-slate-600 [overflow-wrap:anywhere]">{draft.reason.trim()}</p>}
          </div>
          <label className="flex flex-col gap-1">
            <span className="t-sub font-semibold text-slate-700">제목</span>
            <input value={draft.title} maxLength={RECO_TITLE_MAX} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="t-body min-h-11 rounded-(--radius-control) border border-slate-300 px-3" data-testid="reco-edit-title" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="t-sub font-semibold text-slate-700">근거 한 줄(금액 · 점수 없이)</span>
            {/* D-691 160자까지라 휴대폰 한 줄 칸에서는 앞이 안 보였다 — 세 줄 글칸(줄바꿈은 고객 화면에서 띄어쓰기로) */}
            <textarea
              value={draft.reason}
              maxLength={RECO_REASON_MAX}
              rows={3}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value.replace(/\s*\n+\s*/g, ' ') })}
              placeholder="예: 지역 · 업력 조건이 맞아요"
              className="t-body min-h-11 resize-y rounded-(--radius-control) border border-slate-300 px-3 py-2 break-keep"
              data-testid="reco-edit-reason"
            />
            <span className="t-meta self-end text-slate-500 tabular-nums" data-testid="reco-edit-reason-count">
              {draft.reason.length}/{RECO_REASON_MAX}
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
              <span className="t-sub font-semibold text-slate-700">마감일(있으면)</span>
              <input type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} className="t-body min-h-11 rounded-(--radius-control) border border-slate-300 px-3" data-testid="reco-edit-deadline" />
            </label>
            <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
              <span className="t-sub font-semibold text-slate-700">공고 주소(있으면)</span>
              <input value={draft.linkUrl} onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })} placeholder="https://" inputMode="url" className="t-body min-h-11 rounded-(--radius-control) border border-slate-300 px-3" data-testid="reco-edit-url" />
            </label>
          </div>
          {!draft.sourceRef && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="종류">
              {(['task', 'grant'] as const).map((k) => (
                <button key={k} type="button" aria-pressed={draft.kind === k} onClick={() => setDraft({ ...draft, kind: k })} className={`tap t-sub inline-flex min-h-10 items-center rounded-full border px-3 font-semibold ${draft.kind === k ? 'border-brand-600 bg-white text-brand-700' : 'border-slate-300 bg-white text-slate-600'}`} data-testid="reco-edit-kind" data-kind={k}>
                  {RECO_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          )}
          {problem && <p className="t-sub break-keep text-danger-700" data-testid="reco-edit-problem">{problem}</p>}
          <p className="t-meta break-keep text-slate-500">고객이 [관심 있어요] 를 누르면 오늘 화면에 '연락드려 주세요' 한 줄이 떠요. 저절로 보내는 것은 없어요.</p>
        </div>
      </BottomSheet>
    )
  }

  const row = (c: RecoCandidate) => (
    <li key={c.key}>
      <button
        type="button"
        disabled={c.shown}
        onClick={() => start(c)}
        className="tap flex min-h-12 w-full flex-col items-start gap-0.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-default disabled:opacity-60"
        data-testid="reco-candidate"
        data-key={c.key}
        data-shown={c.shown ? '1' : '0'}
      >
        <span className="t-body w-full font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">{c.title}</span>
        <span className="t-sub w-full break-keep text-slate-600">{c.shown ? '이미 올라가 있어요' : [c.reason, recoDeadlineText(c.deadline, today)].filter(Boolean).join(' · ')}</span>
      </button>
    </li>
  )

  return (
    <BottomSheet title="고객에게 추천할 것 고르기" onClose={onClose}>
      <div className="flex flex-col gap-4" data-testid="reco-pick">
        {grantsOn && (
          <div className="flex flex-col gap-1.5">
            <p className="t-sub font-bold text-slate-900">맞는 공고</p>
            {!loaded ? (
              <p className="t-sub text-slate-500">공고를 불러오는 중…</p>
            ) : grantList.length === 0 ? (
              <p className="t-sub break-keep text-slate-500" data-testid="reco-no-grants">지금 이 업체에 맞는 접수 중 공고가 없어요.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">{grantList.map(row)}</ul>
            )}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <p className="t-sub font-bold text-slate-900">먼저 제안할 것</p>
          {picks === null ? (
            <p className="t-sub text-slate-500">판정을 읽는 중…</p>
          ) : taskList.length === 0 ? (
            <p className="t-sub break-keep text-slate-500" data-testid="reco-no-tasks">업체 기록으로는 아직 먼저 제안할 것이 없어요 — 서류를 더 받으면 생겨요.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">{taskList.map(row)}</ul>
          )}
        </div>
        <Button variant="ghost" className="self-start" onClick={() => start(null)} data-testid="reco-manual">
          <PencilLine aria-hidden="true" className="size-4" /> 직접 적기
        </Button>
        <p className="t-meta break-keep text-slate-500">
          <Plus aria-hidden="true" className="mr-0.5 inline size-3.5 align-[-2px]" />
          고른 것만 고객 화면에 보여요 · 금액 · 점수는 싣지 않아요 · {RECO_LIMIT}개까지
        </p>
      </div>
    </BottomSheet>
  )
}
