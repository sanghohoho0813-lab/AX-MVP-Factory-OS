import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { JournalEntry } from '../../types/bridge'
import { useToast } from '../ui/toastContext'
import { ConfirmModal } from '../ui/ConfirmModal'
import { QuickCapture } from '../journal/QuickCapture'
import { JournalList } from '../journal/JournalList'
import {
  applyJournalFilter,
  createJournalEntry,
  deleteJournalEntry,
  listJournal,
  updateJournalEntry,
} from '../../services/journalService'
import { todayLocalDate } from '../../lib/appClock'

/** 업체 상세 > 업무 일기 탭 — 이 고객과 관련된 기록만. 고객에게는 보이지 않는다. */
export function ClientJournalTab({ record, workspaceId, userId }: { record: ClientOpsRecord; workspaceId: string | null; userId: string | null }) {
  const { showToast } = useToast()
  const today = todayLocalDate()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingDelete, setPendingDelete] = useState<JournalEntry | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setEntries(await listJournal(workspaceId))
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const mine = useMemo(() => applyJournalFilter(entries, { range: 'all', clientId: record.id }, today), [entries, record.id, today])
  const clientNames = useMemo(() => new Map([[record.id, record.companyName]]), [record.id, record.companyName])

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
    <div className="flex flex-col gap-4">
      <QuickCapture
        clients={[record]}
        defaultClientId={record.id}
        onCreate={(input) => mutate(() => createJournalEntry(workspaceId, userId, { ...input, clientId: record.id }), '기록했습니다.')}
      />
      {loading ? (
        <p className="py-6 text-center text-[0.95rem] text-slate-500">불러오는 중…</p>
      ) : (
        <JournalList
          entries={mine}
          clientNames={clientNames}
          today={today}
          showClient={false}
          onToggleComplete={(e) => void mutate(() => updateJournalEntry(e, { completed: !e.completed }))}
          onTogglePin={(e) => void mutate(() => updateJournalEntry(e, { pinned: !e.pinned }))}
          onEdit={(e, content) => { if (content) void mutate(() => updateJournalEntry(e, { content }), '수정했습니다.') }}
          onDelete={(e) => setPendingDelete(e)}
          emptyTitle="이 업체에 대한 기록이 없습니다."
          emptyHint="통화·결정·후속조치를 남기면 이 업체의 이력이 시간순으로 이어집니다."
        />
      )}
      <ConfirmModal
        open={pendingDelete !== null}
        title="기록 삭제"
        message="이 기록을 지웁니다. 되돌릴 수 없습니다."
        confirmLabel="삭제"
        danger
        onConfirm={() => { const t = pendingDelete; setPendingDelete(null); if (t) void mutate(() => deleteJournalEntry(t), '지웠습니다.') }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
