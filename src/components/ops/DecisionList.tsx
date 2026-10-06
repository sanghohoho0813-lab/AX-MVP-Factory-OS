/**
 * 확인함 줄 (D-158) — 프로그램이 준비한 것에 '맞아요 / 아니에요' 만 고른다.
 * 맞아요: 정보 넣기 · 할 일 걸기 · 도전 체크 · 요청 문구 복사(결정마다 다름). 아니에요: 다시 묻지 않는다.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, CheckCheck, X } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { JournalEntry } from '../../types/bridge'
import { DECISION_KIND_LABEL, buildAllDecisions, withDecisionAnswer, type Decision, type DecisionKind } from '../../services/decisions'
import { saveClient } from '../../services/clientOpsService'
import type { GrantNotice } from '../../services/grants/grantMatch'
import { createJournalEntry } from '../../services/journalService'
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
}: {
  workspaceId: string | null
  userId: string | null
  today: string
  notices: readonly GrantNotice[]
  latest: (clientId: string) => ClientOpsRecord | undefined
  save: (next: ClientOpsRecord) => Promise<ClientOpsRecord | null>
}) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const answer = async (d: Decision, a: 'yes' | 'no'): Promise<JournalEntry | null> => {
    const rec = latest(d.clientId)
    if (!rec || busy) return null
    setBusy(d.id)
    let made: JournalEntry | null = null
    try {
      // 복사는 먼저(클립보드는 누른 바로 그때만 허락된다)
      if (a === 'yes' && d.effect.type === 'copy') {
        const ok = await copyText(d.effect.text)
        if (!ok) {
          showToast('복사하지 못했습니다 — 서류 탭의 서류 요청 문구에서 복사해 주세요')
          return null
        }
      }
      const saved = await save(withDecisionAnswer(rec, d, a, notices, nowIso()))
      if (!saved) return null
      if (a === 'yes' && d.effect.type === 'todo') {
        made = await createJournalEntry(workspaceId, userId, {
          entryDate: today,
          entryType: 'follow_up',
          content: d.effect.text,
          clientId: d.clientId,
          dueDate: addDaysLocal(today, d.effect.dueInDays),
        })
      }
      showToast(
        a === 'no'
          ? '다시 묻지 않습니다'
          : d.doneText
            ? d.doneText
            : d.effect.type === 'fact'
            ? '업체 정보에 넣었습니다'
            : d.effect.type === 'todo'
              ? `할 일로 걸었습니다 — ${addDaysLocal(today, d.effect.dueInDays).slice(5).replace('-', '/')}`
              : d.effect.type === 'grant'
                ? '도전 체크 — 마감을 일정 · 오늘에 띄웁니다'
                : '서류 요청 문구를 복사했습니다 — 카톡에 붙여 보내세요',
      )
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
    let ok = 0
    try {
      for (const d of ds) {
        if (d.effect.type === 'copy') continue
        const rec = fresh.get(d.clientId) ?? latest(d.clientId)
        if (!rec) continue
        const saved = await save(withDecisionAnswer(rec, d, 'yes', notices, nowIso()))
        if (!saved) break
        fresh.set(saved.id, saved)
        ok += 1
        if (d.effect.type === 'todo') {
          made.push(
            await createJournalEntry(workspaceId, userId, {
              entryDate: today,
              entryType: 'follow_up',
              content: d.effect.text,
              clientId: d.clientId,
              dueDate: addDaysLocal(today, d.effect.dueInDays),
            }),
          )
        }
      }
      showToast(ok === ds.length ? `${ok}건 모두 처리했습니다` : `${ok}건 처리했습니다 — 나머지는 다시 눌러 주세요`)
    } catch (cause) {
      showToast(cause instanceof Error ? `${ok}건 처리 · ${cause.message}` : `${ok}건 처리했습니다 — 나머지는 저장하지 못했습니다`)
    } finally {
      setBusy(null)
    }
    return made
  }
  return { answer, answerMany, busy }
}

export function DecisionList({
  decisions,
  busy,
  onAnswer,
  showClient = true,
  limit,
}: {
  decisions: Decision[]
  busy: string | null
  onAnswer: (d: Decision, a: 'yes' | 'no') => void
  showClient?: boolean
  limit?: number
}) {
  const shown = limit ? decisions.slice(0, limit) : decisions
  return (
    <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-panel) border border-slate-200 bg-white" data-testid="decision-list">
      {shown.map((d) => (
        <li key={`${d.clientId}:${d.id}`} className="flex flex-col gap-2 px-4 py-3" data-testid="decision" data-kind={d.kind} data-client={d.clientId}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`t-meta rounded-full border px-2 py-0.5 font-semibold ${KIND_CLASS[d.kind]}`}>{DECISION_KIND_LABEL[d.kind]}</span>
            {showClient && (
              <Link to={`/ops/clients/${d.clientId}?tab=smart`} className="t-sub font-semibold [overflow-wrap:anywhere] text-slate-700 hover:text-brand-700 hover:underline">
                {d.clientName}
              </Link>
            )}
          </div>
          <p className="t-body font-semibold break-keep [overflow-wrap:anywhere] text-slate-900" data-testid="decision-title">{d.title}</p>
          <p className="t-sub break-keep [overflow-wrap:anywhere] text-slate-600">{d.why}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => onAnswer(d, 'yes')} data-testid="decision-yes">
              <Check aria-hidden="true" className="size-4" /> {d.yesLabel}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => onAnswer(d, 'no')} data-testid="decision-no">
              <X aria-hidden="true" className="size-4" /> {d.noLabel}
            </Button>
            {d.openPath && (
              <Link to={d.openPath} className="tap t-sub ml-auto inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
                자세히 <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </div>
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
}: {
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
        onAnswer={(d, a) =>
          void answer(d, a).then((made) => {
            if (made) onTodo(made)
          })
        }
      />
    </section>
  )
}
