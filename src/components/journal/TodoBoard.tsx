/**
 * 오늘 할 일 — 대표가 직접 적은 것.
 *
 * 왜 맨 위인가
 *   규칙이 찾아 주는 경고(마감·서류·수금)는 "시스템이 아는 것" 이다. 그런데 하루를
 *   실제로 굴리는 것은 "내가 적어 둔 것" — 누구에게 전화할지, 어떤 서류를 요청할지다.
 *   전에는 규칙 경고가 화면 맨 위를 차지하고 내가 적은 것은 한참 아래에 있었다.
 *   순서를 뒤집었다.
 *
 * 어디에 저장되나
 *   업무 일기(ops_journal_entries)의 '할 일'(follow_up) 항목이다. 따로 만든 표가
 *   아니므로 일정 화면·일기 화면·업체 상세에서 같은 것이 보인다.
 */

import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import type { JournalEntry } from '../../types/bridge'
import { TODO_PRESETS } from '../../services/journalService'
import { dueText } from '../../services/clientOpsAlerts'
import { daysLeftFrom } from '../../services/clientOpsAlerts'
import { Button } from '../ui/Button'

export interface TodoDraft {
  content: string
  dueDate: string
  clientId: string | null
}

/**
 * 할 일 한 줄 적는 칸.
 *
 * 자주 쓰는 문구는 눌러서 앞부분을 채운다 — 매번 처음부터 치면 결국 안 적게 된다.
 * 업체를 고르는 것은 선택이다(고르면 그 업체 기록에서도 보인다).
 */
export function TodoComposer({
  date,
  clients,
  onAdd,
  autoFocus = false,
  compact = false,
}: {
  date: string
  clients: { id: string; companyName: string }[]
  onAdd: (draft: TodoDraft) => void
  autoFocus?: boolean
  compact?: boolean
}) {
  const [text, setText] = useState('')
  const [clientId, setClientId] = useState('')
  const [open, setOpen] = useState(autoFocus)

  const submit = () => {
    const content = text.trim()
    if (content === '') return
    onAdd({ content, dueDate: date, clientId: clientId === '' ? null : clientId })
    setText('')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap flex w-full items-center gap-2 rounded-(--radius-control) border border-dashed border-slate-300 bg-white px-4 py-3 text-left text-slate-500 hover:border-brand-400 hover:text-brand-700"
      >
        <Plus aria-hidden="true" className="size-4 shrink-0" />
        <span className="t-body">할 일 적기</span>
      </button>
    )
  }

  return (
    <div className="rounded-(--radius-control) border border-brand-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="예: 한솔테크 대표님 통화 — 벤처인증 서류 요청"
          aria-label="할 일 내용"
          className="t-body min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 px-3 py-2.5 focus:border-brand-500 focus:outline-none"
        />
        <button
          type="button"
          aria-label="닫기"
          onClick={() => setOpen(false)}
          className="tap shrink-0 rounded-(--radius-control) p-2 text-slate-400 hover:bg-slate-100"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      {/* 자주 쓰는 문구 — 앞부분만 채우고 뒷말은 직접 쓴다 */}
      <div className="-mx-1 mt-2 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TODO_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setText((v) => (v.trim() === '' ? p.text : v))}
            className="t-meta shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium whitespace-nowrap text-slate-600 hover:border-brand-300 hover:text-brand-700"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!compact && clients.length > 0 && (
          <select
            aria-label="관련 업체"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 bg-white px-2 py-2 text-[0.92rem] sm:flex-none"
          >
            <option value="">업체 없음</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        )}
        <Button variant="primary" size="sm" className="ml-auto" disabled={text.trim() === ''} onClick={submit}>
          <Plus aria-hidden="true" className="size-3.5" />
          넣기
        </Button>
      </div>
    </div>
  )
}

/** 할 일 한 줄 */
export function TodoRow({
  entry,
  today,
  clientName,
  onToggle,
  onOpenClient,
}: {
  entry: JournalEntry
  today: string
  clientName?: string
  onToggle: () => void
  onOpenClient?: () => void
}) {
  const left = entry.dueDate ? daysLeftFrom(today, entry.dueDate) : null
  const overdue = !entry.completed && left !== null && left < 0

  return (
    <li
      className={`flex items-start gap-3 rounded-(--radius-card) border px-4 py-3 ${
        entry.completed
          ? 'border-slate-200 bg-white'
          : overdue
            ? 'border-danger-200 bg-danger-50/50'
            : 'border-brand-200 bg-white'
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={entry.completed}
        aria-label={entry.completed ? '완료 취소' : '완료로 표시'}
        onClick={onToggle}
        className={`tap mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${
          entry.completed ? 'border-success-500 bg-success-500 text-white' : 'border-slate-300 bg-white hover:border-brand-500'
        }`}
      >
        {entry.completed && <Check aria-hidden="true" className="size-4" />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`t-body break-keep ${entry.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
          {entry.content}
        </p>
        <p className="t-meta mt-0.5 flex flex-wrap items-center gap-x-2 text-slate-500">
          {overdue && <span className="font-semibold text-danger-700">{dueText(left)}</span>}
          {clientName && onOpenClient && (
            <button type="button" onClick={onOpenClient} className="font-medium text-brand-700 hover:underline">
              {clientName}
            </button>
          )}
          {clientName && !onOpenClient && <span>{clientName}</span>}
        </p>
      </div>
    </li>
  )
}
