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
import { nowIso, todayLocalDate } from '../../lib/appClock'
import { TalkCard } from '../home/TalkCard'
import { applyTalk, hasTalk, talkFound, type TalkFound } from '../../services/homeAsk/talkApply'

/**
 * 업체 상세 > 업무 일기 탭 — 이 고객과 관련된 기록만. 고객에게는 보이지 않는다.
 * D-505 적은 메모에서 사정 · 숫자 · 다음 약속을 읽어(오늘 대화창과 같은 규칙) [이 업체에 기록] 한 번 — onCommit 이 있을 때만.
 */
export function ClientJournalTab({
  record,
  workspaceId,
  userId,
  onCommit,
  latest,
}: {
  record: ClientOpsRecord
  workspaceId: string | null
  userId: string | null
  /** 업체 기록 저장(성공하면 true) */
  onCommit?: (next: ClientOpsRecord) => Promise<boolean>
  /** 저장 중에도 가장 새 기록 */
  latest?: () => ClientOpsRecord | null
}) {
  const { showToast } = useToast()
  const today = todayLocalDate()
  const [told, setTold] = useState<{ found: TalkFound; saved: boolean } | null>(null)
  const [talkBusy, setTalkBusy] = useState(false)
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

  /** 됐으면 true — 실패하면 false 를 돌려줘서 적던 글을 지우지 않게 한다(D-122) */
  const mutate = async (fn: () => Promise<unknown>, done?: string): Promise<boolean> => {
    try {
      await fn()
    } catch (cause) {
      showToast(cause instanceof Error ? `${cause.message} — 적은 글은 그대로 있습니다.` : '저장하지 못했습니다. 적은 글은 그대로 있습니다.')
      return false
    }
    await load()
    if (done) showToast(done)
    return true
  }

  return (
    <div className="flex flex-col gap-4">
      <QuickCapture
        clients={[record]}
        defaultClientId={record.id}
        onCreate={async (input) => {
          const ok = await mutate(() => createJournalEntry(workspaceId, userId, { ...input, clientId: record.id }), '기록했습니다.')
          // D-505 메모에 업체 사정 · 숫자 · 다음 약속이 있으면 카드로(이미 업체에 같은 값이면 안 보임)
          if (ok && onCommit) {
            const found = talkFound(input.content, latest?.() ?? record, today)
            setTold(hasTalk(found) ? { found, saved: false } : null)
          }
          return ok
        }}
      />
      {told && (
        <TalkCard
          company={record.companyName}
          title={`이 메모에서 알게 된 ${record.companyName} 사정`}
          answers={told.found.answers}
          numbers={told.found.numbers}
          next={told.found.next}
          saved={told.saved}
          savedText={`${record.companyName}에 기록했어요 — 회사 정보 · 상황 예시 · 다음 할 일에 들어갔어요`}
          busy={talkBusy}
          testId="journal-talk"
          onRecord={async () => {
            if (!onCommit || talkBusy) return
            setTalkBusy(true)
            const ok = await onCommit(applyTalk(latest?.() ?? record, told.found, nowIso())).catch(() => false)
            setTalkBusy(false)
            if (ok) {
              setTold({ ...told, saved: true })
              showToast(`${record.companyName}에 기록했어요 — 상황 예시 · 판정을 다시 맞췄어요`)
            }
          }}
        />
      )}
      {loading ? (
        <p className="py-6 text-center text-[0.95rem] text-slate-500">불러오는 중…</p>
      ) : (
        <JournalList
          entries={mine}
          clientNames={clientNames}
          today={today}
          showClient={false}
          onToggleComplete={(e) => mutate(() => updateJournalEntry(e, { completed: !e.completed }))}
          onTogglePin={(e) => mutate(() => updateJournalEntry(e, { pinned: !e.pinned }))}
          onEdit={(e, content) => mutate(() => updateJournalEntry(e, { content }), '수정했습니다.')}
          onDelete={(e) => setPendingDelete(e)}
          emptyTitle="이 업체에 대한 기록이 없습니다."
          emptyHint="통화·결정·할 일을 남기면 이 업체의 이력이 시간순으로 이어집니다."
        />
      )}
      <ConfirmModal
        open={pendingDelete !== null}
        title="기록 삭제"
        message="이 기록을 지웁니다. 되돌릴 수 없습니다."
        confirmLabel="지우기"
        danger
        onConfirm={() => { const t = pendingDelete; setPendingDelete(null); if (t) void mutate(() => deleteJournalEntry(t), '지웠습니다.') }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
