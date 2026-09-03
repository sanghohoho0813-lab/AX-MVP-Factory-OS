import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { useToast } from '../components/ui/toastContext'
import { QuickCapture } from '../components/journal/QuickCapture'
import { JournalList } from '../components/journal/JournalList'
import { ScreenGuide } from '../components/onboarding/ScreenGuide'
import { listClients } from '../services/clientOpsService'
import {
  JOURNAL_TYPES,
  JOURNAL_TYPE_LABEL,
  applyJournalFilter,
  createJournalEntry,
  deleteJournalEntry,
  listJournal,
  updateJournalEntry,
  type JournalRange,
} from '../services/journalService'
import { todayLocalDate } from '../lib/appClock'
import type { ClientOpsRecord } from '../types/clientOps'
import type { JournalEntry, JournalEntryType } from '../types/bridge'

const RANGE_LABEL: Record<JournalRange, string> = { today: '오늘', week: '이번 주', all: '전체' }

function isRange(v: string | undefined): v is JournalRange {
  return v === 'today' || v === 'week' || v === 'all'
}

/**
 * 업무 일기 — 왜 그렇게 판단했는지, 누구와 무엇을 이야기했는지, 다음에 무엇을 해야 하는지가
 * 시간축으로 남는 개인 업무기억. 고객에게는 어떤 경로로도 보이지 않는다.
 */
function JournalContent({ workspaceId, userId }: { workspaceId: string | null; userId: string | null }) {
  const { range: rangeParam } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const range: JournalRange = isRange(rangeParam) ? rangeParam : 'today'
  const today = todayLocalDate()

  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [clients, setClients] = useState<ClientOpsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [clientFilter, setClientFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<JournalEntryType | ''>('')
  const [openOnly, setOpenOnly] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<JournalEntry | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [j, c] = await Promise.all([listJournal(workspaceId), listClients(workspaceId)])
      setEntries(j)
      setClients(c.filter((r) => r.archivedAt === null))
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

  const visible = useMemo(
    () =>
      applyJournalFilter(
        entries,
        { range, clientId: clientFilter || null, type: typeFilter || null, openFollowUpsOnly: openOnly },
        today,
      ),
    [entries, range, clientFilter, typeFilter, openOnly, today],
  )

  const counts = useMemo(() => {
    const byType = new Map<JournalEntryType, number>()
    for (const e of applyJournalFilter(entries, { range }, today)) byType.set(e.entryType, (byType.get(e.entryType) ?? 0) + 1)
    return byType
  }, [entries, range, today])

  const mutate = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn()
      await load()
      if (done) showToast(done)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
      <PageHeader
        title="업무 일기"
        description="통화·결정·후속조치·막힘·성과·아이디어를 시간순으로 남깁니다. 고객에게는 보이지 않는 나만의 기록입니다."
        actions={<ScreenGuide screenKey="journal" />}
      />

      <QuickCapture
        clients={clients}
        onCreate={(input) => mutate(() => createJournalEntry(workspaceId, userId, input), '기록했습니다.')}
      />

      {/* 범위 · 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="기간" className="flex rounded-(--radius-control) border border-slate-200 bg-white p-0.5">
          {(['today', 'week', 'all'] as JournalRange[]).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              onClick={() => navigate(r === 'today' ? '/journal' : `/journal/${r}`)}
              className={`rounded-[8px] px-3 py-1.5 text-[0.92rem] font-semibold ${
                range === r ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          aria-label="고객사로 보기"
          className="rounded-(--radius-control) border border-slate-300 px-2.5 py-2 text-[0.92rem] text-slate-700"
        >
          <option value="">모든 고객사</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.companyName}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as JournalEntryType | '')}
          aria-label="종류로 보기"
          className="rounded-(--radius-control) border border-slate-300 px-2.5 py-2 text-[0.92rem] text-slate-700"
        >
          <option value="">모든 종류</option>
          {JOURNAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {JOURNAL_TYPE_LABEL[t]}{counts.get(t) ? ` (${counts.get(t)})` : ''}
            </option>
          ))}
        </select>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[0.92rem] text-slate-600">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="size-4 accent-brand-600" />
          안 끝난 후속조치만
        </label>
        <span className="ml-auto text-[0.88rem] text-slate-500">{visible.length}건</span>
      </div>

      {loading ? (
        <p className="py-8 text-center text-[0.95rem] text-slate-500">불러오는 중…</p>
      ) : (
        <JournalList
          entries={visible}
          clientNames={clientNames}
          today={today}
          showDate={range !== 'today'}
          onToggleComplete={(e) => void mutate(() => updateJournalEntry(e, { completed: !e.completed }))}
          onTogglePin={(e) => void mutate(() => updateJournalEntry(e, { pinned: !e.pinned }))}
          onEdit={(e, content) => { if (content) void mutate(() => updateJournalEntry(e, { content }), '수정했습니다.') }}
          onDelete={(e) => setPendingDelete(e)}
          emptyTitle={range === 'today' ? '오늘 기록된 업무가 없습니다.' : '이 기간에 기록이 없습니다.'}
        />
      )}

      <ConfirmModal
        open={pendingDelete !== null}
        title="기록 삭제"
        message="이 기록을 지웁니다. 되돌릴 수 없습니다."
        confirmLabel="삭제"
        danger
        onConfirm={() => {
          const target = pendingDelete
          setPendingDelete(null)
          if (target) void mutate(() => deleteJournalEntry(target), '지웠습니다.')
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

export function JournalPage() {
  return <WorkspaceScope>{(ctx) => <JournalContent workspaceId={ctx.workspaceId} userId={ctx.userId} />}</WorkspaceScope>
}
