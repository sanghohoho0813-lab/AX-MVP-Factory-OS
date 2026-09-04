import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Check, NotebookPen, Pencil, Pin, PinOff, Trash2, X } from 'lucide-react'
import type { JournalEntry } from '../../types/bridge'
import { JOURNAL_TYPE_CLASS, JOURNAL_TYPE_LABEL } from '../../services/journalService'
import { daysLeftFrom, dueText } from '../../services/clientOpsAlerts'

/**
 * 업무 일기 목록 — 시간순 타임라인.
 * 후속조치는 완료 체크, 모든 항목은 수정·삭제·고정이 된다.
 * 고객 이름을 누르면 그 업체 상세로 간다.
 */
export function JournalList({
  entries,
  clientNames,
  today,
  onToggleComplete,
  onTogglePin,
  onEdit,
  onDelete,
  showClient = true,
  showDate = true,
  emptyTitle = '오늘 기록된 업무가 없습니다.',
  emptyHint = '통화·결정·후속조치를 바로 남겨두면 나중에 고객별 이력이 이어집니다.',
}: {
  entries: JournalEntry[]
  clientNames: Map<string, string>
  today: string
  onToggleComplete: (e: JournalEntry) => void
  onTogglePin: (e: JournalEntry) => void
  onEdit: (e: JournalEntry, content: string) => void
  onDelete: (e: JournalEntry) => void
  showClient?: boolean
  showDate?: boolean
  emptyTitle?: string
  emptyHint?: string
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-(--radius-panel) border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
        <NotebookPen aria-hidden="true" className="size-7 text-slate-300" />
        <p className="text-[0.98rem] font-medium text-slate-600">{emptyTitle}</p>
        <p className="max-w-md text-[0.9rem] break-keep text-slate-400">{emptyHint}</p>
      </div>
    )
  }

  const timeOf = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <ol className="flex flex-col gap-2">
      {entries.map((e) => {
        const editing = editingId === e.id
        const clientName = e.clientId ? clientNames.get(e.clientId) : undefined
        const isFollow = e.entryType === 'follow_up'
        const left = isFollow && e.dueDate ? daysLeftFrom(today, e.dueDate) : null
        const overdue = isFollow && !e.completed && left !== null && left < 0
        return (
          <li
            key={e.id}
            className={`rounded-(--radius-card) border bg-white p-3.5 shadow-(--shadow-card) ${
              e.pinned ? 'border-highlight-500' : overdue ? 'border-danger-200' : 'border-slate-200'
            } ${e.completed ? 'opacity-70' : ''}`}
          >
            <div className="flex flex-wrap items-center gap-2 text-[0.85rem]">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${JOURNAL_TYPE_CLASS[e.entryType]}`}>
                {JOURNAL_TYPE_LABEL[e.entryType]}
              </span>
              {showDate && <span className="text-slate-500">{e.entryDate}</span>}
              <span className="text-slate-400">{timeOf(e.createdAt)}</span>
              {showClient && clientName && e.clientId && (
                <Link to={`/ops/clients/${e.clientId}`} className="font-semibold text-brand-700 hover:underline">
                  {clientName}
                </Link>
              )}
              {isFollow && e.dueDate && (
                <span className={`inline-flex items-center gap-1 ${overdue ? 'font-semibold text-danger-600' : 'text-slate-500'}`}>
                  <CalendarClock aria-hidden="true" className="size-3.5" />
                  {e.dueDate} · {e.completed ? '완료' : dueText(left)}
                </span>
              )}
              {e.pinned && <Pin aria-hidden="true" className="size-3.5 text-highlight-700" />}
            </div>

            {editing ? (
              <div className="mt-2">
                <textarea
                  value={draft}
                  onChange={(ev) => setDraft(ev.target.value)}
                  rows={3}
                  aria-label="기록 수정"
                  className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.98rem] focus:border-brand-500 focus:outline-none"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { onEdit(e, draft.trim()); setEditingId(null) }}
                    className="inline-flex h-9 items-center gap-1 rounded-(--radius-control) bg-brand-600 px-3 text-[0.9rem] font-semibold text-white hover:bg-brand-700"
                  >
                    <Check aria-hidden="true" className="size-4" /> 저장
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="inline-flex h-9 items-center gap-1 rounded-(--radius-control) border border-slate-200 px-3 text-[0.9rem] text-slate-600 hover:bg-slate-50"
                  >
                    <X aria-hidden="true" className="size-4" /> 취소
                  </button>
                </div>
              </div>
            ) : (
              <p className={`mt-1.5 text-[0.98rem] leading-relaxed break-keep whitespace-pre-wrap text-slate-800 ${e.completed ? 'line-through' : ''}`}>
                {e.content}
              </p>
            )}

            {!editing && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {isFollow && (
                  <button
                    type="button"
                    onClick={() => onToggleComplete(e)}
                    aria-pressed={e.completed}
                    className={`inline-flex h-8 items-center gap-1 rounded-(--radius-control) border px-2.5 text-[0.85rem] font-medium ${
                      e.completed ? 'border-success-200 bg-success-50 text-success-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Check aria-hidden="true" className="size-3.5" />
                    {e.completed ? '완료됨' : '완료'}
                  </button>
                )}
                <button type="button" onClick={() => { setDraft(e.content); setEditingId(e.id) }} aria-label="수정" className="inline-flex size-8 items-center justify-center rounded-(--radius-control) text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <Pencil aria-hidden="true" className="size-4" />
                </button>
                <button type="button" onClick={() => onTogglePin(e)} aria-label={e.pinned ? '고정 해제' : '고정'} className="inline-flex size-8 items-center justify-center rounded-(--radius-control) text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  {e.pinned ? <PinOff aria-hidden="true" className="size-4" /> : <Pin aria-hidden="true" className="size-4" />}
                </button>
                <button type="button" onClick={() => onDelete(e)} aria-label="삭제" className="inline-flex size-8 items-center justify-center rounded-(--radius-control) text-slate-400 hover:bg-danger-50 hover:text-danger-600">
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
